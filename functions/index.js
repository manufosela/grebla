/**
 * Cloud Functions de GREBLA.
 *
 * grantAdmin: callable que permite a un admin existente conceder el rol admin a
 * otra persona por email. Establece el custom claim { admin: true } y crea el
 * documento /admins/{uid}. El primer admin se crea con el bootstrap de la UI
 * (/login) o con el script de seed.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as coins from './coins.js';
import { sign, coinsKmsKeyName } from './signer.js';

initializeApp();

/** @param {string} uid */
async function isAdmin(uid) {
  const snap = await getFirestore().doc(`admins/${uid}`).get();
  return snap.exists;
}

export const grantAdmin = onCall({ region: 'europe-west1' }, async (request) => {
  const caller = request.auth;
  if (!caller) {
    throw new HttpsError('unauthenticated', 'Necesitas iniciar sesión.');
  }
  const callerIsAdmin = caller.token.admin === true || (await isAdmin(caller.uid));
  if (!callerIsAdmin) {
    throw new HttpsError('permission-denied', 'Solo un administrador puede conceder acceso admin.');
  }

  const email = typeof request.data?.email === 'string' ? request.data.email.trim() : '';
  if (!email) {
    throw new HttpsError('invalid-argument', 'Falta el email del nuevo administrador.');
  }

  let user;
  try {
    user = await getAuth().getUserByEmail(email);
  } catch {
    throw new HttpsError('not-found', `No existe ningún usuario con el email ${email}. Debe iniciar sesión al menos una vez.`);
  }

  await getAuth().setCustomUserClaims(user.uid, { admin: true });
  await getFirestore().doc(`admins/${user.uid}`).set(
    {
      email: user.email ?? email,
      grantedBy: caller.uid,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { ok: true, uid: user.uid };
});

// ── Accesos (líderes y viewers) ──────────────────────────────────────────────
const ACCESS_COLLECTION = { leader: 'leaders', viewer: 'viewers' };

/**
 * Gestiona los accesos de la instancia: líderes (gestionan sus personas) y
 * viewers (solo lectura, tipo C-level). Solo un superadmin. Resuelve el email
 * a uid (el usuario debe haber iniciado sesión al menos una vez) y crea o
 * borra /leaders/{uid} o /viewers/{uid} según `role`.
 * action: 'add' (por defecto) | 'remove'. role: 'leader' (por defecto) | 'viewer'.
 */
export const manageAccess = onCall({ region: 'europe-west1' }, async (request) => {
  const caller = request.auth;
  if (!caller) throw new HttpsError('unauthenticated', 'Necesitas iniciar sesión.');
  if (!(await isAdmin(caller.uid))) {
    throw new HttpsError('permission-denied', 'Solo un superadmin puede gestionar accesos.');
  }
  const action = request.data?.action === 'remove' ? 'remove' : 'add';
  const role = request.data?.role === 'viewer' ? 'viewer' : 'leader';
  const collectionName = ACCESS_COLLECTION[role];
  const email = typeof request.data?.email === 'string' ? request.data.email.trim() : '';
  if (!email) throw new HttpsError('invalid-argument', `Falta el email del ${role === 'viewer' ? 'viewer' : 'líder'}.`);

  let user;
  try {
    user = await getAuth().getUserByEmail(email);
  } catch {
    throw new HttpsError('not-found', `No existe ningún usuario con el email ${email}. Debe iniciar sesión al menos una vez.`);
  }

  const ref = getFirestore().doc(`${collectionName}/${user.uid}`);
  if (action === 'remove') {
    await ref.delete();
    return { ok: true, action, role, uid: user.uid };
  }
  await ref.set(
    {
      email: user.email ?? email,
      displayName: user.displayName ?? user.email ?? email,
      addedBy: caller.uid,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { ok: true, action, role, uid: user.uid };
});

/**
 * Sella la invitación de una persona pre-invitada por email (RMR-TSK-0167). El
 * propio usuario, ya logado, la llama: busca una persona con
 * `pendingEmail == su-email` y `uid == null`, le escribe su uid y borra
 * pendingEmail — así hereda el plan/equipo preparados por adelantado. Admin SDK
 * (las reglas no dejan al cliente escribirse su propio uid). Idempotente: sin
 * invitación pendiente devuelve { sealed: false } sin tocar nada; solo sella la
 * PRIMERA coincidencia (una colisión de emails no reparte accesos a ciegas).
 */
export const sealInvite = onCall({ region: 'europe-west1' }, async (request) => {
  const caller = request.auth;
  if (!caller) throw new HttpsError('unauthenticated', 'Necesitas iniciar sesión.');
  const email = typeof caller.token?.email === 'string' ? caller.token.email.trim().toLowerCase() : '';
  if (!email) return { sealed: false, reason: 'no-email' };

  const snap = await getFirestore().collection('people').where('pendingEmail', '==', email).get();
  // Filtra en código las ya vinculadas (evita un índice compuesto por dos
  // campos): solo sella una persona que siga SIN uid.
  const pending = snap.docs.find((d) => !d.data().uid);
  if (!pending) return { sealed: false };

  await pending.ref.set({ uid: caller.uid, pendingEmail: FieldValue.delete() }, { merge: true });
  return { sealed: true, personId: pending.id };
});

/**
 * Borra DEFINITIVAMENTE a una persona con su subárbol completo (plan de carrera,
 * valoraciones, lecturas, conversaciones, notas, sesiones de Role Mirror…) con
 * `recursiveDelete` del Admin SDK — el cliente Web no puede borrar subcolecciones
 * en cascada. Distinto de la baja (active:false, que CONSERVA los datos y solo la
 * saca de las estadísticas activas): esto la elimina por completo, para gente
 * creada por error. Solo el dueño (ownerLeaderUid) o un superadmin, y SOLO si la
 * persona ya está dada de baja (precondición de seguridad).
 */
export const deletePerson = onCall({ region: 'europe-west1' }, async (request) => {
  const caller = request.auth;
  if (!caller) throw new HttpsError('unauthenticated', 'Necesitas iniciar sesión.');
  const personId = typeof request.data?.personId === 'string' ? request.data.personId.trim() : '';
  if (!personId) throw new HttpsError('invalid-argument', 'Falta el personId a borrar.');

  const db = getFirestore();
  const ref = db.doc(`people/${personId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', `Persona ${personId} no encontrada.`);

  const person = snap.data();
  const canDelete = person.ownerLeaderUid === caller.uid || (await isAdmin(caller.uid));
  if (!canDelete) {
    throw new HttpsError('permission-denied', 'Solo el dueño o un superadmin pueden borrar una persona.');
  }
  if (person.active !== false) {
    throw new HttpsError('failed-precondition', 'Da de baja a la persona antes de borrarla definitivamente.');
  }

  await db.recursiveDelete(ref); // borra el doc y TODAS sus subcolecciones
  return { ok: true, deletedPersonId: personId };
});

/**
 * getMyO2O: proyección COMPARTIDA de los O2O de la persona vinculada al llamante.
 * Deriva el personId de su uid (no lo acepta como input, para que solo obtenga lo
 * suyo), busca las sesiones en los líderes que le corresponden (dueño + líderes
 * con los que está compartida) y devuelve SOLO {date, sharedSummary} de las que el
 * líder marcó como compartidas — nunca transcripción, notas ni el resumen privado.
 * Añade sus acciones (que ya puede leer por reglas) para resolverlo en un viaje.
 */
export const getMyO2O = onCall({ region: 'europe-west1' }, async (request) => {
  const caller = request.auth;
  if (!caller) throw new HttpsError('unauthenticated', 'Necesitas iniciar sesión.');

  const db = getFirestore();
  const personSnap = await db.collection('people').where('uid', '==', caller.uid).limit(1).get();
  const personDoc = personSnap.docs.at(0);
  if (!personDoc) throw new HttpsError('not-found', 'No hay ninguna persona vinculada a tu cuenta.');
  const personId = personDoc.id;
  const person = personDoc.data();

  const leaderUids = [...new Set([person.ownerLeaderUid, ...(person.sharedWithUids ?? [])].filter(Boolean))];
  const perLeader = await Promise.all(
    leaderUids.map((luid) =>
      db.collection('leaders').doc(luid).collection('o2o').where('personId', '==', personId).get(),
    ),
  );
  const sessions = perLeader
    .flatMap((snap) => snap.docs)
    .map((d) => d.data())
    .filter((s) => s.sharedWithPerson && s.sharedSummary)
    .map((s) => ({ date: s.date, sharedSummary: s.sharedSummary }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const actionsSnap = await db.collection('people').doc(personId).collection('o2oActions').get();
  const actions = actionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return { sessions, actions };
});

/**
 * Propuesta de preguntas para un periodo de O2O con IA. El cliente manda las
 * preguntas de periodos anteriores (guía o formulario) y Claude devuelve una
 * batería nueva. Usa tool-use para forzar JSON; el cliente la sanea antes de
 * volcarla al editor. Acceso: superadmin o líder (como refreshDora). El secreto
 * ANTHROPIC_API_KEY es de la instancia (`firebase functions:secrets:set`).
 */
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const O2O_AI_MODEL = 'claude-sonnet-4-6';
const O2O_QUESTIONS_TOOL = {
  name: 'emit_o2o_questions',
  description: 'Devuelve la batería de preguntas propuesta para el O2O.',
  input_schema: {
    type: 'object',
    properties: {
      intro: { type: 'string', description: 'Cabecera opcional (solo para el formulario previo).' },
      groups: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Título del bloque temático.' },
            questions: { type: 'array', items: { type: 'string' } },
          },
          required: ['title', 'questions'],
        },
      },
    },
    required: ['groups'],
  },
};

/** Construye el prompt con el contexto de periodos anteriores. */
function buildO2OPrompt(kind, previousPeriods, instructions) {
  const label = kind === 'form'
    ? 'formulario previo (temas para que la persona reflexione ANTES del O2O)'
    : 'guía de temas y preguntas para el líder DURANTE el O2O';
  const prev = (previousPeriods ?? [])
    .filter((p) => Array.isArray(p?.groups) && p.groups.length)
    .map((p) => {
      const blocks = p.groups
        .map((g) => `## ${g.title}\n${(g.questions ?? []).map((q) => `- ${q}`).join('\n')}`)
        .join('\n');
      return `# ${p.name || 'Periodo anterior'}\n${blocks}`;
    })
    .join('\n\n');
  const context = prev
    ? `O2O de periodos anteriores:\n\n${prev}`
    : 'No hay periodos anteriores con preguntas; propón una batería inicial sólida.';
  const extra = instructions?.trim() ? `\n\nEnfoque pedido por el líder: ${instructions.trim()}` : '';
  return `Eres experto en gestión de equipos de ingeniería y diseñas one-to-ones (O2O). Propón una ${label} para el próximo periodo.\n\n${context}${extra}\n\nCriterios: preguntas abiertas y concretas, en español, agrupadas en bloques temáticos (p. ej. cómo van hoy, carrera y crecimiento, bienestar, feedback mutuo). No repitas literalmente las de periodos anteriores: renuévalas manteniendo continuidad. Entre 3 y 6 bloques y 2-5 preguntas por bloque. Llama a la herramienta emit_o2o_questions con el resultado.`;
}

export const o2oProposeQuestions = onCall(
  { region: 'europe-west1', secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 120 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Necesitas iniciar sesión.');

    const kind = request.data?.kind === 'form' ? 'form' : 'guide';
    const previousPeriods = Array.isArray(request.data?.previousPeriods) ? request.data.previousPeriods : [];
    const instructions = typeof request.data?.instructions === 'string' ? request.data.instructions : '';

    const db = getFirestore();
    const [adminSnap, leaderSnap] = await Promise.all([
      db.doc(`admins/${uid}`).get(),
      db.doc(`leaders/${uid}`).get(),
    ]);
    if (!adminSnap.exists && !leaderSnap.exists) {
      throw new HttpsError('permission-denied', 'Solo un líder o superadmin puede generar preguntas.');
    }

    const apiKey = ANTHROPIC_API_KEY.value();
    if (!apiKey) throw new HttpsError('failed-precondition', 'La IA no está configurada en esta instancia.');

    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: O2O_AI_MODEL,
          max_tokens: 2000,
          tools: [O2O_QUESTIONS_TOOL],
          tool_choice: { type: 'tool', name: 'emit_o2o_questions' },
          messages: [{ role: 'user', content: buildO2OPrompt(kind, previousPeriods, instructions) }],
        }),
      });
    } catch {
      throw new HttpsError('unavailable', 'No se pudo contactar con la IA. Inténtalo de nuevo.');
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`Anthropic error ${res.status}: ${detail}`);
      throw new HttpsError('internal', 'La IA no pudo generar las preguntas.');
    }
    const payload = await res.json();
    const block = (payload.content ?? []).find((c) => c.type === 'tool_use');
    if (!block) throw new HttpsError('internal', 'La IA no devolvió una propuesta válida.');
    return { kind, proposal: block.input };
  },
);

