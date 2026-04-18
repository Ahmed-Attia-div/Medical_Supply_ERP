import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useProducts } from '@/hooks/useSupabaseData';
import { invoicesService } from '@/services/invoicesService';
import { suppliersService } from '@/services/suppliersAndDoctorsService';
import { productsService } from '@/services/productsService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { SearchableCombobox } from '@/components/ui/SearchableCombobox';
import { DatePicker } from '@/components/ui/DatePicker';
import { Plus, Trash2, Save, ArrowRight, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// Helper to format currency
const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-EG', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(value);
};

interface InvoiceItemRow {
    localId: string; // Temporary ID for UI key
    productId: string;
    productName: string;
    quantity: number;
    unitCost: number;
    batchNo: string;
    expiryDate: string; // Changed to string for native input
}

export default function CreateInvoice() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { data: suppliers = [] } = useQuery<{ id: string; name: string }[]>({
        queryKey: ['suppliers'],
        queryFn: () => suppliersService.getAll(),
        staleTime: 300_000,
    });
    const { data: pagedInventory } = useProducts({}, { page: 1, pageSize: 500 });
    const inventory = pagedInventory?.data ?? [];
    const createInvoice = useMutation({
        mutationFn: (data: any) => invoicesService.create(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
    });
    const createSupplier = useMutation({
        mutationFn: (data: { name: string }) => suppliersService.create(data as any),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
    });

    // Header State
    const [supplierId, setSupplierId] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('');
    const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('cash');
    const [amountPaid, setAmountPaid] = useState<number | ''>('');
    const [notes, setNotes] = useState('');

    // Items State
    const [items, setItems] = useState<InvoiceItemRow[]>([]);

    // Quick Create Product State
    const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
    const [quickCreateName, setQuickCreateName] = useState('');
    const [pendingItemLocalId, setPendingItemLocalId] = useState<string | null>(null);
    const [newProductFormData, setNewProductFormData] = useState<any>({
        name: '',
        sku: '',
        category: '',
        material: '',
        diameter: '',
        length: '',
        quantity: 0,
        minStock: 0,
        basePrice: 0,
        sellingPrice: 0,
    });

    // Calculate Totals
    const totalAmount = useMemo(() => {
        return items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
    }, [items]);

    // Options for Comboboxes
    const supplierOptions = useMemo(() =>
        suppliers.map(s => ({ value: s.id, label: s.name })),
        [suppliers]);

    const productOptions = useMemo(() =>
        inventory.map(p => ({ value: p.id, label: p.name })),
        [inventory]);

    // Handlers
    const handleAddItem = () => {
        setItems(prev => [
            ...prev,
            {
                localId: crypto.randomUUID(),
                productId: '',
                productName: '',
                quantity: 1,
                unitCost: 0,
                batchNo: '',
                expiryDate: ''
            }
        ]);
    };

    const handleRemoveItem = (localId: string) => {
        setItems(prev => prev.filter(i => i.localId !== localId));
    };

    const updateItem = (localId: string, field: keyof InvoiceItemRow, value: any) => {
        setItems(prev => prev.map(item => {
            if (item.localId === localId) {
                // If updating product ID, also update basic cost from inventory if available
                if (field === 'productId') {
                    const product = inventory.find(p => p.id === value);
                    return {
                        ...item,
                        [field]: value,
                        productName: product?.name || '',
                        unitCost: product?.basePriceWac ?? 0
                    };
                }
                return { ...item, [field]: value };
            }
            return item;
        }));
    };

    const handleSave = async () => {
        // Validations
        if (!supplierId) return toast.error('يرجى اختيار المورد');
        if (!invoiceDate) return toast.error('يرجى تحديد تاريخ الفاتورة');
        if (items.length === 0) return toast.error('يرجى إضافة أصناف للفاتورة');

        // Check for incomplete rows
        const incomplete = items.find(i => !i.productId || i.quantity <= 0);
        if (incomplete) return toast.error('يرجى استكمال بيانات جميع الأصناف (الصنف والكمية)');

        // Validate expiry dates
        for (const item of items) {
            if (item.expiryDate && item.expiryDate <= invoiceDate) {
                return toast.error(`تاريخ الصلاحية للصنف "${item.productName}" يجب أن يكون بعد تاريخ الفاتورة`);
            }
        }

        if (!user?.id) {
            return toast.error('خطأ: لم يتم التعرف على المستخدم الحالي. يرجى تسجيل الدخول مرة أخرى.');
        }

        let finalSupplierId = supplierId;

        // Verify if supplierId is an existing ID or a new name
        const isExistingId = suppliers.some(s => s.id === supplierId);

        if (!isExistingId) {
            // Check if name exists (case insensitive)
            const existingByName = suppliers.find(s => s.name.trim().toLowerCase() === supplierId.trim().toLowerCase());

            if (existingByName) {
                finalSupplierId = existingByName.id;
            } else {
                // Create new supplier
                try {
                    const newSupplier = await createSupplier.mutateAsync({
                        name: supplierId,
                    });
                    finalSupplierId = newSupplier.id;
                } catch (error) {
                    // Error is handled by the hook (toast)
                    return;
                }
            }
        }

        const payload = {
            supplierId: finalSupplierId,
            invoiceDate: invoiceDate || new Date(),
            vendorInvoiceNumber,
            paymentType,
            amountPaid: paymentType === 'credit' ? (Number(amountPaid) || 0) : undefined,
            notes,
            totalAmount,
            items: items.map(i => ({
                product_id: i.productId,
                quantity: i.quantity,
                unit_cost: i.unitCost,
                batch_no: i.batchNo,
                expiry_date: i.expiryDate || null
            })),
            createdBy: user.id
        };

        createInvoice.mutate(payload, {
            onSuccess: () => {
                toast.success('تم حفظ الفاتورة بنجاح');
                navigate('/purchases'); // Redirect to invoices list
            }
        });
    };

    // Quick Product Create Handlers
    const handleQuickCreateProduct = async () => {
        // Validate
        if (!newProductFormData.name || !newProductFormData.sku || !newProductFormData.category) {
            return toast.error('يرجى ملء الحقول الأساسية (الاسم، الرمز، الفئة)');
        }

        // Basic validation for margin
        if (newProductFormData.basePrice > newProductFormData.sellingPrice) {
            return toast.error('سعر البيع يجب أن يكون أكبر من السعر الأساسي');
        }

        try {
            const productData = {
                ...newProductFormData,
                quantity: Number(newProductFormData.quantity) || 0,
                minStock: Number(newProductFormData.minStock) || 0,
                basePrice: Number(newProductFormData.basePrice) || 0,
                sellingPrice: Number(newProductFormData.sellingPrice) || 0,
                unit: 'pcs',
                lastMovementDate: new Date(),
                createdBy: user?.id || 'system',
            };

            const newProduct = await productsService.create(productData);

            // If we have a pending item row, update it
            if (pendingItemLocalId) {
                setItems(prev => prev.map(item => {
                    if (item.localId === pendingItemLocalId) {
                        return {
                            ...item,
                            productId: newProduct.id,
                            productName: newProduct.name,
                            unitCost: newProduct.basePriceWac || productData.basePrice,
                        };
                    }
                    return item;
                }));
            }

            setIsQuickCreateOpen(false);
            setPendingItemLocalId(null);
            setQuickCreateName('');
            toast.success('تم إضافة الصنف بنجاح');

            // Reset form
            setNewProductFormData({
                name: '',
                sku: '',
                category: '',
                material: '',
                diameter: '',
                length: '',
                quantity: 0,
                minStock: 0,
                basePrice: 0,
                sellingPrice: 0,
            });

        } catch (error: any) {
            toast.error(`فشل في إضافة الصنف: ${error.message}`);
        }
    };

    const handleProductSelect = (localId: string, value: string) => {
        // Check if existing product
        const existing = inventory.find(p => p.id === value);
        if (existing) {
            updateItem(localId, 'productId', value);
        } else {
            // New product - open modal
            setQuickCreateName(value);
            setNewProductFormData(prev => ({ ...prev, name: value }));
            setPendingItemLocalId(localId);
            setIsQuickCreateOpen(true);
        }
    };


    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/purchases')}>
                    <ArrowRight className="w-6 h-6" />
                </Button>
                <PageHeader
                    title="تسجيل فاتورة شراء جديدة"
                    description="إدخال فاتورة مورد مفصلة"
                />
            </div>

            {/* Invoice Header Card */}
            <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-primary" />
                    بيانات الفاتورة
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">المورد <span className="text-destructive">*</span></label>
                        <SearchableCombobox
                            options={supplierOptions}
                            value={supplierId}
                            onChange={setSupplierId}
                            placeholder="اختر المورد..."
                            allowCustom={true}
                            customPlaceholder="أضف مورد جديد..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">تاريخ الفاتورة <span className="text-destructive">*</span></label>
                        <input
                            type="date"
                            value={invoiceDate}
                            onChange={(e) => setInvoiceDate(e.target.value)}
                            className="w-full h-10 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">حالة الدفع</label>
                        <select
                            value={paymentType}
                            onChange={(e) => {
                                setPaymentType(e.target.value as 'cash' | 'credit');
                                if (e.target.value === 'cash') setAmountPaid('');
                            }}
                            className="w-full h-10 px-3 rounded-md border border-input bg-background"
                        >
                            <option value="cash">نقدي (Cash)</option>
                            <option value="credit">آجل (Credit)</option>
                        </select>
                    </div>
                    {paymentType === 'credit' && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">المبلغ المدفوع</label>
                            <input
                                type="number"
                                min="0"
                                max={totalAmount}
                                value={amountPaid}
                                onChange={(e) => setAmountPaid(e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                                placeholder="0"
                            />
                            {amountPaid !== '' && totalAmount - Number(amountPaid) >= 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    المتبقي (آجل): <span className="font-bold text-destructive">{formatCurrency(totalAmount - Number(amountPaid))}</span> ج.م
                                </p>
                            )}
                        </div>
                    )}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">رقم فاتورة المورد (مرجع)</label>
                        <input
                            type="text"
                            value={vendorInvoiceNumber}
                            onChange={(e) => setVendorInvoiceNumber(e.target.value)}
                            className="w-full h-10 px-3 rounded-md border border-input bg-background"
                            placeholder="مثال: INV-10025"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">ملاحظات</label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full h-10 px-3 rounded-md border border-input bg-background"
                            placeholder="ملاحظات إضافية..."
                        />
                    </div>
                </div>
            </div>

            {/* Items Grid */}
            <div className="bg-card rounded-xl border border-border p-6 shadow-sm overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">أصناف الفاتورة</h3>
                    <Button onClick={handleAddItem} variant="secondary" size="sm">
                        <Plus className="w-4 h-4 ml-2" />
                        إضافة صنف
                    </Button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/50">
                                <th className="p-3 text-right min-w-[200px]">الصنف</th>
                                <th className="p-3 text-right min-w-[120px]">رقم التشغيلة (Batch)</th>
                                <th className="p-3 text-right">تاريخ الصلاحية</th>
                                <th className="p-3 text-right w-[100px]">الكمية</th>
                                <th className="p-3 text-right w-[120px]">سعر الوحدة</th>
                                <th className="p-3 text-right w-[120px]">الإجمالي</th>
                                <th className="p-3 w-[50px]"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                                        لا توجد أصناف مضافة. اضغط على "إضافة صنف" للبدء.
                                    </td>
                                </tr>
                            ) : (
                                items.map((item, index) => (
                                    <tr key={item.localId} className="group hover:bg-accent/5 transition-colors">
                                        <td className="p-2">
                                            <SearchableCombobox
                                                options={productOptions}
                                                value={item.productId}
                                                onChange={(val) => handleProductSelect(item.localId, val)}
                                                placeholder="اختر الصنف..."
                                                allowCustom={true}
                                                customPlaceholder="أضف صنف جديد..."
                                                className="w-full"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="text"
                                                value={item.batchNo}
                                                onChange={(e) => updateItem(item.localId, 'batchNo', e.target.value)}
                                                className="w-full h-9 px-2 rounded border border-input bg-transparent"
                                                placeholder="Batch #"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="date"
                                                value={item.expiryDate}
                                                min={invoiceDate}
                                                onChange={(e) => updateItem(item.localId, 'expiryDate', e.target.value)}
                                                className={cn(
                                                    "w-full h-9 px-2 rounded border bg-transparent focus:outline-none focus:ring-2 focus:ring-ring",
                                                    item.expiryDate && item.expiryDate <= invoiceDate ? "border-destructive text-destructive" : "border-input"
                                                )}
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(item.localId, 'quantity', Number(e.target.value))}
                                                className="w-full h-9 px-2 rounded border border-input bg-transparent text-center font-medium"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={item.unitCost}
                                                onChange={(e) => updateItem(item.localId, 'unitCost', Number(e.target.value))}
                                                className="w-full h-9 px-2 rounded border border-input bg-transparent text-center"
                                            />
                                        </td>
                                        <td className="p-2 text-primary font-bold">
                                            {formatCurrency(item.quantity * item.unitCost)}
                                        </td>
                                        <td className="p-2 text-center">
                                            <button
                                                onClick={() => handleRemoveItem(item.localId)}
                                                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                                title="حذف الصف"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Summary */}
                <div className="mt-6 flex justify-end border-t border-border pt-4">
                    <div className="w-full md:w-1/3 space-y-4">
                        <div className="flex justify-between items-center text-lg font-bold">
                            <span>إجمالي الفاتورة:</span>
                            <span className="text-primary text-2xl">{formatCurrency(totalAmount)} ج.م</span>
                        </div>
                        <Button
                            onClick={handleSave}
                            className="w-full h-12 text-lg font-bold shadow-lg"
                            disabled={createInvoice.isPending}
                        >
                            {createInvoice.isPending || createSupplier.isPending ? 'جاري الحفظ...' : 'حفظ الفاتورة'}
                            <Save className="w-5 h-5 mr-2" />
                        </Button>
                    </div>
                </div>
            </div>
            {/* Quick Create Product Modal */}
            <QuickProductModal
                isOpen={isQuickCreateOpen}
                onClose={() => setIsQuickCreateOpen(false)}
                formData={newProductFormData}
                setFormData={setNewProductFormData}
                onSave={handleQuickCreateProduct}
                inventory={inventory}
                userRole={user?.role}
            />
        </div>
    );
}

