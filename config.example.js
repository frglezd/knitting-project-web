// Copy this file to config.js and adjust for your environment.
// config.js is gitignored, so production values never enter the repo.
// If config.js is absent (e.g. this demo), app.jsx falls back to catalog.csv.
window.APP_CONFIG = {
  CATALOG_URL: "catalog.csv",
  // Set API_BASE (e.g. "" for same-origin, or a full URL) to load the
  // catalog from the Cloudflare Pages Functions API instead of catalog.csv,
  // and to enable admin.html. Leave as null to keep using catalog.csv.
  API_BASE: null,
  // Optional. Override any subset of the store name, hero text, "Sobre
  // nosotros" and footer text (address, hours, contact, rights line)
  // without touching app.jsx. Fields left out keep the built-in demo
  // copy. See default-content.js for every available key.
  CONTENT: {
    // marca: "...",
    // titulo: "...", // <title> de la pestaña del navegador
    // hero: "...",
    // nosotros: "...",
    // footerTagline: "...",
    // footerDireccion: "...",
    // footerHorario: "...",
    // footerEmail: "...",
    // footerTelefono: "...",
    // footerDerechos: "...",
  },
};
