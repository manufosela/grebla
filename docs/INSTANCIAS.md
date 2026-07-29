# GREBLA — instancias y despliegue

GREBLA es una base de código open-source que se despliega a **una instancia Firebase por
organización**. Cada instancia = un proyecto Firebase + su `.env` + sus secrets + sus datos.

| Alias (`.firebaserc`) | Proyecto Firebase | Rol |
| --- | --- | --- |
| `default` / `demo` | `grebla-app` | Demo / desarrollo (cuenta personal, open-source) |
| `tribbu` | `grebla-tribbu` | **Producción de tribbu** |

`default` apunta al **demo** a propósito: así un `firebase deploy` sin alias nunca toca
producción por accidente. Para producción hay que pedir `tribbu` explícitamente.

## Configuración de una instancia (config del cliente)

La config de Firebase del navegador se lee de variables `PUBLIC_FIREBASE_*` (ver
`src/lib/firebase.js`). Cada instancia tiene su archivo de entorno (gitignored):

- Demo: `.env` (ya existente).
- Tribbu: **`.env.tribbu`** — créalo con los datos del proyecto `grebla-tribbu`
  (Consola Firebase → Configuración del proyecto → Tus apps → SDK config):

```
PUBLIC_FIREBASE_API_KEY=...
PUBLIC_FIREBASE_AUTH_DOMAIN=grebla-tribbu.firebaseapp.com
PUBLIC_FIREBASE_PROJECT_ID=grebla-tribbu
PUBLIC_FIREBASE_STORAGE_BUCKET=grebla-tribbu.appspot.com
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
PUBLIC_FIREBASE_APP_ID=...
```

`npm run build:tribbu` compila con `--mode tribbu`, que carga `.env.tribbu`.

## Desplegar a tribbu

No encadenar en un solo comando (revisar entre pasos). Con una cuenta con permisos en
`grebla-tribbu`:

```bash
firebase use tribbu
npm run build:tribbu
firebase deploy --only hosting,functions,firestore   # ajusta el --only según el cambio
node scripts/publish-version.mjs                      # ⚠ ver nota
firebase use default                                  # vuelve al demo
```

> ⚠ **publish-version**: usa la service account `*firebase-adminsdk*.json` de la raíz del
> repo. Para publicar la versión en tribbu, esa SA debe ser la de `grebla-tribbu` (descárgala
> de la consola y colócala en la raíz; está gitignored). Si no, se publicará en el proyecto
> equivocado.

---

# Migración inicial grebla-app → grebla-tribbu

Orden recomendado. Requiere una cuenta con permisos en **ambos** proyectos.

## 1. Crear el proyecto (manual, consola Firebase)

- Crear `grebla-tribbu` en la organización de tribbu, con plan **Blaze** (Functions lo exige).
- Habilitar: **Firestore**, **Authentication** (proveedor Google), **Functions**, **Hosting**.
- Registrar una app web y volcar su config en `.env.tribbu` (ver arriba).

## 2. Secrets (recrear en tribbu)

Los secrets son por-proyecto. Recréalos:

```bash
firebase functions:secrets:set SURVEY_SALT      --project grebla-tribbu   # ⚠ MISMO valor que grebla-app
firebase functions:secrets:set ANTHROPIC_API_KEY --project grebla-tribbu
firebase functions:secrets:set DORA_GITHUB_TOKEN --project grebla-tribbu
firebase functions:secrets:set LINEAR_API_KEY    --project grebla-tribbu
# GMAIL_SA_KEY se añade en la Fase 3 (envío de correos)
```

> ⚠ **`SURVEY_SALT` debe ser IDÉNTICO** al de grebla-app: los tokens de encuesta y los
> `answerId` son HMAC con ese salt; si cambia, los enlaces ya repartidos dejan de validar.
> Para copiar el valor sin exponerlo:
> ```bash
> gcloud secrets versions access latest --secret=SURVEY_SALT --project=grebla-app \
>   | firebase functions:secrets:set SURVEY_SALT --project grebla-tribbu --data-file=-
> ```

## 3. Migrar Auth (⚠ conservando los UIDs)

GREBLA indexa casi todo por `uid` (`/admins/{uid}`, `/leaders/{uid}`, `/supermanagers`,
`/surveyAdmins`, y el vínculo persona↔uid). **Hay que conservar los uids** o se descuadra
todo lo migrado. Con Google Sign-In los uids se conservan al importar:

```bash
firebase auth:export users.json --project grebla-app
firebase auth:import users.json --project grebla-tribbu   # conserva uid y providerId google.com
```

## 4. Migrar Firestore

```bash
# Export de grebla-app a un bucket GCS del propio proyecto
gcloud firestore export gs://grebla-app.appspot.com/mig-tribbu --project grebla-app

# Copiar el export a un bucket de grebla-tribbu (el import lee de un bucket del MISMO proyecto)
gsutil -m cp -r gs://grebla-app.appspot.com/mig-tribbu gs://grebla-tribbu.appspot.com/

# Import en grebla-tribbu
gcloud firestore import gs://grebla-tribbu.appspot.com/mig-tribbu --project grebla-tribbu
```

## 5. Auth: dominios y superadmin

- En `grebla-tribbu` → Authentication → Settings → **dominios autorizados**: añade el hosting
  (`grebla-tribbu.web.app`) y el dominio custom si lo hay.
- El `/admins/{uid}` migrado ya deja al superadmin configurado (por eso el paso 3 va antes).

## 6. Dominio (opcional)

Configurar un dominio custom (p. ej. `grebla.tribbuapp.com`) en Hosting de `grebla-tribbu`.

## 7. Fase 3 — correo (se monta sobre tribbu)

La cuenta de servicio de envío, la delegación de dominio y la Gmail API van en **grebla-tribbu**
(no en el personal), porque el dominio emisor es `tribbuapp.com`. Ver la checklist de la Fase 3.
