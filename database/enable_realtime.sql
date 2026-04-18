-- ============================================================
-- Enable Supabase Realtime for specific tables
-- Run this in: Supabase → SQL Editor
-- ============================================================
-- Realtime uses Postgres logical replication (WAL).
-- We enable it only for the tables we actually need to watch
-- to avoid unnecessary overhead.

-- Add tables to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE surgeries;
ALTER PUBLICATION supabase_realtime ADD TABLE invoices;

-- Verify which tables are now in the publication
SELECT
    schemaname,
    tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- ============================================================
-- NOTES:
--  - This only adds tables to the publication.
--  - The React hooks (useRealtime.ts) handle the subscriptions.
--  - RLS still applies — clients only see rows they're allowed to.
--  - To remove a table: ALTER PUBLICATION supabase_realtime DROP TABLE tablename;
-- ============================================================
