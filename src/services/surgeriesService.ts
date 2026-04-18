/**
 * Surgeries Service — v2.0
 * Schema changes from v1:
 *  - surgery_items.item_id → product_id
 *  - surgery_items now has: source_batch_id, returned_quantity, item_name (snapshot)
 *  - create() sends items with {product_id, item_name, quantity, base_price, selling_price, source_batch_id?}
 *  - New: processReturn() calls process_surgery_return RPC
 */

import { supabase } from '../lib/supabase';
import { assertOk, handleSupabaseError } from '../lib/supabaseError';
import type { Surgery, SurgeryItem, CreateSurgeryInput } from '../types/inventory';

// ─── Mappers ──────────────────────────────────────────────────────────────────

function itemFromDatabase(row: Record<string, unknown>): SurgeryItem {
    return {
        id: row.id as string,
        surgeryId: row.surgery_id as string,
        productId: row.product_id as string,
        sourceBatchId: row.source_batch_id as string | undefined,
        itemName: row.item_name as string,
        quantity: Number(row.quantity),
        returnedQuantity: Number(row.returned_quantity ?? 0),
        basePrice: Number(row.base_price),
        sellingPrice: Number(row.selling_price),
        returnedAt: row.returned_at ? new Date(row.returned_at as string) : undefined,
        returnNotes: row.return_notes as string | undefined,
        sku: (row as any).products?.sku,
        batchNo: (row as any).product_batches?.batch_no,
    };
}

function fromDatabase(row: Record<string, unknown>, items: SurgeryItem[] = []): Surgery {
    return {
        id: row.id as string,
        doctorId: row.doctor_id as string,
        doctorName: (row as any).doctors?.name as string | undefined,
        patientId: row.patient_id as string | undefined,
        patientName: row.patient_name as string,
        date: new Date(row.date as string),
        type: row.type as string,
        items,
        totalBaseValue: Number(row.total_base_value),
        totalSellingValue: Number(row.total_selling_value),
        profit: Number(row.profit),
        notes: row.notes as string | undefined,
        createdBy: row.created_by as string | undefined,
        createdAt: new Date(row.created_at as string),
    };
}

// ─── Shared select fragment ───────────────────────────────────────────────────

const SURGERY_SELECT = `
  *,
  doctors ( name, hospital ),
  surgery_items (
    id, surgery_id, product_id, source_batch_id,
    item_name, quantity, returned_quantity,
    base_price, selling_price,
    returned_at, return_notes,
    products ( sku ),
    product_batches ( batch_no )
  )
`;

// ─── Service ──────────────────────────────────────────────────────────────────

