import { createLookupHandlers, validateHex } from "./_lookup.js";

const HEX_COLUMN = { name: "hex", default: "#cccccc", validate: validateHex };

export const { onRequestGet, onRequestPost } = createLookupHandlers("colores", HEX_COLUMN);
