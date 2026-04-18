import { z } from 'zod';
import {
    CATEGORY_LABELS,
    MATERIAL_LABELS,
    STERILIZATION_LABELS,
} from './inventory';

// ─── Re-usable primitives ─────────────────────────────────────────────────────

const positiveInt = (label: string) =>
    z
        .number({ invalid_type_error: `${label} يجب أن يكون رقماً` })
        .int()
        .min(0, `${label} لا يمكن أن يكون سالباً`);

const positiveDecimal = (label: string) =>
    z
        .number({ invalid_type_error: `${label} يجب أن يكون رقماً` })
        .min(0, `${label} لا يمكن أن يكون سالباً`);

const requiredText = (label: string, min = 1, max = 500) =>
    z
        .string({ required_error: `${label} مطلوب` })
        .trim()
        .min(min, `${label} لا يمكن أن يكون فارغاً`)
        .max(max, `${label} يتجاوز الحد المسموح به (${max} حرف)`);

const optionalText = (max = 500) =>
    z.string().trim().max(max).optional().or(z.literal(''));

// ─── Product / Inventory Form ─────────────────────────────────────────────────

export const productSchema = z.object({
    name: requiredText('اسم المنتج', 2, 200),

    sku: requiredText('رمز SKU', 2, 100).regex(
        /^[A-Za-z0-9\-_]+$/,
        'رمز SKU يجب أن يحتوي على أحرف وأرقام وشرطات فقط',
    ),

    category: z.enum(
        Object.keys(CATEGORY_LABELS) as [string, ...string[]],
        { errorMap: () => ({ message: 'يرجى اختيار فئة صحيحة' }) },
    ),

    material: z
        .enum(Object.keys(MATERIAL_LABELS) as [string, ...string[]])
        .optional()
        .or(z.literal('')),

    diameter: optionalText(20),
    length: optionalText(20),
    unit: requiredText('وحدة القياس', 1, 30),

    min_stock: positiveInt('الحد الأدنى للمخزون'),

    sterilization_status: z.enum(
        Object.keys(STERILIZATION_LABELS) as [string, ...string[]],
        { errorMap: () => ({ message: 'يرجى اختيار حالة التعقيم' }) },
    ),

    selling_price: positiveDecimal('سعر البيع'),

    notes: optionalText(1000),
});

export type ProductFormValues = z.infer<typeof productSchema>;

export const productDefaults: ProductFormValues = {
    name: '',
    sku: '',
    category: 'screws',
    material: '',
    diameter: '',
    length: '',
    unit: 'piece',
    min_stock: 10,
    sterilization_status: 'non_sterilized',
    selling_price: 0,
    notes: '',
};

// ─── Surgery Item (sub-schema) ────────────────────────────────────────────────

export const surgeryItemSchema = z.object({
    product_id: z.string().uuid('يرجى اختيار منتج صحيح'),
    item_name: requiredText('اسم الصنف', 1, 200),
    quantity: z.number().int().min(1, 'الكمية يجب أن تكون 1 على الأقل'),
    selling_price: positiveDecimal('سعر البيع'),
    base_price: positiveDecimal('التكلفة الأساسية'),
    source_batch_id: z.string().uuid().optional().or(z.literal('')),
});

export type SurgeryItemFormValues = z.infer<typeof surgeryItemSchema>;

// ─── Surgery Form ─────────────────────────────────────────────────────────────

export const surgerySchema = z
    .object({
        doctor_id: z.string().uuid('يرجى اختيار طبيب'),
        patient_name: requiredText('اسم المريض', 2, 200),
        patient_id: optionalText(100),
        date: z.string().min(1, 'تاريخ العملية مطلوب'),
        type: requiredText('نوع العملية', 2, 200),
        notes: optionalText(1000),
        items: z
            .array(surgeryItemSchema)
            .min(1, 'يجب إضافة صنف واحد على الأقل'),
    })
    .superRefine((data, ctx) => {
        data.items.forEach((item, idx) => {
            if (item.selling_price < item.base_price) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `الصنف "${item.item_name}": سعر البيع أقل من التكلفة — قد تكون هناك خسارة`,
                    path: ['items', idx, 'selling_price'],
                });
            }
        });
    });

export type SurgeryFormValues = z.infer<typeof surgerySchema>;

export const surgeryDefaults: SurgeryFormValues = {
    doctor_id: '',
    patient_name: '',
    patient_id: '',
    date: new Date().toISOString().split('T')[0],
    type: '',
    notes: '',
    items: [],
};

// ─── Invoice Form ─────────────────────────────────────────────────────────────

export const invoiceItemSchema = z.object({
    product_id: z.string().uuid('يرجى اختيار منتج صحيح'),
    quantity: z.number().int().min(1, 'الكمية يجب أن تكون 1 على الأقل'),
    unit_cost: positiveDecimal('سعر الوحدة'),
    batch_no: optionalText(100),
    expiry_date: optionalText(20),
});

export const invoiceSchema = z
    .object({
        supplier_id: z.string().uuid('يرجى اختيار مورد'),
        invoice_date: z.string().min(1, 'تاريخ الفاتورة مطلوب'),
        vendor_invoice_number: optionalText(100),
        payment_type: z.enum(['cash', 'credit']),
        total_amount: positiveDecimal('إجمالي الفاتورة').min(0.01, 'إجمالي الفاتورة يجب أن يكون أكبر من صفر'),
        amount_paid: positiveDecimal('المبلغ المدفوع'),
        notes: optionalText(1000),
        items: z.array(invoiceItemSchema).min(1, 'يجب إضافة صنف واحد على الأقل'),
    })
    .superRefine((data, ctx) => {
        if (data.amount_paid > data.total_amount) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'المبلغ المدفوع لا يمكن أن يتجاوز إجمالي الفاتورة',
                path: ['amount_paid'],
            });
        }
    });

export type InvoiceFormValues = z.infer<typeof invoiceSchema>;
