import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts, useSystemSettings } from '@/hooks/useSupabaseData';
import { productsService } from '@/services/productsService';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileActionSheet, ProductCardMobile } from '@/components/ui/MobileActionSheet';
import {
    Product,
    getStockStatus,
    validateMargin,
    CATEGORY_LABELS,
    MATERIAL_LABELS,
    ItemCategory,
    MaterialType,
} from '@/types/inventory';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { SearchInput } from '@/components/ui/SearchInput';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { SearchableCombobox } from '@/components/ui/SearchableCombobox';
import { Plus, Edit2, Trash2, Filter, Scissors, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Helper: item last moved X months (threshold) ago
function isDeadStockUI(lastMovementAt: Date | string | undefined, thresholdMonths: number): boolean {
    if (!lastMovementAt) return false;
    const d = lastMovementAt instanceof Date ? lastMovementAt : new Date(lastMovementAt);
    // Rough calculation: months * 30 days
    return Math.floor((Date.now() - d.getTime()) / 86_400_000) >= (thresholdMonths * 30);
}

const categoryOptions = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
    value,
    label,
}));

const materialOptions = Object.entries(MATERIAL_LABELS).map(([value, label]) => ({
    value,
    label,
}));

interface InventoryFormProps {
    formData: any;
    setFormData: (data: any) => void;
    canViewPrices: boolean;
    canEditBasePrice: boolean;
    canEditSellingPrice: boolean;
    marginError: string | null;
    handleSellingPriceChange: (value: number) => void;
    skuOptions: { value: string; label: string }[];
}

