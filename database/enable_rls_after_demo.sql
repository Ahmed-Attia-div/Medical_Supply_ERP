-- ============================================
-- 🔐 تفعيل RLS المحسّن بعد العرض التجريبي
-- Enable Improved RLS After Demo
-- ============================================

-- 📌 استخدم هذا الملف بعد انتهاء العرض التجريبي
-- 📌 لا ترجع للـ Policies القديمة (USING true) - كانت ضعيفة!

-- ============================================
-- الخطوة 1: تفعيل RLS على جميع الجداول
-- ============================================

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgeries ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrap_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- الخطوة 2: تطبيق السياسات المحسّنة
-- ============================================

-- سيقوم هذا بتطبيق السياسات من ملف fixed_rls_policies.sql
-- تأكد من تشغيل ذلك الملف بعد هذا الملف

-- ============================================
-- ✅ تم تفعيل RLS
-- ============================================

-- الخطوات التالية:
-- 1. شغّل هذا الملف أولاً
-- 2. ثم شغّل fixed_rls_policies.sql
-- 3. جرّب النظام للتأكد من أن كل شيء يعمل