// ── DORA ───────────────────────────────────────────────────────────────────
const MS_HOUR = 3_600_000;
const toMs = (d) => new Date(d).getTime();
const round1 = (n) => Math.round(n * 10) / 10;

/** Métricas DORA de un repo a partir de sus PRs mergeados (espejo de src/tools/dora/domain/metrics.js). */
function computeRepoMetrics(mergedPrs, from, to) {
  const fromMs = toMs(from);
  const toMs2 = toMs(to);
  const lead = mergedPrs
    .map((p) => (toMs(p.mergedAt) - toMs(p.createdAt)) / MS_HOUR)
    .filter((h) => Number.isFinite(h) && h >= 0)
    .sort((a, b) => a - b);
  const deployments = mergedPrs.length;
  const weeks = Math.max(1, (toMs2 - fromMs) / (7 * 24 * MS_HOUR));
  const contributorLogins = [...new Set(mergedPrs.map((p) => (p.author ?? '').trim()).filter(Boolean))].sort();
  return {
    deployments,
    deployFrequencyPerWeek: round1(deployments / weeks),
    leadTimeHoursAvg: lead.length ? round1(lead.reduce((s, h) => s + h, 0) / lead.length) : null,
    leadTimeHoursMedian: lead.length ? round1(lead[Math.floor((lead.length - 1) / 2)]) : null,
    contributors: contributorLogins.length,
    contributorLogins,
  };
}

