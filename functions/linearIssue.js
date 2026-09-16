/**
 * Ficha de una historia de Linear por su identificador (RMR-TSK-0518). Módulo
 * puro: recibe el `fetch` para poder probarlo sin red.
 *
 * Lo que sale de aquí es lo que se guarda en la sesión de poker y ven todos
 * los participantes, así que se sanea campo a campo: nada de volcar la
 * respuesta de Linear tal cual, y la descripción recortada, porque es texto de
 * terceros que va a acabar en el DOM (como texto, nunca como HTML).
 */

/** Identificador de Linear: equipo en mayúsculas, guion y número (BB-1234). */
export const LINEAR_REF_RE = /^[A-Z][A-Z0-9]{1,7}-\d{1,6}$/;

export const DESCRIPTION_MAX = 4000;

export const LINEAR_ISSUE_QUERY = `
  query Issue($id: String!) {
    issue(id: $id) {
      identifier title description url estimate priorityLabel
      state { name type }
      assignee { name }
      labels { nodes { name } }
      project { name }
    }
  }`;

const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** La ficha saneada: solo lo que la mesa pinta, con tamaños acotados. */
export function sanitizeIssue(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const identifier = texto(raw.identifier, 20);
  if (!identifier) return null;
  return {
    identifier,
    title: texto(raw.title, 300),
    description: texto(raw.description, DESCRIPTION_MAX),
    url: typeof raw.url === 'string' && raw.url.startsWith('https://linear.app/') ? raw.url : null,
    estimate: typeof raw.estimate === 'number' ? raw.estimate : null,
    priority: texto(raw.priorityLabel, 40) || null,
    state: texto(raw.state?.name, 60) || null,
    assignee: texto(raw.assignee?.name, 120) || null,
    labels: Array.isArray(raw.labels?.nodes)
      ? raw.labels.nodes.map((l) => texto(l?.name, 60)).filter(Boolean).slice(0, 12)
      : [],
    project: texto(raw.project?.name, 120) || null,
  };
}

/**
 * Trae la historia. Devuelve la ficha saneada, o null si Linear no la conoce.
 * @param {string} identifier ya validado con LINEAR_REF_RE
 * @param {string} apiKey
 * @param {typeof fetch} [fetchImpl]
 */
export async function fetchLinearIssue(identifier, apiKey, fetchImpl = fetch) {
  if (!LINEAR_REF_RE.test(identifier)) throw new Error(`Referencia no válida: ${identifier}`);
  const res = await fetchImpl('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: apiKey },
    body: JSON.stringify({ query: LINEAR_ISSUE_QUERY, variables: { id: identifier } }),
  });
  if (!res.ok) throw new Error(`Linear respondió ${res.status}.`);
  const json = await res.json();
  // Linear devuelve «Entity not found» como error de GraphQL: eso es «no existe», no un fallo.
  if (json.errors?.length) {
    const msg = String(json.errors[0]?.message ?? '');
    if (/not found/i.test(msg)) return null;
    throw new Error(msg || 'Error de la API de Linear.');
  }
  return sanitizeIssue(json.data?.issue);
}
