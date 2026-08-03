# Punto y Lana

Página web de una tienda de lana y accesorios de tejido, construida con
HTML5, React y Tailwind CSS (vía CDN, sin paso de compilación).

## Estructura

```
knitting-web-project/
├── index.html          # Punto de entrada público: carga React, Tailwind y app.jsx
├── app.jsx             # Componentes React (header, catálogo, secciones)
├── admin.html            # Panel de administración (no enlazado desde el sitio público)
├── admin.jsx              # Login + alta/edición/borrado de productos
├── catalog.csv          # Datos del catálogo (demo)
├── default-content.js    # Texto de demo (nombre, hero, nosotros, footer)
├── schema.sql             # Esquema de la tabla products para Cloudflare D1
├── wrangler.toml          # Configuración de Cloudflare Pages/D1
├── functions/api/         # API (Cloudflare Pages Functions) que respalda admin.html
├── config.example.js    # Plantilla de configuración (copiar a config.js)
└── assets/images/       # Imágenes ilustrativas de los productos (SVG)
```

## Cómo verlo en local

`app.jsx` carga `catalog.csv` con `fetch()`, y los navegadores bloquean esa
petición si abres `index.html` directamente como archivo (`file://`).
Sirve la carpeta con un servidor local, por ejemplo:

```bash
cd knitting-web-project
python3 -m http.server 8000
# abre http://localhost:8000
```

## Catálogo de producción vs. catálogo de demo

`catalog.csv`, en el repo, es un catálogo de ejemplo para demos y
desarrollo local — así es como funciona el sitio "de fábrica", sin pasos
adicionales. En producción, el catálogo puede en cambio vivir en una base de
datos (Cloudflare D1) y gestionarse desde `admin.html`. `config.js`
(gitignored, ver `config.example.js`) decide cuál se usa:

```bash
cp config.example.js config.js
```

- `API_BASE` sin definir (`null`, el valor por defecto): `app.jsx` usa
  `catalog.csv` y `admin.html` muestra un aviso de "no configurado".
- `API_BASE` definido (p. ej. `""` para mismo origen, o una URL completa):
  el catálogo público se carga desde `GET {API_BASE}/api/products` y
  `admin.html` queda operativo.

## Textos de "Sobre nosotros" y del pie de página

El nombre de la tienda (usado en el header y dos veces en el footer), el
título de la pestaña del navegador, el párrafo del hero, el párrafo de
`Nosotros()`, la dirección, el horario, el contacto y la línea de derechos
reservados del pie de página viven por defecto como texto de demo en
`default-content.js` (se envía con el repo, a diferencia de `config.js`).
Hay dos formas de usar el texto real del negocio sin tocar `app.jsx`:

1. **Fichero de contenido alternativo.** Duplica `default-content.js` (por
   ejemplo a `default-content-prod.js`) con el texto real, y cambia el
   `<script src="...">` correspondiente en `index.html` para que apunte a
   ese fichero en vez de a `default-content.js`.
2. **`CONTENT` en `config.js`.** Sobrescribe solo el subconjunto de claves
   que quieras, el resto sigue usando el texto de demo (o el de
   `default-content-prod.js`, si es el que está cargando `index.html`):

```js
window.APP_CONFIG = {
  // ...CATALOG_URL, API_BASE...
  CONTENT: {
    marca: "Nombre real de la tienda",
    titulo: "Nombre real — descripción corta",
    hero: "Texto real del hero...",
    nosotros: "Texto real de la tienda...",
    footerDireccion: "Calle real, ciudad",
    footerEmail: "contacto@tudominio.com",
    footerTelefono: "+34 ...",
    footerDerechos: "Todos los derechos reservados.",
  },
};
```

`marca` sustituye "Punto y Lana" en el header y el footer. `titulo`
sustituye el `<title>` de la pestaña del navegador — el texto que hay
escrito directamente en el `<title>` de `index.html` es solo el respaldo
que se ve un instante antes de que `app.jsx` cargue y lo sobrescriba; no
hace falta editarlo a mano salvo que también quieras cambiar ese respaldo
inicial. El `<title>` de `admin.html` sí es totalmente estático (no lee
`CONTENT`), igual que el nombre del repo.

## Panel de administración (Cloudflare Pages + D1)

`admin.html` no está enlazado desde la navegación pública, pero **eso no lo
protege por sí solo** — cualquiera que conozca la URL puede abrirlo. La
protección real es que todas las operaciones de escritura
(`POST`/`PUT`/`DELETE` en `functions/api/`) exigen una cookie de sesión
válida, emitida solo tras iniciar sesión con las credenciales de
administrador. Es una única cuenta de administrador (no hay alta pública de
usuarios), pensada para un solo gestor del catálogo.

