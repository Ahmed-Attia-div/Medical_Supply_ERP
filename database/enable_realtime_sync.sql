-- Enable Realtime for critical tables
-- By default, new tables might not be in the publication.
-- We must add them explicitly to the 'supabase_realtime' publication to broadcast changes.

-- 1. Add tables to publication
alter publication supabase_realtime add table products;
alter publication supabase_realtime add table invoices;
alter publication supabase_realtime add table invoice_items;
alter publication supabase_realtime add table notifications;

-- 2. Verify RLS Policies (Security)
-- Realtime respects RLS. If a user cannot SELECT a row, they won't receive the event.
-- Ensure authenticated users have SELECT access.

-- Policy for Products (Inventory)
CREATE POLICY "Enable read access for all users" ON products
    FOR SELECT
    USING (true); -- Publicly visible to all authenticated users

-- Policy for Invoices
CREATE POLICY "Enable read access for all users" ON invoices
    FOR SELECT
    USING (true);

-- Policy for Invoice Items
CREATE POLICY "Enable read access for all users" ON invoice_items
    FOR SELECT
    USING (true);

-- 3. Replica Identity (Required for DELETE/UPDATE events to send full old record)
-- This ensures the client knows WHICH row was deleted/updated even if primary key changes (rare).
ALTER TABLE products REPLICA IDENTITY FULL;
ALTER TABLE invoices REPLICA IDENTITY FULL;
ALTER TABLE invoice_items REPLICA IDENTITY FULL;
