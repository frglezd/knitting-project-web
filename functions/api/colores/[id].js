import { createLookupItemHandlers } from "../_lookup.js";
import { HEX_COLUMN } from "../colores.js";

export const { onRequestPut, onRequestDelete } = createLookupItemHandlers(
  "colores",
  { table: "product_colores", column: "color_id" },
  HEX_COLUMN
);
