# GREBLA MVP — Diseño previo (para validación)

> Entregable de la sección 8 del PRD. **No es código de aplicación.** Cubre:
> (1) modelo de datos, (2) puertos, (3) arquitectura/carpetas, (4) lista de huecos.
> Pendiente de validación antes de implementar.

## 0. Principios (mapa de R1–R9 → decisiones)

| Regla | Cómo se respeta en el diseño |
|------|------------------------------|
| R1 — 4 dimensiones independientes | Cada dimensión es su propia subcolección de lecturas. **No** existe entidad ni campo "nivel global de persona". Ningún servicio promedia entre dimensiones. |
| R2 — nivel = estado con fecha | Cada lectura es un documento con `date`; nunca se sobrescribe un "nivel actual": el actual = última lectura. Vistas = serie temporal. |
| R3 — prohibida comparación entre personas | No hay endpoints/servicios que ordenen o puntúen personas. Las vistas de equipo son de **cobertura/riesgo agregados**. |
| R4 — el nivel no es el tema de la conversación | La entidad `Conversation` gira sobre `notes`/comportamientos; el vínculo a dimensiones es opcional y secundario. |
| R5 — emocional/bienestar sensible y separado | `supportNotes` es una subcolección aparte, **sin nivel**, marcada como no diagnóstica, excluida de cualquier export y con frontera de privacidad. Distinta de la *dimensión* Emocional (que sí tiene nivel). |
| R6 — separación agregado/individual | Los agregados se computan en `domain/services` y se materializan en `aggregates/` (exportable). Los niveles individuales viven bajo `people/{id}/...` y **nunca** entran en agregados exportables. Frontera estructural en datos y servicios. |
| R7 — cadencia configurable | `config/settings.cadence`; la app solo computa **avisos de silencio**, no impone frecuencia. |
| R8 — sesgo del observador | Los avisos de silencio se etiquetan también como posible sesgo de observabilidad. (Catálogo completo → fase 2.) |
| R9 — radares sin comparar personas | Solo dos cálculos: cobertura de equipo por dimensión (agregado) y perfil Belbin individual. No se implementa "radar de las 4 dimensiones" ni superposición de personas. |

## 1. Modelo de datos

### 1.1 Entidades (dominio, agnóstico de Firebase)

- **Owner (líder)** — el único usuario. Namespace raíz de todos los datos.
- **Person** — miembro del equipo: `name`, `teamRole` (texto libre, p. ej. "Backend"), `startDate`, `active`.
- **Lecturas por dimensión** (cuatro tipos, independientes, con histórico):
  - **SeniorityReading** — `{ level: 1..7, toNext?: boolean, date, note? }` — `toNext:true` representa el **tránsito** "entre este nivel y el siguiente" (estado válido, no se fuerza exactitud). Para la línea temporal: valor ploteado = `level + (toNext ? 0.5 : 0)`.
  - **EmotionalReading** — `{ level: 1..7, toNext?: boolean, date, note? }` (estado profesional; sensible pero es dimensión, admite tránsito).
  - **KnowledgeReading** — `{ areaId, level: 1..7, toNext?: boolean, date, note? }` (una por área cubierta).
  - **ContributionReading** — `{ roles: { [belbinSigla]: 'primary'|'secondary' }, date, note? }` — perfil Belbin: cada rol que la persona ejerce, marcado **primario** o **secundario** (no es una escala numérica; ver fórmula de cobertura en §6).
- **SupportNote** (R5) — `{ text, date }` **sin nivel**, no diagnóstica, privacidad diferenciada.
- **Conversation** (R4/Alcance 6) — `{ type: 'o2o'|'catchup', date, notes, audio?: FileRef, transcription?, summary?, linkedDimensions?: string[] }`.
- **Area** — área técnica del catálogo de conocimiento (la define el líder).
- **Catalog** — niveles (7) y roles Belbin (9), configurables (seed).
- **Settings** — cadencia (R7), umbral de bus factor, flags de features (ficheros on/off).
- **MotivatorsProfile** (fuera de MVP, solo enganche) — referencia reservada por persona; no se implementa.

