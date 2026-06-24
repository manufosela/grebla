/**
 * Glue de cliente común al layout: define <auth-button> y aplica el guard de
 * rutas protegidas leyendo los data-attributes del <body>. El sitio es estático,
 * por eso el guard es client-side.
 */
import '../components/auth-button.js';
import { onUserChanged, isAdmin } from '../lib/auth.js';

const requireAuth = document.body.dataset.requireAuth === 'true';
const requireAdmin = document.body.dataset.requireAdmin === 'true';

if (requireAuth || requireAdmin) {
  onUserChanged(async (user) => {
    if (!user) {
      const redirect = encodeURIComponent(location.pathname + location.search);
      location.replace(`/login?redirect=${redirect}`);
      return;
    }
    if (requireAdmin && !(await isAdmin(user.uid))) {
      location.replace('/');
    }
  });
}

// Tenant en directorio: si la URL está dentro de /{tenant}, prefija los enlaces
// internos de las tools del tenant con /{tenant} para no perder el contexto.
// Todas las tools viven bajo /{tenant}; solo Guía, Login y assets quedan a nivel
// plataforma, sin prefijo.
(() => {
  const reserved = new Set(['', 'guia', 'login', 'tools', '_astro']);
  const seg = location.pathname.split('/')[1] || '';
  const tenant = seg && !reserved.has(seg) ? seg : null;
  if (!tenant) return;
  const prefixable = (href) => href === '/' || /^\/tools\/(team|dora|career-map|role-mirror)(\/|$|\?|#)/.test(href);
  for (const a of document.querySelectorAll('a[href^="/"]')) {
    const href = a.getAttribute('href');
    if (!prefixable(href)) continue;
    if (href === `/${tenant}` || href.startsWith(`/${tenant}/`)) continue;
    a.setAttribute('href', href === '/' ? `/${tenant}` : `/${tenant}${href}`);
  }
})();

// PWA (H11): registra el service worker para instalación y app-shell offline.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* sin SW la app sigue funcionando online */
    });
  });
}
