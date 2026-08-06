const { useState, useEffect } = React;

const API_BASE = window.APP_CONFIG && window.APP_CONFIG.API_BASE;
const USE_API = API_BASE != null;

const UNIDAD_OPTIONS = ["100g", "madeja", "unidad"];

const EMPTY_PRODUCT = {
  nombre: "",
  fabricante_id: "",
  categoria_id: "",
  imagen: "",
  precio: "",
  unidad_precio: "100g",
  descripcion: "",
};

function api(path, options = {}) {
  return fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_DIMENSION = 2000;
const RESIZABLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function resizeImageIfNeeded(file) {
  if (file.size <= MAX_UPLOAD_BYTES || !RESIZABLE_TYPES.has(file.type)) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_UPLOAD_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);

  let quality = 0.85;
  let blob = await canvasToBlob(canvas, "image/jpeg", quality);
  while (blob.size > MAX_UPLOAD_BYTES && quality > 0.4) {
    quality -= 0.15;
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
  }

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

function NotConfigured() {
  return (
    <div className="max-w-xl mx-auto px-6 py-24 text-center">
      <h1 className="font-display text-2xl font-semibold text-stone-800 mb-3">
        Administración no configurada
      </h1>
      <p className="text-stone-600">
        Este sitio está usando <code className="bg-stone-100 px-1 rounded">catalog.csv</code> en
        modo demo. Define <code className="bg-stone-100 px-1 rounded">API_BASE</code> en{" "}
        <code className="bg-stone-100 px-1 rounded">config.js</code> para conectar esta página a
        la API del catálogo (ver README.md).
      </p>
    </div>
  );
}

function Login({ onLoggedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setEnviando(true);
    api("/api/login", { method: "POST", body: JSON.stringify({ username, password }) })
      .then((res) => {
        if (!res.ok) throw new Error("Usuario o contraseña incorrectos");
        onLoggedIn();
      })
      .catch((err) => setError(err.message))
      .finally(() => setEnviando(false));
  };

  return (
    <div className="max-w-sm mx-auto px-6 py-24">
      <h1 className="font-display text-2xl font-semibold text-stone-800 mb-6 text-center">
        Acceso administración
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          className="border border-stone-300 rounded-lg px-3 py-2"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
        <input
          className="border border-stone-300 rounded-lg px-3 py-2"
          placeholder="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error && <p className="text-sm text-terracota-600">{error}</p>}
        <button
          type="submit"
          disabled={enviando}
          className="bg-terracota-600 hover:bg-terracota-700 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

function LookupSelect({ label, options, value, onChange, onCreate }) {
  const [creando, setCreando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const handleSelect = (e) => {
    if (e.target.value === "__nuevo__") {
      setCreando(true);
      return;
    }
    onChange(e.target.value);
  };

  const cancelarCreacion = () => {
    setCreando(false);
    setNuevoNombre("");
    setError("");
  };

  const handleCrear = () => {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    setError("");
    setGuardando(true);
    onCreate(nombre)
      .then((item) => {
        onChange(String(item.id));
        cancelarCreacion();
      })
      .catch((err) => setError(err.message))
      .finally(() => setGuardando(false));
  };

  if (creando) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-2">
          <input
            className="border border-stone-300 rounded-lg px-3 py-2 flex-1"
            placeholder={`Nuevo/a ${label.toLowerCase()}`}
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            onClick={handleCrear}
            disabled={guardando}
            className="bg-musgo-600 hover:bg-musgo-700 disabled:opacity-60 text-white font-semibold px-3 rounded-lg text-sm"
          >
            Guardar
          </button>
          <button type="button" onClick={cancelarCreacion} className="text-stone-500 text-sm px-2">
            Cancelar
          </button>
        </div>
        {error && <p className="text-xs text-terracota-600">{error}</p>}
      </div>
    );
  }

  return (
    <select
      className="border border-stone-300 rounded-lg px-3 py-2"
      value={value}
      onChange={handleSelect}
      required
    >
      <option value="" disabled>
        {label}
      </option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nombre}
        </option>
      ))}
      <option value="__nuevo__">+ Nuevo/a {label.toLowerCase()}…</option>
    </select>
  );
}

function ProductForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  error,
  fabricantes,
  categorias,
  onCrearFabricante,
  onCrearCategoria,
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const set = (field) => (e) => onChange({ ...values, [field]: e.target.value });
  const setValue = (field) => (value) => onChange({ ...values, [field]: value });

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadError("");
    setSubiendo(true);
    resizeImageIfNeeded(file)
      .then((subido) => {
        const body = new FormData();
        body.append("file", subido, subido.name || file.name);
        return fetch(`${API_BASE}/api/upload`, { method: "POST", credentials: "include", body });
      })
      .then((res) => {
        if (!res.ok) return parseJsonError(res, "No se pudo subir la imagen");
        return res.json();
      })
      .then((data) => onChange({ ...values, imagen: data.url }))
      .catch((err) => setUploadError(err.message))
      .finally(() => {
        setSubiendo(false);
        e.target.value = "";
      });
  };

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white border border-stone-200 rounded-2xl p-5">
      <input
        className="border border-stone-300 rounded-lg px-3 py-2 sm:col-span-2"
        placeholder="Nombre"
        value={values.nombre}
        onChange={set("nombre")}
        required
      />
      <LookupSelect
        label="Fabricante"
        options={fabricantes}
        value={values.fabricante_id}
        onChange={setValue("fabricante_id")}
        onCreate={onCrearFabricante}
      />
      <LookupSelect
        label="Categoría"
        options={categorias}
        value={values.categoria_id}
        onChange={setValue("categoria_id")}
        onCreate={onCrearCategoria}
      />
      <div className="flex flex-col gap-1">
        <input
          className="border border-stone-300 rounded-lg px-3 py-2"
          placeholder="URL de imagen (o sube un archivo)"
          value={values.imagen}
          onChange={set("imagen")}
        />
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={subiendo}
            className="text-xs text-stone-500"
          />
          {subiendo && <span className="text-xs text-stone-400">Subiendo…</span>}
        </div>
        {uploadError && <p className="text-xs text-terracota-600">{uploadError}</p>}
      </div>
      <input
        className="border border-stone-300 rounded-lg px-3 py-2"
        placeholder="Precio"
        type="number"
        step="0.01"
        min="0"
        value={values.precio}
        onChange={set("precio")}
        required
      />
      <select
        className="border border-stone-300 rounded-lg px-3 py-2"
        value={values.unidad_precio}
        onChange={set("unidad_precio")}
      >
        {UNIDAD_OPTIONS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
      <textarea
        className="border border-stone-300 rounded-lg px-3 py-2 sm:col-span-2"
        placeholder="Descripción"
        value={values.descripcion}
        onChange={set("descripcion")}
        rows={2}
      />
      {error && <p className="text-sm text-terracota-600 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2 flex gap-2">
        <button
          type="submit"
          className="bg-terracota-600 hover:bg-terracota-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="bg-white hover:bg-stone-50 text-stone-700 font-semibold px-4 py-2 rounded-lg border border-stone-200 transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

const CSV_COLUMNS = [
  "id",
  "nombre",
  "fabricante",
  "categoria",
  "imagen",
  "precio",
  "unidad_precio",
  "descripcion",
];

function csvEscape(valor) {
  const texto = valor == null ? "" : String(valor);
  if (/[",\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

function exportarProductosCSV(productos) {
  const filas = [
    CSV_COLUMNS.join(","),
    ...productos.map((p) => CSV_COLUMNS.map((col) => csvEscape(p[col])).join(",")),
  ];
  const blob = new Blob([filas.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `catalogo_${new Date().toISOString().slice(0, 10)}.csv`;
  enlace.click();
  URL.revokeObjectURL(url);
}

function ordenarPorNombre(lista) {
  return [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function parseJsonError(res, fallback) {
  return res.json().then(
    (data) => {
      throw new Error(data.error || fallback);
    },
    () => {
      throw new Error(fallback);
    }
  );
}

function LookupManager({ title, items, onRename, onDelete }) {
  const [editId, setEditId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState("");

  const empezar = (item) => {
    setEditId(item.id);
    setEditValue(item.nombre);
    setError("");
  };

  const cancelar = () => {
    setEditId(null);
    setEditValue("");
    setError("");
  };

  const guardar = (id) => {
    setError("");
    onRename(id, editValue).then(cancelar).catch((err) => setError(err.message));
  };

  const eliminar = (item) => {
    if (!window.confirm(`¿Eliminar "${item.nombre}"?`)) return;
    setError("");
    onDelete(item.id).catch((err) => setError(err.message));
  };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5">
      <h2 className="font-display text-base font-semibold text-stone-800 mb-3">{title}</h2>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            {editId === item.id ? (
              <>
                <input
                  className="border border-stone-300 rounded-lg px-2 py-1 flex-1 text-sm"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => guardar(item.id)}
                  className="text-musgo-600 hover:underline text-sm font-semibold"
                >
                  Guardar
                </button>
                <button type="button" onClick={cancelar} className="text-stone-500 text-sm">
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-stone-700">{item.nombre}</span>
                <button
                  type="button"
                  onClick={() => empezar(item)}
                  className="text-musgo-600 hover:underline text-sm"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => eliminar(item)}
                  className="text-terracota-600 hover:underline text-sm"
                >
                  Eliminar
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-terracota-600 mt-2">{error}</p>}
    </div>
  );
}

function AdminApp() {
  const [productos, setProductos] = useState([]);
  const [fabricantes, setFabricantes] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [editId, setEditId] = useState(null);
  const [formValues, setFormValues] = useState(EMPTY_PRODUCT);
  const [formError, setFormError] = useState("");
  const [mostrarGestion, setMostrarGestion] = useState(false);

  const cargarProductos = () => {
    setCargando(true);
    api("/api/products")
      .then((res) => res.json())
      .then((data) => setProductos(data))
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    cargarProductos();
    api("/api/fabricantes").then((res) => res.json()).then((data) => setFabricantes(ordenarPorNombre(data)));
    api("/api/categorias").then((res) => res.json()).then((data) => setCategorias(ordenarPorNombre(data)));
  }, []);

  const crearValorLookup = (path, setLista) => (nombre) =>
    api(path, { method: "POST", body: JSON.stringify({ nombre }) })
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo guardar el valor");
        return res.json();
      })
      .then((item) => {
        setLista((prev) =>
          prev.some((v) => v.id === item.id) ? prev : ordenarPorNombre([...prev, item])
        );
        return item;
      });

  const crearFabricante = crearValorLookup("/api/fabricantes", setFabricantes);
  const crearCategoria = crearValorLookup("/api/categorias", setCategorias);

  const renombrarValorLookup = (path, setLista) => (id, nombre) =>
    api(`${path}/${id}`, { method: "PUT", body: JSON.stringify({ nombre }) })
      .then((res) => {
        if (!res.ok) return parseJsonError(res, "No se pudo renombrar");
        return res.json();
      })
      .then((item) => {
        setLista((prev) => ordenarPorNombre(prev.map((v) => (v.id === id ? item : v))));
        cargarProductos();
        return item;
      });

  const eliminarValorLookup = (path, setLista) => (id) =>
    api(`${path}/${id}`, { method: "DELETE" }).then((res) => {
      if (!res.ok) return parseJsonError(res, "No se pudo eliminar");
      setLista((prev) => prev.filter((v) => v.id !== id));
    });

  const renombrarFabricante = renombrarValorLookup("/api/fabricantes", setFabricantes);
  const eliminarFabricante = eliminarValorLookup("/api/fabricantes", setFabricantes);
  const renombrarCategoria = renombrarValorLookup("/api/categorias", setCategorias);
  const eliminarCategoria = eliminarValorLookup("/api/categorias", setCategorias);

  const empezarEdicion = (producto) => {
    setEditId(producto.id);
    setFormValues({
      nombre: producto.nombre || "",
      fabricante_id: producto.fabricante_id ? String(producto.fabricante_id) : "",
      categoria_id: producto.categoria_id ? String(producto.categoria_id) : "",
      imagen: producto.imagen || "",
      precio: producto.precio ?? "",
      unidad_precio: producto.unidad_precio || "100g",
      descripcion: producto.descripcion || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelarEdicion = () => {
    setEditId(null);
    setFormValues(EMPTY_PRODUCT);
    setFormError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError("");
    const path = editId ? `/api/products/${editId}` : "/api/products";
    const method = editId ? "PUT" : "POST";
    api(path, { method, body: JSON.stringify(formValues) })
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo guardar el producto");
        cancelarEdicion();
        cargarProductos();
      })
      .catch((err) => setFormError(err.message));
  };

  const handleDelete = (producto) => {
    if (!window.confirm(`¿Eliminar "${producto.nombre}"?`)) return;
    api(`/api/products/${producto.id}`, { method: "DELETE" }).then(() => cargarProductos());
  };

  const handleLogout = () => {
    api("/api/logout", { method: "POST" }).then(() => window.location.reload());
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl font-semibold text-stone-800">
          Administración del catálogo
        </h1>
        <button
          onClick={handleLogout}
          className="text-sm font-semibold text-stone-500 hover:text-terracota-600"
        >
          Cerrar sesión
        </button>
      </div>

      <ProductForm
        values={formValues}
        onChange={setFormValues}
        onSubmit={handleSubmit}
        onCancel={editId ? cancelarEdicion : null}
        submitLabel={editId ? "Guardar cambios" : "Añadir producto"}
        error={formError}
        fabricantes={fabricantes}
        categorias={categorias}
        onCrearFabricante={crearFabricante}
        onCrearCategoria={crearCategoria}
      />

      <button
        type="button"
        onClick={() => setMostrarGestion((v) => !v)}
        className="mt-4 text-sm font-semibold text-musgo-600 hover:underline"
      >
        {mostrarGestion ? "Ocultar gestión de fabricantes/categorías" : "Gestionar fabricantes y categorías"}
      </button>

      {mostrarGestion && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <LookupManager
            title="Fabricantes"
            items={fabricantes}
            onRename={renombrarFabricante}
            onDelete={eliminarFabricante}
          />
          <LookupManager
            title="Categorías"
            items={categorias}
            onRename={renombrarCategoria}
            onDelete={eliminarCategoria}
          />
        </div>
      )}

      <div className="mt-10">
        {cargando ? (
          <p className="text-stone-500">Cargando productos…</p>
        ) : (
          <>
            <div className="flex justify-end mb-3">
              <button
                type="button"
                onClick={() => exportarProductosCSV(productos)}
                className="text-sm font-semibold text-musgo-600 hover:underline"
              >
                Exportar CSV
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-stone-500 border-b border-stone-200">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Nombre</th>
                  <th className="py-2 pr-2">Categoría</th>
                  <th className="py-2 pr-2">Precio</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {productos.map((p, indice) => (
                  <tr key={p.id} className="border-b border-stone-100">
                    <td className="py-2 pr-2 text-stone-400">{indice + 1}</td>
                    <td className="py-2 pr-2">{p.nombre}</td>
                    <td className="py-2 pr-2">{p.categoria}</td>
                    <td className="py-2 pr-2">
                      {p.precio} / {p.unidad_precio}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => empezarEdicion(p)}
                        className="text-musgo-600 hover:underline mr-3"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="text-terracota-600 hover:underline"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

function App() {
  const [sesion, setSesion] = useState("comprobando"); // comprobando | anonimo | autenticado

  useEffect(() => {
    if (!USE_API) return;
    api("/api/session")
      .then((res) => res.json())
      .then((data) => setSesion(data.authenticated ? "autenticado" : "anonimo"))
      .catch(() => setSesion("anonimo"));
  }, []);

  if (!USE_API) return <NotConfigured />;
  if (sesion === "comprobando") return null;
  if (sesion === "anonimo") return <Login onLoggedIn={() => setSesion("autenticado")} />;
  return <AdminApp />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
