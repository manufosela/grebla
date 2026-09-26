/**
 * Glue de la ADMINISTRACIÓN de Equipo (RMR-TSK-0586).
 *
 * Entra quien gestiona equipos: quien lidera, un head o quien gobierna la
 * instancia. Las bajas y la configuración estaban entre las pestañas de uso, al
 * alcance de cualquiera que abriera la herramienta.
 *
 * Construye el mismo container que la herramienta y con el mismo alcance, para
 * que la gente que se ve aquí sea exactamente la que se ve allí.
 */
import '../components/team/team-admin.js';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { branchScopeFor, canGovern, leadsTeam } from '../lib/accessRoles.js';
import { listLeaders } from '../lib/leaders.js';
import { createTeamContainer } from '../tools/team/composition/container.js';

const app = document.querySelector('team-admin');
const denied = document.querySelector('#ta-denied');

onUserChanged(async (user) => {
  if (!user || !app) return;
  let access = null;
  try { access = await resolveAccess(user); } catch { /* sin acceso resuelto */ }
  const gobierna = canGovern(access);
  // Gestionar equipos no es usar la herramienta: aquí se dan de baja personas y
  // se cambian umbrales que afectan a lo que todos ven.
  if (!(gobierna || leadsTeam(access))) {
    app.remove();
    denied?.toggleAttribute('hidden', false);
    return;
  }

  try {
    const leaders = await listLeaders();
    const viewAll = gobierna;
    const { persistence } = await createTeamContainer({
      mode: 'firestore',
      leaderUid: user.uid,
      viewAll,
      leaderUids: viewAll ? null : branchScopeFor(access, leaders, user.uid),
    });
    app.isAdmin = gobierna;
    app.currentUid = user.uid;
    app.persistence = persistence;
  } catch (err) {
    console.error('Administrar Equipo: no se pudo preparar la herramienta.', err);
  }
});
