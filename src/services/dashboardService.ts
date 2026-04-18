/**
 * Dashboard Service — v2.0
 * Schema changes:
 *  - get_dashboard_stats() RPC now returns total_quantity and unpaid_invoices_count
 *  - Views renamed: low_stock_items_top, recent_surgeries_top (unchanged names, content updated)
 *  - DashboardStats now has nullable fields (null if user role has no financial access)
 */

import { supabase } from '../lib/supabase';
import { handleSupabaseError } from '../lib/supabaseError';
import type { DashboardStats } from '../types/inventory';

export interface LowStockItem {
    id: string;
    name: string;
    sku: string;
    category: string;
    material?: string;
    diameter?: string;
    length?: string;
    unit?: string;
    quantity: number;
    min_stock: number;
    base_price: number;
    selling_price: number;
    last_movement_at: string;
    sterilization_status: string;
    stock_ratio: number;
}

export interface RecentSurgery {
    id: string;
    patient_name: string;
    date: string;
    type: string;
    total_base_value: number;
    total_selling_value: number;
    profit: number;
    notes?: string;
    doctor_name?: string;
    hospital?: string;
}

export const dashboardService = {

    /**
     * Get dashboard KPI stats via the get_dashboard_stats() RPC.
     * Financial fields (total_inventory_value, total_purchases, total_profit,
     * unpaid_invoices_count) return null for non-financial roles (storekeeper, doctor).
     */
    async getStats(): Promise<DashboardStats> {
        const { data, error } = await supabase.rpc('get_dashboard_stats');
        if (error) throw handleSupabaseError(error, 'جلب إحصائيات لوحة التحكم');

        // RPC returns a JSONB object — cast safely
        const d = data as Record<string, unknown>;
        return {
            total_skus: Number(d.total_skus ?? 0),
            total_quantity: Number(d.total_quantity ?? 0),
            low_stock_count: Number(d.low_stock_count ?? 0),
            dead_stock_count: Number(d.dead_stock_count ?? 0),
            total_inventory_value: d.total_inventory_value != null ? Number(d.total_inventory_value) : null,
            total_purchases: d.total_purchases != null ? Number(d.total_purchases) : null,
            total_profit: d.total_profit != null ? Number(d.total_profit) : null,
            total_surgeries: Number(d.total_surgeries ?? 0),
            unpaid_invoices_count: d.unpaid_invoices_count != null ? Number(d.unpaid_invoices_count) : null,
        };
    },

    /** Top 20 low-stock items from the view */
    async getLowStockItems(): Promise<LowStockItem[]> {
        const { data, error } = await supabase
            .from('low_stock_items_top')
            .select('*');

        if (error) throw handleSupabaseError(error, 'جلب الأصناف منخفضة المخزون');

        return (data ?? []).map(item => ({
            id: item.id as string,
            name: item.name as string,
            sku: item.sku as string,
            category: item.category as string,
            material: item.material as string | undefined,
            diameter: item.diameter as string | undefined,
            length: item.length as string | undefined,
            unit: item.unit as string | undefined,
            quantity: Number(item.quantity),
            min_stock: Number(item.min_stock),
            base_price: Number(item.base_price),
            selling_price: Number(item.selling_price),
            last_movement_at: item.last_movement_at as string,
            sterilization_status: item.sterilization_status as string,
            stock_ratio: Number(item.stock_ratio),
        }));
    },

    /** Last 10 surgeries from the view */
    async getRecentSurgeries(): Promise<RecentSurgery[]> {
        const { data, error } = await supabase
            .from('recent_surgeries_top')
            .select('*');

        if (error) throw handleSupabaseError(error, 'جلب آخر العمليات الجراحية');

        return (data ?? []).map(s => ({
            id: s.id as string,
            patient_name: s.patient_name as string,
            date: s.date as string,
            type: s.type as string,
            total_base_value: Number(s.total_base_value),
            total_selling_value: Number(s.total_selling_value),
            profit: Number(s.profit),
            notes: s.notes as string | undefined,
            doctor_name: s.doctor_name as string | undefined,
            hospital: s.hospital as string | undefined,
        }));
    },

    /** Expiring batches (within 90 days) */
    async getExpiringBatches() {
        const { data, error } = await supabase
            .from('expiring_batches')
            .select('*');

        if (error) throw handleSupabaseError(error, 'جلب الدفعات قريبة الانتهاء');
        return data ?? [];
    },
};
