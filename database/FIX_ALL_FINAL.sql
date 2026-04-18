-- FIX: Combined Surgery and Invoice Transactions
-- Run this entire script in the SQL Editor

CREATE OR REPLACE FUNCTION create_surgery_transaction(
    p_doctor_id UUID,
    p_patient_id TEXT,
    p_patient_name TEXT,
    p_date DATE,
    p_type TEXT,
    p_total_base_value NUMERIC,
    p_total_selling_value NUMERIC,
    p_profit NUMERIC,
    p_notes TEXT DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb,
    p_created_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_surgery_id UUID;
    v_item JSONB;
    v_user_role TEXT;
    v_current_user_id UUID;
    v_doctor_name TEXT;
BEGIN
    v_current_user_id := COALESCE(auth.uid(), p_created_by);

    IF v_current_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID is missing';
    END IF;

    v_user_role := get_user_role(v_current_user_id);

    IF v_user_role NOT IN ('admin', 'supervisor', 'doctor', 'storekeeper') THEN
         RAISE EXCEPTION 'Unauthorized: User role % does not have permission', v_user_role;
    END IF;
    
    INSERT INTO surgeries (doctor_id, patient_id, patient_name, date, type, total_base_value, total_selling_value, profit, notes, created_by)
    VALUES (p_doctor_id, p_patient_id, p_patient_name, p_date, p_type, p_total_base_value, p_total_selling_value, p_profit, p_notes, v_current_user_id)
    RETURNING id INTO v_surgery_id;

    SELECT name INTO v_doctor_name FROM doctors WHERE id = p_doctor_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO surgery_items (surgery_id, item_id, item_name, quantity, base_price, selling_price)
        VALUES (v_surgery_id, (v_item->>'itemId')::UUID, v_item->>'itemName', (v_item->>'quantity')::INTEGER, (v_item->>'basePrice')::NUMERIC, (v_item->>'sellingPrice')::NUMERIC);

        INSERT INTO inventory_transactions (item_id, item_name, quantity, base_price, selling_price, total_base_value, total_selling_value, date, type, surgery_id, doctor_id, doctor_name, patient_name, notes, created_by, is_locked)
        VALUES ((v_item->>'itemId')::UUID, v_item->>'itemName', (v_item->>'quantity')::INTEGER, (v_item->>'basePrice')::NUMERIC, (v_item->>'sellingPrice')::NUMERIC, ((v_item->>'basePrice')::NUMERIC * (v_item->>'quantity')::INTEGER), ((v_item->>'sellingPrice')::NUMERIC * (v_item->>'quantity')::INTEGER), p_date, 'surgery', v_surgery_id, p_doctor_id, v_doctor_name, p_patient_name, p_notes, v_current_user_id, false);
    END LOOP;

    RETURN v_surgery_id;
END;
$$;

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
AS $$
DECLARE
    v_invoice_id UUID;
    v_item JSONB;
    v_user_role TEXT;
    v_current_user_id UUID;
    v_new_qty INTEGER;
    v_item_cost NUMERIC;
    v_weighted_avg_cost NUMERIC;
    v_current_qty INTEGER;
    v_current_cost NUMERIC;
BEGIN
    v_current_user_id := COALESCE(auth.uid(), p_created_by);

    IF v_current_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID is missing';
    END IF;

    v_user_role := get_user_role(v_current_user_id);
    
    IF v_user_role NOT IN ('admin', 'supervisor', 'storekeeper') THEN
        RAISE EXCEPTION 'Unauthorized: User role % does not have permission', v_user_role;
    END IF;

    INSERT INTO invoices (supplier_id, invoice_date, vendor_invoice_number, notes, total_amount, created_by, payment_type)
    VALUES (p_supplier_id, p_invoice_date, p_vendor_invoice_number, p_notes, p_total_amount, v_current_user_id, p_payment_type)
    RETURNING id INTO v_invoice_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_new_qty := (v_item->>'quantity')::INTEGER;
        v_item_cost := (v_item->>'unit_cost')::NUMERIC;
        
        INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_cost, batch_no, expiry_date)
        VALUES (v_invoice_id, (v_item->>'product_id')::UUID, v_new_qty, v_item_cost, v_item->>'batch_no', (v_item->>'expiry_date')::DATE);

        SELECT quantity, base_price INTO v_current_qty, v_current_cost FROM products WHERE id = (v_item->>'product_id')::UUID;
        
        IF v_current_qty IS NULL THEN v_current_qty := 0; END IF;
        IF v_current_cost IS NULL THEN v_current_cost := 0; END IF;

        IF (v_current_qty + v_new_qty) > 0 THEN
            v_weighted_avg_cost := ((v_current_qty * v_current_cost) + (v_new_qty * v_item_cost)) / (v_current_qty + v_new_qty);
        ELSE
            v_weighted_avg_cost := v_item_cost;
        END IF;

        UPDATE products 
        SET quantity = quantity + v_new_qty, base_price = v_weighted_avg_cost, batch_no = v_item->>'batch_no', expiry_date = (v_item->>'expiry_date')::DATE, last_movement_date = NOW(), updated_at = NOW()
        WHERE id = (v_item->>'product_id')::UUID;
    END LOOP;

    RETURN v_invoice_id;
END;
$$;
