/**
 * Glue de cliente del panel admin: define <admin-dashboard>, le pasa roles y
 * fases de organización, y dispara la carga de perfiles cuando hay sesión admin.
 */
import '../components/admin-dashboard.js';
import { ROLES } from '../data/roles.js';
import { ORG_PHASES, DEFAULT_ORG_PHASE } from '../data/org.js';
import { onUserChanged, isAdmin } from '../lib/auth.js';
import { getOrgConfig } from '../lib/firestore.js';
import { resolveTenantContext } from './tenant-context.js';

const el = document.querySelector('admin-dashboard');

if (el) {
  el.roles = ROLES;
  el.orgPhases = ORG_PHASES;
  el.currentPhase = DEFAULT_ORG_PHASE;

  onUserChanged(async (user) => {
    if (!user) return; // el guard del layout redirige a /login
    try {
      const { tenant, role } = await resolveTenantContext(user);
      // El panel lo administra el admin del tenant (líder); el super-admin de
      // plataforma también entra (gestión/soporte). El resto, a su home.
      if (role !== 'admin' && !(await isAdmin(user.uid))) {
        location.replace(`/${tenant.slug}`);
        return;
      }
      el.tenantId = tenant.id;
      el.leaderUid = user.uid;
      const cfg = await getOrgConfig(tenant.id);
      if (cfg?.phase) el.currentPhase = cfg.phase;
      // Dispara la carga de perfiles dentro del componente.
      el.uid = user.uid;
    } catch {
      location.replace('/');
    }
  });
}
