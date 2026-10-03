/**
 * VENDORIZADO junto a notionPeople.js (RMR-TSK-0620): copia de
 * `tools/organigrama/tests/helpers/notion.js` del portal. Páginas de Notion
 * sintéticas, con la misma forma que devuelve la API del Directorio.
 */

const select = (name) => ({ select: name ? { name } : null });

/**
 * @param {string} id id de página con guiones (Notion los devuelve así)
 * @param {string} name título (vacío = página sin nombre)
 * @param {object} [extra] role, teams[], department, type, level, leadership, founder, email, slackId
 * @param {string} [status] valor de la propiedad Status
 * @param {string|null} [managerId] id (con guiones) de la relación Manager
 */
export const notionPage = (id, name, extra = {}, status = "Activo", managerId = null) => ({
  id,
  properties: {
    Name: { title: name ? [{ plain_text: name }] : [] },
    Role: select(extra.role ?? "Dev"),
    Team: { multi_select: (extra.teams ?? ["Tech"]).map((n) => ({ name: n })) },
    Department: select(extra.department ?? "Product"),
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
