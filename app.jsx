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

function SocialIcons({ tamano }) {
  const clase = tamano === "sm" ? "w-4 h-4" : "w-5 h-5";
  return (
    <div className="flex items-center gap-3">
      <a
        href={CONTENT.redesFacebook}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Facebook"
        className="hover:text-taupe transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className={clase}>
          <path d="M22 12a10 10 0 1 0-11.5 9.9v-7H7.9V12h2.6V9.8c0-2.6 1.5-4 3.9-4 1.1 0 2.3.2 2.3.2v2.5h-1.3c-1.3 0-1.7.8-1.7 1.6V12h2.9l-.5 2.9h-2.4v7A10 10 0 0 0 22 12Z" />
        </svg>
      </a>
      <a
        href={CONTENT.redesInstagram}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Instagram"
        className="hover:text-taupe transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={clase}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4.2" />
          <circle cx="17.2" cy="6.8" r="1" />
        </svg>
      </a>
    </div>
  );
}

function TopBar() {
  return (
    <div className="hidden sm:block bg-cafe text-crema">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between text-xs font-ui">
        <a
          href={`tel:${(CONTENT.footerTelefono || "").replace(/\s+/g, "")}`}
          className="hover:text-arena transition-colors"
        >
          {CONTENT.footerTelefono}
        </a>
        <div className="flex items-center gap-5">
          <a href="#catalogo" className="hover:text-arena transition-colors">
            🔍 Buscar
          </a>
          <SocialIcons tamano="sm" />
        </div>
      </div>
    </div>
  );
}

// La imagen del logo (assets/images/logo.png) tiene el texto en trazo negro,
// pensada para fondos claros; en fondos oscuros (footer) usamos el respaldo
// de emoji + texto en vez de la imagen para no perder legibilidad.
function BrandMark({ dark, imgClassName, textClassName }) {
  if (CONTENT.logo && !dark) {
    return <img src={CONTENT.logo} alt={CONTENT.marca} className={imgClassName || "h-9 sm:h-10 w-auto"} />;
  }
  return (
    <React.Fragment>
      <span className="text-2xl">🧶</span>
      <span className={"font-brand text-xl " + (textClassName || (dark ? "text-crema" : "text-cafe"))}>
        {CONTENT.marca}
      </span>
    </React.Fragment>
  );
}

const NAV_ENLACES = [
  { href: "#inicio", texto: "Inicio" },
  { href: "#catalogo", texto: "Tienda" },
  { href: "#nosotros", texto: "Sobre Nosotros" },
  { href: "#blog", texto: "Blog" },
  { href: "#contacto", texto: "Contacto" },
];

