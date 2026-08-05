import { createLookupItemHandlers } from "../_lookup.js";

export const { onRequestPut, onRequestDelete } = createLookupItemHandlers("categorias", "categoria_id");
