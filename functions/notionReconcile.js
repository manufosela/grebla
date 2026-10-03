/**
 * Reconciliación Notion → /people (ADR -P1XxVvQPrufU13Bd4RF, opción C ·
 * RMR-TSK-0621). PURA: recibe el directorio de Notion, las fichas y el catálogo
 * de ramas, y devuelve un PLAN; escribirlo es cosa de la Cloud Function.
 *
 * Guardrails del ADR:
 *  - nunca borra ni da de baja: quien no está en Notion solo se reporta;
 *  - fila sin email → se ignora y se reporta (no hay clave estable);
 *  - email repetido en Notion → `errors` y el lote entero no se aplica;
 *  - email que casa con varias fichas → no se toca ninguna, se reporta.
 *
 * Campos que manda Notion (la ficha no los edita): name, orgBranch (Department
 * por label del catálogo), reportsToPersonId (Manager), startDate (Join Date),
 * external (Type = Contractor) y el bloque `notion`. El nivel de carrera NO
 * (lo decide el manager; Level de Notion es otra cosa).
 */

const norm = (email) => (typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null);

/** Bloque `notion` de la ficha: lo que el organigrama muestra tal cual. */
const notionBlock = (e) => ({
  id: e.id, role: e.role ?? null, level: e.level ?? null, department: e.department ?? null,
  team: e.team ?? null, type: e.type ?? null, status: e.status ?? null,
});

/** Índice de fichas por notion.id y por cada email que tengan (propio, pendiente o de Auth). */
function indexPeople(people) {
  const byNotionId = new Map();
  const byEmail = new Map();
  const push = (map, key, p) => map.set(key, [...(map.get(key) ?? []), p]);
  for (const p of people) {
    if (p.data?.notion?.id) push(byNotionId, p.data.notion.id, p);
    const emails = new Set([p.data?.email, p.data?.pendingEmail, p.authEmail].map(norm).filter(Boolean));
    for (const e of emails) push(byEmail, e, p);
  }
  return { byNotionId, byEmail };
}

/** Lo que Notion dice de una persona, en campos de la ficha. */
function desiredFields(entry, ctx) {
  const set = { name: entry.name, external: entry.type === 'Contractor', notion: notionBlock(entry) };
  const branch = ctx.branchByLabel.get((entry.department ?? '').trim().toLowerCase());
  if (branch) set.orgBranch = branch;
  else if (entry.department) ctx.skipped.push({ name: entry.name, reason: `departamento «${entry.department}» sin rama en el catálogo` });
  if (entry.joinDate) set.startDate = entry.joinDate;
  const manager = entry.managerId ? ctx.personByNotionId.get(entry.managerId) : null;
  if (!entry.managerId || manager) set.reportsToPersonId = manager ?? null;
  else ctx.skipped.push({ name: entry.name, reason: 'su manager en Notion no tiene ficha: se mantiene el actual' });
  return set;
}

/** Palabras de un nombre sin tildes ni mayúsculas: «Héctor Martínez» → [hector, martinez]. */
const nameTokens = (name) => (name ?? '').normalize('NFD').replaceAll(/\p{M}/gu, '').toLowerCase()
  .split(/[^a-z]+/).filter(Boolean);

/** ¿La ficha parece la misma persona? Cada palabra suya (al menos dos) empieza una del nombre de Notion. */
const looksLikeSamePerson = (fichaName, notionName) => {
  const mine = nameTokens(fichaName);
  const theirs = nameTokens(notionName);
  return mine.length >= 2 && mine.every((t) => theirs.some((w) => w.startsWith(t)));
};

/** Primer ciclo de la cadena de mando, como texto legible, o null. */
function findManagerCycle(directory) {
  const byId = new Map(directory.map((e) => [e.id, e]));
  for (const start of directory) {
    const path = [];
    for (let e = start; e; e = byId.get(e.managerId)) {
      const at = path.indexOf(e);
      if (at >= 0) return [...path.slice(at), e].map((x) => x.name).join(' → ');
      path.push(e);
    }
  }
  return null;
}

