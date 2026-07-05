/**
 * Glue del editor del juego (JG-16). Monta <game-editor> y verifica que el
 * usuario es SUPERADMIN (el único rol que escribe /careerMap y /careerRoutes
 * según reglas): cualquier otro rol se redirige fuera — aquí no hay modo de
 * solo lectura, un viewer ya ve el contenido jugando.
 */
import '../components/admin/game-editor.js';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';

const el = document.querySelector('game-editor');

onUserChanged(async (user) => {
  if (!el) return;
  if (!user) {
    location.replace('/login?redirect=%2Fadmin%2Fjuego');
    return;
  }
  try {
    const { role } = await resolveAccess(user);
    if (role !== 'superadmin') {
      location.replace('/');
      return;
    }
    el.ready = true;
  } catch {
    location.replace('/');
  }
});
