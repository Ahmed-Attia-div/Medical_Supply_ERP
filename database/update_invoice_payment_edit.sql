-- Add Payment Type to Invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_type TEXT CHECK (payment_type IN ('cash', 'credit')) DEFAULT 'cash';

-- Update RPC to include Payment Type
CREATE OR REPLACE FUNCTION create_invoice_transaction(
    p_supplier_id UUID,
    p_invoice_date DATE,
    p_vendor_invoice_number TEXT,
    p_notes TEXT,
    p_total_amount NUMERIC,
    p_items JSONB,
    p_created_by UUID,
    p_payment_type TEXT DEFAULT 'cash' -- New Parameter
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invoice_id UUID;
    v_item JSONB;
BEGIN
    -- 1. Create Invoice
    INSERT INTO invoices (supplier_id, invoice_date, vendor_invoice_number, notes, total_amount, created_by, payment_type)
    VALUES (p_supplier_id, p_invoice_date, p_vendor_invoice_number, p_notes, p_total_amount, p_created_by, p_payment_type)
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

-- RPC to update Invoice Item and propagate to Product (Inventory)
CREATE OR REPLACE FUNCTION update_invoice_item_details(
    p_item_id UUID,
    p_batch_no TEXT,
    p_expiry_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_product_id UUID;
BEGIN
    -- 1. Get Product ID from the invoice item
    SELECT product_id INTO v_product_id FROM invoice_items WHERE id = p_item_id;

    -- 2. Update Invoice Item
    UPDATE invoice_items
    SET batch_no = p_batch_no, expiry_date = p_expiry_date
    WHERE id = p_item_id;

    -- 3. Update Product (Inventory Item) - Correcting the current stock details
    UPDATE products
    SET batch_no = p_batch_no, expiry_date = p_expiry_date, updated_at = NOW()
    WHERE id = v_product_id;
END;
$$;
