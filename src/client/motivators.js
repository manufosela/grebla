/**
 * Glue de cliente de los juegos de Motivadores. Resuelve el acceso, construye la
 * identidad del jugador (ingeniero o líder), crea el container Firestore e inyecta
 * persistence, identity y la ronda abierta en <motivators-app>. El juego se toma
 * del atributo `deck` del elemento (moving_motivators | affective_motivators).
 */
import '../components/motivators/motivators-app.js';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { getMyPerson } from '../lib/engineer.js';
import { createMotivatorsContainer } from '../tools/motivators/composition/container.js';
import { buildPlayerIdentity } from '../tools/motivators/application/identity.js';
import { getActiveRound } from '../tools/motivators/application/usecases.js';

const app = document.querySelector('motivators-app');

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    const access = await resolveAccess(user);
    if (!access.role) {
      app.error = 'No tienes acceso. Inicia sesión con tu cuenta del equipo.';
      return;
    }
    app.role = access.role;
    const person = access.role === 'engineer' ? await getMyPerson(user.uid) : null;
    app.identity = buildPlayerIdentity(access, person);
    const { persistence } = await createMotivatorsContainer({ mode: 'firestore' });
    app.persistence = persistence;
    const game = app.deck || 'moving_motivators';
    app.round = await getActiveRound(persistence, game);
  } catch (err) {
    app.error = err instanceof Error ? err.message : 'No se pudo iniciar el juego.';
  }
});
