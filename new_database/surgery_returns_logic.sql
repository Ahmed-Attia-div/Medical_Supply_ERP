-- Migration Script to implement Surgery Returns via Triggers

-- 1. Ensure columns exist (They should already exist in v2 schema, but safe to verify)
ALTER TABLE surgery_items
ADD COLUMN IF NOT EXISTS returned_quantity INTEGER NOT NULL DEFAULT 0;

ALTER TABLE surgery_items
DROP CONSTRAINT IF EXISTS chk_return_lte_qty;

ALTER TABLE surgery_items
ADD CONSTRAINT chk_return_lte_qty CHECK (returned_quantity <= quantity AND returned_quantity >= 0);

-- 2. Create the Trigger Function
CREATE OR REPLACE FUNCTION fn_surgery_item_return_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_diff_qty INTEGER;
    v_surgery_base_val NUMERIC;
    v_surgery_selling_val NUMERIC;
BEGIN
    -- Only act if returned_quantity has actually changed
    IF NEW.returned_quantity IS DISTINCT FROM OLD.returned_quantity THEN
        v_diff_qty := NEW.returned_quantity - OLD.returned_quantity;
        
        IF v_diff_qty <> 0 THEN
            
            -- 1. Increment/Decrement specific batch
            IF NEW.source_batch_id IS NOT NULL THEN
                UPDATE product_batches
                SET quantity = quantity + v_diff_qty
                WHERE id = NEW.source_batch_id;
            END IF;
            -- NOTE: The 'trg_sync_product_cache' trigger on product_batches handles 
            -- dynamically recalculating total_quantity and base_price_wac on the products table.

            -- 2. Log Transaction (only if positive return, or negative if adjusting)
            INSERT INTO inventory_transactions (
                product_id, product_name, batch_id, quantity,
                transaction_type, reference_id, reference_type,
                unit_cost_snapshot, selling_price_snapshot, notes, created_by
            ) VALUES (
                NEW.product_id, NEW.item_name, NEW.source_batch_id, 
                v_diff_qty,   -- positive means returned to stock
                'surgery_return', NEW.surgery_id, 'surgery',
                NEW.base_price, NEW.selling_price, NEW.return_notes, 
                COALESCE(auth.uid(), (SELECT created_by FROM surgeries WHERE id = NEW.surgery_id))
            );
            
            -- 3. Recalculate financial totals for the surgery dynamically based on Net Used Quantity
            SELECT 
                COALESCE(SUM((quantity - returned_quantity) * base_price), 0),
                COALESCE(SUM((quantity - returned_quantity) * selling_price), 0)
            INTO v_surgery_base_val, v_surgery_selling_val
            FROM surgery_items
            WHERE surgery_id = NEW.surgery_id;

            UPDATE surgeries
            SET 
                total_base_value    = v_surgery_base_val,
                total_selling_value = v_surgery_selling_val,
                profit              = v_surgery_selling_val - v_surgery_base_val
            WHERE id = NEW.surgery_id;

        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Attach the trigger to surgery_items
DROP TRIGGER IF EXISTS trg_surgery_item_returns ON surgery_items;

CREATE TRIGGER trg_surgery_item_returns
AFTER UPDATE OF returned_quantity ON surgery_items
FOR EACH ROW EXECUTE FUNCTION fn_surgery_item_return_trigger();


-- 4. Rewrite process_surgery_return RPC to JUST update the returned quantity
-- so it delegates the complex DB logic to our new trigger.
CREATE OR REPLACE FUNCTION process_surgery_return(
    p_surgery_item_id  UUID,
    p_return_quantity  INTEGER,
    p_return_notes     TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_item          RECORD;
    v_actor_role    TEXT;
BEGIN
    v_actor_role := get_user_role(auth.uid());
    IF v_actor_role NOT IN ('admin','storekeeper') THEN
         RAISE EXCEPTION 'Unauthorized: Role "%" cannot process returns.', v_actor_role;
    END IF;

    SELECT si.*
    INTO v_item
    FROM surgery_items si
    WHERE si.id = p_surgery_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Surgery item not found: %', p_surgery_item_id;
    END IF;

    IF (v_item.returned_quantity + p_return_quantity) > v_item.quantity THEN
        RAISE EXCEPTION 'Return quantity (%) exceeds original quantity (%). Already returned: %.',
            p_return_quantity, v_item.quantity, v_item.returned_quantity;
    END IF;

    -- Update surgery item. This will fire our newly attached trg_surgery_item_returns.
    UPDATE surgery_items
    SET returned_quantity = returned_quantity + p_return_quantity,
        returned_at       = NOW(),
        return_notes      = COALESCE(p_return_notes, return_notes)
    WHERE id = p_surgery_item_id;

END;
$$;
