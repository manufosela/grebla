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

**`SURVEY_SALT` debe llevar el MISMO valor que grebla-app** (si cambia, los enlaces ya enviados
dejan de valer). Ojo: `grebla-app` es tu cuenta personal y `grebla-tribbu` la de tribbu, así que
suele hacer falta cambiar de cuenta entre leer y escribir.

- **Si una misma cuenta tiene acceso a los dos proyectos**, cópialo de un tirón:
  ```bash
  gcloud secrets versions access latest --secret=SURVEY_SALT --project=grebla-app \
    | firebase functions:secrets:set SURVEY_SALT --project grebla-tribbu --data-file=-
  ```
- **Si son cuentas distintas**, usa un fichero temporal (nunca imprimas el valor en pantalla):
  ```bash
  SALT_FILE=$(mktemp)                    # fichero temporal con permisos 600
  # (1) con la cuenta de grebla-app — vuelca el valor al fichero (sin mostrarlo):
  gcloud secrets versions access latest --secret=SURVEY_SALT --project=grebla-app > "$SALT_FILE"
  # (2) cambia a la cuenta de tribbu y súbelo desde el fichero:
  firebase functions:secrets:set SURVEY_SALT --project grebla-tribbu --data-file="$SALT_FILE"
  rm -f "$SALT_FILE"                     # bórralo siempre al terminar
  ```

El resto de secrets, ya con la cuenta de tribbu:
```bash
firebase functions:secrets:set ANTHROPIC_API_KEY --project grebla-tribbu
firebase functions:secrets:set DORA_GITHUB_TOKEN --project grebla-tribbu
firebase functions:secrets:set LINEAR_API_KEY    --project grebla-tribbu
```

## 6. Migrar los usuarios (⚠ conservando los UIDs)
```bash
firebase auth:export users.json --project grebla-app
firebase auth:import users.json --project grebla-tribbu
```

## 7. Migrar los datos (Firestore)
```bash
gcloud firestore export gs://grebla-app.appspot.com/mig --project grebla-app
gsutil -m cp -r gs://grebla-app.appspot.com/mig gs://grebla-tribbu.appspot.com/
gcloud firestore import gs://grebla-tribbu.appspot.com/mig --project grebla-tribbu
```

---

Cuando tengas hechos los pasos **1–4**, pásame el **project id** y la **config web**: dejo el
repo listo (`.env.tribbu`, alias) y desplegamos. Los pasos 5–7 (secrets y migración) los
hacemos juntos después, contigo ejecutando los comandos.
