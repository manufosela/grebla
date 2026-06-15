/**
 * Glue de cliente de la herramienta DORA. Define <dora-app>, resuelve la sesión
 * y el rol admin, crea el container (Firestore) e inyecta la persistencia.
 * El guard de /tools/dora (requireAuth) ya redirige a /login sin sesión.
 */
import '../components/dora/dora-app.js';
import { onUserChanged, isAdmin } from '../lib/auth.js';
import { createDoraContainer } from '../tools/dora/composition/container.js';

const app = document.querySelector('dora-app');

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    const [{ persistence }, admin] = await Promise.all([
      createDoraContainer({ mode: 'firestore' }),
      isAdmin(user.uid),
    ]);
    app.isAdmin = admin; // solo admin puede configurar repos
    app.persistence = persistence;
  } catch (err) {
    app.error = err instanceof Error ? err.message : 'No se pudo inicializar DORA.';
  }
});
