/**
 * Settings Service — v2.0
 * Schema changes:
 *  - Added dead_stock_alert_enabled, new_purchase_alert_enabled (were missing before)
 *  - Proper camelCase ↔ snake_case mapping
 *  - Uses standardized error handler
 */

import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabaseError';
import type { SystemSettings } from '@/types/inventory';

function fromDb(row: Record<string, unknown>): SystemSettings {
    return {
        id: row.id as string,
        deadStockThresholdMonths: Number(row.dead_stock_threshold_months ?? 6),
        lowStockAlertEnabled: Boolean(row.low_stock_alert_enabled ?? true),
        marginWarningEnabled: Boolean(row.margin_warning_enabled ?? true),
        deadStockAlertEnabled: Boolean(row.dead_stock_alert_enabled ?? true),
        newPurchaseAlertEnabled: Boolean(row.new_purchase_alert_enabled ?? true),
        newSurgeryAlertEnabled: Boolean(row.new_surgery_alert_enabled ?? true),
    };
}

function toDb(settings: Partial<SystemSettings>): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    if (settings.deadStockThresholdMonths !== undefined) row.dead_stock_threshold_months = settings.deadStockThresholdMonths;
    if (settings.lowStockAlertEnabled !== undefined) row.low_stock_alert_enabled = settings.lowStockAlertEnabled;
    if (settings.marginWarningEnabled !== undefined) row.margin_warning_enabled = settings.marginWarningEnabled;
    if (settings.deadStockAlertEnabled !== undefined) row.dead_stock_alert_enabled = settings.deadStockAlertEnabled;
    if (settings.newPurchaseAlertEnabled !== undefined) row.new_purchase_alert_enabled = settings.newPurchaseAlertEnabled;
    if (settings.newSurgeryAlertEnabled !== undefined) row.new_surgery_alert_enabled = settings.newSurgeryAlertEnabled;
    return row;
}

export const settingsService = {
    async getSettings(): Promise<SystemSettings | null> {
        const { data, error } = await supabase
            .from('system_settings')
            .select('*')
            .maybeSingle();

        if (error) {
            console.error('Error fetching settings:', error);
            return null; // Non-fatal — return null so the app still works
        }

        return data ? fromDb(data) : null;
    },

    async updateSettings(settings: Partial<SystemSettings>): Promise<void> {
        const dbRow = toDb(settings);

        // Check if a row exists
        const { data: existing } = await supabase
            .from('system_settings')
            .select('id')
            .maybeSingle();

        if (existing?.id) {
            const { error } = await supabase
                .from('system_settings')
                .update(dbRow)
                .eq('id', existing.id);
            if (error) throw handleSupabaseError(error, 'تحديث الإعدادات');
        } else {
            const { error } = await supabase
                .from('system_settings')
                .insert([dbRow]);
            if (error) throw handleSupabaseError(error, 'حفظ الإعدادات');
        }
    },
};
