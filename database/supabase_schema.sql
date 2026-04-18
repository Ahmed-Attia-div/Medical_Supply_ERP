-- ============================================
-- وثق - نظام إدارة المستلزمات الطبية
-- Supabase Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. جدول الموردين (Suppliers)
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. جدول الأطباء (Doctors)
-- ============================================
CREATE TABLE IF NOT EXISTS doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    hospital TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. جدول المنتجات (Products/Inventory Items)
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('screws', 'plates', 'rods', 'wires', 'nails', 'instruments', 'consumables')),
    
    -- Multi-variant attributes
    material TEXT CHECK (material IN ('titanium', 'stainless')),
    diameter TEXT,
    length TEXT,
    
    -- Stock
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    min_stock INTEGER NOT NULL DEFAULT 10 CHECK (min_stock >= 0),
    
    -- Dual Pricing
    base_price DECIMAL(10, 2) NOT NULL CHECK (base_price >= 0),
    selling_price DECIMAL(10, 2) NOT NULL CHECK (selling_price >= 0),
    
    -- Tracking
    last_movement_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_quantity ON products(quantity);

-- ============================================
-- 4. جدول فواتير المشتريات (Purchase Invoices)
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    supplier_name TEXT NOT NULL,
    item_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_cost DECIMAL(10, 2) NOT NULL CHECK (unit_cost >= 0),
    total_cost DECIMAL(10, 2) NOT NULL CHECK (total_cost >= 0),
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_locked BOOLEAN DEFAULT FALSE
);

-- Create indexes
CREATE INDEX idx_purchase_invoices_supplier ON purchase_invoices(supplier_id);
CREATE INDEX idx_purchase_invoices_item ON purchase_invoices(item_id);
CREATE INDEX idx_purchase_invoices_date ON purchase_invoices(date);

-- ============================================
-- 5. جدول حركات المخزون (Inventory Transactions)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    base_price DECIMAL(10, 2) NOT NULL CHECK (base_price >= 0),
    selling_price DECIMAL(10, 2) NOT NULL CHECK (selling_price >= 0),
    total_base_value DECIMAL(10, 2) NOT NULL,
    total_selling_value DECIMAL(10, 2) NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type TEXT NOT NULL CHECK (type IN ('sale', 'usage', 'surgery')),
    surgery_id UUID,
    doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
    doctor_name TEXT,
    patient_name TEXT,
    notes TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_locked BOOLEAN DEFAULT FALSE
);

-- Create indexes
CREATE INDEX idx_inventory_transactions_item ON inventory_transactions(item_id);
CREATE INDEX idx_inventory_transactions_date ON inventory_transactions(date);
CREATE INDEX idx_inventory_transactions_type ON inventory_transactions(type);
CREATE INDEX idx_inventory_transactions_surgery ON inventory_transactions(surgery_id);

