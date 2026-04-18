-- 1. إعادة بناء جدول المستخدمين من الصفر لضمان صحة الأعمدة
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'supervisor', 'doctor', 'storekeeper', 'partner')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 2. تفعيل الحماية (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 3. السماح بالقراءة للجميع (لتسجيل الدخول)
CREATE POLICY "Enable read access for all users" ON users FOR SELECT USING (true);

-- 4. السماح بالإضافة والتعديل والحذف للأدمن فقط
CREATE POLICY "Enable write access for admins" ON users FOR INSERT WITH CHECK (role = 'admin' OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Enable update access for admins" ON users FOR UPDATE USING (role = 'admin' OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Enable delete access for admins" ON users FOR DELETE USING (role = 'admin' OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- 5. إضافة المستخدمين (البيانات الأولية)
INSERT INTO users (name, email, phone, password_hash, role, status)
VALUES 
('مدير النظام', 'admin@hospital.com', '01000000000', 'admin123', 'admin', 'active'),
('مشرف', 'supervisor@hospital.com', '01111111111', 'super123', 'supervisor', 'active'),
('د. أحمد حسن', 'doctor@hospital.com', '01222222222', 'doctor123', 'doctor', 'active'),
('أمين مخزن', 'storekeeper@hospital.com', '01333333333', 'store123', 'storekeeper', 'active'),
('شريك', 'partner@hospital.com', '01444444444', 'partner123', 'partner', 'active');
