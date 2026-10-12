# Kontrola

> Gestiona tu negocio y hazlo visible.

Sistema compuesto por **tres aplicaciones web React** que comparten **un backend Node.js + Express** y **una base de datos SQLite**.

| Plataforma | Carpeta | URL local | Para qué sirve |
|---|---|---|---|
| API | `backend/` | http://localhost:4000 | Base de datos, login y reglas de negocio |
| 1. Gestión | `gestion/` | http://localhost:5173 | Clientes, ventas, inventario, productos, anuncios y colaboradores (con login) |
| 2. Tienda | `tienda/` | http://localhost:5174/{negocio} | Página pública de cada negocio: catálogo, anuncios, contacto, WhatsApp, redes y mapa |
| 3. Directorio | `directorio/` | http://localhost:5175 | Lista de todos los negocios con filtros por categoría, servicio y ubicación |

## Cómo se relacionan

```
             ┌──────────────────────┐
             │   1. GESTIÓN (login) │  admin / colaborador de cada negocio
             └─────────┬────────────┘
                       │  productos, anuncios, perfil del negocio
                       ▼
┌──────────────────────────────────────────────┐
│  API Express  ──  SQLite (backend/data/*.db) │
└──────────┬───────────────────────┬───────────┘
           │ /api/public/...       │ /api/public/...
           ▼                       ▼
  2. TIENDA /{slug}  ◄────── 3. DIRECTORIO (enlace "Ver tienda")
```

- **Multi-negocio:** cada usuario pertenece a un negocio (`business_id`). Todas las consultas de la plataforma de gestión se filtran por el negocio del usuario autenticado, así que el admin y los colaboradores de un mismo negocio ven la misma información y nunca la de otro negocio.
- Los **productos** marcados “en catálogo” aparecen en la tienda del negocio.
- Los **anuncios** activos (y dentro de sus fechas de publicación) aparecen en la tienda.
- El **perfil del negocio** (categoría, servicios, ciudad, WhatsApp, redes, ubicación, logo, portada, color) alimenta la tienda y el directorio.

## Roles

| Rol | Puede |
|---|---|
| **superadmin** | Crear, editar, activar/desactivar y eliminar negocios, y crear su usuario administrador. No ve datos internos de los negocios. |
| **admin** (de un negocio) | Todo lo del colaborador + gestionar colaboradores y editar el perfil público del negocio. |
| **colaborador** | Clientes, ventas, productos, inventario y anuncios de su negocio. |

## Marca Kontrola, ícono y datos del desarrollador

Todo se configura en la carpeta **`shared/`** (la usan las 3 plataformas):

| Qué | Dónde |
|---|---|
| **Ícono / logo de Kontrola** | Reemplaza `shared/kontrola-logo.png` por tu imagen con **el mismo nombre**. Se usa en la pestaña del navegador, el login y menú de Gestión, el encabezado y footer del Directorio y los footers. Si tu archivo es `.svg`, `.jpg` o `.webp`, cambia la extensión en la línea `import logo from './kontrola-logo.png'` de `shared/brand.js`. Recomendado: cuadrado, mínimo 256×256 px, fondo transparente. |
| **Información del desarrollador** (footer) | Edita el objeto `DEVELOPER` en `shared/brand.js` (nombre, rol, correo, WhatsApp, teléfono, web, LinkedIn, GitHub, Instagram). Los campos vacíos no se muestran. |
| **Nombre y lema** | Objeto `BRAND` en `shared/brand.js`. |

## Sliders

- **Tienda:** en Gestión → *Mi negocio* → *Slider de la tienda*, el administrador sube hasta 10 imágenes, las ordena y les pone un texto opcional. Rotan de fondo en el encabezado de la tienda. Si no hay imágenes, se usa la portada.
- **Directorio:** el encabezado muestra de fondo negocios al azar (nombre, categoría y ciudad, con enlace a su tienda). Solo aparecen los negocios que tienen portada o imágenes de slider.

## Modo oscuro y diseño responsive

- Las 3 plataformas tienen un botón ☀/🌙 para cambiar de tema. Si el usuario nunca lo usa, se aplica el tema de su sistema operativo; la elección se recuerda en el navegador.
- Todas se adaptan a celular, tablet y escritorio. En Gestión, las tablas se convierten en tarjetas en pantallas pequeñas y el menú lateral se abre con ☰.

## Requisitos

