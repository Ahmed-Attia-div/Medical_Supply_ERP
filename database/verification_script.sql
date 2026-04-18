-- ============================================
-- 🔍 سكريبت التحقق السريع من الإصلاحات
-- Verification Script
-- استخدم هذا السكريبت للتحقق من تطبيق جميع الإصلاحات بنجاح
-- ============================================

-- ============================================
-- 1. التحقق من وجود Functions الجديدة
-- ============================================

SELECT 
    'Functions Check' as check_type,
    routine_name,
    routine_type,
    CASE 
        WHEN routine_name IN (
            'sync_product_quantity_on_purchase',
            'sync_product_quantity_on_transaction',
            'check_product_quantity_before_transaction',
            'audit_trigger_function'
        ) THEN '✅ Exists'
        ELSE '❌ Missing'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'sync_product_quantity_on_purchase',
    'sync_product_quantity_on_transaction',
    'check_product_quantity_before_transaction',
    'audit_trigger_function'
)
ORDER BY routine_name;

-- ============================================
-- 2. التحقق من Triggers
-- ============================================

SELECT 
    'Triggers Check' as check_type,
    trigger_name,
    event_object_table as table_name,
    event_manipulation as event,
    '✅ Active' as status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND (
    trigger_name LIKE 'trigger_sync_product%' OR
    trigger_name LIKE 'check_quantity%' OR
    trigger_name LIKE 'audit_%'
)
ORDER BY event_object_table, trigger_name;

-- ============================================
-- 3. التحقق من Views
-- ============================================

SELECT 
    'Views Check' as check_type,
    table_name as view_name,
    CASE 
        WHEN table_name IN (
            'dashboard_stats',
            'low_stock_items_top',
            'recent_surgeries_top',
            'low_stock_items',
            'dead_stock_items',
            'inventory_value_summary',
            'surgery_profitability'
        ) THEN '✅ Exists'
        ELSE '❌ Unknown'
    END as status
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name IN (
    'dashboard_stats',
    'low_stock_items_top',
    'recent_surgeries_top',
    'low_stock_items',
    'dead_stock_items',
    'inventory_value_summary',
    'surgery_profitability'
)
ORDER BY table_name;

-- ============================================
-- 4. التحقق من جدول Audit Logs
-- ============================================

SELECT 
    'Audit Logs Table' as check_type,
    table_name,
    CASE 
        WHEN table_name = 'audit_logs' THEN '✅ Exists'
        ELSE '❌ Missing'
    END as status,
    (SELECT COUNT(*) FROM audit_logs) as records_count
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'audit_logs';

-- ============================================
-- 5. التحقق من Indexes
-- ============================================

SELECT 
    'Indexes Check' as check_type,
    indexname as index_name,
    tablename as table_name,
    '✅ Active' as status
FROM pg_indexes
WHERE schemaname = 'public'
AND (
    indexname LIKE 'idx_products%' OR
    indexname LIKE 'idx_audit%' OR
    indexname LIKE 'idx_inventory%' OR
    indexname LIKE 'idx_purchase%' OR
    indexname LIKE 'idx_surgeries%'
)
ORDER BY tablename, indexname;

-- ============================================
-- 6. التحقق من pg_trgm Extension
-- ============================================

SELECT 
    'Extensions Check' as check_type,
    extname as extension_name,
    extversion as version,
    '✅ Installed' as status
FROM pg_extension
WHERE extname IN ('uuid-ossp', 'pg_trgm')
ORDER BY extname;

-- ============================================
-- 7. التحقق من Foreign Key Constraints
-- ============================================

SELECT 
    'Foreign Keys Check' as check_type,
    tc.table_name,
    tc.constraint_name,
    rc.delete_rule as on_delete,
    CASE 
        WHEN rc.delete_rule = 'CASCADE' THEN '✅ CASCADE'
        WHEN rc.delete_rule = 'RESTRICT' THEN '⚠️ RESTRICT'
        ELSE '❓ ' || rc.delete_rule
    END as status
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc 
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================
-- 8. ملخص عام
-- ============================================

SELECT 
    '═══════════════════════════════════════' as separator,
    'SUMMARY REPORT' as title,
    '═══════════════════════════════════════' as separator2;

SELECT 
    'Functions' as component,
    COUNT(*) as total,
    CASE WHEN COUNT(*) >= 4 THEN '✅ OK' ELSE '❌ INCOMPLETE' END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'sync_product_quantity_on_purchase',
    'sync_product_quantity_on_transaction',
    'check_product_quantity_before_transaction',
    'audit_trigger_function'
);

SELECT 
    'Triggers' as component,
    COUNT(*) as total,
    CASE WHEN COUNT(*) >= 10 THEN '✅ OK' ELSE '❌ INCOMPLETE' END as status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND (
    trigger_name LIKE 'trigger_sync_product%' OR
    trigger_name LIKE 'check_quantity%' OR
    trigger_name LIKE 'audit_%'
);

SELECT 
    'Views' as component,
    COUNT(*) as total,
    CASE WHEN COUNT(*) >= 3 THEN '✅ OK' ELSE '❌ INCOMPLETE' END as status
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name IN (
    'dashboard_stats',
    'low_stock_items_top',
    'recent_surgeries_top'
);

SELECT 
    'Audit Table' as component,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs')
        THEN 1 
        ELSE 0 
    END as total,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs')
        THEN '✅ OK' 
        ELSE '❌ MISSING' 
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
LIMIT 1;

-- ============================================
-- 9. اختبار بسيط للـ Dashboard Stats View
-- ============================================

SELECT 
    '═══════════════════════════════════════' as separator,
    'DASHBOARD STATS TEST' as title,
    '═══════════════════════════════════════' as separator2;

SELECT * FROM dashboard_stats;

-- ============================================
-- 10. آخر 5 سجلات في Audit Logs
-- ============================================

SELECT 
    '═══════════════════════════════════════' as separator,
    'RECENT AUDIT LOGS' as title,
    '═══════════════════════════════════════' as separator2;

SELECT 
    table_name,
    operation,
    user_id,
    created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 5;

-- ============================================
-- ✅ انتهى السكريبت
-- ============================================
-- إذا رأيت معظم العناصر بعلامة ✅، فالإصلاحات تم تطبيقها بنجاح!
-- إذا رأيت ❌ أو أخطاء، تحقق من تطبيق ملف supabase_critical_fixes.sql
-- ============================================
