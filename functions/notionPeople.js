/**
 * VENDORIZADO (ADR -P1XxVvQPrufU13Bd4RF, opción C · RMR-TSK-0620): copia literal
 * de `functions/organigrama/notion-people.js` del portal (tribbu-repos-info),
 * tomada el 2026-11-08 (portal 62dc768, PR #535). No editar aquí: si el esquema de Notion cambia, se
 * actualiza en el portal y se vuelve a copiar. `notionPeople.test.js` fija el
 * contrato del mapeo para que la deriva se note. Lo que GREBLA necesita además
 * (Status, Join Date) se lee en notionReconcile.js, no aquí.
 *
 * ── original ──
 * notion-people.js — Notion → personas del organigrama.
 *
 * Persona: { id, name, role, team, multiTeam, department, type, level,
 *            leadership, founder, managerId, email, slackId }
 *
 * email y slackId los consume el importador Notion→/people de GREBLA (email es
 * la clave estable para casar con su personId). La function orgData del portal
 * los omite: el organigrama no los necesita y no se exponen a los logados.
 */

export const NOTION_VERSION = "2022-06-28";
const PAGE_SIZE = 100;

export const stripDashes = (id) => id.replaceAll("-", "");
export const selectName = (p) => p?.select?.name || null;
export const titleText = (p) => (p?.title ? p.title.map((t) => t.plain_text).join("") : "").trim();
export const relIds = (p) => (p?.relation ? p.relation.map((r) => stripDashes(r.id)) : []);
export const emailValue = (p) => p?.email || null;
export const plainText = (p) => {
  const s = p?.rich_text ? p.rich_text.map((t) => t.plain_text).join("").trim() : "";
  return s || null;
};

/** El título de una fila de Áreas o Subáreas, se llame como se llame su columna. */
export const pageTitle = (page) =>
  titleText(Object.values(page?.properties || {}).find((p) => p?.type === "title" || p?.title));

/**
 * Los nombres de Department o Team, que son relation a dos DB propias (Áreas y
 * Subáreas) desde noviembre de 2026.
 *
 * SELECT Y MULTI_SELECT YA NO SE LEEN. Fueron el formato hasta ese cambio, y
 * este lector entendió los dos mientras el portal, GREBLA y BBOARD no tenían
 * desplegada la misma versión; los tres la tienen desde el 2026-11-08. Si una
 * de las dos columnas volviera a ser un select, devolver su nombre sería leer
 * un dato que ya nadie mantiene, y nadie se enteraría.
 *
 * UN ID SIN NOMBRE ES UN ERROR, NO UN null. Es la única manera de enterarse de
 * que la integración no tiene acceso a las DB de destino: sin acceso, Notion
 * devuelve la relation vacía y todo el mundo se queda sin departamento sin que
 * nada falle. Si el id llega y no sabemos su nombre, callar sería afirmar que
 * esa persona no tiene departamento, y es mentira.
 */
export const namesOf = (p, names = new Map()) => {
  if (!p) return [];
  if (!p.relation) {
    throw new Error(
      `Notion: Department y Team se leen como relation, y esta columna llega como ${p.type || "otra cosa"}`
    );
  }
  return p.relation.map((r) => {
    const id = stripDashes(r.id);
    const nombre = names.get(id);
    if (!nombre) throw new Error(`Notion: la relación ${id} no tiene nombre en Áreas ni Subáreas`);
    return nombre;
  });
};

export const dataSourceQueryUrl = (id) => `https://api.notion.com/v1/data_sources/${id}/query`;
export const databaseQueryUrl = (id) => `https://api.notion.com/v1/databases/${id}/query`;

export const notionHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  "Notion-Version": NOTION_VERSION,
  "Content-Type": "application/json",
});

