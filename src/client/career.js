/**
 * Glue de cliente del Mapa de Carrera. Define <career-app>, resuelve el acceso de
 * la instancia (superadmin/líder), carga las personas del equipo del líder (igual
 * que Role Mirror) y construye el container. El journey se edita por persona.
 */
import '../components/career/career-app.js';
import { onUserChanged } from '../lib/auth.js';
import { createCareerContainer } from '../tools/career/composition/container.js';
import { resolveAccess } from '../lib/access.js';
import { createTeamContainer } from '../tools/team/composition/container.js';
import { listActivePeople } from '../tools/team/application/usecases/index.js';

const app = document.querySelector('career-app');

onUserChanged(async (user) => {
  if (!app) return;
  if (!user) {
    app.people = [];
    app.personId = null;
    return;
  }
  try {
    const { role } = await resolveAccess(user);
    if (!role) {
      app.error = 'No tienes acceso. Pide a un superadmin que te dé de alta como líder.';
      return;
    }
    const { store } = await createCareerContainer({ mode: 'firestore' });
    // Personas del equipo del líder (reusa la tool Equipo), como en Role Mirror.
    const { persistence } = await createTeamContainer({ mode: 'firestore', leaderUid: user.uid });
    const people = await listActivePeople(persistence);
    app.people = people.map((p) => ({ id: p.id, name: p.name }));
    app.store = store;
  } catch (err) {
    app.error = err instanceof Error ? err.message : 'No se pudo inicializar el mapa de carrera.';
  }
});
