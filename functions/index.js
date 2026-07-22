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
import { computePulseAggregate, departmentOf } from './pulseAggregate.js';

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
  } catch (err) {
    // Alta sin login previo (RMR-TSK-0230, mismo patrón que manageAccess): se
    // provisiona la cuenta con el Admin SDK; Firebase vincula sola el primer
    // login real con Google a este email (misma política "una cuenta por email").
    if (err?.code !== 'auth/user-not-found') {
      throw new HttpsError('not-found', `No existe ningún usuario con el email ${email}. Debe iniciar sesión al menos una vez.`);
    }
    try {
      user = await getAuth().createUser({ email });
    } catch {
      throw new HttpsError('invalid-argument', `No se pudo crear la cuenta para ${email}. Comprueba que el email es correcto.`);
    }
  }

  await getAuth().setCustomUserClaims(user.uid, { admin: true });
  await getFirestore().doc(`admins/${user.uid}`).set(
    {
      email: user.email ?? email,
      displayName: user.displayName ?? user.email ?? email,
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
  } catch (err) {
    // Alta (RMR-TSK-0228): el superadmin puede añadir un líder/viewer aunque
    // nunca haya iniciado sesión — se PROVISIONA la cuenta con el Admin SDK.
    // Firebase Auth vincula solo (misma cuenta, mismo uid) el primer login real
    // con Google a este email, por la política por defecto «una cuenta por
    // email»: no hace falta un patrón de invitación/sellado aparte. Al borrar
    // acceso no se provisiona nada (no tendría sentido crear una cuenta para
    // quitarle el rol).
    if (action !== 'add' || err?.code !== 'auth/user-not-found') {
      throw new HttpsError('not-found', `No existe ningún usuario con el email ${email}. Debe iniciar sesión al menos una vez.`);
    }
    try {
      user = await getAuth().createUser({ email });
    } catch {
      throw new HttpsError('invalid-argument', `No se pudo crear la cuenta para ${email}. Comprueba que el email es correcto.`);
    }
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
const O2O_GROUPS_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Título del bloque temático.' },
      questions: { type: 'array', items: { type: 'string' } },
    },
    required: ['title', 'questions'],
  },
};
const O2O_PREP_TOOL = {
  name: 'emit_o2o_prep',
  description: 'Devuelve la preparación completa del O2O: guía (durante) y formulario previo (antes), a la vez.',
  input_schema: {
    type: 'object',
    properties: {
      guide: {
        type: 'object',
        description: 'Guía de temas y preguntas para el líder DURANTE el O2O.',
        properties: { groups: O2O_GROUPS_SCHEMA },
        required: ['groups'],
      },
      form: {
        type: 'object',
        description: 'Formulario previo para que la persona reflexione ANTES del O2O.',
        properties: {
          intro: { type: 'string', description: 'Cabecera del formulario (lo que ve la persona).' },
          groups: O2O_GROUPS_SCHEMA,
        },
        required: ['groups'],
      },
    },
    required: ['guide', 'form'],
  },
};

/** Renderiza los grupos de una batería (guía o formulario) como markdown para el prompt. */
function renderO2OGroups(groups) {
  return (Array.isArray(groups) ? groups : [])
    .filter((g) => Array.isArray(g?.questions) && g.questions.length)
    .map((g) => `## ${g.title}\n${g.questions.map((q) => `- ${q}`).join('\n')}`)
    .join('\n');
}