/**
 * Token de GitHub (secreto de la instancia). GREBLA es 1 instancia por
 * organización (multi-leader), así que este secreto es de la org y NO acopla el
 * código a ninguna en concreto: cada instancia configura su valor con
 * `firebase functions:secrets:set DORA_GITHUB_TOKEN`. Con token, la API sube de
 * 60/h públicos a 5000/h y accede a repos PRIVADOS; sin él, se cae a la pública.
 */
const DORA_GITHUB_TOKEN = defineSecret('DORA_GITHUB_TOKEN');

/** Cabeceras de GitHub; añade `Authorization: Bearer` si hay token (repos privados). */
function ghHeaders(token) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'grebla-dora' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** Mensaje legible según el código de estado de GitHub. */
function githubError(status, fullName, hasToken) {
  if (status === 404) {
    return new Error(hasToken
      ? `Repo no encontrado o el token no tiene acceso: ${fullName}.`
      : `Repo no encontrado o privado: ${fullName} (los privados necesitan token).`);
  }
  if (status === 401) return new Error('Token de GitHub inválido o caducado (DORA_GITHUB_TOKEN).');
  if (status === 403) {
    return new Error(hasToken
      ? `Sin permiso o límite de la API de GitHub para ${fullName} (revisa el scope del token).`
      : 'Límite de la API pública de GitHub (60/h sin token). Configura DORA_GITHUB_TOKEN.');
  }
  return new Error(`GitHub respondió ${status} para ${fullName}.`);
}

/** Fecha de creación del repo (para medir "desde el principio" cuando no hay fecha). */
async function fetchRepoCreatedAt(fullName, headers) {
  const res = await fetch(`https://api.github.com/repos/${fullName}`, { headers });
  if (!res.ok) throw githubError(res.status, fullName, Boolean(headers.Authorization));
  const data = await res.json();
  return data.created_at || '2008-01-01T00:00:00Z';
}

/** PRs mergeados a `baseBranch` de un repo desde `sinceMs`. Con token lee privados. */
async function fetchMergedPrs(fullName, sinceMs, baseBranch, headers) {
  const base = encodeURIComponent(baseBranch || 'main');
  const url = `https://api.github.com/repos/${fullName}/pulls?state=closed&base=${base}&per_page=100&sort=updated&direction=desc`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw githubError(res.status, fullName, Boolean(headers.Authorization));
  const arr = await res.json();
  return (Array.isArray(arr) ? arr : [])
    .filter((p) => p.merged_at && toMs(p.merged_at) >= sinceMs)
    // `number` se conserva para poder pedir después el primer commit del PR (lead time real).
    .map((p) => ({ number: p.number, createdAt: p.created_at, mergedAt: p.merged_at, author: p.user?.login || '' }));
}

/**
 * Fecha del PRIMER commit de un PR (el más antiguo). La API pública devuelve los
 * commits en orden ascendente, así que el primero del listado es el más antiguo.
 * Pedimos solo 1 (`per_page=1`) para gastar la mínima cuota. Prioriza la fecha
 * del committer y cae a la del author si falta. 1 llamada por PR.
 * @param {string} fullName  owner/repo
 * @param {number} prNumber
 * @returns {Promise<string>}  fecha ISO del primer commit ('' si no se obtiene)
 */
async function fetchFirstCommitDate(fullName, prNumber, headers) {
  const res = await fetch(
    `https://api.github.com/repos/${fullName}/pulls/${prNumber}/commits?per_page=1`,
    { headers },
  );
  if (!res.ok) throw githubError(res.status, fullName, Boolean(headers.Authorization));
  const arr = await res.json();
  const commit = (Array.isArray(arr) ? arr[0] : null)?.commit;
  return commit?.committer?.date ?? commit?.author?.date ?? '';
}

/**
 * Lead time DORA REAL (primer commit → despliegue en producción). Duplica la
 * lógica pura de src/tools/dora/domain/leadTime.js (functions/ no importa de
 * src/, igual que computeRepoMetrics es espejo de metrics.js). Casa cada cambio
 * con el PRIMER despliegue 'success' cuyo `at >= mergedAt`; sin despliegue
 * posterior el cambio queda PENDIENTE. Descarta lead times negativos/no finitos.
 * @param {{ firstCommitAt: string, mergedAt: string }[]} changes
 * @param {{ at: string, status: string }[]} deployments
 * @returns {{ leadTimeHoursAvg: number|null, leadTimeHoursMedian: number|null, deployedCount: number, pendingCount: number }}
 */
function computeLeadTimeCommitDeploy(changes, deployments) {
  const successAtMs = (Array.isArray(deployments) ? deployments : [])
    .filter((d) => d?.status === 'success')
    .map((d) => toMs(d.at))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);

  const leadHours = [];
  let pendingCount = 0;
  for (const change of Array.isArray(changes) ? changes : []) {
    const mergedMs = toMs(change?.mergedAt);
    const firstCommitMs = toMs(change?.firstCommitAt);
    if (!Number.isFinite(mergedMs) || !Number.isFinite(firstCommitMs)) {
      pendingCount += 1;
      continue;
    }
    const deployAtMs = successAtMs.find((t) => t >= mergedMs);
    if (deployAtMs === undefined) {
      pendingCount += 1;
      continue;
    }
    const hours = (deployAtMs - firstCommitMs) / MS_HOUR;
    if (Number.isFinite(hours) && hours >= 0) leadHours.push(hours);
  }

  leadHours.sort((a, b) => a - b);
  const deployedCount = leadHours.length;
  return {
    leadTimeHoursAvg: deployedCount ? round1(leadHours.reduce((s, h) => s + h, 0) / deployedCount) : null,
    leadTimeHoursMedian: deployedCount ? round1(leadHours[Math.floor((deployedCount - 1) / 2)]) : null,
    deployedCount,
    pendingCount,
  };
}

/**
 * Change Failure Rate DORA D3 (espejo de src/tools/dora/domain/changeFailureRate.js;
 * functions/ no importa de src/). Sobre los eventos de despliegue cuyo `at` cae
 * en [from, to] (inclusivo): CFR = fallidos / total × 100. Todos son de
 * 'production'. Sin despliegues en la ventana → cfrPct null (no medible; nunca 0).
 * @param {{ at: string, status: string }[]} deployments
 * @param {string} from  inicio del periodo (ISO)
 * @param {string} to    fin del periodo (ISO)
 * @returns {{ cfrPct: number|null, failed: number, total: number }}
 */
