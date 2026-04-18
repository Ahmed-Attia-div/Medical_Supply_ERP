-- تعديل سياسات الأمان للسماح للجميع بتعديل بياناتهم
-- هذا ضروري لأننا نستخدم نظام تسجيل دخول مخصص
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- السماح بالقراءة للجميع
CREATE POLICY "Enable read access for all" ON users FOR SELECT USING (true);

-- السماح بالتعديل للجميع (لتحديث الملف الشخصي)
CREATE POLICY "Enable update access for all" ON users FOR UPDATE USING (true);

-- الإضافة والحذف للأدمن فقط
CREATE POLICY "Enable insert for admins" ON users FOR INSERT WITH CHECK (role = 'admin' OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Enable delete for admins" ON users FOR DELETE USING (role = 'admin' OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin');
