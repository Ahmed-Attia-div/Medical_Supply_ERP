-- 1. First, check if updated_at exists on invoices table. If not, add it.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Drop the existing function to avoid signature conflicts.
DROP FUNCTION IF EXISTS update_invoice_payment(UUID, NUMERIC);

-- 3. Re-create the function cleanly without strict failure.
CREATE OR REPLACE FUNCTION update_invoice_payment(
    p_invoice_id   UUID,
    p_amount_paid  NUMERIC
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE invoices 
    SET amount_paid = p_amount_paid,
        updated_at = NOW() -- explicitly set to avoid relying solely on missing triggers
    WHERE id = p_invoice_id;
END;
$$;
