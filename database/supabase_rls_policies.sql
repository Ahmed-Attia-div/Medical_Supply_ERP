-- ============================================
-- 🔐 تأمين RLS Policies
-- Row Level Security Configuration
-- ============================================

-- ⚠️ ملاحظة مهمة:
-- هذا الملف يحتوي على تأمين أساسي للـ RLS
-- لتطبيق تأمين كامل، ستحتاج لإنشاء جدول user_roles أولاً
-- ============================================

-- ============================================
-- 1. حذف السياسات الحالية الضعيفة
-- ============================================

-- Suppliers
DROP POLICY IF EXISTS "Enable read access for all users" ON suppliers;
DROP POLICY IF EXISTS "Enable insert access for all users" ON suppliers;
DROP POLICY IF EXISTS "Enable update access for all users" ON suppliers;
DROP POLICY IF EXISTS "Enable delete access for all users" ON suppliers;

-- Doctors
DROP POLICY IF EXISTS "Enable read access for all users" ON doctors;
DROP POLICY IF EXISTS "Enable insert access for all users" ON doctors;
DROP POLICY IF EXISTS "Enable update access for all users" ON doctors;
DROP POLICY IF EXISTS "Enable delete access for all users" ON doctors;

-- Products
DROP POLICY IF EXISTS "Enable read access for all users" ON products;
DROP POLICY IF EXISTS "Enable insert access for all users" ON products;
DROP POLICY IF EXISTS "Enable update access for all users" ON products;
DROP POLICY IF EXISTS "Enable delete access for all users" ON products;

-- Purchase Invoices
DROP POLICY IF EXISTS "Enable read access for all users" ON purchase_invoices;
DROP POLICY IF EXISTS "Enable insert access for all users" ON purchase_invoices;
DROP POLICY IF EXISTS "Enable update access for all users" ON purchase_invoices;
DROP POLICY IF EXISTS "Enable delete access for all users" ON purchase_invoices;

-- Inventory Transactions
DROP POLICY IF EXISTS "Enable read access for all users" ON inventory_transactions;
DROP POLICY IF EXISTS "Enable insert access for all users" ON inventory_transactions;
DROP POLICY IF EXISTS "Enable update access for all users" ON inventory_transactions;
DROP POLICY IF EXISTS "Enable delete access for all users" ON inventory_transactions;

-- Surgeries  
DROP POLICY IF EXISTS "Enable read access for all users" ON surgeries;
DROP POLICY IF EXISTS "Enable insert access for all users" ON surgeries;
DROP POLICY IF EXISTS "Enable update access for all users" ON surgeries;
DROP POLICY IF EXISTS "Enable delete access for all users" ON surgeries;

-- Surgery Items
DROP POLICY IF EXISTS "Enable read access for all users" ON surgery_items;
DROP POLICY IF EXISTS "Enable insert access for all users" ON surgery_items;
DROP POLICY IF EXISTS "Enable update access for all users" ON surgery_items;
DROP POLICY IF EXISTS "Enable delete access for all users" ON surgery_items;

-- Scrap Logs
DROP POLICY IF EXISTS "Enable read access for all users" ON scrap_logs;
DROP POLICY IF EXISTS "Enable insert access for all users" ON scrap_logs;
DROP POLICY IF EXISTS "Enable update access for all users" ON scrap_logs;
DROP POLICY IF EXISTS "Enable delete access for all users" ON scrap_logs;

-- System Settings
DROP POLICY IF EXISTS "Enable read access for all users" ON system_settings;
DROP POLICY IF EXISTS "Enable insert access for all users" ON system_settings;
DROP POLICY IF EXISTS "Enable update access for all users" ON system_settings;
DROP POLICY IF EXISTS "Enable delete access for all users" ON system_settings;

-- Audit Logs  
DROP POLICY IF EXISTS "Enable read access for all users" ON audit_logs;
DROP POLICY IF EXISTS "Enable insert access for all users" ON audit_logs;
DROP POLICY IF EXISTS "Enable update access for all users" ON audit_logs;
DROP POLICY IF EXISTS "Enable delete access for all users" ON audit_logs;

-- ============================================
-- 2. إنشاء سياسات RLS محسّنة (أساسية)
-- ملاحظة: هذه سياسات مؤقتة - للإنتاج، أنشئ جدول user_roles
-- ============================================

-- ====================
-- SUPPLIERS POLICIES
-- ====================

-- قراءة: للمستخدمين المُصادق عليهم فقط
CREATE POLICY "Authenticated users can read suppliers"
ON suppliers FOR SELECT
USING (auth.role() = 'authenticated');