function computeChangeFailureRate(deployments, from, to) {
  const fromMs = toMs(from);
  const toMs2 = toMs(to);
  const inWindow = (Array.isArray(deployments) ? deployments : []).filter((e) => {
    const atMs = toMs(e?.at);
    return Number.isFinite(atMs) && atMs >= fromMs && atMs <= toMs2;
  });
  const total = inWindow.length;
  const failed = inWindow.filter((e) => e?.status === 'failed').length;
  return { cfrPct: total > 0 ? round1((failed / total) * 100) : null, failed, total };
}

/**
 * Mean Time to Recovery DORA D4 (espejo de src/tools/dora/domain/mttr.js;
 * functions/ no importa de src/). MTTR = downtime total ÷ nº de incidentes
 * resueltos. Un incidente RESUELTO tiene `restoredAt` no nulo; solo cuentan los
 * resueltos cuyo `restoredAt` cae en [from, to] (inclusivo). Downtime de cada uno
 * = (restoredAt − startedAt)/hora, descartando negativos/no finitos. Los abiertos
 * (`restoredAt` null) se reportan aparte. Sin resueltos → mttrHoursAvg null.
 * @param {{ startedAt: string, restoredAt: string|null }[]} incidents
 * @param {string} from  inicio del periodo (ISO)
 * @param {string} to    fin del periodo (ISO)
 * @returns {{ mttrHoursAvg: number|null, downtimeHoursTotal: number, incidentsResolved: number, incidentsOpen: number }}
 */
function computeMeanTimeToRecovery(incidents, from, to) {
  const fromMs = toMs(from);
  const toMs2 = toMs(to);
  let downtimeHoursTotal = 0;
  let incidentsResolved = 0;
  let incidentsOpen = 0;
  for (const inc of Array.isArray(incidents) ? incidents : []) {
    if (inc?.restoredAt == null) {
      incidentsOpen += 1;
      continue;
    }
    const restoredMs = toMs(inc.restoredAt);
    if (!Number.isFinite(restoredMs) || restoredMs < fromMs || restoredMs > toMs2) continue;
    const startedMs = toMs(inc?.startedAt);
    const hours = (restoredMs - startedMs) / MS_HOUR;
    if (!Number.isFinite(hours) || hours < 0) continue;
    downtimeHoursTotal += hours;
    incidentsResolved += 1;
  }
  return {
    mttrHoursAvg: incidentsResolved > 0 ? round1(downtimeHoursTotal / incidentsResolved) : null,
    downtimeHoursTotal: round1(downtimeHoursTotal),
    incidentsResolved,
    incidentsOpen,
  };
}

/** Tope de PRs por repo a los que pedimos el primer commit (mitiga el rate-limit 60/h sin token). */
const MAX_COMMIT_LOOKUPS = 50;

/** Nº de releases publicados de un repo en [sinceMs, toMs2] (despliegue real). */
async function fetchReleaseCount(fullName, sinceMs, toMs2, headers) {
  const res = await fetch(`https://api.github.com/repos/${fullName}/releases?per_page=100`, { headers });
  if (!res.ok) throw githubError(res.status, fullName, Boolean(headers.Authorization));
  const arr = await res.json();
  return (Array.isArray(arr) ? arr : []).filter((r) => {
    if (!r.published_at) return false;
    const t = toMs(r.published_at);
    return t >= sinceMs && t <= toMs2;
  }).length;
}

/** Señal de deploy normalizada (espejo de normalizeDeploySignal de usecases.js). */
function normalizeSignal(v) {
  return ['release', 'tag', 'manual'].includes(v) ? v : 'branch';
}

/** Tope de tags a los que resolvemos la fecha del commit (mitiga el rate-limit). */
const MAX_TAG_LOOKUPS = 100;

/**
 * Nº de tags que casan `pattern` cuyo commit cae en [sinceMs, toMs2] (despliegue
 * real por tag: hoop-api `YYYY.MM.DD.N`, tribbu-infra `prod-*`). Los tags de
 * GitHub NO llevan fecha, así que se resuelve la del commit apuntado (1 llamada
 * por tag, hasta el tope). Sin patrón → 0 (no se cuentan tags indiscriminados).
 * Solo la primera página de 100 tags: en repos con muchísimos tags los más
 * antiguos pueden quedar fuera (aproximación documentada, como leadTimeApproxCount).
 */
async function fetchTagCount(fullName, sinceMs, toMs2, pattern, headers) {
  if (!pattern) return 0;
  let re;
  try {
    re = new RegExp(pattern);
  } catch {
    return 0;
  }
  const res = await fetch(`https://api.github.com/repos/${fullName}/tags?per_page=100`, { headers });
  if (!res.ok) throw githubError(res.status, fullName, Boolean(headers.Authorization));
  const arr = await res.json();
  const matching = (Array.isArray(arr) ? arr : []).filter((t) => re.test(t.name)).slice(0, MAX_TAG_LOOKUPS);
  let count = 0;
  for (const tag of matching) {
    const sha = tag.commit?.sha;
    if (!sha) continue;
    try {
      const cRes = await fetch(`https://api.github.com/repos/${fullName}/commits/${sha}`, { headers });
      if (!cRes.ok) continue;
      const commit = (await cRes.json()).commit;
      const at = toMs(commit?.committer?.date ?? commit?.author?.date);
      if (Number.isFinite(at) && at >= sinceMs && at <= toMs2) count += 1;
    } catch {
      // tag no resoluble (borrado, rate-limit puntual…): se omite del recuento
    }
  }
  return count;
}

/**
 * Calcula y guarda las métricas DORA de los repos de la instancia (modelo
 * multi-leader). Acceso: superadmin o líder. Usa el token DORA_GITHUB_TOKEN si
 * está configurado (repos privados, 5000/h); si no, la API pública (60/h, solo
 * públicos).
 */
