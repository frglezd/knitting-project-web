# Punto y Lana

Página web de una tienda de lana y accesorios de tejido, construida con
HTML5, React y Tailwind CSS (vía CDN, sin paso de compilación).

## Estructura

```
knitting-web-project/
├── index.html          # Punto de entrada: carga React, Tailwind y app.jsx
├── app.jsx             # Componentes React (header, catálogo, secciones)
├── catalog.csv          # Datos del catálogo
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

## El catálogo: CSV hoy, base de datos mañana

Se pidió guardar el catálogo en un CSV ya que se espera que crezca y que
en el futuro viva en una base de datos. `catalog.csv` usa estas columnas:

`id, nombre, fabricante, categoria, imagen, precio, unidad_precio, descripcion`

`unidad_precio` indica cómo se vende la referencia: `100g` (lanas que se
cobran por cada 100 gramos), `ovillo` (precio fijo por ovillo/unidad de
venta) o `unidad` (accesorios).

Sugerencia para cuando el catálogo crezca: mantener estos mismos nombres
de columna como nombres de campo en una tabla `productos` (SQLite o
Postgres funcionan bien; Postgres si además quieres gestionar stock,
pedidos o usuarios). Se puede exponer con un endpoint sencillo tipo
`GET /api/productos` que devuelva JSON con esas mismas claves, y en
`app.jsx` solo hay que cambiar la función `fetch("catalog.csv")` por
`fetch("/api/productos")` — el resto de la interfaz no necesita tocarse.
Si por ahora no quieres montar un backend propio, herramientas como
Supabase o una hoja de cálculo publicada como API (p. ej. Google Sheets +
Sheet2API) son un paso intermedio razonable antes de una base de datos
completa.

## Imágenes de producto

Las imágenes en `assets/images/` son ilustraciones SVG genéricas
(ovillos de colores, agujas, ganchillos, etc.) a modo de marcador visual.
Cuando tengas fotografías reales de cada artículo, sustitúyelas y
actualiza la columna `imagen` del CSV con la ruta correspondiente.
