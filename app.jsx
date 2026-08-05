const { useState, useEffect, useMemo } = React;

// Por defecto el catálogo se sirve desde catalog.csv (modo demo). Si
// config.js (gitignored, ver config.example.js) define API_BASE, el
// catálogo se carga en su lugar desde la API de Cloudflare Pages Functions
// (GET {API_BASE}/api/products), que es también la que usa admin.html para
// gestionar el catálogo en producción.
const CATALOG_URL = (window.APP_CONFIG && window.APP_CONFIG.CATALOG_URL) || "catalog.csv";
const API_BASE = window.APP_CONFIG && window.APP_CONFIG.API_BASE;
const USE_API = API_BASE != null;

// Texto del nombre de la tienda, del hero, de "Sobre nosotros" y del pie
// de página: los valores por defecto viven en default-content.js (demo,
// se envía con el repo); CONTENT en config.js (gitignored, ver
// config.example.js) sobrescribe cualquier subconjunto de esas claves.
const CONTENT = {
  ...(window.DEFAULT_CONTENT || {}),
  ...((window.APP_CONFIG && window.APP_CONFIG.CONTENT) || {}),
};
// document.title ya se fija en index.html (más rápido, antes de que carguen
// Tailwind/React/Babel); CONTENT.titulo no se vuelve a usar aquí.

const UNIDAD_LABEL = {
  "100g": "100 g",
  madeja: "madeja",
  unidad: "unidad",
};

function formatPrecio(producto) {
  const precio = Number(producto.precio).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const unidad = UNIDAD_LABEL[producto.unidad_precio] || producto.unidad_precio;
  return `$${precio} MXN / ${unidad}`;
}

