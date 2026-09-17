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
