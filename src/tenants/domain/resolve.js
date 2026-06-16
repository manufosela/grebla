/**
 * Resolución del tenant a partir del hostname (función pura).
 *
 * - {slug}.grebla.app          → slug
 * - grebla.app / www.grebla.app → defaultSlug (demo)
 * - localhost, *.web.app, *.firebaseapp.com → defaultSlug (entornos sin subdominio)
 * - dominio propio (no termina en baseDomain) → null (se resuelve por /tenantDomains)
 */

/**
 * @param {string} hostname
 * @param {{ baseDomain?: string, defaultSlug?: string }} [opts]
 * @returns {string|null}  slug del tenant, o null si es un dominio propio (lookup aparte)
 */
export function resolveTenantSlug(hostname, opts = {}) {
  const { baseDomain = 'grebla.app', defaultSlug = 'demo' } = opts;
  const host = String(hostname || '').toLowerCase().split(':')[0].trim();
  if (!host) return defaultSlug;
  if (host === 'localhost' || host.endsWith('.web.app') || host.endsWith('.firebaseapp.com')) {
    return defaultSlug;
  }
  if (host === baseDomain || host === `www.${baseDomain}`) return defaultSlug;
  if (host.endsWith(`.${baseDomain}`)) {
    const label = host.slice(0, host.length - baseDomain.length - 1).split('.')[0];
    return label && label !== 'www' ? label : defaultSlug;
  }
  // Dominio propio: no se puede derivar el slug; se resolverá por /tenantDomains.
  return null;
}
