/**
 * Enlaces de Documentación (RMR-TSK-0778): la wiki de TRIBBU y Notion, y wikis
 * abiertas que merece la pena tener a mano. Viven en /docLinks y los gestiona
 * quien gestiona Documentación. PURO.
 *
 * @typedef {'tribbu'|'notion'|'abiertas'} DocLinkGroup
 * @typedef {{ group: DocLinkGroup, title: string, url: string, description: string, order: number }} DocLink
 */

/** Grupos, en el orden en que se enseñan. */
export const DOC_LINK_GROUPS = Object.freeze([
  { id: 'tribbu', label: 'TRIBBU' },
  { id: 'notion', label: 'Notion' },
  { id: 'abiertas', label: 'Wikis y referencias abiertas' },
]);

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 300;
const HTTPS = /^https:\/\/[^\s/]+\.[^\s]+$/i;

/**
 * Enlace validado. Solo https: lo pinta un <a> y un `javascript:` sería un agujero.
 * @returns {DocLink}
 */
export function newDocLink({ group, title, url, description = '', order = 0 }) {
  if (!DOC_LINK_GROUPS.some((g) => g.id === group)) throw new Error(`Elige un grupo conocido, no «${group}».`);
  const name = typeof title === 'string' ? title.trim() : '';
  if (!name || name.length > TITLE_MAX) throw new Error(`El enlace necesita un título (hasta ${TITLE_MAX} caracteres).`);
  const href = typeof url === 'string' ? url.trim() : '';
  if (!HTTPS.test(href)) throw new Error('El enlace tiene que ser una dirección https://.');
  const text = typeof description === 'string' ? description.trim() : '';
  if (text.length > DESCRIPTION_MAX) throw new Error(`La descripción no puede pasar de ${DESCRIPTION_MAX} caracteres.`);
  return { group, title: name, url: href, description: text, order: Number.isFinite(order) ? order : 0 };
}

/**
 * Enlaces agrupados en el orden de los grupos; dentro, por `order` y título.
 * Los grupos vacíos no salen.
 * @template {{ group: string, title: string, order?: number }} L
 * @param {L[]} links
 * @returns {Array<{ id: string, label: string, links: L[] }>}
 */
export function groupDocLinks(links) {
  const sorted = (links ?? []).toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title, 'es'));
  return DOC_LINK_GROUPS
    .map((g) => ({ ...g, links: sorted.filter((l) => l.group === g.id) }))
    .filter((g) => g.links.length > 0);
}
