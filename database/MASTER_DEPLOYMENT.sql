-- ============================================
-- WATHQQ MEDICAL ERP - MASTER DEPLOYMENT SCRIPT
-- Version: 1.1.0 (Production Ready - Atomic Transactions & Hardened Security)
-- Date: 2026-02-10
-- ============================================
-- This script applies ALL database changes.
-- It combines the schema definitions with the final security and logic fixes.
-- ============================================

-- ============================================
-- SECTION 1: PRE-REQUISITES
-- ============================================
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- SECTION 2: TABLES DEFINITIONS
-- ============================================

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    hospital TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('screws', 'plates', 'rods', 'wires', 'nails', 'instruments', 'consumables')),
    material TEXT CHECK (material IN ('titanium', 'stainless')),
    diameter TEXT,
    length TEXT,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    min_stock INTEGER NOT NULL DEFAULT 10 CHECK (min_stock >= 0),
    base_price DECIMAL(10, 2) NOT NULL CHECK (base_price >= 0),
    selling_price DECIMAL(10, 2) NOT NULL CHECK (selling_price >= 0),
    last_movement_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT -- Can be null or legacy text
);

CREATE TABLE IF NOT EXISTS purchase_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- (This table is being replaced/augmented by 'invoices' table in newer logic, 
    -- but kept here if legacy code relies on it. 
    -- The new logic uses 'invoices' and 'invoice_items' tables below)
    supplier_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- The NEW Architecture Tables
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    invoice_date DATE DEFAULT CURRENT_DATE,
    vendor_invoice_number TEXT,
    notes TEXT,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    payment_type TEXT DEFAULT 'cash',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    unit_cost DECIMAL(10, 2) NOT NULL,
    batch_no TEXT,
    expiry_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS surgeries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    patient_id TEXT,
    patient_name TEXT,
    date DATE DEFAULT CURRENT_DATE,
    type TEXT,
    total_base_value DECIMAL(10, 2) DEFAULT 0,
    total_selling_value DECIMAL(10, 2) DEFAULT 0,
    profit DECIMAL(10, 2) DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS surgery_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    surgery_id UUID NOT NULL REFERENCES surgeries(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    item_name TEXT,
    quantity INTEGER NOT NULL,
    base_price DECIMAL(10, 2) NOT NULL,
    selling_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    item_name TEXT,
    quantity INTEGER NOT NULL,
    base_price DECIMAL(10, 2),
    selling_price DECIMAL(10, 2),
    total_base_value DECIMAL(10, 2),
    total_selling_value DECIMAL(10, 2),
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type TEXT NOT NULL,
    surgery_id UUID REFERENCES surgeries(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id),
    doctor_name TEXT,
    patient_name TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_transformations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_item_id UUID REFERENCES products(id),
    target_item_id UUID REFERENCES products(id),
    quantity INTEGER,
    cost_difference DECIMAL(10, 2),
    performed_by UUID REFERENCES users(id),
    current_source_cost DECIMAL(10, 2),
    current_target_cost DECIMAL(10, 2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dead_stock_threshold_months INTEGER DEFAULT 6,
    low_stock_alert_enabled BOOLEAN DEFAULT TRUE,
    margin_warning_enabled BOOLEAN DEFAULT TRUE,
    new_surgery_alert_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert Default Settings
INSERT INTO system_settings (low_stock_alert_enabled) 
SELECT true WHERE NOT EXISTS (SELECT 1 FROM system_settings);

-- ============================================
-- SECTION 3: HELPER FUNCTIONS & USER MANAGEMENT
-- ============================================

-- Helper: Get User Role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN (SELECT role FROM users WHERE id = user_id LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Secure User Creation
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

-- Secure Password Update
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

-- ============================================
-- SECTION 4: BUSINESS LOGIC (ATOMIC TRANSACTIONS)
-- ============================================

-- 1. Create Invoice Transaction (WAC)
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
    v_current_qty INTEGER;
    v_current_cost NUMERIC;
    v_new_qty INTEGER;
    v_item_cost NUMERIC;
    v_weighted_avg_cost NUMERIC;
BEGIN
    v_current_user_id := auth.uid();
    v_user_role := get_user_role(v_current_user_id);
    
    IF v_user_role NOT IN ('admin', 'supervisor', 'storekeeper') THEN
        RAISE EXCEPTION 'Unauthorized: User role "%" does not have permission', v_user_role;
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

        SELECT quantity, base_price INTO v_current_qty, v_current_cost 
        FROM products WHERE id = (v_item->>'product_id')::UUID;
        
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

-- 2. Create Surgery Transaction (Atomic)
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
    p_created_by UUID
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
    v_current_user_id := auth.uid();
    v_user_role := get_user_role(v_current_user_id);

    IF v_user_role NOT IN ('admin', 'supervisor', 'doctor', 'storekeeper') THEN
         RAISE EXCEPTION 'Unauthorized: User role "%" does not have permission', v_user_role;
    END IF;
    
    INSERT INTO surgeries (doctor_id, patient_id, patient_name, date, type, total_base_value, total_selling_value, profit, notes, created_by)
    VALUES (p_doctor_id, p_patient_id, p_patient_name, p_date, p_type, p_total_base_value, p_total_selling_value, p_profit, p_notes, v_current_user_id)
    RETURNING id INTO v_surgery_id;

    SELECT name INTO v_doctor_name FROM doctors WHERE id = p_doctor_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO surgery_items (surgery_id, item_id, item_name, quantity, base_price, selling_price)
        VALUES (
            v_surgery_id, 
            (v_item->>'itemId')::UUID, 
            v_item->>'itemName', 
            (v_item->>'quantity')::INTEGER, 
            (v_item->>'basePrice')::NUMERIC, 
            (v_item->>'sellingPrice')::NUMERIC
        );

        INSERT INTO inventory_transactions (
            item_id, item_name, quantity, base_price, selling_price, total_base_value, total_selling_value, date, type, surgery_id, doctor_id, doctor_name, patient_name, notes, created_by, is_locked
        ) VALUES (
            (v_item->>'itemId')::UUID, v_item->>'itemName', (v_item->>'quantity')::INTEGER, (v_item->>'basePrice')::NUMERIC, (v_item->>'sellingPrice')::NUMERIC,
            ((v_item->>'basePrice')::NUMERIC * (v_item->>'quantity')::INTEGER),
            ((v_item->>'sellingPrice')::NUMERIC * (v_item->>'quantity')::INTEGER),
            p_date, 'surgery', v_surgery_id, p_doctor_id, v_doctor_name, p_patient_name, p_notes, v_current_user_id, false
        );
    END LOOP;

    RETURN v_surgery_id;
END;
$$;

-- 3. Inventory Transformation
CREATE OR REPLACE FUNCTION transform_inventory_item(
    p_source_item_id UUID,
    p_target_item_id UUID,
    p_quantity INTEGER,
    p_user_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_source_qty INTEGER;
    v_source_cost DECIMAL(10, 2);
    v_target_cost DECIMAL(10, 2);
    v_cost_diff DECIMAL(10, 2);
    v_transformation_id UUID;
    v_user_role TEXT;
    v_current_user_id UUID;
BEGIN
    v_current_user_id := auth.uid();
    v_user_role := get_user_role(v_current_user_id);
    
    IF v_user_role NOT IN ('admin', 'supervisor', 'storekeeper') THEN
        RAISE EXCEPTION 'Unauthorized: User role "%" does not have permission', v_user_role;
    END IF;

    SELECT quantity, base_price INTO v_source_qty, v_source_cost FROM public.products WHERE id = p_source_item_id FOR UPDATE;
    IF v_source_qty IS NULL THEN RAISE EXCEPTION 'Source item not found'; END IF;
    IF v_source_qty < p_quantity THEN RAISE EXCEPTION 'Insufficient stock. Available: %, Required: %', v_source_qty, p_quantity; END IF;

    SELECT base_price INTO v_target_cost FROM public.products WHERE id = p_target_item_id FOR UPDATE;
    IF v_target_cost IS NULL THEN RAISE EXCEPTION 'Target item not found'; END IF;

    v_cost_diff := (v_source_cost - v_target_cost) * p_quantity;

    UPDATE public.products SET quantity = quantity - p_quantity, last_movement_date = NOW(), updated_at = NOW() WHERE id = p_source_item_id;
    UPDATE public.products SET quantity = quantity + p_quantity, last_movement_date = NOW(), updated_at = NOW() WHERE id = p_target_item_id;

    INSERT INTO public.inventory_transformations (source_item_id, target_item_id, quantity, cost_difference, performed_by, current_source_cost, current_target_cost, notes)
    VALUES (p_source_item_id, p_target_item_id, p_quantity, v_cost_diff, v_current_user_id, v_source_cost, v_target_cost, p_notes) RETURNING id INTO v_transformation_id;
    
    RETURN jsonb_build_object('success', true, 'transformation_id', v_transformation_id);
END;
$$;

-- ============================================
-- SECTION 5: SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgeries ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Products Policies
DROP POLICY IF EXISTS "products_select_authenticated" ON products;
CREATE POLICY "products_select_authenticated" ON products FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "products_insert_authorized" ON products FOR INSERT WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'supervisor', 'storekeeper'));
CREATE POLICY "products_update_authorized" ON products FOR UPDATE USING (get_user_role(auth.uid()) IN ('admin', 'supervisor', 'storekeeper'));
CREATE POLICY "products_delete_admin_only" ON products FOR DELETE USING (get_user_role(auth.uid()) = 'admin');

-- Surgeries Policies
CREATE POLICY "surgeries_select_authorized" ON surgeries FOR SELECT USING (get_user_role(auth.uid()) IN ('admin', 'supervisor', 'doctor', 'partner'));
CREATE POLICY "surgeries_insert_authorized" ON surgeries FOR INSERT WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'supervisor', 'doctor', 'storekeeper'));
CREATE POLICY "surgeries_update_authorized" ON surgeries FOR UPDATE USING (get_user_role(auth.uid()) IN ('admin', 'supervisor', 'doctor'));
CREATE POLICY "surgeries_delete_admin_only" ON surgeries FOR DELETE USING (get_user_role(auth.uid()) = 'admin');

