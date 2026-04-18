-- ============================================================
-- Supply-Care Performance Booster
-- Run once in: Supabase → SQL Editor → Run
-- ============================================================

-- ── 1. INDEXES ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_surgeries_date
  ON surgeries (date DESC);

CREATE INDEX IF NOT EXISTS idx_surgeries_doctor
  ON surgeries (doctor_id);

CREATE INDEX IF NOT EXISTS idx_surgery_items_surgery_id
  ON surgery_items (surgery_id);

CREATE INDEX IF NOT EXISTS idx_surgery_items_product_id
  ON surgery_items (product_id);

CREATE INDEX IF NOT EXISTS idx_products_stock
  ON products (total_quantity, min_stock);

CREATE INDEX IF NOT EXISTS idx_products_last_movement
  ON products (last_movement_at)
  WHERE total_quantity > 0;

CREATE INDEX IF NOT EXISTS idx_invoices_date
  ON invoices (invoice_date DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_read
  ON notifications (is_read, created_at DESC);

-- ── 2. DROP old functions (safe even if they don't exist) ──

DROP FUNCTION IF EXISTS get_dashboard_stats()   CASCADE;
DROP FUNCTION IF EXISTS get_top_selling_items(INT) CASCADE;
DROP FUNCTION IF EXISTS get_surgeon_portfolio() CASCADE;
DROP FUNCTION IF EXISTS refresh_dashboard_stats() CASCADE;

-- ── 3. MATERIALIZED VIEW: dashboard_stats ──────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM surgeries)::BIGINT                          AS total_surgeries,
  COALESCE((SELECT SUM(total_quantity * base_price_wac) FROM products), 0) AS total_inventory_value,
  COALESCE((SELECT SUM(total_selling_value) FROM surgeries), 0)     AS total_sales,
  COALESCE((SELECT SUM(profit) FROM surgeries), 0)                  AS total_profit,
  (SELECT COUNT(*) FROM products WHERE total_quantity <= min_stock)::BIGINT AS low_stock_count;

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dashboard_stats
  ON mv_dashboard_stats ((1));

-- ── 4. Refresh function ────────────────────────────────────

CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_stats;
  RETURN NULL;
END;
$$;

-- Triggers (drop first to avoid duplicates)
DROP TRIGGER IF EXISTS trg_refresh_stats_surgeries ON surgeries;
CREATE TRIGGER trg_refresh_stats_surgeries
  AFTER INSERT OR UPDATE OR DELETE ON surgeries
  FOR EACH STATEMENT EXECUTE FUNCTION refresh_dashboard_stats();

DROP TRIGGER IF EXISTS trg_refresh_stats_products ON products;
CREATE TRIGGER trg_refresh_stats_products
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH STATEMENT EXECUTE FUNCTION refresh_dashboard_stats();

-- ── 5. RPC: get_dashboard_stats ────────────────────────────

CREATE FUNCTION get_dashboard_stats()
RETURNS TABLE (
  total_surgeries       BIGINT,
  total_inventory_value NUMERIC,
  total_sales           NUMERIC,
  total_profit          NUMERIC,
  low_stock_count       BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    total_surgeries,
    total_inventory_value,
    total_sales,
    total_profit,
    low_stock_count
  FROM mv_dashboard_stats
  LIMIT 1;
$$;

-- ── 6. RPC: get_top_selling_items ──────────────────────────

CREATE FUNCTION get_top_selling_items(p_limit INT DEFAULT 10)
RETURNS TABLE (
  product_id     TEXT,
  item_name      TEXT,
  total_quantity BIGINT,
  total_revenue  NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    si.product_id::TEXT,
    si.item_name,
    SUM(si.quantity - COALESCE(si.returned_quantity, 0))::BIGINT          AS total_quantity,
    SUM((si.quantity - COALESCE(si.returned_quantity, 0)) * si.selling_price) AS total_revenue
  FROM surgery_items si
  GROUP BY si.product_id, si.item_name
  ORDER BY total_revenue DESC
  LIMIT p_limit;
$$;

-- ── 7. RPC: get_surgeon_portfolio ──────────────────────────

CREATE FUNCTION get_surgeon_portfolio()
RETURNS TABLE (
  doctor_id           UUID,
  doctor_name         TEXT,
  specialty           TEXT,
  surgery_count       BIGINT,
  total_base_value    NUMERIC,
  total_selling_value NUMERIC,
  total_profit        NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    s.doctor_id,
    d.name                      AS doctor_name,
    d.specialty,
    COUNT(s.id)                 AS surgery_count,
    SUM(s.total_base_value)     AS total_base_value,
    SUM(s.total_selling_value)  AS total_selling_value,
    SUM(s.profit)               AS total_profit
  FROM surgeries s
  LEFT JOIN doctors d ON d.id = s.doctor_id
  GROUP BY s.doctor_id, d.name, d.specialty
  ORDER BY total_profit DESC;
$$;

-- ── 8. Initial view refresh ────────────────────────────────
REFRESH MATERIALIZED VIEW mv_dashboard_stats;

-- Done ✅
SELECT 'Performance script applied successfully 🚀' AS status;
