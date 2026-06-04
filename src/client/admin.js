/**
 * Glue de cliente del panel admin: define <admin-dashboard>, le pasa roles y
 * fases de organización, y dispara la carga de perfiles cuando hay sesión admin.
 */
import '../components/admin-dashboard.js';
import { ROLES } from '../data/roles.js';
import { ORG_PHASES, DEFAULT_ORG_PHASE } from '../data/org.js';
import { onUserChanged, isAdmin } from '../lib/auth.js';
import { getOrgConfig } from '../lib/firestore.js';

const el = document.querySelector('admin-dashboard');

if (el) {
  el.roles = ROLES;
  el.orgPhases = ORG_PHASES;
  el.currentPhase = DEFAULT_ORG_PHASE;

  onUserChanged(async (user) => {
    if (!user) return; // el guard del layout redirige a /login
    if (!(await isAdmin(user.uid))) return; // el guard redirige a /
    try {
      const cfg = await getOrgConfig();
      if (cfg?.phase) el.currentPhase = cfg.phase;
    } catch {
      /* se mantiene la fase por defecto */
    }
    // Dispara la carga de perfiles dentro del componente.
    el.uid = user.uid;
  });
}
