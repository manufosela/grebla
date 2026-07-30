/**
 * Push de métricas DORA/LEAN por squad al Firestore del portal de management
 * (RMR-TSK-0352). Escribe EXCLUSIVAMENTE `metrics_dora/{slug}` y
 * `metrics_lean/{slug}` en OTRO proyecto (el portal), vía una segunda app de
 * Firebase Admin NOMBRADA (no la de GREBLA). Solo agregados por squad: nunca
 * datos ni identificadores de persona.
 *
 * Dominio espejo de src/tools/portal/domain/snapshot.js y de la agregación DORA
 * de src/tools/dora/domain/aggregate.js (functions es un bundle aislado).
 *
 * Unidades del portal: leadTimeForChanges/timeToRestore/cycleTime en HORAS;
 * changeFailureRate/flowEfficiency fracción 0..1; deploymentFrequency/throughput
 * por semana; wip entero.
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

const PORTAL_PROJECT_ID = 'tribbu-dev-portal';
const SERIES_CAP = 8;
const round1 = (n) => Math.round(n * 10) / 10;

// ── Agregación DORA por equipo (espejo de src/tools/dora/domain/aggregate.js) ──

/** Agrega las métricas DORA de un conjunto de repos (medias PONDERADAS). */
export function aggregateMetrics(repos) {
  const list = Array.isArray(repos) ? repos : [];
  const measured = list.filter((r) => r.metrics && !r.metrics.error);
  let deployments = 0, freq = 0, leadWeighted = 0, leadWeight = 0;
  let realLeadWeighted = 0, realLeadWeight = 0;
  let deploymentsFailed = 0, deploymentsTotal = 0;
  let downtimeHoursTotal = 0, incidentsResolved = 0;
  for (const r of measured) {
    const m = r.metrics;
    deployments += m.deployments || 0;
    freq += m.deployFrequencyPerWeek || 0;
    if (m.leadTimeHoursAvg != null && (m.deployments || 0) > 0) {
      leadWeighted += m.leadTimeHoursAvg * m.deployments;
      leadWeight += m.deployments;
    }
    if (m.leadTimeCommitDeployHoursAvg != null && (m.changesDeployed ?? 0) > 0) {
      realLeadWeighted += m.leadTimeCommitDeployHoursAvg * m.changesDeployed;
      realLeadWeight += m.changesDeployed;
    }
    deploymentsFailed += m.deploymentsFailed ?? 0;
    deploymentsTotal += m.deploymentsTotal ?? 0;
    downtimeHoursTotal += m.downtimeHoursTotal ?? 0;
    incidentsResolved += m.incidentsResolved ?? 0;
  }
  return {
    measured: measured.length,
    deployFrequencyPerWeek: round1(freq),
    leadTimeHoursAvg: leadWeight > 0 ? round1(leadWeighted / leadWeight) : null,
    leadTimeCommitDeployHoursAvg: realLeadWeight > 0 ? round1(realLeadWeighted / realLeadWeight) : null,
    changeFailureRatePct: deploymentsTotal > 0 ? round1((deploymentsFailed / deploymentsTotal) * 100) : null,
    mttrHoursAvg: incidentsResolved > 0 ? round1(downtimeHoursTotal / incidentsResolved) : null,
  };
}