/** Solo los campos que cambian (comparación por valor, también del bloque notion). */
function diff(current, desired) {
  return Object.fromEntries(Object.entries(desired)
    .filter(([k, v]) => JSON.stringify(current[k] ?? null) !== JSON.stringify(v ?? null)));
}

/**
 * @param {{ directory: Array<Record<string, any>>, people: Array<{ id: string, data: Record<string, any>, authEmail?: string|null }>,
 *   branches: Array<{ id: string, label: string }>, newId: () => string, today: string }} input
 *   `newId` da el personId de cada ficha nueva; `today` (AAAA-MM-DD) es su alta si Notion no trae Join Date.
 */
export function planNotionSync({ directory, people, branches, newId, today }) {
  if (typeof newId !== 'function') throw new TypeError('planNotionSync: newId debe ser una función');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today ?? '')) throw new TypeError('planNotionSync: today debe ser AAAA-MM-DD');
  const errors = [];
  const skipped = [];
  const seen = new Set();
  for (const e of directory) {
    const email = norm(e.email);
    if (email && seen.has(email)) errors.push(`email repetido en Notion: ${email}`);
    if (email) seen.add(email);
  }
  const cycle = findManagerCycle(directory);
  if (cycle) errors.push(`ciclo de managers en Notion: ${cycle}`);

  const { byNotionId, byEmail } = indexPeople(people);
  const matches = new Map(); // notionId → ficha
  const unmatched = [];
  for (const e of directory) {
    const email = norm(e.email);
    if (!email) { skipped.push({ name: e.name, reason: 'sin email en Notion' }); continue; }
    const candidates = byNotionId.get(e.id) ?? byEmail.get(email) ?? [];
    if (candidates.length > 1) { skipped.push({ name: e.name, reason: `casa con varias fichas: ${candidates.map((c) => c.id).join(', ')}` }); continue; }
    if (candidates.length === 1) matches.set(e.id, candidates[0]);
    else unmatched.push(e);
  }

  const matchedIds = new Set([...matches.values()].map((p) => p.id));
  const notInNotion = people
    .filter((p) => p.data?.active !== false && !matchedIds.has(p.id))
    .map((p) => ({ personId: p.id, name: p.data?.name ?? p.id }));

  // Padrón: quien está en Notion y no en GREBLA se crea, salvo que una ficha sin
  // casar se llame casi igual (email mal escrito): eso lo decide una persona.
  const toCreate = new Map(); // notionId → personId nuevo
  for (const e of unmatched) {
    const twin = notInNotion.find((p) => looksLikeSamePerson(p.name, e.name));
    if (twin) skipped.push({ name: e.name, reason: `posible duplicado de «${twin.name}» (${twin.personId}): no se crea` });
    else toCreate.set(e.id, newId());
  }

  const ctx = {
    skipped,
    branchByLabel: new Map(branches.map((b) => [b.label.trim().toLowerCase(), b.id])),
    personByNotionId: new Map([...[...matches].map(([nid, p]) => [nid, p.id]), ...toCreate]),
  };
  const updates = [];
  const creates = [];
  for (const e of directory) {
    const p = matches.get(e.id);
    if (p) {
      const set = diff(p.data, desiredFields(e, ctx));
      if (Object.keys(set).length) updates.push({ personId: p.id, name: e.name, set });
    } else if (toCreate.has(e.id)) {
      const data = { pendingEmail: norm(e.email), orgRole: 'generico', orgBranch: 'generico', active: true,
        startDate: today, guilds: [], disciplines: [], labels: [], ...desiredFields(e, ctx) };
      creates.push({ personId: toCreate.get(e.id), name: e.name, data });
    }
  }
  return { errors, updates, creates, skipped, notInNotion };
}
