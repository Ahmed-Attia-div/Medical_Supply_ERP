-- ============================================================
-- Fix Materialized View Concurrent Refresh Error (500)
-- Run this in Supabase -> SQL Editor -> Run
-- ============================================================

-- REFRESH MATERIALIZED VIEW CONCURRENTLY requires a unique index on a REAL column.
-- Since mv_dashboard_stats is a 1-row aggregate view without a real primary key column,
-- the unique index on expression ((1)) causes PostgreSQL to block the concurrent refresh
-- anytime the underlying data changes (e.g., deleting a user triggers system_logs triggers).

-- Fix: Redefine the function to do a standard refresh (which is instantly fast anyway for this small view)
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Replaced 'CONCURRENTLY' with standard refresh to prevent the '55000' exception
  REFRESH MATERIALIZED VIEW mv_dashboard_stats;
  RETURN NULL;
END;
$$;

-- Just to be safe, also drop the hacky index we tried to use for concurrently
DROP INDEX IF EXISTS idx_mv_dashboard_stats;

SELECT '✅ تم إصلاح خطأ 500 المرتبط بتحديث البيانات وتستطيع الآن مسح المستخدم' as status;
