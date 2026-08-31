const API_BASE = "/api/v1/item";

const catalogEl = document.getElementById("catalog");
const statusEl = document.getElementById("status");
const searchInput = document.getElementById("search-input");
const addForm = document.getElementById("add-form");
const addToggle = document.getElementById("add-toggle");
const addCancel = document.getElementById("add-cancel");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b3392f" : "";
}

function renderItems(items) {
  catalogEl.innerHTML = "";
  if (items.length === 0) {
    catalogEl.innerHTML = "<p>No items found.</p>";
    return;
  }
  for (const item of items) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${item.imagen || ""}" alt="${item.nombre}" onerror="this.style.visibility='hidden'">
      <div class="card-body">
        <h3>${item.nombre}</h3>
        <div class="card-meta">${item.categoria} &middot; ${item.fabricante}</div>
        <div class="card-price">$${Number(item.precio).toFixed(2)} ${item.unidadPrecio}</div>
        <div class="card-desc">${item.descripcion || ""}</div>
      </div>
      <div class="card-actions">
        <button data-id="${item.id}">Delete</button>
      </div>
    `;
    card.querySelector("button[data-id]").addEventListener("click", () => deleteItem(item.id));
    catalogEl.appendChild(card);
  }
}

async function loadItems(nombre = "") {
  setStatus("Loading...");
  try {
    const url = nombre ? `${API_BASE}?nombre=${encodeURIComponent(nombre)}` : API_BASE;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    const items = await res.json();
    renderItems(items);
    setStatus(`${items.length} item(s)`);
  } catch (err) {
    setStatus(`Failed to load catalog: ${err.message}`, true);
  }
}

async function deleteItem(id) {
  if (!confirm("Delete this item?")) return;
  try {
    const res = await fetch(`${API_BASE}/id/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    loadItems(searchInput.value.trim());
  } catch (err) {
    setStatus(`Failed to delete item: ${err.message}`, true);
  }
}

async function addItem(formData) {
  const payload = {
    nombre: formData.get("nombre"),
    categoria: formData.get("categoria"),
    fabricante: formData.get("fabricante"),
    precio: Number(formData.get("precio")),
    unidadPrecio: formData.get("unidadPrecio"),
    imagen: formData.get("imagen"),
    descripcion: formData.get("descripcion"),
  };
  try {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    addForm.reset();
    addForm.hidden = true;
    loadItems();
  } catch (err) {
    setStatus(`Failed to add item: ${err.message}`, true);
  }
}

let searchDebounce;
searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => loadItems(searchInput.value.trim()), 300);
});

addToggle.addEventListener("click", () => {
  addForm.hidden = !addForm.hidden;
});

addCancel.addEventListener("click", () => {
  addForm.reset();
  addForm.hidden = true;
});

addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  addItem(new FormData(addForm));
});

loadItems();