/** Construye el prompt unificado (guía + formulario) con el histórico de O2O anteriores. */
function buildO2OPrompt(focus, previousPeriods) {
  const prev = (previousPeriods ?? [])
    .filter((p) => (Array.isArray(p?.guide) && p.guide.length) || (Array.isArray(p?.form) && p.form.length))
    .map((p) => {
      const guide = renderO2OGroups(p.guide);
      const form = renderO2OGroups(p.form);
      const parts = [];
      if (guide) parts.push(`### Guía (durante)\n${guide}`);
      if (form) parts.push(`### Formulario previo (antes)\n${form}`);
      return `# ${p.name || 'Periodo anterior'}\n${parts.join('\n\n')}`;
    })
    .join('\n\n');
  const context = prev
    ? `Histórico de O2O anteriores (guías y formularios ya usados):\n\n${prev}`
    : 'No hay O2O anteriores; propón una preparación inicial sólida.';
  const theFocus = focus?.trim()
    ? focus.trim()
    : 'un O2O centrado en la persona: cómo va su trabajo ahora, crecimiento y carrera, bienestar y carga, feedback mutuo, y obstáculos y apoyo que necesita';
  return `Eres experto en gestión de equipos de ingeniería y diseñas one-to-ones (O2O). Tu tarea: preparar el PRÓXIMO O2O generando DOS baterías coherentes entre sí:
1) el FORMULARIO PREVIO: temas para que la persona reflexione ANTES (con una breve cabecera motivadora), y
2) la GUÍA: temas y preguntas para que el líder conduzca la conversación DURANTE el O2O.
La guía debe recoger y profundizar lo que el formulario previo pide reflexionar; no deben ir por separado.

ENFOQUE del O2O: ${theFocus}.

${context}

HILO CONDUCTOR: este O2O CONTINÚA a los anteriores, no empieza de cero. Retoma los temas que quedaron abiertos y haz evolucionar la conversación. NO repitas las preguntas ya usadas en O2O anteriores —salvo que quieras medir la evolución de algo concreto; en ese caso, reformúlala dejando claro que se compara con la vez anterior—.

Criterios: preguntas abiertas y concretas, en español, agrupadas en 3-6 bloques temáticos por batería (2-5 preguntas por bloque), cubriendo los ejes del enfoque sin forzarlos todos si no aplican. Llama a la herramienta emit_o2o_prep con el resultado.`;
}

export const o2oProposeQuestions = onCall(
  { region: 'europe-west1', secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 120 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Necesitas iniciar sesión.');

    const focus = typeof request.data?.focus === 'string' ? request.data.focus : '';
    const previousPeriods = Array.isArray(request.data?.previousPeriods) ? request.data.previousPeriods : [];

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
          max_tokens: 3000,
          tools: [O2O_PREP_TOOL],
          tool_choice: { type: 'tool', name: 'emit_o2o_prep' },
          messages: [{ role: 'user', content: buildO2OPrompt(focus, previousPeriods) }],
        }),
      });
    } catch {
      throw new HttpsError('unavailable', 'No se pudo contactar con la IA. Inténtalo de nuevo.');
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`Anthropic error ${res.status}: ${detail}`);
      throw new HttpsError('internal', 'La IA no pudo generar la preparación.');
    }
    const payload = await res.json();
    const block = (payload.content ?? []).find((c) => c.type === 'tool_use');
    if (!block) throw new HttpsError('internal', 'La IA no devolvió una propuesta válida.');
    return { proposal: block.input };
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

/**
 * Tope de PRs por repo a los que pedimos el primer commit (lead time exacto).
 * Sin token se queda bajo para no agotar la cuota pública (60/h); CON token el
 * llamante sube el tope (5000/h), ver `maxLookups` en refreshDora. Por encima
 * del tope, el lead time de esa PR se aproxima.
 */
const MAX_COMMIT_LOOKUPS = 50;

/**
 * Despliegues observados como runs de un workflow de GitHub Actions
 * (deploySignal='workflow'): el job nocturno de Fastlane, un push→Cloud Run, etc.
 * SOLO LECTURA (GET). Devuelve runs completados en la ventana, separando
 * exitosos de fallidos para poder derivar el Change Failure Rate.
 * @returns {Promise<{ success: number, failed: number }>}
 */
