# GREBLA

**Gestión Reflexiva de Equipos Bajo un Liderazgo Afectivo.** Framework de
herramientas para entender y desarrollar equipos y personas. Cada herramienta se
sirve bajo `/tools/<herramienta>` sobre una base común (Astro + Lit + Firebase),
con `/` como landing y `/login` como acceso global.

## Identidad visual

Paleta extraída del logo (brújula + corazón):

| Token | Color | Uso |
|-------|-------|-----|
| `--gr-navy` | `#1E3A5F` | Marca, texto principal |
| `--gr-teal` | `#2A9D8F` | Acento interactivo (enlaces, barras, CTAs) |
| `--gr-coral` | `#F2887A` | Acento afectivo (el "corazón"), perfil objetivo |

Definidos en `:root` (`src/layouts/Base.astro`) y consumidos por los componentes
Lit vía `var(--rm-*)` / `var(--gr-*)`.

**Assets de marca.** El icono (brújula + corazón) y la imagen social se generan
desde SVG con `pnpm assets` (script `scripts/gen-assets.mjs`, usa `sharp`):
`public/favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` y `og-image.png`
(1200×630). Las meta Open Graph/Twitter están en `Base.astro`. Para que la
imagen social use URL **absoluta**, configura `site` en `astro.config.mjs` con tu
dominio de despliegue (si no, se usa una ruta relativa).

## Role Mirror (`/tools/role-mirror`)

Primera herramienta del framework: **autodiagnóstico de perfil de ingeniería**.
Respondes un cuestionario adaptativo (las preguntas se ramifican según tus
respuestas) y obtienes un mapa de competencias con tu **rol dominante** y tu
**distancia** al resto de roles. Los resultados se guardan en Firestore
vinculados a tu cuenta de Google, de modo que puedes tener varias sesiones y ver
tu evolución.

## Stack

- **Astro** (`output: static`) + integración **@astrojs/lit**
- **Lit** para los componentes interactivos (Shadow DOM, estilos en `css\`\``)
- **Firebase**: Authentication (Google OAuth) + Firestore
- **JavaScript vanilla** con **JSDoc** (sin TypeScript)
- **pnpm**
- CSS nativo con custom properties (`:root` en Astro, `var(--rm-*)` en Lit)

## Roles y dimensiones

Roles cubiertos: **Engineer, Tech Lead, Staff Engineer, Engineering Manager,
Head of Engineering, VP of Engineering, CTO**.

El modelo vive en `src/data/roles.js` (roles + frases) e `src/data/items.js`
(ítems del cuestionario con su peso por rol y condiciones de visibilidad).
**Añadir un rol o una pregunta nuevos es solo editar esos arrays**: los
componentes no necesitan cambios.

Cada ítem pertenece a una dimensión: Estrategia y visión · Personas y equipo ·
Procesos y delivery · Relaciones y organización · Técnico · Arquitectura ·
Producto y negocio · Crecimiento propio.

## Estructura

```
src/
  data/       roles.js · items.js · org.js
  lib/        firebase.js · auth.js · firestore.js · scoring.js
  components/  auth-button.js · role-questionnaire.js · role-result.js · admin-dashboard.js
  client/     home.js · admin.js · login.js · layout.js   (glue de cliente)
  layouts/    Base.astro (global) · RoleMirror.astro (herramienta)
  pages/
    index.astro                       → /          landing del framework
    login.astro                       → /login     login global
    tools/role-mirror/index.astro     → /tools/role-mirror        cuestionario
    tools/role-mirror/admin/index.astro → /tools/role-mirror/admin  panel admin
firestore.rules
```

> **Estructura como framework.** Role Mirror es una herramienta servida bajo
> `/tools/role-mirror`. La raíz `/` es la landing del framework (lista de
> herramientas) y `/login` es el login global compartido. Para añadir otra
> herramienta, crea `src/pages/tools/<otra>/` y, si quieres, su propio layout
> análogo a `RoleMirror.astro`.

> **Nota de arquitectura.** Firebase se inicializa en `src/lib/firebase.js` y
> **solo se importa desde scripts de cliente** (`src/client/*`), nunca desde el
> frontmatter de Astro. Los componentes Lit reciben los datos del dominio como
> **propiedades JS** desde esos scripts (no con `define:vars`). El cálculo de
> perfil (`src/lib/scoring.js`) es JS puro sin DOM ni Firebase.

## Puesta en marcha

