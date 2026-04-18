-- ============================================
-- 🎬 بيانات تجريبية للعرض
-- Demo Seed Data
-- ============================================

-- ملاحظة: شغّل هذا بعد ما تطبق disable_rls_temp.sql

-- ============================================
-- 1. إضافة موردين
-- ============================================

INSERT INTO suppliers (name, phone, email, address) VALUES
('شركة المستلزمات الطبية المتحدة', '01012345678', 'info@medical-united.com', 'القاهرة، مصر الجديدة'),
('الشركة الدولية للأجهزة الطبية', '01098765432', 'sales@international-medical.com', 'الجيزة، المهندسين'),
('مؤسسة النور للمستلزمات الطبية', '01123456789', 'contact@alnour-medical.com', 'الإسكندرية')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. إضافة أطباء
-- ============================================

INSERT INTO doctors (name, specialty, hospital, phone) VALUES
('د. أحمد محمود', 'جراحة عظام', 'مستشفى دار الفؤاد', '01011223344'),
('د. محمد حسن', 'جراحة مخ وأعصاب', 'مستشفى السلام الدولي', '01055667788'),
('د. سارة علي', 'جراحة عظام', 'مستشفى القصر العيني', '01099887766'),
('د. خالد إبراهيم', 'جراحة عمود فقري', 'مستشفى الشيخ زايد', '01044556677')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. إضافة منتجات متنوعة
-- ============================================

-- مسامير Pedicle Screws
INSERT INTO products (name, sku, category, material, diameter, length, quantity, min_stock, base_price, selling_price, created_by) VALUES
('Pedicle Screw', 'PS-TI-5.5-45', 'screws', 'titanium', '5.5mm', '45mm', 50, 10, 250, 450, 'system'),
('Pedicle Screw', 'PS-TI-6.5-50', 'screws', 'titanium', '6.5mm', '50mm', 35, 10, 280, 500, 'system'),
('Pedicle Screw', 'PS-TI-5.5-40', 'screws', 'titanium', '5.5mm', '40mm', 45, 10, 240, 440, 'system'),
('Pedicle Screw', 'PS-SS-5.5-45', 'screws', 'stainless', '5.5mm', '45mm', 60, 15, 180, 350, 'system')
ON CONFLICT (sku) DO NOTHING;

-- قضبان Rods
INSERT INTO products (name, sku, category, material, diameter, length, quantity, min_stock, base_price, selling_price, created_by) VALUES
('Spinal Rod', 'ROD-TI-5.5-300', 'rods', 'titanium', '5.5mm', '300mm', 25, 8, 400, 700, 'system'),
('Spinal Rod', 'ROD-TI-5.5-350', 'rods', 'titanium', '5.5mm', '350mm', 20, 8, 450, 750, 'system'),
('Spinal Rod', 'ROD-TI-6.0-300', 'rods', 'titanium', '6.0mm', '300mm', 18, 5, 420, 720, 'system')
ON CONFLICT (sku) DO NOTHING;

-- أقفاص Cages
INSERT INTO products (name, sku, category, material, length, quantity, min_stock, base_price, selling_price, created_by) VALUES
('TLIF Cage', 'CAGE-PEEK-12', 'cages', 'peek', '12mm', 15, 5, 800, 1400, 'system'),
('TLIF Cage', 'CAGE-PEEK-14', 'cages', 'peek', '14mm', 12, 5, 850, 1450, 'system'),
('ALIF Cage', 'CAGE-TI-15', 'cages', 'titanium', '15mm', 10, 3, 900, 1500, 'system')
ON CONFLICT (sku) DO NOTHING;

-- صفائح Plates  
INSERT INTO products (name, sku, category, material, length, quantity, min_stock, base_price, selling_price, created_by) VALUES
('Cervical Plate', 'PLT-TI-4H', 'plates', 'titanium', '4-holes', 8, 3, 600, 1100, 'system'),
('Cervical Plate', 'PLT-TI-6H', 'plates', 'titanium', '6-holes', 6, 2, 700, 1200, 'system')
ON CONFLICT (sku) DO NOTHING;

-- أدوات Tools
INSERT INTO products (name, sku, category, quantity, min_stock, base_price, selling_price, created_by) VALUES
('Screwdriver Set', 'TOOL-SD-SET', 'tools', 5, 2, 1500, 2500, 'system'),
('Rod Bender', 'TOOL-RB-01', 'tools', 3, 1, 2000, 3200, 'system')
ON CONFLICT (sku) DO NOTHING;

-- منتجات منخفضة المخزون (للتوضيح)
INSERT INTO products (name, sku, category, material, diameter, length, quantity, min_stock, base_price, selling_price, created_by) VALUES
('Pedicle Screw', 'PS-TI-5.5-35', 'screws', 'titanium', '5.5mm', '35mm', 8, 15, 230, 430, 'system'),
('Spinal Rod', 'ROD-TI-5.5-250', 'rods', 'titanium', '5.5mm', '250mm', 4, 8, 380, 680, 'system')
ON CONFLICT (sku) DO NOTHING;

-- ============================================
-- 4. إضافة فواتير شراء
-- ============================================

-- فاتورة 1
INSERT INTO purchase_invoices (supplier_id, supplier_name, item_id, item_name, quantity, unit_cost, total_cost, date, notes, created_by, is_locked)
SELECT 
    s.id,
    s.name,
    p.id,
    p.name || ' - ' || COALESCE(p.diameter, '') || ' - ' || COALESCE(p.length, ''),
    20,
    p.base_price,
    20 * p.base_price,
    CURRENT_DATE - INTERVAL '15 days',
    'فاتورة شراء - دفعة جديدة',
    'system',
    true
