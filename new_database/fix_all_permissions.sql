-- ============================================================
-- MASTER FIX: Grant Full Access for Custom Auth
-- Since Supply-Care uses custom authentication (not Supabase Auth),
-- all API requests come through as the 'anon' role.
-- This script grants full access to anon on ALL tables
-- and disables RLS (which relies on auth.uid() that is always NULL).
-- 
-- Run this ONCE in Supabase -> SQL Editor -> Run
-- ============================================================

-- ── 1. DISABLE RLS ON ALL TABLES ────────────────────────────
-- RLS policies use auth.uid() which is always NULL with custom auth,
-- so every write operation gets blocked with 401 Unauthorized.
ALTER TABLE users                     DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE doctors                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE products                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_batches           DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items             DISABLE ROW LEVEL SECURITY;
ALTER TABLE surgeries                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE surgery_items             DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions    DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications             DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings           DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs               DISABLE ROW LEVEL SECURITY;

-- These may or may not exist depending on which setup script was run
DO $$ BEGIN
  EXECUTE 'ALTER TABLE inventory_transformations DISABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ── 2. GRANT FULL TABLE ACCESS TO anon AND authenticated ────
-- The anon key is used by default in supabase-js when there's 
-- no active Supabase Auth session.
GRANT SELECT, INSERT, UPDATE, DELETE ON users                     TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON suppliers                 TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON doctors                   TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON products                  TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_batches           TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON invoices                  TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON invoice_items             TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON surgeries                 TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON surgery_items             TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_transactions    TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications             TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON system_settings           TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON system_logs               TO anon, authenticated;

DO $$ BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_transformations TO anon, authenticated';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ── 3. GRANT USAGE ON SEQUENCES (needed for auto-generated IDs) ──
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ── 4. GRANT EXECUTE ON ALL FUNCTIONS (for RPCs) ────────────
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- ── 5. FORCE POSTGREST SCHEMA CACHE RELOAD ──────────────────
NOTIFY pgrst, 'reload schema';

SELECT '✅ تم منح الصلاحيات الكاملة لجميع الجداول — كل العمليات ستعمل الآن' AS status;
