CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_role TEXT;
    v_total_skus INTEGER;
    v_low_stock_count INTEGER;
    v_dead_stock_count INTEGER;
    v_total_inventory_value NUMERIC;
    v_total_purchases NUMERIC;
    v_total_profit NUMERIC;
    v_total_surgeries INTEGER;
BEGIN
    -- Get Current User Role
    v_user_role := get_user_role(auth.uid());

    -- Basic Counts (Visible to all authorized users)
    SELECT COUNT(*) INTO v_total_skus FROM products;
    SELECT COUNT(*) INTO v_low_stock_count FROM products WHERE quantity <= min_stock;
    SELECT COUNT(*) INTO v_dead_stock_count FROM products WHERE last_movement_date < NOW() - INTERVAL '6 months';
    SELECT COUNT(*) INTO v_total_surgeries FROM surgeries;

    -- Financials (Restricted)
    IF v_user_role IN ('admin', 'supervisor') THEN
        SELECT COALESCE(SUM(quantity * base_price), 0) INTO v_total_inventory_value FROM products;
        
        -- Use the NEW invoices table for total purchases
        SELECT COALESCE(SUM(total_amount), 0) INTO v_total_purchases FROM invoices;
    ELSE
        v_total_inventory_value := 0;
        v_total_purchases := 0;
    END IF;

    IF v_user_role IN ('admin', 'supervisor', 'partner') THEN
        SELECT COALESCE(SUM(profit), 0) INTO v_total_profit FROM surgeries;
    ELSE
        v_total_profit := 0;
    END IF;

    -- Return JSON
    RETURN jsonb_build_object(
        'total_skus', v_total_skus,
        'low_stock_count', v_low_stock_count,
        'dead_stock_count', v_dead_stock_count,
        'total_inventory_value', v_total_inventory_value,
        'total_purchases', v_total_purchases,
        'total_profit', v_total_profit,
        'total_surgeries', v_total_surgeries
    );
END;
$$;