// El header tiene dos formas: al aterrizar en la página se ve como el
// mockup (logo grande centrado + fila de navegación separada, sin fijar
// arriba, para que la sección de inicio se vea completa como en el diseño).
// En cuanto el usuario se desplaza más allá de la sección de inicio, pasa a
// la barra compacta y fija de siempre (el comportamiento que ya había).
function Header() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("inicio");
    if (!hero) return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), {
      rootMargin: "-64px 0px 0px 0px",
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  const telefonoHref = `tel:${(CONTENT.footerTelefono || "").replace(/\s+/g, "")}`;

  if (!scrolled) {
    return (
      <header className="bg-crema border-b border-arena">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between md:justify-center md:gap-8 border-b border-arena/60">
          <a href="#inicio" className="flex items-center gap-2">
            <BrandMark imgClassName="h-12 sm:h-14 w-auto" />
          </a>
          <a
            href={telefonoHref}
            className="hidden md:flex items-center gap-2 font-ui text-cafe hover:text-taupe transition-colors"
          >
            <span>📞</span> {CONTENT.footerTelefono}
          </a>
          <button
            className="md:hidden text-cafe text-2xl leading-none"
            aria-label="Abrir menú"
            onClick={() => setMenuAbierto((v) => !v)}
          >
            {menuAbierto ? "✕" : "☰"}
          </button>
        </div>

        <nav className="hidden md:flex items-center justify-center gap-7 py-3 text-base font-editorial font-normal tracking-wide text-cafe">
          {NAV_ENLACES.map((e) => (
            <a key={e.href} href={e.href} className="hover:text-taupe transition-colors">
              {e.texto}
            </a>
          ))}
        </nav>

        {menuAbierto && (
          <nav className="md:hidden flex flex-col gap-1 px-4 pb-4 text-base font-editorial font-normal tracking-wide text-cafe">
            {NAV_ENLACES.map((e) => (
              <a
                key={e.href}
                href={e.href}
                onClick={() => setMenuAbierto(false)}
                className="py-2 border-b border-arena last:border-0"
              >
                {e.texto}
              </a>
            ))}
          </nav>
        )}
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 bg-crema/95 backdrop-blur border-b border-arena">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <a href="#inicio" className="flex items-center gap-2 shrink-0">
          <BrandMark />
        </a>

        <nav className="hidden md:flex items-center gap-7 text-base font-editorial font-normal tracking-wide text-cafe">
          {NAV_ENLACES.map((e) => (
            <a key={e.href} href={e.href} className="hover:text-taupe transition-colors">
              {e.texto}
            </a>
          ))}
        </nav>

        <a
          href={telefonoHref}
          className="hidden lg:block font-ui text-sm text-cafe hover:text-taupe transition-colors"
        >
          {CONTENT.footerTelefono}
        </a>

        <button
          className="md:hidden text-cafe text-2xl leading-none"
          aria-label="Abrir menú"
          onClick={() => setMenuAbierto((v) => !v)}
        >
          {menuAbierto ? "✕" : "☰"}
        </button>
      </div>

      {menuAbierto && (
        <nav className="md:hidden flex flex-col gap-1 px-4 pb-4 text-base font-editorial font-normal tracking-wide text-cafe">
          {NAV_ENLACES.map((e) => (
            <a
              key={e.href}
              href={e.href}
              onClick={() => setMenuAbierto(false)}
              className="py-2 border-b border-arena last:border-0"
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
    <section id="inicio" className="relative overflow-hidden bg-gradient-to-b from-arena/60 to-crema">
      <img
        src="assets/images/floral-flourish.svg"
        alt=""
        aria-hidden="true"
        className="hidden sm:block absolute top-0 left-0 w-40 h-40 opacity-70 pointer-events-none select-none"
      />
      <img
        src="assets/images/floral-flourish.svg"
        alt=""
        aria-hidden="true"
        className="hidden sm:block absolute top-0 right-0 w-40 h-40 opacity-70 pointer-events-none select-none -scale-x-100"
      />
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <div className="flex flex-col items-start text-left gap-5">
          <h1 className="text-cafe leading-tight">
            <span className="block font-editorial text-2xl sm:text-3xl font-medium">{CONTENT.heroTitulo}</span>
            <span className="block font-brand text-4xl sm:text-5xl mt-1">{CONTENT.marca}</span>
          </h1>
          <p className="font-editorial italic text-xl text-taupe">{CONTENT.heroSubtitulo}</p>
          <p className="text-cafe/80 font-ui text-lg">{CONTENT.hero}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href="#catalogo"
              className="btn-madera text-crema font-editorial font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Explorar tienda
            </a>
            <a
              href="#nosotros"
              className="btn-madera-claro text-cafe font-editorial font-semibold px-6 py-3 rounded-lg border border-arena/60 transition-colors"
            >
              Conócenos
            </a>
          </div>
        </div>
        <img
          src="assets/images/cesta-ovillos-ganchillos.jpg"
          alt="Canasta con ovillos de estambre y ganchillos"
          className="w-full max-w-md mx-auto rounded-2xl object-cover"
        />
      </div>
    </section>
  );
}

// Los 3 tiles reflejan literalmente las categorías del mockup, no una lista
// derivada del catálogo: "Kits para Crochet" y "Accesorios" no existen todavía
// como categorías reales (el catálogo actual solo tiene tipos de hilo), así
// que esos dos filtran a una vista vacía hasta que se den de alta productos
// de esas categorías desde el panel de administración — es intencional.
const CATEGORY_TILES = [
  { categoria: "Estambre", etiqueta: "Estambres", boton: "Ver Estambres", imagen: "assets/images/cesta-ovillos-estanteria.jpg" },
  {
    categoria: "Kits para Crochet",
    etiqueta: "Kits para Crochet",
    boton: "Ver Kits",
    imagen: "assets/images/crochet-hook.svg",
  },
  {
    categoria: "Accesorios",
    etiqueta: "Revistas y Accesorios",
    boton: "Ver Accesorios",
    imagen: "assets/images/libros-crochet-mostrador.jpg",
  },
];

function CategoryTiles({ categoriaActiva, onSelectCategoria }) {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {CATEGORY_TILES.map((tile) => {
          const activa = categoriaActiva === tile.categoria;
          return (
            <a
              key={tile.categoria}
              href="#catalogo"
              onClick={() => onSelectCategoria(tile.categoria)}
              className={
                "group bg-white rounded-2xl border overflow-hidden flex flex-col text-center hover:shadow-lg hover:-translate-y-0.5 transition-all " +
                (activa ? "border-taupe ring-2 ring-taupe/40" : "border-arena")
              }
            >
              <div className="aspect-[4/3] bg-crema">
                <img src={tile.imagen} alt={tile.etiqueta} className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="p-5 flex flex-col items-center gap-3">
                <h3 className="font-editorial text-lg font-semibold text-cafe">{tile.etiqueta}</h3>
                <span className="btn-madera inline-block text-crema font-editorial text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                  {tile.boton}
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function CategoryFilter({ categorias, categoriaActiva, onSelectCategoria }) {
  return (
    <div className="mb-10">
      <p className="text-center text-xs font-ui font-semibold uppercase tracking-wide text-cafe/50 mb-3">
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
                "px-4 py-2 rounded-full text-sm font-ui font-semibold border transition-colors " +
                (activa
                  ? "btn-madera border-taupe text-crema"
                  : "btn-madera-claro border-arena text-cafe hover:border-taupe")
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
    <article className="bg-white rounded-2xl border border-arena overflow-hidden flex flex-col hover:shadow-lg hover:-translate-y-0.5 transition-all">
      <div className="aspect-square bg-crema">
        <img
          src={producto.imagen}
          alt={producto.nombre}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="p-4 flex flex-col gap-1 flex-1">
        <span className="text-xs font-ui font-bold uppercase tracking-wide text-salvia">
          {producto.categoria}
        </span>
        <h3 className="font-editorial font-semibold text-cafe leading-snug">
          {producto.nombre}
        </h3>
        <p className="text-sm font-ui text-cafe/60">por {producto.fabricante}</p>
        {producto.descripcion && (
          <p className="text-sm font-ui text-cafe/60 mt-1 flex-1">{producto.descripcion}</p>
        )}
        <p className="mt-3 font-editorial text-lg font-semibold text-cafe">
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
        className="w-full max-w-sm border border-arena rounded-full px-4 py-2 text-sm font-ui text-cafe focus:outline-none focus:ring-2 focus:ring-taupe"
      />
    </div>
  );
}

function Catalogo({ categoriaActiva, onSelectCategoria }) {
  const [productos, setProductos] = useState([]);
  const [estado, setEstado] = useState("cargando"); // cargando | listo | error
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
        <h2 className="font-editorial text-3xl font-semibold text-cafe">Nuestro catálogo</h2>
        <p className="text-cafe/60 font-ui mt-2">
          Las madejas se venden por unidad o por cada 100&nbsp;g, según la
          referencia. El catálogo se irá ampliando con nuevos acrílicos y
          accesorios.
        </p>
      </div>

      {estado === "cargando" && (
        <p className="text-center text-cafe/60 font-ui">Cargando productos…</p>
      )}

      {estado === "error" && (
        <p className="text-center text-cafe font-ui bg-rosa/20 border border-rosa/50 rounded-lg px-4 py-3 max-w-lg mx-auto">
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
            onSelectCategoria={onSelectCategoria}
          />
          {productosFiltrados.length === 0 ? (
            <p className="text-center text-cafe/60 font-ui">
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

function iniciales(nombre) {
  return (nombre || "")
    .split(" ")
    .map((parte) => parte[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// El mockup comparte una sola foto alta entre el bloque de marca y los
// testimonios (columna izquierda apilada, foto a la derecha ocupando ambas
// filas) en vez de tratarlos como dos secciones independientes.
function NosotrosYTestimonios() {
  const testimonios = CONTENT.testimonios || [];
  const coloresAvatar = ["bg-rosa", "bg-salvia", "bg-taupe"];

  return (
    <section id="nosotros" className="relative overflow-hidden bg-arena/40 scroll-mt-16">
      <img
        src="assets/images/floral-flourish.svg"
        alt=""
        aria-hidden="true"
        className="hidden sm:block absolute top-0 left-0 w-32 h-32 opacity-60 pointer-events-none select-none"
      />
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="flex flex-col gap-12">
          <div className="text-center md:text-left">
            <h2 className="font-brand text-4xl text-cafe mb-4">{CONTENT.marca}</h2>
            <p className="text-cafe/80 font-editorial leading-relaxed mb-6">{CONTENT.nosotros}</p>
            <a
              href="#contacto"
              className="btn-madera inline-block text-crema font-editorial font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Conocer más
            </a>
          </div>

          {testimonios.length > 0 && (
            <div>
              <h3 className="font-editorial text-2xl font-semibold text-cafe mb-6 text-center md:text-left">
                Lo que dicen nuestras clientas
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {testimonios.map((t, i) => (
                  <div key={t.nombre} className="bg-white rounded-2xl border border-arena p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={
                          "w-10 h-10 rounded-full flex items-center justify-center text-crema font-ui font-bold text-sm shrink-0 " +
                          coloresAvatar[i % coloresAvatar.length]
                        }
                      >
                        {iniciales(t.nombre)}
                      </span>
                      <p className="font-editorial font-semibold text-cafe">{t.nombre}</p>
                    </div>
                    <p className="text-cafe/70 font-editorial text-sm leading-relaxed">“{t.texto}”</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <img
            src="assets/images/tienda-entrada-pizarra.jpg"
            alt={`Entrada de la tienda ${CONTENT.marca}, con letrero de bienvenida`}
            className="w-full aspect-[910/435] rounded-2xl object-cover"
          />
          <div className="text-center md:text-left">
            <h3 className="font-brand text-3xl text-cafe mb-1">Síguenos en Instagram</h3>
            <p className="font-brand text-lg text-cafe/70 mb-4">{CONTENT.instagramHandle}</p>
            <a
              href={CONTENT.redesInstagram}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-madera inline-block text-crema font-editorial font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Ver más
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function BlogComingSoon() {
  return (
    <section id="blog" className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center scroll-mt-16">
      <h2 className="font-editorial text-3xl font-semibold text-cafe mb-4">Blog</h2>
      <div className="bg-white border border-arena rounded-2xl px-6 py-10">
        <p className="font-ui text-cafe/70">{CONTENT.blogProximamente}</p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer id="contacto" className="bg-cafe text-arena scroll-mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BrandMark dark />
          </div>
          <p className="text-sm font-ui text-arena/80 mb-4">{CONTENT.footerTagline}</p>
          <SocialIcons tamano="sm" />
        </div>
        <div>
          <p className="font-ui font-semibold text-crema mb-2">Visítanos</p>
          <p className="text-sm font-ui text-arena/80 whitespace-pre-line">{CONTENT.footerDireccion}</p>
          <p className="text-sm font-ui text-arena/80">{CONTENT.footerHorario}</p>
        </div>
        <div>
          <p className="font-ui font-semibold text-crema mb-2">Contacto</p>
          <p className="text-sm font-ui text-arena/80">{CONTENT.footerEmail}</p>
          <p className="text-sm font-ui text-arena/80">{CONTENT.footerTelefono}</p>
        </div>
      </div>
      <div className="border-t border-arena/30 py-4 text-center text-xs font-ui text-arena/70">
        © {new Date().getFullYear()} {CONTENT.marca}. {CONTENT.footerDerechos}
      </div>
    </footer>
  );
}

function App() {
  const [categoriaActiva, setCategoriaActiva] = useState("Todos");

  return (
    <React.Fragment>
      <TopBar />
      <Header />
      <Hero />
      <CategoryTiles categoriaActiva={categoriaActiva} onSelectCategoria={setCategoriaActiva} />
      <NosotrosYTestimonios />
      <Catalogo categoriaActiva={categoriaActiva} onSelectCategoria={setCategoriaActiva} />
      <BlogComingSoon />
      <Footer />
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
