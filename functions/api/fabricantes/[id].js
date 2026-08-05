import { createLookupItemHandlers } from "../_lookup.js";

export const { onRequestPut, onRequestDelete } = createLookupItemHandlers("fabricantes", "fabricante_id");
