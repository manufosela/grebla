# Alta de la instancia de tribbu — SOLO Firebase / Google Cloud

Todo lo de aquí se hace en la **consola de Firebase / Google Cloud** con una cuenta de
tribbu. Nada toca el repo (de la parte del repo me encargo yo con lo que me pases).

## 1. Crear el proyecto
- Consola Firebase → **Añadir proyecto** → nombre **`grebla-tribbu`**.
- Plan **Blaze** (las Cloud Functions lo exigen).

## 2. Habilitar servicios
- **Firestore** (modo producción).
- **Authentication** → activar proveedor **Google**.
- **Functions**.
- **Hosting**.

## 3. Registrar la app web y pasarme la config
- Configuración del proyecto → *Tus apps* → **Web (`</>`)** → registrar.
- Cópiame el bloque `firebaseConfig` (6 valores: `apiKey`, `authDomain`, `projectId`,
  `storageBucket`, `messagingSenderId`, `appId`). Con eso te doy el `.env.tribbu` listo.

## 4. Dominios autorizados (Auth)
- Authentication → Settings → *Authorized domains* → añade **`grebla-tribbu.web.app`**
  (y el dominio custom si lo hay).

## 5. Secrets (CLI)

> Todos los comandos llevan **`--account <email>`** porque tienes varias cuentas logadas
> (tribbu, personal, OX). Sustituye `CUENTA_TRIBBU` por la que administra `grebla-tribbu`.

Estamos en pruebas y no hay enlaces en uso, así que el **`SURVEY_SALT` es NUEVO** (no se migra):
```bash
openssl rand -hex 32 \
  | firebase functions:secrets:set SURVEY_SALT --project grebla-tribbu --account CUENTA_TRIBBU --data-file=-

firebase functions:secrets:set ANTHROPIC_API_KEY --project grebla-tribbu --account CUENTA_TRIBBU
firebase functions:secrets:set DORA_GITHUB_TOKEN --project grebla-tribbu --account CUENTA_TRIBBU
firebase functions:secrets:set LINEAR_API_KEY    --project grebla-tribbu --account CUENTA_TRIBBU
```

## 6. Migrar los usuarios (conservando los UIDs)
```bash
firebase auth:export users.json --project grebla-app    --account CUENTA_PERSONAL
firebase auth:import users.json --project grebla-tribbu --account CUENTA_TRIBBU
```

## 7. Migrar los datos (Firestore)
> `gsutil` **no admite `--account`**: usa la cuenta ACTIVA de gcloud, que se fija con
> `gcloud config set account` antes de cada tramo.
```bash
# (1) export de grebla-app a su bucket (cuenta personal):
gcloud firestore export gs://grebla-app.appspot.com/mig --project grebla-app --account CUENTA_PERSONAL

# (2) baja el export a local con la cuenta personal y súbelo al de tribbu con la de tribbu.
#     Copiando a "./" (no a otra carpeta) se conserva el nombre "mig" sin anidar:
gcloud config set account CUENTA_PERSONAL
gsutil -m cp -r gs://grebla-app.appspot.com/mig ./          # crea ./mig con el export intacto
gcloud config set account CUENTA_TRIBBU
gsutil -m cp -r ./mig gs://grebla-tribbu.firebasestorage.app/   # queda gs://…/mig con el export intacto
rm -rf ./mig

# (3) import del export exacto en grebla-tribbu (cuenta de tribbu):
gcloud firestore import gs://grebla-tribbu.firebasestorage.app/mig --project grebla-tribbu --account CUENTA_TRIBBU
```
> Verifica el nombre del bucket de `grebla-app` en Storage de la consola: los proyectos
> antiguos usan `.appspot.com`; los nuevos, `.firebasestorage.app`.

> **Atajo si prefieres empezar limpio**: al estar en pruebas, puedes **saltarte los pasos 6 y 7**.
> El proyecto arranca vacío y recreas el superadmin con tu primer login. Menos lío que la
> migración cross-cuenta.

---

Config ya recibida. Los pasos **1–4** están hechos; quedan **5** (secrets) y, si quieres
conservar datos, **6–7** (migración). El `.env.tribbu` y el deploy los preparo yo.