async function fetchWorkflowRunCounts(fullName, workflowFile, sinceMs, toMs2, headers) {
  const file = String(workflowFile ?? '').trim();
  if (!file) return { success: 0, failed: 0 };
  const created = `>=${new Date(sinceMs).toISOString().slice(0, 10)}`;
  const url = `https://api.github.com/repos/${fullName}/actions/workflows/${encodeURIComponent(file)}`
    + `/runs?per_page=100&status=completed&created=${encodeURIComponent(created)}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw githubError(res.status, fullName, Boolean(headers.Authorization));
  const body = await res.json();
  let success = 0;
  let failed = 0;
  for (const run of body.workflow_runs ?? []) {
    const at = Date.parse(run.updated_at ?? run.created_at ?? '');
    if (!Number.isFinite(at) || at < sinceMs || at > toMs2) continue;
    if (run.conclusion === 'success') success += 1;
    else if (run.conclusion === 'failure') failed += 1;
  }
  return { success, failed };
}

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
  return ['release', 'tag', 'workflow', 'manual'].includes(v) ? v : 'branch';
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
      } else if (signal === 'workflow') {
        // El despliegue es un JOB de Actions (nocturno de Fastlane, push→Cloud
        // Run…): cada run exitoso es un despliegue y los fallidos dan el CFR sin
        // registrar nada a mano.
        const runs = await fetchWorkflowRunCounts(
          repo.fullName, repo.workflowFile, toMs(from), toMs(now), headers,
        );
        metrics.deployments = runs.success;
        metrics.deployFrequencyPerWeek = round1(runs.success / weeks);
        metrics.workflowRunsFailed = runs.failed;
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
      // Con señal 'workflow' el CFR sale de los propios runs (fallidos/total) si
      // no se han registrado despliegues a mano: es observable, no hay que
      // teclear nada. Los eventos manuales, si los hay, mandan sobre esto.
      if (signal === 'workflow' && cfr.total === 0) {
        const failed = metrics.workflowRunsFailed ?? 0;
        const total = (metrics.deployments ?? 0) + failed;
        if (total > 0) {
          metrics.deploymentsFailed = failed;
          metrics.deploymentsTotal = total;
          metrics.changeFailureRatePct = round1((failed / total) * 100);
        }
      }
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
  // Top-3 issues en curso más antiguas (con enlace a Linear); espejo del dominio.
  const oldestWip = wipIssues
    .filter((i) => i.startedAt)
    .map((i) => ({ issue: i, days: (nowMs - t(i.startedAt)) / FLOW_DAY }))
    .filter((x) => Number.isFinite(x.days) && x.days >= 0)
    .sort((a, b) => b.days - a.days)
    .slice(0, 3)
    .map((x) => ({
      identifier: x.issue.identifier ?? x.issue.id,
      url: x.issue.url ?? null,
      title: x.issue.title ?? '',
      agingDays: flowRound1(x.days),
      // Columna de Linear: sin ella un atasco de 10 d en «In Review» se lee
      // igual que en «In Progress», y no es lo mismo (RMR-TSK-0271).
      stateName: x.issue.stateName ?? null,
    }));
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
    oldestWip,
    flowEfficiencyPct: flowEfficiencyFn(completed),
  };
}

const LINEAR_ISSUES_QUERY = `
  query Issues($filter: IssueFilter, $after: String) {
    issues(first: 100, after: $after, filter: $filter) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id identifier url title createdAt startedAt completedAt canceledAt state { type name }
        history(first: 50) { nodes { toState { type name } createdAt } }
      }
    }
  }`;

// Nombres de estado `started` de Linear que cuentan como TRABAJO ACTIVO (touch time).
// Criterio estricto: review/QA/colas/bloqueos son espera. Espejo de ACTIVE_STATE_NAMES
// en src/tools/lean/domain/flowEfficiency.js.
const LEAN_ACTIVE_STATE_NAMES = new Set(['doing', 'in progress', 'breakdown parents']);
const leanIsActiveWork = (stateType, stateName) =>
  stateType === 'started' && LEAN_ACTIVE_STATE_NAMES.has(String(stateName ?? '').trim().toLowerCase());

/** Tiempo activo y total (started→completed) de una issue (espejo de flowEfficiency.js). */
function flowActiveAndTotalFn(issue) {
  const started = new Date(issue.startedAt).getTime();
  const completed = new Date(issue.completedAt).getTime();
  if (!(Number.isFinite(started) && Number.isFinite(completed) && completed > started)) {
    return { activeMs: 0, totalMs: 0 };
  }
  const trans = (issue.transitions ?? [])
    .map((t) => ({ active: leanIsActiveWork(t.stateType, t.stateName), at: new Date(t.at).getTime() }))
    .filter((t) => Number.isFinite(t.at))
    .sort((a, b) => a.at - b.at);
  let current = true;
  const before = trans.filter((t) => t.at <= started);
  if (before.length) current = before[before.length - 1].active;
  let active = 0;
  let cursor = started;
  for (const t of trans) {
    if (t.at <= started || t.at >= completed) continue;
    if (current) active += t.at - cursor;
    cursor = t.at;
    current = t.active;
  }
  if (current) active += completed - cursor;
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
        identifier: n.identifier ?? n.id,
        url: n.url ?? null,
        title: n.title ?? '',
        stateType: n.state?.type ?? 'backlog',
        stateName: n.state?.name ?? null,
        createdAt: n.createdAt,
        startedAt: n.startedAt ?? null,
        completedAt: n.completedAt ?? null,
        canceledAt: n.canceledAt ?? null,
        transitions: (n.history?.nodes ?? [])
          .map((h) => ({ stateType: h.toState?.type ?? null, stateName: h.toState?.name ?? null, at: h.createdAt }))
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

// ── Interpretación de métricas con IA (LEAN / DORA) ──────────────────────────
const INTERPRET_TOOL = {
  name: 'emit_interpretation',
  description: 'Devuelve la interpretación de las métricas del equipo.',
  input_schema: {
    type: 'object',
    properties: {
      verdict: { type: 'string', enum: ['bien', 'regular', 'mal'], description: 'Veredicto general.' },
      summary: { type: 'string', description: 'Resumen claro de 2-3 frases, en español.' },
      causes: { type: 'array', items: { type: 'string' }, description: 'Causas probables (correlacionando métricas).' },
      recommendations: { type: 'array', items: { type: 'string' }, description: 'Acciones recomendadas.' },
    },
    required: ['verdict', 'summary'],
  },
};

/** Prompt de interpretación según la herramienta (lean/dora). */
function buildInterpretPrompt(tool, summary) {
  const context = tool === 'dora'
    ? 'métricas DORA de ENTREGA (deploy frequency, lead time, change failure rate, MTTR)'
    : 'métricas LEAN de FLUJO (throughput/semana, cycle time p50/p85, WIP, aging en días, flow efficiency %)';
  const refs = tool === 'dora'
    ? 'Referencias DORA: elite = deploy diario y lead time < 1h; low = lead time > 1 semana.'
    : 'Referencias LEAN: flow efficiency típica 15-25% (>40% muy buena, <15% mala); un WIP con aging > 2 semanas es un atasco; throughput y WIP dependen del tamaño del equipo (no juzgar en absoluto).';
  return `Eres experto en rendimiento de equipos de ingeniería. Tienes las ${context} de uno o varios equipos/gremios (SIEMPRE a nivel de equipo/sistema, NUNCA de personas). Interprétalas EN CONJUNTO, correlacionando unas con otras.

