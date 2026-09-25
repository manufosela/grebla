/**
 * Glue de la ADMINISTRACIÓN de Role Mirror (RMR-TSK-0562).
 *
 * Aquí entra quien gestiona la herramienta: se le da la lista de personas de su
 * ámbito —solo ingeniería— y los catálogos. Quien no la gestiona no pasa: el
 * gate sustituye la pantalla, como en el resto de puertas de administración.
 *
 * Gobierna las DOS sub-pestañas, y con un solo permiso: «Personas» (la lista y el
 * perfil de cada una) y «Resumen» (el panel de siempre: comparativa, distribución
 * y CSV). Antes cada una tenía su propio criterio de acceso —el panel reenviaba a
 * la home con `hasAccess`, sin mirar la política de la herramienta—, y dos jueces
 * en la misma página se contradicen: uno deja ver y el otro te echa.
 */
import '../components/rm-admin.js';
import '../components/admin-dashboard.js';
import { ITEMS, DIMENSIONS } from '../data/items.js';
import { ROLES } from '../data/roles.js';
import { onUserChanged } from '../lib/auth.js';
import { getOrgConfig } from '../lib/firestore.js';
import { resolveAccess } from '../lib/access.js';
import { branchScopeFor, canGovern, leadsTeam } from '../lib/accessRoles.js';
import { guardToolPage } from '../lib/toolGate.js';
import { listLeaders } from '../lib/leaders.js';
import { createTeamContainer } from '../tools/team/composition/container.js';
import { listActivePeople } from '../tools/team/application/usecases/index.js';
import { roleMirrorPeople } from '../tools/team/domain/roleMirrorScope.js';

const body = document.querySelector('#rm-admin-body');
const denied = document.querySelector('#rm-admin-denied');
const navAdmin = document.querySelector('#rm-nav-admin');
const app = document.querySelector('rm-admin');
const dashboard = document.querySelector('admin-dashboard');

if (app) {
  app.items = ITEMS;
  app.roles = ROLES;
  app.dimensions = DIMENSIONS;
}
if (dashboard) dashboard.roles = ROLES;

/** Sub-pestañas: una sola visible, sin apilar bloques detrás de un scroll. */
function wireTabs() {
  const tabs = [...document.querySelectorAll('#rm-admin-tabs [data-tab]')];
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      for (const other of tabs) {
        const on = other === tab;
        other.classList.toggle('on', on);
        other.setAttribute('aria-selected', String(on));
        document.querySelector(`[data-panel="${other.dataset.tab}"]`)?.toggleAttribute('hidden', !on);
      }
    });
  }
}

onUserChanged(async (user) => {
  if (!user || !body || !app) return;
  let access = null;
  try { access = await resolveAccess(user); } catch { /* sin acceso resuelto */ }
  const gobierna = canGovern(access);
  const gate = await guardToolPage('rolemirror', user, { isSuperadmin: gobierna, appEl: body });
  if (!gate) return;
  // Ver la herramienta no da derecho a gestionar los perfiles de los demás: esta
  // puerta pide `manage`, y quien no lo tiene se queda con la explicación.
  if (!(gobierna || gate.manage)) {
    body.remove();
    denied?.toggleAttribute('hidden', false);
    return;
  }
  body.toggleAttribute('hidden', false);
  navAdmin?.toggleAttribute('hidden', false);
  wireTabs();

  try { app.orgConfig = await getOrgConfig(); } catch { app.orgConfig = null; }

  // El panel de resumen solo distingue «tu equipo» de «toda la organización».
  if (dashboard) {
    dashboard.viewerScope = leadsTeam(access) && !gobierna ? 'team' : 'all';
    dashboard.leaderUid = user.uid;
    // Dispara la carga de perfiles dentro del componente.
    dashboard.uid = user.uid;
  }

  try {
    const viewAll = gobierna;
    const leaderUids = viewAll ? null : branchScopeFor(access, await listLeaders(), user.uid);
    const { persistence } = await createTeamContainer({ mode: 'firestore', leaderUid: user.uid, viewAll, leaderUids });
    app.people = roleMirrorPeople(await listActivePeople(persistence));
  } catch {
    app.people = [];
  }
});
