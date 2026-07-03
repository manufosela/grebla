/**
 * Cloud Functions de GREBLA.
 *
 * grantAdmin: callable que permite a un admin existente conceder el rol admin a
 * otra persona por email. Establece el custom claim { admin: true } y crea el
 * documento /admins/{uid}. El primer admin se crea con el bootstrap de la UI
 * (/login) o con el script de seed.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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

const GH_HEADERS = { Accept: 'application/vnd.github+json', 'User-Agent': 'grebla-dora' };

/** Mensaje legible según el código de estado de GitHub. */
function githubError(status, fullName) {
  if (status === 404) return new Error(`Repo no encontrado o privado: ${fullName} (los privados necesitan token).`);
  if (status === 401 || status === 403) {
    return new Error('Sin acceso o límite de la API pública de GitHub (60/h sin token). Si es privado, requiere token.');
  }
  return new Error(`GitHub respondió ${status} para ${fullName}.`);
}

/** Fecha de creación del repo (para medir "desde el principio" cuando no hay fecha). */
async function fetchRepoCreatedAt(fullName) {
  const res = await fetch(`https://api.github.com/repos/${fullName}`, { headers: GH_HEADERS });
  if (!res.ok) throw githubError(res.status, fullName);
  const data = await res.json();
  return data.created_at || '2008-01-01T00:00:00Z';
}

/** PRs mergeados a `baseBranch` de un repo público desde `sinceMs` (API pública de GitHub, sin token). */
async function fetchMergedPrs(fullName, sinceMs, baseBranch) {
  const base = encodeURIComponent(baseBranch || 'main');
  const url = `https://api.github.com/repos/${fullName}/pulls?state=closed&base=${base}&per_page=100&sort=updated&direction=desc`;
  const res = await fetch(url, { headers: GH_HEADERS });
  if (!res.ok) throw githubError(res.status, fullName);
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
async function fetchFirstCommitDate(fullName, prNumber) {
  const res = await fetch(
    `https://api.github.com/repos/${fullName}/pulls/${prNumber}/commits?per_page=1`,
    { headers: GH_HEADERS },
  );
  if (!res.ok) throw githubError(res.status, fullName);
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

/** Nº de releases publicados de un repo público en [sinceMs, toMs2] (despliegue real). */
async function fetchReleaseCount(fullName, sinceMs, toMs2) {
  const res = await fetch(`https://api.github.com/repos/${fullName}/releases?per_page=100`, { headers: GH_HEADERS });
  if (!res.ok) throw githubError(res.status, fullName);
  const arr = await res.json();
  return (Array.isArray(arr) ? arr : []).filter((r) => {
    if (!r.published_at) return false;
    const t = toMs(r.published_at);
    return t >= sinceMs && t <= toMs2;
  }).length;
}

/**
 * Calcula y guarda las métricas DORA de los repos de la instancia (modelo
 * multi-leader). Acceso: superadmin o líder. Lee la API pública de GitHub (repos
 * públicos, sin token; rate-limit 60/h por IP). Privados requerirán token.
 */
export const refreshDora = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Necesitas iniciar sesión.');

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
      const from = repo.startDate || (await fetchRepoCreatedAt(repo.fullName));
      // Lead time y personas siempre desde los PR mergeados a la rama base.
      const prs = await fetchMergedPrs(repo.fullName, toMs(from), repo.baseBranch || 'main');
      const metrics = computeRepoMetrics(prs, from, now);
      // Frecuencia de despliegue: por releases si la señal del repo es 'release',
      // si no, por merges a la rama base (lo que ya calcula computeRepoMetrics).
      const signal = repo.deploySignal === 'release' ? 'release' : 'branch';
      if (signal === 'release') {
        const releases = await fetchReleaseCount(repo.fullName, toMs(from), toMs(now));
        const weeks = Math.max(1, (toMs(now) - toMs(from)) / (7 * 24 * MS_HOUR));
        metrics.deployments = releases;
        metrics.deployFrequencyPerWeek = round1(releases / weeks);
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
      let leadTimeApproxCount = 0;
      const changes = [];
      for (const [i, pr] of prs.entries()) {
        let firstCommitAt = pr.createdAt; // aproximación por defecto
        if (i < MAX_COMMIT_LOOKUPS) {
          try {
            const commitDate = await fetchFirstCommitDate(repo.fullName, pr.number);
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

      // Eventos de despliegue reales del repo (Admin SDK). El helper filtra success.
      const deploySnap = await docSnap.ref.collection('deployments').get();
      const deployEvents = deploySnap.docs.map((d) => d.data());
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