/** Página de Notion → persona (sin filtrar). `names` resuelve las relaciones. */
export const pageToPerson = (page, names) => {
  const P = page.properties;
  const teams = namesOf(P.Team, names);
  return {
    id: stripDashes(page.id),
    name: titleText(P.Name),
    role: selectName(P.Role),
    team: teams[0] || null,
    multiTeam: teams.length > 1,
    department: namesOf(P.Department, names)[0] || null,
    type: selectName(P.Type),
    level: selectName(P.Level),
    leadership: selectName(P.Leadership), // "Yes" / "No"
    founder: selectName(P.Founder), // "Yes" / "No"
    managerId: relIds(P.Manager)[0] || null,
    email: emailValue(P.Email),
    slackId: plainText(P["Slack ID"]),
  };
};

/**
 * Páginas → personas: descarta las páginas sin nombre o con un Status excluido,
 * y anula managerId cuando el manager no está entre las personas resultantes.
 */
export const buildPeople = (pages, excludedStatuses, names) => {
  const people = pages
    .filter((page) => !excludedStatuses.includes(selectName(page.properties.Status)))
    .map((page) => pageToPerson(page, names))
    .filter((p) => p.name);
  const ids = new Set(people.map((p) => p.id));
  for (const p of people) {
    if (p.managerId && !ids.has(p.managerId)) p.managerId = null;
  }
  return people;
};

const postFirstOk = async (urls, init, fetchImpl) => {
  let last;
  for (const url of urls) {
    last = await fetchImpl(url, { method: "POST", ...init });
    if (last.ok) return last;
  }
  throw new Error(`Notion ${last.status}: ${await last.text()}`);
};

/**
 * Descarga todas las páginas paginando. `urls` se prueban en orden en cada
 * petición (p.ej. endpoint de data_sources y, si falla, el clásico de databases).
 */
export const queryAllPages = async ({ token, urls, fetchImpl = fetch }) => {
  const headers = notionHeaders(token);
  const results = [];
  let cursor;
  do {
    const body = { page_size: PAGE_SIZE };
    if (cursor) body.start_cursor = cursor;
    const r = await postFirstOk(urls, { headers, body: JSON.stringify(body) }, fetchImpl);
    const j = await r.json();
    results.push(...j.results);
    cursor = j.has_more ? j.next_cursor : undefined;
  } while (cursor);
  return results;
};

// DB del Directorio de personas (público, no es secreto) y estados excluidos.
// Status real en Notion: Active, Pending Onboarding, Pending Offboarding, Inactive.
// Solo se excluye Inactive (el original excluía además "Baja", que no existe).
export const ORG_DB_ID = "4d3e7fda-a67e-4bf9-9227-30626e273bff";
export const ORG_EXCLUDED_STATUSES = ["Inactive"];

// Las DB a las que apuntan Department y Team desde noviembre de 2026. El nombre
// está en la propiedad de título: `Department` en Áreas y `Team` en Subáreas.
export const DEPARTMENTS_DB_ID = "45bc14ae-2510-442f-927f-a0dad1eb5e7e";
export const TEAMS_DB_ID = "dd2e4c76-0d21-4322-b71f-ccea1075aba0";

/**
 * El mapa id→nombre de Áreas y Subáreas, que se construye una vez por descarga.
 * Son dos tablas de pocas filas: se leen enteras y se resuelve en memoria, en
 * lugar de preguntar por cada persona.
 */
export const fetchRelationNames = async ({
  token,
  dbIds = [DEPARTMENTS_DB_ID, TEAMS_DB_ID],
  fetchImpl = fetch,
}) => {
  const names = new Map();
  for (const id of dbIds) {
    const pages = await queryAllPages({ token, urls: [databaseQueryUrl(id)], fetchImpl });
    for (const page of pages) {
      const nombre = pageTitle(page);
      if (nombre) names.set(stripDashes(page.id), nombre);
    }
  }
  return names;
};

/** Descarga el Directorio de Notion y devuelve las personas activas del organigrama. */
export const fetchDirectory = async ({ token, fetchImpl = fetch }) => {
  const [pages, names] = await Promise.all([
    queryAllPages({ token, urls: [databaseQueryUrl(ORG_DB_ID)], fetchImpl }),
    fetchRelationNames({ token, fetchImpl }),
  ]);
  return buildPeople(pages, ORG_EXCLUDED_STATUSES, names);
};
