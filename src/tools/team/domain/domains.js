/**
 * DOMINIOS y SUBDOMINIOS (ADR «De squads a dominios y subdominios»).
 *
 * Un DOMINIO es un producto o ámbito grande —TRIBBU-APP, Plataforma— y un
 * SUBDOMINIO la unidad fina donde ocurre el trabajo —CAES, Trust, Core—. Sustituyen
 * al squad, que mezclaba dos cosas: dónde ocurre el trabajo y quién pertenece a
 * él. Con equipos fluidos lo segundo deja de tener sentido; lo primero no.
 *
 * La pieza que sostiene todo es el `key`: legible, asignado UNA VEZ y almacenado.
 * Hoy la clave de las métricas se deriva del nombre, así que renombrar una
 * entidad parte su serie histórica en dos sin que nadie se entere. Aquí quedan
 * tres cosas separadas y cada una con su papel:
 *
 *   - el ID       identifica el documento (clave interna)
 *   - el KEY      identifica la entidad entre sistemas (clave del contrato)
 *   - el NOMBRE   es un rótulo editable, y no afecta a ninguno de los dos
 *
 * Lógica pura: sin Firestore, para poder probar todas las reglas sin montar nada.
 *
 * @typedef {Object} Domain
 * @property {string} id
 * @property {string} key      clave del contrato; inmutable
 * @property {string} name     rótulo editable
 * @property {string} [channel] canal de Slack: la COMUNICACIÓN vive en el dominio
 *
 * @typedef {Object} Subdomain
 * @property {string} id
 * @property {string} key
 * @property {string} name
 * @property {string} domainKey        dominio al que pertenece
 * @property {string} [linearProject]  la MEDICIÓN vive en el subdominio
 * @property {string} [githubTeam]
 */

/** Forma válida de un `key`: minúsculas, números y guiones simples. */
const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Nombre del subdominio que recibe un dominio que aún no se ha dividido. */
export const CORE_NAME = 'Core';

/**
 * Sugiere un `key` a partir de un nombre. SOLO para proponerlo al crear: una vez
 * asignado, el key no se recalcula nunca — si se recalculara, renombrar volvería
 * a partir el histórico, que es justo el problema que este modelo resuelve.
 * @param {string} name
 * @returns {string}
 */
export function suggestKey(name) {
  return String(name ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * `key` del subdominio «Core» de un dominio. Lleva el dominio delante porque
 * habrá uno por dominio: sin eso, los tres «Core» colisionarían en la misma
 * clave y se machacarían las métricas entre sí.
 * @param {string} domainKey
 * @returns {string}
 */
export function coreKeyFor(domainKey) {
  return `${domainKey}-core`;
}

/**
 * ¿Es un `key` válido y libre? Devuelve el motivo cuando no lo es, para poder
 * decírselo a quien lo escribe en vez de rechazarlo sin más.
 * @param {string} key
 * @param {ReadonlyArray<{ key: string, id?: string }>} existing  entidades del mismo tipo
 * @param {string|null} [selfId]  al editar, su propio id (no choca consigo misma)
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function validateKey(key, existing = [], selfId = null) {
  const value = String(key ?? '').trim();
  if (!value) return { ok: false, reason: 'La clave no puede estar vacía.' };
  if (!KEY_PATTERN.test(value)) {
    return { ok: false, reason: 'Solo minúsculas, números y guiones simples (ej. «tribbu-app»).' };
  }
  const choca = (existing ?? []).some((e) => e.key === value && e.id !== selfId);
  if (choca) return { ok: false, reason: `La clave «${value}» ya está en uso.` };
  return { ok: true };
}

/**
 * Rótulo de un subdominio SIEMPRE con su dominio delante («Plataforma › Core»).
 * Habrá varios «Core», uno por dominio: sin el prefijo son indistinguibles en
 * cualquier listado.
 * @param {Subdomain|null|undefined} subdomain
 * @param {ReadonlyArray<Domain>} domains
 * @returns {string}
 */
export function subdomainLabel(subdomain, domains = []) {
  if (!subdomain) return '';
  const dominio = domains.find((d) => d.key === subdomain.domainKey);
  return dominio ? `${dominio.name} › ${subdomain.name}` : subdomain.name;
}

/**
 * Catálogo agrupado: cada dominio con sus subdominios, ordenados por nombre.
 * Los subdominios cuyo dominio no existe se devuelven aparte en vez de
 * descartarse: un dato huérfano hay que verlo para arreglarlo, no esconderlo.
 * @param {ReadonlyArray<Domain>} domains
 * @param {ReadonlyArray<Subdomain>} subdomains
 * @returns {{ tree: Array<{ domain: Domain, subdomains: Subdomain[] }>, orphans: Subdomain[] }}
 */
export function groupByDomain(domains = [], subdomains = []) {
  const porNombre = (a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'es');
  const claves = new Set(domains.map((d) => d.key));
  const tree = [...domains].toSorted(porNombre).map((domain) => ({
    domain,
    subdomains: subdomains.filter((s) => s.domainKey === domain.key).toSorted(porNombre),
  }));
  return { tree, orphans: subdomains.filter((s) => !claves.has(s.domainKey)).toSorted(porNombre) };
}

/**
 * ¿Qué le falta al catálogo para cumplir la regla «todo dominio tiene al menos
 * un subdominio»? Devuelve los dominios sin ninguno, que son los que necesitan
 * su «Core». Puro: quien decide crearlos es el caller.
 * @param {ReadonlyArray<Domain>} domains
 * @param {ReadonlyArray<Subdomain>} subdomains
 * @returns {Domain[]}
 */
export function domainsWithoutSubdomain(domains = [], subdomains = []) {
  const conHijos = new Set(subdomains.map((s) => s.domainKey));
  return domains.filter((d) => !conHijos.has(d.key));
}

/**
 * Opciones para elegir un subdominio en un desplegable: su clave y el rótulo con
 * el dominio delante, ordenadas por ese rótulo. Habrá un «Core» por dominio: sin
 * el prefijo, el desplegable tendría opciones idénticas y elegir sería una
 * lotería.
 * @param {ReadonlyArray<Subdomain>} subdomains
 * @param {ReadonlyArray<Domain>} domains
 * @returns {Array<{ key: string, label: string }>}
 */
export function subdomainChoices(subdomains = [], domains = []) {
  return subdomains
    .map((s) => ({ key: s.key, label: subdomainLabel(s, domains) }))
    .toSorted((a, b) => a.label.localeCompare(b.label, 'es'));
}
