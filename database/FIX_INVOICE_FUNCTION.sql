CREATE OR REPLACE FUNCTION create_invoice_transaction(
    p_supplier_id UUID,
    p_invoice_date DATE,
    p_vendor_invoice_number TEXT,
    p_notes TEXT,
    p_total_amount NUMERIC,
    p_items JSONB,
    p_created_by UUID,
    p_payment_type TEXT DEFAULT 'cash'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS '
DECLARE
    v_invoice_id UUID;
    v_item JSONB;
    v_user_role TEXT;
    v_current_user_id UUID;
    v_current_qty INTEGER;
    v_current_cost NUMERIC;
    v_new_qty INTEGER;
    v_item_cost NUMERIC;
    v_weighted_avg_cost NUMERIC;
BEGIN
    v_current_user_id := COALESCE(auth.uid(), p_created_by);

    IF v_current_user_id IS NULL THEN
        RAISE EXCEPTION ''User ID is missing'';
    END IF;

    v_user_role := get_user_role(v_current_user_id);
    
    IF v_user_role NOT IN (''admin'', ''supervisor'', ''storekeeper'') THEN
        RAISE EXCEPTION ''Unauthorized: User role % does not have permission'', v_user_role;
    END IF;

    INSERT INTO invoices (supplier_id, invoice_date, vendor_invoice_number, notes, total_amount, created_by, payment_type)
    VALUES (p_supplier_id, p_invoice_date, p_vendor_invoice_number, p_notes, p_total_amount, v_current_user_id, p_payment_type)
    RETURNING id INTO v_invoice_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_new_qty := (v_item->>''quantity'')::INTEGER;
        v_item_cost := (v_item->>''unit_cost'')::NUMERIC;
        
        INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_cost, batch_no, expiry_date)
        VALUES (v_invoice_id, (v_item->>''product_id'')::UUID, v_new_qty, v_item_cost, v_item->>''batch_no'', (v_item->>''expiry_date'')::DATE);

        SELECT quantity, base_price INTO v_current_qty, v_current_cost 
        FROM products WHERE id = (v_item->>''product_id'')::UUID;
        
        IF v_current_qty IS NULL THEN v_current_qty := 0; END IF;
        IF v_current_cost IS NULL THEN v_current_cost := 0; END IF;

        IF (v_current_qty + v_new_qty) > 0 THEN
            v_weighted_avg_cost := ((v_current_qty * v_current_cost) + (v_new_qty * v_item_cost)) / (v_current_qty + v_new_qty);
        ELSE
            v_weighted_avg_cost := v_item_cost;
        END IF;

        UPDATE products 
        SET quantity = quantity + v_new_qty, base_price = v_weighted_avg_cost, batch_no = v_item->>''batch_no'', expiry_date = (v_item->>''expiry_date'')::DATE, last_movement_date = NOW(), updated_at = NOW()
        WHERE id = (v_item->>''product_id'')::UUID;
    END LOOP;

    RETURN v_invoice_id;
END;
';
