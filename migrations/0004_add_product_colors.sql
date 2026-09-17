-- Migration number: 0004 	 2026-09-17T00:01:00.000Z
--
-- Adds an optional per-product color-variant model. `colores` is a
-- shared lookup table with the exact same shape as fabricantes/
-- categorias (migration 0001) — nombre + normalized unique name — so it
-- can reuse functions/api/_lookup.js's existing find-or-create factory.
--
-- `product_colores` is the join table between a product and a color,
-- carrying its own stock count. A product with zero rows in
-- product_colores means "no color choice" for that product — it is sold
-- against products.stock directly. One or more rows means the customer
-- must pick a color; that color's own stock is authoritative and
-- products.stock is ignored for that product.
--
-- `product_colores.stock` follows the same unit rule as products.stock:
-- grams when the parent product's unidad_precio = '100g', whole pieces
-- when it is 'madeja' or 'unidad'.

CREATE TABLE colores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  nombre_normalizado TEXT NOT NULL UNIQUE
);

CREATE TABLE product_colores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  color_id INTEGER NOT NULL REFERENCES colores(id),
  stock INTEGER NOT NULL DEFAULT 0,
  UNIQUE(product_id, color_id)
);

CREATE INDEX IF NOT EXISTS idx_product_colores_product_id ON product_colores(product_id);
