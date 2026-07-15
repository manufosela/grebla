/**
 * Glue de cliente común al layout: define <auth-button> y aplica el guard de
 * rutas protegidas leyendo los data-attributes del <body>. El sitio es estático,
 * por eso el guard es client-side.
 */
import '../components/auth-button.js';
import { onUserChanged, isAdmin } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';

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

// Modo superadmin (RMR-TSK-0228): halo + etiqueta en TODAS las páginas, para no
// confundir acciones de superadmin con las de líder (subscripción independiente
// del guard de arriba; onAuthStateChanged admite varios listeners). RMR-BUG-0033:
// NO se muestra si ha elegido «usar como líder» (superadmin-panel.js VIEW_FLAG) —
// en ese modo está deliberadamente viendo las herramientas como si fuera líder.
const VIEW_FLAG = 'grebla-view';

onUserChanged(async (user) => {
  if (!user) {
    document.documentElement.classList.remove('is-superadmin');
    return;
  }
  try {
    const { role } = await resolveAccess(user);
    const actingAsLeader = sessionStorage.getItem(VIEW_FLAG) === 'leader';
    document.documentElement.classList.toggle('is-superadmin', role === 'superadmin' && !actingAsLeader);
  } catch {
    document.documentElement.classList.remove('is-superadmin');
  }
});

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

/** Borra TODAS las cachés y recarga: fuerza traer el bundle nuevo (de-cachear). */
async function forceUpdate() {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch {
    /* sin Cache API igualmente se recarga con red */
  }
  location.reload();
}

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
  reload.addEventListener('click', () => {
    reload.disabled = true;
    reload.textContent = 'Recargando…';
    forceUpdate();
  });
  banner.append(message, reload);
  document.body.append(banner);
}

// ── Indicador de versión + aviso de caché (RMR-BUG-0018) ─────────────────────
// La app bakea su versión al build (PUBLIC_APP_VERSION) y la compara con la
// versión REALMENTE desplegada, que vive en Firestore (/config/appVersion) y se
// lee EN VIVO. Firestore es cross-origin: el SW no lo intercepta, así que esa
// lectura es INMUNE a la caché. Si difieren, el bundle que ejecutas está
// cacheado → el badge avisa y al pulsarlo fuerza la actualización.
const APP_VERSION = import.meta.env.PUBLIC_APP_VERSION || 'dev';

/** Monta el badge de versión (esquina). Devuelve un setter para marcarlo caducado. */
function mountVersionBadge() {
  const badge = document.createElement('button');
  badge.id = 'app-version-badge';
  badge.type = 'button';
  badge.title = 'Versión de GREBLA';
  badge.textContent = `v ${APP_VERSION}`;
  Object.assign(badge.style, {
    position: 'fixed', right: '8px', bottom: '8px', zIndex: '2147483000',
    font: '11px/1.4 system-ui, sans-serif', color: 'var(--rm-muted, #6b7280)',
    background: 'var(--rm-surface, #fff)', border: '1px solid var(--rm-border, #e5e7eb)',
    borderRadius: '999px', padding: '2px 8px', cursor: 'default', opacity: '0.7',
  });
  document.body.appendChild(badge);
  return (stale) => {
    if (!stale) return;
    badge.textContent = `⟳ Actualizar (v ${APP_VERSION})`;
    badge.title = 'Estás ejecutando una versión cacheada. Pulsa para actualizar a la última.';
    Object.assign(badge.style, {
      cursor: 'pointer', opacity: '1', fontWeight: '700',
      color: 'var(--rm-on-accent, #fff)', background: 'var(--rm-accent, #2a9d8f)',
      borderColor: 'var(--rm-accent, #2a9d8f)',
    });
    badge.onclick = forceUpdate;
  };
}

/** Vigila en vivo la versión desplegada y marca el badge si estamos cacheados. */
async function watchDeployedVersion(setStale) {
  if (APP_VERSION === 'dev') return; // en desarrollo no hay versión desplegada que comparar
  try {
    const [{ db }, { doc, onSnapshot }] = await Promise.all([
      import('../lib/firebase.js'),
      import('firebase/firestore'),
    ]);
    onSnapshot(doc(db, 'config', 'appVersion'), (snap) => {
      const deployed = snap.data()?.version;
      if (deployed && deployed !== APP_VERSION) {
        setStale(true);
        showUpdateBanner();
      }
    });
  } catch {
    /* sin Firestore el badge se queda con la versión local, sin comparación */
  }
}

const setStaleBadge = mountVersionBadge();
await watchDeployedVersion(setStaleBadge);

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
      // Pestañas de larga vida: comprobar actualizaciones periódicamente y al
      // volver a la pestaña (sin navegar, el navegador tarda en mirar el sw.js).
      setInterval(() => registration.update().catch(() => {}), SW_UPDATE_POLL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {});
      });
    } catch {
      /* sin SW la app sigue funcionando online */
    }
  });
}
