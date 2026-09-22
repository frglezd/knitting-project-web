CREATE TABLE IF NOT EXISTS fabricantes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  nombre_normalizado TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  nombre_normalizado TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  fabricante_id INTEGER NOT NULL REFERENCES fabricantes(id),
  categoria_id INTEGER NOT NULL REFERENCES categorias(id),
  imagen TEXT,
  precio REAL NOT NULL,
  unidad_precio TEXT NOT NULL,
  descripcion TEXT,
  stock INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS site_content (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  content TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS colores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  nombre_normalizado TEXT NOT NULL UNIQUE,
  hex TEXT NOT NULL DEFAULT '#cccccc'
);

CREATE TABLE IF NOT EXISTS product_colores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  color_id INTEGER NOT NULL REFERENCES colores(id),
  stock INTEGER NOT NULL DEFAULT 0,
  UNIQUE(product_id, color_id)
);

CREATE INDEX IF NOT EXISTS idx_product_colores_product_id ON product_colores(product_id);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  fulfillment_method TEXT NOT NULL DEFAULT 'pickup',
  status TEXT NOT NULL DEFAULT 'pending_payment',
  payment_provider TEXT NOT NULL DEFAULT 'stripe',
  payment_provider_ref TEXT,
  total REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MXN',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
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

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_ref ON orders(payment_provider_ref);