export const refreshDora = onCall(
  { region: 'europe-west1', secrets: [DORA_GITHUB_TOKEN], timeoutSeconds: 300 },
  async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Necesitas iniciar sesión.');

  // Token de la org (opcional): con él se leen privados y sube el rate-limit.
  const token = DORA_GITHUB_TOKEN.value() || '';
  const headers = ghHeaders(token);
  // Con token (5000/h) podemos pedir el primer commit de muchos más PRs.
  const maxLookups = token ? 200 : MAX_COMMIT_LOOKUPS;

  const db = getFirestore();
  // Acceso: superadmin o líder de la instancia.
  const [adminSnap, leaderSnap] = await Promise.all([
    db.doc(`admins/${uid}`).get(),
    db.doc(`leaders/${uid}`).get(),
  ]);
  if (!adminSnap.exists && !leaderSnap.exists) {
    throw new HttpsError('permission-denied', 'No tienes acceso a esta organización.');
  }

  const reposSnap = await db.collection('dora').get();
  const now = new Date().toISOString();
  const results = [];

  for (const docSnap of reposSnap.docs) {
    const repo = docSnap.data();
    try {
      // Sin fecha → desde la creación del repo en GitHub.
      const from = repo.startDate || (await fetchRepoCreatedAt(repo.fullName, headers));
      // Lead time y personas siempre desde los PR mergeados a la rama base.
      const prs = await fetchMergedPrs(repo.fullName, toMs(from), repo.baseBranch || 'main', headers);
      const metrics = computeRepoMetrics(prs, from, now);

      // Eventos de despliegue reales del repo (Admin SDK). Fuente para la señal
      // 'manual' y para lead time real, CFR y MTTR (se reutiliza más abajo).
      const deploySnap = await docSnap.ref.collection('deployments').get();
      const deployEvents = deploySnap.docs.map((d) => d.data());

      // Frecuencia de despliegue según la señal REAL del repo (no ramas de entorno):
      //  branch  → merges a la rama base (lo que ya calcula computeRepoMetrics)
      //  release → GitHub Releases · tag → tags que casan tagPattern
      //  manual  → deploy fuera de GitHub: solo eventos 'success' registrados
      const signal = normalizeSignal(repo.deploySignal);
      const weeks = Math.max(1, (toMs(now) - toMs(from)) / (7 * 24 * MS_HOUR));
      if (signal === 'release') {
        const releases = await fetchReleaseCount(repo.fullName, toMs(from), toMs(now), headers);
        metrics.deployments = releases;
        metrics.deployFrequencyPerWeek = round1(releases / weeks);
      } else if (signal === 'tag') {
        const tags = await fetchTagCount(repo.fullName, toMs(from), toMs(now), repo.tagPattern || '', headers);
        metrics.deployments = tags;
        metrics.deployFrequencyPerWeek = round1(tags / weeks);
      } else if (signal === 'manual') {
        const successInWindow = deployEvents.filter((e) => {
          const at = toMs(e?.at);
          return e?.status === 'success' && Number.isFinite(at) && at >= toMs(from) && at <= toMs(now);
        }).length;
        metrics.deployments = successInWindow;
        metrics.deployFrequencyPerWeek = round1(successInWindow / weeks);
      }
      metrics.deploySignal = signal;

      // ── Lead time REAL (primer commit → despliegue en producción, DORA D2) ──
      // El "inicio" es el primer commit de cada PR; el "fin" es el despliegue real
      // registrado (D1). Se conserva el proxy PR→merge (leadTimeHoursAvg) intacto.
      //
      // Rate-limit (CRÍTICO): la API pública permite 60 req/h por IP sin token y
      // cada PR consume 1 llamada. Por eso: (1) solo pedimos el primer commit de
      // los MAX_COMMIT_LOOKUPS PRs más recientes (prs viene ordenado por
      // updated desc); el resto aproxima con `createdAt`. (2) Cada llamada va en
      // try/catch: si falla (403/límite u otro), se aproxima con `createdAt`.
      // `leadTimeApproxCount` cuenta cuántos primeros commits son aproximados.
      //
      // OPTIMIZACIÓN: el lead time real solo se puede calcular si hay despliegues
      // 'success' registrados con los que casar los cambios; sin ellos TODO queda
      // pendiente. Por eso, si el repo no tiene despliegues registrados, NO pedimos
      // el primer commit de cada PR (serían decenas de llamadas por repo, tiradas):
      // evita agotar el rate-limit y el timeout de la function.
      const hasSuccessEvents = deployEvents.some((e) => e?.status === 'success');
      let leadTimeApproxCount = 0;
      const changes = [];
      if (hasSuccessEvents) {
        for (const [i, pr] of prs.entries()) {
          let firstCommitAt = pr.createdAt; // aproximación por defecto
          if (i < maxLookups) {
            try {
              const commitDate = await fetchFirstCommitDate(repo.fullName, pr.number, headers);
              if (commitDate) firstCommitAt = commitDate;
              else leadTimeApproxCount += 1; // respuesta sin fecha → aproximado
            } catch {
              leadTimeApproxCount += 1; // rate-limit u otro error → aproximado
            }
          } else {
            leadTimeApproxCount += 1; // por encima del tope → aproximado
          }
          changes.push({ firstCommitAt, mergedAt: pr.mergedAt });
        }
      } else {
        // Sin despliegues registrados: no hay lead time real (todo pendiente). Se
        // aproxima el inicio con createdAt sin gastar llamadas.
        for (const pr of prs) changes.push({ firstCommitAt: pr.createdAt, mergedAt: pr.mergedAt });
        leadTimeApproxCount = prs.length;
      }

      // Lead time real usa los eventos ya cargados arriba (deployEvents).
      const realLead = computeLeadTimeCommitDeploy(changes, deployEvents);
      metrics.leadTimeCommitDeployHoursAvg = realLead.leadTimeHoursAvg;
      metrics.leadTimeCommitDeployHoursMedian = realLead.leadTimeHoursMedian;
      metrics.changesDeployed = realLead.deployedCount;
      metrics.changesPending = realLead.pendingCount;

      // ── Change Failure Rate (DORA D3) ──────────────────────────────────────
      // % de despliegues a producción que fallan (requieren remediación).
      // Reutiliza `deployEvents` YA cargado (no se relee la subcolección). Si no
      // hay despliegues registrados, cfrPct = null y los contadores quedan en 0.
      const cfr = computeChangeFailureRate(deployEvents, from, now);
      metrics.changeFailureRatePct = cfr.cfrPct;
      metrics.deploymentsFailed = cfr.failed;
      metrics.deploymentsTotal = cfr.total;
      metrics.leadTimeApproxCount = leadTimeApproxCount;

      // ── Mean Time to Recovery (DORA D4) ─────────────────────────────────────
      // Tiempo medio de recuperación tras un incidente en producción, sobre los
      // incidentes registrados manualmente (subcolección /incidents del repo,
      // espejo de /deployments). Admin SDK: omite reglas.
      const incidentsSnap = await docSnap.ref.collection('incidents').get();
      const incidents = incidentsSnap.docs.map((d) => d.data());
      const mttr = computeMeanTimeToRecovery(incidents, from, now);
      metrics.mttrHoursAvg = mttr.mttrHoursAvg;
      metrics.downtimeHoursTotal = mttr.downtimeHoursTotal;
      metrics.incidentsResolved = mttr.incidentsResolved;
      metrics.incidentsOpen = mttr.incidentsOpen;

      await docSnap.ref.set({ metrics: { ...metrics, periodFrom: from, periodTo: now, computedAt: now } }, { merge: true });
      results.push({ repo: repo.fullName, ok: true, ...metrics });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await docSnap.ref.set({ metrics: { error: message, computedAt: now } }, { merge: true });
      results.push({ repo: repo.fullName, ok: false, error: message });
    }
  }

  return { computedAt: now, results };
});

