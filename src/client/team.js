/**
 * Glue de cliente de la herramienta de seguimiento de equipo. Define <team-app>,
 * resuelve el acceso de la instancia (superadmin/líder) y construye el container
 * Firestore a nivel raíz (las personas viven a nivel de instancia con
 * ownerLeaderUid). El guard de /tools/team (requireAuth) ya redirige a /login.
 */
import '../components/team/team-app.js';
import { onUserChanged } from '../lib/auth.js';
import { createTeamContainer } from '../tools/team/composition/container.js';
import { listLeaders } from '../lib/leaders.js';
import { resolveAccess } from '../lib/access.js';
import { getFramework } from '../lib/careerFramework.js';

const app = document.querySelector('team-app');

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    const { role } = await resolveAccess(user);
    if (!role) {
      app.error = 'No tienes acceso. Pide a un superadmin que te dé de alta como líder.';
      return;
    }
    const { persistence, storage } = await createTeamContainer({
      mode: 'firestore',
      leaderUid: user.uid,
      viewAll: role === 'superadmin', // el superadmin ve y gestiona a toda la organización
    });
    app.uid = user.uid;
    app.storage = storage;
    app.isAdmin = role === 'superadmin'; // el superadmin gobierna el catálogo de roles
    // Líderes de la instancia (compartir personas) y framework de carrera
    // (disciplinas/niveles y composición del título), en paralelo.
    const [members, framework] = await Promise.all([listLeaders(), getFramework()]);
    app.members = members;
    app.framework = framework;
    app.persistence = persistence; // dispara la carga inicial en el componente
  } catch (err) {
    app.error = err instanceof Error ? err.message : 'No se pudo inicializar la herramienta.';
  }
});
