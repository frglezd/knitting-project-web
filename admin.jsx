const { useState, useEffect } = React;

const API_BASE = window.APP_CONFIG && window.APP_CONFIG.API_BASE;
const USE_API = API_BASE != null;

const UNIDAD_OPTIONS = ["gramos", "madeja", "unidad"];

// Unit label for stock quantities, matching each unidad_precio's real-world
// count: grams for weight-priced yarn, whole skeins/pieces otherwise.
const STOCK_UNIT_LABEL = { gramos: "g", madeja: "madejas", unidad: "piezas" };

const EMPTY_PRODUCT = {
  nombre: "",
  fabricante_id: "",
  categoria_id: "",
  imagen: "",
  precio: "",
  unidad_precio: "gramos",
  descripcion: "",
  stock: "0",
  colores: [],
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

// `extraCampo` is an optional slot for a second creation field beyond
// `nombre` (only colores uses it, for `hex`): { valorInicial, render(valor,
// setValor) }. When present, `onCreate` is called as `onCreate(nombre,
// valorExtra)`; when absent (fabricantes/categorias), `onCreate(nombre)`
// keeps its original one-argument contract.
function LookupSelect({ label, options, value, onChange, onCreate, extraCampo }) {
  const [creando, setCreando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [valorExtra, setValorExtra] = useState(extraCampo ? extraCampo.valorInicial : undefined);
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
    setValorExtra(extraCampo ? extraCampo.valorInicial : undefined);
    setError("");
  };

  const handleCrear = () => {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    setError("");
    setGuardando(true);
    const promesa = extraCampo ? onCreate(nombre, valorExtra) : onCreate(nombre);
    promesa
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
          {extraCampo && extraCampo.render(valorExtra, setValorExtra)}
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

// Extra creation field for the "Colores" LookupSelect: an <input
// type="color"> alongside the name field, so `onCrearColor(nombre, hex)` has
// a hex to send. Passed only at the colores call site — fabricante/categoria
// LookupSelects don't pass `extraCampo` and keep their one-argument
// `onCreate(nombre)` contract.
const COLOR_HEX_CAMPO = {
  key: "hex",
  valorInicial: "#cccccc",
  render: (valor, setValor) => (
    <input
      key="hex"
      type="color"
      value={valor}
      onChange={(e) => setValor(e.target.value)}
      title="Color"
      className="w-10 h-10 shrink-0 border border-stone-300 rounded-lg p-0.5"
    />
  ),
  renderView: (valor) => (
    <span
      className="w-6 h-6 rounded-full border border-stone-300 shrink-0"
      style={{ backgroundColor: valor || "#cccccc" }}
      title={valor}
    />
  ),
};

function ProductForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  error,
  fabricantes,
  categorias,
  colores,
  onCrearFabricante,
  onCrearCategoria,
  onCrearColor,
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const set = (field) => (e) => onChange({ ...values, [field]: e.target.value });
  const setValue = (field) => (value) => onChange({ ...values, [field]: value });

  const tieneColores = (values.colores || []).length > 0;

  const agregarColorVariante = () => {
    onChange({ ...values, colores: [...(values.colores || []), { color_id: "", stock: "0" }] });
  };

  const actualizarColorVariante = (indice, cambios) => {
    onChange({
      ...values,
      colores: values.colores.map((c, i) => (i === indice ? { ...c, ...cambios } : c)),
    });
  };

  const eliminarColorVariante = (indice) => {
    onChange({ ...values, colores: values.colores.filter((_, i) => i !== indice) });
  };

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
      <div className="flex flex-col gap-1">
        <input
          className="border border-stone-300 rounded-lg px-3 py-2 disabled:bg-stone-100 disabled:text-stone-400"
          placeholder={`Existencias (${STOCK_UNIT_LABEL[values.unidad_precio] || values.unidad_precio})`}
          type="number"
          min="0"
          step="1"
          value={values.stock}
          onChange={set("stock")}
          disabled={tieneColores}
        />
        {tieneColores && <p className="text-xs text-stone-500">Se usa el stock por color</p>}
      </div>
      <textarea
        className="border border-stone-300 rounded-lg px-3 py-2 sm:col-span-2"
        placeholder="Descripción"
        value={values.descripcion}
        onChange={set("descripcion")}
        rows={2}
      />
      <div className="sm:col-span-2 flex flex-col gap-2 border border-stone-200 rounded-lg p-3">
        <h3 className="text-sm font-semibold text-stone-600">Colores disponibles para producto</h3>
        {(values.colores || []).map((c, indice) => (
          <div key={indice} className="flex flex-col sm:flex-row gap-2 sm:items-start">
            <span
              className="w-9 h-9 rounded-full border border-stone-300 shrink-0 mt-0.5"
              style={{
                backgroundColor:
                  (colores.find((co) => String(co.id) === String(c.color_id)) || {}).hex || "#cccccc",
              }}
              title="Vista previa del color"
            />
            <div className="flex-1">
              <LookupSelect
                label="Color"
                options={colores}
                value={c.color_id}
                onChange={(value) => actualizarColorVariante(indice, { color_id: value })}
                onCreate={onCrearColor}
                extraCampo={COLOR_HEX_CAMPO}
              />
            </div>
            <input
              className="border border-stone-300 rounded-lg px-3 py-2 sm:w-40"
              placeholder={`Existencias (${STOCK_UNIT_LABEL[values.unidad_precio] || values.unidad_precio})`}
              type="number"
              min="0"
              step="1"
              value={c.stock}
              onChange={(e) => actualizarColorVariante(indice, { stock: e.target.value })}
            />
            <button
              type="button"
              onClick={() => eliminarColorVariante(indice)}
              className="text-sm text-terracota-600 hover:underline self-start sm:self-center"
            >
              Eliminar
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={agregarColorVariante}
          className="self-start text-sm font-semibold text-musgo-600 hover:underline"
        >
          + Agregar color
        </button>
      </div>
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

function LookupManager({ title, items, onRename, onDelete, extraCampo }) {
  const [editId, setEditId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editExtra, setEditExtra] = useState(extraCampo ? extraCampo.valorInicial : undefined);
  const [error, setError] = useState("");

  const empezar = (item) => {
    setEditId(item.id);
    setEditValue(item.nombre);
    setEditExtra(extraCampo ? item[extraCampo.key] : undefined);
    setError("");
  };

  const cancelar = () => {
    setEditId(null);
    setEditValue("");
    setEditExtra(extraCampo ? extraCampo.valorInicial : undefined);
    setError("");
  };

  const guardar = (id) => {
    setError("");
    const promesa = extraCampo ? onRename(id, editValue, editExtra) : onRename(id, editValue);
    promesa.then(cancelar).catch((err) => setError(err.message));
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
                {extraCampo && extraCampo.render(editExtra, setEditExtra)}
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
                {extraCampo && extraCampo.renderView(item[extraCampo.key])}
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

const CONTENT_TEXT_FIELDS = [
  { key: "marca", label: "Nombre de la marca" },
  { key: "titulo", label: "Título de la pestaña del navegador" },
  { key: "heroTitulo", label: 'Hero: frase corta (p. ej. "Bienvenidos a")' },
  { key: "heroSubtitulo", label: "Hero: subtítulo" },
  { key: "redesFacebook", label: "URL de Facebook" },
  { key: "redesInstagram", label: "URL de Instagram" },
  { key: "instagramHandle", label: "@usuario de Instagram" },
  { key: "footerDireccion", label: "Dirección" },
  { key: "footerHorario", label: "Horario" },
  { key: "footerEmail", label: "Correo de contacto" },
  { key: "footerTelefono", label: "Teléfono" },
  { key: "footerDerechos", label: "Texto de derechos (pie de página)" },
];

const CONTENT_TEXTAREA_FIELDS = [
  { key: "hero", label: "Texto del hero" },
  { key: "nosotros", label: 'Texto de "Sobre nosotros"' },
  { key: "footerTagline", label: "Frase corta del pie de página" },
  { key: "blogProximamente", label: "Texto del placeholder del blog" },
  { key: "catalogoNotaAgotado", label: "Catálogo: nota de producto agotado" },
];

const CONTENT_IMAGE_FIELDS = [
  { key: "tileEstambre", label: "Foto: tile Estambres" },
  { key: "tileKits", label: "Foto: tile Kits para Crochet" },
  { key: "tileAccesorios", label: "Foto: tile Accesorios" },
];

function ImageField({ label, value, onChange }) {
  const [subiendo, setSubiendo] = useState(false);
  const [uploadError, setUploadError] = useState("");

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
      .then((data) => onChange(data.url))
      .catch((err) => setUploadError(err.message))
      .finally(() => {
        setSubiendo(false);
        e.target.value = "";
      });
  };

  return (
    <div className="flex gap-3">
      {value && (
        <img
          src={value}
          alt=""
          className="w-16 h-16 rounded-lg object-cover border border-stone-200 shrink-0"
        />
      )}
      <div className="flex flex-col gap-1 flex-1">
        <label className="text-sm font-semibold text-stone-600">{label}</label>
        <input
          className="border border-stone-300 rounded-lg px-3 py-2"
          placeholder="URL de imagen (o sube un archivo)"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
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
    </div>
  );
}

function ContentSettings() {
  const [valores, setValores] = useState(() => ({
    ...(window.DEFAULT_CONTENT || {}),
    ...((window.APP_CONFIG && window.APP_CONFIG.CONTENT) || {}),
  }));
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    api("/api/content")
      .then((res) => res.json())
      .then((data) => {
        if (data) setValores((v) => ({ ...v, ...data }));
      })
      .finally(() => setCargando(false));
  }, []);

  const set = (key) => (e) => {
    setGuardado(false);
    setValores((v) => ({ ...v, [key]: e.target.value }));
  };

  const setImagen = (key) => (url) => {
    setGuardado(false);
    setValores((v) => ({ ...v, imagenes: { ...v.imagenes, [key]: url } }));
  };

  const setLogo = (url) => {
    setGuardado(false);
    setValores((v) => ({ ...v, logo: url }));
  };

  const setTestimonio = (indice, campo) => (e) => {
    setGuardado(false);
    setValores((v) => ({
      ...v,
      testimonios: v.testimonios.map((t, i) => (i === indice ? { ...t, [campo]: e.target.value } : t)),
    }));
  };

  const agregarTestimonio = () => {
    setGuardado(false);
    setValores((v) => ({ ...v, testimonios: [...(v.testimonios || []), { nombre: "", texto: "" }] }));
  };

  const eliminarTestimonio = (indice) => {
    setGuardado(false);
    setValores((v) => ({ ...v, testimonios: v.testimonios.filter((_, i) => i !== indice) }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setGuardado(false);
    setGuardando(true);
    api("/api/content", { method: "PUT", body: JSON.stringify(valores) })
      .then((res) => {
        if (!res.ok) return parseJsonError(res, "No se pudo guardar el contenido");
        setGuardado(true);
      })
      .catch((err) => setError(err.message))
      .finally(() => setGuardando(false));
  };

  if (cargando) {
    return <p className="text-stone-500">Cargando contenido…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="bg-white border border-stone-200 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CONTENT_TEXT_FIELDS.map(({ key, label }) => (
          <div key={key} className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-stone-600">{label}</label>
            <input
              className="border border-stone-300 rounded-lg px-3 py-2"
              value={valores[key] || ""}
              onChange={set(key)}
            />
          </div>
        ))}
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl p-5 flex flex-col gap-3">
        {CONTENT_TEXTAREA_FIELDS.map(({ key, label }) => (
          <div key={key} className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-stone-600">{label}</label>
            <textarea
              className="border border-stone-300 rounded-lg px-3 py-2"
              value={valores[key] || ""}
              onChange={set(key)}
              rows={3}
            />
          </div>
        ))}
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <h3 className="font-display text-lg font-semibold text-stone-800 mb-3">Imágenes del sitio</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ImageField label="Logo" value={valores.logo} onChange={setLogo} />
          <ImageField label="Foto del hero" value={valores.imagenes && valores.imagenes.hero} onChange={setImagen("hero")} />
          <ImageField
            label='Foto de "Sobre nosotros"'
            value={valores.imagenes && valores.imagenes.nosotros}
            onChange={setImagen("nosotros")}
          />
          {CONTENT_IMAGE_FIELDS.map(({ key, label }) => (
            <ImageField
              key={key}
              label={label}
              value={valores.imagenes && valores.imagenes[key]}
              onChange={setImagen(key)}
            />
          ))}
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <h3 className="font-display text-lg font-semibold text-stone-800 mb-3">Testimonios</h3>
        <div className="flex flex-col gap-3">
          {(valores.testimonios || []).map((t, i) => (
            <div key={i} className="flex flex-col sm:flex-row gap-2 sm:items-start">
              <input
                className="border border-stone-300 rounded-lg px-3 py-2 sm:w-48"
                placeholder="Nombre"
                value={t.nombre}
                onChange={setTestimonio(i, "nombre")}
              />
              <textarea
                className="border border-stone-300 rounded-lg px-3 py-2 flex-1"
                placeholder="Texto"
                value={t.texto}
                onChange={setTestimonio(i, "texto")}
                rows={2}
              />
              <button
                type="button"
                onClick={() => eliminarTestimonio(i)}
                className="text-sm text-terracota-600 hover:underline self-start"
              >
                Eliminar
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={agregarTestimonio}
            className="self-start text-sm font-semibold text-musgo-600 hover:underline"
          >
            + Añadir testimonio
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-terracota-600">{error}</p>}
      {guardado && !guardando && <p className="text-sm text-musgo-600">Guardado.</p>}
      <div>
        <button
          type="submit"
          disabled={guardando}
          className="bg-terracota-600 hover:bg-terracota-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

const ORDER_STATUS_LABEL = {
  pending_payment: "Pendiente de pago",
  paid: "Pagado",
  paid_oversold: "Pagado (sin existencias)",
  fulfilled: "Entregado",
  payment_failed: "Pago fallido",
  cancelled: "Cancelado",
};

const ORDER_STATUS_BADGE_CLASS = {
  pending_payment: "bg-stone-100 text-stone-600",
  paid: "bg-musgo-100 text-musgo-700",
  paid_oversold: "bg-terracota-100 text-terracota-700",
  fulfilled: "bg-emerald-100 text-emerald-700",
  payment_failed: "bg-terracota-100 text-terracota-700",
  cancelled: "bg-stone-200 text-stone-500",
};

function formatFecha(iso) {
  if (!iso) return "";
  const fecha = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

function PedidosTab() {
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargarPedidos = () => {
    setCargando(true);
    setError("");
    api("/api/orders")
      .then((res) => {
        if (!res.ok) return parseJsonError(res, "No se pudieron cargar los pedidos");
        return res.json();
      })
      .then((data) => setPedidos(data))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    cargarPedidos();
  }, []);

  const marcarEntregado = (pedido) => {
    api(`/api/orders/${pedido.id}`, { method: "PUT", body: JSON.stringify({ status: "fulfilled" }) })
      .then((res) => {
        if (!res.ok) return parseJsonError(res, "No se pudo actualizar el pedido");
        cargarPedidos();
      })
      .catch((err) => setError(err.message));
  };

  if (cargando) {
    return <p className="text-stone-500">Cargando pedidos…</p>;
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5">
      {error && <p className="text-sm text-terracota-600 mb-3">{error}</p>}
      {pedidos.length === 0 ? (
        <p className="text-stone-500">Todavía no hay pedidos.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500 border-b border-stone-200">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Fecha</th>
              <th className="py-2 pr-2">Cliente</th>
              <th className="py-2 pr-2">Productos</th>
              <th className="py-2 pr-2">Total</th>
              <th className="py-2 pr-2">Estado</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => {
              const items = p.items || [];
              return (
                <tr key={p.id} className="border-b border-stone-100 align-top">
                  <td className="py-2 pr-2 text-stone-400">{p.id}</td>
                  <td className="py-2 pr-2 whitespace-nowrap">{formatFecha(p.created_at)}</td>
                  <td className="py-2 pr-2">
                    <div>{p.customer_name}</div>
                    <div className="text-stone-500 text-xs">{p.customer_email}</div>
                  </td>
                  <td className="py-2 pr-2">
                    <div className="flex flex-col gap-1">
                      {items.map((item, i) => {
                        const unidad = STOCK_UNIT_LABEL[item.unidad_precio] || item.unidad_precio;
                        return (
                          <div key={i}>
                            {item.product_nombre}
                            {item.color_nombre ? ` — ${item.color_nombre}` : ""} · {item.cantidad} {unidad}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td className="py-2 pr-2 whitespace-nowrap">
                    ${Number(p.total).toFixed(2)} {p.currency}
                  </td>
                  <td className="py-2 pr-2">
                    <span
                      className={
                        "inline-block px-2 py-1 rounded-full text-xs font-semibold " +
                        (ORDER_STATUS_BADGE_CLASS[p.status] || "bg-stone-100 text-stone-600")
                      }
                    >
                      {ORDER_STATUS_LABEL[p.status] || p.status}
                    </span>
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {p.status === "paid" && (
                      <button
                        type="button"
                        onClick={() => marcarEntregado(p)}
                        className="text-musgo-600 hover:underline"
                      >
                        Marcar como entregado
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AdminApp() {
  const [vista, setVista] = useState("catalogo"); // catalogo | contenido | pedidos
  const [productos, setProductos] = useState([]);
  const [fabricantes, setFabricantes] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [colores, setColores] = useState([]);
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
    api("/api/colores").then((res) => res.json()).then((data) => setColores(ordenarPorNombre(data)));
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

  // Colores take a `hex` alongside `nombre` (LookupSelect's `extraCampo`
  // passes it as the second arg), so this isn't built on the generic
  // `crearValorLookup` factory used by fabricante/categoria.
  const crearColor = (nombre, hex) =>
    api("/api/colores", { method: "POST", body: JSON.stringify({ nombre, hex }) })
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo guardar el valor");
        return res.json();
      })
      .then((item) => {
        setColores((prev) =>
          prev.some((v) => v.id === item.id) ? prev : ordenarPorNombre([...prev, item])
        );
        return item;
      });

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

  // Colores take a `hex` alongside `nombre` on rename too (mirrors
  // `crearColor` above), so this isn't built on `renombrarValorLookup`.
  const renombrarColor = (id, nombre, hex) =>
    api(`/api/colores/${id}`, { method: "PUT", body: JSON.stringify({ nombre, hex }) })
      .then((res) => {
        if (!res.ok) return parseJsonError(res, "No se pudo renombrar");
        return res.json();
      })
      .then((item) => {
        setColores((prev) => ordenarPorNombre(prev.map((v) => (v.id === id ? item : v))));
        cargarProductos();
        return item;
      });
  const eliminarColor = eliminarValorLookup("/api/colores", setColores);

  const empezarEdicion = (producto) => {
    setEditId(producto.id);
    setFormValues({
      nombre: producto.nombre || "",
      fabricante_id: producto.fabricante_id ? String(producto.fabricante_id) : "",
      categoria_id: producto.categoria_id ? String(producto.categoria_id) : "",
      imagen: producto.imagen || "",
      precio: producto.precio ?? "",
      unidad_precio: producto.unidad_precio || "gramos",
      descripcion: producto.descripcion || "",
      stock: producto.stock != null ? String(producto.stock) : "0",
      colores: (producto.colores || []).map((c) => ({
        color_id: String(c.color_id),
        stock: c.stock != null ? String(c.stock) : "0",
      })),
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
    setFormError("");
    api(`/api/products/${producto.id}`, { method: "DELETE" })
      .then((res) => {
        if (!res.ok) return parseJsonError(res, "No se pudo eliminar");
        cargarProductos();
      })
      .catch((err) => setFormError(err.message));
  };

  const handleLogout = () => {
    api("/api/logout", { method: "POST" }).then(() => window.location.reload());
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl font-semibold text-stone-800">Administración</h1>
        <button
          onClick={handleLogout}
          className="text-sm font-semibold text-stone-500 hover:text-terracota-600"
        >
          Cerrar sesión
        </button>
      </div>

      <div className="flex gap-2 mb-8 border-b border-stone-200">
        <button
          type="button"
          onClick={() => setVista("catalogo")}
          className={
            "px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors " +
            (vista === "catalogo" ? "border-terracota-600 text-terracota-600" : "border-transparent text-stone-500 hover:text-stone-700")
          }
        >
          Catálogo
        </button>
        <button
          type="button"
          onClick={() => setVista("contenido")}
          className={
            "px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors " +
            (vista === "contenido" ? "border-terracota-600 text-terracota-600" : "border-transparent text-stone-500 hover:text-stone-700")
          }
        >
          Contenido del sitio
        </button>
        <button
          type="button"
          onClick={() => setVista("pedidos")}
          className={
            "px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors " +
            (vista === "pedidos" ? "border-terracota-600 text-terracota-600" : "border-transparent text-stone-500 hover:text-stone-700")
          }
        >
          Pedidos
        </button>
      </div>

      {vista === "contenido" ? (
        <ContentSettings />
      ) : vista === "pedidos" ? (
        <PedidosTab />
      ) : (
        <>
      <ProductForm
        values={formValues}
        onChange={setFormValues}
        onSubmit={handleSubmit}
        onCancel={editId ? cancelarEdicion : null}
        submitLabel={editId ? "Guardar cambios" : "Añadir producto"}
        error={formError}
        fabricantes={fabricantes}
        categorias={categorias}
        colores={colores}
        onCrearFabricante={crearFabricante}
        onCrearCategoria={crearCategoria}
        onCrearColor={crearColor}
      />

      <button
        type="button"
        onClick={() => setMostrarGestion((v) => !v)}
        className="mt-4 text-sm font-semibold text-musgo-600 hover:underline"
      >
        {mostrarGestion
          ? "Ocultar gestión de fabricantes/categorías/colores"
          : "Gestionar fabricantes, categorías y colores"}
      </button>

      {mostrarGestion && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
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
          <LookupManager
            title="Colores"
            items={colores}
            onRename={renombrarColor}
            onDelete={eliminarColor}
            extraCampo={COLOR_HEX_CAMPO}
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
                  <th className="py-2 pr-2">Existencias</th>
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
                    <td className="py-2 pr-2">
                      {(() => {
                        const unidad = STOCK_UNIT_LABEL[p.unidad_precio] || p.unidad_precio;
                        return p.colores && p.colores.length > 0
                          ? `${p.colores.reduce((total, c) => total + (c.stock || 0), 0)} ${unidad} (${p.colores.length} colores)`
                          : `${p.stock} ${unidad}`;
                      })()}
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
        </>
      )}
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
