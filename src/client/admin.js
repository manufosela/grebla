/**
 * Glue de cliente del panel admin: define <admin-dashboard>, le pasa los roles y
 * dispara la carga de perfiles cuando hay sesión admin. Ajusta el título y el
 * lead de la página según el rol (RMR-TSK-0227): el superadmin ve «Panel de
 * administración» (toda la organización); el manager, «Perfiles de mi equipo».
 */
import '../components/admin-dashboard.js';
import { ROLES } from '../data/roles.js';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { canGovern, hasAccess, leadsTeam } from '../lib/accessRoles.js';

const el = document.querySelector('admin-dashboard');
const titleEl = document.querySelector('[data-page-title]');
const leadEl = document.querySelector('[data-page-lead]');

/** Ajusta el título y el lead de la página según quién la ve: un líder sin
 * gobierno ve «su equipo»; para superadmin/viewer queda el texto por defecto. */
function applyPageCopy(access) {
  if (leadsTeam(access) && !canGovern(access)) {
    if (titleEl) titleEl.textContent = 'Perfiles de mi equipo';
    if (leadEl) leadEl.textContent = 'Perfiles de tu equipo, comparativas, distribución de roles y exportación CSV.';
  }
  // Para superadmin/viewer se deja el texto por defecto ya presente en el HTML.
}

if (el) {
  el.roles = ROLES;

  onUserChanged(async (user) => {
    if (!user) return; // el guard del layout redirige a /login
    try {
      const access = await resolveAccess(user);
      // Acceden superadmin y managers (cada manager gestiona sus propios perfiles).
      if (!hasAccess(access)) {
        location.replace('/');
        return;
      }
      applyPageCopy(access);
      // El dashboard solo distingue «tu equipo» vs «toda la organización».
      el.viewerScope = leadsTeam(access) && !canGovern(access) ? 'team' : 'all';
      el.leaderUid = user.uid;
      // Dispara la carga de perfiles dentro del componente.
      el.uid = user.uid;
    } catch {
      location.replace('/');
    }
  });
}
