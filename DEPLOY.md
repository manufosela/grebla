# Despliegue de GREBLA (dos instancias)

GREBLA se despliega en **dos instancias Firebase independientes**, cada una con su
propia cuenta:

| Instancia | Proyecto Firebase | Alias `.firebaserc` | Build | Cuenta |
|-----------|-------------------|---------------------|-------|--------|
| **Demo** (open-source) | `grebla-app` | `demo` (y `default`) | `npm run build` | cuenta personal (la de por defecto en `firebase login`) |
| **Producción** (tribbu) | `grebla-tribbu` | `tribbu` | `npm run build:tribbu` (usa `.env.tribbu`, gitignored) | cuenta de tribbu, vía `--account` |

> El `target` que reciben los scripts (`publish-version.mjs`, seeds, migraciones)
> es **`app`** para la demo y **`tribbu`** para producción. Determina qué clave de
> servicio se usa (`~/.secrets/firebase/grebla-<target>-sa.json`).

## Regla de oro: build → deploy hosting → publish-version, en ese orden

`scripts/publish-version.mjs` escribe `/config/appVersion` con el hash de git que
el build acaba de estampar en el service worker. El cliente compara su versión con
`/config/appVersion`; **si no coinciden, muestra el aviso de recargar**.

Por eso:

1. **Siempre** `build` → `deploy hosting` → `publish-version` **juntos y en orden**.
2. **Nunca** ejecutar `publish-version` si el `deploy hosting` **no** terminó con
   éxito. Si el deploy falla a mitad (p.ej. las Cloud Functions fallan por un
   secret **antes** de llegar al hosting), `publish-version` dejaría
   `appVersion` apuntando a un hash que el hosting **no** sirve → el cliente pide
   recargar en bucle. Arreglo: redeploy del hosting con el `HEAD` actual y
   `publish-version` de nuevo, para que ambos apunten al mismo hash.

## Demo (`grebla-app`)

```bash
npm run build
firebase deploy --only hosting -P demo
node scripts/publish-version.mjs app
```

## Producción (`grebla-tribbu`)

Requiere la cuenta de tribbu en **todos** los comandos de Firebase (`--account`):

```bash
npm run build:tribbu
firebase deploy --only hosting -P tribbu --account <cuenta-tribbu>
node scripts/publish-version.mjs tribbu
```

## Cloud Functions

```bash
# Demo
firebase deploy --only functions:<nombre> -P demo
# Producción
firebase deploy --only functions:<nombre> -P tribbu --account <cuenta-tribbu>
```

El deploy **analiza todo el codebase de functions**: cualquier secret referenciado
(`defineSecret`) debe existir en esa instancia o el deploy falla en el análisis,
**antes** de desplegar nada. Secrets usados hoy: `GMAIL_SA_KEY`, `PORTAL_SA_KEY`,
`RESEND_API_KEY`. En la demo (y en tribbu hasta que se active Resend) van con un
**placeholder** para no bloquear el deploy:

```bash
printf 'placeholder' | firebase functions:secrets:set <SECRET> --project <proyecto> [--account <cuenta-tribbu>] --data-file -
```

Una Cloud Function que usa un secret debe declararse **después** de su
`defineSecret` (si no, TDZ y «codebase could not be analyzed»). Verifícalo con:

```bash
cd functions && node --input-type=module -e "import('./index.js').then(()=>console.log('ok'))"
```

## Reglas de Firestore

```bash
firebase deploy --only firestore:rules -P demo
firebase deploy --only firestore:rules -P tribbu --account <cuenta-tribbu>
```

## Mergear PRs (GitHub)

Antes de `gh pr merge`, cambiar a la cuenta de GitHub correcta:

```bash
gh auth switch --user manufosela
```

## Identidad antes de cada deploy (obligatorio)

- `firebase login:list` — confirmar la cuenta activa; para tribbu, usar `--account`
  en cada comando (no basta con la cuenta por defecto).
- `git config user.email` — que sea la esperada para el commit.
- **Nunca** desplegar sin que el usuario lo pida explícitamente.
