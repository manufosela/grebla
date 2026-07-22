/**
 * Glue de cliente de Retros: define <retro-app> y le inyecta el contexto según el
 * rol. El manager (o superadmin como manager) gestiona sus retros con el roster de su
 * equipo; el ingeniero participa en las de su equipo (sin roster: los nombres de
 * owner van denormalizados en cada acción).
 */
import '../components/common/tool-nav.js';
import '../components/retro/retro-app.js';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { getMyPerson } from '../lib/engineer.js';
import { listTeamMembers } from '../lib/retros.js';
import { listLeaders } from '../lib/leaders.js';
import { leadersReportingTo } from '../lib/accessRoles.js';

const app = document.querySelector('retro-app');

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    const { role } = await resolveAccess(user);
    app.uid = user.uid;
    if (role === 'leader' || role === 'supermanager' || role === 'superadmin') {
      app.leaderUid = user.uid;
      app.canManage = true;
      // Alcance de rama (RMR-TSK-0294): el supermanager ve las retros y el roster
      // de los líderes que le reportan a cualquier profundidad, además de los
      // suyos. Crear una retro sigue siendo a su nombre (ownerLeaderUid = su uid).
      const leaderUids = role === 'supermanager'
        ? [user.uid, ...leadersReportingTo(await listLeaders(), user.uid)]
        : null;
      app.leaderUids = leaderUids;
      app.members = await listTeamMembers(leaderUids ?? user.uid);
    } else if (role === 'engineer') {
      const person = await getMyPerson(user.uid);
      app.leaderUid = person?.ownerLeaderUid ?? null;
      app.canManage = false;
      app.members = [];
    } else {
      app.canManage = false;
    }
  } catch (err) {
    console.error('[retros] no se pudo inicializar', err);
  }
});
