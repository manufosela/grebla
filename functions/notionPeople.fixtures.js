/**
 * VENDORIZADO junto a notionPeople.js (RMR-TSK-0620): copia de
 * `tools/organigrama/tests/helpers/notion.js` del portal (62dc768). Páginas de Notion
 * sintéticas, con la misma forma que devuelve la API del Directorio.
 */

const select = (name) => ({ select: name ? { name } : null });

/**
 * Department y Team llegan como relation a Áreas y Subáreas, y el nombre vive
 * en la otra DB. El id se deriva del nombre para que las páginas falsas y el
 * mapa que las resuelve (`relationNames`) no puedan quedarse descolgados.
 */
const idDe = (nombre) => `rel-${nombre.toLowerCase().replaceAll(/[^a-z0-9]+/g, "")}`;
const relacion = (nombres) => ({ type: "relation", relation: nombres.map((n) => ({ id: idDe(n) })) });
const porId = (ids) => ({ type: "relation", relation: ids.map((id) => ({ id })) });

/**
 * @param {string} id id de página con guiones (Notion los devuelve así)
 * @param {string} name título (vacío = página sin nombre)
 * @param {object} [extra] role, teams[], department, type, level, leadership, founder, email, slackId.
 *   `teamIds` y `departmentIds` ponen ids a pelo, para los casos que no quieren un nombre detrás.
 * @param {string} [status] valor de la propiedad Status
 * @param {string|null} [managerId] id (con guiones) de la relación Manager
 */
export const notionPage = (id, name, extra = {}, status = "Activo", managerId = null) => ({
  id,
  properties: {
    Name: { title: name ? [{ plain_text: name }] : [] },
    Role: select(extra.role ?? "Dev"),
    Team: extra.teamIds ? porId(extra.teamIds) : relacion(extra.teams ?? ["Tech"]),
    Department: extra.departmentIds ? porId(extra.departmentIds) : relacion([extra.department ?? "Product"]),
    Type: select(extra.type ?? null),
    Level: select(extra.level ?? "Individual Contributor"),
    Leadership: select(extra.leadership ?? "No"),
    Founder: select(extra.founder ?? null),
    Status: select(status),
    Manager: { relation: managerId ? [{ id: managerId }] : [] },
    Email: { email: extra.email ?? null },
    "Slack ID": { rich_text: extra.slackId ? [{ plain_text: extra.slackId }] : [] },
  },
});

/** Todos los nombres de Área o Subárea que usan las páginas falsas de aquí. */
const NOMBRES_DE_RELACION = [
  "Product",
  "Executive Office & Public Affairs",
  "Tech",
  "Data",
  "Executive Office",
  "Legal",
];

/** El mapa id→título que resuelve las relaciones de `notionPage`. */
export const relationNames = () =>
  new Map(NOMBRES_DE_RELACION.map((n) => [idDe(n).replaceAll("-", ""), n]));

/** Una fila de Departments (Áreas) o Teams (Subáreas): su nombre es el título. */
export const notionTitlePage = (id, tituloProp, nombre) => ({
  id,
  properties: {
    Description: { type: "rich_text", rich_text: [] },
    [tituloProp]: { type: "title", title: nombre ? [{ plain_text: nombre }] : [] },
  },
});

/** Las filas de Áreas o Subáreas que hacen falta para resolver `samplePages`. */
export const relationPages = (tituloProp) =>
  NOMBRES_DE_RELACION.map((n) => notionTitlePage(idDe(n), tituloProp, n));

/** Seis páginas que cubren los casos de filtrado y saneado de managerId. */
export const samplePages = () => [
  notionPage("aaaa-1111", "Ceo Root", {
    role: "CEO",
    level: "C-level",
    leadership: "Yes",
    founder: "Yes",
    teams: ["Executive Office"],
    department: "Executive Office & Public Affairs",
  }),
  notionPage("bbbb-2222", "Dev Uno", { teams: ["Tech", "Data"] }, "Activo", "aaaa-1111"),
  notionPage("cccc-3333", "Baja Persona", {}, "Baja", "aaaa-1111"),
  notionPage("dddd-4444", "Inactiva Persona", {}, "Inactive", "cccc-3333"),
  notionPage("eeee-5555", "", {}, "Activo", "aaaa-1111"),
  notionPage("ffff-6666", "Huerfano", { type: "Externo" }, "Activo", "zzzz-0000"),
];

/** Respuesta de fetch simulada. */
export const fakeResponse = ({ ok = true, status = 200, json = {}, text = "" } = {}) => ({
  ok,
  status,
  json: async () => json,
  text: async () => text,
});
