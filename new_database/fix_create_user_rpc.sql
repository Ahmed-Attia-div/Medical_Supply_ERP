-- ============================================================
-- Fix User Creation — Bypass broken RPC, use direct INSERT
-- Run this in Supabase -> SQL Editor -> Run
-- ============================================================

-- 1. Create a tiny helper RPC that just hashes a password
-- (We can't do bcrypt hashing in the browser, so we need this)
CREATE OR REPLACE FUNCTION hash_password(p_password TEXT)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER AS $$
    SELECT crypt(p_password, gen_salt('bf', 10));
$$;

-- 2. Allow anon/authenticated to call it
GRANT EXECUTE ON FUNCTION hash_password(TEXT) TO anon, authenticated;

-- 3. Allow anon/authenticated to INSERT into users table
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO anon, authenticated;

-- 4. Disable RLS on users table (since we use custom auth, not Supabase Auth)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 5. Force PostgREST to pick up the new function
NOTIFY pgrst, 'reload schema';

SELECT '✅ تم - الآن يمكنك إضافة مستخدم جديد مباشرة' AS status;
