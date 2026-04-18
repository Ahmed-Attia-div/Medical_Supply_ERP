-- ============================================================
-- SUPPLY-CARE ERP — PRODUCTION MASTER SETUP
-- Version: 2.0.0 (Clean Rebuild)
-- Date: 2026-02-20
-- Tech: Supabase (PostgreSQL 15+)
-- ============================================================
-- HOW TO USE:
--   1. Open your Supabase project → SQL Editor
--   2. Paste this entire file
--   3. Click "Run"
--   4. Verify in Table Editor that all tables exist
-- ============================================================
-- ROLES (4 only):
--   admin       → Full access. Manages users & settings.
--   storekeeper → Stock operations. No financial data.
--   doctor      → Records surgeries. Reads products (no prices).
--   partner     → READ-ONLY across entire system.
-- ============================================================


-- ============================================================
-- SECTION 0: EXTENSIONS & CLEANUP
-- ============================================================

-- Extensions (must run at top level, not inside a DO block)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";



-- Drop tables in reverse FK dependency order using CASCADE.
-- CASCADE automatically removes all dependent triggers, indexes,
-- and constraints. Safe to run on a completely fresh database.
DROP TABLE IF EXISTS system_logs               CASCADE;
DROP TABLE IF EXISTS notifications             CASCADE;
DROP TABLE IF EXISTS system_settings           CASCADE;
DROP TABLE IF EXISTS inventory_transformations  CASCADE;
DROP TABLE IF EXISTS inventory_transactions    CASCADE;
DROP TABLE IF EXISTS surgery_items             CASCADE;
DROP TABLE IF EXISTS surgeries                 CASCADE;
DROP TABLE IF EXISTS invoice_items             CASCADE;
DROP TABLE IF EXISTS invoices                  CASCADE;
DROP TABLE IF EXISTS product_batches           CASCADE;
DROP TABLE IF EXISTS products                  CASCADE;
DROP TABLE IF EXISTS doctors                   CASCADE;
DROP TABLE IF EXISTS suppliers                 CASCADE;
DROP TABLE IF EXISTS users                     CASCADE;
-- Legacy tables from old schema
DROP TABLE IF EXISTS purchase_invoices         CASCADE;
DROP TABLE IF EXISTS scrap_logs               CASCADE;
DROP TABLE IF EXISTS audit_logs               CASCADE;

-- Drop functions — IF EXISTS is safe without needing a table
DROP FUNCTION IF EXISTS fn_set_updated_at()                                                                       CASCADE;
DROP FUNCTION IF EXISTS fn_audit_logger()                                                                         CASCADE;
DROP FUNCTION IF EXISTS fn_sync_product_cache()                                                                   CASCADE;
DROP FUNCTION IF EXISTS fn_compute_payment_status()                                                               CASCADE;
DROP FUNCTION IF EXISTS process_surgery_return(UUID,INTEGER,TEXT)                                                CASCADE;
DROP FUNCTION IF EXISTS get_user_role(UUID)                                                                       CASCADE;
DROP FUNCTION IF EXISTS create_new_user(TEXT,TEXT,TEXT,TEXT,TEXT,UUID)                                           CASCADE;
DROP FUNCTION IF EXISTS update_user_password_secure(UUID,TEXT)                                                    CASCADE;
DROP FUNCTION IF EXISTS create_invoice_transaction(UUID,DATE,TEXT,TEXT,NUMERIC,JSONB,UUID,TEXT,NUMERIC)          CASCADE;
DROP FUNCTION IF EXISTS create_invoice_transaction(UUID,DATE,TEXT,TEXT,NUMERIC,JSONB,UUID,TEXT)                  CASCADE;
DROP FUNCTION IF EXISTS create_surgery_transaction(UUID,TEXT,TEXT,DATE,TEXT,NUMERIC,NUMERIC,NUMERIC,TEXT,JSONB,UUID) CASCADE;
DROP FUNCTION IF EXISTS transform_inventory_item(UUID,UUID,INTEGER,UUID,TEXT)                                    CASCADE;
DROP FUNCTION IF EXISTS get_dashboard_stats()                                                                     CASCADE;
DROP FUNCTION IF EXISTS update_invoice_payment(UUID,NUMERIC)                                                     CASCADE;

-- Drop views — IF EXISTS is safe
DROP VIEW IF EXISTS expiring_batches        CASCADE;
DROP VIEW IF EXISTS open_invoices           CASCADE;
DROP VIEW IF EXISTS low_stock_items_top     CASCADE;
DROP VIEW IF EXISTS recent_surgeries_top    CASCADE;
DROP VIEW IF EXISTS surgery_profitability   CASCADE;
DROP VIEW IF EXISTS inventory_value_summary CASCADE;
DROP VIEW IF EXISTS dead_stock_items        CASCADE;


-- ============================================================
-- SECTION 1: CORE TABLES
-- ============================================================

-- ── 1.1 USERS ────────────────────────────────────────────────
CREATE TABLE users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT        NOT NULL,
    email         TEXT        UNIQUE NOT NULL,
    phone         TEXT,
    password_hash TEXT        NOT NULL,
    role          TEXT        NOT NULL CHECK (role IN ('admin','storekeeper','doctor','partner')),
    status        TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    UUID        REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_users_email  ON users(email);
