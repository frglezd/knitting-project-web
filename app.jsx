const { useState, useEffect, useMemo } = React;

// Por defecto el catálogo se sirve desde catalog.csv (modo demo). Si
// config.js (gitignored, ver config.example.js) define API_BASE, el
// catálogo se carga en su lugar desde la API de Cloudflare Pages Functions
// (GET {API_BASE}/api/products), que es también la que usa admin.html para
// gestionar el catálogo en producción.
const CATALOG_URL = (window.APP_CONFIG && window.APP_CONFIG.CATALOG_URL) || "catalog.csv";
const API_BASE = window.APP_CONFIG && window.APP_CONFIG.API_BASE;
const USE_API = API_BASE != null;

const UNIDAD_LABEL = {
  "100g": "100 g",
  ovillo: "ovillo",
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
          <span className="text-2xl">🧶</span>
          <span className="font-display text-xl font-semibold text-terracota-600">Punto y Lana</span>
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
          Lanas · Hilos · Accesorios
        </span>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-stone-800 max-w-2xl">
          Todo lo que necesitas para tejer con calma
        </h1>
        <p className="text-stone-600 max-w-xl text-lg">
          Seleccionamos lanas naturales, fibras recicladas y accesorios de
          calidad para que cada punto y cada vuelta de ganchillo sean un
          placer, ya sea tu primer proyecto o el número cien.
        </p>
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
    <div className="flex flex-wrap gap-2 justify-center mb-10">
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

function Catalogo() {
  const [productos, setProductos] = useState([]);
  const [estado, setEstado] = useState("cargando"); // cargando | listo | error
  const [categoriaActiva, setCategoriaActiva] = useState("Todos");

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
    if (categoriaActiva === "Todos") return productos;
    return productos.filter((p) => p.categoria === categoriaActiva);
  }, [productos, categoriaActiva]);

  return (
    <section id="catalogo" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 scroll-mt-16">
      <div className="text-center mb-10">
        <h2 className="font-display text-3xl font-semibold text-stone-800">Nuestro catálogo</h2>
        <p className="text-stone-500 mt-2">
          Los ovillos se venden por unidad o por cada 100&nbsp;g, según la
          referencia. El catálogo se irá ampliando con nuevas lanas y
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
          <CategoryFilter
            categorias={categorias}
            categoriaActiva={categoriaActiva}
            onSelectCategoria={setCategoriaActiva}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {productosFiltrados.map((producto) => (
              <ProductCard key={producto.id} producto={producto} />
            ))}
          </div>
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
        <p className="text-stone-600 leading-relaxed">
          Punto y Lana nació como una pequeña mercería de barrio y hoy
          combinamos la tienda física con la venta online, sin perder el
          trato cercano. Trabajamos con fabricantes que cuidan el origen de
          sus fibras —desde merinos europeos hasta algodones y fibras
          recicladas— y seleccionamos a mano cada agujero, ganchillo y
          accesorio que llega a nuestras estanterías. Nuestro objetivo es
          que encuentres justo lo que tu proyecto necesita, con
          asesoramiento honesto y sin prisas.
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer id="contacto" className="bg-stone-800 text-stone-300 scroll-mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div>
          <p className="font-display text-lg text-white font-semibold mb-2">🧶 Punto y Lana</p>
          <p className="text-sm text-stone-400">
            Lanas, hilos y accesorios para tejer con cariño, en tienda y online.
          </p>
        </div>
        <div>
          <p className="font-semibold text-white mb-2">Visítanos</p>
          <p className="text-sm text-stone-400">Calle Mayor 12, 28013 Madrid</p>
          <p className="text-sm text-stone-400">Lunes a sábado, 10:00–20:00</p>
        </div>
        <div>
          <p className="font-semibold text-white mb-2">Contacto</p>
          <p className="text-sm text-stone-400">hola@puntoylana.es</p>
          <p className="text-sm text-stone-400">+34 900 000 000</p>
        </div>
      </div>
      <div className="border-t border-stone-700 py-4 text-center text-xs text-stone-500">
        © {new Date().getFullYear()} Punto y Lana. Todos los derechos reservados.
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
