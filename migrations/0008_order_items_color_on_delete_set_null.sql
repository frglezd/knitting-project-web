-- Migration number: 0008 	 2026-09-22T00:00:00.000Z
--
-- Fixes a bug found in testing: functions/api/products.js and
-- functions/api/products/[id].js manage a product's color variants with a
-- delete-then-reinsert strategy against product_colores (see migration
-- 0004's header) — simple and correct while nothing else referenced
-- product_colores rows. Once real orders exist, order_items.
-- product_color_id's FK to product_colores(id) has SQLite's default
-- "NO ACTION" behavior, which blocks that DELETE the moment ANY color
-- variant on an already-ordered product is edited (even just its stock),
-- surfacing as a raw "FOREIGN KEY constraint failed" 500 instead of the
-- edit succeeding or a clean error.
--
-- Fix: ON DELETE SET NULL on that FK. order_items already snapshots
-- product_nombre/color_nombre/unidad_precio/precio_unitario specifically
-- so order history stays accurate after the live product/color record
-- changes or is removed (see migration 0007's header) — product_color_id
-- going NULL when its product_colores row is deleted is the same intent,
-- not a new kind of data loss; the color_nombre snapshot still shows
-- what was actually bought. SQLite can't ALTER a FK clause in place, so
-- this rebuilds order_items the same way migration 0001 rebuilt products.

PRAGMA defer_foreign_keys=TRUE;

CREATE TABLE order_items_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_color_id INTEGER REFERENCES product_colores(id) ON DELETE SET NULL,
  product_nombre TEXT NOT NULL,
  color_nombre TEXT,
  unidad_precio TEXT NOT NULL,
  precio_unitario REAL NOT NULL,
  cantidad INTEGER NOT NULL,
  subtotal REAL NOT NULL
);

INSERT INTO order_items_new (
  id, order_id, product_id, product_color_id, product_nombre,
  color_nombre, unidad_precio, precio_unitario, cantidad, subtotal
)
SELECT
  id, order_id, product_id, product_color_id, product_nombre,
  color_nombre, unidad_precio, precio_unitario, cantidad, subtotal
FROM order_items;

DROP TABLE order_items;
ALTER TABLE order_items_new RENAME TO order_items;

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
