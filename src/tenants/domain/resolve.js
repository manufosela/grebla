/**
 * Resolución del tenant (funciones puras). Dos estrategias, por prioridad:
 *  1) Por PATH (tenant en directorio): primer segmento de la ruta, salvo rutas
 *     reservadas de plataforma. Ej: /manufosela/tools/team → "manufosela".
 *  2) Por HOST (fallback): subdominio {slug}.grebla.app → slug; base/local/web.app
 *     → defaultSlug (demo); dominio propio → null (lookup por /tenantDomains).
 */

/** Primeros segmentos que NO son tenants (plataforma / assets / tools sin tenant). */
export const RESERVED_SEGMENTS = Object.freeze(
  new Set([
    '',
    'guia',
    'login',
    'tools',
    '_astro',
    'favicon.svg',
    'favicon-32.png',
    'apple-touch-icon.png',
    'icon-192.png',
    'icon-512.png',
    'og-image.png',
    'manifest.webmanifest',
    'sw.js',
  ]),
);

/**
 * Slug de tenant desde el path (1er segmento), o null si es ruta reservada.
 * @param {string} pathname
 * @returns {string|null}
 */
export function tenantSlugFromPath(pathname) {
  const seg = String(pathname || '/').split('/')[1] || '';
  return seg && !RESERVED_SEGMENTS.has(seg) ? seg.toLowerCase() : null;
}

/**
 * Slug de tenant desde el hostname (fallback), o null si es dominio propio.
 * @param {string} hostname
 * @param {{ baseDomain?: string, defaultSlug?: string }} [opts]
 * @returns {string|null}
 */
export function tenantSlugFromHost(hostname, opts = {}) {
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
  return null;
}
