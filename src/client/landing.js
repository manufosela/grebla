/**
 * Glue de la home (modelo multi-leader): con sesión y acceso (superadmin o líder)
 * muestra las tarjetas de herramientas; sin acceso, la landing pública de
 * presentación. Por defecto el HTML muestra la landing y oculta las tools.
 */
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';

const landing = document.getElementById('platform-landing');
const tools = document.getElementById('tenant-tools');

onUserChanged(async (user) => {
  if (!user) return showLanding();
  try {
    const { role } = await resolveAccess(user);
    if (!role) return showLanding();
    tools?.removeAttribute('hidden');
    landing?.setAttribute('hidden', '');
  } catch {
    showLanding();
  }
});

function showLanding() {
  tools?.setAttribute('hidden', '');
  landing?.removeAttribute('hidden');
}
