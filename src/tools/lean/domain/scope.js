/**
 * ENGANCHE de las unidades LEAN al catálogo de dominios
 * (ADR «De squads a dominios y subdominios», F2).
 *
 * Hasta ahora la unidad de flujo (un label de Linear) y el catálogo de la
 * organización eran dos listas paralelas que nadie conciliaba: se medía «The
 * Mario Netas», que no estaba en el catálogo, y Matcher, que sí estaba, no lo
 * medía nadie. Aquí cada unidad declara a qué subdominio pertenece con su
 * `subdomainKey`, y el catálogo pasa a mandar.
 *
 * La regla dura: **no se adivina**. Un nombre parecido no es una identidad, y
 * acertar por casualidad esconde el desajuste en vez de enseñarlo. Lo que no
 * está enganchado no se publica, y se dice por qué.
 *
 * Puro: sin Firestore, para poder probar todas las reglas sin montar nada.
 *
 * @typedef {import('./types.js').LeanUnit} LeanUnit
 * @typedef {{ id: string, key: string, name: string, domainKey: string }} Subdomain
 *   Entrada del catálogo de la organización. Se tipa aquí en vez de importarla:
 *   una herramienta no depende de otra, y de la entrada solo se usa su `key`.
 *
 * @typedef {'sin-subdominio'|'clave-desconocida'|'no-es-equipo'} SkipReason
 */

/**
 * Subdominio al que pertenece una unidad, o `null` si no lo declara o su clave
 * no está en el catálogo. Nunca deduce por el nombre.
 * @param {LeanUnit & { subdomainKey?: string }} unit
 * @param {ReadonlyArray<Subdomain>} subdomains
 * @returns {Subdomain|null}
 */
export function resolveSubdomain(unit, subdomains = []) {
  const key = String(unit?.subdomainKey ?? '').trim();
  if (!key) return null;
  return subdomains.find((s) => s.key === key) ?? null;
}

/**
 * Separa las unidades en publicables y descartadas, cada descarte con su motivo.
 * Ninguna se pierde por el camino: lo que no se publica hay que poder verlo, que
 * es justo lo que faltaba.
 *
 * Solo los EQUIPOS (`kind: 'squad'`) se publican por subdominio. Un gremio
 * cruza varios subdominios: publicarlo como si fuera uno sumaría el mismo
 * trabajo dos veces.
 *
 * @param {ReadonlyArray<LeanUnit & { subdomainKey?: string }>} units
 * @param {ReadonlyArray<Subdomain>} subdomains
 * @returns {{ publishable: Array<{ unit: LeanUnit, subdomainKey: string }>,
 *            skipped: Array<{ unit: LeanUnit, reason: SkipReason }> }}
 */
export function classifyUnits(units = [], subdomains = []) {
  const publishable = [];
  const skipped = [];
  for (const unit of units) {
    if (unit?.kind !== 'squad') { skipped.push({ unit, reason: 'no-es-equipo' }); continue; }
    if (!String(unit?.subdomainKey ?? '').trim()) { skipped.push({ unit, reason: 'sin-subdominio' }); continue; }
    const subdomain = resolveSubdomain(unit, subdomains);
    if (!subdomain) { skipped.push({ unit, reason: 'clave-desconocida' }); continue; }
    publishable.push({ unit, subdomainKey: subdomain.key });
  }
  return { publishable, skipped };
}
