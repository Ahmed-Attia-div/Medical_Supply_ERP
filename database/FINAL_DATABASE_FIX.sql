-- ============================================
-- FINAL DATABASE FIXES - PRODUCTION READY
-- Includes: WAC Logic, Secure RLS, User Management, View Security, and Atomic Surgery Transaction
-- ============================================

-- 0. Enable Encryption Extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Helper function to get roles
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN (SELECT role FROM users WHERE id = user_id LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fixed Invoice Creation with Weighted Average Cost (WAC) - HARDENED
CREATE OR REPLACE FUNCTION create_invoice_transaction(
    p_supplier_id UUID,
    p_invoice_date DATE,
    p_vendor_invoice_number TEXT,
    p_notes TEXT,
    p_total_amount NUMERIC,
    p_items JSONB,
    p_created_by UUID, -- Legacy parameter
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
    v_current_qty INTEGER;
    v_current_cost NUMERIC;
    v_new_qty INTEGER;
    v_item_cost NUMERIC;
    v_weighted_avg_cost NUMERIC;
BEGIN
    -- Security Check: Get actual authenticated user
    v_current_user_id := auth.uid();
    v_user_role := get_user_role(v_current_user_id);
    
    -- Verify role
    IF v_user_role NOT IN ('admin', 'supervisor', 'storekeeper') THEN
        RAISE EXCEPTION 'Unauthorized: User role "%" does not have permission', v_user_role;
    END IF;

    -- Create Invoice
    INSERT INTO invoices (supplier_id, invoice_date, vendor_invoice_number, notes, total_amount, created_by, payment_type)
    VALUES (p_supplier_id, p_invoice_date, p_vendor_invoice_number, p_notes, p_total_amount, v_current_user_id, p_payment_type)
    RETURNING id INTO v_invoice_id;

    -- Process Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_new_qty := (v_item->>'quantity')::INTEGER;
        v_item_cost := (v_item->>'unit_cost')::NUMERIC;
        
        INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_cost, batch_no, expiry_date)
        VALUES (v_invoice_id, (v_item->>'product_id')::UUID, v_new_qty, v_item_cost, v_item->>'batch_no', (v_item->>'expiry_date')::DATE);

        -- Get current product state for WAC calculation
        SELECT quantity, base_price INTO v_current_qty, v_current_cost 
        FROM products 
        WHERE id = (v_item->>'product_id')::UUID;
        
        -- Handle nulls
        IF v_current_qty IS NULL THEN v_current_qty := 0; END IF;
        IF v_current_cost IS NULL THEN v_current_cost := 0; END IF;

        -- Weighted Average Cost Formula
        IF (v_current_qty + v_new_qty) > 0 THEN
            v_weighted_avg_cost := ((v_current_qty * v_current_cost) + (v_new_qty * v_item_cost)) / (v_current_qty + v_new_qty);
        ELSE
            v_weighted_avg_cost := v_item_cost;
        END IF;

        -- Update Product
        UPDATE products 
        SET 
            quantity = quantity + v_new_qty, 
            base_price = v_weighted_avg_cost, 
            batch_no = v_item->>'batch_no', 
            expiry_date = (v_item->>'expiry_date')::DATE, 
            last_movement_date = NOW(), 
            updated_at = NOW()
        WHERE id = (v_item->>'product_id')::UUID;
    END LOOP;

    RETURN v_invoice_id;
END;
$$;

-- 3. Atomic Surgery Transaction - NEW & ROBUST
CREATE OR REPLACE FUNCTION create_surgery_transaction(
    p_doctor_id UUID,
    p_patient_id TEXT,
    p_patient_name TEXT,
    p_date DATE,
    p_type TEXT,
    p_total_base_value NUMERIC,
    p_total_selling_value NUMERIC,
    p_profit NUMERIC,
    p_notes TEXT,
    p_items JSONB,
    p_created_by UUID -- Legacy
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
    -- Security Check
    v_current_user_id := auth.uid();
    v_user_role := get_user_role(v_current_user_id);

    IF v_user_role NOT IN ('admin', 'supervisor', 'doctor', 'storekeeper') THEN
         RAISE EXCEPTION 'Unauthorized: User role "%" does not have permission', v_user_role;
    END IF;
    
    -- Check permissions: Storekeeper cannot perform surgeries? 
    -- Assuming storekeeper can record CONSUMABLES usage which is type of surgery/usage.
    
    -- Create Surgery
    INSERT INTO surgeries (doctor_id, patient_id, patient_name, date, type, total_base_value, total_selling_value, profit, notes, created_by)
    VALUES (p_doctor_id, p_patient_id, p_patient_name, p_date, p_type, p_total_base_value, p_total_selling_value, p_profit, p_notes, v_current_user_id)
    RETURNING id INTO v_surgery_id;

    -- Get Doctor Name for Transaction Log
    SELECT name INTO v_doctor_name FROM doctors WHERE id = p_doctor_id;

    -- Process Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Insert Surgery Item
        INSERT INTO surgery_items (surgery_id, item_id, item_name, quantity, base_price, selling_price)
        VALUES (
            v_surgery_id, 
            (v_item->>'itemId')::UUID, 
            v_item->>'itemName', 
            (v_item->>'quantity')::INTEGER, 
            (v_item->>'basePrice')::NUMERIC, 
            (v_item->>'sellingPrice')::NUMERIC
        );

        -- Insert Inventory Transaction (This triggers stock deduction via existing trigger)
        INSERT INTO inventory_transactions (
            item_id, item_name, quantity, 
            base_price, selling_price, 
            total_base_value, total_selling_value, 
            date, type, surgery_id, 
            doctor_id, doctor_name, patient_name, 
            notes, created_by, is_locked
        ) VALUES (
            (v_item->>'itemId')::UUID, 
            v_item->>'itemName', 
            (v_item->>'quantity')::INTEGER, 
            (v_item->>'basePrice')::NUMERIC, 
            (v_item->>'sellingPrice')::NUMERIC,
            ((v_item->>'basePrice')::NUMERIC * (v_item->>'quantity')::INTEGER),
            ((v_item->>'sellingPrice')::NUMERIC * (v_item->>'quantity')::INTEGER),
            p_date, 
            'surgery', 
            v_surgery_id, 
            p_doctor_id, v_doctor_name, p_patient_name, 
            p_notes, v_current_user_id, false
        );
    END LOOP;

    RETURN v_surgery_id;
END;
$$;

-- 4. Secure RLS Policies
DROP POLICY IF EXISTS "products_select_authenticated" ON products;
DROP POLICY IF EXISTS "products_insert_authorized" ON products;
DROP POLICY IF EXISTS "products_update_authorized" ON products;
DROP POLICY IF EXISTS "products_delete_admin_only" ON products;

CREATE POLICY "products_select_authenticated" ON products FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "products_insert_authorized" ON products FOR INSERT WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'supervisor', 'storekeeper'));
CREATE POLICY "products_update_authorized" ON products FOR UPDATE USING (get_user_role(auth.uid()) IN ('admin', 'supervisor', 'storekeeper'));
CREATE POLICY "products_delete_admin_only" ON products FOR DELETE USING (get_user_role(auth.uid()) = 'admin');

