-- ============================================
-- 🔧 CRITICAL FIXES للثغرات الحرجة
-- نظام Wathqq Medical Org
-- تاريخ: 2026-02-07
-- ============================================

-- ============================================
-- FIX #1: تحديث Triggers للمشتريات
-- المشكلة: الـ Trigger الحالي يعالج INSERT فقط
-- ============================================

-- 1. حذف الـ Trigger القديم
DROP TRIGGER IF EXISTS trigger_update_product_quantity_on_purchase ON purchase_invoices;
DROP FUNCTION IF EXISTS update_product_quantity_on_purchase();

-- 2. إنشاء Function جديدة تدعم INSERT, UPDATE, DELETE
CREATE OR REPLACE FUNCTION sync_product_quantity_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- زيادة الكمية عند الإضافة
        UPDATE products
        SET quantity = quantity + NEW.quantity,
            last_movement_date = NEW.date
        WHERE id = NEW.item_id;
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- التحقق من تغيير الصنف أو الكمية
        IF OLD.item_id = NEW.item_id THEN
            -- نفس الصنف: تعديل الكمية فقط
            UPDATE products
            SET quantity = quantity - OLD.quantity + NEW.quantity,
                last_movement_date = NEW.date
            WHERE id = NEW.item_id;
        ELSE
            -- تغيير الصنف: خصم من القديم وإضافة للجديد
            UPDATE products
            SET quantity = quantity - OLD.quantity,
                last_movement_date = NOW()
            WHERE id = OLD.item_id;
            
            UPDATE products
            SET quantity = quantity + NEW.quantity,
                last_movement_date = NEW.date
            WHERE id = NEW.item_id;
        END IF;
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- خصم الكمية عند الحذف
        UPDATE products
        SET quantity = quantity - OLD.quantity,
            last_movement_date = NOW()
        WHERE id = OLD.item_id;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. إنشاء Triggers للحالات الثلاث
CREATE TRIGGER trigger_sync_product_on_purchase_insert
    AFTER INSERT ON purchase_invoices
    FOR EACH ROW EXECUTE FUNCTION sync_product_quantity_on_purchase();

CREATE TRIGGER trigger_sync_product_on_purchase_update
    AFTER UPDATE ON purchase_invoices
    FOR EACH ROW EXECUTE FUNCTION sync_product_quantity_on_purchase();

CREATE TRIGGER trigger_sync_product_on_purchase_delete
    AFTER DELETE ON purchase_invoices
    FOR EACH ROW EXECUTE FUNCTION sync_product_quantity_on_purchase();

-- ============================================
-- FIX #2: تحديث Triggers للعمليات الجراحية
-- المشكلة: الـ Trigger الحالي يعالج INSERT فقط
-- ============================================

-- 1. حذف الـ Trigger القديم
DROP TRIGGER IF EXISTS trigger_update_product_quantity_on_transaction ON inventory_transactions;
DROP FUNCTION IF EXISTS update_product_quantity_on_transaction();

-- 2. إنشاء Function محسّنة
CREATE OR REPLACE FUNCTION sync_product_quantity_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- خصم الكمية عند إضافة معاملة
        UPDATE products
        SET quantity = quantity - NEW.quantity,
            last_movement_date = NEW.date
        WHERE id = NEW.item_id;
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- التحقق من تغيير الصنف أو الكمية
        IF OLD.item_id = NEW.item_id THEN
            -- نفس الصنف: تعديل الكمية فقط
            UPDATE products
            SET quantity = quantity + OLD.quantity - NEW.quantity,
                last_movement_date = NEW.date
            WHERE id = NEW.item_id;
        ELSE
            -- تغيير الصنف: إرجاع للقديم وخصم من الجديد
            UPDATE products
            SET quantity = quantity + OLD.quantity,
                last_movement_date = NOW()
            WHERE id = OLD.item_id;
            
            UPDATE products
            SET quantity = quantity - NEW.quantity,
                last_movement_date = NEW.date
            WHERE id = NEW.item_id;
        END IF;
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- إرجاع الكمية عند حذف معاملة
        UPDATE products
        SET quantity = quantity + OLD.quantity,
            last_movement_date = NOW()
        WHERE id = OLD.item_id;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. إنشاء Triggers للحالات الثلاث