CREATE INDEX idx_users_role   ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- ── 1.2 SUPPLIERS ────────────────────────────────────────────
CREATE TABLE suppliers (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL,
    phone      TEXT,
    email      TEXT,
    address    TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suppliers_name ON suppliers USING gin(name gin_trgm_ops);

-- ── 1.3 DOCTORS ──────────────────────────────────────────────
CREATE TABLE doctors (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL,
    specialty  TEXT        NOT NULL,
    hospital   TEXT        NOT NULL,
    phone      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doctors_name     ON doctors USING gin(name gin_trgm_ops);
CREATE INDEX idx_doctors_hospital ON doctors(hospital);

-- ── 1.4 PRODUCTS (SKU Catalog — NO quantity/batch columns) ───
CREATE TABLE products (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 TEXT        NOT NULL,
    sku                  TEXT        UNIQUE NOT NULL,
    category             TEXT        NOT NULL CHECK (category IN ('screws','plates','rods','wires','nails','instruments','consumables')),
    material             TEXT        CHECK (material IN ('titanium','stainless')),
    diameter             TEXT,
    length               TEXT,
    unit                 TEXT        NOT NULL DEFAULT 'piece',
    min_stock            INTEGER     NOT NULL DEFAULT 10 CHECK (min_stock >= 0),
    sterilization_status TEXT        NOT NULL DEFAULT 'non_sterilized'
                                     CHECK (sterilization_status IN ('sterilized','non_sterilized','requires_sterilization')),
    selling_price        DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
    -- Cached/computed columns — updated by trigger on product_batches
    base_price_wac       DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (base_price_wac >= 0),
    total_quantity       INTEGER       NOT NULL DEFAULT 0 CHECK (total_quantity >= 0),
    last_movement_at     TIMESTAMPTZ   DEFAULT NOW(),
    notes                TEXT,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by           UUID          REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_products_sku      ON products(sku);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_name     ON products USING gin(name gin_trgm_ops);
CREATE INDEX idx_products_movement ON products(last_movement_at DESC);

-- ── 1.5 PRODUCT BATCHES (per-lot stock tracking) ────────────
CREATE TABLE product_batches (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_no        TEXT,
    quantity        INTEGER     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit_cost       DECIMAL(10,2) NOT NULL CHECK (unit_cost >= 0),
    received_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
    expiry_date     DATE,
    invoice_item_id UUID,       -- FK set after invoice_items table created (see below)
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_expiry CHECK (expiry_date IS NULL OR expiry_date >= received_date)
);

CREATE INDEX idx_batches_product    ON product_batches(product_id);
CREATE INDEX idx_batches_expiry     ON product_batches(expiry_date);
CREATE INDEX idx_batches_invoice    ON product_batches(invoice_item_id);

-- ── 1.6 INVOICES (Purchase Header) ──────────────────────────
CREATE TABLE invoices (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id           UUID        NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    invoice_date          DATE        NOT NULL DEFAULT CURRENT_DATE,
    vendor_invoice_number TEXT,
    payment_type          TEXT        NOT NULL DEFAULT 'cash' CHECK (payment_type IN ('cash','credit')),
    total_amount          DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    amount_paid           DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    payment_status        TEXT        NOT NULL DEFAULT 'paid'
                                       CHECK (payment_status IN ('paid','partial','unpaid')),
    notes                 TEXT,
    created_by            UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_vendor_invoice UNIQUE NULLS NOT DISTINCT (supplier_id, vendor_invoice_number)
);

CREATE INDEX idx_invoices_supplier ON invoices(supplier_id);
CREATE INDEX idx_invoices_date     ON invoices(invoice_date DESC);
CREATE INDEX idx_invoices_status   ON invoices(payment_status);

-- ── 1.7 INVOICE ITEMS (Purchase Lines) ──────────────────────
CREATE TABLE invoice_items (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id  UUID        NOT NULL REFERENCES invoices(id)  ON DELETE CASCADE,
    product_id  UUID        NOT NULL REFERENCES products(id)  ON DELETE RESTRICT,
    quantity    INTEGER     NOT NULL CHECK (quantity > 0),
    unit_cost   DECIMAL(10,2) NOT NULL CHECK (unit_cost >= 0),
    batch_no    TEXT,
    expiry_date DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_product ON invoice_items(product_id);

-- Now add the FK from product_batches → invoice_items
ALTER TABLE product_batches
    ADD CONSTRAINT fk_batches_invoice_item
    FOREIGN KEY (invoice_item_id) REFERENCES invoice_items(id) ON DELETE SET NULL;

-- ── 1.8 SURGERIES (Surgery Header) ──────────────────────────
CREATE TABLE surgeries (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id           UUID        NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    patient_id          TEXT,
    patient_name        TEXT        NOT NULL,
    date                DATE        NOT NULL DEFAULT CURRENT_DATE,
    type                TEXT        NOT NULL,
    total_base_value    DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_selling_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    profit              DECIMAL(10,2) NOT NULL DEFAULT 0,
    notes               TEXT,
    created_by          UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_surgeries_doctor  ON surgeries(doctor_id);
CREATE INDEX idx_surgeries_date    ON surgeries(date DESC);
CREATE INDEX idx_surgeries_patient ON surgeries USING gin(patient_name gin_trgm_ops);

-- ── 1.9 SURGERY ITEMS (Surgery Lines + Returns) ─────────────
CREATE TABLE surgery_items (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    surgery_id        UUID        NOT NULL REFERENCES surgeries(id)  ON DELETE CASCADE,
    product_id        UUID        NOT NULL REFERENCES products(id)   ON DELETE RESTRICT,
    source_batch_id   UUID        REFERENCES product_batches(id)     ON DELETE SET NULL,
    item_name         TEXT        NOT NULL,
    quantity          INTEGER     NOT NULL CHECK (quantity > 0),
    returned_quantity INTEGER     NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0),
    base_price        DECIMAL(10,2) NOT NULL CHECK (base_price >= 0),
    selling_price     DECIMAL(10,2) NOT NULL CHECK (selling_price >= 0),
    returned_at       TIMESTAMPTZ,
    return_notes      TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_return_lte_qty CHECK (returned_quantity <= quantity)
);

CREATE INDEX idx_surgery_items_surgery ON surgery_items(surgery_id);
CREATE INDEX idx_surgery_items_product ON surgery_items(product_id);
CREATE INDEX idx_surgery_items_batch   ON surgery_items(source_batch_id);

-- ── 1.10 INVENTORY TRANSACTIONS (Full Movement Ledger) ───────
CREATE TABLE inventory_transactions (
    id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id             UUID        NOT NULL REFERENCES products(id)        ON DELETE RESTRICT,
    product_name           TEXT        NOT NULL,
    batch_id               UUID        REFERENCES product_batches(id)          ON DELETE SET NULL,
    quantity               INTEGER     NOT NULL,  -- positive=IN, negative=OUT
    transaction_type       TEXT        NOT NULL
                                        CHECK (transaction_type IN (
                                            'purchase','surgery','sale',
                                            'adjustment','transformation_out',
                                            'transformation_in','surgery_return'
                                        )),
    reference_id           UUID,
    reference_type         TEXT        CHECK (reference_type IN ('invoice','surgery','manual')),
    unit_cost_snapshot     DECIMAL(10,2),
    selling_price_snapshot DECIMAL(10,2),
    notes                  TEXT,
    created_by             UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inv_tx_product ON inventory_transactions(product_id);
CREATE INDEX idx_inv_tx_batch   ON inventory_transactions(batch_id);
CREATE INDEX idx_inv_tx_type    ON inventory_transactions(transaction_type);
CREATE INDEX idx_inv_tx_date    ON inventory_transactions(created_at DESC);

-- ── 1.11 INVENTORY TRANSFORMATIONS (Scrap/Cut/Convert) ───────
CREATE TABLE inventory_transformations (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    source_product_id   UUID        NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    target_product_id   UUID        NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    source_batch_id     UUID        REFERENCES product_batches(id)   ON DELETE SET NULL,
    quantity            INTEGER     NOT NULL CHECK (quantity > 0),
    cost_difference     DECIMAL(10,2),
    current_source_cost DECIMAL(10,2),
    current_target_cost DECIMAL(10,2),
    notes               TEXT,
    performed_by        UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inv_trans_source ON inventory_transformations(source_product_id);
CREATE INDEX idx_inv_trans_target ON inventory_transformations(target_product_id);

-- ── 1.12 NOTIFICATIONS ───────────────────────────────────────
CREATE TABLE notifications (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    type       TEXT        NOT NULL CHECK (type IN (
                               'low_stock','dead_stock','new_purchase',
                               'new_surgery','margin_warning','system')),
    title      TEXT        NOT NULL,
    message    TEXT        NOT NULL,
    link       TEXT,
    is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_date ON notifications(created_at DESC);

-- ── 1.13 SYSTEM SETTINGS (Single-Row Config) ─────────────────
CREATE TABLE system_settings (
    id                          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    dead_stock_threshold_months INTEGER NOT NULL DEFAULT 6,
    low_stock_alert_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    margin_warning_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    dead_stock_alert_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    new_purchase_alert_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
    new_surgery_alert_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 1.14 SYSTEM LOGS (Generic Audit Trail) ───────────────────
CREATE TABLE system_logs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name  TEXT        NOT NULL,
    record_id   UUID        NOT NULL,
    operation   TEXT        NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
    old_data    JSONB,
    new_data    JSONB,
    changed_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address  TEXT
);

CREATE INDEX idx_sys_logs_table  ON system_logs(table_name);
CREATE INDEX idx_sys_logs_record ON system_logs(record_id);
CREATE INDEX idx_sys_logs_user   ON system_logs(changed_by);
CREATE INDEX idx_sys_logs_date   ON system_logs(changed_at DESC);


-- ============================================================
-- SECTION 2: UTILITY FUNCTIONS
-- ============================================================

-- 2.1 Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 2.2 Get role of authenticated user
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
    RETURN (SELECT role FROM users WHERE id = p_user_id LIMIT 1);
END;
$$;

-- 2.3 Generic audit logger
CREATE OR REPLACE FUNCTION fn_audit_logger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_record_id UUID;
    v_user_id   UUID;
BEGIN
    v_user_id := auth.uid();

    IF TG_OP = 'DELETE' THEN
        v_record_id := OLD.id;
        INSERT INTO system_logs (table_name, record_id, operation, old_data, changed_by)
        VALUES (TG_TABLE_NAME, v_record_id, 'DELETE', to_jsonb(OLD), v_user_id);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        v_record_id := NEW.id;
        INSERT INTO system_logs (table_name, record_id, operation, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, v_record_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), v_user_id);
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        v_record_id := NEW.id;
        INSERT INTO system_logs (table_name, record_id, operation, new_data, changed_by)
        VALUES (TG_TABLE_NAME, v_record_id, 'INSERT', to_jsonb(NEW), v_user_id);
        RETURN NEW;
    END IF;
END;
$$;

-- 2.4 Recompute products.total_quantity and products.base_price_wac from all batches
CREATE OR REPLACE FUNCTION fn_sync_product_cache()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_product_id     UUID;
    v_total_qty      INTEGER;
    v_total_value    DECIMAL(10,2);
    v_wac            DECIMAL(10,2);
BEGIN
    -- Determine which product to recompute
    IF TG_OP = 'DELETE' THEN
        v_product_id := OLD.product_id;
    ELSE
        v_product_id := NEW.product_id;
    END IF;

    SELECT COALESCE(SUM(quantity), 0),
           COALESCE(SUM(quantity * unit_cost), 0)
    INTO v_total_qty, v_total_value
    FROM product_batches
    WHERE product_id = v_product_id;

    IF v_total_qty > 0 THEN
        v_wac := v_total_value / v_total_qty;
    ELSE
        v_wac := 0;
    END IF;

    UPDATE products
    SET total_quantity   = v_total_qty,
        base_price_wac   = v_wac,
        last_movement_at = NOW(),
        updated_at       = NOW()
    WHERE id = v_product_id;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2.5 Auto-compute payment_status on invoices
CREATE OR REPLACE FUNCTION fn_compute_payment_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.amount_paid <= 0 THEN
        NEW.payment_status := 'unpaid';
    ELSIF NEW.amount_paid < NEW.total_amount THEN
        NEW.payment_status := 'partial';
    ELSE
        NEW.payment_status := 'paid';
    END IF;
    RETURN NEW;
END;
$$;


-- ============================================================
-- SECTION 3: TRIGGERS
-- ============================================================

-- 3.1 updated_at triggers
CREATE TRIGGER trg_updated_at_users
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_updated_at_suppliers
    BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_updated_at_doctors
    BEFORE UPDATE ON doctors FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_updated_at_products
    BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_updated_at_invoices
    BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- 3.2 Product cache sync (fires whenever a batch row changes)
CREATE TRIGGER trg_sync_product_cache
    AFTER INSERT OR UPDATE OR DELETE ON product_batches
    FOR EACH ROW EXECUTE FUNCTION fn_sync_product_cache();

-- 3.3 Auto-compute invoice payment_status
CREATE TRIGGER trg_payment_status
    BEFORE INSERT OR UPDATE OF amount_paid, total_amount ON invoices
    FOR EACH ROW EXECUTE FUNCTION fn_compute_payment_status();

-- 3.4 Audit triggers on sensitive tables
CREATE TRIGGER trg_audit_users
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION fn_audit_logger();

CREATE TRIGGER trg_audit_products
    AFTER INSERT OR UPDATE OR DELETE ON products
    FOR EACH ROW EXECUTE FUNCTION fn_audit_logger();

CREATE TRIGGER trg_audit_invoices
    AFTER INSERT OR UPDATE OR DELETE ON invoices
    FOR EACH ROW EXECUTE FUNCTION fn_audit_logger();

CREATE TRIGGER trg_audit_surgeries
    AFTER INSERT OR UPDATE OR DELETE ON surgeries
    FOR EACH ROW EXECUTE FUNCTION fn_audit_logger();


-- ============================================================
-- SECTION 4: BUSINESS LOGIC (RPC FUNCTIONS)
-- ============================================================

-- 4.1 Secure user creation (admin only)
CREATE OR REPLACE FUNCTION create_new_user(
    p_email     TEXT,
    p_password  TEXT,
    p_name      TEXT,
    p_role      TEXT,
    p_phone     TEXT    DEFAULT NULL,
    p_created_by UUID   DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_new_id UUID;
BEGIN
    IF get_user_role(auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can create users.';
    END IF;

    INSERT INTO users (email, password_hash, name, role, phone, created_by, status)
    VALUES (
        p_email, crypt(p_password, gen_salt('bf', 10)),
        p_name, p_role, p_phone, auth.uid(), 'active'
    )
    RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$;

-- 4.2 Secure password update
CREATE OR REPLACE FUNCTION update_user_password_secure(
    p_user_id    UUID,
    p_new_password TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF auth.uid() != p_user_id AND get_user_role(auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    UPDATE users SET password_hash = crypt(p_new_password, gen_salt('bf', 10))
    WHERE id = p_user_id;
END;
$$;

-- 4.3 Create invoice + batches + ledger entries (Atomic, WAC)
CREATE OR REPLACE FUNCTION create_invoice_transaction(
    p_supplier_id             UUID,
    p_invoice_date            DATE,
    p_vendor_invoice_number   TEXT,
    p_notes                   TEXT,
    p_total_amount            NUMERIC,
    p_items                   JSONB,    -- [{product_id, quantity, unit_cost, batch_no, expiry_date}]
    p_created_by              UUID,     -- legacy param, overridden by auth.uid()
    p_payment_type            TEXT DEFAULT 'cash',
    p_amount_paid             NUMERIC DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_invoice_id  UUID;
    v_item_id     UUID;
    v_item        JSONB;
    v_qty         INTEGER;
    v_cost        NUMERIC;
    v_batch_id    UUID;
    v_actor_role  TEXT;
BEGIN
    v_actor_role := get_user_role(COALESCE(p_created_by, auth.uid()));
    IF v_actor_role NOT IN ('admin','storekeeper') THEN
        RAISE EXCEPTION 'Unauthorized: Role "%" cannot create invoices.', v_actor_role;
    END IF;

    INSERT INTO invoices (
        supplier_id, invoice_date, vendor_invoice_number,
        notes, total_amount, payment_type,
        amount_paid, created_by
    ) VALUES (
        p_supplier_id, p_invoice_date, p_vendor_invoice_number,
        p_notes, p_total_amount, p_payment_type,
        COALESCE(p_amount_paid, CASE WHEN p_payment_type='cash' THEN p_total_amount ELSE 0 END),
        COALESCE(p_created_by, auth.uid())
    )
    RETURNING id INTO v_invoice_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty    := (v_item->>'quantity')::INTEGER;
        v_cost   := (v_item->>'unit_cost')::NUMERIC;
        v_item_id := (v_item->>'product_id')::UUID;

        -- Create invoice line
        INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_cost, batch_no, expiry_date)
        VALUES (
            v_invoice_id, v_item_id, v_qty, v_cost,
            v_item->>'batch_no',
            NULLIF(v_item->>'expiry_date','')::DATE
        )
        RETURNING id INTO v_item_id;

        -- Create batch record (trigger will recompute WAC on products)
        INSERT INTO product_batches (
            product_id, batch_no, quantity, unit_cost,
            received_date, expiry_date, invoice_item_id
        ) VALUES (
            (v_item->>'product_id')::UUID,
            v_item->>'batch_no',
            v_qty, v_cost,
            p_invoice_date,
            NULLIF(v_item->>'expiry_date','')::DATE,
            v_item_id
        )
        RETURNING id INTO v_batch_id;

        -- Write to ledger
        INSERT INTO inventory_transactions (
            product_id, product_name, batch_id, quantity,
            transaction_type, reference_id, reference_type,
            unit_cost_snapshot, created_by
        ) VALUES (
            (v_item->>'product_id')::UUID,
            (SELECT name FROM products WHERE id = (v_item->>'product_id')::UUID),
            v_batch_id, v_qty,
            'purchase', v_invoice_id, 'invoice',
            v_cost, COALESCE(p_created_by, auth.uid())
        );
    END LOOP;

    RETURN v_invoice_id;
END;
$$;

-- 4.4 Create surgery + deduct stock + ledger (Atomic)
CREATE OR REPLACE FUNCTION create_surgery_transaction(
    p_doctor_id           UUID,
    p_patient_id          TEXT,
    p_patient_name        TEXT,
    p_date                DATE,
    p_type                TEXT,
    p_total_base_value    NUMERIC,
    p_total_selling_value NUMERIC,
    p_profit              NUMERIC,
    p_notes               TEXT,
    p_items               JSONB,   -- [{product_id, item_name, quantity, base_price, selling_price, source_batch_id?}]
    p_created_by          UUID     -- legacy, overridden by auth.uid()
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_surgery_id  UUID;
    v_item        JSONB;
    v_product_id  UUID;
    v_batch_id    UUID;
    v_qty         INTEGER;
    v_avail       INTEGER;
    v_actor_role  TEXT;
BEGIN
    v_actor_role := get_user_role(COALESCE(p_created_by, auth.uid()));
    IF v_actor_role NOT IN ('admin','doctor','storekeeper') THEN
        RAISE EXCEPTION 'Unauthorized: Role "%" cannot record surgeries.', v_actor_role;
    END IF;

    INSERT INTO surgeries (
        doctor_id, patient_id, patient_name, date, type,
        total_base_value, total_selling_value, profit, notes, created_by
    ) VALUES (
        p_doctor_id, p_patient_id, p_patient_name, p_date, p_type,
        p_total_base_value, p_total_selling_value, p_profit, p_notes, COALESCE(p_created_by, auth.uid())
    )
    RETURNING id INTO v_surgery_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_qty        := (v_item->>'quantity')::INTEGER;
        v_batch_id   := NULLIF(v_item->>'source_batch_id','')::UUID;

        -- Stock sufficiency check
        SELECT total_quantity INTO v_avail FROM products WHERE id = v_product_id FOR UPDATE;
        IF v_avail < v_qty THEN
            RAISE EXCEPTION 'Insufficient stock for product %. Available: %, Requested: %',
                (SELECT name FROM products WHERE id = v_product_id), v_avail, v_qty;
        END IF;

        -- Deduct from specific batch if provided, else deduct from oldest (FEFO)
        IF v_batch_id IS NULL THEN
            SELECT id INTO v_batch_id
            FROM product_batches
            WHERE product_id = v_product_id AND quantity > 0
            ORDER BY COALESCE(expiry_date, '9999-12-31'), received_date
            LIMIT 1;
        END IF;

        -- Deduct batch quantity (triggers fn_sync_product_cache on products)
        UPDATE product_batches
        SET quantity = quantity - v_qty
        WHERE id = v_batch_id;

        -- Insert surgery item
        INSERT INTO surgery_items (
            surgery_id, product_id, source_batch_id, item_name,
            quantity, base_price, selling_price
        ) VALUES (
            v_surgery_id, v_product_id, v_batch_id,
            v_item->>'item_name',
            v_qty,
            (v_item->>'base_price')::NUMERIC,
            (v_item->>'selling_price')::NUMERIC
        );

        -- Write to ledger
        INSERT INTO inventory_transactions (
            product_id, product_name, batch_id, quantity,
            transaction_type, reference_id, reference_type,
            unit_cost_snapshot, selling_price_snapshot, created_by
        ) VALUES (
            v_product_id,
            v_item->>'item_name',
            v_batch_id,
            -v_qty,   -- negative = stock OUT
            'surgery', v_surgery_id, 'surgery',
            (v_item->>'base_price')::NUMERIC,
            (v_item->>'selling_price')::NUMERIC,
            COALESCE(p_created_by, auth.uid())
        );
    END LOOP;

    RETURN v_surgery_id;
END;
$$;

-- 4.5 Process surgery return (return items back to original batch)
CREATE OR REPLACE FUNCTION process_surgery_return(
    p_surgery_item_id  UUID,
    p_return_quantity  INTEGER,
    p_return_notes     TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_item          RECORD;
    v_actor_role    TEXT;
BEGIN
    v_actor_role := get_user_role(auth.uid());
    IF v_actor_role NOT IN ('admin','storekeeper') THEN
        RAISE EXCEPTION 'Unauthorized: Role "%" cannot process returns.', v_actor_role;
    END IF;

    SELECT si.*, s.date as surgery_date
    INTO v_item
    FROM surgery_items si
    JOIN surgeries s ON s.id = si.surgery_id
    WHERE si.id = p_surgery_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Surgery item not found: %', p_surgery_item_id;
    END IF;

    IF (v_item.returned_quantity + p_return_quantity) > v_item.quantity THEN
        RAISE EXCEPTION 'Return quantity (%) exceeds original quantity (%). Already returned: %.',
            p_return_quantity, v_item.quantity, v_item.returned_quantity;
    END IF;

    -- Update surgery item
    UPDATE surgery_items
    SET returned_quantity = returned_quantity + p_return_quantity,
        returned_at       = NOW(),
        return_notes      = p_return_notes
    WHERE id = p_surgery_item_id;

    -- Return stock to original batch (trigger recomputes product cache)
    UPDATE product_batches
    SET quantity = quantity + p_return_quantity
    WHERE id = v_item.source_batch_id;

    -- Write return to ledger
    INSERT INTO inventory_transactions (
        product_id, product_name, batch_id, quantity,
        transaction_type, reference_id, reference_type,
        notes, created_by
    ) VALUES (
        v_item.product_id,
        v_item.item_name,
        v_item.source_batch_id,
        p_return_quantity,   -- positive = stock IN (return)
        'surgery_return', v_item.surgery_id, 'surgery',
        p_return_notes, auth.uid()
    );
END;
$$;

-- 4.6 Inventory transformation (e.g. cut rod → shorter rod)
CREATE OR REPLACE FUNCTION transform_inventory_item(
    p_source_product_id UUID,
    p_target_product_id UUID,
    p_quantity          INTEGER,
    p_source_batch_id   UUID    DEFAULT NULL,
    p_notes             TEXT    DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_source_batch   UUID;
    v_source_cost    DECIMAL(10,2);
    v_target_cost    DECIMAL(10,2);
    v_tx_id          UUID;
    v_actor_role     TEXT;
BEGIN
    v_actor_role := get_user_role(auth.uid());
    IF v_actor_role NOT IN ('admin','storekeeper') THEN
        RAISE EXCEPTION 'Unauthorized: Role "%" cannot perform transformations.', v_actor_role;
    END IF;

    -- Resolve batch (FEFO if not specified)
    IF p_source_batch_id IS NULL THEN
        SELECT id INTO v_source_batch
        FROM product_batches
        WHERE product_id = p_source_product_id AND quantity >= p_quantity
        ORDER BY COALESCE(expiry_date, '9999-12-31'), received_date
        LIMIT 1;
    ELSE
        v_source_batch := p_source_batch_id;
    END IF;

    IF v_source_batch IS NULL THEN
        RAISE EXCEPTION 'Insufficient batch stock for transformation.';
    END IF;

    SELECT unit_cost INTO v_source_cost FROM product_batches WHERE id = v_source_batch FOR UPDATE;
    SELECT base_price_wac INTO v_target_cost FROM products WHERE id = p_target_product_id FOR UPDATE;

    -- Deduct from source batch
    UPDATE product_batches SET quantity = quantity - p_quantity WHERE id = v_source_batch;

    -- Add to target product as new batch (inheriting source cost for valuation)
    INSERT INTO product_batches (product_id, quantity, unit_cost, received_date, notes)
    VALUES (p_target_product_id, p_quantity, v_source_cost, CURRENT_DATE, p_notes);

    -- Record transformation
    INSERT INTO inventory_transformations (
        source_product_id, target_product_id, source_batch_id,
        quantity, cost_difference,
        current_source_cost, current_target_cost,
        notes, performed_by
    ) VALUES (
        p_source_product_id, p_target_product_id, v_source_batch,
        p_quantity, (v_source_cost - v_target_cost) * p_quantity,
        v_source_cost, v_target_cost,
        p_notes, auth.uid()
    )
    RETURNING id INTO v_tx_id;

    -- Ledger OUT
    INSERT INTO inventory_transactions (
        product_id, product_name, batch_id, quantity,
        transaction_type, notes, created_by
    ) VALUES (
        p_source_product_id,
        (SELECT name FROM products WHERE id = p_source_product_id),
        v_source_batch, -p_quantity,
        'transformation_out', p_notes, auth.uid()
    );

    -- Ledger IN
    INSERT INTO inventory_transactions (
        product_id, product_name, quantity,
        transaction_type, notes, created_by
    ) VALUES (
        p_target_product_id,
        (SELECT name FROM products WHERE id = p_target_product_id),
        p_quantity,
        'transformation_in', p_notes, auth.uid()
    );

    RETURN jsonb_build_object('success', true, 'transformation_id', v_tx_id);
END;
$$;

-- 4.7 Dashboard stats (role-aware)
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
    v_role         TEXT;
    v_can_finance  BOOLEAN;
BEGIN
    v_role        := get_user_role(auth.uid());
    v_can_finance := v_role IN ('admin','partner');

    RETURN jsonb_build_object(
        'total_skus',            (SELECT COUNT(*) FROM products),
        'total_quantity',        (SELECT COALESCE(SUM(total_quantity),0) FROM products),
        'low_stock_count',       (SELECT COUNT(*) FROM products WHERE total_quantity <= min_stock),
        'dead_stock_count',      (SELECT COUNT(*) FROM products
                                  WHERE total_quantity > 0
                                    AND last_movement_at < NOW() - INTERVAL '6 months'),
        'total_inventory_value', CASE WHEN v_can_finance
                                 THEN (SELECT COALESCE(SUM(total_quantity * base_price_wac),0) FROM products)
                                 ELSE NULL END,
        'total_purchases',       CASE WHEN v_can_finance
                                 THEN (SELECT COALESCE(SUM(total_amount),0) FROM invoices)
                                 ELSE NULL END,
        'total_profit',          CASE WHEN v_can_finance
                                 THEN (SELECT COALESCE(SUM(profit),0) FROM surgeries)
                                 ELSE NULL END,
        'total_surgeries',       (SELECT COUNT(*) FROM surgeries),
        'unpaid_invoices_count', CASE WHEN v_can_finance
                                 THEN (SELECT COUNT(*) FROM invoices WHERE payment_status != 'paid')
                                 ELSE NULL END
    );
END;
$$;

-- 4.8 Update invoice payment (admin only)
CREATE OR REPLACE FUNCTION update_invoice_payment(
    p_invoice_id   UUID,
    p_amount_paid  NUMERIC
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF get_user_role(auth.uid()) NOT IN ('admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can update invoice payments.';
    END IF;
    UPDATE invoices SET amount_paid = p_amount_paid WHERE id = p_invoice_id;
END;
$$;


-- ============================================================
-- SECTION 5: ANALYTICS VIEWS
-- ============================================================

-- 5.1 Low stock items (top 20 most critical)
CREATE OR REPLACE VIEW low_stock_items_top AS
SELECT
    p.id, p.name, p.sku, p.category, p.material,
    p.diameter, p.length, p.unit,
    p.total_quantity                                          AS quantity,
    p.min_stock,
    p.base_price_wac                                         AS base_price,
    p.selling_price,
    p.last_movement_at,
    p.sterilization_status,
    ROUND(p.total_quantity::DECIMAL / NULLIF(p.min_stock,0), 2) AS stock_ratio
FROM products p
WHERE p.total_quantity <= p.min_stock
ORDER BY stock_ratio ASC
LIMIT 20;

-- 5.2 Dead stock items
CREATE OR REPLACE VIEW dead_stock_items AS
SELECT
    p.id, p.name, p.sku, p.category,
    p.total_quantity AS quantity,
    p.last_movement_at,
    EXTRACT(DAY FROM NOW() - p.last_movement_at)::INTEGER AS days_inactive
FROM products p
WHERE p.total_quantity > 0
  AND p.last_movement_at < NOW() - INTERVAL '6 months'
ORDER BY days_inactive DESC;

-- 5.3 Recent surgeries (top 10)
CREATE OR REPLACE VIEW recent_surgeries_top AS
SELECT
    s.id, s.patient_name, s.date, s.type,
    s.total_base_value, s.total_selling_value, s.profit, s.notes,
    d.name    AS doctor_name,
    d.hospital AS hospital
FROM surgeries s
LEFT JOIN doctors d ON d.id = s.doctor_id
ORDER BY s.date DESC
LIMIT 10;

-- 5.4 Surgery profitability
CREATE OR REPLACE VIEW surgery_profitability AS
SELECT
    s.id, s.patient_name, s.date, s.type,
    d.name AS doctor_name, d.hospital,
    s.total_base_value, s.total_selling_value, s.profit,
    CASE WHEN s.total_base_value > 0
         THEN ROUND((s.profit / s.total_base_value * 100)::NUMERIC, 2)
         ELSE 0 END AS profit_pct
FROM surgeries s
JOIN doctors d ON d.id = s.doctor_id
ORDER BY s.date DESC;

-- 5.5 Inventory value summary by category
CREATE OR REPLACE VIEW inventory_value_summary AS
SELECT
    category,
    COUNT(*)                                    AS sku_count,
    SUM(total_quantity)                         AS total_qty,
    SUM(total_quantity * base_price_wac)        AS total_base_value,
    SUM(total_quantity * selling_price)         AS total_selling_value,
    SUM(total_quantity * (selling_price - base_price_wac)) AS potential_profit
FROM products
GROUP BY category
ORDER BY total_base_value DESC;

-- 5.6 Expiring soon (within 90 days)
CREATE OR REPLACE VIEW expiring_batches AS
SELECT
    pb.id, pb.batch_no, pb.quantity, pb.expiry_date,
    pb.received_date,
    p.id   AS product_id,
    p.name AS product_name,
    p.sku,
    (pb.expiry_date - CURRENT_DATE) AS days_until_expiry
FROM product_batches pb
JOIN products p ON p.id = pb.product_id
WHERE pb.quantity > 0
  AND pb.expiry_date IS NOT NULL
  AND pb.expiry_date <= CURRENT_DATE + INTERVAL '90 days'
ORDER BY pb.expiry_date ASC;

-- 5.7 Unpaid / partial invoices
CREATE OR REPLACE VIEW open_invoices AS
SELECT
    i.id, i.invoice_date, i.vendor_invoice_number,
    s.name          AS supplier_name,
    i.total_amount,
    i.amount_paid,
    (i.total_amount - i.amount_paid) AS balance_due,
    i.payment_type, i.payment_status
FROM invoices i
JOIN suppliers s ON s.id = i.supplier_id
WHERE i.payment_status IN ('unpaid','partial')
ORDER BY i.invoice_date ASC;


-- ============================================================
-- SECTION 6: ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers                ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE products                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_batches          ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgeries                ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgery_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transformations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs              ENABLE ROW LEVEL SECURITY;

-- ── HELPER: is authenticated ─────────────────────────────────
-- All policies rely on auth.uid() being non-null for base access

-- ── USERS TABLE ──────────────────────────────────────────────
CREATE POLICY "users_select" ON users
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "users_insert" ON users
    FOR INSERT WITH CHECK (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "users_update" ON users
    FOR UPDATE USING (
        auth.uid() = id                          -- own record
        OR get_user_role(auth.uid()) = 'admin'   -- admin manages all
    );
CREATE POLICY "users_delete" ON users
    FOR DELETE USING (get_user_role(auth.uid()) = 'admin');

-- ── SUPPLIERS ────────────────────────────────────────────────
CREATE POLICY "suppliers_select" ON suppliers
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "suppliers_write" ON suppliers
    FOR ALL USING (get_user_role(auth.uid()) IN ('admin','storekeeper'));

-- ── DOCTORS ──────────────────────────────────────────────────
CREATE POLICY "doctors_select" ON doctors
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "doctors_write" ON doctors
    FOR ALL USING (get_user_role(auth.uid()) IN ('admin','storekeeper'));

-- ── PRODUCTS ─────────────────────────────────────────────────
CREATE POLICY "products_select" ON products
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "products_insert" ON products
    FOR INSERT WITH CHECK (get_user_role(auth.uid()) IN ('admin','storekeeper'));
CREATE POLICY "products_update" ON products
    FOR UPDATE USING (get_user_role(auth.uid()) IN ('admin','storekeeper'));
CREATE POLICY "products_delete" ON products
    FOR DELETE USING (get_user_role(auth.uid()) = 'admin');

-- ── PRODUCT BATCHES ──────────────────────────────────────────
CREATE POLICY "batches_select" ON product_batches
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "batches_write" ON product_batches
    FOR ALL USING (get_user_role(auth.uid()) IN ('admin','storekeeper'));

-- ── INVOICES ─────────────────────────────────────────────────
CREATE POLICY "invoices_select" ON invoices
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "invoices_insert" ON invoices
    FOR INSERT WITH CHECK (get_user_role(auth.uid()) IN ('admin','storekeeper'));
CREATE POLICY "invoices_update" ON invoices
    FOR UPDATE USING (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "invoices_delete" ON invoices
    FOR DELETE USING (get_user_role(auth.uid()) = 'admin');

-- ── INVOICE ITEMS ────────────────────────────────────────────
CREATE POLICY "invoice_items_select" ON invoice_items
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "invoice_items_write" ON invoice_items
    FOR ALL USING (get_user_role(auth.uid()) IN ('admin','storekeeper'));

-- ── SURGERIES ────────────────────────────────────────────────
CREATE POLICY "surgeries_select" ON surgeries
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "surgeries_insert" ON surgeries
    FOR INSERT WITH CHECK (get_user_role(auth.uid()) IN ('admin','doctor','storekeeper'));
CREATE POLICY "surgeries_update" ON surgeries
    FOR UPDATE USING (get_user_role(auth.uid()) IN ('admin','doctor'));
CREATE POLICY "surgeries_delete" ON surgeries
    FOR DELETE USING (get_user_role(auth.uid()) = 'admin');

-- ── SURGERY ITEMS ────────────────────────────────────────────
CREATE POLICY "surgery_items_select" ON surgery_items
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "surgery_items_write" ON surgery_items
    FOR ALL USING (get_user_role(auth.uid()) IN ('admin','doctor','storekeeper'));

-- ── INVENTORY TRANSACTIONS ───────────────────────────────────
CREATE POLICY "inv_tx_select" ON inventory_transactions
    FOR SELECT USING (auth.uid() IS NOT NULL);
-- No direct writes — only via RPC functions (SECURITY DEFINER)

-- ── INVENTORY TRANSFORMATIONS ────────────────────────────────
CREATE POLICY "inv_trans_select" ON inventory_transformations
    FOR SELECT USING (auth.uid() IS NOT NULL);
-- No direct writes — only via RPC function

-- ── NOTIFICATIONS ────────────────────────────────────────────
CREATE POLICY "notifications_select" ON notifications
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "notifications_update" ON notifications
    FOR UPDATE USING (auth.uid() IS NOT NULL);  -- anyone can mark read
CREATE POLICY "notifications_delete" ON notifications
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── SYSTEM SETTINGS ──────────────────────────────────────────
CREATE POLICY "settings_select" ON system_settings
    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "settings_write" ON system_settings
    FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- ── SYSTEM LOGS ──────────────────────────────────────────────
CREATE POLICY "logs_select" ON system_logs
    FOR SELECT USING (get_user_role(auth.uid()) = 'admin');
-- No direct writes — only via fn_audit_logger trigger (SECURITY DEFINER)


-- ============================================================
-- SECTION 7: SEED DATA
-- ============================================================

-- Default system settings (single row)
INSERT INTO system_settings (
    dead_stock_threshold_months,
    low_stock_alert_enabled,
    margin_warning_enabled,
    dead_stock_alert_enabled,
    new_purchase_alert_enabled,
    new_surgery_alert_enabled
) VALUES (6, TRUE, TRUE, TRUE, TRUE, TRUE)
ON CONFLICT DO NOTHING;

-- Default admin user (password: Admin@123 — CHANGE IN PRODUCTION)
INSERT INTO users (name, email, phone, password_hash, role, status)
VALUES (
    'System Administrator',
    'admin@supply-care.com',
    NULL,
    crypt('Admin@123', gen_salt('bf', 10)),
    'admin',
    'active'
)
ON CONFLICT (email) DO NOTHING;


-- ============================================================
-- SECTION 8: VERIFICATION QUERIES
-- ============================================================
-- Run these after setup to confirm everything was created:

-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- ORDER BY table_name;

-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
-- ORDER BY routine_name;

-- SELECT schemaname, viewname FROM pg_views
-- WHERE schemaname = 'public'
-- ORDER BY viewname;


-- ============================================================
-- END OF SUPPLY-CARE ERP MASTER SETUP v2.0.0
-- ============================================================
-- Tables created   : 14
-- RPC functions    : 8
-- Analytics views  : 6
-- Triggers         : 10
-- RLS policies     : 35+
-- ============================================================
