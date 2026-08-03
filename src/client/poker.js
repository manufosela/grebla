/**
 * Glue de cliente de Scrum Poker: define <poker-app> y le inyecta el contexto
 * según el rol. El manager (o superadmin/supermanager) crea y gestiona sus
 * sesiones; el ingeniero participa en las de su equipo. El nombre para la
 * presencia sale de la ficha de GREBLA (denormalizado), con el displayName de la
 * cuenta como respaldo visible.
 */
import '../components/common/tool-nav.js';
import '../components/poker/poker-app.js';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { getMyPerson } from '../lib/engineer.js';
import { listLeaders } from '../lib/leaders.js';
import { canGovern, leadersReportingTo } from '../lib/accessRoles.js';
import { guardToolPage } from '../lib/toolGate.js';

const app = document.querySelector('poker-app');

// Enlace compartido: /poker?s=<sessionId> abre esa sesión directamente, aunque no
// salga en la lista acotada por equipo (RMR-TSK-0324).
if (app) app.openSessionId = new URLSearchParams(location.search).get('s');

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    const access = await resolveAccess(user);
    // Gate por política de la herramienta (RMR-TSK-0387): corta ANTES de crear nada.
    if (!(await guardToolPage('poker', user, { isSuperadmin: canGovern(access), appEl: app }))) return;

    const { role } = access;
    const person = await getMyPerson(user.uid).catch(() => null);
    app.uid = user.uid;
    app.authorName = person?.name ?? user.displayName ?? 'Sin nombre';
    if (role === 'leader' || role === 'supermanager' || canGovern(access)) {
      app.leaderUid = user.uid;
      app.canManage = true;
      // Alcance de rama (RMR-TSK-0294): el supermanager ve además las sesiones de
      // los líderes que le reportan. Crearlas sigue siendo a su nombre.
      app.leaderUids = access.functionalRole === 'supermanager'
        ? [user.uid, ...leadersReportingTo(await listLeaders(), user.uid)]
        : null;
    } else if (role === 'engineer') {
      app.leaderUid = person?.ownerLeaderUid ?? null;
      app.canManage = false;
    } else {
      app.canManage = false;
    }
  } catch (err) {
    console.error('[poker] no se pudo inicializar', err);
  }
});
