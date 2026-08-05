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
  descripcion TEXT
);