// Separate component for Quick Product Modal to avoid circular dependencies/clutter
import { Modal } from '@/components/ui/Modal';
import { CATEGORY_LABELS, MATERIAL_LABELS, ItemCategory, MaterialType, validateMargin } from '@/types/inventory';
import { AlertTriangle } from 'lucide-react';

interface QuickProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    formData: any;
    setFormData: (data: any) => void;
    onSave: () => void;
    inventory: any[];
    userRole?: string;
}

function QuickProductModal({ isOpen, onClose, formData, setFormData, onSave, inventory, userRole }: QuickProductModalProps) {
    const [isSkuManualOverride, setIsSkuManualOverride] = useState(false);

    // Reset manual override when modal closes or form clears
    useEffect(() => {
        if (!isOpen || !formData.sku) {
            setIsSkuManualOverride(false);
        }
    }, [isOpen, formData.sku]);

    // Auto-generate SKU
    useEffect(() => {
        if (!isOpen || isSkuManualOverride) return;

        let catCode = '';
        switch (formData.category) {
            case 'screws': catCode = 'SCR'; break;
            case 'plates': catCode = 'PLT'; break;
            case 'rods': catCode = 'ROD'; break;
            case 'wires': catCode = 'WIR'; break;
            case 'nails': catCode = 'NAI'; break;
            case 'instruments': catCode = 'INS'; break;
            case 'consumables': catCode = 'CON'; break;
        }

        let matCode = '';
        switch (formData.material) {
            case 'titanium': matCode = 'TIT'; break;
            case 'stainless': matCode = 'SS'; break;
        }

        const dia = (formData.diameter || '').replace(/mm/gi, '').trim();
        const len = (formData.length || '').replace(/mm/gi, '').replace(/-?holes?/gi, 'H').trim();

        const parts = [catCode, matCode, dia, len].filter(Boolean);
        const generatedSku = parts.length > 0 ? parts.join('-').toUpperCase() : '';

        if (generatedSku && formData.sku !== generatedSku) {
            setFormData((prev: any) => ({ ...prev, sku: generatedSku }));
        } else if (!generatedSku && formData.sku && !isSkuManualOverride) {
            setFormData((prev: any) => ({ ...prev, sku: '' }));
        }
    }, [formData.category, formData.material, formData.diameter, formData.length, isSkuManualOverride, isOpen]);

    const marginValidation = validateMargin(formData.basePrice, formData.sellingPrice);
    const marginError = !marginValidation.isValid ? marginValidation.message : null;

    const categoryOptions = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value: value as string, label: label as string }));
    const materialOptions = Object.entries(MATERIAL_LABELS).map(([value, label]) => ({ value: value as string, label: label as string }));

    // Derived options from existing inventory for auto-complete
    const skuOptions = useMemo(() => {
        const uniqueSkus = Array.from(new Set(inventory.map((item: any) => item.sku).filter(Boolean)));
        return uniqueSkus.map(sku => ({ value: String(sku), label: String(sku) }));
    }, [inventory]);

    const canEditBasePrice = userRole === 'admin' || userRole === 'storekeeper';
    const canEditSellingPrice = userRole === 'admin';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="إضافة صنف جديد سريع"
            size="lg"
            footer={
                <>
                    <Button variant="outline" onClick={onClose}>إلغاء</Button>
                    <Button onClick={onSave} disabled={!formData.name || !formData.sku || !formData.category}>
                        حفظ الصنف
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium">اسم الصنف <span className="text-destructive">*</span></label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full h-10 px-3 rounded-lg border border-input"
                            placeholder="مثال: برغي قشري"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium">رمز الصنف (SKU) <span className="text-destructive">*</span></label>
                        <SearchableCombobox
                            options={skuOptions}
                            value={formData.sku}
                            onChange={(value) => {
                                setIsSkuManualOverride(true);
                                setFormData({ ...formData, sku: value });
                            }}
                            placeholder="اختر أو ادخل رمز"
                            allowCustom={true}
                            dir="ltr"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium">الفئة <span className="text-destructive">*</span></label>
                        <SearchableCombobox
                            options={categoryOptions}
                            value={formData.category}
                            onChange={(value) => setFormData({ ...formData, category: value })}
                            placeholder="اختر الفئة"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium">المادة</label>
                        <SearchableCombobox
                            options={materialOptions}
                            value={formData.material}
                            onChange={(value) => setFormData({ ...formData, material: value })}
                            placeholder="اختر المادة"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium">القطر</label>
                        <input
                            type="text"
                            value={formData.diameter}
                            onChange={(e) => setFormData({ ...formData, diameter: e.target.value })}
                            className="w-full h-10 px-3 rounded-lg border border-input"
                            placeholder="4.5mm"
                            dir="ltr"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium">الطول</label>
                        <input
                            type="text"
                            value={formData.length}
                            onChange={(e) => setFormData({ ...formData, length: e.target.value })}
                            className="w-full h-10 px-3 rounded-lg border border-input"
                            placeholder="20mm"
                            dir="ltr"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium">السعر الأساسي</label>
                        <input
                            type="number"
                            value={formData.basePrice === 0 ? '' : formData.basePrice}
                            onChange={(e) => setFormData({ ...formData, basePrice: e.target.value === '' ? 0 : Number(e.target.value) })}
                            className="w-full h-10 px-3 rounded-lg border border-input num"
                            min="0"
                            step="0.01"
                            dir="ltr"
                            placeholder="0"
                            disabled={!canEditBasePrice}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium">سعر البيع</label>
                        <input
                            type="number"
                            value={formData.sellingPrice === 0 ? '' : formData.sellingPrice}
                            onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value === '' ? 0 : Number(e.target.value) })}
                            className={`w-full h-10 px-3 rounded-lg border num ${marginError ? 'border-destructive' : 'border-input'}`}
                            min="0"
                            step="0.01"
                            dir="ltr"
                            placeholder="0"
                            disabled={!canEditSellingPrice}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium">الحد الأدنى (<span className="text-muted-foreground text-xs">تنبيه</span>)</label>
                        <input
                            type="number"
                            value={formData.minStock === 0 ? '' : formData.minStock}
                            onChange={(e) => setFormData({ ...formData, minStock: e.target.value === '' ? 0 : Number(e.target.value) })}
                            className="w-full h-10 px-3 rounded-lg border border-input num"
                            min="0"
                            dir="ltr"
                            placeholder="0"
                        />
                    </div>
                </div>
                {marginError && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        {marginError}
                    </div>
                )}
            </div>
        </Modal>
    );
}