CREATE TRIGGER trigger_sync_product_on_transaction_insert
    AFTER INSERT ON inventory_transactions
    FOR EACH ROW EXECUTE FUNCTION sync_product_quantity_on_transaction();

CREATE TRIGGER trigger_sync_product_on_transaction_update
    AFTER UPDATE ON inventory_transactions
    FOR EACH ROW EXECUTE FUNCTION sync_product_quantity_on_transaction();

CREATE TRIGGER trigger_sync_product_on_transaction_delete
    AFTER DELETE ON inventory_transactions
    FOR EACH ROW EXECUTE FUNCTION sync_product_quantity_on_transaction();

-- ============================================
-- FIX #3: إضافة Validation للكميات السلبية
-- المشكلة: يمكن خصم كمية أكبر من المتاح
-- ============================================

CREATE OR REPLACE FUNCTION check_product_quantity_before_transaction()
RETURNS TRIGGER AS $$
DECLARE
    current_qty INTEGER;
BEGIN
    -- جلب الكمية الحالية
    SELECT quantity INTO current_qty
    FROM products
    WHERE id = NEW.item_id;
    
    -- التحقق من وجود الصنف
    IF current_qty IS NULL THEN
        RAISE EXCEPTION 'Product not found: %', NEW.item_id;
    END IF;
    
    -- التحقق من كفاية الكمية
    IF current_qty < NEW.quantity THEN
        RAISE EXCEPTION 'Insufficient quantity in stock. Available: %, Requested: %', 
            current_qty, NEW.quantity
        USING ERRCODE = '23514'; -- check_violation
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- تطبيق Trigger قبل INSERT
CREATE TRIGGER check_quantity_before_transaction
    BEFORE INSERT ON inventory_transactions
    FOR EACH ROW
    EXECUTE FUNCTION check_product_quantity_before_transaction();

-- ============================================
-- FIX #4: إضافة Cascade Delete للعمليات الجراحية
-- المشكلة: عند حذف عملية، الـ inventory_transactions لا تُحذف
-- ============================================

-- حذف Constraint القديم إذا كان موجوداً
ALTER TABLE inventory_transactions
DROP CONSTRAINT IF EXISTS inventory_transactions_surgery_id_fkey;

-- إضافة Constraint جديد مع CASCADE
ALTER TABLE inventory_transactions
ADD CONSTRAINT inventory_transactions_surgery_id_fkey
FOREIGN KEY (surgery_id) REFERENCES surgeries(id)
ON DELETE CASCADE;

-- ============================================
-- FIX #5: إنشاء Views محسّنة للـ Dashboard
-- المشكلة: الحسابات تتم في Frontend بدلاً من Database
-- ============================================

-- View لإحصائيات Dashboard
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM products) as total_skus,
    (SELECT COUNT(*) FROM products WHERE quantity <= min_stock) as low_stock_count,
    (SELECT COUNT(*) FROM products 
     WHERE EXTRACT(MONTH FROM AGE(NOW(), last_movement_date)) >= 6) as dead_stock_count,
    (SELECT COALESCE(SUM(quantity * base_price), 0) FROM products) as total_inventory_value,
    (SELECT COALESCE(SUM(total_cost), 0) FROM purchase_invoices) as total_purchases,
    (SELECT COALESCE(SUM(profit), 0) FROM surgeries) as total_profit,
    (SELECT COUNT(*) FROM surgeries) as total_surgeries;

-- View للأصناف منخفضة المخزون (أول 10)
CREATE OR REPLACE VIEW low_stock_items_top AS
SELECT 
    id,
    name,
    sku,
    category,
    material,
    diameter,
    length,
    quantity,
    min_stock,
    base_price,
    selling_price,
    last_movement_date,
    (quantity::DECIMAL / NULLIF(min_stock, 0)) as stock_ratio
FROM products
WHERE quantity <= min_stock
ORDER BY stock_ratio ASC
LIMIT 10;

