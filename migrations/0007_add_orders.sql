-- Migration number: 0007 	 2026-09-21T00:00:00.000Z
--
-- Adds orders + order_items for real online checkout via Stripe Checkout
-- Sessions (Phase 4 of the e-commerce checkout plan). order_items
-- snapshots product_nombre/color_nombre/unidad_precio/precio_unitario at
-- purchase time rather than joining live against products/product_colores,
-- since a product's price can change, the product (or a color variant) can
-- be deleted, or a color can run out of stock after the order was placed —
-- the order history must stay accurate to what the customer actually paid
-- for regardless of later catalog edits.
--
-- `product_color_id` is nullable because not every product has color
-- variants (see product_colores, migration 0004) — NULL means the product
-- had no color choice at purchase time, alongside a NULL color_nombre
-- snapshot.
--
-- `status = 'paid_oversold'` is the escape hatch for the rare race where a
-- customer's payment is confirmed by Stripe but stock (or the specific
-- color's stock) ran out between checkout-session creation and payment
-- confirmation. It is not handled automatically — it flags the order for
-- manual admin follow-up (contact the customer, refund via the Stripe
-- Dashboard) instead of silently overselling or auto-cancelling.

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  fulfillment_method TEXT NOT NULL DEFAULT 'pickup',
  status TEXT NOT NULL DEFAULT 'pending_payment',
    -- pending_payment | paid | paid_oversold | fulfilled | payment_failed | cancelled
  payment_provider TEXT NOT NULL DEFAULT 'stripe',
  payment_provider_ref TEXT, -- Stripe Checkout Session id (cs_...)
  total REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MXN',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_color_id INTEGER REFERENCES product_colores(id),
    -- NULL when the product had no color variants at purchase time
  product_nombre TEXT NOT NULL,
  color_nombre TEXT,          -- snapshot; NULL alongside product_color_id
  unidad_precio TEXT NOT NULL, -- snapshot: 'gramos' | 'madeja' | 'unidad'
  precio_unitario REAL NOT NULL, -- snapshot of products.precio (price per unidad_precio)
  cantidad INTEGER NOT NULL,  -- grams when unidad_precio='gramos' (e.g. 300 = 300g);
                               -- whole-piece count otherwise
  subtotal REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_ref ON orders(payment_provider_ref);
