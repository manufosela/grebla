/**
 * Glue de cliente de la herramienta de seguimiento de equipo. Define <team-app>,
 * resuelve la sesión y construye el container (modo Firestore con ownerId = uid
 * del usuario), inyectando persistence y storage en el componente. El guard de
 * /tools/team (requireAuth en el layout) ya redirige a /login sin sesión.
 */
import '../components/team/team-app.js';
import { onUserChanged } from '../lib/auth.js';
import { createTeamContainer } from '../tools/team/composition/container.js';

const app = document.querySelector('team-app');

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    const { persistence, storage } = await createTeamContainer({ mode: 'firestore', ownerId: user.uid });
    app.uid = user.uid;
    app.storage = storage;
    app.persistence = persistence; // dispara la carga inicial en el componente
  } catch (err) {
    app.error = err instanceof Error ? err.message : 'No se pudo inicializar la herramienta.';
  }
});
