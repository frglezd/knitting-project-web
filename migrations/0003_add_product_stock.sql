-- Migration number: 0003 	 2026-09-17T00:00:00.000Z
--
-- Adds order-driven inventory tracking to products. Unit depends on
-- unidad_precio: grams when unidad_precio = '100g', whole pieces when
-- unidad_precio is 'madeja' or 'unidad'. Existing rows backfill to 0
-- (out of stock) until the admin sets real quantities via the new
-- "Existencias" field — this column is only authoritative for products
-- with no color variants (see product_colores, migration 0004).

ALTER TABLE products ADD COLUMN stock INTEGER NOT NULL DEFAULT 0;