-- إضافة: للمستخدمين المُصادق عليهم فقط
CREATE POLICY "Authenticated users can insert suppliers"
ON suppliers FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- تعديل: للمستخدمين المُصادق عليهم فقط
CREATE POLICY "Authenticated users can update suppliers"
ON suppliers FOR UPDATE
USING (auth.role() = 'authenticated');

-- حذف: للمستخدمين المُصادق عليهم فقط (يمكن تقييده لاحقاً)
CREATE POLICY "Authenticated users can delete suppliers"
ON suppliers FOR DELETE
USING (auth.role() = 'authenticated');

-- ====================
-- DOCTORS POLICIES
-- ====================

CREATE POLICY "Authenticated users can read doctors"
ON doctors FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert doctors"
ON doctors FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update doctors"
ON doctors FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete doctors"
ON doctors FOR DELETE
USING (auth.role() = 'authenticated');

-- ====================
-- PRODUCTS POLICIES
-- ====================

CREATE POLICY "Authenticated users can read products"
ON products FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert products"
ON products FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update products"
ON products FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete products"
ON products FOR DELETE
USING (auth.role() = 'authenticated');

-- ====================
-- PURCHASE INVOICES POLICIES
-- ====================

CREATE POLICY "Authenticated users can read purchase_invoices"
ON purchase_invoices FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert purchase_invoices"
ON purchase_invoices FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update purchase_invoices"
ON purchase_invoices FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete purchase_invoices"
ON purchase_invoices FOR DELETE
USING (auth.role() = 'authenticated');

-- ====================
-- INVENTORY TRANSACTIONS POLICIES
-- ====================

CREATE POLICY "Authenticated users can read inventory_transactions"
ON inventory_transactions FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert inventory_transactions"
ON inventory_transactions FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update inventory_transactions"
ON inventory_transactions FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete inventory_transactions"
ON inventory_transactions FOR DELETE
USING (auth.role() = 'authenticated');

-- ====================
-- SURGERIES POLICIES
-- ====================

CREATE POLICY "Authenticated users can read surgeries"
ON surgeries FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert surgeries"
ON surgeries FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update surgeries"
ON surgeries FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete surgeries"
ON surgeries FOR DELETE
USING (auth.role() = 'authenticated');

-- ====================
-- SURGERY ITEMS POLICIES
-- ====================

CREATE POLICY "Authenticated users can read surgery_items"
ON surgery_items FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert surgery_items"
ON surgery_items FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update surgery_items"
ON surgery_items FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete surgery_items"
ON surgery_items FOR DELETE
USING (auth.role() = 'authenticated');

-- ====================
-- SCRAP LOGS POLICIES
-- ====================

CREATE POLICY "Authenticated users can read scrap_logs"
ON scrap_logs FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert scrap_logs"
ON scrap_logs FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update scrap_logs"
ON scrap_logs FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete scrap_logs"
ON scrap_logs FOR DELETE
USING (auth.role() = 'authenticated');

-- ====================
-- SYSTEM SETTINGS POLICIES
-- ====================

CREATE POLICY "Authenticated users can read system_settings"
ON system_settings FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update system_settings"
ON system_settings FOR UPDATE
USING (auth.role() = 'authenticated');

-- ====================
-- AUDIT LOGS POLICIES (Read-only)
-- ====================

-- Audit logs: قراءة فقط للمستخدمين
CREATE POLICY "Authenticated users can read audit_logs"
ON audit_logs FOR SELECT
USING (auth.role() = 'authenticated');

-- لا حذف/تعديل للـ Audit Logs (سجلات دائمة)

-- ============================================
-- 3. السماح لـ Service Role بكل الصلاحيات
-- ============================================

-- ملاحظة: Service Role له صلاحيات كاملة تلقائياً
-- هذا يسمح للـ Triggers والـ Functions بالعمل بدون مشاكل

-- ============================================
-- ✅ تم الانتهاء من تطبيق RLS
-- ============================================

-- الحالة الحالية:
-- ✅ تم منع الوصول غير المُصادق عليه
-- ✅ المستخدمون المُصادق عليهم لهم صلاحيات كاملة
-- ⚠️ للإنتاج: أنشئ جدول user_roles وحدد الصلاحيات بدقة

-- خطوة مستقبلية (للتأمين الكامل):
-- 1. إنشاء جدول user_roles
-- 2. ربطه بـ auth.users
-- 3. تحديث السياسات لفحص الأدوار
-- مثال:
-- CREATE POLICY "Only admins can delete products"
-- ON products FOR DELETE
-- USING (
--   EXISTS (
--     SELECT 1 FROM user_roles
--     WHERE user_id = auth.uid()
--     AND role IN ('admin', 'owner')
--   )
-- );

-- ============================================