// ── LEAN / Flujo (métricas de flujo del equipo desde Linear) ─────────────────
const LINEAR_API_KEY = defineSecret('LINEAR_API_KEY');
const FLOW_HOUR = 3_600_000;
const FLOW_DAY = 24 * FLOW_HOUR;
const flowRound1 = (n) => Math.round(n * 10) / 10;

/** Percentil por interpolación lineal (espejo de src/tools/lean/domain/metrics.js). */
function flowPercentile(sortedAsc, p) {
  if (!sortedAsc.length) return null;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

/** Métricas de flujo de un equipo (espejo de src/tools/lean/domain/metrics.js). */
function computeFlowMetricsFn(issues, period) {
  const list = Array.isArray(issues) ? issues : [];
  const fromMs = new Date(period.from).getTime();
  const toMs = new Date(period.to).getTime();
  const nowMs = period.now != null ? new Date(period.now).getTime() : toMs;
  const t = (d) => new Date(d).getTime();
  const completed = list.filter(
    (i) => i.stateType === 'completed' && i.completedAt && t(i.completedAt) >= fromMs && t(i.completedAt) <= toMs,
  );
  const weeks = Math.max(1, (toMs - fromMs) / (7 * FLOW_DAY));
  const cycle = completed
    .map((i) => (i.startedAt && i.completedAt ? (t(i.completedAt) - t(i.startedAt)) / FLOW_HOUR : NaN))
    .filter((h) => Number.isFinite(h) && h >= 0)
    .sort((a, b) => a - b);
  const wipIssues = list.filter((i) => i.stateType === 'started');
  const agingDays = wipIssues
    .map((i) => (i.startedAt ? (nowMs - t(i.startedAt)) / FLOW_DAY : NaN))
    .filter((d) => Number.isFinite(d) && d >= 0);
  const p50 = flowPercentile(cycle, 0.5);
  const p85 = flowPercentile(cycle, 0.85);
  return {
    completed: completed.length,
    throughputPerWeek: flowRound1(completed.length / weeks),
    cycleTimeP50Hours: p50 == null ? null : flowRound1(p50),
    cycleTimeP85Hours: p85 == null ? null : flowRound1(p85),
    wip: wipIssues.length,
    agingDaysMax: agingDays.length ? flowRound1(Math.max(...agingDays)) : null,
    agingDaysAvg: agingDays.length ? flowRound1(agingDays.reduce((s, d) => s + d, 0) / agingDays.length) : 0,
    flowEfficiencyPct: flowEfficiencyFn(completed),
  };
}

const LINEAR_ISSUES_QUERY = `
  query Issues($filter: IssueFilter, $after: String) {
    issues(first: 100, after: $after, filter: $filter) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id createdAt startedAt completedAt canceledAt state { type }
        history(first: 50) { nodes { toState { type } createdAt } }
      }
    }
  }`;

/** Tiempo activo (started) y total (started→completed) de una issue (espejo de flowEfficiency.js). */
function flowActiveAndTotalFn(issue) {
  const started = new Date(issue.startedAt).getTime();
  const completed = new Date(issue.completedAt).getTime();
  if (!(Number.isFinite(started) && Number.isFinite(completed) && completed > started)) {
    return { activeMs: 0, totalMs: 0 };
  }
  const trans = (issue.transitions ?? [])
    .map((t) => ({ stateType: t.stateType, at: new Date(t.at).getTime() }))
    .filter((t) => Number.isFinite(t.at))
    .sort((a, b) => a.at - b.at);
  let current = 'started';
  const before = trans.filter((t) => t.at <= started);
  if (before.length) current = before[before.length - 1].stateType;
  let active = 0;
  let cursor = started;
  for (const t of trans) {
    if (t.at <= started || t.at >= completed) continue;
    if (current === 'started') active += t.at - cursor;
    cursor = t.at;
    current = t.stateType;
  }
  if (current === 'started') active += completed - cursor;
  return { activeMs: active, totalMs: completed - started };
}

/** Flow efficiency agregada (% activo/total) de un conjunto de issues (espejo del dominio). */
function flowEfficiencyFn(issues) {
  let active = 0;
  let total = 0;
  for (const issue of issues ?? []) {
    const { activeMs, totalMs } = flowActiveAndTotalFn(issue);
    active += activeMs;
    total += totalMs;
  }
  return total > 0 ? Math.round((active / total) * 1000) / 10 : null;
}

/** Trae las issues con un LABEL de Linear actualizadas desde `sinceIso` (paginado, GraphQL). */
async function fetchLinearIssues(label, sinceIso, apiKey) {
  const filter = { labels: { name: { eq: label } }, updatedAt: { gte: sinceIso } };
  const out = [];
  let after = null;
  for (let page = 0; page < 50; page += 1) { // tope de seguridad (~5000 issues)
    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      body: JSON.stringify({ query: LINEAR_ISSUES_QUERY, variables: { filter, after } }),
    });
    if (!res.ok) throw new Error(`Linear respondió ${res.status}.`);
    const json = await res.json();
    if (json.errors?.length) throw new Error(json.errors[0]?.message || 'Error de la API de Linear.');
    const conn = json.data?.issues;
    if (!conn) break;
    for (const n of conn.nodes) {
      out.push({
        id: n.id,
        stateType: n.state?.type ?? 'backlog',
        createdAt: n.createdAt,
        startedAt: n.startedAt ?? null,
        completedAt: n.completedAt ?? null,
        canceledAt: n.canceledAt ?? null,
        transitions: (n.history?.nodes ?? [])
          .map((h) => ({ stateType: h.toState?.type ?? null, at: h.createdAt }))
          .filter((t) => t.stateType && t.at),
      });
    }
    if (!conn.pageInfo?.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }
  return out;
}

/**
 * Recalcula las métricas de flujo (LEAN) de todos los equipos de `/leanTeams` desde
 * Linear (ventana de 8 semanas). Acceso: superadmin o líder (como refreshDora). El
 * secreto LINEAR_API_KEY es de la instancia.
 */
