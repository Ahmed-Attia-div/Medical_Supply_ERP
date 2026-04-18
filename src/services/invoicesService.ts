/**
 * Invoices Service — v2.0
 * Schema changes from v1:
 *  - Added: amount_paid, payment_status columns
 *  - create() now accepts amountPaid and passes to RPC
 *  - New: updatePayment() — pay down a credit invoice
 */

import { supabase } from '@/lib/supabase';
import { assertOk, handleSupabaseError } from '@/lib/supabaseError';
import type { Invoice, InvoiceItem, CreateInvoiceInput } from '@/types/inventory';

// ─── Mappers ──────────────────────────────────────────────────────────────────

function itemFromDb(row: Record<string, unknown>): InvoiceItem {
    return {
        id: row.id as string,
        invoiceId: row.invoice_id as string,
        productId: row.product_id as string,
        productName: (row as any).products?.name as string | undefined,
        quantity: Number(row.quantity),
        unitCost: Number(row.unit_cost),
        batchNo: row.batch_no as string | undefined,
        expiryDate: row.expiry_date ? new Date(row.expiry_date as string) : undefined,
        createdAt: new Date(row.created_at as string),
    };
}

function fromDb(row: Record<string, unknown>, items: InvoiceItem[] = []): Invoice {
    return {
        id: row.id as string,
        supplierId: row.supplier_id as string,
        supplierName: (row as any).suppliers?.name as string | undefined,
        invoiceDate: new Date(row.invoice_date as string),
        vendorInvoiceNumber: row.vendor_invoice_number as string | undefined,
        paymentType: (row.payment_type as Invoice['paymentType']) ?? 'cash',
        totalAmount: Number(row.total_amount),
        amountPaid: Number(row.amount_paid ?? 0),
        paymentStatus: (row.payment_status as Invoice['paymentStatus']) ?? 'paid',
        notes: row.notes as string | undefined,
        items,
        createdBy: row.created_by as string | undefined,
        createdAt: new Date(row.created_at as string),
    };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const invoicesService = {

    /** Get all invoices with supplier name */
    async getAll(): Promise<Invoice[]> {
        const { data, error } = await supabase
            .from('invoices')
            .select('*, suppliers ( name )')
            .order('invoice_date', { ascending: false });

        if (error) throw handleSupabaseError(error, 'جلب الفواتير');
        return (data ?? []).map(r => fromDb(r as any));
    },

    /** Get single invoice with all line items */
    async getById(id: string): Promise<Invoice | null> {
        const { data, error } = await supabase
            .from('invoices')
            .select(`
        *,
        suppliers ( name ),
        invoice_items (
          id, invoice_id, product_id, quantity,
          unit_cost, batch_no, expiry_date, created_at,
          products ( name )
        )
      `)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw handleSupabaseError(error, 'جلب الفاتورة');
        }

        const items = ((data as any).invoice_items ?? []).map(itemFromDb);
        return fromDb(data as any, items);
    },

    /** Get invoices paginated by supplier */
    async getBySupplier(supplierId: string): Promise<Invoice[]> {
        const { data, error } = await supabase
            .from('invoices')
            .select('*, suppliers ( name )')
            .eq('supplier_id', supplierId)
            .order('invoice_date', { ascending: false });

        if (error) throw handleSupabaseError(error, 'جلب فواتير المورد');
        return (data ?? []).map(r => fromDb(r as any));
    },

    /** Get open (unpaid / partial) invoices */
    async getOpenInvoices() {
        // Query the invoices table directly to include all necessary fields like created_by and created_at
        const { data, error } = await supabase
            .from('invoices')
            .select(`
                id,
                supplier_id,
                invoice_date,
                vendor_invoice_number,
                total_amount,
                amount_paid,
                payment_status,
                created_by,
                created_at,
                suppliers ( name )
            `)
            .neq('payment_status', 'paid')
            .order('invoice_date', { ascending: true });

        if (error) throw handleSupabaseError(error, 'جلب الفواتير المفتوحة');
        
        // Map data to match the expected format matching the view
        return (data ?? []).map((inv: any) => ({
            id: inv.id,
            supplier_id: inv.supplier_id,
            supplier_name: inv.suppliers?.name,
            invoice_date: inv.invoice_date,
            vendor_invoice_number: inv.vendor_invoice_number,
            payment_status: inv.payment_status,
            total_amount: inv.total_amount,
            amount_paid: inv.amount_paid,
            balance_due: Number(inv.total_amount) - Number(inv.amount_paid),
            created_by: inv.created_by,
            created_at: inv.created_at
        }));
    },

    /**
     * Create invoice + batches + ledger entries atomically (via RPC).
     * If paymentType = 'cash', amountPaid defaults to totalAmount.
     * If paymentType = 'credit', pass explicit amountPaid (can be 0).
     */
    async create(input: CreateInvoiceInput): Promise<string> {
        const { data: invoiceId, error } = await supabase.rpc('create_invoice_transaction', {
            p_supplier_id: input.supplierId,
            p_invoice_date: input.invoiceDate instanceof Date
                ? input.invoiceDate.toISOString().split('T')[0]
                : input.invoiceDate,
            p_vendor_invoice_number: input.vendorInvoiceNumber ?? null,
            p_notes: input.notes ?? null,
            p_total_amount: input.totalAmount,
            p_items: input.items,
            p_created_by: input.createdBy ?? null,
            p_payment_type: input.paymentType,
            p_amount_paid: input.amountPaid ?? null,
        });

        if (error) throw handleSupabaseError(error, 'إنشاء الفاتورة');
        return invoiceId as string;
    },

    /**
     * Update payment on a credit invoice (admin only — DB enforces via RPC).
     * Triggers payment_status recomputation automatically.
     */
    async updatePayment(invoiceId: string, amountPaid: number): Promise<void> {
        const { error } = await supabase.rpc('update_invoice_payment', {
            p_invoice_id: invoiceId,
            p_amount_paid: amountPaid,
        });

        if (error) throw handleSupabaseError(error, 'تحديث الدفعة');
    },

    /** Update invoice item details (batch/expiry correction) */
    async updateItem(
        itemId: string,
        batchNo: string,
        expiryDate?: Date,
    ): Promise<void> {
        assertOk(
            await supabase
                .from('invoice_items')
                .update({
                    batch_no: batchNo || null,
                    expiry_date: expiryDate ? expiryDate.toISOString().split('T')[0] : null,
                })
                .eq('id', itemId),
            'تحديث بيانات الصنف',
        );
    },

    /** Get invoices in date range */
    async getByDateRange(startDate: Date, endDate: Date): Promise<Invoice[]> {
        const { data, error } = await supabase
            .from('invoices')
            .select('*, suppliers ( name )')
            .gte('invoice_date', startDate.toISOString().split('T')[0])
            .lte('invoice_date', endDate.toISOString().split('T')[0])
            .order('invoice_date', { ascending: false });

        if (error) throw handleSupabaseError(error, 'جلب الفواتير حسب التاريخ');
        return (data ?? []).map(r => fromDb(r as any));
    },
};
