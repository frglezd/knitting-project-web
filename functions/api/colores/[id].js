import { createLookupItemHandlers } from "../_lookup.js";

export const { onRequestPut, onRequestDelete } = createLookupItemHandlers("colores", {
  table: "product_colores",
  column: "color_id",
});
