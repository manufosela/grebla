/**
 * VENDORIZADO (ADR -P1XxVvQPrufU13Bd4RF, opción C · RMR-TSK-0620): copia literal
 * de `functions/organigrama/notion-people.js` del portal (tribbu-repos-info),
 * tomada el 2026-10-03. No editar aquí: si el esquema de Notion cambia, se
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

export const stripDashes = (id) => id.replaceAll("-", "");
export const selectName = (p) => p?.select?.name || null;
export const firstMultiSelect = (p) => p?.multi_select?.[0]?.name || null;
export const hasMultipleValues = (p) => (p?.multi_select?.length ?? 0) > 1;
export const titleText = (p) => (p?.title ? p.title.map((t) => t.plain_text).join("") : "").trim();
export const relIds = (p) => (p?.relation ? p.relation.map((r) => stripDashes(r.id)) : []);
export const emailValue = (p) => p?.email || null;
export const plainText = (p) => {
  const s = p?.rich_text ? p.rich_text.map((t) => t.plain_text).join("").trim() : "";
  return s || null;
};

/** Página de Notion → persona (sin filtrar). */
export const pageToPerson = (page) => {
  const P = page.properties;
  return {
    id: stripDashes(page.id),
    name: titleText(P.Name),
    role: selectName(P.Role),
    team: firstMultiSelect(P.Team),
    multiTeam: hasMultipleValues(P.Team),
    department: selectName(P.Department),
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
export const buildPeople = (pages, excludedStatuses) => {
  const people = pages
    .filter((page) => !excludedStatuses.includes(selectName(page.properties.Status)))
    .map(pageToPerson)
    .filter((p) => p.name);
  const ids = new Set(people.map((p) => p.id));
  for (const p of people) {
    if (p.managerId && !ids.has(p.managerId)) p.managerId = null;
  }
  return people;
};

