-- 1. FIFO Auto-Selection & Strict Traceability
-- Replaces the existing create_surgery_transaction function

CREATE OR REPLACE FUNCTION create_surgery_transaction(
    p_doctor_id           UUID,
    p_patient_id          TEXT,
    p_patient_name        TEXT,
    p_date                DATE,
    p_type                TEXT,
    p_total_base_value    NUMERIC,
    p_total_selling_value NUMERIC,
    p_profit              NUMERIC,
    p_notes               TEXT,
    p_items               JSONB,   -- [{product_id, item_name, quantity, base_price, selling_price, source_batch_id?}]
    p_created_by          UUID
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_surgery_id  UUID;
    v_item        JSONB;
    v_product_id  UUID;
    v_batch_id    UUID;
    v_req_qty     INTEGER;
    v_avail       INTEGER;
    v_actor_role  TEXT;
    
    -- For FIFO splitting
    v_rem_qty     INTEGER;
    v_take_qty    INTEGER;
    v_current_batch RECORD;
BEGIN
    v_actor_role := get_user_role(COALESCE(p_created_by, auth.uid()));
    IF v_actor_role NOT IN ('admin','doctor','storekeeper') THEN
        RAISE EXCEPTION 'Unauthorized: Role "%" cannot record surgeries.', v_actor_role;
    END IF;

    -- Basic insertion, profit and base values might differ slightly if batch costs vary. 
    -- The frontend passes totals based on average cost, but we'll accept them or we could recalculate dynamically.
    -- For now, let's keep the provided totals.
    INSERT INTO surgeries (
        doctor_id, patient_id, patient_name, date, type,
        total_base_value, total_selling_value, profit, notes, created_by
    ) VALUES (
        p_doctor_id, p_patient_id, p_patient_name, p_date, p_type,
        p_total_base_value, p_total_selling_value, p_profit, p_notes, COALESCE(p_created_by, auth.uid())
    )
    RETURNING id INTO v_surgery_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_req_qty    := (v_item->>'quantity')::INTEGER;
        v_batch_id   := NULLIF(v_item->>'source_batch_id','')::UUID;

        -- Global Stock sufficiency check
        SELECT total_quantity INTO v_avail FROM products WHERE id = v_product_id FOR UPDATE;
        IF v_avail < v_req_qty THEN
            RAISE EXCEPTION 'Insufficient stock for product %. Available: %, Requested: %',
                (SELECT name FROM products WHERE id = v_product_id), v_avail, v_req_qty;
        END IF;

        IF v_batch_id IS NULL THEN
            -- ** FIFO Auto-Selection Logic **
            v_rem_qty := v_req_qty;
            
            FOR v_current_batch IN
                SELECT id, quantity, unit_cost
                FROM product_batches
                WHERE product_id = v_product_id AND quantity > 0
                ORDER BY COALESCE(expiry_date, '9999-12-31'::DATE), received_date
            LOOP
                IF v_rem_qty <= 0 THEN
                    EXIT;
                END IF;

                v_take_qty := LEAST(v_rem_qty, v_current_batch.quantity);

                -- Deduct batch quantity
                UPDATE product_batches
                SET quantity = quantity - v_take_qty
                WHERE id = v_current_batch.id;

                -- Insert surgery item for this specific batch
                INSERT INTO surgery_items (
                    surgery_id, product_id, source_batch_id, item_name,
                    quantity, base_price, selling_price
                ) VALUES (
                    v_surgery_id, v_product_id, v_current_batch.id,
                    v_item->>'item_name',
                    v_take_qty,
                    v_current_batch.unit_cost, -- Actual unit cost per batch
                    (v_item->>'selling_price')::NUMERIC
                );

                -- Write transaction ledger
                INSERT INTO inventory_transactions (
                    product_id, product_name, batch_id, quantity,
                    transaction_type, reference_id, reference_type,
                    unit_cost_snapshot, selling_price_snapshot, created_by
                ) VALUES (
                    v_product_id,
                    v_item->>'item_name',
                    v_current_batch.id,
                    -v_take_qty,
                    'surgery', v_surgery_id, 'surgery',
                    v_current_batch.unit_cost,
                    (v_item->>'selling_price')::NUMERIC,
                    COALESCE(p_created_by, auth.uid())
                );

                v_rem_qty := v_rem_qty - v_take_qty;
            END LOOP;

            IF v_rem_qty > 0 THEN
                RAISE EXCEPTION 'Data inconsistency: Sum of batches is less than required quantity. Requested: %, Missing: %', v_req_qty, v_rem_qty;
            END IF;

        ELSE
            -- ** Manual Override Logic **
            -- The user explicitly selected a batch.
            SELECT quantity, unit_cost INTO v_current_batch
            FROM product_batches
            WHERE id = v_batch_id FOR UPDATE;
            
            IF v_current_batch.quantity < v_req_qty THEN
                RAISE EXCEPTION 'Selected batch does not have enough quantity. Requested: %, Available: %', v_req_qty, v_current_batch.quantity;
            END IF;

            UPDATE product_batches
            SET quantity = quantity - v_req_qty
            WHERE id = v_batch_id;

            INSERT INTO surgery_items (
                surgery_id, product_id, source_batch_id, item_name,
                quantity, base_price, selling_price
            ) VALUES (
                v_surgery_id, v_product_id, v_batch_id,
                v_item->>'item_name',
                v_req_qty,
                v_current_batch.unit_cost,
                (v_item->>'selling_price')::NUMERIC
            );

            INSERT INTO inventory_transactions (
                product_id, product_name, batch_id, quantity,
                transaction_type, reference_id, reference_type,
                unit_cost_snapshot, selling_price_snapshot, created_by
            ) VALUES (
                v_product_id,
                v_item->>'item_name',
                v_batch_id,
                -v_req_qty,
                'surgery', v_surgery_id, 'surgery',
                v_current_batch.unit_cost,
                (v_item->>'selling_price')::NUMERIC,
                COALESCE(p_created_by, auth.uid())
            );
        END IF;
    END LOOP;

    RETURN v_surgery_id;
END;
$$;
