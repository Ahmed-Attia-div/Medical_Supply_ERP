import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts, useSurgeriesList } from '@/hooks/useSupabaseData';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { surgeriesService } from '@/services/surgeriesService';
import { productsService } from '@/services/productsService';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { SearchInput } from '@/components/ui/SearchInput';
import { Plus, Trash2, ShoppingBag, Activity, TrendingDown, Lock, AlertCircle, Loader2, Printer, X, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SurgeryPrintReport } from '@/components/reports/SurgeryPrintReport';

interface InventoryItem {
  id: string;
  name: string;
  scientificName?: string;
  catalog?: string;
}

const getItemDisplayName = (item: InventoryItem) => {
  const parts = [item.name];
  if (item.scientificName) parts.push(item.scientificName);
  if (item.catalog) parts.push(`(${item.catalog})`);
  return parts.join(' - ');
};

interface SalesFormProps {
  formData: any;
  setFormData: (data: any) => void;
  marginError: string | null;
  canViewPrices: boolean;
  canViewProfit: boolean;
  doctors: any[];
  inventory: any[];
}

const SalesForm = ({
  formData,
  setFormData,
  marginError,
  canViewPrices,
  canViewProfit,
  doctors,
  inventory
}: SalesFormProps) => {
  const [currentItem, setCurrentItem] = useState({
    itemId: '',
    batchId: '',
    batchName: '',
    itemName: '',
    quantity: '',
    basePrice: 0,
    sellingPrice: '',
  });

  const { data: itemBatches = [] } = useQuery({
    queryKey: ['productBatches', currentItem.itemId],
    queryFn: () => productsService.getBatches(currentItem.itemId),
    enabled: !!currentItem.itemId,
  });

  const [isNewDoctor, setIsNewDoctor] = useState(false);
  const [newDoctorName, setNewDoctorName] = useState('');
  const [newDoctorSpecialty, setNewDoctorSpecialty] = useState('');
  const [newDoctorPhone, setNewDoctorPhone] = useState('');

  // Derived helpers for current item validation
  const selectedInventoryItem = inventory.find(i => i.id === currentItem.itemId);
  const availableQty = selectedInventoryItem?.totalQuantity ?? 0;
  const qtyNum = Number(currentItem.quantity) || 0;
  const isQtyOverStock = qtyNum > availableQty;
  const sellingNum = Number(currentItem.sellingPrice) || 0;
  const isBelowCost = sellingNum > 0 && sellingNum < currentItem.basePrice;

  const handleAddItem = () => {
    if (!currentItem.itemId || !currentItem.quantity) return;

    // Check if selling price is required and provided
    if (formData.type !== 'usage' && canViewPrices && !currentItem.sellingPrice) {
      toast.error('يجب إدخال سعر البيع');
      return;
    }

    const selectedItem = inventory.find(i => i.id === currentItem.itemId);
    if (!selectedItem) return;

    // Check quantity against available stock
    if (qtyNum <= 0) {
      toast.error('الكمية يجب أن تكون أكبر من صفر');
      return;
    }
    if (qtyNum > selectedItem.totalQuantity) {
      toast.error(`الكمية المطلوبة (${qtyNum}) تتجاوز المتاح في المخزون (${selectedItem.totalQuantity})`);
      return;
    }

    // Validate selling price >= base price
    if (formData.type !== 'usage' && sellingNum < currentItem.basePrice) {
      toast.error(`سعر البيع (${sellingNum}) لا يمكن أن يكون أقل من السعر الأساسي (${currentItem.basePrice})`);
      return;
    }

    const newItem = {
      uniqueId: Date.now(),
      itemId: currentItem.itemId,
      itemName: currentItem.itemName,
      quantity: qtyNum,
      basePrice: currentItem.basePrice,
      sellingPrice: formData.type === 'usage' ? 0 : sellingNum,
      source_batch_id: currentItem.batchId || undefined,
      batchName: currentItem.batchName || '(تعيين تلقائي - الأقدم)'
    };

    setFormData({
      ...formData,
      items: [...formData.items, newItem],
    });

    setCurrentItem({
      itemId: '',
      batchId: '',
      batchName: '',
      itemName: '',
      quantity: '',
      basePrice: 0,
      sellingPrice: '',
    });
  };

  const handleRemoveItem = (uniqueId: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((item: any) => item.uniqueId !== uniqueId),
    });
  };

  const handleCurrentItemChange = (itemId: string) => {
    const selectedItem = inventory.find(i => i.id === itemId);
    if (selectedItem) {
      setCurrentItem({
        itemId: selectedItem.id,
        batchId: '',
        batchName: '',
        itemName: getItemDisplayName(selectedItem),
        quantity: '',
        basePrice: selectedItem.basePriceWac ?? 0,
        sellingPrice: (selectedItem.sellingPrice ?? 0).toString(),
      });
    } else {
      setCurrentItem({
        itemId: '', batchId: '', batchName: '', itemName: '', quantity: '', basePrice: 0, sellingPrice: ''
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="p-4 bg-muted/20 rounded-lg border border-border space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              التاريخ <span className="text-destructive">*</span>
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              نوع العملية <span className="text-destructive">*</span>
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="surgery">جراحة</option>
              <option value="usage">استهلاك داخلي</option>
            </select>
          </div>

          {formData.type === 'surgery' && (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  الطبيب <span className="text-destructive">*</span>
                </label>

                {!isNewDoctor && formData.doctorId && formData.doctorId.startsWith('NEW-') ? (
                  <div className="flex gap-2">
                    <div className="w-full h-10 px-3 flex items-center justify-between rounded-lg border border-success/50 bg-success/5 text-success">
                      <span className="font-medium">{formData.doctorName}</span>
                      <span className="text-xs bg-success text-white px-2 py-0.5 rounded-full">جديد</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setFormData({ ...formData, doctorId: '', doctorName: '' });
                        setIsNewDoctor(false);
                        setNewDoctorName('');
                      }}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : !isNewDoctor ? (
                  <div className="flex gap-2">
                    <select
                      value={formData.doctorId}
                      onChange={(e) => {
                        const doctor = doctors.find(d => d.id === e.target.value);
                        setFormData({ ...formData, doctorId: e.target.value, doctorName: doctor?.name || '' });
                      }}
                      className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">اختر الطبيب</option>
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.name}{doctor.specialty ? ` - ${doctor.specialty}` : ''}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsNewDoctor(true)}
                      title="طبيب جديد"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border">
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-muted-foreground">اسم الطبيب <span className="text-destructive">*</span></label>
                      <input
                        type="text"
                        value={newDoctorName}
                        onChange={(e) => setNewDoctorName(e.target.value)}
                        placeholder="اسم الطبيب الجديد"
                        className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-muted-foreground">التخصص</label>
                        <input
                          type="text"
                          value={newDoctorSpecialty}
                          onChange={(e) => setNewDoctorSpecialty(e.target.value)}
                          placeholder="مثال: جراحة عظام"
                          className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-muted-foreground">الهاتف</label>
                        <input
                          type="tel"
                          value={newDoctorPhone}
                          onChange={(e) => setNewDoctorPhone(e.target.value)}
                          placeholder="01xxxxxxxxx"
                          dir="ltr"
                          className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => {
                          if (newDoctorName.trim()) {
                            const tempId = `NEW-${Date.now()}`;
                            setFormData({
                              ...formData,
                              doctorId: tempId,
                              doctorName: newDoctorName,
                              newDoctorSpecialty: newDoctorSpecialty.trim() || undefined,
                              newDoctorPhone: newDoctorPhone.trim() || undefined,
                            });
                            setIsNewDoctor(false);
                          }
                        }}
                        disabled={!newDoctorName.trim()}
                        className="bg-success hover:bg-success/90 text-white"
                      >
                        تأكيد
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setIsNewDoctor(false);
                          setNewDoctorName('');
                          setNewDoctorSpecialty('');
                          setNewDoctorPhone('');
                          setFormData({ ...formData, doctorId: '', doctorName: '' });
                        }}
                      >
                        إلغاء
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="block text-sm font-medium text-foreground">
                  اسم المريض
                </label>
                <input
                  type="text"
                  value={formData.patientName}
                  onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="اسم المريض بالكامل"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Items Section */}
      <div className="p-4 bg-muted/20 rounded-lg border border-border space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-primary" />
          بنود العملية
        </h3>

        {/* Add Item Form */}
        <div className="flex flex-col gap-4 bg-card/50 p-5 rounded-xl border border-border shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-x-4 gap-y-5 items-start">

            {/* Item selection */}
            <div className="lg:col-span-4 space-y-2">
              <label className="block text-sm font-semibold text-foreground">
                الصنف
              </label>
              <select
                value={currentItem.itemId}
                onChange={(e) => handleCurrentItemChange(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow text-sm"
              >
                <option value="">اختر الصنف</option>
                {inventory.map((item) => (
                  <option key={item.id} value={item.id}>
                    {getItemDisplayName(item)} (متاح: {item.totalQuantity})
                  </option>
                ))}
              </select>
            </div>

            {/* Batch Selector */}
            <div className="lg:col-span-3 space-y-2">
              <label className="block text-sm font-semibold text-foreground">
                التشغيلة (Batch)
              </label>
              <select
                value={currentItem.batchId}
                onChange={(e) => {
                  const selectedBatch = itemBatches.find(b => b.id === e.target.value);
                  setCurrentItem({
                    ...currentItem,
                    batchId: e.target.value,
                    batchName: selectedBatch ? `${selectedBatch.batch_no || 'بدون رقم'} - متوفر: ${selectedBatch.quantity}` : '',
                  });
                }}
                className="w-full h-11 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow text-sm"
                disabled={!currentItem.itemId || itemBatches.length === 0}
              >
                <option value="">تلقائي (الأقدم صلاحية - FIFO)</option>
                {itemBatches.map((batch: any) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batch_no || 'بدون رقم'} (متوفر: {batch.quantity}) | صلاحية: {batch.expiry_date ? format(new Date(batch.expiry_date), 'yyyy-MM-dd') : 'لا يوجد'}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div className="lg:col-span-2 space-y-2">
              <label className="block text-sm font-semibold text-foreground">
                الكمية
              </label>
              <div className="space-y-1.5">
                <input
                  type="number"
                  value={currentItem.quantity}
                  onChange={(e) => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                  className={cn(
                    'w-full h-11 px-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow num',
                    isQtyOverStock ? 'border-destructive focus:ring-destructive/50' : 'border-input'
                  )}
                  dir="ltr"
                  min="1"
                  max={availableQty}
                  placeholder="0"
                />
                <div className="min-h-[20px]">
                  {currentItem.itemId && (
                    <p className={cn('text-xs font-medium', isQtyOverStock ? 'text-destructive' : 'text-muted-foreground')}>
                      {isQtyOverStock
                        ? `⚠ يتجاوز المتاح (${availableQty})`
                        : `المتاح: ${availableQty}`}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Price */}
            {canViewPrices && formData.type !== 'usage' && (
              <div className="lg:col-span-3 space-y-2">
                <label className="block text-sm font-semibold text-foreground">
                  سعر البيع (للوحدة)
                </label>
                <div className="space-y-1.5">
                  <div className="relative">
                    <input
                      type="number"
                      value={currentItem.sellingPrice}
                      onChange={(e) => setCurrentItem({ ...currentItem, sellingPrice: e.target.value })}
                      className={cn(
                        'w-full h-11 pl-12 pr-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow num',
                        isBelowCost ? 'border-destructive focus:ring-destructive/50' : 'border-input'
                      )}
                      dir="ltr"
                      min={currentItem.basePrice}
                      step="0.01"
                      placeholder="0"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">ج.م</span>
                  </div>
                  <div className="min-h-[20px]">
                    {currentItem.itemId && (
                      isBelowCost ? (
                        <p className="text-[11px] text-destructive font-bold leading-tight">
                          ⚠ أقل من التكلفة ({currentItem.basePrice})!
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          المقترح: <span className="font-bold text-success">{selectedInventoryItem?.sellingPrice ?? 0}</span>{currentItem.basePrice > 0 && ` | تكلفة: ${currentItem.basePrice}`}
                        </p>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border/60 flex justify-end">
            <Button
              type="button"
              onClick={handleAddItem}
              className="w-full sm:w-auto min-w-[140px] shadow-sm hover:shadow-md transition-all"
              disabled={
                !currentItem.itemId ||
                !currentItem.quantity ||
                isQtyOverStock ||
                (formData.type !== 'usage' && canViewPrices && !currentItem.sellingPrice) ||
                (formData.type !== 'usage' && isBelowCost)
              }
            >
              <Plus className="w-4 h-4 ml-2" />
              إضافة البند للعملية
            </Button>
          </div>
        </div>

        {/* Items List */}
        {formData.items.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-right">الصنف</th>
                  <th className="px-4 py-3 text-right">التشغيلة (Batch)</th>
                  <th className="px-4 py-3 text-center">الكمية</th>
                  {canViewPrices && formData.type !== 'usage' && (
                    <>
                      <th className="px-4 py-3 text-center">سعر الوحدة</th>
                      <th className="px-4 py-3 text-center">الإجمالي</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {formData.items.map((item: any) => (
                  <tr key={item.uniqueId}>
                    <td className="px-4 py-3 font-medium">{item.itemName}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{item.batchName}</td>
                    <td className="px-4 py-3 text-center num">{item.quantity}</td>
                    {canViewPrices && formData.type !== 'usage' && (
                      <>
                        <td className="px-4 py-3 text-center num text-muted-foreground">
                          {new Intl.NumberFormat('en-EG').format(Number(item.sellingPrice))}
                        </td>
                        <td className="px-4 py-3 text-center num font-bold text-primary">
                          {new Intl.NumberFormat('en-EG', { style: 'decimal', minimumFractionDigits: 0 }).format(Number(item.quantity) * Number(item.sellingPrice))}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleRemoveItem(item.uniqueId)}
                        className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {canViewPrices && formData.type !== 'usage' && (
                <tfoot className="bg-muted/50 border-t border-border font-bold">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right">إجمالي العملية:</td>
                    <td className="px-4 py-3 text-center text-primary num text-lg">
                      {new Intl.NumberFormat('en-EG', { style: 'decimal', minimumFractionDigits: 0 }).format(
                        formData.items.reduce((sum: number, item: any) => sum + (Number(item.quantity) * Number(item.sellingPrice)), 0)
                      ) + ' ج.م'}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border">
            لم يتم إضافة أي أصناف بعد
          </div>
        )}
      </div>

      {marginError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{marginError}</span>
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          ملاحظات عامة
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          rows={2}
          placeholder="ملاحظات على العملية..."
        />
      </div>
    </div>
  );
};

export default function Sales() {
  const { hasPermission, user } = useAuth();
  const canCreate = hasPermission('canCreateStockOut');
  const canEdit = hasPermission('canEditAfterSubmit');
  const canDelete = hasPermission('canDeleteRecords');
  const canViewPrices = hasPermission('canViewPrices');
  const canViewProfit = hasPermission('canViewProfit');

  const queryClient = useQueryClient();

  // Surgeries list
  const { data: surgeries = [], isLoading: loadingSurgeries, error: errorSurgeries } = useSurgeriesList();

  // Inventory — fetch all (no pagination) for the item selection dropdown
  const { data: pagedInventory, isLoading: loadingInventory } = useProducts({}, { page: 1, pageSize: 500 });
  const inventory = pagedInventory?.data ?? [];

  // Doctors
  const { data: doctors = [], isLoading: loadingDoctors } = useQuery<{ id: string; name: string; specialty?: string }[]>({
    queryKey: ['doctors'],
    queryFn: async () => {
      const { data } = await supabase.from('doctors').select('id,name,specialty');
      return (data ?? []) as { id: string; name: string; specialty?: string }[];
    },
    staleTime: 300_000,
  });

  // Mutations
  const createDoctor = useMutation({
    mutationFn: async (data: { name: string; specialty?: string; phone?: string }) => {
      const insertData: Record<string, unknown> = { name: data.name };
      if (data.specialty) insertData.specialty = data.specialty;
      if (data.phone) insertData.phone = data.phone;
      const { data: doc, error } = await supabase.from('doctors').insert(insertData).select().single();
      if (error) throw error;
      return doc;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doctors'] }),
  });

  const createSurgery = useMutation({
    mutationFn: (data: any) => surgeriesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surgeries'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const deleteSurgery = useMutation({
    mutationFn: (id: string) => surgeriesService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['surgeries'] }),
  });

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'sale' | 'usage' | 'surgery'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteSale, setDeleteSale] = useState<any | null>(null);
  const [printSale, setPrintSale] = useState<any | null>(null);
  const [returnItemModal, setReturnItemModal] = useState<{ surgeryId: string; item: any } | null>(null);
  const [returnQty, setReturnQty] = useState('');
  const [marginError, setMarginError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const printRef = useRef<HTMLDivElement>(null);

  const returnSurgeryItem = useMutation({
    mutationFn: ({ id, qty }: { id: string, qty: number }) => surgeriesService.processReturn(id, qty),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surgeries'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['productBatches'] });
      toast.success('تم إرجاع البند بنجاح');
      setReturnItemModal(null);
      setReturnQty('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ أثناء تسجيل المرتجع');
    }
  });

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'surgery' as 'sale' | 'usage' | 'surgery',
    doctorId: '',
    doctorName: '',
    patientName: '',
    notes: '',
    items: [],
  });

  // Group surgeries by ID instead of flattening
  const groupedSurgeries = useMemo(() => {
    return surgeries.map(surgery => {
      const doctor = doctors.find(d => d.id === surgery.doctorId);
      const totalSellingValue = surgery.items.reduce((sum: number, item: any) => sum + (item.sellingPrice * (item.quantity - (item.returnedQuantity || 0))), 0);
      const totalBaseValue = surgery.items.reduce((sum: number, item: any) => sum + (item.basePrice * (item.quantity - (item.returnedQuantity || 0))), 0);

      return {
        id: surgery.id,
        date: surgery.date,
        type: surgery.type || 'surgery',
        doctorId: surgery.doctorId,
        doctorName: doctor?.name || '',
        patientName: surgery.patientName,
        notes: surgery.notes,
        items: surgery.items,
        totalSellingValue,
        totalBaseValue,
        profit: totalSellingValue - totalBaseValue,
        createdBy: surgery.createdBy,
        createdAt: surgery.createdAt,
        isLocked: true,
      };
    });
  }, [surgeries, doctors]);

  const filteredSurgeries = useMemo(() => {
    return groupedSurgeries.filter((s) => {
      const matchesSearch =
        s.patientName?.includes(search) ||
        s.doctorName?.includes(search) ||
        s.items.some(item => item.itemName.includes(search));
      const matchesType = typeFilter === 'all' || s.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [groupedSurgeries, search, typeFilter]);

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;
  const totalItems = filteredSurgeries.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
  const paginatedSurgeries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredSurgeries.slice(start, start + PAGE_SIZE);
  }, [filteredSurgeries, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter]);

  const toggleRowExpansion = (id: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(id)) {
      newExpandedRows.delete(id);
    } else {
      newExpandedRows.add(id);
    }
    setExpandedRows(newExpandedRows);
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      type: 'surgery',
      doctorId: '',
      doctorName: '',
      patientName: '',
      notes: '',
      items: [],
    });
    setMarginError(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleSave = async () => {
    // 0. التحقق من المستخدم
    if (!user?.id) {
      toast.error('خطأ: لم يتم التعرف على المستخدم الحالي. يرجى تسجيل الدخول مرة أخرى.');
      return;
    }

    // 1. التحقق من وجود أصناف
    if (formData.items.length === 0) {
      toast.error('يجب إضافة صنف واحد على الأقل للعملية');
      return;
    }

    let finalDoctorId = formData.doctorId;

    // 2. التحقق من بيانات العملية الجراحية وإنشاء الطبيب الجديد إذا لزم الأمر
    if (formData.type === 'surgery') {
      if (!finalDoctorId) {
        toast.error('يجب اختيار الطبيب للعملية الجراحية');
        return;
      }

      // Check if it's a new doctor (starts with NEW-)
      if (finalDoctorId.startsWith('NEW-')) {
        if (createDoctor.isPending) {
          toast.error('جارٍ إضافة الطبيب... يرجى الانتظار');
          return;
        }
        try {
          const newDoctor = await createDoctor.mutateAsync({
            name: formData.doctorName,
            specialty: (formData as any).newDoctorSpecialty || undefined,
            phone: (formData as any).newDoctorPhone || undefined,
          });
          finalDoctorId = newDoctor.id;
          toast.success('تم إضافة الطبيب الجديد بنجاح');
        } catch (error) {
          console.error('Error creating new doctor:', error);
          toast.error('فشل في إضافة الطبيب الجديد');
          return;
        }
      }

    }

    // 3. إنشاء العملية مع قائمة الأصناف
    try {
      await createSurgery.mutateAsync({
        doctorId: finalDoctorId || undefined,
        patientId: `PAT-${Date.now()}`, // Generate a temporary ID
        patientName: formData.patientName || (formData.type === 'surgery' ? 'غير محدد' : 'استهلاك داخلي'),
        date: new Date(formData.date),
        notes: formData.notes || undefined,
        type: formData.type, // Pass the type (surgery, sale, usage)
        createdBy: user.id,
        items: formData.items.map((item: any) => ({
          product_id: item.itemId,
          item_name: item.itemName,
          quantity: Number(item.quantity),
          base_price: Number(item.basePrice),
          selling_price: Number(item.sellingPrice),
          source_batch_id: item.batchId || undefined, // IMPORTANT: Ensure batch connection works
        })),
      } as any);

      setIsAddModalOpen(false);
      resetForm();

      toast.success('✅ تم تسجيل العملية بنجاح');
    } catch (error) {
      console.error('Error creating surgery:', error);
      toast.error('حدث خطأ أثناء حفظ العملية');
    }
  };

  const handleDelete = () => {
    if (deleteSale && deleteSale.id) {
      deleteSurgery.mutate(deleteSale.id);
      setDeleteSale(null);
    }
  };

  useEffect(() => {
    if (printSale) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [printSale]);

  const handlePrint = () => {
    if (!printRef.current) return;

    const printContent = printRef.current.innerHTML;

    // Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-1';

    document.body.appendChild(iframe);

    const frameDoc = iframe.contentWindow?.document;
    if (frameDoc) {
      // Copy styles from the main document
      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(style => style.outerHTML)
        .join('');

      frameDoc.open();
      frameDoc.write(`
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
            <head>
              <meta charset="UTF-8">
                <title>تقرير العملية</title>
                ${styles}
                <style>
                  body {margin: 0; padding: 0; background: white; }
                  @media print {
                    @page {margin: 0; size: auto; }
                  body {-webkit - print - color - adjust: exact; }
              }
                </style>
            </head>
            <body>
              ${printContent}
              <script>
              window.onload = () => {
                  setTimeout(() => {
                    window.focus();
                    window.print();
                  }, 500);
              };
              </script>
            </body>
          </html>
          `);
      frameDoc.close();

      // Clean up the iframe after a delay
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 60000); // Remove after 1 minute to ensure print dialog is done
    }

    // Reset the print state
    setTimeout(() => {
      setPrintSale(null);
    }, 500);
  };

  const isLoading = loadingSurgeries || loadingInventory || loadingDoctors;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="العمليات الجراحية والمبيعات"
        description="تسجيل استخدام المستلزمات والعمليات الجراحية"
        actions={
          canCreate && (
            <Button onClick={openAddModal} disabled={isLoading}>
              <Plus className="w-4 h-4 ml-2" />
              تسجيل عملية
            </Button>
          )
        }
      />

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="mr-3 text-muted-foreground">جارٍ تحميل البيانات...</span>
        </div>
      )}

      {/* Error State */}
      {errorSurgeries && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive mb-6">
          <AlertCircle className="w-5 h-5" />
          <span>حدث خطأ في تحميل العمليات. يرجى المحاولة لاحقاً.</span>
        </div>
      )}

      {/* Content */}
      {!isLoading && !errorSurgeries && (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="بحث بالصنف أو المريض..."
              className="flex-1 max-w-md"
            />
            <div className="flex gap-2">
              {(['all', 'surgery', 'usage', 'sale'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    typeFilter === type
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  )}
                >
                  {type === 'all' ? 'الكل' : type === 'surgery' ? 'جراحة' : type === 'usage' ? 'استهلاك' : 'بيع'}
                </button>
              ))}
            </div>
          </div>

          {/* Grouped Operations Table */}
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-right w-16"></th>
                    <th className="px-4 py-3 text-right">التاريخ</th>
                    <th className="px-4 py-3 text-right">المريض</th>
                    <th className="px-4 py-3 text-right">الطبيب</th>
                    <th className="px-4 py-3 text-center">النوع</th>
                    <th className="px-4 py-3 text-center">عدد الأصناف</th>
                    {canViewPrices && <th className="px-4 py-3 text-center">إجمالي الفاتورة</th>}
                    {canViewProfit && <th className="px-4 py-3 text-center">الربح</th>}
                    <th className="px-4 py-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedSurgeries.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                        لا توجد عمليات مسجلة
                      </td>
                    </tr>
                  ) : (
                    paginatedSurgeries.map((surgery) => (
                      <Fragment key={surgery.id}>
                        {/* Main Row */}
                        <tr className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleRowExpansion(surgery.id)}
                              className="p-1 rounded hover:bg-muted transition-colors"
                            >
                              {expandedRows.has(surgery.id) ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {format(surgery.date, 'dd MMM yyyy', { locale: ar })}
                          </td>
                          <td className="px-4 py-3 font-medium">{surgery.patientName}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{surgery.doctorName || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                                surgery.type === 'sale'
                                  ? 'bg-primary/10 text-primary'
                                  : surgery.type === 'surgery'
                                    ? 'bg-success/10 text-success'
                                    : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {surgery.type === 'sale' ? (
                                <>
                                  <ShoppingBag className="w-3 h-3" />
                                  بيع
                                </>
                              ) : surgery.type === 'surgery' ? (
                                <>
                                  <Activity className="w-3 h-3" />
                                  جراحة
                                </>
                              ) : (
                                <>
                                  <TrendingDown className="w-3 h-3" />
                                  استهلاك
                                </>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center num font-medium">
                            {surgery.items.length}
                          </td>
                          {canViewPrices && (
                            <td className="px-4 py-3 text-center num font-bold text-primary">
                              {new Intl.NumberFormat('en-EG').format(surgery.totalSellingValue)} ج.م
                            </td>
                          )}
                          {canViewProfit && (
                            <td className="px-4 py-3 text-center num font-medium text-success">
                              {new Intl.NumberFormat('en-EG').format(surgery.profit)} ج.م
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              {surgery.type === 'surgery' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPrintSale(surgery);
                                  }}
                                  className="p-2 rounded-lg hover:bg-primary/10 transition-colors text-muted-foreground hover:text-primary"
                                  title="طباعة التقرير"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                              )}
                              {surgery.isLocked && !canEdit ? (
                                <Lock className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <>
                                  {canDelete && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteSale(surgery);
                                      }}
                                      className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Details Row */}
                        {expandedRows.has(surgery.id) && (
                          <tr>
                            <td colSpan={9} className="bg-muted/20 px-4 py-4">
                              <div className="space-y-3">
                                <h4 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                                  <ShoppingBag className="w-4 h-4" />
                                  تفاصيل الأصناف:
                                </h4>
                                <div className="bg-card rounded-lg border border-border overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead className="bg-muted/50">
                                      <tr>
                                        <th className="px-4 py-2 text-right">الصنف</th>
                                        <th className="px-4 py-2 text-center">الكمية المسحوبة</th>
                                        <th className="px-4 py-2 text-center">مرتجع</th>
                                        <th className="px-4 py-2 text-center">الصافي</th>
                                        {canViewPrices && (
                                          <>
                                            <th className="px-4 py-2 text-center">سعر الوحدة</th>
                                            <th className="px-4 py-2 text-center">الإجمالي</th>
                                          </>
                                        )}
                                        {canViewProfit && <th className="px-4 py-2 text-center">الربح</th>}
                                        {canEdit && <th className="px-4 py-2 text-center">إجراءات</th>}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                      {surgery.items.map((item: any, idx: number) => {
                                        const netQty = item.quantity - (item.returnedQuantity || 0);
                                        return (
                                          <tr key={idx} className="hover:bg-muted/20">
                                            <td className="px-4 py-2 font-medium">{item.itemName}</td>
                                            <td className="px-4 py-2 text-center num">{item.quantity}</td>
                                            <td className="px-4 py-2 text-center num text-destructive">{item.returnedQuantity || 0}</td>
                                            <td className="px-4 py-2 text-center num font-bold">{netQty}</td>
                                            {canViewPrices && (
                                              <>
                                                <td className="px-4 py-2 text-center num text-muted-foreground">
                                                  {new Intl.NumberFormat('en-EG').format(item.sellingPrice)} ج
                                                </td>
                                                <td className="px-4 py-2 text-center num font-medium text-primary">
                                                  {new Intl.NumberFormat('en-EG').format(item.sellingPrice * netQty)} ج
                                                </td>
                                              </>
                                            )}
                                            {canViewProfit && (
                                              <td className="px-4 py-2 text-center num text-success">
                                                {new Intl.NumberFormat('en-EG').format((item.sellingPrice - item.basePrice) * netQty)} ج
                                              </td>
                                            )}
                                            {canEdit && (
                                              <td className="px-4 py-2 text-center flex justify-center">
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => setReturnItemModal({ surgeryId: surgery.id, item })}
                                                  disabled={netQty <= 0}
                                                  className="text-xs h-7 hover:bg-destructive/10 text-destructive hover:text-destructive"
                                                >
                                                  إرجاع
                                                </Button>
                                              </td>
                                            )}
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                                {surgery.notes && (
                                  <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                                    <p className="text-sm text-muted-foreground">
                                      <span className="font-semibold">ملاحظات:</span> {surgery.notes}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-border bg-muted/10">
                <span className="text-sm text-muted-foreground">
                  إجمالي العمليات: {totalItems} • صفحة {currentPage} من {totalPages}
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
          </div>
        </>
      )}

      {/* Add Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          resetForm();
        }}
        title="تسجيل عملية جديدة"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => {
              setIsAddModalOpen(false);
              resetForm();
            }}>
              إلغاء
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                formData.items.length === 0 ||
                (formData.type === 'surgery' && !formData.doctorId)
              }
            >
              حفظ
            </Button>
          </>
        }
      >
        <SalesForm
          formData={formData}
          setFormData={setFormData}
          marginError={marginError}
          canViewPrices={canViewPrices}
          canViewProfit={canViewProfit}
          doctors={doctors}
          inventory={inventory}
        />
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteSale}
        onClose={() => setDeleteSale(null)}
        onConfirm={handleDelete}
        title="حذف العملية"
        message="هل أنت متأكد من حذف هذه العملية؟ لا يمكن التراجع عن هذا الإجراء."
        confirmText="حذف"
        variant="danger"
      />

      {/* Return Item Modal */}
      <Modal
        isOpen={!!returnItemModal}
        onClose={() => {
          setReturnItemModal(null);
          setReturnQty('');
        }}
        title="إرجاع صنف"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => {
              setReturnItemModal(null);
              setReturnQty('');
            }}>
              إلغاء
            </Button>
            <Button
              variant="default"
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => {
                if (!returnItemModal) return;
                const qtyNum = parseInt(returnQty);
                if (isNaN(qtyNum) || qtyNum <= 0) {
                  toast.error('يرجى إدخال كمية صحيحة');
                  return;
                }
                const netQty = returnItemModal.item.quantity - (returnItemModal.item.returnedQuantity || 0);
                if (qtyNum > netQty) {
                  toast.error(`لا يمكن إرجاع كمية أكبر من الصافي المسحوب (${netQty})`);
                  return;
                }
                returnSurgeryItem.mutate({ id: returnItemModal.item.id, qty: qtyNum });
              }}
              disabled={returnSurgeryItem.isPending || !returnQty}
            >
              {returnSurgeryItem.isPending ? 'جاري التنفيذ...' : 'تأكيد الإرجاع'}
            </Button>
          </>
        }
      >
        {returnItemModal && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              حدد الكمية المراد إرجاعها إلى المستودع للصنف:
              <br />
              <span className="font-bold text-foreground">{returnItemModal.item.itemName}</span>
            </p>
            <div className="space-y-2">
              <label className="block text-sm font-medium">الكمية المرتجعة</label>
              <input
                type="number"
                min="1"
                max={returnItemModal.item.quantity - (returnItemModal.item.returnedQuantity || 0)}
                value={returnQty}
                onChange={(e) => setReturnQty(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-input focus:ring-2 focus:ring-destructive"
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground">
                الكمية المُتاحة للإرجاع: <strong>{returnItemModal.item.quantity - (returnItemModal.item.returnedQuantity || 0)}</strong>
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Print Report */}
      {printSale && (
        <div style={{ display: 'none' }}>
          <div ref={printRef}>
            <SurgeryPrintReport sale={printSale} />
          </div>
        </div>
      )}
    </div>
  );
}
