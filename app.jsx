const { useState, useEffect, useMemo, useContext, createContext } = React;

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
// `let`, no `const`: cuando USE_API está activo, App() sustituye este objeto
// por el contenido guardado en D1 (ver el efecto en App()) y fuerza un
// re-render. El resto de componentes lee CONTENT.xxx como variable libre en
// cada render, así que reciben el valor nuevo sin necesidad de props/Context.
let CONTENT = {
  ...(window.DEFAULT_CONTENT || {}),
  ...((window.APP_CONFIG && window.APP_CONFIG.CONTENT) || {}),
};

const UNIDAD_LABEL = {
  gramos: "100 g",
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

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Mirrors functions/api/checkout/create.js's subtotal formula exactly (same
// gramos-are-priced-per-100g math) — kept as a tiny pure function so the
// cart context, the drawer's per-line subtotal, and CheckoutModal's summary
// can't silently drift from each other or from the server.
function computeSubtotal(precioUnitario, unidadPrecio, cantidad) {
  return round2(precioUnitario * (unidadPrecio === "gramos" ? cantidad / 100 : cantidad));
}

// Same step/clamp math BuySection already used for its own quantity
// stepper (100/gramos, 1/otherwise) — factored out so the cart drawer's
// stepper and the merge-on-add logic can reuse it without duplicating the
// branch.
function stepFor(unidadPrecio) {
  return unidadPrecio === "gramos" ? 100 : 1;
}
function clampStock(unidadPrecio, stock) {
  const step = stepFor(unidadPrecio);
  const safeStock = stock || 0;
  return unidadPrecio === "gramos" ? Math.floor(safeStock / step) * step : safeStock;
}

// ---------------------------------------------------------------------
// Cart: React Context + localStorage persistence (key `pyl_cart_v1`).
// Only ever touched when USE_API — demo/CSV mode never reads or writes
// localStorage and never renders cart UI (CartIcon/CartDrawer are both
// gated on USE_API where they're rendered).
// ---------------------------------------------------------------------
const CART_STORAGE_KEY = "pyl_cart_v1";

const CartContext = createContext(null);

function hydrateCart() {
  if (!USE_API) return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function lineKey(productId, productColorId) {
  return `${productId}:${productColorId ?? "none"}`;
}

function CartProvider({ children }) {
  const [lines, setLines] = useState(hydrateCart);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!USE_API) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Private browsing / quota exceeded — cart just won't persist across
      // reloads, not worth surfacing to the customer.
    }
  }, [lines]);

  // Merges on (product_id, product_color_id): adding the same product+color
  // twice sums cantidad into the existing line instead of pushing a
  // duplicate. No stock ceiling is persisted into the line itself — stock
  // is volatile and is only ever re-checked live (CartDrawer, on open).
  // The clamp applied here at add-time is a best-effort UX nicety using
  // whatever stock figure the catalog fetch already gave us.
  const addItem = (producto, colorSeleccionado, cantidad) => {
    setLines((prev) => {
      const key = lineKey(producto.id, colorSeleccionado ? colorSeleccionado.product_color_id : null);
      const idx = prev.findIndex((l) => l.key === key);
      if (idx === -1) {
        return [
          ...prev,
          {
            key,
            product_id: producto.id,
            product_color_id: colorSeleccionado ? colorSeleccionado.product_color_id : null,
            nombre: producto.nombre,
            color_nombre: colorSeleccionado ? colorSeleccionado.nombre : null,
            color_hex: colorSeleccionado ? colorSeleccionado.hex : null,
            imagen: producto.imagen,
            unidad_precio: producto.unidad_precio,
            precio_unitario: Number(producto.precio),
            cantidad,
          },
        ];
      }
      const maxStock = colorSeleccionado
        ? colorSeleccionado.stock
        : producto.stock != null
        ? producto.stock
        : Infinity;
      const maxClamped = clampStock(producto.unidad_precio, maxStock);
      const next = prev.slice();
      next[idx] = { ...next[idx], cantidad: Math.min(maxClamped, next[idx].cantidad + cantidad) };
      return next;
    });
    setIsOpen(true);
  };

  const updateQuantity = (key, cantidad) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, cantidad } : l)));
  };

  const removeItem = (key) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const clear = () => setLines([]);

  // Derived, never stored separately (avoids drift): subtotal sums every
  // line's own subtotal; count is the *distinct line* count (not summed
  // cantidad — a badge reading "300" from 300g of yarn would be misleading).
  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + computeSubtotal(l.precio_unitario, l.unidad_precio, l.cantidad), 0),
    [lines]
  );
  const count = lines.length;

  const value = { lines, addItem, updateQuantity, removeItem, clear, subtotal, count, isOpen, setIsOpen };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// Small inline SVG (bag), matching SocialIcons' stroke-based style rather