-- View لآخر العمليات الجراحية (أول 10)
CREATE OR REPLACE VIEW recent_surgeries_top AS
SELECT 
    s.id,
    s.patient_name,
    s.date,
    s.type,
    s.total_base_value,
    s.total_selling_value,
    s.profit,
    s.notes,
    d.name as doctor_name,
    d.hospital
FROM surgeries s
LEFT JOIN doctors d ON s.doctor_id = d.id
ORDER BY s.date DESC
LIMIT 10;

-- ============================================
-- FIX #6: إضافة Audit Logs Table
-- الهدف: تتبع جميع العمليات الحساسة
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    record_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id TEXT NOT NULL,
    user_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index للبحث السريع
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);

-- Function عامة للـ Audit
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id TEXT;
    current_user_email TEXT;
BEGIN
    -- محاولة الحصول على معلومات المستخدم من Supabase
    current_user_id := COALESCE(
        current_setting('request.jwt.claims', true)::json->>'sub',
        'system'
    );
    
    current_user_email := COALESCE(
        current_setting('request.jwt.claims', true)::json->>'email',
        'system@wathqq.com'
    );
    
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (table_name, operation, record_id, old_values, user_id, user_email)
        VALUES (
            TG_TABLE_NAME, 
            TG_OP, 
            OLD.id, 
            row_to_json(OLD)::jsonb,
            current_user_id,
            current_user_email
        );
        RETURN OLD;
        
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (table_name, operation, record_id, old_values, new_values, user_id, user_email)
        VALUES (
            TG_TABLE_NAME, 
            TG_OP, 
            NEW.id, 
            row_to_json(OLD)::jsonb, 
            row_to_json(NEW)::jsonb,
            current_user_id,
            current_user_email
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (table_name, operation, record_id, new_values, user_id, user_email)
        VALUES (
            TG_TABLE_NAME, 
            TG_OP, 
            NEW.id, 
            row_to_json(NEW)::jsonb,
            current_user_id,
            current_user_email
        );
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- تطبيق Audit على الجداول الحساسة
CREATE TRIGGER audit_products_changes
    AFTER INSERT OR UPDATE OR DELETE ON products
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_purchase_invoices_changes
    AFTER INSERT OR UPDATE OR DELETE ON purchase_invoices
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_surgeries_changes
    AFTER INSERT OR UPDATE OR DELETE ON surgeries
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_inventory_transactions_changes
    AFTER INSERT OR UPDATE OR DELETE ON inventory_transactions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================
-- FIX #7: تحسين Indexes للأداء
-- ============================================

-- تمكين امتداد التشابه النصي للبحث المتقدم
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Indexes للبحث النصي السريع
CREATE INDEX IF NOT EXISTS idx_products_name_trgm 
    ON products USING gin(name gin_trgm_ops);
    
CREATE INDEX IF NOT EXISTS idx_surgeries_patient_name_trgm 
    ON surgeries USING gin(patient_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_doctors_name_trgm 
    ON doctors USING gin(name gin_trgm_ops);

-- Indexes إضافية للأداء
CREATE INDEX IF NOT EXISTS idx_products_last_movement 
    ON products(last_movement_date DESC);
    
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_created_at 
    ON purchase_invoices(created_at DESC);
    
CREATE INDEX IF NOT EXISTS idx_surgeries_created_at 
    ON surgeries(created_at DESC);

-- ============================================
-- تم الانتهاء من الإصلاحات الحرجة ✅
-- ============================================

-- للتطبيق في Supabase:
-- 1. افتح Supabase Dashboard
-- 2. اذهب إلى SQL Editor
-- 3. انسخ جميع محتويات هذا الملف
-- 4. قم بتشغيل الـ SQL
-- 5. تحقق من النتائج

-- ملاحظات هامة:
-- - هذه الإصلاحات لن تؤثر على البيانات الموجودة
-- - ستُطبق فقط على العمليات الجديدة
-- - يُنصح بعمل Backup قبل التطبيق
-- - إذا حصل خطأ، يمكنك التراجع بحذف الـ Triggers الجديدة
