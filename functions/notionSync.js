/**
 * Sincronización Notion → /people (RMR-TSK-0622, ADR -P1XxVvQPrufU13Bd4RF).
 * Pega la descarga vendorizada (notionPeople.js) con el plan puro
 * (notionReconcile.js) y lo escribe. Sin Firebase importado: la Cloud Function
 * le pasa `db`, `auth` y la descarga, y así se prueba en memoria.
 *
 * `apply: false` es la simulación del ADR: calcula el plan, guarda el informe
 * en /config/notionSync y no toca ninguna ficha. Con errores en el plan (email
 * repetido, ciclo de managers) tampoco se aplica nada aunque se pida.
 */
import { buildPeople, ORG_EXCLUDED_STATUSES, selectName, stripDashes } from './notionPeople.js';
import { planNotionSync } from './notionReconcile.js';

/**
 * Id de la base de Notion de ESTA instancia (`/config/org.notionDatabaseId`,
 * RMR-TSK-0626): GREBLA es genérica y cada organización conecta la suya. Solo
 * se acepta un id de Notion (32 hex, con o sin guiones), que acaba dentro de
 * una URL de la API: nada arbitrario. Sin él, falla en alto.
 * @param {Record<string, unknown>|undefined} org
 * @returns {string} el id sin guiones, en minúsculas
 */
export function notionDatabaseIdOf(org) {
  const raw = typeof org?.notionDatabaseId === 'string' ? org.notionDatabaseId.replaceAll('-', '').toLowerCase() : '';
  if (!/^[0-9a-f]{32}$/.test(raw)) {
    throw new Error('Falta /config/org.notionDatabaseId (o no es un id de base de Notion).');
  }
  return raw;
}

/** Firestore admite 500 escrituras por lote; se deja margen. */
const BATCH_SIZE = 400;

/**
 * Personas del directorio con lo que el módulo vendorizado no lee: Status y
 * Join Date (para no tocar la copia del portal).
 * @param {Array<Record<string, any>>} pages
 */
export function directoryFromPages(pages) {
  const extras = new Map(pages.map((p) => [stripDashes(p.id), {
    status: selectName(p.properties.Status),
    joinDate: p.properties['Join Date']?.date?.start ?? null,
  }]));
  return buildPeople(pages, ORG_EXCLUDED_STATUSES).map((p) => ({ ...p, ...extras.get(p.id) }));
}

/** Email de la cuenta de cada ficha con uid (Auth, de 100 en 100). */
async function authEmails(auth, people) {
  const uids = people.map((p) => p.data.uid).filter((u) => typeof u === 'string' && u);
  const out = new Map();
  for (let i = 0; i < uids.length; i += 100) {
    const { users } = await auth.getUsers(uids.slice(i, i + 100).map((uid) => ({ uid })));
    for (const u of users) out.set(u.uid, u.email ?? null);
  }
  return out;
}

/**
 * De qué valor a qué valor pasa cada campo de una actualización, para que quien
 * revise el informe vea, p.ej., quién cambia de manager (eso mueve accesos).
 * El bloque `notion` se informa dato a dato (`notion.role`…), y solo lo que
 * cambia: si no, una ficha que solo cambia ahí cuenta como cambio y no se ve
 * (RMR-TSK-0633).
 */
function changesOf(update, current) {
  const before = current.get(update.personId) ?? {};
  const { notion, ...fields } = update.set;
  return {
    ...Object.fromEntries(Object.entries(fields).map(([field, to]) => [field, { from: before[field] ?? null, to }])),
    ...notionChanges(before.notion ?? {}, notion ?? {}),
  };
}

function notionChanges(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return Object.fromEntries([...keys]
    .filter((k) => (before[k] ?? null) !== (after[k] ?? null))
    .map((k) => [`notion.${k}`, { from: before[k] ?? null, to: after[k] ?? null }]));
}

async function commitInBatches(db, ops) {
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + BATCH_SIZE)) batch[op.kind](db.doc(op.path), op.data);
    await batch.commit();
  }
}

/**
 * @param {{ db: any, auth: any, fetchPages: () => Promise<Array<Record<string, any>>>, apply: boolean, now: Date }} deps
 * @returns {Promise<Record<string, any>>} el informe (también queda en /config/notionSync)
 */
export async function runNotionSync({ db, auth, fetchPages, apply, now }) {
  const directory = directoryFromPages(await fetchPages());
  const [peopleSnap, branchesSnap] = await Promise.all([db.collection('people').get(), db.collection('orgBranches').get()]);
  const people = peopleSnap.docs.map((d) => ({ id: d.id, data: d.data() }));
  const emails = await authEmails(auth, people);
  const plan = planNotionSync({
    directory,
    people: people.map((p) => ({ ...p, authEmail: emails.get(p.data.uid) ?? null })),
    branches: branchesSnap.docs.map((d) => ({ id: d.id, label: d.data().label ?? d.id })),
    newId: () => db.collection('people').doc().id,
    today: now.toISOString().slice(0, 10),
  });

  const current = new Map(people.map((p) => [p.id, p.data]));
  const applied = apply && plan.errors.length === 0;
  if (applied) {
    await commitInBatches(db, [
      ...plan.updates.map((u) => ({ kind: 'update', path: `people/${u.personId}`, data: u.set })),
      ...plan.creates.map((c) => ({ kind: 'set', path: `people/${c.personId}`, data: c.data })),
    ]);
  }
  const report = {
    at: now.toISOString(),
    applied,
    errors: plan.errors,
    counts: { updates: plan.updates.length, creates: plan.creates.length, skipped: plan.skipped.length, notInNotion: plan.notInNotion.length },
    updates: plan.updates.map((u) => ({ personId: u.personId, name: u.name, fields: Object.keys(u.set), changes: changesOf(u, current) })),
    creates: plan.creates.map((c) => ({ personId: c.personId, name: c.name })),
    skipped: plan.skipped,
    notInNotion: plan.notInNotion,
  };
  await commitInBatches(db, [{ kind: 'set', path: 'config/notionSync', data: report }]);
  return report;
}