function Header({ categorias, categoriaActiva, onSelectCategoria }) {
  const [menuAbierto, setMenuAbierto] = useState(false);

  const enlaces = [
    { href: "#inicio", texto: "Inicio" },
    { href: "#catalogo", texto: "Catálogo" },
    { href: "#nosotros", texto: "Nosotros" },
    { href: "#contacto", texto: "Contacto" },
  ];

  return (
    <header className="sticky top-0 z-30 bg-crema/95 backdrop-blur border-b border-stone-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <a href="#inicio" className="flex items-center gap-2">
          {CONTENT.logo ? (
            <img src={CONTENT.logo} alt={CONTENT.marca} className="h-9 sm:h-10 w-auto" />
          ) : (
            <React.Fragment>
              <span className="text-2xl">🧶</span>
              <span className="font-display text-xl font-semibold text-terracota-600">{CONTENT.marca}</span>
            </React.Fragment>
          )}
        </a>

        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-stone-600">
          {enlaces.map((e) => (
            <a key={e.href} href={e.href} className="hover:text-terracota-600 transition-colors">
              {e.texto}
            </a>
          ))}
        </nav>

        <button
          className="md:hidden text-stone-600 text-2xl leading-none"
          aria-label="Abrir menú"
          onClick={() => setMenuAbierto((v) => !v)}
        >
          {menuAbierto ? "✕" : "☰"}
        </button>
      </div>

      {menuAbierto && (
        <nav className="md:hidden flex flex-col gap-1 px-4 pb-4 text-sm font-semibold text-stone-600">
          {enlaces.map((e) => (
            <a
              key={e.href}
              href={e.href}
              onClick={() => setMenuAbierto(false)}
              className="py-2 border-b border-stone-100 last:border-0"
            >
              {e.texto}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section id="inicio" className="relative overflow-hidden bg-gradient-to-b from-terracota-50 to-crema">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 flex flex-col items-center text-center gap-6">
        <span className="uppercase tracking-widest text-xs font-bold text-terracota-600 bg-terracota-100 px-3 py-1 rounded-full">
          Acrílicos · Hilos · Accesorios
        </span>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-stone-800 max-w-2xl">
          Todo lo que necesitas para tejer con calma
        </h1>
        <p className="text-stone-600 max-w-xl text-lg">{CONTENT.hero}</p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <a
            href="#catalogo"
            className="bg-terracota-600 hover:bg-terracota-700 text-white font-semibold px-6 py-3 rounded-full transition-colors"
          >
            Ver catálogo
          </a>
          <a
            href="#nosotros"
            className="bg-white hover:bg-stone-50 text-stone-700 font-semibold px-6 py-3 rounded-full border border-stone-200 transition-colors"
          >
            Conócenos
          </a>
        </div>
      </div>
    </section>
  );
}

function CategoryFilter({ categorias, categoriaActiva, onSelectCategoria }) {
  return (
    <div className="mb-10">
      <p className="text-center text-xs font-semibold uppercase tracking-wide text-stone-400 mb-3">
        Filtrar por categoría
      </p>
      <div
        role="group"
        aria-label="Filtrar por categoría"
        className="flex flex-wrap gap-2 justify-center"
      >
        {categorias.map((cat) => {
          const activa = cat === categoriaActiva;
          return (
            <button
              key={cat}
              onClick={() => onSelectCategoria(cat)}
              className={
                "px-4 py-2 rounded-full text-sm font-semibold border transition-colors " +
                (activa
                  ? "bg-terracota-600 border-terracota-600 text-white"
                  : "bg-white border-stone-200 text-stone-600 hover:border-terracota-300")
              }
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProductCard({ producto }) {
  return (
    <article className="bg-white rounded-2xl border border-stone-200 overflow-hidden flex flex-col hover:shadow-lg hover:-translate-y-0.5 transition-all">
      <div className="aspect-square bg-stone-50">
        <img
          src={producto.imagen}
          alt={producto.nombre}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="p-4 flex flex-col gap-1 flex-1">
        <span className="text-xs font-bold uppercase tracking-wide text-musgo-600">
          {producto.categoria}
        </span>
        <h3 className="font-display font-semibold text-stone-800 leading-snug">
          {producto.nombre}
        </h3>
        <p className="text-sm text-stone-500">por {producto.fabricante}</p>
        {producto.descripcion && (
          <p className="text-sm text-stone-500 mt-1 flex-1">{producto.descripcion}</p>
        )}
        <p className="mt-3 font-display text-lg font-semibold text-terracota-600">
          {formatPrecio(producto)}
        </p>
      </div>
    </article>
  );
}

function SearchBar({ valor, onChange }) {
  return (
    <div className="flex justify-center mb-6">
      <input
        type="search"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar por nombre…"
        aria-label="Buscar productos por nombre"
        className="w-full max-w-sm border border-stone-200 rounded-full px-4 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-terracota-300"
      />
    </div>
  );
}

function Catalogo() {
  const [productos, setProductos] = useState([]);
  const [estado, setEstado] = useState("cargando"); // cargando | listo | error
  const [categoriaActiva, setCategoriaActiva] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    if (USE_API) {
      fetch(`${API_BASE}/api/products`)
        .then((res) => {
          if (!res.ok) throw new Error("No se pudo cargar el catálogo");
          return res.json();
        })
        .then((data) => {
          setProductos(data);
          setEstado("listo");
        })
        .catch(() => setEstado("error"));
      return;
    }

    fetch(CATALOG_URL)
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo cargar el catálogo");
        return res.text();
      })
      .then((csvTexto) => {
        const resultado = Papa.parse(csvTexto, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false,
        });
        setProductos(resultado.data);
        setEstado("listo");
      })
      .catch(() => setEstado("error"));
  }, []);

  const categorias = useMemo(() => {
    const unicas = Array.from(new Set(productos.map((p) => p.categoria)));
    return ["Todos", ...unicas];
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    let resultado =
      categoriaActiva === "Todos" ? productos : productos.filter((p) => p.categoria === categoriaActiva);
    const termino = busqueda.trim().toLowerCase();
    if (termino) {
      resultado = resultado.filter((p) => (p.nombre || "").toLowerCase().includes(termino));
    }
    return resultado;
  }, [productos, categoriaActiva, busqueda]);

  return (
    <section id="catalogo" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 scroll-mt-16">
      <div className="text-center mb-10">
        <h2 className="font-display text-3xl font-semibold text-stone-800">Nuestro catálogo</h2>
        <p className="text-stone-500 mt-2">
          Las madejas se venden por unidad o por cada 100&nbsp;g, según la
          referencia. El catálogo se irá ampliando con nuevos acrílicos y
          accesorios.
        </p>
      </div>

      {estado === "cargando" && (
        <p className="text-center text-stone-500">Cargando productos…</p>
      )}

      {estado === "error" && (
        <p className="text-center text-terracota-600">
          No hemos podido cargar el catálogo. Si has abierto este archivo
          directamente con el navegador, prueba a servirlo con un servidor
          local (mira el README del proyecto).
        </p>
      )}

      {estado === "listo" && (
        <React.Fragment>
          <SearchBar valor={busqueda} onChange={setBusqueda} />
          <CategoryFilter
            categorias={categorias}
            categoriaActiva={categoriaActiva}
            onSelectCategoria={setCategoriaActiva}
          />
          {productosFiltrados.length === 0 ? (
            <p className="text-center text-stone-500">
              No se encontraron productos que coincidan con tu búsqueda.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {productosFiltrados.map((producto) => (
                <ProductCard key={producto.id} producto={producto} />
              ))}
            </div>
          )}
        </React.Fragment>
      )}
    </section>
  );
}

function Nosotros() {
  return (
    <section id="nosotros" className="bg-musgo-50 scroll-mt-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h2 className="font-display text-3xl font-semibold text-stone-800 mb-4">Sobre nosotros</h2>
        <p className="text-stone-600 leading-relaxed">{CONTENT.nosotros}</p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer id="contacto" className="bg-stone-800 text-stone-300 scroll-mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div>
          <p className="font-display text-lg text-white font-semibold mb-2">🧶 {CONTENT.marca}</p>
          <p className="text-sm text-stone-400">{CONTENT.footerTagline}</p>
        </div>
        <div>
          <p className="font-semibold text-white mb-2">Visítanos</p>
          <p className="text-sm text-stone-400">{CONTENT.footerDireccion}</p>
          <p className="text-sm text-stone-400">{CONTENT.footerHorario}</p>
        </div>
        <div>
          <p className="font-semibold text-white mb-2">Contacto</p>
          <p className="text-sm text-stone-400">{CONTENT.footerEmail}</p>
          <p className="text-sm text-stone-400">{CONTENT.footerTelefono}</p>
        </div>
      </div>
      <div className="border-t border-stone-700 py-4 text-center text-xs text-stone-500">
        © {new Date().getFullYear()} {CONTENT.marca}. {CONTENT.footerDerechos}
      </div>
    </footer>
  );
}

function App() {
  return (
    <React.Fragment>
      <Header />
      <Hero />
      <Catalogo />
      <Nosotros />
      <Footer />
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
