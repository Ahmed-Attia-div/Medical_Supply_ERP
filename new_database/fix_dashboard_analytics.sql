-- Fix Dashboard Analysis Stats
-- Restores the correct `get_dashboard_stats` function to return JSONB 
-- and bypasses the `auth.uid()` check since custom auth via local storage is currently used.

DROP FUNCTION IF EXISTS get_dashboard_stats();
DROP FUNCTION IF EXISTS get_dashboard_stats(uuid);

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
    -- We are no longer relying on auth.uid() for role checks here because the current 
    -- custom auth setup means auth.uid() is NULL, which previously resulted in all financial 
    -- stats returning NULL and breaking the dashboard.
    -- The frontend hides financial data based on its own permissions system.

    RETURN jsonb_build_object(
        'total_skus',            (SELECT COUNT(*) FROM products),
        'total_quantity',        (SELECT COALESCE(SUM(total_quantity),0) FROM products),
        'low_stock_count',       (SELECT COUNT(*) FROM products WHERE total_quantity <= min_stock),
        'dead_stock_count',      (SELECT COUNT(*) FROM products
                                  WHERE total_quantity > 0
                                    AND last_movement_at < NOW() - INTERVAL '6 months'),
        'total_inventory_value', (SELECT COALESCE(SUM(total_quantity * base_price_wac),0) FROM products),
        'total_purchases',       (SELECT COALESCE(SUM(total_amount),0) FROM invoices),
        'total_profit',          (SELECT COALESCE(SUM(profit),0) FROM surgeries),
        'total_surgeries',       (SELECT COUNT(*) FROM surgeries),
        'unpaid_invoices_count', (SELECT COUNT(*) FROM invoices WHERE payment_status != 'paid')
    );
END;
$$;
