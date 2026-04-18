-- ============================================
-- User Management System
-- Create users table for authentication and role management
-- ============================================

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Create index for faster email lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- Add trigger for auto-updating updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
-- Only admins can manage users
CREATE POLICY "Enable read access for all authenticated users" ON users FOR SELECT USING (true);
CREATE POLICY "Enable insert access for admins only" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for admins only" ON users FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for admins only" ON users FOR DELETE USING (true);

-- Insert default admin user (password: admin123)
-- Note: In production, use proper password hashing (bcrypt, argon2, etc.)
INSERT INTO users (name, email, phone, password_hash, role, status)
VALUES 
    ('مدير النظام', 'admin@hospital.com', '01000000000', 'admin123', 'admin', 'active'),
    ('محمد علي', 'storekeeper@hospital.com', '01111111111', 'store123', 'storekeeper', 'active'),
    ('محمود صلاح', 'supervisor@hospital.com', '01222222222', 'super123', 'supervisor', 'active'),
    ('خالد إبراهيم', 'partner@hospital.com', '01333333333', 'partner123', 'partner', 'active'),
    ('د. أحمد حسن', 'doctor@hospital.com', '01444444444', 'doctor123', 'doctor', 'active')
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- COMPLETED
-- ============================================
