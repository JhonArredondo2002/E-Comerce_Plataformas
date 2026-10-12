// ─────────────────────────────────────────────────────────────────────────────
//  CONFIGURACIÓN DE MARCA KONTROLA (compartida por Gestión, Tienda y Directorio)
//
//  ▸ Ícono / logo: reemplaza el archivo  shared/kontrola-logo.png  por el tuyo
//    (mismo nombre). Si tu ícono es .svg, .jpg o .webp, cambia la extensión en
//    la línea `import logo ...` de abajo.
//  ▸ Datos del desarrollador: edita el objeto DEVELOPER. Los campos vacíos ('')
//    no se muestran en el footer.
// ─────────────────────────────────────────────────────────────────────────────
import logo from "./kontrola-logo.png";

export const BRAND = {
  name: "Kontrola",
  tagline: "Gestiona tu negocio y hazlo visible",
  logo,
};

export const DEVELOPER = {
  name: "Jhon",
  role: "Desarrollador de software",
  email: "jhonarredondo15@gmail.com",
  whatsapp: "57 3137676866", // con indicativo, sin + ni espacios. Ej: 573001234567
  phone: "57 3137676866",
  website: "",
  linkedin: "",
  github: "",
  instagram: "",
};

/** Pone el logo de Kontrola como ícono de la pestaña del navegador. */
export function setFavicon(href = BRAND.logo) {
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "";
  link.href = href;
}
