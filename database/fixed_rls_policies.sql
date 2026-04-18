-- ============================================
-- 🔧 إصلاح RLS Policies - نسخة محسّنة
-- Fixed RLS Policies for Development
-- ============================================

-- المشكلة: auth.role() لا يعمل كما متوقع
-- الحل: استخدام auth.uid() IS NOT NULL

-- ============================================
-- 1. حذف السياسات الحالية
-- ============================================

-- Suppliers
DROP POLICY IF EXISTS "Authenticated users can read suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authenticated users can insert suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authenticated users can update suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authenticated users can delete suppliers" ON suppliers;

-- Doctors
DROP POLICY IF EXISTS "Authenticated users can read doctors" ON doctors;
DROP POLICY IF EXISTS "Authenticated users can insert doctors" ON doctors;
DROP POLICY IF EXISTS "Authenticated users can update doctors" ON doctors;
DROP POLICY IF EXISTS "Authenticated users can delete doctors" ON doctors;

-- Products
DROP POLICY IF EXISTS "Authenticated users can read products" ON products;
DROP POLICY IF EXISTS "Authenticated users can insert products" ON products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON products;
DROP POLICY IF EXISTS "Authenticated users can delete products" ON products;

-- Purchase Invoices
DROP POLICY IF EXISTS "Authenticated users can read purchase_invoices" ON purchase_invoices;
DROP POLICY IF EXISTS "Authenticated users can insert purchase_invoices" ON purchase_invoices;
DROP POLICY IF EXISTS "Authenticated users can update purchase_invoices" ON purchase_invoices;
DROP POLICY IF EXISTS "Authenticated users can delete purchase_invoices" ON purchase_invoices;

-- Inventory Transactions
DROP POLICY IF EXISTS "Authenticated users can read inventory_transactions" ON inventory_transactions;
DROP POLICY IF EXISTS "Authenticated users can insert inventory_transactions" ON inventory_transactions;
DROP POLICY IF EXISTS "Authenticated users can update inventory_transactions" ON inventory_transactions;
DROP POLICY IF EXISTS "Authenticated users can delete inventory_transactions" ON inventory_transactions;

-- Surgeries
DROP POLICY IF EXISTS "Authenticated users can read surgeries" ON surgeries;
DROP POLICY IF EXISTS "Authenticated users can insert surgeries" ON surgeries;
DROP POLICY IF EXISTS "Authenticated users can update surgeries" ON surgeries;
DROP POLICY IF EXISTS "Authenticated users can delete surgeries" ON surgeries;

-- Surgery Items
DROP POLICY IF EXISTS "Authenticated users can read surgery_items" ON surgery_items;
DROP POLICY IF EXISTS "Authenticated users can insert surgery_items" ON surgery_items;
DROP POLICY IF EXISTS "Authenticated users can update surgery_items" ON surgery_items;
DROP POLICY IF EXISTS "Authenticated users can delete surgery_items" ON surgery_items;

-- Scrap Logs
DROP POLICY IF EXISTS "Authenticated users can read scrap_logs" ON scrap_logs;
DROP POLICY IF EXISTS "Authenticated users can insert scrap_logs" ON scrap_logs;
DROP POLICY IF EXISTS "Authenticated users can update scrap_logs" ON scrap_logs;
DROP POLICY IF EXISTS "Authenticated users can delete scrap_logs" ON scrap_logs;

-- System Settings
DROP POLICY IF EXISTS "Authenticated users can read system_settings" ON system_settings;
DROP POLICY IF EXISTS "Authenticated users can update system_settings" ON system_settings;

-- Audit Logs
DROP POLICY IF EXISTS "Authenticated users can read audit_logs" ON audit_logs;

-- ============================================
-- 2. إنشاء سياسات جديدة محسّنة
-- ============================================

-- ====================
-- SUPPLIERS POLICIES
-- ====================

CREATE POLICY "Allow all for authenticated users - suppliers select"
ON suppliers FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - suppliers insert"
ON suppliers FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - suppliers update"
ON suppliers FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - suppliers delete"
ON suppliers FOR DELETE
USING (auth.uid() IS NOT NULL);

-- ====================
-- DOCTORS POLICIES
-- ====================

CREATE POLICY "Allow all for authenticated users - doctors select"
ON doctors FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - doctors insert"
ON doctors FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - doctors update"
ON doctors FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - doctors delete"
ON doctors FOR DELETE
USING (auth.uid() IS NOT NULL);

-- ====================
-- PRODUCTS POLICIES
-- ====================

CREATE POLICY "Allow all for authenticated users - products select"
ON products FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - products insert"
ON products FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - products update"
ON products FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - products delete"
ON products FOR DELETE
USING (auth.uid() IS NOT NULL);

-- ====================
-- PURCHASE INVOICES POLICIES
-- ====================

CREATE POLICY "Allow all for authenticated users - purchase_invoices select"
ON purchase_invoices FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - purchase_invoices insert"
ON purchase_invoices FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - purchase_invoices update"
ON purchase_invoices FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - purchase_invoices delete"
ON purchase_invoices FOR DELETE
USING (auth.uid() IS NOT NULL);

-- ====================
-- INVENTORY TRANSACTIONS POLICIES
-- ====================

CREATE POLICY "Allow all for authenticated users - inventory_transactions select"
ON inventory_transactions FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - inventory_transactions insert"
ON inventory_transactions FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - inventory_transactions update"
ON inventory_transactions FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - inventory_transactions delete"
ON inventory_transactions FOR DELETE
USING (auth.uid() IS NOT NULL);

-- ====================
-- SURGERIES POLICIES
-- ====================

CREATE POLICY "Allow all for authenticated users - surgeries select"
ON surgeries FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - surgeries insert"
ON surgeries FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - surgeries update"
ON surgeries FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - surgeries delete"
ON surgeries FOR DELETE
USING (auth.uid() IS NOT NULL);

-- ====================
-- SURGERY ITEMS POLICIES
-- ====================

CREATE POLICY "Allow all for authenticated users - surgery_items select"
ON surgery_items FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - surgery_items insert"
ON surgery_items FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - surgery_items update"
ON surgery_items FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - surgery_items delete"
ON surgery_items FOR DELETE
USING (auth.uid() IS NOT NULL);

-- ====================
-- SCRAP LOGS POLICIES
-- ====================

CREATE POLICY "Allow all for authenticated users - scrap_logs select"
ON scrap_logs FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - scrap_logs insert"
ON scrap_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - scrap_logs update"
ON scrap_logs FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - scrap_logs delete"
ON scrap_logs FOR DELETE
USING (auth.uid() IS NOT NULL);

-- ====================
-- SYSTEM SETTINGS POLICIES
-- ====================

CREATE POLICY "Allow all for authenticated users - system_settings select"
ON system_settings FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users - system_settings update"
ON system_settings FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- ====================
-- AUDIT LOGS POLICIES (Read-only)
-- ====================

CREATE POLICY "Allow all for authenticated users - audit_logs select"
ON audit_logs FOR SELECT
USING (auth.uid() IS NOT NULL);

-- ============================================
-- ✅ تم الانتهاء من تطبيق RLS المحسّن
-- ============================================

-- الحالة الآن:
-- ✅ RLS مفعّل على جميع الجداول
-- ✅ المستخدمون المُصادق عليهم يمكنهم الوصول
-- ✅ استخدام auth.uid() IS NOT NULL بدلاً من auth.role()
