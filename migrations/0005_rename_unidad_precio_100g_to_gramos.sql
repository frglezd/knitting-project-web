-- Migration number: 0005 	 2026-09-17T00:02:00.000Z
--
-- Data-only value rename, not a schema change: products.unidad_precio is a
-- plain TEXT column with no CHECK constraint, so no ALTER TABLE is needed
-- here. Renames the weight-priced value from '100g' to 'gramos' for
-- clarity (vs. the piece-priced values 'madeja'/'unidad'). The app-layer
-- enum (UNIDAD_OPTIONS in admin.jsx, UNIDAD_LABEL in app.jsx) is updated to
-- match in a separate code change. schema.sql is unchanged by this
-- migration — it doesn't encode the allowed unidad_precio values, only the
-- column type.

UPDATE products SET unidad_precio = 'gramos' WHERE unidad_precio = '100g';
