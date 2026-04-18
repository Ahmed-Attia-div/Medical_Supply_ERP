-- 1) Create or verify a table for WAC Logs
CREATE TABLE IF NOT EXISTS wac_logs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    old_wac        DECIMAL(10,2) NOT NULL DEFAULT 0,
    new_wac        DECIMAL(10,2) NOT NULL DEFAULT 0,
    trigger_type   TEXT NOT NULL,
    reference_id   UUID, 
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast queries on wac logs
CREATE INDEX IF NOT EXISTS idx_wac_logs_product_id ON wac_logs(product_id);

-- 2) Update the product sync trigger to record the log and use the exact correct logic
CREATE OR REPLACE FUNCTION fn_sync_product_cache()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_product_id      UUID;
    v_total_qty       INTEGER;
    v_total_value     DECIMAL(10,2);
    v_new_wac         DECIMAL(10,2);
    v_old_wac         DECIMAL(10,2);
BEGIN
    -- Determine which product to recompute
    IF TG_OP = 'DELETE' THEN
        v_product_id := OLD.product_id;
    ELSE
        v_product_id := NEW.product_id;
    END IF;

    -- Get old WAC
    SELECT base_price_wac INTO v_old_wac FROM products WHERE id = v_product_id;

    -- Calculate Totals
    SELECT COALESCE(SUM(quantity), 0),
           COALESCE(SUM(quantity * unit_cost), 0)
    INTO v_total_qty, v_total_value
    FROM product_batches
    WHERE product_id = v_product_id;

    -- Compute NEW WAC
    IF v_total_qty > 0 THEN
        v_new_wac := v_total_value / v_total_qty;
    ELSE
        v_new_wac := 0;
    END IF;

    -- Update products table
    UPDATE products
    SET total_quantity   = v_total_qty,
        base_price_wac   = v_new_wac,
        last_movement_at = NOW(),
        updated_at       = NOW()
    WHERE id = v_product_id;

    -- Insert into WAC Log if there is a change
    IF COALESCE(v_old_wac, 0) IS DISTINCT FROM v_new_wac THEN
        INSERT INTO wac_logs (product_id, old_wac, new_wac, trigger_type, reference_id)
        VALUES (
            v_product_id,
            COALESCE(v_old_wac, 0),
            v_new_wac,
            TG_OP,
            COALESCE(NEW.id, OLD.id)
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;
