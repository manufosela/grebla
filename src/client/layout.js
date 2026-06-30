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

// PWA (H11): registra el service worker para instalación y app-shell offline.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* sin SW la app sigue funcionando online */
    });
  });
}
