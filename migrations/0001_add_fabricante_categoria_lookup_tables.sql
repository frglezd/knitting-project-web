-- Migration number: 0001 	 2026-08-05T21:06:47.560Z
--
-- Replaces free-text products.fabricante/categoria with lookup tables so
-- admin-entered values are deduplicated case/whitespace-insensitively.
-- Canonical spelling per group = the value from the lowest product id
-- (i.e. the earliest, cleanest entry) in that normalized group.

PRAGMA defer_foreign_keys=TRUE;

CREATE TABLE fabricantes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  nombre_normalizado TEXT NOT NULL UNIQUE
);

CREATE TABLE categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  nombre_normalizado TEXT NOT NULL UNIQUE
);

INSERT INTO fabricantes (nombre, nombre_normalizado)
SELECT nombre, norm FROM (
  SELECT
    TRIM(fabricante) AS nombre,
    LOWER(TRIM(fabricante)) AS norm,
    ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(fabricante)) ORDER BY id) AS rn
  FROM products
) WHERE rn = 1;

INSERT INTO categorias (nombre, nombre_normalizado)
SELECT nombre, norm FROM (
  SELECT
    TRIM(categoria) AS nombre,
    LOWER(TRIM(categoria)) AS norm,
    ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(categoria)) ORDER BY id) AS rn
  FROM products
) WHERE rn = 1;

ALTER TABLE products ADD COLUMN fabricante_id INTEGER REFERENCES fabricantes(id);
ALTER TABLE products ADD COLUMN categoria_id INTEGER REFERENCES categorias(id);

UPDATE products SET fabricante_id = (
  SELECT id FROM fabricantes WHERE nombre_normalizado = LOWER(TRIM(products.fabricante))
);
UPDATE products SET categoria_id = (
  SELECT id FROM categorias WHERE nombre_normalizado = LOWER(TRIM(products.categoria))
);

CREATE TABLE products_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  fabricante_id INTEGER NOT NULL REFERENCES fabricantes(id),
  categoria_id INTEGER NOT NULL REFERENCES categorias(id),
  imagen TEXT,
  precio REAL NOT NULL,
  unidad_precio TEXT NOT NULL,
  descripcion TEXT
);

INSERT INTO products_new (id, nombre, fabricante_id, categoria_id, imagen, precio, unidad_precio, descripcion)
SELECT id, nombre, fabricante_id, categoria_id, imagen, precio, unidad_precio, descripcion FROM products;

DROP TABLE products;
ALTER TABLE products_new RENAME TO products;

UPDATE sqlite_sequence SET seq = (SELECT MAX(id) FROM products) WHERE name = 'products';
