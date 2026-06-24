/**
 * Agregación de métricas DORA sobre un conjunto de repos (funciones puras). El
 * lead time se combina como MEDIA PONDERADA por nº de despliegues (no media
 * simple). La mediana no es agregable sin datos crudos, así que a nivel de grupo
 * se omite. Repos sin métricas (o con error) no cuentan en el agregado.
 *
 * @typedef {{ team?: string|null, guilds?: string[], metrics?: any }} DoraRepoDoc
 */
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * @param {DoraRepoDoc[]} repos
 * @returns {{ repos: number, measured: number, deployments: number, deployFrequencyPerWeek: number, leadTimeHoursAvg: number|null, people: number }}
 */
export function aggregateMetrics(repos) {
  const list = Array.isArray(repos) ? repos : [];
  const measured = list.filter((r) => r.metrics && !r.metrics.error);
  let deployments = 0;
  let freq = 0;
  let leadWeighted = 0;
  let leadWeight = 0;
  // Personas únicas del grupo: unión de logins, no suma (una persona en dos repos
  // del mismo equipo cuenta una vez).
  const people = new Set();
  for (const r of measured) {
    const m = r.metrics;
    deployments += m.deployments || 0;
    freq += m.deployFrequencyPerWeek || 0;
    if (m.leadTimeHoursAvg != null && (m.deployments || 0) > 0) {
      leadWeighted += m.leadTimeHoursAvg * m.deployments;
      leadWeight += m.deployments;
    }
    for (const login of m.contributorLogins ?? []) people.add(login);
  }
  return {
    repos: list.length,
    measured: measured.length,
    deployments,
    deployFrequencyPerWeek: round1(freq),
    leadTimeHoursAvg: leadWeight > 0 ? round1(leadWeighted / leadWeight) : null,
    people: people.size,
  };
}

/**
 * Agrupa y agrega por una clave derivada de cada repo (un repo puede caer en
 * varias claves, p. ej. varios gremios).
 * @param {DoraRepoDoc[]} repos
 * @param {(repo: DoraRepoDoc) => string[]} keyOf
 * @returns {Array<{ key: string } & ReturnType<typeof aggregateMetrics>>}
 */
export function aggregateByKey(repos, keyOf) {
  /** @type {Map<string, DoraRepoDoc[]>} */
  const groups = new Map();
  for (const r of Array.isArray(repos) ? repos : []) {
    for (const k of keyOf(r)) {
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
  }
  return [...groups.entries()]
    .map(([key, rs]) => ({ key, ...aggregateMetrics(rs) }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/** Claves de equipo/gremio con etiqueta para los repos sin asignar. */
export const teamKeyOf = (r) => [r.team || '(sin equipo)'];
export const guildKeyOf = (r) => ((r.guilds ?? []).length ? r.guilds : ['(sin gremio)']);
