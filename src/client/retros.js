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
import { branchScopeFor, canGovern, leadsTeam } from '../lib/accessRoles.js';
import { guardToolPage } from '../lib/toolGate.js';

const app = document.querySelector('retro-app');

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    const access = await resolveAccess(user);
    // Gate por política de la herramienta (RMR-TSK-0387): corta ANTES de crear nada.
    const gate = await guardToolPage('retros', user, { isSuperadmin: canGovern(access), appEl: app });
    if (!gate) return;

    app.uid = user.uid;
    // Gestión por política (RMR-TSK-0388): managedBy compone con los roles legacy.
    if (leadsTeam(access) || canGovern(access) || gate.manage) {
      app.leaderUid = user.uid;
      app.canManage = true;
      // Alcance de rama (RMR-TSK-0294): el supermanager ve las retros y el roster
      // de los líderes que le reportan a cualquier profundidad, además de los
      // suyos. Crear una retro sigue siendo a su nombre (ownerLeaderUid = su uid).
      // Rama transitiva (RMR-TSK-0421): generalizada a todo líder con subárbol.
      const leaderUids = branchScopeFor(access, await listLeaders(), user.uid);
      app.leaderUids = leaderUids;
      app.members = await listTeamMembers(leaderUids ?? user.uid);
    } else if (access.functionalRole === 'engineer') {
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
