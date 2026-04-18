-- ============================================================
-- Fix Settings Authorization & Intialization
-- Run this in Supabase -> SQL Editor -> Run
-- ============================================================

-- 1. Ensure the table has at least one row.
-- This prevents the client from trying to do an HTTP POST (INSERT) 
-- and instead makes it do an HTTP PATCH (UPDATE).
INSERT INTO system_settings (
    dead_stock_threshold_months,
    low_stock_alert_enabled,
    margin_warning_enabled,
    dead_stock_alert_enabled,
    new_purchase_alert_enabled,
    new_surgery_alert_enabled
)
SELECT 6, true, true, true, true, true
WHERE NOT EXISTS (SELECT 1 FROM system_settings);

-- 2. Grant permissions to the anon role 
-- (since the app uses custom auth, API requests run as 'anon')
GRANT SELECT, INSERT, UPDATE ON system_settings TO anon, authenticated;

-- 3. If RLS is accidentally enabled for this table without an anon policy,
-- it will block updates. Let's explicitly add a policy for anon, or just disable RLS
-- to match the rest of the custom-auth setup:
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;

SELECT 'تم إصلاح الإعدادات بنجاح' as status;
