/**
 * Glue de la home (modelo multi-leader): con sesión y acceso (superadmin o manager)
 * muestra las tarjetas de herramientas; sin acceso, la landing pública de
 * presentación. Por defecto el HTML muestra la landing y oculta las tools.
 */
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { canGovern } from '../lib/accessRoles.js';

const VIEW_FLAG = 'grebla-view';
const landing = document.getElementById('platform-landing');
const tools = document.getElementById('tenant-tools');
const backToAdmin = document.getElementById('back-to-admin');

backToAdmin?.querySelector('button')?.addEventListener('click', () => {
  sessionStorage.removeItem(VIEW_FLAG);
  location.assign('/admin');
});

onUserChanged(async (user) => {
  if (!user) return showLanding();
  try {
    const access = await resolveAccess(user);
    const { role } = access;
    if (!role) return showLanding();
    // Conmutador de vistas (RMR-TSK-0250): un manager/superadmin que ha elegido
    // «vista de ingeniero» va a su propio «Mi espacio», no a las herramientas.
    if (sessionStorage.getItem(VIEW_FLAG) === 'engineer' && (canGovern(access) || role === 'leader')) {
      location.replace('/mi-espacio');
      return;
    }
    // El ingeniero (persona vinculada) tiene su propio espacio personal: ni
    // landing pública ni herramientas de manager.
    if (role === 'engineer') {
      location.replace('/mi-espacio');
      return;
    }
    // El viewer siempre entra al panel de gestión en modo solo lectura: no
    // gestiona personas propias, así que no hay "usar como manager" para él.
    if (role === 'viewer') {
      location.replace('/admin');
      return;
    }
    // El superadmin (como el líder) aterriza en las herramientas —con vista de
    // toda la organización— y llega a la gestión con el conmutador «Gestión» o
    // el botón «volver a gestión» (RMR-BUG-0050). No se le redirige a /admin.
    showTools();
    if (canGovern(access)) backToAdmin?.removeAttribute('hidden');
  } catch {
    showLanding();
  }
});

function showLanding() {
  backToAdmin?.setAttribute('hidden', '');
  tools?.setAttribute('hidden', '');
  landing?.removeAttribute('hidden');
}

function showTools() {
  landing?.setAttribute('hidden', '');
  tools?.removeAttribute('hidden');
}
