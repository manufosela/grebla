# GREBLA — instancias (parte del repo)

Una base de código, **una instancia Firebase por organización**. Esto es lo que vive en el
repo. El alta de una instancia en Firebase está aparte, en [`SETUP-TRIBBU.md`](./SETUP-TRIBBU.md).

| Alias (`.firebaserc`) | Proyecto | Rol |
| --- | --- | --- |
| `default` / `demo` | `grebla-app` | Demo / desarrollo (personal, open-source) |
| `tribbu` | `grebla-tribbu` | Producción de tribbu |

- **Config del cliente**: sale de `PUBLIC_FIREBASE_*` (`src/lib/firebase.js`), una por instancia:
  `.env` (demo) y `.env.tribbu` (gitignored). Cada archivo lleva las claves de SU proyecto.
- **Build**: `npm run build` (demo) · `npm run build:tribbu` (carga `.env.tribbu`).
- **Deploy a tribbu**:
  ```bash
  firebase use tribbu
  npm run build:tribbu
  firebase deploy --only hosting,functions,firestore
  node scripts/publish-version.mjs          # con la SA de grebla-tribbu en la raíz
  firebase use default
  ```
- `default` apunta al **demo** a propósito: un `firebase deploy` sin alias nunca toca producción.
