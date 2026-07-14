/**
 * Glue de cliente del panel admin: define <admin-dashboard>, le pasa los roles y
 * dispara la carga de perfiles cuando hay sesión admin.
 */
import '../components/admin-dashboard.js';
import { ROLES } from '../data/roles.js';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';

const el = document.querySelector('admin-dashboard');

if (el) {
  el.roles = ROLES;

  onUserChanged(async (user) => {
    if (!user) return; // el guard del layout redirige a /login
    try {
      const { role } = await resolveAccess(user);
      // Acceden superadmin y líderes (cada líder gestiona sus propios perfiles).
      if (!role) {
        location.replace('/');
        return;
      }
      el.leaderUid = user.uid;
      // Dispara la carga de perfiles dentro del componente.
      el.uid = user.uid;
    } catch {
      location.replace('/');
    }
  });
}
