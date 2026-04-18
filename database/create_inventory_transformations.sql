-- Create table for inventory transformations
CREATE TABLE IF NOT EXISTS public.inventory_transformations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    source_item_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    target_item_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    cost_difference DECIMAL(10, 2) NOT NULL,
    performed_by UUID REFERENCES auth.users(id),
    current_source_cost DECIMAL(10, 2), -- Snapshot of cost at time of transformation
    current_target_cost DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);

-- Enable RLS
ALTER TABLE public.inventory_transformations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow read access to authenticated users"
    ON public.inventory_transformations FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert access to authenticated users"
    ON public.inventory_transformations FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- RPC Function to handle transformation
CREATE OR REPLACE FUNCTION transform_inventory_item(
    p_source_item_id UUID,
    p_target_item_id UUID,
    p_quantity INTEGER,
    p_user_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_source_qty INTEGER;
    v_source_cost DECIMAL(10, 2);
    v_target_cost DECIMAL(10, 2);
    v_cost_diff DECIMAL(10, 2);
    v_transformation_id UUID;
BEGIN
    -- 1. Lock rows and check source quantity
    SELECT quantity, base_price INTO v_source_qty, v_source_cost
    FROM public.products
    WHERE id = p_source_item_id
    FOR UPDATE;

    IF v_source_qty IS NULL THEN
        RAISE EXCEPTION 'Source item not found';
    END IF;

    IF v_source_qty < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock in source item. Available: %, Required: %', v_source_qty, p_quantity;
    END IF;

    -- 2. Get target item info
    SELECT base_price INTO v_target_cost
    FROM public.products
    WHERE id = p_target_item_id
    FOR UPDATE;

    IF v_target_cost IS NULL THEN
        RAISE EXCEPTION 'Target item not found';
    END IF;

    -- 3. Calculate Cost Difference
    v_cost_diff := (v_source_cost - v_target_cost) * p_quantity;

    -- 4. Update Inventory
    -- Deduct from source
    UPDATE public.products
    SET quantity = quantity - p_quantity,
        last_movement_date = NOW(),
        updated_at = NOW()
    WHERE id = p_source_item_id;

    -- Add to target
    UPDATE public.products
    SET quantity = quantity + p_quantity,
        last_movement_date = NOW(),
        updated_at = NOW()
    WHERE id = p_target_item_id;

    -- 5. Log Transaction
    INSERT INTO public.inventory_transformations (
        source_item_id,
        target_item_id,
        quantity,
        cost_difference,
        performed_by,
        current_source_cost,
        current_target_cost,
        notes
    ) VALUES (
        p_source_item_id,
        p_target_item_id,
        p_quantity,
        v_cost_diff,
        p_user_id,
        v_source_cost,
        v_target_cost,
        p_notes
    ) RETURNING id INTO v_transformation_id;

    -- 6. Log Source Movement (Usage/Internal Consumption)
    INSERT INTO public.inventory_transactions (
        item_id,
        item_name,
        quantity,
        base_price,
        selling_price,
        total_base_value,
        total_selling_value,
        date,
        type,
        notes,
        created_by,
        is_locked
    ) VALUES (
        p_source_item_id,
        (SELECT name FROM public.products WHERE id = p_source_item_id),
        -p_quantity,
        v_source_cost,
        0, 
        -p_quantity * v_source_cost,
        0,
        NOW(),
        'usage', 
        CASE WHEN p_notes IS NOT NULL THEN 'Transformation: ' || p_notes ELSE 'Transformation Source (To: ' || (SELECT name FROM public.products WHERE id = p_target_item_id) || ')' END,
        p_user_id,
        true
    );

    -- 7. Log Target Movement (Refill/Internal Prod)
    INSERT INTO public.inventory_transactions (
        item_id,
        item_name,
        quantity,
        base_price,
        selling_price,
        total_base_value,
        total_selling_value,
        date,
        type,
        notes,
        created_by,
        is_locked
    ) VALUES (
        p_target_item_id,
        (SELECT name FROM public.products WHERE id = p_target_item_id),
        p_quantity,
        v_target_cost,
        0,
        p_quantity * v_target_cost,
        0,
        NOW(),
        'refill',
        CASE WHEN p_notes IS NOT NULL THEN 'Transformation: ' || p_notes ELSE 'Transformation Target (From: ' || (SELECT name FROM public.products WHERE id = p_source_item_id) || ')' END,
        p_user_id,
        true
    );


    RETURN jsonb_build_object(
        'success', true,
        'transformation_id', v_transformation_id,
        'cost_difference', v_cost_diff
    );
END;
$$;