### 1.2 Relaciones

`Owner 1—N Person`; `Person 1—N {Seniority|Emotional|Knowledge|Contribution}Reading`; `Person 1—N SupportNote`; `Person 1—N Conversation`; `Owner 1—N Area`; `Conversation N—N Dimension` (vínculo opcional). Agregados derivados de las lecturas, materializados aparte (R6).

### 1.3 Colecciones Firestore (implementación por defecto del puerto)

Namespace por `ownerId` (monousuario hoy, multi-tenant sin remodelar):

```
/owners/{ownerId}                                   # perfil del líder
/owners/{ownerId}/config/settings                   # cadencia, umbral busFactor, features
/owners/{ownerId}/catalog/levels                    # 7 niveles {order,name}
/owners/{ownerId}/catalog/belbinRoles               # 9 roles {id,name}
/owners/{ownerId}/areas/{areaId}                    # áreas de conocimiento
/owners/{ownerId}/people/{personId}                 # persona
        .../people/{personId}/seniority/{readingId}    # histórico
        .../people/{personId}/emotional/{readingId}    # histórico
        .../people/{personId}/knowledge/{readingId}    # histórico (incluye areaId)
        .../people/{personId}/contribution/{readingId} # histórico (perfil Belbin)
        .../people/{personId}/supportNotes/{noteId}    # R5: sensible, sin nivel
        .../people/{personId}/conversations/{convId}   # O2O/catch-up
        .../people/{personId}/motivators/{docId}       # enganche futuro (no se usa)
/owners/{ownerId}/aggregates/{snapshotId}           # R6: cobertura, busFactor, salud (exportable)
```

**Separación R6:** `aggregates/` se computa desde las lecturas pero **no contiene** niveles por persona identificables (solo conteos, cobertura, distribuciones). El export solo lee `aggregates/`. Los documentos bajo `people/{id}` nunca se exportan.

**Enganche IA (sección 5):** `Conversation` ya tiene `transcription`/`summary`/`audio`; en MVP se rellenan a mano o se suben hechos. La lógica IA (fase 2) solo escribirá esos mismos campos.

### 1.4 Borrador de reglas de seguridad (Firestore)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function isOwner(ownerId) {
      return request.auth != null && request.auth.uid == ownerId;
    }
    // Todo el árbol del owner: solo su dueño.
    match /owners/{ownerId}/{document=**} {
      allow read, write: if isOwner(ownerId);
    }
    match /{document=**} { allow read, write: if false; }
  }
}
```

> R5/R6 en MVP monousuario: el dueño accede a todo lo suyo, así que la frontera
> de `supportNotes` y de agregado/individual se garantiza en **servicios/export**
> (los agregados exportables nunca incluyen lecturas individuales; las support
> notes nunca se exportan ni se mezclan con dimensiones). Si en el futuro hay
> roles (p. ej. RRHH con acceso a agregados pero no a individuales), la frontera
> ya es estructural y se traduce a reglas por colección.

## 2. Puertos (hexagonal / ports & adapters)

El **dominio no conoce Firebase**. Define interfaces; la infraestructura las implementa; un *composition root* inyecta la implementación según configuración.

### 2.1 Puerto de persistencia

Un repositorio por agregado (interfaces en `domain/ports/persistence.d.ts`):

```js
/** @typedef {{ id:string, name:string, teamRole:string, startDate:string, active:boolean }} Person */

/**
 * @typedef {Object} PeopleRepository
 * @property {() => Promise<Person[]>} list
 * @property {(id:string) => Promise<Person|null>} getById
 * @property {(input:Omit<Person,'id'>) => Promise<string>} create
 * @property {(id:string, patch:Partial<Person>) => Promise<void>} update
 * @property {(id:string) => Promise<void>} deactivate
 */