-- 5. Prevent Negative Stock Trigger
CREATE OR REPLACE FUNCTION check_stock_level()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quantity < 0 THEN
        RAISE EXCEPTION '❌ عملية مرفوضة: لا يوجد رصيد كافي للصنف (%). الرصيد الحالي: %', (SELECT name FROM products WHERE id = NEW.id), OLD.quantity;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_positive_stock ON products;
CREATE TRIGGER ensure_positive_stock
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION check_stock_level();

-- 6. Secure User Management Functions
CREATE OR REPLACE FUNCTION create_new_user(
    p_email TEXT,
    p_password TEXT,
    p_name TEXT,
    p_role TEXT,
    p_phone TEXT DEFAULT NULL,
    p_created_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_creator_role TEXT;
BEGIN
    IF auth.uid() IS NOT NULL THEN
        v_creator_role := get_user_role(auth.uid());
        IF v_creator_role != 'admin' THEN
             RAISE EXCEPTION 'Unauthorized: Only admins can create users.';
        END IF;
    END IF;

    INSERT INTO users (email, password_hash, name, role, phone, created_by, status)
    VALUES (
        p_email, 
        crypt(p_password, gen_salt('bf')), 
        p_name, 
        p_role, 
        p_phone, 
        auth.uid(), 
        'active'
    )
    RETURNING id INTO v_user_id;

    RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_user_password_secure(
    p_user_id UUID,
    p_new_password TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF auth.uid() != p_user_id AND get_user_role(auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    UPDATE users 
    SET password_hash = crypt(p_new_password, gen_salt('bf'))
    WHERE id = p_user_id;
END;
$$;

-- 7. Secure Dashboard View
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM products) as total_skus,
    (SELECT COUNT(*) FROM products WHERE quantity <= min_stock) as low_stock_count,
    (SELECT COUNT(*) FROM products WHERE last_movement_date < NOW() - INTERVAL '6 months') as dead_stock_count,
    (
        CASE WHEN get_user_role(auth.uid()) IN ('admin', 'supervisor') THEN
            (SELECT COALESCE(SUM(quantity * base_price), 0) FROM products)
        ELSE 0 END
    ) as total_inventory_value,
    (
        CASE WHEN get_user_role(auth.uid()) IN ('admin', 'supervisor') THEN
            (SELECT COALESCE(SUM(total_amount), 0) FROM invoices)
        ELSE 0 END
    ) as total_purchases,
    (
        CASE WHEN get_user_role(auth.uid()) IN ('admin', 'supervisor', 'partner') THEN
             (SELECT COALESCE(SUM(profit), 0) FROM surgeries)
        ELSE 0 END
    ) as total_profit,
    (SELECT COUNT(*) FROM surgeries) as total_surgeries;
