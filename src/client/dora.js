/**
 * Glue de cliente de la herramienta DORA. Define <dora-app>, resuelve el acceso
 * de la instancia (superadmin/líder), crea el container (Firestore) e inyecta la
 * persistencia. El guard de /tools/dora (requireAuth) ya redirige a /login sin sesión.
 */
import '../components/dora/dora-app.js';
import { onUserChanged } from '../lib/auth.js';
import { createDoraContainer } from '../tools/dora/composition/container.js';
import { resolveAccess } from '../lib/access.js';

const app = document.querySelector('dora-app');

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    const { role } = await resolveAccess(user);
    if (!role) {
      app.error = 'No tienes acceso. Pide a un superadmin que te dé de alta como líder.';
      return;
    }
    const { persistence, refresh } = await createDoraContainer({ mode: 'firestore' });
    app.isAdmin = role === 'superadmin'; // solo el superadmin configura repos
    app.refresh = refresh;
    app.persistence = persistence;
  } catch (err) {
    app.error = err instanceof Error ? err.message : 'No se pudo inicializar DORA.';
  }
});
