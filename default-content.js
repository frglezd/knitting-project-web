// Texto por defecto del nombre de la tienda, del hero, de "Sobre nosotros"
// y del pie de página. Este es el texto de demo que se envía con el repo;
// para el texto real del negocio, sobrescribe cualquier subconjunto de
// estas claves definiendo CONTENT en config.js (gitignored, ver
// config.example.js) sin tocar este fichero.
window.DEFAULT_CONTENT = {
  marca: "Punto y Lana",
  // Sin logo en la demo: el header cae al emoji + nombre de la tienda.
  // Define una ruta (p. ej. "assets/images/logo.png") para usar una imagen.
  logo: null,
  titulo: "Punto y Lana — Tienda de lana y accesorios de tejido",
  heroTitulo: "Bienvenidos a",
  heroSubtitulo: "Hilos y puntos con calma",
  hero:
    "Seleccionamos acrílicos naturales, fibras recicladas y accesorios de " +
    "calidad para que cada punto y cada vuelta de ganchillo sean un " +
    "placer, ya sea tu primer proyecto o el número cien.",
  redesFacebook: "https://www.facebook.com/",
  redesInstagram: "https://www.instagram.com/",
  instagramHandle: "@puntoylana",
  testimonios: [
    { nombre: "Clienta frecuente", texto: "Encontré exactamente la lana que buscaba y el trato fue buenísimo. Ya es mi mercería de cabecera." },
    { nombre: "Clienta satisfecha", texto: "Me encanta la variedad de ganchillos y que siempre tienen algo nuevo. El equipo es súper atento cuando tengo dudas de un patrón." },
    { nombre: "Clienta desde hace años", texto: "Compro aquí desde hace años. La calidad de los hilos es excelente y los precios muy justos." },
  ],
  blogProximamente: "Muy pronto compartiremos tutoriales, patrones e inspiración aquí. ¡Vuelve pronto!",
  nosotros:
    "Punto y Lana nació como una pequeña mercería de barrio y hoy " +
    "combinamos la tienda física con la venta online, sin perder el " +
    "trato cercano. Trabajamos con fabricantes que cuidan el origen de " +
    "sus fibras —desde merinos europeos hasta algodones y fibras " +
    "recicladas— y seleccionamos a mano cada agujero, ganchillo y " +
    "accesorio que llega a nuestras estanterías. Nuestro objetivo es " +
    "que encuentres justo lo que tu proyecto necesita, con " +
    "asesoramiento honesto y sin prisas.",
  footerTagline: "Acrílicos, hilos y accesorios para tejer con cariño, en tienda y online.",
  footerDireccion: "Calle Mayor 12, 28013 Madrid",
  footerHorario: "Lunes a sábado, 10:00–20:00",
  footerEmail: "hola@puntoylana.es",
  footerTelefono: "+34 900 000 000",
  footerDerechos: "Todos los derechos reservados.",
  // Fotos del sitio fuera del catálogo (el catálogo tiene su propia imagen
  // por producto). Rutas relativas a la raíz del sitio o URLs completas.
  imagenes: {
    hero: "assets/images/cesta-ovillos-ganchillos.jpg",
    nosotros: "assets/images/tienda-entrada-pizarra.jpg",
    tileEstambre: "assets/images/cesta-ovillos-estanteria.jpg",
    tileKits: "assets/images/cesta-ovillos-agujas.jpg",
    tileAccesorios: "assets/images/libros-crochet-mostrador.jpg",
  },
};
