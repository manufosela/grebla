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

// ── Escritura: sub-issues por gremio (RMR-PCS-0043 · F5) ─────────────────────
// Linear tiene UN campo de estimación por issue, y una tarea multi-gremio tiene
// una estimación por gremio (y otra de QA). Lo natural en Linear son las
// SUB-ISSUES: una por gremio colgando de la historia, cada una con su
// estimación en el campo oficial, y un comentario resumen en la padre. La
// prioridad de producto de la padre no se toca: la pone el PM fuera del juego.

export const LINEAR_PARENT_QUERY = `
  query Parent($id: String!) {
    issue(id: $id) {
      id identifier title url
      team { id }
      children { nodes { identifier title url } }
      comments { nodes { body } }
    }
  }`;

export const LINEAR_ISSUE_CREATE = `
  mutation Create($input: IssueCreateInput!) {
    issueCreate(input: $input) { success issue { identifier url } }
  }`;

export const LINEAR_COMMENT_CREATE = `
  mutation Comment($input: CommentCreateInput!) {
    commentCreate(input: $input) { success }
  }`;

/** Título de la sub-issue de un gremio: `[Gremio] título de la padre`. */
export function subIssueTitle(guild, parentTitle) {
  return `[${String(guild).trim()}] ${String(parentTitle ?? '').trim()}`.trim();
}

/** La carta como estimación de Linear: solo si es un número entero (partir y tallas no lo son). */
export function estimateNumber(card) {
  const texto = String(card ?? '').trim();
  if (!texto) return null;
  const n = Number(texto);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/**
 * Qué sub-issues crear y cuáles saltar porque ya existen con ese título
 * (idempotente: enviar dos veces no duplica).
 * @param {Array<{ title?: string, identifier?: string, url?: string }>} children
 * @param {Record<string, string>} values  gremio → carta
 * @param {string} parentTitle
 */
export function planSubIssues(children, values, parentTitle) {
  const existing = new Map((children ?? []).map((c) => [String(c?.title ?? ''), c]));
  const create = [];
  const skipped = [];
  for (const [guild, card] of Object.entries(values ?? {})) {
    const title = subIssueTitle(guild, parentTitle);
    const prev = existing.get(title);
    if (prev) skipped.push({ guild, identifier: prev.identifier ?? null, url: prev.url ?? null });
    else create.push({ guild, title, estimate: estimateNumber(card), card: String(card) });
  }
  return { create, skipped };
}

/** El comentario resumen que se deja en la historia padre (Markdown de Linear). */
export function summaryComment({ values, value, sessionName }) {
  const lineas = Object.entries(values ?? {}).map(([g, v]) => `- **${g}**: ${v}`);
  const sesion = sessionName ? `, sesión «${sessionName}»` : '';
  const cabecera = `**Estimación por gremio** (Scrum Poker de GREBLA${sesion})`;
  const resumen = value ? `\nMagnitud de la tarea (el gremio más cargado): **${value}**.` : '';
  return `${cabecera}\n${lineas.join('\n')}${resumen}`;
}

async function graphql(apiKey, fetchImpl, query, variables) {
  const res = await fetchImpl('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Linear respondió ${res.status}.`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(String(json.errors[0]?.message ?? 'Error de la API de Linear.'));
  return json.data;
}

/**
 * Crea en Linear una sub-issue por gremio (las que falten) y deja el comentario
 * resumen en la padre. Devuelve lo creado, lo saltado y la padre.
 * @param {{ identifier: string, values: Record<string, string>, value?: string|null, sessionName?: string }} input
 * @param {string} apiKey
 * @param {typeof fetch} [fetchImpl]
 */
export async function pushGuildEstimates({ identifier, values, value = null, sessionName = '' }, apiKey, fetchImpl = fetch) {
  if (!LINEAR_REF_RE.test(identifier)) throw new Error(`Referencia no válida: ${identifier}`);
  if (!values || typeof values !== 'object' || Object.keys(values).length === 0) throw new Error('No hay valores por gremio que enviar.');
  const data = await graphql(apiKey, fetchImpl, LINEAR_PARENT_QUERY, { id: identifier });
  const parent = data?.issue;
  if (!parent?.id || !parent.team?.id) throw new Error(`Linear no conoce ${identifier}.`);
  const { create, skipped } = planSubIssues(parent.children?.nodes, values, parent.title);
  const created = [];
  for (const item of create) {
    const input = {
      teamId: parent.team.id,
      parentId: parent.id,
      title: item.title,
      description: `Estimación del gremio ${item.guild} en el Scrum Poker de GREBLA: **${item.card}**.`,
      ...(item.estimate === null ? {} : { estimate: item.estimate }),
    };
    const out = await graphql(apiKey, fetchImpl, LINEAR_ISSUE_CREATE, { input });
    const issue = out?.issueCreate?.issue;
    if (!out?.issueCreate?.success || !issue) throw new Error(`Linear no creó la sub-issue de ${item.guild}.`);
    created.push({ guild: item.guild, identifier: issue.identifier, url: issue.url ?? null });
  }
  // El comentario también es idempotente: si la padre ya tiene ese mismo
  // resumen (reintento tras un corte), no se repite; si cambian los valores, sí.
  const body = summaryComment({ values, value, sessionName });
  const yaComentado = (parent.comments?.nodes ?? []).some((c) => c?.body === body);
  if (!yaComentado) {
    const comentario = await graphql(apiKey, fetchImpl, LINEAR_COMMENT_CREATE, { input: { issueId: parent.id, body } });
    if (comentario?.commentCreate?.success !== true) throw new Error('Linear no dejó el comentario resumen en la historia.');
  }
  return {
    parent: { identifier: parent.identifier, url: parent.url ?? null },
    subIssues: [...skipped, ...created],
    created: created.length,
    skipped: skipped.length,
    commented: !yaComentado,
  };
}