// than an emoji. Badge shows the distinct line count.
function CartIcon() {
  const cart = useContext(CartContext);
  if (!cart) return null;
  return (
    <button
      type="button"
      onClick={() => cart.setIsOpen(true)}
      aria-label="Ver carrito"
      className="relative hover:text-taupe transition-colors"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path
          d="M6 7h15l-1.5 10a2 2 0 0 1-2 1.7H9.3a2 2 0 0 1-2-1.7L5 3H2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9.5" cy="21" r="1" />
        <circle cx="18" cy="21" r="1" />
      </svg>
      {cart.count > 0 && (
        <span className="absolute -top-2 -right-2 min-w-[1rem] h-4 px-1 rounded-full bg-cafe text-crema text-[10px] font-ui font-bold flex items-center justify-center">
          {cart.count}
        </span>
      )}
    </button>
  );
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
          {USE_API && <CartIcon />}
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
          {USE_API && <CartIcon />}
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

        {USE_API && <CartIcon />}

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
          <p className="text-sm text-taupe">Compra en línea, recoge en tienda — sin envíos.</p>
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
          src={CONTENT.imagenes?.hero || "assets/images/cesta-ovillos-ganchillos.jpg"}
          alt="Canasta con ovillos de estambre y ganchillos"
          className="w-full max-w-md mx-auto rounded-2xl object-cover"
        />
      </div>
    </section>
  );
}

// Los 3 tiles reflejan literalmente las categorías del mockup, no una lista
// derivada del catálogo. "Accesorios" no existe todavía como categoría real,
// así que ese tile filtra a una vista vacía hasta que se den de alta
// productos de esa categoría desde el panel de administración — es
// intencional. "Kits para Crochet" tampoco es una categoría real por sí
// sola: agrupa varias categorías reales de herramientas/accesorios de
// crochet y tejido (a diferencia de "Estambre", que sí es una categoría
// real única).
const KITS_CROCHET_CATEGORIAS = ["Suela", "Gancho", "Aguja", "Aros", "Telar", "Fundas"];

const CATEGORY_TILES = [
  {
    categoria: "Estambre",
    etiqueta: "Estambres",
    boton: "Ver Estambres",
    imagenKey: "tileEstambre",
    imagen: "assets/images/cesta-ovillos-estanteria.jpg",
  },
  {
    categoria: "Kits para Crochet",
    etiqueta: "Kits para Crochet",
    boton: "Ver Kits",
    imagenKey: "tileKits",
    imagen: "assets/images/cesta-ovillos-agujas.jpg",
  },
  {
    categoria: "Accesorios",
    etiqueta: "Revistas y Accesorios",
    boton: "Ver Accesorios",
    imagenKey: "tileAccesorios",
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
              <div className="aspect-video bg-crema">
                <img
                  src={CONTENT.imagenes?.[tile.imagenKey] || tile.imagen}
                  alt={tile.etiqueta}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
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

// Activado 2026-09-25 por decisión explícita del dueño de la tienda, aun
// con la mayoría del catálogo todavía en stock=0 (16/89 productos con
// existencias reales al momento del cambio) — la mayoría del catálogo se
// mostrará "Agotado" hasta que se capturen más cantidades en /admin.
const SHOW_AGOTADO_BADGE = true;

// Sólo tiene sentido en modo API (USE_API): el catálogo demo/CSV no trae
// `stock`/`colores`, así que el llamador nunca debe invocar esto en ese modo.
function estaAgotado(producto) {
  if (producto.colores && producto.colores.length > 0) {
    return producto.colores.every((c) => (c.stock || 0) <= 0);
  }
  return (producto.stock || 0) <= 0;
}

function ColorSwatches({ colores, seleccionado, onSeleccionar }) {
  const [hover, setHover] = useState(null);

  // El texto sigue al color en hover; si no hay hover, cae al seleccionado.
  const mostrado = colores.find((c) => c.color_id === (hover ?? seleccionado));

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-2">
        {colores.map((c) => {
          const agotado = (c.stock || 0) <= 0;
          const activo = seleccionado === c.color_id;
          return (
            <span
              key={c.color_id}
              onMouseEnter={() => setHover(c.color_id)}
              onMouseLeave={() => setHover(null)}
            >
              <button
                type="button"
                aria-label={c.nombre + (agotado ? " (agotado)" : "")}
                disabled={agotado}
                onFocus={() => setHover(c.color_id)}
                onBlur={() => setHover(null)}
                onClick={() => onSeleccionar && onSeleccionar(c.color_id)}
                className={
                  "relative w-6 h-6 rounded-full border transition-shadow " +
                  (agotado
                    ? "opacity-40 cursor-not-allowed border-arena"
                    : activo
                    ? "border-cafe ring-2 ring-offset-1 ring-taupe cursor-pointer"
                    : "border-arena hover:ring-2 hover:ring-taupe/50 cursor-pointer")
                }
                style={{ backgroundColor: c.hex || "#cccccc" }}
              >
                {agotado && (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] text-cafe/80">
                    ✕
                  </span>
                )}
              </button>
            </span>
          );
        })}
      </div>
      <span className="text-sm font-ui text-cafe/60 min-h-[1.25rem]">
        {mostrado ? mostrado.nombre + ((mostrado.stock || 0) <= 0 ? " (agotado)" : "") : ""}
      </span>
    </div>
  );
}