Datos (JSON):
${JSON.stringify(summary)}

${refs}

Llama a emit_interpretation con: un veredicto (bien/regular/mal), un resumen de 2-3 frases, las causas PROBABLES de lo que ves y recomendaciones accionables. Todo en español. No menciones ni evalúes a personas concretas.`;
}

/**
 * Interpreta un conjunto de métricas (LEAN o DORA) con Claude: veredicto, resumen,
 * causas probables y recomendaciones. El cliente manda el resumen ya calculado.
 * Acceso: superadmin o líder.
 */
export const interpretMetrics = onCall(
  { region: 'europe-west1', secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 120 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Necesitas iniciar sesión.');

    const tool = request.data?.tool === 'dora' ? 'dora' : 'lean';
    const summary = request.data?.summary ?? {};

    const db = getFirestore();
    // Solo el superadmin refresca la interpretación (el resto la ve guardada).
    const adminSnap = await db.doc(`admins/${uid}`).get();
    if (!adminSnap.exists) {
      throw new HttpsError('permission-denied', 'Solo un superadmin puede interpretar.');
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
          max_tokens: 1500,
          tools: [INTERPRET_TOOL],
          tool_choice: { type: 'tool', name: 'emit_interpretation' },
          messages: [{ role: 'user', content: buildInterpretPrompt(tool, summary) }],
        }),
      });
    } catch {
      throw new HttpsError('unavailable', 'No se pudo contactar con la IA. Inténtalo de nuevo.');
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`Anthropic error ${res.status}: ${detail}`);
      throw new HttpsError('internal', 'La IA no pudo interpretar las métricas.');
    }
    const payload = await res.json();
    const block = (payload.content ?? []).find((c) => c.type === 'tool_use');
    if (!block) throw new HttpsError('internal', 'La IA no devolvió una interpretación válida.');
    // Persistir la interpretación VIGENTE de la herramienta (sobrescribe), con la
    // fecha del server y el autor, para que quien abra LEAN/DORA la vea aunque no
    // la haya generado. Escribe la Function (Admin SDK); el cliente solo lee.
    const record = {
      ...block.input,
      at: new Date().toISOString(),
      by: { uid, name: request.auth?.token?.name ?? '' },
    };
    await db.doc(`interpretations/${tool}`).set(record);
    return { interpretation: record };
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

// ─────────────────────────────────────────────────────────────────────────────
// MOTIVADORES — agregados públicos (espejo de src/tools/motivators/domain/aggregate.js)
// ─────────────────────────────────────────────────────────────────────────────

const MOTIVATOR_DECK_SIZE = 10;

// Ids de carta por juego (espejo de src/tools/motivators/domain/decks.js). Solo
// los ids: los textos viven en el cliente; aquí solo se necesita el universo.
const MOTIVATOR_DECK_IDS = {
  moving_motivators: ['curiosity', 'honor', 'acceptance', 'mastery', 'power', 'freedom', 'relatedness', 'order', 'goal', 'status'],
  affective_motivators: ['listening', 'trust', 'authenticity', 'psychological_safety', 'accompanied_vulnerability', 'holistic_care', 'belonging', 'growth_support', 'mutual_commitment', 'closeness'],
};

const motRound1 = (n) => (n == null ? null : Math.round(n * 10) / 10);
const motMean = (xs) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);
function motMedian(xs) {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/** Estadística de un motivador (espejo de statFor del dominio). */
function motStatFor(motivadorId, positions, size) {
  const distribution = Array.from({ length: size }, () => 0);
  for (const p of positions) {
    if (p >= 1 && p <= size) distribution[p - 1] += 1;
  }
  const respondents = positions.length;
  const top3Count = positions.filter((p) => p <= 3).length;
  return {
    motivadorId,
    averagePosition: motRound1(motMean(positions)),
    medianPosition: motRound1(motMedian(positions)),
    top3Count,
    top3Pct: respondents === 0 ? null : motRound1((top3Count / respondents) * 100),
    distribution,
    respondents,
  };
}

/** Corte agregado (espejo de aggregateBlock del dominio). */
function motAggregateBlock(sessions, cardIds, size) {
  const positionsByCard = new Map(cardIds.map((id) => [id, []]));
  for (const s of sessions ?? []) {
    for (const { motivadorId, posicion } of s.orden ?? []) {
      const bucket = positionsByCard.get(motivadorId);
      if (bucket) bucket.push(posicion);
    }
  }
  const byMotivator = {};
  for (const id of cardIds) byMotivator[id] = motStatFor(id, positionsByCard.get(id) ?? [], size);
  const rankKey = (stat) => (stat.averagePosition == null ? Number.POSITIVE_INFINITY : stat.averagePosition);
  const ranking = cardIds.map((id) => byMotivator[id]).sort((a, b) => rankKey(a) - rankKey(b));
  return { respondents: (sessions ?? []).length, byMotivator, ranking };
}

function motGroupBy(sessions, keyOf) {
  const groups = new Map();
  for (const s of sessions ?? []) {
    const key = keyOf(s);
    if (key == null) continue;
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }
  return groups;
}

/**
 * Mínimo de respuestas para publicar un corte (RMR-BUG-0051). Espejo de
 * MIN_RESPONDENTS en src/tools/motivators/domain/aggregate.js. Con menos, la
 * distribución y la posición media reconstruyen lo que eligió cada persona.
 */
const MOT_MIN_RESPONDENTS = 3;

/** Corte retenido por anonimato: conserva el recuento, no lo que eligieron. */
function motWithheldBlock(respondents, cardIds, size) {
  return { ...motAggregateBlock([], cardIds, size), respondents };
}

/** Agregados completos de un juego (espejo de computeAggregates del dominio). */
function motComputeAggregates(sessions, cardIds, game, orderedRoundIds, size, minCount = MOT_MIN_RESPONDENTS, departmentByLeader = {}) {
  const all = sessions ?? [];
  const byRoundSessions = motGroupBy(all, (s) => s.roundId);
  const byLeaderSessions = motGroupBy(all, (s) => s.equipoId);
  // Corte por departamento (RMR-TSK-0296): junta los equipos del mismo Head.
  const byDeptSessions = motGroupBy(all, (s) => departmentByLeader[s.equipoId] ?? null);

  // Los cortes por debajo del umbral NO se escriben: el documento es público
  // para cualquier autenticado, así que lo que no se publica es lo único que
  // de verdad queda protegido.
  const byRound = {};
  for (const [roundId, list] of byRoundSessions) {
    if (list.length < minCount) continue;
    byRound[roundId] = motAggregateBlock(list, cardIds, size);
  }
  const byLeader = {};
  for (const [leaderId, list] of byLeaderSessions) {
    if (list.length < minCount) continue;
    byLeader[leaderId] = motAggregateBlock(list, cardIds, size);
  }
  const byDepartment = {};
  for (const [dept, list] of byDeptSessions) {
    if (list.length < minCount) continue;
    byDepartment[dept] = motAggregateBlock(list, cardIds, size);
  }

  const roundOrder = orderedRoundIds.length > 0 ? orderedRoundIds : [...byRoundSessions.keys()];
  const evolution = {};
  for (const id of cardIds) {
    evolution[id] = roundOrder
      .filter((roundId) => byRound[roundId])
      .map((roundId) => ({ roundId, averagePosition: byRound[roundId].byMotivator[id]?.averagePosition ?? null }));
  }

  return {
    game,
    respondents: all.length,
    minCount,
    global: all.length >= minCount
      ? motAggregateBlock(all, cardIds, size)
      : motWithheldBlock(all.length, cardIds, size),
    byRound,
    byLeader,
    byDepartment,
    evolution,
    updatedAt: new Date().toISOString(),
  };
}

const motToMs = (v) => {
  if (v == null) return 0;
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  const ms = new Date(v).getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

/**
 * Recalcula el documento público /motivatorAggregates/{game} cada vez que se
 * crea, edita o borra una sesión. Publica medias, medianas, top-3 y distribución
 * por motivador, y SOLO de los cortes que llegan al umbral de anonimato
 * (RMR-BUG-0051): con una o dos respuestas esos mismos números reconstruyen el
 * orden que eligió una persona concreta. Admin SDK (omite reglas).
 */
export const onMotivatorSessionWritten = onDocumentWritten(
  { region: 'europe-west1', document: 'motivatorSessions/{sessionId}' },
  async (event) => {
    const after = event.data?.after;
    const before = event.data?.before;
    const game = after?.exists ? after.data()?.game : before?.data()?.game;
    if (!game || !MOTIVATOR_DECK_IDS[game]) {
      console.warn(`[motivators] sesión sin juego válido, se ignora: ${game}`);
      return;
    }
    const db = getFirestore();
    const [sessionsSnap, roundsSnap, leadersSnap, headsSnap] = await Promise.all([
      db.collection('motivatorSessions').where('game', '==', game).get(),
      db.collection('motivatorRounds').where('game', '==', game).get(),
      db.collection('leaders').get(),
      db.collection('supermanagers').get(),
    ]);
    // Jerarquía para el corte por departamento (RMR-TSK-0296): equipoId ya ES un
    // leaderUid, así que basta con saber de qué Head cuelga cada manager.
    const reportsToByUid = {};
    for (const d of leadersSnap.docs) reportsToByUid[d.id] = d.data().reportsTo ?? null;
    const headNames = new Map();
    for (const d of headsSnap.docs) headNames.set(d.id, d.data().displayName || d.data().email || d.id);
    const headUids = new Set(headNames.keys());
    // Se agrupa por UID del Head (clave estable): dos Heads pueden llamarse
    // igual, y fundir sus ramas mezclaría departamentos distintos.
    /** @type {Record<string, string>} leaderUid → uid del Head */
    const departmentByLeader = {};
    for (const leaderUid of Object.keys(reportsToByUid)) {
      const headUid = departmentOf(leaderUid, reportsToByUid, headUids);
      if (headUid) departmentByLeader[leaderUid] = headUid;
    }
    const sessions = sessionsSnap.docs.map((d) => d.data());
    const orderedRoundIds = roundsSnap.docs
      .map((d) => ({ id: d.id, startMs: motToMs(d.data().startAt) }))
      .sort((a, b) => a.startMs - b.startMs)
      .map((r) => r.id);

    const aggregates = motComputeAggregates(
      sessions, MOTIVATOR_DECK_IDS[game], game, orderedRoundIds, MOTIVATOR_DECK_SIZE,
      MOT_MIN_RESPONDENTS, departmentByLeader,
    );
    // Nombres aparte de la agrupación, solo para mostrarlos.
    await db.doc(`motivatorAggregates/${game}`).set({
      ...aggregates,
      departmentNames: Object.fromEntries(headNames),
    });
    console.log(`[motivators] agregados de ${game} recalculados (${sessions.length} sesiones).`);
  },
);

/**
 * Marea (RMR-TSK-0236): recalcula /pulseAggregates/{weekIso} cada vez que alguien
 * registra o edita su marea. Solo expone AGREGADOS ANÓNIMOS (medias por dimensión,
 * general + por gremio + por label/squad + por departamento) y solo de grupos
 * con >=3 respuestas.
 * Los registros individuales (/pulse/{uid}/entries) NUNCA se exponen. Admin SDK.
 */
export const aggregatePulse = onDocumentWritten(
  { region: 'europe-west1', document: 'pulse/{uid}/entries/{day}' },
  async (event) => {
    const after = event.data?.after;
    const before = event.data?.before;
    const weekIso = after?.exists ? after.data()?.weekIso : before?.data()?.weekIso;
    if (!weekIso) {
      console.warn('[marea] entrada sin weekIso, se ignora');
      return;
    }
    const db = getFirestore();
    // collectionGroup('entries') roza el ledger de coins, pero esas entradas no
    // tienen weekIso, así que el filtro las excluye (y el índice solo indexa las
    // que sí lo tienen). El mapa uid→persona da los gremios/labels (nombres).
    const [entriesSnap, peopleSnap, leadersSnap, headsSnap] = await Promise.all([
      db.collectionGroup('entries').where('weekIso', '==', weekIso).get(),
      db.collection('people').get(),
      db.collection('leaders').get(),
      db.collection('supermanagers').get(),
    ]);
    const entries = entriesSnap.docs.map((d) => d.data());
    // Jerarquía para el corte por departamento (RMR-TSK-0296): de cada manager,
    // a quién reporta; y qué uids son Head, con su nombre visible. El eje se
    // guarda por NOMBRE, igual que gremios y squads, para que la vista no tenga
    // que resolver uids.
    /** @type {Record<string, string|null>} */
    const reportsToByUid = {};
    for (const doc of leadersSnap.docs) reportsToByUid[doc.id] = doc.data().reportsTo ?? null;
    /** @type {Map<string, string>} */
    const headNames = new Map();
    for (const doc of headsSnap.docs) {
      const h = doc.data();
      headNames.set(doc.id, h.displayName || h.email || doc.id);
    }
    const headUids = new Set(headNames.keys());
    /** @type {Record<string, { guilds: string[], labels: string[], department: string|null }>} */
    const peopleByUid = {};
    let totalPeople = 0;
    for (const doc of peopleSnap.docs) {
      const p = doc.data();
      if (p.active !== false) totalPeople += 1;
      if (!p.uid) continue;
      // Se agrupa por UID del Head (clave estable), no por su nombre.
      peopleByUid[p.uid] = {
        guilds: p.guilds || [],
        labels: p.labels || [],
        department: departmentOf(p.ownerLeaderUid ?? null, reportsToByUid, headUids),
      };
    }
    const aggregate = computePulseAggregate(weekIso, entries, peopleByUid, {
      minCount: 3,
      totalPeople,
      departmentNames: Object.fromEntries(headNames),
    });
    await db.doc(`pulseAggregates/${weekIso}`).set({ ...aggregate, updatedAt: FieldValue.serverTimestamp() });
    console.log(`[marea] agregado ${weekIso} recalculado (${aggregate.respondents} personas).`);
  },
);

/**
 * Registro de MIEMBROS de la instancia por uid (RMR-TSK-0274).
 *
 * Las reglas de Firestore no pueden preguntar «¿este uid es una persona de la
 * instancia?»: las personas viven en /people con id propio y el `uid` es un
 * campo, no la clave (y un get() por documento no es viable dentro de una
 * query). Este trigger mantiene un espejo /members/{uid} — el mismo patrón que
 * ya usan /admins, /viewers y /leaders — para que las reglas puedan resolverlo
 * con un exists() barato.
 *
 * Se hace con un trigger, y no escribiendo desde el cliente, porque hay DOS vías
 * de vinculación (la Cloud Function `sealInvite` y `assignUserToLeader` desde el
 * panel) y porque dejar que el cliente escriba en /members permitiría a
 * cualquiera auto-registrarse como miembro.
 */
export const syncMemberRegistry = onDocumentWritten(
  { region: 'europe-west1', document: 'people/{personId}' },
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;
    const beforeUid = before?.exists ? before.data()?.uid : null;
    const afterUid = after?.exists ? after.data()?.uid : null;
    if (beforeUid === afterUid) return; // el uid no cambió: nada que sincronizar
    const db = getFirestore();
    // Se desvinculó (o se borró la persona): fuera del registro.
    if (beforeUid && beforeUid !== afterUid) {
      await db.doc(`members/${beforeUid}`).delete().catch(() => {});
    }
    if (afterUid) {
      await db.doc(`members/${afterUid}`).set({
        personId: event.params.personId,
        ownerLeaderUid: after.data()?.ownerLeaderUid ?? null,
        linkedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  },
);
