CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  fabricante TEXT NOT NULL,
  categoria TEXT NOT NULL,
  imagen TEXT,
  precio REAL NOT NULL,
  unidad_precio TEXT NOT NULL,
  descripcion TEXT
);