-- Invoice Policies
CREATE POLICY "invoices_select_authenticated" ON invoices FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "invoices_insert_authorized" ON invoices FOR INSERT WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'supervisor', 'storekeeper'));
CREATE POLICY "invoices_update_admin_only" ON invoices FOR UPDATE USING (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "invoices_delete_admin_only" ON invoices FOR DELETE USING (get_user_role(auth.uid()) = 'admin');

-- ============================================
-- SECTION 6: TRIGGERS & CONSTRAINTS
-- ============================================

-- Prevent Negative Stock (Trigger)
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

-- Date Validations
ALTER TABLE products DROP CONSTRAINT IF EXISTS check_expiry_after_manufacturing;
ALTER TABLE products ADD CONSTRAINT check_expiry_after_manufacturing CHECK (expiry_date IS NULL OR manufacturing_date IS NULL OR expiry_date > manufacturing_date);
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS unique_vendor_invoice_per_supplier;
ALTER TABLE invoices ADD CONSTRAINT unique_vendor_invoice_per_supplier UNIQUE NULLS NOT DISTINCT (supplier_id, vendor_invoice_number);

-- ============================================
-- SECTION 7: VIEWS (SECURE)
-- ============================================

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

-- ============================================
-- END OF MASTER SCRIPT
-- ============================================