/** Agrupa los repos por su equipo (`team`) y agrega cada grupo. */
export function aggregateByTeam(repos) {
  const groups = new Map();
  for (const r of Array.isArray(repos) ? repos : []) {
    const key = r.team || '(sin equipo)';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return [...groups.entries()].map(([key, rs]) => ({ key, ...aggregateMetrics(rs) }));
}

// ── Dominio del snapshot (espejo de src/tools/portal/domain/snapshot.js) ──

/** Slug estable de un squad. */
export function slugifySquad(name) {
  return String(name ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

const numOrNull = (v) => (Number.isFinite(v) ? v : null);
const intOrNull = (v) => (Number.isInteger(v) ? v : (Number.isFinite(v) ? Math.round(v) : null));
const fractionFromPct = (pct) => (Number.isFinite(pct) ? Math.round((pct / 100) * 10000) / 10000 : null);

/** ¿Falló el cálculo del squad? (no publicar snapshots a medias). */
export function calcFailed(metrics) {
  return !metrics || typeof metrics === 'string' || typeof metrics.error === 'string';
}

/** `current` DORA en el esquema del portal, con unidades convertidas. */
export function doraCurrent(agg) {
  return {
    deploymentFrequency: numOrNull(agg?.deployFrequencyPerWeek),
    leadTimeForChanges: numOrNull(agg?.leadTimeCommitDeployHoursAvg ?? agg?.leadTimeHoursAvg),
    changeFailureRate: fractionFromPct(agg?.changeFailureRatePct),
    timeToRestore: numOrNull(agg?.mttrHoursAvg),
  };
}

/** `current` LEAN. `flowEfficiency` aún no lo calcula GREBLA → null. */
export function leanCurrent(metrics) {
  return {
    cycleTime: numOrNull(metrics?.cycleTimeP50Hours),
    throughput: numOrNull(metrics?.throughputPerWeek),
    wip: intOrNull(metrics?.wip),
    flowEfficiency: numOrNull(metrics?.flowEfficiency),
  };
}

/** ¿El `current` tiene al menos un número real? */
export function hasAnyNumber(current) {
  return Object.values(current ?? {}).some((v) => Number.isFinite(v));
}

/** Acumula la serie: reemplaza la misma semana, ordena y conserva las últimas `cap`. */
export function accumulateSeries(prevSeries, point, cap = SERIES_CAP) {
  const kept = (Array.isArray(prevSeries) ? prevSeries : [])
    .filter((p) => p && typeof p.periodStart === 'string' && p.periodStart !== point.periodStart);
  return [...kept, point]
    .sort((a, b) => (a.periodStart < b.periodStart ? -1 : a.periodStart > b.periodStart ? 1 : 0))
    .slice(-cap);
}

/** Ensambla el documento del portal respetando el esquema campo a campo. */
export function buildSnapshot({ squad, updatedAt, periodStart, current, prevSeries, period = 'weekly' }) {
  return {
    squad,
    updatedAt,
    period,
    current,
    series: accumulateSeries(prevSeries, { periodStart, ...current }),
  };
}

// ── Segunda app de Firebase Admin (el portal) ──

/**
 * ¿La credencial del portal es real (no un placeholder de otra instancia)? Evita
 * intentar el push donde el portal no aplica (p. ej. el demo).
 */
export function portalConfigured(saKeyJson) {
  try {
    const c = JSON.parse(saKeyJson);
    return c && c.project_id === PORTAL_PROJECT_ID && typeof c.private_key === 'string';
  } catch {
    return false;
  }
}

/** Firestore del PORTAL vía app Admin NOMBRADA. Se reutiliza si ya existe. */
export function getPortalDb(saKeyJson) {
  const app = getApps().find((a) => a.name === 'portal')
    || initializeApp({ credential: cert(JSON.parse(saKeyJson)), projectId: PORTAL_PROJECT_ID }, 'portal');
  return getFirestore(app);
}

/** Inicio de la semana ISO (lunes) de una fecha, como `YYYY-MM-DD` (UTC). */
export function weekStart(dateIso) {
  const d = new Date(dateIso);
  const mondayOffset = (d.getUTCDay() + 6) % 7; // 0 = lunes
  d.setUTCDate(d.getUTCDate() - mondayOffset);
  return d.toISOString().slice(0, 10);
}

/**
 * Publica el snapshot de cada squad al portal. Lee de GREBLA lo YA calculado
 * (DORA por repo → agregado por equipo; LEAN por squad en `leanTeams`), lo mapea
 * al esquema del portal y hace SET idempotente en `metrics_dora`/`metrics_lean`,
 * acumulando la serie. Aislado por squad: un fallo no tumba el resto. Nunca
 * escribe otras colecciones ni vuelca la credencial en los logs.
 */
export async function publishSquadMetrics({ greblaDb, portalDb, nowIso }) {
  const periodStart = weekStart(nowIso);
  const results = { dora: 0, lean: 0, skipped: 0, failed: 0 };

  const publish = async (collection, slug, current) => {
    if (!hasAnyNumber(current)) { results.skipped += 1; return; }
    try {
      const ref = portalDb.collection(collection).doc(slug);
      const prev = (await ref.get()).data();
      await ref.set(buildSnapshot({ squad: slug, updatedAt: nowIso, periodStart, current, prevSeries: prev?.series }));
      results[collection === 'metrics_dora' ? 'dora' : 'lean'] += 1;
    } catch (err) {
      results.failed += 1;
      logger.error('portal push failed', { collection, squad: slug, message: err?.message ?? 'unknown' });
    }
  };

  // DORA: repos con métricas persistidas → agregado por equipo.
  const reposSnap = await greblaDb.collection('dora').get();
  const repos = reposSnap.docs.map((d) => d.data());
  for (const agg of aggregateByTeam(repos)) {
    if (agg.key === '(sin equipo)' || agg.measured === 0) { results.skipped += 1; continue; }
    await publish('metrics_dora', slugifySquad(agg.key), doraCurrent(agg));
  }

  // LEAN: squads en leanTeams (kind 'squad') con métricas persistidas.
  const unitsSnap = await greblaDb.collection('leanTeams').where('kind', '==', 'squad').get();
  for (const doc of unitsSnap.docs) {
    const unit = doc.data();
    if (calcFailed(unit.metrics)) { results.skipped += 1; continue; }
    await publish('metrics_lean', slugifySquad(unit.name || unit.linearLabel || doc.id), leanCurrent(unit.metrics));
  }

  return results;
}
