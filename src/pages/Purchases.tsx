import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { invoicesService } from '@/services/invoicesService';
import { usersService } from '@/services/usersService';
import { Invoice, InvoiceItem } from '@/types/inventory';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { SearchInput } from '@/components/ui/SearchInput';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Plus, Eye, FileText, Loader2, AlertCircle, Calendar, Hash, DollarSign, Printer, Edit2, Save } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/ui/StatusBadge';

// Helper to format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-EG', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value) + ' ج.م';
};

export default function Purchases() {
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const canCreate = hasPermission('canCreateStockIn');
  const canViewPrices = hasPermission('canViewPrices');
  const canEditAfterSubmit = hasPermission('canEditAfterSubmit');
  const { data: users = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['users'],
    queryFn: () => usersService.getAll(),
    staleTime: 300_000,
  });

  const getUserName = (userId: string) => {
    const creator = users.find(u => u.id === userId);
    return creator ? creator.name : 'Unknown';
  };

  // Fetch Invoices
  const { data: invoices = [], isLoading, error } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => invoicesService.getAll(),
    staleTime: 30_000,
  });

  const [search, setSearch] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(
      (inv) =>
        inv.supplierName.toLowerCase().includes(search.toLowerCase()) ||
        (inv.vendorInvoiceNumber && inv.vendorInvoiceNumber.includes(search))
    );
  }, [invoices, search]);

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;
  const totalItems = filteredInvoices.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredInvoices.slice(start, start + PAGE_SIZE);
  }, [filteredInvoices, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const columns = useMemo(() => {
    const baseColumns = [
      {
        key: 'date',
        header: 'التاريخ',
        render: (item: Invoice) => (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{format(item.invoiceDate, 'dd MMM yyyy', { locale: ar })}</span>
          </div>
        ),
      },
      {
        key: 'supplierName',
        header: 'المورد',
        render: (item: Invoice) => (
          <span className="font-bold text-foreground">{item.supplierName}</span>
        ),
      },
      {
        key: 'vendorInvoiceNumber',
        header: 'رقم الفاتورة',
        render: (item: Invoice) => (
          <div className="flex items-center gap-1 font-mono text-sm">
            <Hash className="w-3 h-3 text-muted-foreground" />
            <span>{item.vendorInvoiceNumber || '-'}</span>
          </div>
        ),
      },
    ];

    if (canViewPrices) {
      baseColumns.push({
        key: 'totalAmount',
        header: 'بيانات الدفع',
        render: (item: Invoice) => (
          <div className="flex flex-col gap-1 items-start">
            <div className="flex items-center gap-1 text-foreground font-bold">
              <DollarSign className="w-4 h-4 text-primary" />
              <span>{formatCurrency(item.totalAmount)}</span>
            </div>
            {item.paymentType === 'credit' ? (
              <div className="flex items-center gap-2 text-xs mt-1">
                <StatusBadge
                  status={item.paymentStatus === 'paid' ? 'success' : item.paymentStatus === 'partial' ? 'warning' : 'low'}
                  label={item.paymentStatus === 'paid' ? 'مسددة' : item.paymentStatus === 'partial' ? 'جزئي' : 'غير مسددة'}
                />
                {item.paymentStatus !== 'paid' && (
                  <span className="text-destructive font-bold">
                    (باقي {formatCurrency(item.totalAmount - (item.amountPaid || 0))})
                  </span>
                )}
              </div>
            ) : (
              <StatusBadge status="success" label="نقدي (Cash)" />
            )}
          </div>
        ),
      });
    }

    if (user?.role === 'admin') {
      baseColumns.push({
        key: 'createdBy',
        header: 'المسجل',
        render: (item: Invoice) => (
          <span className="text-xs text-muted-foreground">
            {getUserName(item.createdBy)}
          </span>
        ),
      });
    }

    baseColumns.push({
      key: 'actions',
      header: 'الإجراءات',
      render: (item: Invoice) => (
        <Button variant="ghost" size="sm" onClick={() => setSelectedInvoice(item)}>
          <Eye className="w-4 h-4 ml-2" />
          عرض التفاصيل
        </Button>
      ),
    });

    return baseColumns;
  }, [canViewPrices, user?.role, users]);

  // Invoice Details Modal Content
  const InvoiceDetails = ({ invoice }: { invoice: Invoice }) => {
    const { data: fullInvoice, isLoading: loadingDetails, refetch } = useQuery<Invoice | null>({
      queryKey: ['invoice', invoice.id],
      queryFn: () => invoicesService.getById(invoice.id),
      staleTime: 60_000,
    });
    const [editMode, setEditMode] = useState(false);
    const [editingItems, setEditingItems] = useState<Record<string, { batch: string, expiry: string }>>({});
    const [isSaving, setIsSaving] = useState(false);

    const handlePrint = () => {
      window.print();
    };

    const toggleEdit = () => {
      if (!fullInvoice) return;
      if (!editMode) {
        // Enter edit mode
        const initialEdits: any = {};
        fullInvoice.items?.forEach(item => {
          initialEdits[item.id] = {
            batch: item.batchNo || '',
            expiry: item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : ''
          };
        });
        setEditingItems(initialEdits);
        setEditMode(true);
      } else {
        // Cancel edit
        setEditMode(false);
      }
    };

    const saveChanges = async () => {
      setIsSaving(true);
      try {
        // Save all edits
        const promises = Object.entries(editingItems).map(([itemId, data]) =>
          invoicesService.updateItem(itemId, data.batch, data.expiry ? new Date(data.expiry) : undefined)
        );
        await Promise.all(promises);
        toast.success('تم حفظ التعديلات بنجاح');
        setEditMode(false);
        refetch();
      } catch (err) {
        toast.error('فشل حفظ التعديلات');
        console.error(err);
      } finally {
        setIsSaving(false);
      }
    };

    // Enhanced currency formatter with bold styling
    const formatCurrencyBold = (value: number) => {
      const formatted = new Intl.NumberFormat('en-EG', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);
      return formatted;
    };

    if (loadingDetails) return <div className="p-8 text-center text-muted-foreground">جاري تحميل التفاصيل...</div>;
    if (!fullInvoice) return <div className="p-8 text-center text-destructive">لم يتم العثور على الفاتورة</div>;

    return (
      <div className="space-y-6 modal-print-container">
        {/* Action Buttons - Hidden on Print */}
        <div className="flex gap-2 justify-end print:hidden no-print">
          {editMode ? (
            <>
              <Button variant="outline" size="sm" onClick={toggleEdit} disabled={isSaving}>
                إلغاء
              </Button>
              <Button variant="default" size="sm" onClick={saveChanges} disabled={isSaving}>
                {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                <Save className="w-4 h-4 mr-2" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 ml-2" />
                طباعة
              </Button>
              {canEditAfterSubmit && (
                <Button variant="secondary" size="sm" onClick={toggleEdit}>
                  <Edit2 className="w-4 h-4 ml-2" />
                  تعديل
                </Button>
              )}
            </>
          )}
        </div>

        <div className="flex justify-between items-start border-b border-border pb-4 mb-4" id="printable-header">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">المورد:</span>
              <span className="font-bold text-lg text-primary">{fullInvoice.supplierName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">التاريخ:</span>
              <span className="font-medium font-mono">{format(fullInvoice.invoiceDate, 'dd/MM/yyyy')}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <StatusBadge
                status={fullInvoice.paymentType === 'credit' ? 'warning' : 'success'}
                label={fullInvoice.paymentType === 'credit' ? 'آجل (Credit)' : 'نقدي (Cash)'}
              />
            </div>
          </div>
          <div className="text-left space-y-1">
            {fullInvoice.vendorInvoiceNumber && (
              <div className="font-mono text-sm bg-muted px-2 py-1 rounded">
                REF: {fullInvoice.vendorInvoiceNumber}
              </div>
            )}
            <div className="font-bold text-xl text-primary mt-2">
              <span className="font-bold">{formatCurrencyBold(fullInvoice.totalAmount)}</span> ج.م
            </div>
          </div>
        </div>

        {/* Print Only Header */}
        <div className="hidden print:block mb-8 text-center border-b pb-4">
          <h1 className="text-2xl font-bold">فاتورة مشتريات</h1>
          <p className="text-sm text-gray-500">شركة الدلتا للمستلزمات الطبية</p>
        </div>

        <div>
          <h4 className="font-semibold mb-3">أصناف الفاتورة</h4>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="p-2 text-right">الصنف</th>
                  <th className="p-2 text-right">الكمية</th>
                  <th className="p-2 text-right">السعر</th>
                  <th className="p-2 text-right">الإجمالي</th>
                  <th className="p-2 text-right">Batch</th>
                  <th className="p-2 text-right">الانتهاء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {fullInvoice.items?.map((item: InvoiceItem) => (
                  <tr key={item.id} className="hover:bg-accent/10 transition-colors duration-150">
                    <td className="p-3 font-medium">{item.productName}</td>
                    <td className="p-3 font-bold text-center">{item.quantity}</td>
                    <td className="p-3 text-center">
                      <span className="font-bold">{formatCurrencyBold(item.unitCost)}</span> ج.م
                    </td>
                    <td className="p-3 font-bold text-primary">
                      <span className="font-bold">{formatCurrencyBold(item.quantity * item.unitCost)}</span> ج.م
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground text-center">
                      {editMode ? (
                        <input
                          className="w-24 p-1 border rounded bg-background text-foreground"
                          value={editingItems[item.id]?.batch}
                          onChange={e => setEditingItems(prev => ({ ...prev, [item.id]: { ...prev[item.id], batch: e.target.value } }))}
                        />
                      ) : (
                        item.batchNo || '-'
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground text-center">
                      {editMode ? (
                        <input
                          type="date"
                          className="w-32 p-1 border rounded bg-background text-foreground"
                          value={editingItems[item.id]?.expiry}
                          onChange={e => setEditingItems(prev => ({ ...prev, [item.id]: { ...prev[item.id], expiry: e.target.value } }))}
                        />
                      ) : (
                        item.expiryDate ? format(new Date(item.expiryDate), 'dd/MM/yyyy') : '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/50 font-bold">
                <tr>
                  <td colSpan={3} className="p-3 text-left pl-4">إجمالي الفاتورة:</td>
                  <td colSpan={3} className="p-3 text-primary text-lg">
                    <span className="font-bold">{formatCurrencyBold(fullInvoice.totalAmount)}</span> ج.م
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="فواتير الشراء"
        description="سجل شامل لجميع فواتير المشتريات والموردين"
        actions={
          canCreate && (
            <Button onClick={() => navigate('/purchases/new')}>
              <Plus className="w-4 h-4 ml-2" />
              تسجيل فاتورة جديدة
            </Button>
          )
        }
      />

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="mr-3 text-muted-foreground">جارٍ تحميل الفواتير...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive mb-6">
          <AlertCircle className="w-5 h-5" />
          <span>حدث خطأ في تحميل البيانات. يرجى المحاولة لاحقاً.</span>
        </div>
      )}

      {!isLoading && !error && (
        <>
          <div className="mb-6">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="بحث باسم المورد أو رقم الفاتورة..."
              className="max-w-md"
            />
          </div>

          <DataTable
            columns={columns}
            data={paginatedInvoices}
            keyExtractor={(item) => item.id}
            emptyMessage="لا توجد فواتير مسجلة"
          />

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                إجمالي الفواتير: {totalItems} • صفحة {currentPage} من {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  ← السابق
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  التالي →
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* View Details Modal */}
      <Modal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title={`تفاصيل الفاتورة`}
        size="lg"
      >
        {selectedInvoice && <InvoiceDetails invoice={selectedInvoice} />}
      </Modal>
    </div>
  );
}
