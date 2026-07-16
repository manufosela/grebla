/**
 * Glue de cliente de la herramienta LEAN / Flujo. Define <lean-app>, resuelve el
 * acceso (superadmin/manager), crea el container (Firestore) e inyecta la persistencia
 * y el refresh (Cloud Function refreshLean). Espeja a client/dora.js.
 */
import '../components/lean/lean-app.js';
import { onUserChanged } from '../lib/auth.js';
import { createLeanContainer } from '../tools/lean/composition/container.js';
import { resolveAccess } from '../lib/access.js';
import { interpretMetrics, loadInterpretation } from '../lib/metricsAi.js';

const app = document.querySelector('lean-app');

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    const { role } = await resolveAccess(user);
    if (!role) {
      app.error = 'No tienes acceso. Pide a un superadmin que te dé de alta como manager.';
      return;
    }
    const { persistence, refresh, discover } = await createLeanContainer({
      mode: 'firestore',
      leaderUid: user.uid,
      viewAll: role === 'superadmin', // el superadmin ve y gestiona las unidades de toda la organización
    });
    app.canEdit = role === 'superadmin' || role === 'leader';
    app.refresh = refresh;
    app.discover = discover;
    app.interpret = interpretMetrics; // (re)generar la interpretación: solo superadmin
    app.loadSaved = loadInterpretation; // interpretación guardada: la ven todos
    app.canInterpret = role === 'superadmin'; // el botón solo lo ve el superadmin
    app.persistence = persistence;
  } catch (err) {
    app.error = err instanceof Error ? err.message : 'No se pudo inicializar el Flujo (LEAN).';
  }
});
