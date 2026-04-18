-- Fix System Settings and Add Notification Support
 
-- 1. Create Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL CHECK (type IN ('low_stock', 'dead_stock', 'new_purchase', 'new_surgery', 'margin_warning', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
 
-- 2. Add Missing Columns to Settings
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS dead_stock_alert_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS new_purchase_alert_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS new_surgery_alert_enabled BOOLEAN DEFAULT TRUE;
 
-- 3. Ensure a row exists (if table empty)
INSERT INTO system_settings (dead_stock_threshold_months, low_stock_alert_enabled, margin_warning_enabled, dead_stock_alert_enabled, new_purchase_alert_enabled, new_surgery_alert_enabled)
SELECT 6, TRUE, TRUE, TRUE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM system_settings);
 
-- 4. Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
 
CREATE POLICY "Enable read access for all users" ON notifications FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON notifications FOR UPDATE USING (true);
