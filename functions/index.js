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
    .map((p) => ({ createdAt: p.created_at, mergedAt: p.merged_at, author: p.user?.login || '' }));
}

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
