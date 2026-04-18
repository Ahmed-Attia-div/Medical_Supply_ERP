-- Fix to explicitly capture created_by from the frontend using the legacy argument
-- Since custom Auth with disabled RLS does not set auth.uid() automatically.

CREATE OR REPLACE FUNCTION create_invoice_transaction(
    p_supplier_id             UUID,
    p_invoice_date            DATE,
    p_vendor_invoice_number   TEXT,
    p_notes                   TEXT,
    p_total_amount            NUMERIC,
    p_items                   JSONB,    -- [{product_id, quantity, unit_cost, batch_no, expiry_date}]
    p_created_by              UUID,     -- overridden by auth.uid() only if null
    p_payment_type            TEXT DEFAULT 'cash',
    p_amount_paid             NUMERIC DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_invoice_id  UUID;
    v_item_id     UUID;
    v_item        JSONB;
    v_qty         INTEGER;
    v_cost        NUMERIC;
    v_batch_id    UUID;
    v_actor_role  TEXT;
BEGIN
    v_actor_role := get_user_role(COALESCE(p_created_by, auth.uid()));
    IF v_actor_role NOT IN ('admin','storekeeper') THEN
        RAISE EXCEPTION 'Unauthorized: Role "%" cannot create invoices.', v_actor_role;
    END IF;

    INSERT INTO invoices (
        supplier_id, invoice_date, vendor_invoice_number,
        notes, total_amount, payment_type,
        amount_paid, created_by
    ) VALUES (
        p_supplier_id, p_invoice_date, p_vendor_invoice_number,
        p_notes, p_total_amount, p_payment_type,
        COALESCE(p_amount_paid, CASE WHEN p_payment_type='cash' THEN p_total_amount ELSE 0 END),
        COALESCE(p_created_by, auth.uid())
    )
    RETURNING id INTO v_invoice_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty    := (v_item->>'quantity')::INTEGER;
        v_cost   := (v_item->>'unit_cost')::NUMERIC;
        v_item_id := (v_item->>'product_id')::UUID;

        -- Create invoice line
        INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_cost, batch_no, expiry_date)
        VALUES (
            v_invoice_id, v_item_id, v_qty, v_cost,
            v_item->>'batch_no',
            NULLIF(v_item->>'expiry_date','')::DATE
        )
        RETURNING id INTO v_item_id;

        -- Create batch record (trigger will recompute WAC on products)
        INSERT INTO product_batches (
            product_id, batch_no, quantity, unit_cost,
            received_date, expiry_date, invoice_item_id
        ) VALUES (
            (v_item->>'product_id')::UUID,
            v_item->>'batch_no',
            v_qty, v_cost,
            p_invoice_date,
            NULLIF(v_item->>'expiry_date','')::DATE,
            v_item_id
        )
        RETURNING id INTO v_batch_id;

        -- Write to ledger
        INSERT INTO inventory_transactions (
            product_id, product_name, batch_id, quantity,
            transaction_type, reference_id, reference_type,
            unit_cost_snapshot, created_by
        ) VALUES (
            (v_item->>'product_id')::UUID,
            (SELECT name FROM products WHERE id = (v_item->>'product_id')::UUID),
            v_batch_id, v_qty,
            'purchase', v_invoice_id, 'invoice',
            v_cost, COALESCE(p_created_by, auth.uid())
        );
    END LOOP;

    RETURN v_invoice_id;
END;
$$;


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
    p_created_by          UUID     -- overridden by auth.uid() only if null
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_surgery_id  UUID;
    v_item        JSONB;
    v_product_id  UUID;
    v_batch_id    UUID;
    v_qty         INTEGER;
    v_avail       INTEGER;
    v_actor_role  TEXT;
BEGIN
    v_actor_role := get_user_role(COALESCE(p_created_by, auth.uid()));
    IF v_actor_role NOT IN ('admin','doctor','storekeeper') THEN
        RAISE EXCEPTION 'Unauthorized: Role "%" cannot record surgeries.', v_actor_role;
    END IF;

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
        v_qty        := (v_item->>'quantity')::INTEGER;
        v_batch_id   := NULLIF(v_item->>'source_batch_id','')::UUID;

        -- Stock sufficiency check
        SELECT total_quantity INTO v_avail FROM products WHERE id = v_product_id FOR UPDATE;
        IF v_avail < v_qty THEN
            RAISE EXCEPTION 'Insufficient stock for product %. Available: %, Requested: %',
                (SELECT name FROM products WHERE id = v_product_id), v_avail, v_qty;
        END IF;

        -- Deduct from specific batch if provided, else deduct from oldest (FEFO)
        IF v_batch_id IS NULL THEN
            SELECT id INTO v_batch_id
            FROM product_batches
            WHERE product_id = v_product_id AND quantity > 0
            ORDER BY COALESCE(expiry_date, '9999-12-31'), received_date
            LIMIT 1;
        END IF;

        -- Deduct batch quantity (triggers fn_sync_product_cache on products)
        UPDATE product_batches
        SET quantity = quantity - v_qty
        WHERE id = v_batch_id;

        -- Insert surgery item
        INSERT INTO surgery_items (
            surgery_id, product_id, source_batch_id, item_name,
            quantity, base_price, selling_price
        ) VALUES (
            v_surgery_id, v_product_id, v_batch_id,
            v_item->>'item_name',
            v_qty,
            (v_item->>'base_price')::NUMERIC,
            (v_item->>'selling_price')::NUMERIC
        );

        -- Write to ledger
        INSERT INTO inventory_transactions (
            product_id, product_name, batch_id, quantity,
            transaction_type, reference_id, reference_type,
            unit_cost_snapshot, selling_price_snapshot, created_by
        ) VALUES (
            v_product_id,
            v_item->>'item_name',
            v_batch_id,
            -v_qty,   -- negative = stock OUT
            'surgery', v_surgery_id, 'surgery',
            (v_item->>'base_price')::NUMERIC,
            (v_item->>'selling_price')::NUMERIC,
            COALESCE(p_created_by, auth.uid())
        );
    END LOOP;

    RETURN v_surgery_id;
END;
$$;
