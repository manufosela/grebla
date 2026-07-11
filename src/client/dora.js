/**
 * Glue de cliente de la herramienta DORA. Define <dora-app>, resuelve el acceso
 * de la instancia (superadmin/líder), crea el container (Firestore) e inyecta la
 * persistencia. El guard de /tools/dora (requireAuth) ya redirige a /login sin sesión.
 */
import '../components/dora/dora-app.js';
import { onUserChanged } from '../lib/auth.js';
import { createDoraContainer } from '../tools/dora/composition/container.js';
import { resolveAccess } from '../lib/access.js';
import { interpretMetrics, loadInterpretation } from '../lib/metricsAi.js';

const app = document.querySelector('dora-app');

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    const { role } = await resolveAccess(user);
    if (!role) {
      app.error = 'No tienes acceso. Pide a un superadmin que te dé de alta como líder.';
      return;
    }
    const { persistence, refresh } = await createDoraContainer({
      mode: 'firestore',
      leaderUid: user.uid,
      viewAll: role === 'superadmin', // el superadmin ve y gestiona los repos de toda la organización
    });
    // El líder gestiona SUS repos; el superadmin, todos. El viewer (solo lectura,
    // tipo C-level) nunca edita: solo ve la lista.
    app.canEdit = role === 'superadmin' || role === 'leader';
    app.refresh = refresh;
    app.interpret = interpretMetrics; // (re)generar la interpretación: solo superadmin
    app.loadSaved = loadInterpretation; // interpretación guardada: la ven todos
    app.canInterpret = role === 'superadmin'; // el botón solo lo ve el superadmin
    app.persistence = persistence;
  } catch (err) {
    app.error = err instanceof Error ? err.message : 'No se pudo inicializar DORA.';
  }
});
