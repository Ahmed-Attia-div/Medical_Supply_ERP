-- Create Invoices Table (Master)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    vendor_invoice_number TEXT,
    notes TEXT,
    total_amount NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- FIX: Ensure created_by references users, not auth.users
DO $$
BEGIN
    -- 1. Drop the incorrect constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'invoices_created_by_fkey'
        AND table_name = 'invoices'
    ) THEN
        ALTER TABLE invoices DROP CONSTRAINT invoices_created_by_fkey;
    END IF;

    -- 2. Add the correct constraint if not exists
    ALTER TABLE invoices
    ADD CONSTRAINT invoices_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES users(id) 
    ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not add constraint to users. Table might not exist yet.';
END $$;

-- Create Invoice Items Table (Detail)
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(12, 2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
    batch_no TEXT,
    expiry_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add Columns to Products Items if they don't exist
ALTER TABLE products ADD COLUMN IF NOT EXISTS batch_no TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- RPC Function for Transactional Invoice Creation
CREATE OR REPLACE FUNCTION create_invoice_transaction(
    p_supplier_id UUID,
    p_invoice_date DATE,
    p_vendor_invoice_number TEXT,
    p_notes TEXT,
    p_total_amount NUMERIC,
    p_items JSONB, -- Array of objects: { product_id, quantity, unit_cost, batch_no, expiry_date }
    p_created_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
-- Note: Security Definer allows this function to write to tables even if the user has loose permissions,
-- BUT created_by is passed explicitly so we don't rely on auth.uid().
AS $$
DECLARE
    v_invoice_id UUID;
    v_item JSONB;
BEGIN
    -- 1. Create Invoice
    INSERT INTO invoices (supplier_id, invoice_date, vendor_invoice_number, notes, total_amount, created_by)
    VALUES (p_supplier_id, p_invoice_date, p_vendor_invoice_number, p_notes, p_total_amount, p_created_by)
    RETURNING id INTO v_invoice_id;

    -- 2. Process Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Insert Invoice Item
        INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_cost, batch_no, expiry_date)
        VALUES (
            v_invoice_id,
            (v_item->>'product_id')::UUID,
            (v_item->>'quantity')::INTEGER,
            (v_item->>'unit_cost')::NUMERIC,
            v_item->>'batch_no',
            (v_item->>'expiry_date')::DATE
        );

        -- Update Inventory Item (Stock, Price, Batch, Expiry)
        UPDATE products
        SET 
            quantity = quantity + (v_item->>'quantity')::INTEGER,
            base_price = (v_item->>'unit_cost')::NUMERIC,
            batch_no = v_item->>'batch_no',
            expiry_date = (v_item->>'expiry_date')::DATE,
            updated_at = NOW()
        WHERE id = (v_item->>'product_id')::UUID;
    END LOOP;

    RETURN v_invoice_id;
END;
$$;
