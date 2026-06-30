/**
 * Glue de la home (modelo multi-leader): con sesión y acceso (superadmin o líder)
 * muestra las tarjetas de herramientas; sin acceso, la landing pública de
 * presentación. Por defecto el HTML muestra la landing y oculta las tools.
 */
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';

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
    const { role } = await resolveAccess(user);
    if (!role) return showLanding();
    // El superadmin entra al panel de gestión, salvo que haya elegido "usar
    // como líder" en esta sesión (entonces ve las herramientas, con vuelta).
    if (role === 'superadmin' && sessionStorage.getItem(VIEW_FLAG) !== 'leader') {
      location.replace('/admin');
      return;
    }
    showTools();
    if (role === 'superadmin') backToAdmin?.removeAttribute('hidden');
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
