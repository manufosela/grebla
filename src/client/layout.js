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

// Tema claro/oscuro (RMR-TSK-0151). El script inline del <head> ya aplicó el
// tema antes del primer paint; aquí solo se cablea el conmutador de la nav.
const THEME_KEY = 'grebla-theme';
const THEME_COLORS = { light: '#1e3a5f', dark: '#12161d' };

const applyTheme = (theme) => {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  document.getElementById('theme-toggle')?.setAttribute('aria-pressed', String(theme === 'dark'));
};

const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
  // Sincroniza el aria-pressed con el tema que aplicó el script anti-FOUC.
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* sin persistencia el tema sigue funcionando en la sesión */
    }
  });

  // Si el usuario no ha elegido tema, seguir los cambios del sistema en vivo.
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    let stored = null;
    try {
      stored = localStorage.getItem(THEME_KEY);
    } catch {
      /* ídem: sin localStorage se sigue siempre al sistema */
    }
    if (!stored) applyTheme(event.matches ? 'dark' : 'light');
  });
}

// PWA (H11): registra el service worker para instalación y app-shell offline.
// Aviso de versión nueva (RMR-TSK-0158): cuando un SW nuevo toma el control de
// una pestaña ya abierta (cada deploy estampa versión y hace skipWaiting), la
// página sigue ejecutando el JS antiguo hasta recargar — se avisa con un banner
// persistente cuyo botón borra TODAS las cachés y recarga.
const SW_UPDATE_POLL_MS = 60 * 60 * 1000;

function showUpdateBanner() {
  if (document.getElementById('sw-update-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'sw-update-banner';
  banner.setAttribute('role', 'status');
  const message = document.createElement('span');
  message.textContent = 'Hay una versión nueva de GREBLA.';
  const reload = document.createElement('button');
  reload.type = 'button';
  reload.textContent = 'Recargar';
  reload.addEventListener('click', async () => {
    reload.disabled = true;
    reload.textContent = 'Recargando…';
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch {
      /* sin Cache API igualmente se recarga con red */
    }
    location.reload();
  });
  banner.append(message, reload);
  document.body.append(banner);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    // Si un SW nuevo toma el control con la pestaña abierta, hay versión nueva.
    // Solo cuenta el RELEVO (había un controller previo): el primer control
    // tras instalar el SW inicial no debe avisar.
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener('controllerchange', showUpdateBanner);
    }
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      // Pestañas de larga vida: comprobar actualizaciones periódicamente
      // (sin navegar, el navegador puede tardar horas en mirar el sw.js).
      setInterval(() => registration.update().catch(() => {}), SW_UPDATE_POLL_MS);
    } catch {
      /* sin SW la app sigue funcionando online */
    }
  });
}
