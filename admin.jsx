const { useState, useEffect } = React;

const API_BASE = window.APP_CONFIG && window.APP_CONFIG.API_BASE;
const USE_API = API_BASE != null;

const UNIDAD_OPTIONS = ["100g", "ovillo", "unidad"];

const EMPTY_PRODUCT = {
  nombre: "",
  fabricante: "",
  categoria: "",
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

function ProductForm({ values, onChange, onSubmit, onCancel, submitLabel, error }) {
  const set = (field) => (e) => onChange({ ...values, [field]: e.target.value });

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white border border-stone-200 rounded-2xl p-5">
      <input
        className="border border-stone-300 rounded-lg px-3 py-2 sm:col-span-2"
        placeholder="Nombre"
        value={values.nombre}
        onChange={set("nombre")}
        required
      />
      <input
        className="border border-stone-300 rounded-lg px-3 py-2"
        placeholder="Fabricante"
        value={values.fabricante}
        onChange={set("fabricante")}
        required
      />
      <input
        className="border border-stone-300 rounded-lg px-3 py-2"
        placeholder="Categoría"
        value={values.categoria}
        onChange={set("categoria")}
        required
      />
      <input
        className="border border-stone-300 rounded-lg px-3 py-2"
        placeholder="Ruta de imagen (assets/images/…)"
        value={values.imagen}
        onChange={set("imagen")}
      />
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

function AdminApp() {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [editId, setEditId] = useState(null);
  const [formValues, setFormValues] = useState(EMPTY_PRODUCT);
  const [formError, setFormError] = useState("");

  const cargarProductos = () => {
    setCargando(true);
    api("/api/products")
      .then((res) => res.json())
      .then((data) => setProductos(data))
      .finally(() => setCargando(false));
  };

  useEffect(cargarProductos, []);

  const empezarEdicion = (producto) => {
    setEditId(producto.id);
    setFormValues({
      nombre: producto.nombre || "",
      fabricante: producto.fabricante || "",
      categoria: producto.categoria || "",
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
      />

      <div className="mt-10">
        {cargando ? (
          <p className="text-stone-500">Cargando productos…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-stone-500 border-b border-stone-200">
                <th className="py-2 pr-2">Nombre</th>
                <th className="py-2 pr-2">Categoría</th>
                <th className="py-2 pr-2">Precio</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.id} className="border-b border-stone-100">
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
