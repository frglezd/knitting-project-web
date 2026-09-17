-- Migration number: 0006 	 2026-09-17T00:03:00.000Z
--
-- Adds a hex color code to the colores table (migration 0004) so each
-- color can render as a visual swatch/icon, and seeds a sample list of
-- common yarn colors for demo purposes. INSERT OR IGNORE guards the seed
-- against a partial re-run on a DB where some of these color names
-- (nombre_normalizado is UNIQUE) already exist.

ALTER TABLE colores ADD COLUMN hex TEXT NOT NULL DEFAULT '#cccccc';

INSERT OR IGNORE INTO colores (nombre, nombre_normalizado, hex) VALUES
  ('Rojo', 'rojo', '#E63946'),
  ('Azul', 'azul', '#1D3557'),
  ('Verde', 'verde', '#2A9134'),
  ('Amarillo', 'amarillo', '#F1C40F'),
  ('Negro', 'negro', '#111111'),
  ('Blanco', 'blanco', '#FFFFFF'),
  ('Beige', 'beige', '#E8DCC8'),
  ('Rosa', 'rosa', '#F4A6C6'),
  ('Morado', 'morado', '#6A4C93'),
  ('Gris', 'gris', '#9CA3AF'),
  ('Café', 'café', '#6F4E37'),
  ('Naranja', 'naranja', '#E67E22');