export const surgeriesService = {

    /** Get all surgeries with doctor info and items */
    async getAll(): Promise<Surgery[]> {
        const { data, error } = await supabase
            .from('surgeries')
            .select(SURGERY_SELECT)
            .order('date', { ascending: false });

        if (error) throw handleSupabaseError(error, 'جلب العمليات الجراحية');

        return (data ?? []).map((row: any) =>
            fromDatabase(row, (row.surgery_items ?? []).map(itemFromDatabase)),
        );
    },

    /** Get surgery by ID */
    async getById(id: string): Promise<Surgery | null> {
        const { data, error } = await supabase
            .from('surgeries')
            .select(SURGERY_SELECT)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw handleSupabaseError(error, 'جلب العملية الجراحية');
        }

        const items = ((data as any).surgery_items ?? []).map(itemFromDatabase);
        return fromDatabase(data as any, items);
    },

    /** Get surgeries by doctor */
    async getByDoctor(doctorId: string): Promise<Surgery[]> {
        const { data, error } = await supabase
            .from('surgeries')
            .select(SURGERY_SELECT)
            .eq('doctor_id', doctorId)
            .order('date', { ascending: false });

        if (error) throw handleSupabaseError(error, 'جلب عمليات الطبيب');

        return (data ?? []).map((row: any) =>
            fromDatabase(row, (row.surgery_items ?? []).map(itemFromDatabase)),
        );
    },

    /** Get surgeries within date range */
    async getByDateRange(startDate: Date, endDate: Date): Promise<Surgery[]> {
        const { data, error } = await supabase
            .from('surgeries')
            .select(SURGERY_SELECT)
            .gte('date', startDate.toISOString().split('T')[0])
            .lte('date', endDate.toISOString().split('T')[0])
            .order('date', { ascending: false });

        if (error) throw handleSupabaseError(error, 'جلب العمليات حسب التاريخ');

        return (data ?? []).map((row: any) =>
            fromDatabase(row, (row.surgery_items ?? []).map(itemFromDatabase)),
        );
    },

    /**
     * Create surgery + deduct stock atomically (via RPC).
     * Items must include: product_id, item_name, quantity, base_price, selling_price
     * Optional per-item: source_batch_id (if null, FEFO batch is auto-selected)
     */
    async create(input: CreateSurgeryInput): Promise<Surgery> {
        const totalBaseValue = input.items.reduce((s, i) => s + i.base_price * i.quantity, 0);
        const totalSellingValue = input.items.reduce((s, i) => s + i.selling_price * i.quantity, 0);
        const profit = totalSellingValue - totalBaseValue;

        const { data: surgeryId, error } = await supabase.rpc('create_surgery_transaction', {
            p_doctor_id: input.doctorId,
            p_patient_id: input.patientId ?? null,
            p_patient_name: input.patientName,
            p_date: input.date instanceof Date
                ? input.date.toISOString().split('T')[0]
                : input.date,
            p_type: input.type,
            p_total_base_value: totalBaseValue,
            p_total_selling_value: totalSellingValue,
            p_profit: profit,
            p_notes: input.notes ?? null,
            p_items: input.items,
            p_created_by: input.createdBy ?? null,
        });

        if (error) throw handleSupabaseError(error, 'تسجيل العملية الجراحية');

        return (await this.getById(surgeryId as string))!;
    },

    /**
     * Process a surgery item return — returns stock to original batch.
     * Only admin/storekeeper can call this (enforced by DB RLS).
     */
    async processReturn(
        surgeryItemId: string,
        returnQuantity: number,
        returnNotes?: string,
    ): Promise<void> {
        const { error } = await supabase.rpc('process_surgery_return', {
            p_surgery_item_id: surgeryItemId,
            p_return_quantity: returnQuantity,
            p_return_notes: returnNotes ?? null,
        });

        if (error) throw handleSupabaseError(error, 'تسجيل إعادة الصنف');
    },

    /** Update surgery metadata (NOT items — items are immutable after creation) */
    async update(id: string, updates: { notes?: string; type?: string }): Promise<Surgery> {
        const { data } = assertOk(
            await supabase
                .from('surgeries')
                .update(updates)
                .eq('id', id)
                .select(SURGERY_SELECT)
                .single(),
            'تحديث العملية الجراحية',
        );

        const items = ((data as any).surgery_items ?? []).map(itemFromDatabase);
        return fromDatabase(data as any, items);
    },

    /** Delete surgery (cascade deletes surgery_items; stock is NOT restored) */
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('surgeries')
            .delete()
            .eq('id', id);

        if (error) throw handleSupabaseError(error, 'حذف العملية الجراحية');
    },

    /** Profitability view (admin/partner only — enforced by RLS) */
    async getProfitability() {
        const { data, error } = await supabase
            .from('surgery_profitability')
            .select('*')
            .order('date', { ascending: false });

        if (error) throw handleSupabaseError(error, 'جلب بيانات الربحية');
        return data ?? [];
    },

    /** Top selling items — aggregated from surgery_items */
    async getTopSellingItems(
        startDate?: Date,
        endDate?: Date,
        limit = 10,
    ): Promise<{ productId: string; itemName: string; totalQuantity: number; totalRevenue: number }[]> {
        let query = supabase
            .from('surgery_items')
            .select(`
        product_id,
        item_name,
        quantity,
        selling_price,
        returned_quantity,
        surgeries!inner ( date )
      `);

        if (startDate) query = query.gte('surgeries.date', startDate.toISOString().split('T')[0]);
        if (endDate) query = query.lte('surgeries.date', endDate.toISOString().split('T')[0]);

        const { data, error } = await query;
        if (error) throw handleSupabaseError(error, 'جلب الأصناف الأكثر مبيعاً');

        // Aggregate by product_id — subtract returned quantities
        const map = new Map<string, { productId: string; itemName: string; totalQuantity: number; totalRevenue: number }>();

        for (const row of data ?? []) {
            const netQty = (row.quantity as number) - (row.returned_quantity as number ?? 0);
            const revenue = netQty * (row.selling_price as number);
            const productId = row.product_id as string;

            if (map.has(productId)) {
                const entry = map.get(productId)!;
                entry.totalQuantity += netQty;
                entry.totalRevenue += revenue;
            } else {
                map.set(productId, {
                    productId,
                    itemName: row.item_name as string,
                    totalQuantity: netQty,
                    totalRevenue: revenue,
                });
            }
        }

        return Array.from(map.values())
            .sort((a, b) => b.totalRevenue - a.totalRevenue)
            .slice(0, limit);
    },
};
