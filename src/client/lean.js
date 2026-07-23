/**
 * Glue de cliente de la herramienta LEAN / Flujo. Define <lean-app>, resuelve el
 * acceso (superadmin/manager), crea el container (Firestore) e inyecta la persistencia
 * y el refresh (Cloud Function refreshLean). Espeja a client/dora.js.
 */
import '../components/lean/lean-app.js';
import { onUserChanged } from '../lib/auth.js';
import { createLeanContainer } from '../tools/lean/composition/container.js';
import { resolveAccess } from '../lib/access.js';
import { canGovern } from '../lib/accessRoles.js';
import { interpretMetrics, loadInterpretation } from '../lib/metricsAi.js';

const app = document.querySelector('lean-app');

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    const access = await resolveAccess(user);
    const { role } = access;
    if (!role) {
      app.error = 'No tienes acceso. Pide a un superadmin que te dé de alta como manager.';
      return;
    }
    const { persistence, refresh, discover } = await createLeanContainer({
      mode: 'firestore',
      leaderUid: user.uid,
      viewAll: canGovern(access), // el gobierno de instancia ve y gestiona las unidades de toda la organización
    });
    app.canEdit = canGovern(access) || role === 'leader';
    app.refresh = refresh;
    app.discover = discover;
    app.interpret = interpretMetrics; // (re)generar la interpretación: solo el gobierno
    app.loadSaved = loadInterpretation; // interpretación guardada: la ven todos
    app.canInterpret = canGovern(access); // el botón solo lo ve el gobierno de instancia
    app.persistence = persistence;
  } catch (err) {
    app.error = err instanceof Error ? err.message : 'No se pudo inicializar el Flujo (LEAN).';
  }
});
