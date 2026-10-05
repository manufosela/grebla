# Conectar GREBLA a un directorio de Notion

GREBLA puede tomar el **censo de personas** de una base de datos de Notion:
quién trabaja en la organización, en qué departamento, con qué rol y quién es
su manager. Con Notion conectado, esos datos **solo se editan en Notion** y
GREBLA añade lo suyo (carrera, gremios, permisos, O2O…).

**Sin Notion todo sigue siendo manual.** Una instancia sin conectar (como la
demo) da de alta a las personas, les asigna departamento y manager y las
transfiere desde la propia aplicación, igual que siempre. Conectar Notion es
opcional y se hace por instancia.

## 1. La base de datos

Una base de Notion con **una página por persona** y estas propiedades. Los
nombres tienen que ser **exactamente** estos (mayúsculas incluidas):

| Propiedad | Tipo en Notion | Para qué la usa GREBLA | ¿Obligatoria? |
|---|---|---|---|
| `Name` | Título | Nombre de la persona | Sí |
| `Email` | Email | **La clave**: casa la página con su ficha y con su cuenta al entrar. Sin email, la persona no se importa | Sí |
| `Department` | Select | Departamento. Cada valor tiene que existir como rama en Admin › Organigrama › Ramas, **con el mismo nombre** | Sí |
| `Manager` | Relación (a la misma base) | Quién es su manager. De aquí sale quién ve la ficha de quién | Sí |
| `Status` | Select: `Active`, `Pending Onboarding`, `Pending Offboarding`, `Inactive` | Las `Inactive` no se importan | Sí |
| `Level` | Select: `C-level`, `Head of`, `Manager`, `Lead`, `Team lead`, `IC` | Su capa en el organigrama. No es su nivel de carrera: ese lo decide su manager en GREBLA | Sí |
| `Role` | Select | El puesto que se enseña (p. ej. «Backend Engineer») | Recomendada |
| `Team` | Multi-select | Equipo dentro del departamento. Se enseña tal cual; se usa el primero | Opcional |
| `Type` | Select: `Employee`, `Contractor` | `Contractor` = persona externa | Opcional |
| `Join Date` | Fecha | Fecha de alta | Opcional |

Otras propiedades de la base (p. ej. `Slack ID`) no estorban: se ignoran.

Los **gremios** no salen de Notion: son de GREBLA y solo los tiene Tech.

## 2. Conectarla

1. En Notion, crea una **integración interna** (Settings › Connections ›
   Develop or manage integrations) con permiso de lectura, y copia su token.
2. Comparte la base de datos con esa integración (`…` › Connections).
3. Sube el token como secret del proyecto de Firebase de la instancia:
   `firebase --account <cuenta> functions:secrets:set NOTION_TOKEN --project <proyecto>`
4. En el documento `/config/org` de Firestore, pon:
   - `notionDatabaseId`: el id de la base (los 32 caracteres de su URL).
   - `notionSync: true`: desde ese momento, los campos que vienen de Notion
     dejan de editarse en GREBLA (las reglas de Firestore lo impiden).
5. Despliega la función `notionSync` y, en **Admin › Notion**, pulsa
   **Simular**: el informe enseña qué cambiaría, persona a persona. Si está
   bien, **Aplicar**.

## Qué hace la sincronización

- Casa cada página con su ficha por email (el de la ficha, el de la invitación
  o el de su cuenta). Quien está en Notion y no en GREBLA queda **pre-invitado**:
  su cuenta se vincula sola la primera vez que entra con ese email.
- **Nunca da de baja ni borra a nadie.** Quien está en GREBLA y no en Notion
  sale en el informe, y la baja la da una persona.
- **Para el lote entero** si dos páginas tienen el mismo email o si hay un
  ciclo de managers.
- Si una ficha sin casar **se llama casi igual** que una página nueva, no crea
  otra: lo avisa como posible duplicado (suele ser un email mal escrito).
