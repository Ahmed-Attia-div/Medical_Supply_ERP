-- Fix Doctors Table
-- Make specialty and hospital nullable (hospital is being phased out)
-- Run this in Supabase SQL Editor

-- 1. Make specialty nullable (optional field)
ALTER TABLE doctors ALTER COLUMN specialty DROP NOT NULL;

-- 2. Make hospital nullable (being removed from the app)
ALTER TABLE doctors ALTER COLUMN hospital DROP NOT NULL;

-- 3. Clean up existing "غير محدد" values to NULL
UPDATE doctors SET specialty = NULL WHERE specialty = 'غير محدد';
UPDATE doctors SET hospital = NULL WHERE hospital = 'غير محدد';

-- 4. Remove duplicate doctors (keep the first one created)
DELETE FROM doctors
WHERE id NOT IN (
    SELECT DISTINCT ON (name) id
    FROM doctors
    ORDER BY name, created_at ASC
)
AND id NOT IN (
    SELECT DISTINCT doctor_id FROM surgeries WHERE doctor_id IS NOT NULL
);

-- Done ✅
SELECT 'Doctors table fixed successfully' AS status;