/**
 * @typedef {Object} ReadingRepository  // genérico por dimensión
 * @property {(personId:string, payload:object) => Promise<string>} add
 * @property {(personId:string) => Promise<object[]>} listByPerson   // histórico, asc por date
 * @property {(personId:string) => Promise<object|null>} latest      // estado actual
 */

// ConversationRepository, SupportNoteRepository, AreaRepository,
// ConfigRepository, CatalogRepository, AggregateRepository … (misma forma)
```

Implementación por defecto: `infrastructure/firestore/*` (un adapter por repo). Tests y prototipos: `infrastructure/memory/*` (in-memory) con las **mismas** interfaces. Cambiar de Firestore a otra BD/API = nuevo adapter, sin tocar dominio ni UI.

### 2.2 Puerto de ficheros (audio/grabaciones) — desactivable

```js
/**
 * @typedef {{ ref:string, url?:string, provider:string }} FileRef
 * @typedef {Object} FileStoragePort
 * @property {boolean} enabled
 * @property {(blob:Blob, meta:object) => Promise<FileRef>} put
 * @property {(ref:string) => Promise<string>} getUrl
 * @property {(ref:string) => Promise<void>} remove
 */
```

Implementaciones:
- `FirebaseStorageAdapter` (`enabled:true`) — sube a Firebase Storage.
- `NullStorageAdapter` (`enabled:false`) — **por defecto desactivable**: no sube; la conversación se guarda sin audio o con una URL externa pegada a mano. La UI degrada (oculta el subir-audio, permite link).
- `Local/S3Adapter` (futuro) — misma interfaz.

Selección por `settings.features.fileStorage` (flag) en el composition root. El dominio solo ve `FileStoragePort`.

### 2.3 Auth

Acoplado a Firebase Auth (decisión del PRD, sin puerto). Aislado en `infrastructure/auth/` para no esparcir el SDK por la UI.

## 3. Arquitectura y estructura de carpetas

```
src/
  domain/
    entities/      Person, *Reading, Conversation, SupportNote, Area …
    values/        Level, BelbinRole, BusFactor, Cadence …
    services/      busFactor.js, roleCoverage.js, teamHealth.js, silenceAlerts.js  (PURO, sin IO)
    ports/         persistence.d.ts, fileStorage.d.ts
  application/
    usecases/      addReading, registerConversation, getPersonTimeline,
                   getTeamCoverage, getBusFactor, getSilenceAlerts, exportAggregate …
  infrastructure/
    firestore/     adapters de repos (implementan los puertos)
    storage/       firebase.js, null.js (+ local/s3 futuro)
    auth/          firebase auth
  composition/     container.js  (lee config → instancia adapters → inyecta en usecases)
  ui/              componentes Lit 3 (PWA): vistas, router, app-shell
  config/          flags, constantes