Se eligió Cloudflare Pages Functions + D1 en vez de un backend gestionado
tipo Supabase porque los planes gratuitos de ese tipo de servicios suelen
pausar el proyecto tras una semana de inactividad (hay que "despertarlo" a
mano desde su panel) — y como el catálogo público también leería de esa
misma base de datos en producción, una semana tranquila dejaría caído no
solo el panel de administración sino la tienda para los clientes reales.
D1 y Pages Functions son "serverless" (no hay servidor que se quede inactivo)
y su capa gratuita no caduca por falta de uso.

### Puesta en marcha

1. Crea una cuenta de Cloudflare (gratuita) e instala Wrangler:
   `npm install -g wrangler` (o usa `npx wrangler` sin instalarlo).
2. `wrangler login`
3. Crea la base de datos D1 y copia el `database_id` que te devuelva a
   `wrangler.toml`:
   ```bash
   wrangler d1 create punto-y-lana
   ```
4. Crea la tabla `products`:
   ```bash
   wrangler d1 execute punto-y-lana --remote --file=schema.sql
   ```
5. Crea el proyecto de Pages y haz el primer despliegue (`wrangler pages
   secret put` exige que el proyecto ya exista, así que este paso va antes
   que el siguiente):
   ```bash
   wrangler pages deploy .
   ```
6. Define los secretos del panel de administración (tú eliges usuario y
   contraseña; `SESSION_SECRET` puede ser cualquier cadena larga aleatoria):
   ```bash
   wrangler pages secret put ADMIN_USERNAME
   wrangler pages secret put ADMIN_PASSWORD
   wrangler pages secret put SESSION_SECRET
   ```
   Vuelve a desplegar (`wrangler pages deploy .`) para que la Function
   recoja los secretos recién creados.
7. En `config.js` (en la raíz del proyecto, junto a `index.html`), define
   `API_BASE: ""`. `wrangler pages deploy .` sube lo que haya en disco —
   incluido `config.js`, aunque esté en `.gitignore` — así que tiene que
   estar así **antes** de desplegar, no después.

   **No pongas aquí la URL de un despliegue concreto** (el
   `https://<hash>.punto-y-lana.pages.dev` que imprime cada
   `wrangler pages deploy`) — cada despliegue genera un hash distinto, y al
   ser un dominio distinto al de la página que estás viendo, el navegador
   bloquea la petición por CORS antes de que el usuario/contraseña lleguen
   siquiera a comprobarse. `""` (mismo origen) evita ese problema porque
   `admin.html` y la API siempre se sirven desde el dominio que sea que
   estés visitando en cada momento.
8. Abre `/admin.html`, inicia sesión y gestiona el catálogo.

### Desarrollo local del panel

`wrangler pages dev` ejecuta la API y una base de datos D1 local, sin tocar
Cloudflare:

```bash
wrangler d1 execute punto-y-lana --local --file=schema.sql
wrangler pages dev .
```

Dos detalles que si se pasan por alto rompen el login o la API en local,
con el mismo síntoma ("las credenciales no funcionan" / "no such table:
products"):

- **No añadas `--d1=DB=punto-y-lana`** a `wrangler pages dev`. Con ese
  flag, `pages dev` crea una base de datos D1 local *distinta* de la que
  acaba de rellenar `wrangler d1 execute --local` (cada una queda en un
  fichero `.sqlite` distinto dentro de `.wrangler/state`), así que
  `/api/products` falla con `no such table: products`. Sin el flag,
  `pages dev` resuelve el binding `DB` desde `wrangler.toml` y usa la
  misma base de datos que acabas de poblar.
- **Crea `.dev.vars`** en la raíz del proyecto (está en `.gitignore`, así
  que no sobrevive a un `git clone` ni a limpiar el repo — hay que
  volver a crearlo en cada máquina/checkout nuevo):
  ```
  ADMIN_USERNAME=admin
  ADMIN_PASSWORD=tu-contraseña-de-prueba
  SESSION_SECRET=cualquier-cadena-larga-aleatoria
  ```
  Sin este fichero, `pages dev` arranca igualmente pero sin
  `ADMIN_USERNAME`/`ADMIN_PASSWORD` definidos, así que el login rechaza
  cualquier usuario y contraseña que escribas — no es un problema de las
  credenciales en sí, es que no hay ninguna configurada.

Las columnas del catálogo (tanto en `catalog.csv` como en la tabla
`products`) son:

`id, nombre, fabricante, categoria, imagen, precio, unidad_precio, descripcion`

`unidad_precio` indica cómo se vende la referencia: `100g` (lanas que se
cobran por cada 100 gramos), `madeja` (precio fijo por madeja/unidad de
venta) o `unidad` (accesorios).

## Imágenes de producto

Las imágenes en `assets/images/` son ilustraciones SVG genéricas
(ovillos de colores, agujas, ganchillos, etc.) a modo de marcador visual.
Cuando tengas fotografías reales de cada artículo, sustitúyelas y
actualiza la columna `imagen` del CSV con la ruta correspondiente.
