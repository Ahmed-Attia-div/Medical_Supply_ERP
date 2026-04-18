-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL CHECK (type IN ('low_stock', 'dead_stock', 'new_purchase', 'new_surgery', 'margin_warning', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to system_settings
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS dead_stock_alert_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS new_purchase_alert_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS new_surgery_alert_enabled BOOLEAN DEFAULT TRUE;

-- Add RLS for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON notifications FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON notifications FOR UPDATE USING (true);