export const refreshLean = onCall(
  { region: 'europe-west1', secrets: [LINEAR_API_KEY], timeoutSeconds: 300 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Necesitas iniciar sesión.');

    const db = getFirestore();
    const [adminSnap, leaderSnap] = await Promise.all([
      db.doc(`admins/${uid}`).get(),
      db.doc(`leaders/${uid}`).get(),
    ]);
    if (!adminSnap.exists && !leaderSnap.exists) {
      throw new HttpsError('permission-denied', 'No tienes acceso a esta organización.');
    }

    const apiKey = LINEAR_API_KEY.value();
    if (!apiKey) throw new HttpsError('failed-precondition', 'Linear no está configurado en esta instancia.');

    const now = new Date();
    const to = now.toISOString();
    const from = new Date(now.getTime() - 8 * 7 * FLOW_DAY).toISOString(); // 8 semanas

    const unitsSnap = await db.collection('leanTeams').get();
    const results = [];
    for (const docSnap of unitsSnap.docs) {
      const unit = docSnap.data();
      try {
        const issues = await fetchLinearIssues(unit.linearLabel, from, apiKey);
        const metrics = computeFlowMetricsFn(issues, { from, to, now: to });
        await docSnap.ref.set({ metrics: { ...metrics, periodFrom: from, periodTo: to, computedAt: to } }, { merge: true });
        results.push({ id: docSnap.id, label: unit.linearLabel, ok: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido.';
        await docSnap.ref.set({ metrics: { error: msg, computedAt: to } }, { merge: true });
        results.push({ id: docSnap.id, label: unit.linearLabel, ok: false, error: msg });
      }
    }
    return { computedAt: to, results };
  },
);

/** Grupos de labels de Linear que GREBLA mapea a unidades de flujo. */
const LEAN_LABEL_GROUPS = [
  { group: 'Squad', kind: 'squad' },
  { group: 'Chapter', kind: 'chapter' },
];
const LINEAR_GROUP_LABELS_QUERY = `
  query GroupLabels($group: String!) {
    issueLabels(filter: { parent: { name: { eq: $group } } }) { nodes { name } }
  }`;

/** Nombres de los labels que cuelgan de un grupo de Linear (p. ej. «Squad»). */
async function fetchLinearGroupLabels(group, apiKey) {
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: apiKey },
    body: JSON.stringify({ query: LINEAR_GROUP_LABELS_QUERY, variables: { group } }),
  });
  if (!res.ok) throw new Error(`Linear respondió ${res.status}.`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0]?.message || 'Error de la API de Linear.');
  return (json.data?.issueLabels?.nodes ?? []).map((n) => n.name).filter(Boolean);
}

/**
 * Auto-descubre las unidades de flujo desde los labels de Linear: los del grupo
 * «Squad» como equipos y los de «Chapter» como gremios. Crea en /leanTeams los que
 * falten (por dueño). Acceso: superadmin o líder.
 */
export const discoverLeanUnits = onCall(
  { region: 'europe-west1', secrets: [LINEAR_API_KEY], timeoutSeconds: 120 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Necesitas iniciar sesión.');

    const db = getFirestore();
    const [adminSnap, leaderSnap] = await Promise.all([
      db.doc(`admins/${uid}`).get(),
      db.doc(`leaders/${uid}`).get(),
    ]);
    if (!adminSnap.exists && !leaderSnap.exists) {
      throw new HttpsError('permission-denied', 'No tienes acceso a esta organización.');
    }

    const apiKey = LINEAR_API_KEY.value();
    if (!apiKey) throw new HttpsError('failed-precondition', 'Linear no está configurado en esta instancia.');

    const existingSnap = await db.collection('leanTeams').where('ownerLeaderUid', '==', uid).get();
    const existing = new Set(existingSnap.docs.map((d) => `${d.data().kind}:${d.data().linearLabel}`));

    const now = new Date().toISOString();
    const created = [];
    for (const { group, kind } of LEAN_LABEL_GROUPS) {
      const labels = await fetchLinearGroupLabels(group, apiKey);
      for (const name of labels) {
        const key = `${kind}:${name}`;
        if (existing.has(key)) continue;
        await db.collection('leanTeams').add({ linearLabel: name, kind, name, ownerLeaderUid: uid, createdAt: now });
        existing.add(key);
        created.push({ kind, name });
      }
    }
    return { created };
  },
);

// ── TRIBBU-COINS (CP-2): emisor único del ledger firmado ─────────────────────
//
// La emisión de tribbu-coins va SOLO por contratos (functions/coins.js, espejo
// del dominio del cliente) y la ejecuta ÚNICAMENTE esta Function: /coins es de
// solo lectura para clientes (firestore.rules) y el Admin SDK omite reglas.
// Cada apunte se encadena por hash y se firma con Cloud KMS (signer.js; sin
// COINS_KMS_KEY el apunte sale `unsigned: true` — degradación documentada).

/**
 * Añade UN apunte al ledger de forma atómica e idempotente. Transacción:
 * lee /coins/meta (seq + headHash) y el propio apunte; si el id determinista
 * ya existe NO se re-emite (idempotencia: re-visitar una ciudad retirada no
 * paga dos veces); si no, crea el apunte con seq+1 y prevHash=headHash,
 * actualiza meta y suma el delta al saldo materializado de la persona. La
 * firma KMS se pide DENTRO de la transacción (el hash depende de seq/prevHash
 * leídos); si Firestore reintenta, se re-firma el hash nuevo — coste asumido,
 * los reintentos son raros.
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {{ id: string, personId: string, delta: number, reason: string,
 *   ruleId: string, refs: Record<string, unknown> }} draft
 * @returns {Promise<boolean>} true si se emitió, false si ya existía.
 */
async function appendCoinsEntry(db, draft) {
  const metaRef = db.doc('coins/meta');
  const entryRef = db.doc(`coins/ledger/entries/${draft.id}`);
  const balanceRef = db.doc(`coins/balances/people/${draft.personId}`);
  return db.runTransaction(async (tx) => {
    const [entrySnap, metaSnap] = await Promise.all([tx.get(entryRef), tx.get(metaRef)]);
    if (entrySnap.exists) return false; // ya emitido: idempotente
    const meta = metaSnap.exists ? metaSnap.data() : null;
    const seq = (Number.isInteger(meta?.seq) ? meta.seq : 0) + 1;
    const prevHash = typeof meta?.headHash === 'string' && meta.headHash !== '' ? meta.headHash : coins.GENESIS_HASH;
    const ts = new Date().toISOString();
    /** @type {Record<string, unknown>} */
    const entry = {
      id: draft.id,
      seq,
      personId: draft.personId,
      delta: draft.delta,
      reason: draft.reason,
      ruleId: draft.ruleId,
      ruleVersion: coins.RULE_VERSION,
      refs: draft.refs,
      ts,
      prevHash,
    };
    // El marcador de degradación entra en el HASH: nadie puede quitar la firma
    // de un apunte legítimo y marcarlo unsigned sin romper la cadena.
    const unsigned = coinsKmsKeyName() === null;
    if (unsigned) entry.unsigned = true;
    const hash = coins.sha256Hex(coins.canonicalEntry(entry));
    const signature = unsigned ? null : await sign(hash); // un fallo de KMS lanza: no se escribe nada
    tx.create(entryRef, signature ? { ...entry, hash, sig: signature.sig, kid: signature.kid } : { ...entry, hash });
    tx.set(metaRef, { seq, headHash: hash, updatedAt: ts }, { merge: true });
    tx.set(balanceRef, { balance: FieldValue.increment(draft.delta), updatedAt: ts }, { merge: true });
    return true;
  });
}

/**
 * Doc de una isla (/careerMap/{islandId}) cacheado por ejecución: varios
 * certificados de la misma isla en un mismo write no la releen.
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {Map<string, Record<string, unknown>|null>} cache
 * @param {string} islandId
 * @returns {Promise<Record<string, unknown>|null>}
 */