// Simple fixed-position overlay modal, matching the site's existing
// visual language (rounded-2xl, border-arena, font-editorial/font-ui,
// btn-madera) — no prior modal pattern existed in this codebase to reuse.
// Generalized from single-product props to `{items, onClose}`: `items` is
// a snapshot of cart lines (see CartDrawer), shown as a compact read-only
// summary above the existing name/email/phone form. POSTs the multi-item
// body to /api/checkout/create and clears the cart on success, before the
// redirect, so a back-button visit after payment doesn't show a stale cart.
function CheckoutModal({ items, onClose }) {
  const cart = useContext(CartContext);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const total = useMemo(
    () => items.reduce((sum, it) => sum + computeSubtotal(it.precio_unitario, it.unidad_precio, it.cantidad), 0),
    [items]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setEnviando(true);
    fetch(`${API_BASE}/api/checkout/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((it) => ({
          product_id: it.product_id,
          product_color_id: it.product_color_id,
          cantidad: it.cantidad,
        })),
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone || null,
      }),
    })
      .then((res) =>
        res.json().then((data) => {
          if (!res.ok) throw new Error(data.error || "No se pudo iniciar el pago");
          return data;
        })
      )
      .then((data) => {
        if (cart) cart.clear();
        window.location.href = data.checkout_url;
      })
      .catch((err) => {
        setError(err.message);
        setEnviando(false);
      });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl border border-arena max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-editorial text-lg font-semibold text-cafe">Finalizar compra</h3>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="text-cafe/50 hover:text-cafe text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <div className="mb-4 flex flex-col gap-1.5 max-h-36 overflow-y-auto border-b border-arena pb-3">
          {items.map((it) => (
            <div
              key={it.key || `${it.product_id}:${it.product_color_id}`}
              className="flex items-center justify-between gap-3 text-sm font-ui text-cafe/70"
            >
              <span className="truncate">
                {it.nombre}
                {it.color_nombre ? ` — ${it.color_nombre}` : ""} · {it.cantidad}
                {it.unidad_precio === "gramos" ? " g" : ""}
              </span>
              <span className="shrink-0">${computeSubtotal(it.precio_unitario, it.unidad_precio, it.cantidad).toFixed(2)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between text-sm font-ui font-semibold text-cafe pt-1">
            <span>Total</span>
            <span>${total.toFixed(2)} MXN</span>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            className="border border-arena rounded-lg px-3 py-2 font-ui text-cafe focus:outline-none focus:ring-2 focus:ring-taupe"
            placeholder="Nombre completo"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
          />
          <input
            type="email"
            className="border border-arena rounded-lg px-3 py-2 font-ui text-cafe focus:outline-none focus:ring-2 focus:ring-taupe"
            placeholder="Correo electrónico"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            required
          />
          <input
            className="border border-arena rounded-lg px-3 py-2 font-ui text-cafe focus:outline-none focus:ring-2 focus:ring-taupe"
            placeholder="Teléfono (opcional)"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
          />
          {error && <p className="text-sm font-ui text-terracota-700">{error}</p>}
          <button
            type="submit"
            disabled={enviando}
            className="btn-madera text-crema font-editorial font-semibold px-6 py-3 rounded-lg transition-colors disabled:opacity-60"
          >
            {enviando ? "Redirigiendo…" : "Continuar al pago"}
          </button>
        </form>
      </div>
    </div>
  );
}

// Quantity stepper + "Agregar al carrito" — step/min/max/default all
// branch on unidad_precio (grams vs. whole pieces), matching the plan's
// Section 3. `maxStock` is the selected color's stock, or the product's
// own stock when it has no color variants.
function BuySection({ producto, colorSeleccionado, maxStock }) {
  const cart = useContext(CartContext);
  const esGramos = producto.unidad_precio === "gramos";
  const step = esGramos ? 100 : 1;
  const maxClamped = esGramos ? Math.floor(maxStock / 100) * 100 : maxStock;
  const [cantidad, setCantidad] = useState(step);
  const [agregado, setAgregado] = useState(false);

  // Reset quantity to the default step whenever the relevant stock ceiling
  // changes (e.g. the customer picks a different color).
  useEffect(() => {
    setCantidad(Math.min(step, maxClamped) || step);
  }, [maxClamped]);

  if (maxClamped <= 0) return null;

  const ajustar = (delta) => {
    setCantidad((c) => Math.max(step, Math.min(maxClamped, c + delta)));
  };

  const agregarAlCarrito = () => {
    if (!cart) return;
    cart.addItem(producto, colorSeleccionado, cantidad);
    setAgregado(true);
    setTimeout(() => setAgregado(false), 1500);
  };

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => ajustar(-step)}
          disabled={cantidad <= step}
          className="w-8 h-8 rounded-full border border-arena text-cafe font-ui font-bold disabled:opacity-40"
        >
          −
        </button>
        <span className="font-ui text-sm text-cafe w-16 text-center">
          {cantidad}
          {esGramos ? " g" : ""}
        </span>
        <button
          type="button"
          onClick={() => ajustar(step)}
          disabled={cantidad >= maxClamped}
          className="w-8 h-8 rounded-full border border-arena text-cafe font-ui font-bold disabled:opacity-40"
        >
          +
        </button>
      </div>
      <button
        type="button"
        onClick={agregarAlCarrito}
        className="btn-madera text-crema font-editorial font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
      >
        {agregado ? "Agregado ✓" : "Agregar al carrito"}
      </button>
    </div>
  );
}

function ProductCard({ producto }) {
  const conStockYColores = USE_API && Array.isArray(producto.colores);
  const agotado = conStockYColores && estaAgotado(producto);
  const tieneColores = conStockYColores && producto.colores.length > 0;
  const [colorSeleccionado, setColorSeleccionado] = useState(null);

  const maxStock = tieneColores
    ? (colorSeleccionado ? colorSeleccionado.stock : 0)
    : (producto.stock || 0);

  return (
    <article className="bg-white rounded-2xl border border-arena overflow-hidden flex flex-col hover:shadow-lg hover:-translate-y-0.5 transition-all">
      <div className="aspect-square bg-crema relative">
        <img
          src={producto.imagen}
          alt={producto.nombre}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {SHOW_AGOTADO_BADGE && agotado && (
          <span className="absolute top-2 right-2 bg-cafe text-crema text-xs font-ui font-bold uppercase tracking-wide px-2 py-1 rounded-full">
            Agotado
          </span>
        )}
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
        {tieneColores && (
          <ColorSwatches
            colores={producto.colores}
            seleccionado={colorSeleccionado ? colorSeleccionado.color_id : null}
            onSeleccionar={(colorId) =>
              setColorSeleccionado(producto.colores.find((c) => c.color_id === colorId) || null)
            }
          />
        )}
        <p className="mt-3 font-editorial text-lg font-semibold text-cafe">
          {formatPrecio(producto)}
        </p>
        {conStockYColores && (!tieneColores || colorSeleccionado) && (
          <BuySection producto={producto} colorSeleccionado={colorSeleccionado} maxStock={maxStock} />
        )}
      </div>
    </article>
  );
}

// Right-side slide-in panel, visual language borrowed directly from
// CheckoutModal (same overlay/backdrop-click-to-close idiom, font-editorial/
// font-ui/btn-madera/border-arena/rounded-2xl classes). Always mounted (not
// conditionally, unlike CheckoutModal) so the translate-x transform can
// actually animate open/closed instead of popping in.
//
// Whenever the drawer opens, re-fetches GET {API_BASE}/api/products and
// clamps/warns any line whose quantity now exceeds current stock — the
// live stock check; the cart itself never persists a stock ceiling.
function CartDrawer() {
  const cart = useContext(CartContext);
  const [checkoutAbierto, setCheckoutAbierto] = useState(false);
  // Live stock ceiling for every line currently in the cart (not just the
  // ones that were over-limit at fetch time) — the stepper's "+" needs the
  // real current max for every line, not only the ones flagged with a
  // warning, or it could step a line past freshly-depleted stock that
  // still happened to be within its *old* ceiling.
  const [lineStock, setLineStock] = useState({});

  useEffect(() => {
    if (!cart || !cart.isOpen) return;
    fetch(`${API_BASE}/api/products`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((productos) => {
        const stock = {};
        cart.lines.forEach((line) => {
          const producto = productos.find((p) => p.id === line.product_id);
          if (!producto) {
            stock[line.key] = { max: 0, message: "Este producto ya no está disponible" };
            return;
          }
          let stockActual;
          if (line.product_color_id != null) {
            const color = (producto.colores || []).find((c) => c.product_color_id === line.product_color_id);
            stockActual = color ? color.stock : 0;
          } else {
            stockActual = producto.stock || 0;
          }
          const maxClamped = clampStock(line.unidad_precio, stockActual);
          const sobreLimite = line.cantidad > maxClamped;
          stock[line.key] = {
            max: maxClamped,
            message: sobreLimite
              ? maxClamped > 0
                ? `Solo quedan ${maxClamped}${line.unidad_precio === "gramos" ? " g" : ""} disponibles — cantidad ajustada`
                : "Sin existencias — elimínalo del carrito"
              : null,
          };
          if (sobreLimite) cart.updateQuantity(line.key, maxClamped);
        });
        setLineStock(stock);
      })
      .catch(() => {});
    // Re-run every time the drawer transitions to open, not on every lines
    // change — re-checking stock on every quantity tweak would be wasteful
    // and would fight the very clamp this effect just applied.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart && cart.isOpen]);

  if (!cart) return null;

  const sinExistencias = Object.values(lineStock).some((info) => info.max <= 0);

  return (
    <React.Fragment>
      <div
        className={
          "fixed inset-0 z-40 bg-black/40 transition-opacity " +
          (cart.isOpen ? "opacity-100" : "opacity-0 pointer-events-none")
        }
        onClick={() => cart.setIsOpen(false)}
      />
      <div
        className={
          "fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white border-l border-arena flex flex-col transform transition-transform " +
          (cart.isOpen ? "translate-x-0" : "translate-x-full")
        }
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-arena">
          <h3 className="font-editorial text-lg font-semibold text-cafe">Tu carrito</h3>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => cart.setIsOpen(false)}
            className="text-cafe/50 hover:text-cafe text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {cart.lines.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="font-ui text-cafe/60">Tu carrito está vacío.</p>
            <a
              href="#catalogo"
              onClick={() => cart.setIsOpen(false)}
              className="btn-madera inline-block text-crema font-editorial font-semibold px-5 py-2 rounded-lg transition-colors text-sm"
            >
              Ir al catálogo
            </a>
          </div>
        ) : (
          <React.Fragment>
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
              {cart.lines.map((line) => {
                const step = stepFor(line.unidad_precio);
                const info = lineStock[line.key];
                const maxClamped = info ? info.max : Infinity;
                return (
                  <div key={line.key} className="flex gap-3 border-b border-arena pb-4 last:border-0">
                    <img
                      src={line.imagen}
                      alt={line.nombre}
                      className="w-16 h-16 rounded-lg object-cover bg-crema shrink-0"
                    />
                    <div className="flex-1 flex flex-col gap-1 min-w-0">
                      <p className="font-ui text-sm font-semibold text-cafe truncate">{line.nombre}</p>
                      {line.color_nombre && (
                        <span className="flex items-center gap-1.5 text-xs font-ui text-cafe/60">
                          <span
                            className="w-3 h-3 rounded-full border border-arena inline-block shrink-0"
                            style={{ backgroundColor: line.color_hex || "#cccccc" }}
                          />
                          {line.color_nombre}
                        </span>
                      )}
                      {info && info.message && (
                        <p className="text-xs font-ui text-terracota-700">{info.message}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => cart.updateQuantity(line.key, Math.max(step, line.cantidad - step))}
                          disabled={line.cantidad <= step}
                          className="w-6 h-6 rounded-full border border-arena text-cafe font-ui font-bold text-xs disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="font-ui text-xs text-cafe w-12 text-center">
                          {line.cantidad}
                          {line.unidad_precio === "gramos" ? " g" : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            cart.updateQuantity(line.key, Math.min(maxClamped, line.cantidad + step))
                          }
                          disabled={line.cantidad >= maxClamped}
                          className="w-6 h-6 rounded-full border border-arena text-cafe font-ui font-bold text-xs disabled:opacity-40"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => cart.removeItem(line.key)}
                          className="ml-auto text-xs font-ui text-terracota-700 hover:underline"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                    <p className="font-ui text-sm font-semibold text-cafe shrink-0">
                      ${computeSubtotal(line.precio_unitario, line.unidad_precio, line.cantidad).toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-4 border-t border-arena flex flex-col gap-3">
              <div className="flex items-center justify-between font-ui font-semibold text-cafe">
                <span>Total</span>
                <span>${cart.subtotal.toFixed(2)} MXN</span>
              </div>
              <p className="text-xs text-cafe/60">Este pedido se recoge en tienda — no se realizan envíos.</p>
              <button
                type="button"
                onClick={() => cart.clear()}
                className="text-sm font-ui text-cafe/60 hover:underline text-left"
              >
                Vaciar carrito
              </button>
              <button
                type="button"
                disabled={sinExistencias}
                onClick={() => setCheckoutAbierto(true)}
                className="btn-madera text-crema font-editorial font-semibold px-6 py-3 rounded-lg transition-colors disabled:opacity-60"
              >
                Proceder al pago
              </button>
            </div>
          </React.Fragment>
        )}
      </div>
      {checkoutAbierto && <CheckoutModal items={cart.lines} onClose={() => setCheckoutAbierto(false)} />}
    </React.Fragment>
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
    let resultado;
    if (categoriaActiva === "Todos") {
      resultado = productos;
    } else if (categoriaActiva === "Kits para Crochet") {
      resultado = productos.filter((p) => KITS_CROCHET_CATEGORIAS.includes(p.categoria));
    } else {
      resultado = productos.filter((p) => p.categoria === categoriaActiva);
    }
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
          Compra en línea y recoge tu pedido en tienda. Las madejas se venden
          por unidad o por cada 100&nbsp;g, según la referencia. El catálogo
          se irá ampliando con nuevos acrílicos y accesorios.
          {SHOW_AGOTADO_BADGE && CONTENT.catalogoNotaAgotado && ` ${CONTENT.catalogoNotaAgotado}`}
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
            src={CONTENT.imagenes?.nosotros || "assets/images/tienda-entrada-pizarra.jpg"}
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

function IconoTienda() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
      <path d="M3 9l1-5h16l1 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 20v-5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconoRecogeEnTienda() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
      <path d="M3 8l9-4 9 4-9 4-9-4Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 8v8l9 4 9-4V8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 12v8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.3 15.3l1.8 1.8 3.6-3.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconoMercadoLibre() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" strokeLinecap="round" />
      <path d="M12 3c2.5 2.5 2.5 15.5 0 18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 3c-2.5 2.5-2.5 15.5 0 18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ICONOS_OPCIONES_COMPRA = {
  tienda: IconoTienda,
  recoge: IconoRecogeEnTienda,
  mercadolibre: IconoMercadoLibre,
};

const OPCIONES_COMPRA = [
  {
    id: "tienda",
    titulo: "Compra en tienda",
    descripcion:
      "Visítanos en nuestra tienda física y elige tus materiales en persona, con la asesoría de nuestro equipo.",
    icono: "tienda",
    disponible: true,
  },
  {
    id: "recoge",
    titulo: "Compra en línea, recoge en tienda",
    descripcion:
      "Haz tu pedido en línea y recógelo en tienda, sin esperar envíos ni pagar costos de entrega.",
    icono: "recoge",
    disponible: true,
    enlace: "#catalogo",
  },
  {
    id: "mercadolibre",
    titulo: "Compra en línea por MercadoLibre",
    descripcion: "Muy pronto podrás comprar nuestros productos directamente desde MercadoLibre.",
    icono: "mercadolibre",
    disponible: false,
  },
];

function OpcionesDeCompra() {
  const coloresIcono = ["bg-rosa", "bg-salvia"];

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
      <div className="text-center mb-10">
        <h2 className="font-editorial text-3xl font-semibold text-cafe mb-3">¿Cómo prefieres comprar?</h2>
        <p className="text-cafe/70 font-ui max-w-2xl mx-auto">
          Elige la forma que más te convenga para llevarte tus materiales de tejido.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {OPCIONES_COMPRA.map((opcion, i) => {
          const Icono = ICONOS_OPCIONES_COMPRA[opcion.icono];
          const Envoltura = opcion.enlace ? "a" : "div";
          return (
            <Envoltura
              key={opcion.id}
              {...(opcion.enlace ? { href: opcion.enlace } : {})}
              className={
                "relative bg-white rounded-2xl border border-arena p-6 flex flex-col items-center text-center gap-3 " +
                (opcion.disponible ? "" : "opacity-70") +
                (opcion.enlace ? " hover:shadow-lg hover:-translate-y-0.5 transition-all" : "")
              }
            >
              {!opcion.disponible && (
                <span className="absolute top-4 right-4 bg-arena text-cafe/70 text-xs font-ui font-semibold px-2 py-0.5 rounded-full">
                  Próximamente
                </span>
              )}
              <span
                className={
                  "w-12 h-12 rounded-full flex items-center justify-center text-crema shrink-0 " +
                  (opcion.disponible ? coloresIcono[i % coloresIcono.length] : "bg-cafe/30")
                }
              >
                <Icono />
              </span>
              <h3 className="font-editorial text-lg font-semibold text-cafe">{opcion.titulo}</h3>
              <p className="text-cafe/70 font-ui text-sm leading-relaxed">{opcion.descripcion}</p>
            </Envoltura>
          );
        })}
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

// Reads ?order=<id>&status=success|cancelled from location.search once on
// mount and renders a small dismissible banner reflecting the Stripe
// Checkout redirect outcome. No router in this app — this is a one-off
// conditional render, not a new page/route.
function CheckoutRedirectBanner() {
  const [estado, setEstado] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    return status === "success" || status === "cancelled" ? status : null;
  });

  if (!estado) return null;

  const esExito = estado === "success";
  return (
    <div
      className={
        "px-4 py-3 text-center text-sm font-ui border-b " +
        (esExito ? "bg-salvia/20 text-cafe border-salvia/40" : "bg-rosa/20 text-cafe border-rosa/40")
      }
    >
      <span className="mr-2">
        {esExito ? (
          <>
            ¡Gracias por tu compra! Te esperamos para que la recojas en tienda.{" "}
            <span className="text-xs">
              {CONTENT.footerDireccion} · {CONTENT.footerHorario}
            </span>
          </>
        ) : (
          "Pago cancelado — puedes intentarlo de nuevo cuando quieras."
        )}
      </span>
      <button
        type="button"
        onClick={() => setEstado(null)}
        className="font-semibold underline underline-offset-2"
      >
        Cerrar
      </button>
    </div>
  );
}

function App() {
  const [categoriaActiva, setCategoriaActiva] = useState("Todos");
  const [, forzarRerender] = useState(0);

  useEffect(() => {
    if (!USE_API) return;
    fetch(`${API_BASE}/api/content`)
      .then((res) => res.json())
      .then((data) => {
        if (!data) return;
        CONTENT = { ...CONTENT, ...data };
        if (CONTENT.titulo) document.title = CONTENT.titulo;
        forzarRerender((n) => n + 1);
      })
      .catch(() => {});
  }, []);

  return (
    <CartProvider>
      <React.Fragment>
        {USE_API && <CheckoutRedirectBanner />}
        <TopBar />
        <Header />
        <Hero />
        <CategoryTiles categoriaActiva={categoriaActiva} onSelectCategoria={setCategoriaActiva} />
        <NosotrosYTestimonios />
        <OpcionesDeCompra />
        <Catalogo categoriaActiva={categoriaActiva} onSelectCategoria={setCategoriaActiva} />
        <BlogComingSoon />
        <Footer />
        {USE_API && <CartDrawer />}
      </React.Fragment>
    </CartProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
