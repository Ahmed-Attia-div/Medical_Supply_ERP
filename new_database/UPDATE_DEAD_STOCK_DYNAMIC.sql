-- DYNAMIC DEAD STOCK UPDATES
-- This script updates the database logic to use the value from system_settings
-- instead of a hardcoded 6-month interval.

-- 1. Update dead_stock_items analytics view
CREATE OR REPLACE VIEW dead_stock_items AS
SELECT
    p.id, p.name, p.sku, p.category,
    p.total_quantity AS quantity,
    p.last_movement_at,
    EXTRACT(DAY FROM NOW() - p.last_movement_at)::INTEGER AS days_inactive
FROM products p
WHERE p.total_quantity > 0
  AND p.last_movement_at < NOW() - (COALESCE((SELECT dead_stock_threshold_months FROM system_settings LIMIT 1), 6) || ' months')::INTERVAL
ORDER BY days_inactive DESC;

-- 2. Update get_dashboard_stats RPC function
-- Drop previous versions to avoid ambiguity errors
DROP FUNCTION IF EXISTS get_dashboard_stats();
DROP FUNCTION IF EXISTS get_dashboard_stats(UUID);

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
    v_threshold    INTEGER;
BEGIN
    -- Get dynamic threshold from settings (default to 6 if not set)
    SELECT COALESCE(dead_stock_threshold_months, 6) 
    INTO v_threshold 
    FROM system_settings 
    LIMIT 1;

    RETURN jsonb_build_object(
        'total_skus',            (SELECT COUNT(*) FROM products),
        'total_quantity',        (SELECT COALESCE(SUM(total_quantity),0) FROM products),
        'low_stock_count',       (SELECT COUNT(*) FROM products WHERE total_quantity <= min_stock),
        'dead_stock_count',      (SELECT COUNT(*) FROM products
                                  WHERE total_quantity > 0
                                    AND last_movement_at < NOW() - (v_threshold || ' months')::INTERVAL),
        'total_inventory_value', (SELECT COALESCE(SUM(total_quantity * base_price_wac),0) FROM products),
        'total_purchases',       (SELECT COALESCE(SUM(total_amount),0) FROM invoices),
        'total_profit',          (SELECT COALESCE(SUM(profit),0) FROM surgeries),
        'total_surgeries',       (SELECT COUNT(*) FROM surgeries),
        'unpaid_invoices_count', (SELECT COUNT(*) FROM invoices WHERE payment_status != 'paid')
    );
END;
$$;
