-- Scissor Logic Migration
-- 1. Add traceability to product_batches if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'product_batches'
        AND column_name = 'source_batch_id'
    ) THEN
        ALTER TABLE product_batches ADD COLUMN source_batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Drop the old function if it exists to avoid parameter conflicts (optional but recommended)
DROP FUNCTION IF EXISTS transform_inventory_item(uuid, uuid, integer, uuid, text);

-- 3. Create the new scissor function
CREATE OR REPLACE FUNCTION execute_inventory_transformation(
    p_source_product_id UUID,
    p_source_batch_id   UUID,
    p_target_product_id UUID,
    p_source_quantity   INTEGER,
    p_target_quantity   INTEGER,
    p_notes             TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_source_batch_no   TEXT;
    v_source_cost       DECIMAL(10,2);
    v_source_current_q  INTEGER;
    v_target_cost_per_u DECIMAL(10,2);
    v_actor_role        TEXT;
    v_actor_id          UUID;
    v_new_batch_id      UUID;
    v_target_name       TEXT;
    v_source_name       TEXT;
BEGIN
    -- Verify role
    v_actor_id := auth.uid();
    -- get_user_role is assumed to be an existing function, but just in case, let's fetch from users table
    SELECT role INTO v_actor_role FROM users WHERE id = v_actor_id;
    IF v_actor_role NOT IN ('admin', 'storekeeper') THEN
        RAISE EXCEPTION 'Unauthorized: Role "%" cannot perform transformations.', v_actor_role;
    END IF;

    IF p_source_quantity <= 0 OR p_target_quantity <= 0 THEN
        RAISE EXCEPTION 'Source and Target quantities must be greater than zero.';
    END IF;

    -- Lock and get source batch
    SELECT batch_no, unit_cost, quantity INTO v_source_batch_no, v_source_cost, v_source_current_q
    FROM product_batches
    WHERE id = p_source_batch_id AND product_id = p_source_product_id
    FOR UPDATE;

    IF v_source_current_q IS NULL THEN
        RAISE EXCEPTION 'Source batch not found or does not belong to the source product.';
    END IF;

    IF v_source_current_q < p_source_quantity THEN
        RAISE EXCEPTION 'Insufficient stock in the source batch. Available: %, Requested: %', v_source_current_q, p_source_quantity;
    END IF;

    -- Get product names for logs
    SELECT name INTO v_source_name FROM products WHERE id = p_source_product_id;
    SELECT name INTO v_target_name FROM products WHERE id = p_target_product_id;

    -- Calculate the new unit cost for target items
    -- Cost split logic: Total value of source items / Total target pieces
    v_target_cost_per_u := (v_source_cost * p_source_quantity) / p_target_quantity;

    -- Deduct from source batch
    UPDATE product_batches 
    SET quantity = quantity - p_source_quantity 
    WHERE id = p_source_batch_id;

    -- Record outgoing in inventory_transactions for the Source Product
    INSERT INTO inventory_transactions (
        product_id, product_name, batch_id, quantity, transaction_type, 
        reference_type, unit_cost_snapshot, notes, created_by
    ) VALUES (
        p_source_product_id, v_source_name, p_source_batch_id, -p_source_quantity, 'transformation_out',
        'manual', v_source_cost, 'Transformation Source: ' || COALESCE(p_notes, ''), v_actor_id
    );

    -- Check if there's an existing target batch with the exactly same source_batch_id and cost to merge into (Traceability)
    SELECT id INTO v_new_batch_id
    FROM product_batches
    WHERE product_id = p_target_product_id
      AND source_batch_id = p_source_batch_id
      AND unit_cost = v_target_cost_per_u
      AND (expiry_date >= CURRENT_DATE OR expiry_date IS NULL)
    LIMIT 1 FOR UPDATE;

    IF v_new_batch_id IS NULL THEN
        -- Create a New Batch
        INSERT INTO product_batches (
            product_id, batch_no, quantity, unit_cost, received_date, notes, source_batch_id
        ) VALUES (
            p_target_product_id, v_source_batch_no || '-T', p_target_quantity, v_target_cost_per_u, CURRENT_DATE, 
            'Generated from Scissor Transformation. Source Batch: ' || v_source_batch_no, p_source_batch_id
        ) RETURNING id INTO v_new_batch_id;
    ELSE
        -- Update existing target batch
        UPDATE product_batches
        SET quantity = quantity + p_target_quantity
        WHERE id = v_new_batch_id;
    END IF;

    -- Record incoming in inventory_transactions for the Target Product
    INSERT INTO inventory_transactions (
        product_id, product_name, batch_id, quantity, transaction_type, 
        reference_type, unit_cost_snapshot, notes, created_by
    ) VALUES (
        p_target_product_id, v_target_name, v_new_batch_id, p_target_quantity, 'transformation_in',
        'manual', v_target_cost_per_u, 'Transformation Target: ' || COALESCE(p_notes, ''), v_actor_id
    );

    -- Log to inventory_transformations the whole event
    INSERT INTO inventory_transformations (
        source_product_id, target_product_id, source_batch_id, quantity, 
        current_source_cost, current_target_cost, notes, performed_by
    ) VALUES (
        p_source_product_id, p_target_product_id, p_source_batch_id, p_source_quantity,
        v_source_cost, v_target_cost_per_u, p_notes, v_actor_id
    );

    -- WAC will be automatically recalculated by the `fn_sync_product_cache` trigger on `product_batches`

    RETURN jsonb_build_object(
        'success', true,
        'source_deducted', p_source_quantity,
        'target_added', p_target_quantity,
        'target_batch_id', v_new_batch_id,
        'new_target_cost', v_target_cost_per_u
    );
END;
$$;