- **Node.js 20 o 22 (LTS)**, que incluye npm. Descarga: https://nodejs.org
- En Windows, `better-sqlite3` descarga un binario precompilado. Si la instalación falla por compilación, instala Node LTS (no una versión “Current”) o las “Build Tools for Visual Studio”.

## Instalación y ejecución

Abre una terminal en la carpeta del proyecto:

```bash
npm install          # instala dependencias de las 4 aplicaciones (npm workspaces)
npm run seed         # (opcional) crea datos de ejemplo
npm run dev          # inicia API + Gestión + Tienda + Directorio a la vez
```

Luego abre:

- Gestión: http://localhost:5173
- Directorio: http://localhost:5175
- Tienda de ejemplo: http://localhost:5174/cafe-aroma

### Usuarios de prueba (después de `npm run seed`)

| Rol | Correo | Contraseña |
|---|---|---|
| Superadmin | super@plataforma.com | super123 |
| Admin Café Aroma | admin@cafearoma.co | admin123 |
| Colaborador Café Aroma | andres@cafearoma.co | colab123 |
| Admin TecnoFix | admin@tecnofix.co | admin123 |
| Colaborador TecnoFix | sofia@tecnofix.co | colab123 |

Si no ejecutas el seed, el backend crea automáticamente el superadmin `super@plataforma.com / super123` la primera vez que arranca. **Cambia esa contraseña** desde “Mi cuenta”.

### Ejecutar cada app por separado

```bash
npm run dev -w backend
npm run dev -w gestion
npm run dev -w tienda
npm run dev -w directorio
```

## Configuración

- `backend/.env` (copiar de `.env.example`): `PORT`, `JWT_SECRET` (**cámbialo en producción**), `DB_PATH`, `CORS_ORIGINS`.
- `gestion/.env`, `tienda/.env`, `directorio/.env`: `VITE_API_URL`, `VITE_TIENDA_URL`, `VITE_DIRECTORIO_URL`, `VITE_GESTION_URL`. Cambia estos valores cuando publiques en un dominio real.

La base de datos se crea sola en `backend/data/plataforma.db` y las imágenes subidas se guardan en `backend/uploads/`.

## Estructura

```
backend/
  src/
    server.js            # arranque y rutas
    db.js                # esquema SQLite (se crea automáticamente)
    seed.js              # datos de ejemplo
    middleware/auth.js   # JWT, roles y aislamiento por negocio
    routes/
      auth.js            # login, perfil, cambio de contraseña
      businessAdmin.js   # superadmin: CRUD de negocios
      business.js        # perfil del negocio propio
      users.js           # colaboradores
      clients.js  products.js  inventory.js  sales.js  ads.js  dashboard.js
      public.js          # API pública para Tienda y Directorio
gestion/src/             # React: login, dashboard, POS de ventas, CRUDs
tienda/src/              # React: tienda pública por slug
directorio/src/          # React: directorio con filtros
```

## Modelo de datos

- `businesses` (+ `business_services`): perfil público del negocio.
- `users`: superadmin, admins y colaboradores (`business_id`).
- `clients`, `products`, `ads`: siempre ligados a `business_id`.
- `sales` + `sale_items`: ventas; al registrar una venta se descuenta stock y se crea un movimiento de inventario. Anular una venta devuelve el stock.
- `inventory_movements`: entradas, salidas, ajustes, ventas y anulaciones con el stock resultante.

## Endpoints principales

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/auth/login` | público |
| GET | `/api/public/businesses?category=&service=&city=&q=` | público (directorio) |
| GET | `/api/public/filters` | público (directorio) |
| GET | `/api/public/businesses/:slug` | público (tienda) |
| CRUD | `/api/clients`, `/api/products`, `/api/ads` | usuarios del negocio |
| GET/POST | `/api/sales`, `POST /api/sales/:id/cancel` | usuarios del negocio |
| GET/POST | `/api/inventory/movements` | usuarios del negocio |
| GET | `/api/users` · POST/PUT/DELETE solo admin | usuarios del negocio |
| GET · PUT solo admin | `/api/business` | usuarios del negocio |
| CRUD | `/api/admin/businesses` | superadmin |

## Producción (resumen)

1. `npm run build` genera `gestion/dist`, `tienda/dist` y `directorio/dist` (sitios estáticos). Configura el servidor web para que todas las rutas devuelvan `index.html` (SPA).
2. Ejecuta el backend con `npm start -w backend` (idealmente con PM2 o como servicio) y define un `JWT_SECRET` seguro.
3. Ajusta las variables `VITE_*` antes del build y `CORS_ORIGINS` en el backend.
