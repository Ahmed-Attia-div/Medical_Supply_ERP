-- ============================================
-- 🔧 تعطيل RLS مؤقتاً للتطوير
-- TEMPORARY: Disable RLS for Development
-- ============================================

-- ⚠️ استخدم هذا فقط في بيئة التطوير
-- ⚠️ لا تستخدمه في الإنتاج

-- تعطيل RLS على جميع الجداول
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE doctors DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE surgeries DISABLE ROW LEVEL SECURITY;
ALTER TABLE surgery_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE scrap_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- ============================================
-- ✅ تم تعطيل RLS
-- ============================================

-- الحالة: النظام سيعمل بشكل طبيعي الآن
-- للتفعيل مرة أخرى: استخدم ALTER TABLE ... ENABLE ROW LEVEL SECURITY
