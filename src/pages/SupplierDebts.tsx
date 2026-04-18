import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { invoicesService } from '@/services/invoicesService';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Wallet, DollarSign, Users, ExternalLink, Activity } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'sonner';

export default function SupplierDebts() {
    const queryClient = useQueryClient();
    const { data: openInvoices = [], isLoading } = useQuery({
        queryKey: ['open_invoices'],
        queryFn: () => invoicesService.getOpenInvoices()
    });

    const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
    const [paymentModal, setPaymentModal] = useState<{ invoice: any } | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');

    const payInvoiceMutation = useMutation({
        mutationFn: ({ invoiceId, amount }: { invoiceId: string, amount: number }) => invoicesService.updatePayment(invoiceId, amount),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['open_invoices'] });
            toast.success('تم تسجيل الدفعة بنجاح');
            setPaymentModal(null);
            setPaymentAmount('');
        },
        onError: (err: any) => {
            toast.error(err.message || 'حدث خطأ أثناء تسجيل الدفعة');
        }
    });

    // Aggregate by supplier
    const supplierDebts = Object.values(openInvoices.reduce((acc: any, inv: any) => {
        if (!acc[inv.supplier_name]) {
            acc[inv.supplier_name] = {
                supplierName: inv.supplier_name,
                totalDebt: 0,
                invoicesCount: 0,
                invoices: []
            };
        }
        acc[inv.supplier_name].totalDebt += Number(inv.balance_due || 0);
        acc[inv.supplier_name].invoicesCount += 1;
        acc[inv.supplier_name].invoices.push(inv);
        return acc;
    }, {})).sort((a: any, b: any) => b.totalDebt - a.totalDebt);

    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 15;
    const totalItems = supplierDebts.length;
    const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
    const paginatedSupplierDebts = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return supplierDebts.slice(start, start + PAGE_SIZE);
    }, [supplierDebts, currentPage]);

    const formatCurrency = (val: number | any) => {
        return new Intl.NumberFormat('en-EG', { style: 'decimal', minimumFractionDigits: 0 }).format(Number(val)) + ' ج.م';
    };

    // Need to dynamically update the selected supplier if data changes
    const currentSelectedSupplier: any = useMemo(() => {
        if (!selectedSupplier) return null;
        return supplierDebts.find((s: any) => s.supplierName === selectedSupplier.supplierName) || null;
    }, [selectedSupplier, supplierDebts]);

    const columns = [
        {
            key: 'supplierName',
            header: 'اسم المورد',
            render: (item: any) => <span className="font-bold">{item.supplierName}</span>
        },
        {
            key: 'invoicesCount',
            header: 'عدد الفواتير الآجلة',
            render: (item: any) => (
                <span className="inline-flex items-center px-2 py-1 bg-secondary text-secondary-foreground rounded-full text-xs font-medium">
                    {item.invoicesCount} فاتورة
                </span>
            )
        },
        {
            key: 'totalDebt',
            header: 'إجمالي المديونية',
            render: (item: any) => (
                <span className="text-destructive font-bold text-lg">
                    {formatCurrency(item.totalDebt)}
                </span>
            )
        },
        {
            key: 'actions',
            header: 'إجراءات',
            render: (item: any) => (
                <Button variant="ghost" size="sm" onClick={() => setSelectedSupplier(item)} className="hover:bg-primary/10 hover:text-primary">
                    <ExternalLink className="w-4 h-4 ml-2" />
                    عرض وتسديد
                </Button>
            )
        },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                title="مديونية الموردين (الآجل)"
                description="متابعة الأرصدة المستحقة للموردين والفواتير غير المسددة"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-destructive/10 text-destructive rounded-xl">
                            <Wallet className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">إجمالي المديونيات</p>
                            <h3 className="text-2xl font-bold text-foreground">
                                {formatCurrency(supplierDebts.reduce((sum: number, s: any) => sum + s.totalDebt, 0))}
                            </h3>
                        </div>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 text-primary rounded-xl">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">الموردون الدائنون</p>
                            <h3 className="text-2xl font-bold text-foreground">
                                {supplierDebts.length} <span className="text-sm font-normal text-muted-foreground">مورد</span>
                            </h3>
                        </div>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-warning/10 text-warning rounded-xl">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">الفواتير المفتوحة</p>
                            <h3 className="text-2xl font-bold text-foreground">
                                {openInvoices.length} <span className="text-sm font-normal text-muted-foreground">فاتورة</span>
                            </h3>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border bg-muted/30">
                    <h2 className="text-lg font-bold text-foreground">المديونيات التفصيلية حسب المورد</h2>
                </div>
                <div className="p-6">
                    {isLoading ? (
                        <div className="text-center py-10 text-muted-foreground flex flex-col items-center justify-center">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                            جاري تحميل البيانات...
                        </div>
                    ) : (
                        <>
                            <DataTable
                                columns={columns}
                                data={paginatedSupplierDebts}
                                keyExtractor={(item: any) => item.supplierName}
                                emptyMessage="لا توجد مديونيات حالياً"
                            />

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4">
                                    <span className="text-sm text-muted-foreground">
                                        إجمالي الموردين: {totalItems} • صفحة {currentPage} من {totalPages}
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
                </div>
            </div>

            {/* Supplier Invoices Modal */}
            <Modal
                isOpen={!!selectedSupplier}
                onClose={() => setSelectedSupplier(null)}
                title={`مديونيات وفواتير المورد: ${currentSelectedSupplier?.supplierName || ''}`}
                size="lg"
            >
                {currentSelectedSupplier && currentSelectedSupplier.invoices.length > 0 ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-destructive/5 border border-destructive/20 p-4 rounded-lg">
                                <p className="text-sm font-medium text-destructive/80 mb-1">إجمالي المديونية الحالية</p>
                                <h3 className="text-2xl font-bold text-destructive">
                                    {formatCurrency(currentSelectedSupplier.totalDebt)}
                                </h3>
                            </div>
                            <div className="bg-muted border border-border p-4 rounded-lg">
                                <p className="text-sm font-medium text-muted-foreground mb-1">عدد الفواتير المفتوحة</p>
                                <h3 className="text-2xl font-bold text-foreground">
                                    {currentSelectedSupplier.invoicesCount}
                                </h3>
                            </div>
                        </div>

                        <div className="mt-6">
                            <h4 className="font-semibold text-foreground mb-3">تفاصيل الفواتير:</h4>
                            <div className="overflow-x-auto rounded-lg border border-border">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="px-4 py-3 text-right">رقم الفاتورة</th>
                                            <th className="px-4 py-3 text-right">التاريخ</th>
                                            <th className="px-4 py-3 text-center">الإجمالي</th>
                                            <th className="px-4 py-3 text-center">المدفوع سلفاً</th>
                                            <th className="px-4 py-3 text-center">المتبقي (المديونية)</th>
                                            <th className="px-4 py-3 text-center">تسديد</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border bg-card">
                                        {currentSelectedSupplier.invoices.map((inv: any) => (
                                            <tr key={inv.id} className="hover:bg-muted/20">
                                                <td className="px-4 py-3 opacity-90">{inv.vendor_invoice_number || 'بدون رقم'}</td>
                                                <td className="px-4 py-3 opacity-90">{inv.invoice_date}</td>
                                                <td className="px-4 py-3 text-center num text-muted-foreground">{formatCurrency(inv.total_amount)}</td>
                                                <td className="px-4 py-3 text-center num text-success">{formatCurrency(inv.amount_paid)}</td>
                                                <td className="px-4 py-3 text-center num font-bold text-destructive">{formatCurrency(inv.balance_due)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <Button
                                                        size="sm"
                                                        className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground min-w-[80px]"
                                                        onClick={() => setPaymentModal({ invoice: inv })}
                                                    >
                                                        دفع
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="py-12 text-center text-muted-foreground">
                        <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        لا توجد فواتير مفتوحة لهذا المورد
                    </div>
                )}
            </Modal>

            {/* Make a Payment Modal */}
            <Modal
                isOpen={!!paymentModal}
                onClose={() => {
                    setPaymentModal(null);
                    setPaymentAmount('');
                }}
                title="تسديد دفعة/الفاتورة"
                size="sm"
                footer={
                    <>
                        <Button variant="outline" onClick={() => {
                            setPaymentModal(null);
                            setPaymentAmount('');
                        }}>إلغاء</Button>
                        <Button
                            className="bg-primary hover:bg-primary/90 text-white min-w-[120px]"
                            onClick={() => {
                                if (!paymentModal) return;
                                const totalPaidNow = Number(paymentAmount) + Number(paymentModal.invoice.amount_paid);
                                payInvoiceMutation.mutate({ invoiceId: paymentModal.invoice.id, amount: totalPaidNow });
                            }}
                            disabled={!paymentAmount || isNaN(Number(paymentAmount)) || Number(paymentAmount) <= 0 || (paymentModal && Number(paymentAmount) > Number(paymentModal.invoice.balance_due)) || payInvoiceMutation.isPending}
                        >
                            {payInvoiceMutation.isPending ? 'جاري التسديد...' : 'تأكيد التسديد'}
                        </Button>
                    </>
                }
            >
                {paymentModal && (
                    <div className="space-y-4 pt-2">
                        <div className="p-4 bg-muted/40 rounded-lg space-y-2 text-sm border border-border">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">إجمالي الفاتورة:</span>
                                <strong>{formatCurrency(paymentModal.invoice.total_amount)}</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">المدفوع مسبقاً:</span>
                                <strong className="text-success">{formatCurrency(paymentModal.invoice.amount_paid)}</strong>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-border">
                                <span className="text-muted-foreground">المديونية المتبقية:</span>
                                <strong className="text-destructive font-bold text-base">{formatCurrency(paymentModal.invoice.balance_due)}</strong>
                            </div>
                        </div>

                        <div className="space-y-2 mt-4">
                            <label className="text-sm font-semibold">المبلغ المراد تسديده</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="1"
                                    max={paymentModal.invoice.balance_due}
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    placeholder="0"
                                    className={`w-full h-11 pl-12 pr-4 rounded-lg border focus:ring-2 num text-lg ${
                                        Number(paymentAmount) > Number(paymentModal.invoice.balance_due) 
                                        ? 'border-destructive focus:ring-destructive/50 text-destructive' 
                                        : 'border-input focus:ring-primary'
                                    }`}
                                />
                                <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold ${
                                    Number(paymentAmount) > Number(paymentModal.invoice.balance_due) ? 'text-destructive' : 'text-muted-foreground'
                                }`}>ج.م</span>
                            </div>
                            
                            {Number(paymentAmount) > Number(paymentModal.invoice.balance_due) && (
                                <p className="text-xs text-destructive mt-1 font-medium">المبلغ المدخل أكبر من المديونية المتبقية</p>
                            )}

                            <div className="flex gap-2 mt-2">
                                <button
                                    className="text-xs bg-primary/10 text-primary px-2 py-1 flex-1 rounded hover:bg-primary/20 transition-colors font-medium border border-primary/20"
                                    onClick={() => setPaymentAmount(paymentModal.invoice.balance_due.toString())}
                                >
                                    تسديد المبلغ بالكامل
                                </button>
                                <button
                                    className="text-xs bg-foreground/5 text-foreground px-2 py-1 flex-1 rounded hover:bg-foreground/10 transition-colors font-medium border border-border"
                                    onClick={() => setPaymentAmount((paymentModal.invoice.balance_due / 2).toString())}
                                >
                                    تسديد النصف
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