const InventoryForm = ({
    formData,
    setFormData,
    isEdit,
    canViewPrices,
    canEditBasePrice,
    canEditSellingPrice,
    marginError,
    handleSellingPriceChange,
    skuOptions,
}: InventoryFormProps & { isEdit?: boolean }) => {
    const [isSkuManualOverride, setIsSkuManualOverride] = useState(false);

    // Reset manual override when form is cleared
    useEffect(() => {
        if (!formData.sku) {
            setIsSkuManualOverride(false);
        }
    }, [formData.sku]);

    // Auto-generate SKU
    useEffect(() => {
        if (isEdit || isSkuManualOverride) return;

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
            setFormData({ ...formData, sku: generatedSku });
        } else if (!generatedSku && formData.sku && !isSkuManualOverride) {
            setFormData({ ...formData, sku: '' });
        }
    }, [formData.category, formData.material, formData.diameter, formData.length, isSkuManualOverride, isEdit]);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                        اسم الصنف <span className="text-destructive">*</span>
                    </label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="مثال: برغي قشري"
                    />
                </div>
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                        رمز الصنف (SKU) <span className="text-destructive">*</span>
                    </label>
                    <SearchableCombobox
                        options={skuOptions}
                        value={formData.sku}
                        onChange={(value) => {
                            setIsSkuManualOverride(true);
                            setFormData({ ...formData, sku: value });
                        }}
                        placeholder="اختر أو ادخل رمز الصنف"
                        allowCustom={true}
                        customPlaceholder="أدخل رمز جديد"
                        dir="ltr"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                        الفئة <span className="text-destructive">*</span>
                    </label>
                    <SearchableCombobox
                        options={categoryOptions}
                        value={formData.category}
                        onChange={(value) => setFormData({ ...formData, category: value })}
                        placeholder="اختر الفئة"
                        allowCustom={true}
                        customPlaceholder="أدخل فئة جديدة"
                    />
                </div>
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">المادة</label>
                    <SearchableCombobox
                        options={materialOptions}
                        value={formData.material}
                        onChange={(value) => setFormData({ ...formData, material: value })}
                        placeholder="اختر المادة"
                        allowCustom={true}
                        customPlaceholder="أدخل مادة جديدة"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">القطر</label>
                    <input
                        type="text"
                        value={formData.diameter}
                        onChange={(e) => setFormData({ ...formData, diameter: e.target.value })}
                        className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="4.5mm"
                        dir="ltr"
                    />
                </div>
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">الطول</label>
                    <input
                        type="text"
                        value={formData.length}
                        onChange={(e) => setFormData({ ...formData, length: e.target.value })}
                        className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="20mm أو 8-hole"
                        dir="ltr"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                        الكمية <span className="text-destructive">*</span>
                    </label>
                    <input
                        type="number"
                        value={formData.quantity === '' ? '' : formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value === '' ? '' : Number(e.target.value) })}
                        className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring num disabled:opacity-50 disabled:cursor-not-allowed"
                        dir="ltr"
                        min="0"
                        placeholder="0"
                        disabled={isEdit}
                    />
                    {isEdit && <p className="text-xs text-muted-foreground mt-1">لتعديل الكمية يرجى عمل حركة مخزنية</p>}
                </div>
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">رقم التشغيلية (Batch)</label>
                    <input
                        type="text"
                        value={formData.batchNo || ''}
                        onChange={(e) => setFormData({ ...formData, batchNo: e.target.value })}
                        className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        dir="ltr"
                        placeholder={isEdit ? "للأصناف الجديدة فقط" : "مثال: BATCH-100"}
                        disabled={isEdit}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">الحد الأدنى</label>
                    <input
                        type="number"
                        value={formData.minStock === '' ? '' : formData.minStock}
                        onChange={(e) => setFormData({ ...formData, minStock: e.target.value === '' ? '' : Number(e.target.value) })}
                        className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring num"
                        dir="ltr"
                        min="0"
                        placeholder="0"
                    />
                </div>
            </div>

            {canViewPrices && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-foreground">
                                السعر الأساسي (ج.م) {canEditBasePrice && <span className="text-destructive">*</span>}
                            </label>
                            <input
                                type="number"
                                value={formData.basePrice === 0 ? '' : formData.basePrice}
                                onChange={(e) => setFormData({ ...formData, basePrice: e.target.value === '' ? 0 : Number(e.target.value) })}
                                className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring num disabled:opacity-50 disabled:cursor-not-allowed"
                                dir="ltr"
                                min="0"
                                step="0.01"
                                placeholder="0"
                                disabled={!canEditBasePrice || !!isEdit}
                            />
                            {(!canEditBasePrice || isEdit) && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    {isEdit ? 'لتعديل التكلفة يرجى إضافة فاتورة مشتريات' : 'ليس لديك صلاحية تعديل السعر الأساسي'}
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-foreground">
                                سعر البيع (ج.م) {canEditSellingPrice && <span className="text-destructive">*</span>}
                            </label>
                            <input
                                type="number"
                                value={formData.sellingPrice === 0 ? '' : formData.sellingPrice}
                                onChange={(e) => handleSellingPriceChange(e.target.value === '' ? 0 : Number(e.target.value))}
                                className={`w-full h-10 px-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring num disabled:opacity-50 disabled:cursor-not-allowed ${marginError ? 'border-destructive' : 'border-input'
                                    }`}
                                dir="ltr"
                                min="0"
                                step="0.01"
                                placeholder="0"
                                disabled={!canEditSellingPrice}
                            />
                        </div>
                    </div>

                    {marginError && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm font-medium">{marginError}</span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
export default function Inventory() {
    const isMobile = useIsMobile();
    const queryClient = useQueryClient();
    const { hasPermission, user } = useAuth();
    const canCreate = hasPermission('canCreateInventory');
    const canEdit = hasPermission('canEditInventory');
    const canDelete = hasPermission('canDeleteInventory');
    const canViewPrices = hasPermission('canViewPrices');
    const canEditBasePrice = hasPermission('canEditBasePrice');
    const canEditSellingPrice = hasPermission('canEditSellingPrice');

    // ── Settings ───────────────────────────────────────────────────────────────────
    const { data: settings } = useSystemSettings();
    const deadStockThreshold = settings?.deadStockThresholdMonths ?? 6;

    // ── Server-side pagination + search ────────────────────────────────────────────
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('');
    const [materialFilter, setMaterialFilter] = useState<string>('');
    const [diameterFilter, setDiameterFilter] = useState<string>('');
    const [page, setPage] = useState(1);
    const PAGE_SIZE = isMobile ? 20 : 50;

    const { data: pagedResult, isLoading } = useProducts(
        {
            search: search || undefined,
            category: categoryFilter as ItemCategory || undefined,
        },
        { page, pageSize: PAGE_SIZE },
    );

    const inventory: Product[] = pagedResult?.data ?? [];
    const totalPages = pagedResult?.totalPages ?? 1;
    const totalItems = pagedResult?.total ?? 0;
    // ──────────────────────────────────────────────────────────────

    // ── Mutations ──────────────────────────────────────────────────────────────
    const createProduct = useMutation({
        mutationFn: (data: any) => productsService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('تمت إضافة الصنف بنجاح');
        },
        onError: (e: any) => toast.error(e.message),
    });

    const updateProduct = useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: any }) =>
            productsService.update(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('تم تحديث الصنف بنجاح');
        },
        onError: (e: any) => toast.error(e.message),
    });

    const deleteProduct = useMutation({
        mutationFn: (id: string) => productsService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('تم حذف الصنف');
        },
        onError: (e: any) => toast.error(e.message),
    });
    // ──────────────────────────────────────────────────────────────
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editItem, setEditItem] = useState<Product | null>(null);
    const [deleteItem, setDeleteItem] = useState<Product | null>(null);
    // Transformation State
    const [isTransformModalOpen, setIsTransformModalOpen] = useState(false);
    const [transformSource, setTransformSource] = useState<Product | null>(null);
    const [transformTargetId, setTransformTargetId] = useState('');
    const [transformSourceQuantity, setTransformSourceQuantity] = useState('');
    const [transformTargetQuantity, setTransformTargetQuantity] = useState('');
    const [transformSourceBatchId, setTransformSourceBatchId] = useState('');
    const [transformNotes, setTransformNotes] = useState('');

    const { data: sourceBatches = [] } = useQuery({
        queryKey: ['batches', transformSource?.id],
        queryFn: () => productsService.getBatches(transformSource!.id),
        enabled: !!transformSource
    });

    const transformProduct = useMutation({
        mutationFn: (args: { sourceProductId: string; targetProductId: string; sourceBatchId: string; sourceQuantity: number; targetQuantity: number; notes?: string }) =>
            productsService.transformItem(args),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('تم تنفيذ عملية التحويل بنجاح');
        },
        onError: (e: any) => toast.error(e.message),
    });
    const [marginError, setMarginError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        category: '' as ItemCategory | '',
        material: '' as MaterialType | '',
        diameter: '',
        length: '',
        unit: 'piece',
        batchNo: '',
        quantity: '' as string | number,
        minStock: '' as string | number,
        basePrice: 0,
        sellingPrice: 0,
        sterilizationStatus: 'non_sterilized' as string,
        notes: '' as string,
    });

    // Diameters and SKUs are still derived client-side from current page results
    // (server-side faceting would require extra RPC — fine for now)
    const skuOptions = useMemo(() => {
        const uniqueSkus = Array.from(new Set(inventory.map(i => i.sku).filter(Boolean)));
        return uniqueSkus.map(sku => ({ value: sku, label: sku }));
    }, [inventory]);

    // No client-side filtering needed — handled server-side by useProducts()
    const filteredInventory = inventory;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-EG', {
            style: 'decimal',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(value) + ' ج.م';
    };

    const formatNumber = (value: number) => {
        return new Intl.NumberFormat('en-EG').format(value);
    };

    const resetForm = () => {
        setFormData({
            name: '', sku: '', category: '', material: '',
            diameter: '', length: '', unit: 'piece',
            batchNo: '',
            quantity: '', minStock: '', basePrice: 0, sellingPrice: 0,
            sterilizationStatus: 'non_sterilized', notes: '',
        });
        setMarginError(null);
    };

    const openAddModal = () => {
        resetForm();
        setIsAddModalOpen(true);
    };

    const openEditModal = (item: Product) => {
        setFormData({
            name: item.name,
            sku: item.sku,
            category: item.category,
            material: item.material || '',
            diameter: item.diameter || '',
            length: item.length || '',
            unit: item.unit || 'piece',
            batchNo: '', // Disabled on edit
            quantity: item.totalQuantity,
            minStock: item.minStock,
            basePrice: item.basePriceWac,
            sellingPrice: item.sellingPrice,
            sterilizationStatus: item.sterilizationStatus || 'non_sterilized',
            notes: item.notes || '',
        });
        setEditItem(item);
        setMarginError(null);
    };

    const handleSellingPriceChange = (value: number) => {
        setFormData({ ...formData, sellingPrice: value });
        const validation = validateMargin(formData.basePrice, value);
        setMarginError(validation.isValid ? null : (validation.message || null));
    };

    const handleSave = useCallback(() => {
        const validation = validateMargin(formData.basePrice, formData.sellingPrice);
        if (!validation.isValid) {
            toast.error('تحذير: سعر البيع أقل من التكلفة!');
            return;
        }

        const productData = {
            name: formData.name,
            sku: formData.sku,
            category: formData.category as ItemCategory,
            material: (formData.material as MaterialType) || undefined,
            diameter: formData.diameter || undefined,
            length: formData.length || undefined,
            unit: formData.unit || 'piece',
            minStock: Number(formData.minStock) || 0,
            sellingPrice: Number(formData.sellingPrice),
            sterilizationStatus: formData.sterilizationStatus || 'non_sterilized',
            notes: formData.notes || undefined,
            quantity: Number(formData.quantity) || 0,
            batchNo: formData.batchNo || undefined,
            basePrice: Number(formData.basePrice) || 0,
            createdBy: user?.id,
        };

        if (editItem) {
            updateProduct.mutate(
                { id: editItem.id, updates: productData },
                { onSuccess: () => { setIsAddModalOpen(false); setEditItem(null); resetForm(); } },
            );
        } else {
            createProduct.mutate(productData as any, {
                onSuccess: () => { setIsAddModalOpen(false); resetForm(); },
            });
        }
    }, [formData, editItem, marginError]);

    const handleDelete = () => {
        if (deleteItem) {
            deleteProduct.mutate(deleteItem.id, {
                onSuccess: () => {
                    setDeleteItem(null);
                }
            });
        }
    };



    const openTransformModal = (item: Product) => {
        setTransformSource(item);
        setIsTransformModalOpen(true);
        setTransformTargetId('');
        setTransformSourceQuantity('');
        setTransformTargetQuantity('');
        setTransformSourceBatchId('');
        setTransformNotes('');
    };

    const handleTransform = () => {
        if (!transformSource || !transformTargetId || !transformSourceQuantity || !transformTargetQuantity || !transformSourceBatchId) {
            toast.error('الرجاء تعبئة جميع الحقول المطلوبة (بما في ذلك تحديد دفعة المصدر)');
            return;
        }
        const sQty = Number(transformSourceQuantity);
        const tQty = Number(transformTargetQuantity);

        if (isNaN(sQty) || sQty <= 0 || isNaN(tQty) || tQty <= 0) {
            toast.error('الكميات يجب أن تكون أرقام صحيحة موجبة');
            return;
        }

        const selectedBatch = sourceBatches.find((b: any) => b.id === transformSourceBatchId);
        if (!selectedBatch) {
            toast.error('دفعة المصدر غير صالحة');
            return;
        }

        if (sQty > selectedBatch.quantity) {
            toast.error(`خطأ: الكمية المتاحة في الدفعة المحددة هي ${selectedBatch.quantity} فقط`);
            return;
        }

        if (transformSource.id === transformTargetId) {
            toast.error('لا يمكن التحويل لنفس الصنف');
            return;
        }

        transformProduct.mutate(
            {
                sourceProductId: transformSource.id,
                targetProductId: transformTargetId,
                sourceBatchId: transformSourceBatchId,
                sourceQuantity: sQty,
                targetQuantity: tQty,
                notes: transformNotes || undefined,
            },
            {
                onSuccess: () => {
                    setIsTransformModalOpen(false);
                    setTransformSource(null);
                    setTransformTargetId('');
                    setTransformSourceQuantity('');
                    setTransformTargetQuantity('');
                    setTransformSourceBatchId('');
                    setTransformNotes('');
                },
            },
        );
    };

    const columns = useMemo(() => [
        {
            key: 'name',
            header: 'الصنف',
            render: (item: Product) => (
                <div>
                    <p className="font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.sku}</p>
                </div>
            ),
        },
        {
            key: 'category',
            header: 'الفئة',
            render: (item: Product) => (
                <span className="text-muted-foreground text-sm">
                    {CATEGORY_LABELS[item.category]}
                </span>
            ),
        },
        {
            key: 'specs',
            header: 'المواصفات',
            render: (item: Product) => (
                <div className="text-sm">
                    {item.material && (
                        <span className="inline-block px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-xs mr-1">
                            {MATERIAL_LABELS[item.material as MaterialType]}
                        </span>
                    )}
                    {item.diameter && <span className="text-muted-foreground">{item.diameter}</span>}
                    {item.length && <span className="text-muted-foreground"> × {item.length}</span>}
                </div>
            ),
        },
        {
            key: 'quantity',
            header: 'الكمية',
            render: (item: Product) => (
                <span className="num font-medium">{formatNumber(item.totalQuantity)}</span>
            ),
        },
        {
            key: 'status',
            header: 'الحالة',
            render: (item: Product) => (
                <div className="flex items-center gap-2">
                    <StatusBadge status={getStockStatus(item.totalQuantity, item.minStock)} />
                    {isDeadStockUI(item.lastMovementAt, deadStockThreshold) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
                            <Clock className="w-3 h-3" />
                            راكد
                        </span>
                    )}
                </div>
            ),
        },
        ...(canViewPrices ? [
            {
                key: 'sellingPrice',
                header: 'سعر البيع',
                render: (item: Product) => (
                    <span className="num font-medium text-primary">{formatCurrency(item.sellingPrice)}</span>
                ),
            },
            {
                key: 'totalValue',
                header: 'قيمة المخزون',
                render: (item: Product) => (
                    <span className="num font-medium text-success">
                        {formatCurrency(item.totalQuantity * item.basePriceWac)}
                    </span>
                ),
            },
        ] : []),
        {
            key: 'actions',
            header: 'الإجراءات',
            render: (item: Product) => (
                <div className="flex items-center gap-1">
                    {canEdit && (
                        <button
                            onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
                            className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                            title="تعديل"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                    )}
                    {canEdit && (
                        <button
                            onClick={(e) => { e.stopPropagation(); openTransformModal(item); }}
                            className="p-2 rounded-lg hover:bg-orange-100 transition-colors text-orange-600 hover:text-orange-700"
                            title="قص / تحويل الصنف"
                        >
                            <Scissors className="w-4 h-4" />
                        </button>
                    )}
                    {canDelete && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setDeleteItem(item); }}
                            className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            ),
        },
    ], [canViewPrices, canEdit, canDelete]);





    return (
        <div className="animate-fade-in">
            <PageHeader
                title="إدارة المخزون"
                description="عرض وإدارة مستلزمات العظام"
                actions={
                    canCreate && (
                        <Button onClick={openAddModal}>
                            <Plus className="w-4 h-4 ml-2" />
                            إضافة صنف
                        </Button>
                    )
                }
            />

            {/* Filters */}
            <div className="flex flex-col gap-4 mb-6">
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="بحث بالاسم أو الرمز أو المواصفات..."
                    className="max-w-md"
                />
                <div className="flex flex-wrap items-center gap-3">
                    <Filter className="w-5 h-5 text-muted-foreground" />
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="h-10 px-3 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        <option value="">جميع الفئات</option>
                        {categoryOptions.map(({ value, label }) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    <select
                        value={materialFilter}
                        onChange={(e) => setMaterialFilter(e.target.value)}
                        className="h-10 px-3 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        <option value="">جميع المواد</option>
                        {materialOptions.map(({ value, label }) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Mobile card list */}
            {isMobile ? (
                <div className="space-y-2">
                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    ) : filteredInventory.map(item => (
                        <ProductCardMobile
                            key={item.id}
                            name={item.name}
                            sku={item.sku}
                            category={CATEGORY_LABELS[item.category] ?? item.category}
                            quantity={item.totalQuantity}
                            minStock={item.minStock}
                            sellingPrice={item.sellingPrice}
                            actions={
                                canEdit ? (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openEditModal(item)}
                                            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground"
                                            title="تعديل"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => openTransformModal(item)}
                                            className="p-2 rounded-lg hover:bg-orange-100 text-orange-600"
                                            title="قص / تحويل الصنف"
                                        >
                                            <Scissors className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : undefined
                            }
                        />
                    ))}
                </div>
            ) : (
                /* Desktop table */
                <DataTable
                    columns={columns}
                    data={filteredInventory}
                    keyExtractor={(item) => item.id}
                    emptyMessage="لا توجد أصناف مطابقة للبحث"
                />
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                    <span className="text-sm text-muted-foreground">
                        {totalItems} صنف • صفحة {page} من {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                        >
                            ← السابق
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                        >
                            التالي →
                        </Button>
                    </div>
                </div>
            )}

            {/* Add Modal */}
            <Modal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                title="إضافة صنف جديد"
                size="lg"
                footer={
                    <>
                        <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                            إلغاء
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={!formData.name || !formData.sku || !formData.category || !!marginError}
                        >
                            حفظ
                        </Button>
                    </>
                }
            >
                <InventoryForm
                    isEdit={false}
                    formData={formData}
                    setFormData={setFormData}
                    canViewPrices={canViewPrices}
                    canEditBasePrice={canEditBasePrice}
                    canEditSellingPrice={canEditSellingPrice}
                    marginError={marginError}
                    handleSellingPriceChange={handleSellingPriceChange}
                    skuOptions={skuOptions}
                />
            </Modal>

            {/* Edit Modal */}
            <Modal
                isOpen={!!editItem}
                onClose={() => setEditItem(null)}
                title="تعديل الصنف"
                size="lg"
                footer={
                    <>
                        <Button variant="outline" onClick={() => setEditItem(null)}>
                            إلغاء
                        </Button>
                        <Button onClick={handleSave} disabled={!formData.name || !formData.sku || !!marginError}>
                            حفظ التغييرات
                        </Button>
                    </>
                }
            >
                <InventoryForm
                    isEdit={true}
                    formData={formData}
                    setFormData={setFormData}
                    canViewPrices={canViewPrices}
                    canEditBasePrice={canEditBasePrice}
                    canEditSellingPrice={canEditSellingPrice}
                    marginError={marginError}
                    handleSellingPriceChange={handleSellingPriceChange}
                    skuOptions={skuOptions}
                />
            </Modal>



            {/* Transformation Modal */}
            <Modal
                isOpen={isTransformModalOpen}
                onClose={() => setIsTransformModalOpen(false)}
                title="تحويل المخزون - قص / تعديل"
                size="lg"
                footer={
                    <>
                        <Button variant="outline" onClick={() => setIsTransformModalOpen(false)}>
                            إلغاء
                        </Button>
                        <Button
                            onClick={handleTransform}
                            disabled={!transformSource || !transformTargetId || !transformSourceQuantity || !transformTargetQuantity || !transformSourceBatchId || transformProduct.isPending}
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                        >
                            {transformProduct.isPending ? 'جاري التحويل...' : (
                                <>
                                    <Scissors className="w-4 h-4 ml-2" />
                                    تنفيذ العملية
                                </>
                            )}
                        </Button>
                    </>
                }
            >
                <div className="space-y-6">
                    {/* Top Section: Source (Read-Only) */}
                    <div className="bg-muted rounded-lg p-4 border border-border">
                        <h3 className="text-sm font-semibold text-muted-foreground mb-3">المصدر (الصنف الأصلي)</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">اسم الصنف:</span>
                                <span className="font-medium">{transformSource?.name}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">رمز الصنف (SKU):</span>
                                <span className="font-mono text-sm">{transformSource?.sku}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">سعر التكلفة:</span>
                                <span className="font-bold text-primary">{transformSource?.basePriceWac ? formatCurrency(transformSource.basePriceWac) : '-'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">الكمية المتاحة:</span>
                                <span className="font-medium">{transformSource?.totalQuantity}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">المواصفات:</span>
                                <span className="font-mono text-xs bg-background px-2 py-0.5 rounded border">
                                    {transformSource?.diameter && `Ø ${transformSource.diameter}`}
                                    {transformSource?.diameter && transformSource?.length && ' × '}
                                    {transformSource?.length && `L ${transformSource.length}`}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Middle Section: Target Selection */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-border pb-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">دفعة المصدر <span className="text-destructive">*</span></label>
                                <select
                                    className="w-full h-10 px-3 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                                    value={transformSourceBatchId}
                                    onChange={(e) => setTransformSourceBatchId(e.target.value)}
                                    disabled={!sourceBatches || sourceBatches.length === 0}
                                    dir="ltr"
                                >
                                    <option value="">اختر الدفعة المتاحة</option>
                                    {sourceBatches.map((b: any) => (
                                        <option key={b.id} value={b.id}>
                                            {b.batch_no || 'بدون تشغيلة'} | {b.quantity} قطعة | {formatCurrency(Number(b.unit_cost))}
                                        </option>
                                    ))}
                                </select>
                                {(!sourceBatches || sourceBatches.length === 0) && (
                                    <p className="text-xs text-destructive">لا توجد دفعات متاحة بمكن قصها</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">الكمية المراد قصها <span className="text-destructive">*</span></label>
                                <input
                                    type="number"
                                    value={transformSourceQuantity}
                                    onChange={(e) => setTransformSourceQuantity(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring num"
                                    placeholder="1"
                                    min="1"
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        <h3 className="text-sm font-semibold text-foreground pt-2">الهدف (الصنف الجديد)</h3>
                        <label className="text-xs text-muted-foreground">اختر الصنف المستهدف <span className="text-destructive">*</span></label>
                        <SearchableCombobox
                            options={skuOptions.filter(opt => opt.value !== transformSource?.sku)}
                            value={transformTargetId ? inventory.find(i => i.id === transformTargetId)?.sku || '' : ''}
                            onChange={(sku) => {
                                const target = inventory.find(i => i.sku === sku);
                                if (target) setTransformTargetId(target.id);
                            }}
                            placeholder="SV-SCREW-40..."
                            allowCustom={false}
                            dir="ltr"
                        />

                        {transformTargetId && (() => {
                            const target = inventory.find(i => i.id === transformTargetId);
                            return target ? (
                                <div className="mt-2 p-3 bg-green-50/50 border border-green-200 rounded-lg">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">اسم الصنف:</span>
                                            <span className="font-medium text-green-900">{target.name}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">رمز الصنف (SKU):</span>
                                            <span className="font-mono text-sm text-green-700">{target.sku}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : null;
                        })()}

                        <div className="space-y-2 mt-4">
                            <label className="text-sm font-medium">القطع الناتجة (للصنف الجديد) <span className="text-destructive">*</span></label>
                            <input
                                type="number"
                                value={transformTargetQuantity}
                                onChange={(e) => setTransformTargetQuantity(e.target.value)}
                                className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring num"
                                placeholder="مثال: 2"
                                min="1"
                                dir="ltr"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">ملاحظات (اختياري)</label>
                            <textarea
                                value={transformNotes}
                                onChange={(e) => setTransformNotes(e.target.value)}
                                className="w-full h-16 px-3 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none text-sm"
                                placeholder="سبب التعديل، تفاصيل إضافية..."
                            />
                        </div>
                    </div>

                    {/* Bottom Section: Financial Impact Calculation */}
                    {transformSourceBatchId && transformSourceQuantity && transformTargetQuantity && (() => {
                        const sQty = Number(transformSourceQuantity);
                        const tQty = Number(transformTargetQuantity);
                        const batch = sourceBatches.find((b: any) => b.id === transformSourceBatchId);

                        if (!batch || isNaN(sQty) || isNaN(tQty) || sQty <= 0 || tQty <= 0) return null;

                        const sourceUnitCost = Number(batch.unit_cost);
                        const totalSourceValue = sourceUnitCost * sQty;
                        const newTargetUnitCost = totalSourceValue / tQty;

                        return (
                            <div className="space-y-4 pt-4 border-t-2 border-dashed border-border">
                                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                    <span className="text-2xl">💰</span>
                                    التكلفة المقدرة الجديدة
                                </h3>
                                <div className="p-5 rounded-xl border-2 shadow-sm bg-blue-50 border-blue-200">
                                    <div className="flex flex-col space-y-3">
                                        <div className="flex justify-between items-center bg-white/60 p-2 rounded">
                                            <span className="text-sm font-medium text-blue-800">قيمة المصدر المجتزأ:</span>
                                            <span className="font-mono text-sm font-bold text-blue-900">
                                                {formatCurrency(sourceUnitCost)} × {sQty} = {formatCurrency(totalSourceValue)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center p-3 rounded-lg border-2 bg-blue-100 border-blue-300">
                                            <span className="text-base font-bold text-blue-900">تكلفة القطعة الناتجة:</span>
                                            <span className="text-2xl font-extrabold text-blue-700">
                                                {formatCurrency(newTargetUnitCost)}
                                            </span>
                                        </div>
                                        <p className="text-blue-900 font-semibold text-sm bg-blue-100 p-2 rounded border border-blue-300 mt-2">
                                            💡 سيتم إدراج {tQty} قطعة جديدة في مخزون الهدف بتكلفة {formatCurrency(newTargetUnitCost)} للقطعة الواحدة.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </Modal>

            {/* Delete Confirmation */}
            <ConfirmDialog
                isOpen={!!deleteItem}
                onClose={() => setDeleteItem(null)}
                onConfirm={handleDelete}
                title="حذف الصنف"
                message={`هل أنت متأكد من حذف "${deleteItem?.name} - ${deleteItem?.sku}"؟ لا يمكن التراجع عن هذا الإجراء.`}
                variant="danger"
            />
        </div>
    );
}