FROM suppliers s, products p
WHERE s.name = 'شركة المستلزمات الطبية المتحدة'
AND p.sku = 'PS-TI-5.5-45'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- فاتورة 2
INSERT INTO purchase_invoices (supplier_id, supplier_name, item_id, item_name, quantity, unit_cost, total_cost, date, notes, created_by, is_locked)
SELECT 
    s.id,
    s.name,
    p.id,
    p.name || ' - ' || COALESCE(p.diameter, '') || ' - ' || COALESCE(p.length, ''),
    15,
    p.base_price,
    15 * p.base_price,
    CURRENT_DATE - INTERVAL '10 days',
    'تجديد المخزون',
    'system',
    true
FROM suppliers s, products p
WHERE s.name = 'الشركة الدولية للأجهزة الطبية'
AND p.sku = 'CAGE-PEEK-12'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 5. إضافة عمليات جراحية
-- ============================================

-- عملية 1
DO $$
DECLARE
    surgery_id UUID;
    doctor_rec RECORD;
    product_rec RECORD;
BEGIN
    -- اختيار طبيب
    SELECT id, name INTO doctor_rec FROM doctors WHERE name = 'د. أحمد محمود' LIMIT 1;
    
    -- إنشاء العملية
    INSERT INTO surgeries (doctor_id, doctor_name, patient_name, date, type, notes, created_by)
    VALUES (
        doctor_rec.id,
        doctor_rec.name,
        'محمد أحمد سالم',
        CURRENT_DATE - INTERVAL '5 days',
        'surgery',
        'عملية تثبيت فقرات قطنية - L4-L5',
        'system'
    )
    RETURNING id INTO surgery_id;
    
    -- إضافة العناصر
    FOR product_rec IN 
        SELECT id, name, base_price, selling_price 
        FROM products 
        WHERE sku IN ('PS-TI-5.5-45', 'ROD-TI-5.5-300')
    LOOP
        INSERT INTO surgery_items (surgery_id, item_id, item_name, quantity, base_price, selling_price)
        VALUES (
            surgery_id,
            product_rec.id,
            product_rec.name,
            CASE WHEN product_rec.name LIKE '%Screw%' THEN 4 ELSE 2 END,
            product_rec.base_price,
            product_rec.selling_price
        );
    END LOOP;
END $$;

-- عملية 2
DO $$
DECLARE
    surgery_id UUID;
    doctor_rec RECORD;
    product_rec RECORD;
BEGIN
    SELECT id, name INTO doctor_rec FROM doctors WHERE name = 'د. محمد حسن' LIMIT 1;
    
    INSERT INTO surgeries (doctor_id, doctor_name, patient_name, date, type, notes, created_by)
    VALUES (
        doctor_rec.id,
        doctor_rec.name,
        'فاطمة حسن علي',
        CURRENT_DATE - INTERVAL '3 days',
        'surgery',
        'عملية دمج فقرات عنقية - C5-C6',
        'system'
    )
    RETURNING id INTO surgery_id;
    
    FOR product_rec IN 
        SELECT id, name, base_price, selling_price 
        FROM products 
        WHERE sku IN ('PLT-TI-4H', 'PS-TI-5.5-40')
    LOOP
        INSERT INTO surgery_items (surgery_id, item_id, item_name, quantity, base_price, selling_price)
        VALUES (
            surgery_id,
            product_rec.id,
            product_rec.name,
            CASE WHEN product_rec.name LIKE '%Plate%' THEN 1 ELSE 4 END,
            product_rec.base_price,
            product_rec.selling_price
        );
    END LOOP;
END $$;

-- عملية 3 (حديثة)
DO $$
DECLARE
    surgery_id UUID;
    doctor_rec RECORD;
    product_rec RECORD;
BEGIN
    SELECT id, name INTO doctor_rec FROM doctors WHERE name = 'د. سارة علي' LIMIT 1;
    
    INSERT INTO surgeries (doctor_id, doctor_name, patient_name, date, type, notes, created_by)
    VALUES (
        doctor_rec.id,
        doctor_rec.name,
        'عبدالله محمود إبراهيم',
        CURRENT_DATE - INTERVAL '1 day',
        'surgery',
        'عملية تثبيت فقرات قطنية - L3-L4-L5',
        'system'
    )
    RETURNING id INTO surgery_id;
    
    FOR product_rec IN 
        SELECT id, name, base_price, selling_price 
        FROM products 
        WHERE sku IN ('PS-TI-6.5-50', 'ROD-TI-5.5-350', 'CAGE-PEEK-14')
    LOOP
        INSERT INTO surgery_items (surgery_id, item_id, item_name, quantity, base_price, selling_price)
        VALUES (
            surgery_id,
            product_rec.id,
            product_rec.name,
            CASE 
                WHEN product_rec.name LIKE '%Screw%' THEN 6
                WHEN product_rec.name LIKE '%Rod%' THEN 2
                ELSE 1
            END,
            product_rec.base_price,
            product_rec.selling_price
        );
    END LOOP;
END $$;

-- ============================================
-- ✅ تم إضافة البيانات التجريبية
-- ============================================

-- الآن لديك:
-- ✅ 3 موردين
-- ✅ 4 أطباء
-- ✅ 15+ منتج متنوع
-- ✅ فواتير شراء
-- ✅ 3 عمليات جراحية بتفاصيل واقعية

-- النظام جاهز للعرض التجريبي! 🎉
