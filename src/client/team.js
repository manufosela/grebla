/**
 * Glue de cliente de la herramienta de seguimiento de equipo. Define <team-app>,
 * resuelve el acceso de la instancia (superadmin/manager) y construye el container
 * Firestore a nivel raíz (las personas viven a nivel de instancia con
 * ownerLeaderUid). El guard de /tools/team (requireAuth) ya redirige a /login.
 */
import '../components/team/team-app.js';
import { onUserChanged } from '../lib/auth.js';
import { createTeamContainer } from '../tools/team/composition/container.js';
import { listLeaders } from '../lib/leaders.js';
import { resolveAccess } from '../lib/access.js';
import { canGovern, leadersReportingTo } from '../lib/accessRoles.js';
import { getFramework } from '../lib/careerFramework.js';

const app = document.querySelector('team-app');

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    // Acceso en dos ejes (RMR-TSK-0305): el gobierno de instancia (canGovern) da
    // el "ver todo" y el mando del catálogo de roles; el alcance de rama sale del
    // rol funcional. Independientes: un admin puede además ser manager o head.
    const access = await resolveAccess(user);
    if (!access.role) {
      app.error = 'No tienes acceso. Pide a un superadmin que te dé de alta como manager.';
      return;
    }
    // Los managers de la instancia se necesitan tanto para el selector de
    // compartir personas como para resolver la rama de un supermanager (los EMs
    // que le reportan), así que se cargan ANTES de construir el container.
    const [members, framework] = await Promise.all([listLeaders(), getFramework()]);
    // Alcance de rama (supermanager, RMR-TSK-0292): ve y actúa sobre las personas
    // de los EMs que le reportan + las suyas propias si además es líder. Un líder
    // normal no pasa leaderUids (queda con su filtro por owner + compartidas).
    const leaderUids = access.functionalRole === 'supermanager'
      ? [user.uid, ...leadersReportingTo(members, user.uid)]
      : null;
    const { persistence, storage } = await createTeamContainer({
      mode: 'firestore',
      leaderUid: user.uid,
      viewAll: canGovern(access), // el gobierno (admin) ve y gestiona a toda la organización
      leaderUids,
    });
    app.uid = user.uid;
    app.storage = storage;
    app.isAdmin = canGovern(access); // el gobierno de instancia manda en el catálogo de roles
    app.members = members;
    app.framework = framework;
    app.persistence = persistence; // dispara la carga inicial en el componente
  } catch (err) {
    app.error = err instanceof Error ? err.message : 'No se pudo inicializar la herramienta.';
  }
});