### 1. Requisitos

- Node.js 20+ y `pnpm`.

### 2. Crear el proyecto Firebase

1. En [Firebase Console](https://console.firebase.google.com/) crea un proyecto.
2. **Authentication → Sign-in method**: habilita **Google**.
3. **Firestore Database**: créala (modo producción).
4. **Project settings → Your apps → Web (`</>`)**: registra una app web y copia
   la configuración (`apiKey`, `authDomain`, …).
5. **Authentication → Settings → Authorized domains**: añade `localhost` y tu
   dominio de despliegue.

### 3. Variables de entorno

Copia `.env.example` a `.env` y rellena con la config de tu app web:

```bash
cp .env.example .env
```

```dotenv
PUBLIC_FIREBASE_API_KEY=...
PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto
PUBLIC_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
PUBLIC_FIREBASE_APP_ID=...
```

Todas llevan prefijo `PUBLIC_` para ser accesibles en cliente. `.env` está en
`.gitignore`: **nunca** lo subas.

### 4. Instalar y arrancar

```bash
pnpm install
pnpm dev      # http://localhost:4321
```

Otros scripts:

```bash
pnpm build    # genera el sitio estático en dist/
pnpm preview  # sirve dist/ localmente
pnpm check    # astro check (diagnóstico de tipos vía JSDoc)
```

### 5. Reglas de seguridad de Firestore

Despliega `firestore.rules` (requiere [Firebase CLI](https://firebase.google.com/docs/cli)):

```bash
firebase deploy --only firestore:rules
```

Resumen de las reglas:

- `/users/{uid}/**` — lectura/escritura solo del propio `uid` (un admin puede
  leer para el panel).
- `/admins/**` — lectura para autenticados; escritura solo para admins.
- `/config/org` — lectura para autenticados; escritura solo para admins.

### 6. Administradores

El rol admin se gestiona en `/admins/{uid}` y **solo se concede server-side**
(no hay ningún mecanismo cliente para auto-concederse admin: sería un agujero de
seguridad). Opciones:

- **Primer admin**: inicia sesión una vez con Google (para existir en Auth) y
  ejecuta `pnpm seed --admin=tu-email@dominio.com` (Admin SDK, omite las reglas).
- **Nuevos admins**: un admin existente los da de alta con la Cloud Function
  `grantAdmin` (custom claim + `/admins/{uid}`), o de nuevo con `pnpm seed`.

Las reglas de Firestore solo permiten escribir en `/admins` a un admin ya
existente; el alta inicial se hace con el Admin SDK, que omite las reglas.

## Cómo funciona el cálculo

Para cada rol: `Σ (respuesta_normalizada × peso_del_rol_en_el_ítem)` dividido
entre la suma máxima posible para ese rol, ×100 = **% de afinidad**. Solo se
cuentan los ítems **visibles** según las respuestas (ramificación). El resultado
muestra el rol dominante, las barras de afinidad ordenadas, el mapa por
dimensión (radar) y la **brecha** frente a un rol objetivo. La configuración de
fase de la organización (`/config/org`) ajusta los pesos por rol.

## Despliegue (proyecto `grebla-app`)

El sitio está en producción en **https://grebla-app.web.app** (Firebase Hosting).

Config local en `firebase.json` / `.firebaserc`. Comandos:

```bash
# Reglas de Firestore
firebase deploy --only firestore:rules

# Hosting (sirve dist/ — ejecuta antes pnpm build)
pnpm build && firebase deploy --only hosting

# Cloud Functions (requiere plan Blaze) — callable grantAdmin en europe-west1
npm install --prefix functions
firebase deploy --only functions

# Seed de datos: crea /config/org y (opcional) marca admin por email
pnpm seed --admin=tu-email@dominio.com
```

> Las variables `PUBLIC_FIREBASE_*` viven en `.env` (gitignored). En un proveedor
> de build externo, configúralas en su entorno. La service account del Admin SDK
> (`*firebase-adminsdk*.json`) también está gitignored: nunca se versiona.

### Primer administrador

1. Entra una vez en **/login** con tu cuenta Google (te crea en Auth).
2. Ejecuta `pnpm seed --admin=tu-email@dominio.com` (Admin SDK). No hay claim de
   admin desde la UI.

También se puede usar el sitio estático en Netlify, Vercel (static) o GitHub
Pages configurando las variables `PUBLIC_FIREBASE_*` en el build.