tests/             unit de domain/services y usecases (con adapters in-memory)  ← TDD
public/            manifest PWA, service worker, iconos
```

- **Flujo de dependencias:** `ui → application → domain ← infrastructure` (las flechas nunca apuntan del dominio a Firebase). El `composition` es el único sitio que conoce a la vez puertos e implementaciones.
- **Lógica de negocio testeable** (bus factor, cobertura, salud, silencios) vive en `domain/services` como funciones puras → TDD directo sin Firebase.
- **PWA:** app-shell instalable + service worker; persistencia offline de Firestore opcional (hueco H11).

## 4. Lista de huecos (con opción por defecto a validar)

> El PRD pide marcar lo no definido y proponer un default, no inventar en silencio.

- **H1 — GREBLA app vs repo actual (Astro + Role Mirror).** El PRD describe GREBLA como *esta* app monousuario de seguimiento; el repo hoy es un "framework" Astro con Role Mirror. **Default propuesto:** GREBLA = la app del PRD, como **SPA nueva** (ver H2); Role Mirror se conserva como pieza aparte o se archiva. *(Decisión tuya.)*
- **H2 — Stack base: Astro vs SPA Lit+Vite.** El PRD pide Lit 3 + PWA + vanilla JS/JSDoc/.d.ts, sin mencionar Astro. **Default:** SPA con **Vite + Lit + Workbox (PWA)**, que encaja mejor con estado, histórico y offline. *(Ligado a H1.)*
- **H3 — Cuantificación de Contribución (Belbin).** "Categorías, no niveles", pero el radar individual necesita magnitud. **Default:** perfil con valor `0..7` por rol (`0` = no lo ejerce); el radar usa esos valores. Alternativas: primario/secundario/no, o ranking. *(Confirmar.)*
- **H4 — Conocimiento y umbral de bus factor.** **Default:** nivel de dominio `1..7` por (persona, área); **bus factor por área = nº de personas con nivel ≥ umbral**; umbral configurable (propongo ≥ 3). *(Confirmar escala y umbral.)*
- **H5 — Dimensión Emocional vs notas de acompañamiento (R5).** **Default:** son **dos cosas distintas**: la *dimensión* Emocional tiene nivel 1..7; las *support notes* (vida personal/bienestar) no tienen nivel y van aparte. *(Confirmar que es la lectura correcta del PRD.)*
- **H6 — Datos del cliente (BLOQUEANTE para el seed, no para la estructura).** Necesito los **7 nombres de nivel** (con su orden) y los **9 roles de Belbin** (nombres exactos que usáis). No los invento.
- **H7 — Áreas de conocimiento.** **Default:** las crea/edita el líder (CRUD), catálogo inicial vacío. *(Confirmar; ¿quieres un set inicial?)*
- **H8 — Ficheros por defecto ON/OFF.** El PRD: Storage por defecto pero desactivable. **Default propuesto para el MVP:** **OFF** (NullStorageAdapter) por coste; se activa con un flag. *(Confirmar.)*
- **H9 — Cadencia: global o por persona.** **Default:** una cadencia global configurable en MVP; override por persona en fase posterior. *(Confirmar.)*
- **H10 — Señales de "salud cualitativa" del equipo.** **Default:** cobertura de roles Belbin, nº de áreas con bus factor 1, % de personas en silencio, distribución de seniority — todo agregado, sin ordenar personas (R3). *(Confirmar el conjunto.)*
- **H11 — Alcance PWA.** **Default:** instalable + app-shell offline; datos requieren conexión (con persistencia offline de Firestore opcional). *(Confirmar si quieres offline de datos real en MVP.)*

## 5. Qué NO se construye ahora (solo enganche)

- Moving-motivators: solo `people/{id}/motivators` reservado.
- Pipeline IA de conversaciones: campos `transcription`/`summary`/`audio` listos; lógica fuera.
- Catálogo completo de sesgos: solo el aviso de silencio (R8).

## 6. Catálogos confirmados por el cliente

### 6.1 Escala de 7 niveles (orden ascendente, 4 grupos)

Color cálido (bajo) → frío (alto). **Magister** en blanco/plata (aspiracional, "trasciende el espectro"). Se admite **tránsito entre niveles adyacentes** como estado válido (`toNext`), no se fuerza asignación exacta.

| # | Nivel | Color | Grupo | Sentido |
|---|-------|-------|-------|---------|
| 1 | Tiro | 🔴 | G1 · Ejecuta con guía | Empieza; necesita estructura y supervisión |
| 2 | Novicius | 🟠 | G1 · Ejecuta con guía | Gana soltura, autonomía parcial |
| 3 | Peritus | 🟡 | G2 · Ejecuta con autonomía | Autónomo en lo conocido, resuelve sin ayuda |
| 4 | Expertus | 🟢 | G2 · Ejecuta con autonomía | Autónomo y criterioso, empieza a anticipar |
| 5 | Veteranus | 🔵 | G3 · Decide y anticipa | Prevé; referente en su área |
| 6 | Primus | 🟣 | G3 · Decide y anticipa | Multiplica a otros, guía sin jerarquía |
| 7 | Magister | ⚪ | G4 · Transforma | Aspiracional, trasciende el equipo |

Se guarda como dato configurable (`/catalog/levels`: `[{order,name,color,group}]`) para no hardcodear nombres en componentes. Aplica a Seniority, Emocional y al nivel por área de Conocimiento.

### 6.2 Roles de Belbin (9, con sigla y categoría)

| Categoría | Roles (sigla) |
|-----------|---------------|
| Mentales | Cerebro (**PL**), Monitor evaluador (**ME**), Especialista (**SP**) |
| Sociales | Coordinador (**CO**), Investigador de recursos (**RI**), Cohesionador (**TW**) |
| De acción | Impulsor (**SH**), Implementador (**IMP**), Finalizador (**CF**) |

`/catalog/belbinRoles`: `[{sigla,name,category}]`. La sigla es la clave en `ContributionReading.roles`.

### 6.3 Radar de cobertura de equipo (R9a) — fórmula

Para cada rol Belbin, **score de cobertura del equipo** =
`Σ_personas ( 1.0 si lo ejerce como primario  +  0.5 si lo ejerce como secundario )`.

Ese score por rol alimenta el polígono del radar de equipo (9 ejes = 9 roles). Un **valle** señala un gap de cobertura. Es un agregado de equipo (R6); no compara personas (R3). El radar individual (R9b) usa los roles primario/secundario de **una** persona como ejes, para su O2O.

## 7. Decisiones tras tu validación parcial

- **GREBLA es la suite/framework** (no una sola app). **Role Mirror se conserva** como herramienta y se añadirán más. Esta app de seguimiento de equipo es **una herramienta más**, p. ej. bajo `/tools/team` (nombre a confirmar).
- **Stack (recomendación, ver discusión en el chat):** mantener **Astro como shell** del framework (landing `/`, `/login`, `/tools/role-mirror`) y construir la herramienta de seguimiento como una **app Lit embebida** en `/tools/team/*` (mini-SPA con router cliente propio), con el **dominio hexagonal compartido** en `src/domain|application|infrastructure` y **PWA**. Así se cumplen Lit 3 + PWA + hexagonal sin reescribir Role Mirror ni perder el shell del framework.

## 8. Estado de los huecos

| Hueco | Estado |
|------|--------|
| H1 (app vs framework) | **Resuelto**: GREBLA = suite; esta es una herramienta más; Role Mirror se conserva. |
| H2 (stack) | **Propuesta**: shell Astro + tool Lit embebida (PWA) + dominio hexagonal compartido. *(Confirmar.)* |
| H3 (contribución) | **Resuelto**: primario/secundario; cobertura = 1.0/0.5 sumado. |
| H5 (emocional vs notas) | **Resuelto**: dimensión Emocional con nivel ≠ support notes sin nivel. |
| H6 (7 niveles + 9 Belbin) | **Resuelto** (§6). |
| H4 (umbral bus factor) | Pendiente: default ≥ nivel 3 (Peritus). *(Confirmar.)* |
| H7 (áreas conocimiento) | Pendiente: las crea el líder (CRUD), seed vacío. *(Confirmar.)* |
| H8 (ficheros on/off) | Pendiente: default OFF en MVP por coste. *(Confirmar.)* |
| H9 (cadencia) | Pendiente: global en MVP. *(Confirmar.)* |
| H10 (salud cualitativa) | Pendiente: cobertura roles + bus factor 1 + % silencio + distribución seniority. *(Confirmar.)* |
| H11 (PWA offline) | Pendiente: instalable + app-shell; datos online (offline Firestore opcional). *(Confirmar.)* |
