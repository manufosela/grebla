/**
 * Glue de cliente del Mapa de Carrera. Define <career-app>, resuelve el acceso de
 * la instancia (superadmin/líder) y construye el container.
 */
import '../components/career/career-app.js';
import { onUserChanged } from '../lib/auth.js';
import { createCareerContainer } from '../tools/career/composition/container.js';
import { resolveAccess } from '../lib/access.js';

const app = document.querySelector('career-app');

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    const { role } = await resolveAccess(user);
    if (!role) {
      app.error = 'No tienes acceso. Pide a un superadmin que te dé de alta como líder.';
      return;
    }
    const { store } = await createCareerContainer({ mode: 'firestore' });
    app.uid = user.uid;
    app.store = store;
  } catch (err) {
    app.error = err instanceof Error ? err.message : 'No se pudo inicializar el mapa de carrera.';
  }
});
