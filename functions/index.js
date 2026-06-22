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
  return {
    deployments,
    deployFrequencyPerWeek: round1(deployments / weeks),
    leadTimeHoursAvg: lead.length ? round1(lead.reduce((s, h) => s + h, 0) / lead.length) : null,
    leadTimeHoursMedian: lead.length ? round1(lead[Math.floor((lead.length - 1) / 2)]) : null,
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

/** PRs mergeados de un repo público desde `sinceMs` (API pública de GitHub, sin token). */
async function fetchMergedPrs(fullName, sinceMs) {
  const url = `https://api.github.com/repos/${fullName}/pulls?state=closed&per_page=100&sort=updated&direction=desc`;
  const res = await fetch(url, { headers: GH_HEADERS });
  if (!res.ok) throw githubError(res.status, fullName);
  const arr = await res.json();
  return (Array.isArray(arr) ? arr : [])
    .filter((p) => p.merged_at && toMs(p.merged_at) >= sinceMs)
    .map((p) => ({ createdAt: p.created_at, mergedAt: p.merged_at }));
}

/**
 * Calcula y guarda las métricas DORA de los repos de un tenant. Solo miembros del
 * tenant. Lee la API pública de GitHub (repos públicos, sin token; rate-limit
 * 60/h por IP). Para repos privados habrá que añadir token por tenant.
 */
export const refreshDora = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Necesitas iniciar sesión.');
  const tenantId = typeof request.data?.tenantId === 'string' ? request.data.tenantId : '';
  if (!tenantId) throw new HttpsError('invalid-argument', 'Falta tenantId.');

  const db = getFirestore();
  const member = await db.doc(`tenants/${tenantId}/members/${uid}`).get();
  if (!member.exists) throw new HttpsError('permission-denied', 'No eres miembro de esta organización.');

  const reposSnap = await db.collection(`tenants/${tenantId}/dora`).get();
  const now = new Date().toISOString();
  const results = [];

  for (const docSnap of reposSnap.docs) {
    const repo = docSnap.data();
    try {
      // Sin fecha → desde la creación del repo en GitHub.
      const from = repo.startDate || (await fetchRepoCreatedAt(repo.fullName));
      const prs = await fetchMergedPrs(repo.fullName, toMs(from));
      const metrics = computeRepoMetrics(prs, from, now);
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