-- ============================================
-- 6. جدول العمليات الجراحية (Surgeries)
-- ============================================
CREATE TABLE IF NOT EXISTS surgeries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    patient_id TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type TEXT NOT NULL,
    total_base_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_selling_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
    profit DECIMAL(10, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_surgeries_doctor ON surgeries(doctor_id);
CREATE INDEX idx_surgeries_date ON surgeries(date);
CREATE INDEX idx_surgeries_patient ON surgeries(patient_name);

-- ============================================
-- 7. جدول أصناف العمليات الجراحية (Surgery Items)
-- ============================================
CREATE TABLE IF NOT EXISTS surgery_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    surgery_id UUID NOT NULL REFERENCES surgeries(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    base_price DECIMAL(10, 2) NOT NULL CHECK (base_price >= 0),
    selling_price DECIMAL(10, 2) NOT NULL CHECK (selling_price >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_surgery_items_surgery ON surgery_items(surgery_id);
CREATE INDEX idx_surgery_items_item ON surgery_items(item_id);

-- ============================================
-- 8. جدول سجلات القطع/التشذيب (Scrap/Cutting Logs)
-- ============================================
CREATE TABLE IF NOT EXISTS scrap_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_item_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    original_item_name TEXT NOT NULL,
    original_length TEXT NOT NULL,
    new_item_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    new_item_name TEXT NOT NULL,
    new_length TEXT NOT NULL,
    scrap_material TEXT NOT NULL,
    original_base_price DECIMAL(10, 2) NOT NULL,
    new_base_price DECIMAL(10, 2) NOT NULL,
    scrap_value DECIMAL(10, 2) NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT NOT NULL,
    notes TEXT
);

-- Create indexes
CREATE INDEX idx_scrap_logs_original_item ON scrap_logs(original_item_id);
CREATE INDEX idx_scrap_logs_new_item ON scrap_logs(new_item_id);

-- ============================================
-- 9. جدول إعدادات النظام (System Settings)
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dead_stock_threshold_months INTEGER NOT NULL DEFAULT 6,
    low_stock_alert_enabled BOOLEAN DEFAULT TRUE,
    margin_warning_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by TEXT
);

-- Insert default settings if not exists
INSERT INTO system_settings (dead_stock_threshold_months, low_stock_alert_enabled, margin_warning_enabled)
VALUES (6, TRUE, TRUE)
ON CONFLICT DO NOTHING;

-- ============================================
-- TRIGGERS: Auto-update timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON doctors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TRIGGERS: Auto-update product quantity on purchase
-- ============================================
CREATE OR REPLACE FUNCTION update_product_quantity_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
    -- Increase product quantity when purchase is added
    UPDATE products
    SET quantity = quantity + NEW.quantity,
        last_movement_date = NEW.date
    WHERE id = NEW.item_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_quantity_on_purchase
    AFTER INSERT ON purchase_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_product_quantity_on_purchase();

-- ============================================
-- TRIGGERS: Auto-update product quantity on transaction
-- ============================================
CREATE OR REPLACE FUNCTION update_product_quantity_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
    -- Decrease product quantity when transaction is added
    UPDATE products
    SET quantity = quantity - NEW.quantity,
        last_movement_date = NEW.date
    WHERE id = NEW.item_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_quantity_on_transaction
    AFTER INSERT ON inventory_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_product_quantity_on_transaction();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgeries ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrap_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (can be customized later for authentication)
-- For now, allow all operations for authenticated users

-- Suppliers policies
CREATE POLICY "Enable read access for all users" ON suppliers FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON suppliers FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON suppliers FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON suppliers FOR DELETE USING (true);

-- Doctors policies
CREATE POLICY "Enable read access for all users" ON doctors FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON doctors FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON doctors FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON doctors FOR DELETE USING (true);

-- Products policies
CREATE POLICY "Enable read access for all users" ON products FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON products FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON products FOR DELETE USING (true);

-- Purchase invoices policies
CREATE POLICY "Enable read access for all users" ON purchase_invoices FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON purchase_invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON purchase_invoices FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON purchase_invoices FOR DELETE USING (true);

-- Inventory transactions policies
CREATE POLICY "Enable read access for all users" ON inventory_transactions FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON inventory_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON inventory_transactions FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON inventory_transactions FOR DELETE USING (true);

-- Surgeries policies
CREATE POLICY "Enable read access for all users" ON surgeries FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON surgeries FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON surgeries FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON surgeries FOR DELETE USING (true);

-- Surgery items policies
CREATE POLICY "Enable read access for all users" ON surgery_items FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON surgery_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON surgery_items FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON surgery_items FOR DELETE USING (true);

-- Scrap logs policies
CREATE POLICY "Enable read access for all users" ON scrap_logs FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON scrap_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON scrap_logs FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON scrap_logs FOR DELETE USING (true);

-- System settings policies
CREATE POLICY "Enable read access for all users" ON system_settings FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON system_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON system_settings FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON system_settings FOR DELETE USING (true);

-- ============================================
-- VIEWS: Useful analytics views
-- ============================================

-- View: Low stock items
CREATE OR REPLACE VIEW low_stock_items AS
SELECT 
    id,
    name,
    sku,
    category,
    quantity,
    min_stock,
    (quantity::DECIMAL / min_stock) as stock_ratio
FROM products
WHERE quantity <= min_stock
ORDER BY stock_ratio ASC;

-- View: Dead stock items (no movement in 6+ months)
CREATE OR REPLACE VIEW dead_stock_items AS
SELECT 
    id,
    name,
    sku,
    category,
    quantity,
    last_movement_date,
    EXTRACT(MONTH FROM AGE(NOW(), last_movement_date)) as months_inactive
FROM products
WHERE EXTRACT(MONTH FROM AGE(NOW(), last_movement_date)) >= 6
ORDER BY months_inactive DESC;

-- View: Inventory value summary
CREATE OR REPLACE VIEW inventory_value_summary AS
SELECT 
    category,
    COUNT(*) as item_count,
    SUM(quantity) as total_quantity,
    SUM(quantity * base_price) as total_base_value,
    SUM(quantity * selling_price) as total_selling_value,
    SUM(quantity * (selling_price - base_price)) as potential_profit
FROM products
GROUP BY category;

-- View: Surgery profitability
CREATE OR REPLACE VIEW surgery_profitability AS
SELECT 
    s.id,
    s.patient_name,
    s.date,
    s.type,
    d.name as doctor_name,
    d.hospital,
    s.total_base_value,
    s.total_selling_value,
    s.profit,
    CASE 
        WHEN s.total_base_value > 0 THEN (s.profit / s.total_base_value * 100)
        ELSE 0
    END as profit_percentage
FROM surgeries s
JOIN doctors d ON s.doctor_id = d.id
ORDER BY s.date DESC;

-- ============================================
-- COMPLETED
-- ============================================
-- Schema created successfully!
-- Next steps:
-- 1. Copy and paste this SQL into Supabase SQL Editor
-- 2. Run the script to create all tables
-- 3. Verify tables are created in the Table Editor
-- ============================================
