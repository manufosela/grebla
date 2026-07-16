/**
 * Glue de cliente de Retros: define <retro-app> y le inyecta el contexto según el
 * rol. El líder (o superadmin como líder) gestiona sus retros con el roster de su
 * equipo; el ingeniero participa en las de su equipo (sin roster: los nombres de
 * owner van denormalizados en cada acción).
 */
import '../components/common/tool-nav.js';
import '../components/retro/retro-app.js';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { getMyPerson } from '../lib/engineer.js';
import { listTeamMembers } from '../lib/retros.js';

const app = document.querySelector('retro-app');

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    const { role } = await resolveAccess(user);
    app.uid = user.uid;
    if (role === 'leader' || role === 'superadmin') {
      app.leaderUid = user.uid;
      app.canManage = true;
      app.members = await listTeamMembers(user.uid);
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
