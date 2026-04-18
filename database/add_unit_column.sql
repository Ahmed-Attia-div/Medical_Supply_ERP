-- Add unit column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit text;

-- Update specific known items based on user feedback
UPDATE products 
SET unit = 'Roll' 
WHERE name LIKE '%سلك سركلاج%' OR name LIKE '%Cerclage%';

UPDATE products 
SET unit = 'Box' 
WHERE name LIKE '%Gauze%' OR name LIKE '%شاش%';

-- Recreate view to include unit
-- First, drop the view because we are changing column order/adding columns
DROP VIEW IF EXISTS low_stock_items_top;

CREATE OR REPLACE VIEW low_stock_items_top AS
SELECT 
    id,
    name,
    sku,
    category,
    material,
    diameter,
    length,
    unit,
    quantity,
    min_stock,
    base_price,
    selling_price,
    last_movement_date,
    (quantity::DECIMAL / NULLIF(min_stock, 0)) as stock_ratio
FROM products
WHERE quantity <= min_stock
ORDER BY stock_ratio ASC
LIMIT 10;