async function loadIslandDoc(db, cache, islandId) {
  if (!cache.has(islandId)) {
    const snap = await db.doc(`careerMap/${islandId}`).get();
    cache.set(islandId, snap.exists ? snap.data() : null);
  }
  return cache.get(islandId) ?? null;
}

/**
 * EMISOR de tribbu-coins: trigger sobre el journey de cada persona
 * (/people/{personId}/career/journey). En cada escritura:
 *  1. Diff de visitedCities (solo AÑADIDAS) → apuntes `cert:` con el peso de
 *     la ciudad leído del doc de su isla (disciplina = prefijo del cityId,
 *     resuelta contra el índice /careerMap/_archipelago; cacheado por
 *     ejecución).
 *  2. Recalcula ciudadanías y badges con la MISMA lógica que el cliente
 *     (aritmética entera de citizenship.js) → apuntes `citz:` y `badge:`.
 *  3. Carpools del personId (query memberIds array-contains) cuya ruta esté
 *     COMPLETA (ruta ⊆ visitadas) → apuntes `carpool:`.
 * Todos los apuntes tienen id determinista: los ya emitidos se saltan dentro
 * de la transacción (idempotencia), así que re-ejecutar el trigger nunca
 * duplica coins. Retirar ciudades no resta: el ledger es historia.
 */
export const emitCoinsOnJourneyWrite = onDocumentWritten(
  { document: 'people/{personId}/career/journey', region: 'europe-west1' },
  async (event) => {
    const personId = event.params.personId;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    if (!after) return; // journey borrado: el ledger es historia, no se emite ni se resta

    const db = getFirestore();
    // Índice del archipiélago: imprescindible para pesos (isla de cada ciudad)
    // y ciudadanías. Sin él no se puede emitir NADA con garantías: se avisa
    // alto y se sale (los apuntes pendientes saldrán en el próximo write, los
    // ids deterministas lo permiten). Nunca se emite con datos inventados.
    const archSnap = await db.doc('careerMap/_archipelago').get();
    if (!archSnap.exists) {
      console.error('[coins] Falta /careerMap/_archipelago: no se emiten tribbu-coins en este write.');
      return;
    }
    const islands = coins.normalizeIslands(archSnap.data().islands);
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const visited = [
      ...new Set(
        (Array.isArray(after.visitedCities) ? after.visitedCities : [])
          .filter((c) => typeof c === 'string' && c.trim() !== '')
          .map((c) => c.trim()),
      ),
    ];
    const added = coins.addedCities(before?.visitedCities, after.visitedCities);

    /** @type {{ id: string, personId: string, delta: number, reason: string, ruleId: string, refs: Record<string, unknown> }[]} */
    const drafts = [];

    // 1) Certificados: solo las ciudades AÑADIDAS en este write.
    const islandCache = new Map();
    for (const cityId of added) {
      const discipline = cityId.includes('/') ? cityId.slice(0, cityId.indexOf('/')) : '';
      const islandRef = islands.find((i) => i.discipline === discipline);
      if (!islandRef) {
        console.warn(`[coins] Ciudad «${cityId}» sin isla en el índice (disciplina «${discipline}»): sin apunte.`);
        continue;
      }
      const map = await loadIslandDoc(db, islandCache, islandRef.id);
      const city = (Array.isArray(map?.cities) ? map.cities : []).find((c) => c?.id === cityId);
      const weight = Number(city?.weight);
      if (!city || !Number.isInteger(weight) || weight < 1 || weight > 3) {
        console.warn(`[coins] Ciudad «${cityId}» sin peso 1-3 en /careerMap/${islandRef.id}: sin apunte.`);
        continue;
      }
      drafts.push({
        id: coins.certEntryId(personId, cityId),
        personId,
        delta: coins.CONTRACTS_V1.certificate(weight),
        reason: `Certificado de ${city.name ?? cityId}`,
        ruleId: 'certificate',
        refs: { cityId, cityName: String(city.name ?? cityId), islandId: islandRef.id, weight },
      });
    }

    // 2) Ciudadanías y badges: recomputo completo (espejo del cliente). Los
    // ids deterministas hacen que las ya emitidas se salten solas.
    const achieved = coins.achievedCitizenships(visited, islands);
    for (const isle of achieved) {
      drafts.push({
        id: coins.citizenshipEntryId(personId, isle.id),
        personId,
        delta: coins.CONTRACTS_V1.citizenship,
        reason: `Ciudadanía de ${isle.name}`,
        ruleId: 'citizenship',
        refs: { islandId: isle.id, islandName: isle.name },
      });
    }
    const badges = coins.earnedBadges(achieved);
    if (badges.superCitizen) {
      drafts.push({
        id: coins.badgeEntryId(personId, 'superCitizen'),
        personId,
        delta: coins.CONTRACTS_V1.superCitizen,
        reason: 'Badge ⭐ Super-ciudadano del archipiélago',
        ruleId: 'superCitizen',
        refs: { badge: 'superCitizen' },
      });
    }
    if (badges.legend) {
      drafts.push({
        id: coins.badgeEntryId(personId, 'legend'),
        personId,
        delta: coins.CONTRACTS_V1.legend,
        reason: 'Badge 👑 Leyenda del archipiélago',
        ruleId: 'legend',
        refs: { badge: 'legend' },
      });
    }

    // 3) Carpools con la ruta COMPLETA por esta persona (ruta ⊆ visitadas).
    // Cualquier estado del carpool vale: completar la ruta es el contrato (el
    // status 'closed' retira el grupo del tablón, no el mérito del viaje).
    const visitedSet = new Set(visited);
    const carpoolsSnap = await db.collection('carpools').where('memberIds', 'array-contains', personId).get();
    for (const docSnap of carpoolsSnap.docs) {
      const data = docSnap.data();
      const routeCityIds = (Array.isArray(data.route) ? data.route : [])
        .map((stop) => String(stop?.cityId ?? '').trim())
        .filter((cityId) => cityId !== '');
      if (routeCityIds.length === 0) continue; // sin ruta no hay contrato que cumplir
      if (!routeCityIds.every((cityId) => visitedSet.has(cityId))) continue;
      drafts.push({
        id: coins.carpoolEntryId(docSnap.id, personId),
        personId,
        delta: coins.CONTRACTS_V1.carpoolCompleted(routeCityIds.length),
        reason: `Carpool «${data.name ?? docSnap.id}» completado`,
        ruleId: 'carpoolCompleted',
        refs: { carpoolId: docSnap.id, carpoolName: String(data.name ?? docSnap.id), stops: routeCityIds.length },
      });
    }

    // Emisión SECUENCIAL (la cadena de hashes exige un orden): cada apunte en
    // su transacción; los ya existentes se saltan dentro de ella.
    let emitted = 0;
    for (const draft of drafts) {
      if (await appendCoinsEntry(db, draft)) emitted += 1;
    }
    if (emitted > 0) {
      console.log(`[coins] ${emitted} apunte(s) emitido(s) para ${personId} (${drafts.length} candidatos).`);
    }
  },
);
