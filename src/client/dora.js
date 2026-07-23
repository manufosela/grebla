/**
 * Glue de cliente de la herramienta DORA. Define <dora-app>, resuelve el acceso
 * de la instancia (superadmin/manager), crea el container (Firestore) e inyecta la
 * persistencia. El guard de /tools/dora (requireAuth) ya redirige a /login sin sesión.
 */
import '../components/dora/dora-app.js';
import { onUserChanged } from '../lib/auth.js';
import { createDoraContainer } from '../tools/dora/composition/container.js';
import { resolveAccess } from '../lib/access.js';
import { canGovern } from '../lib/accessRoles.js';
import { interpretMetrics, loadInterpretation } from '../lib/metricsAi.js';

const app = document.querySelector('dora-app');

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    const access = await resolveAccess(user);
    const { role } = access;
    if (!role) {
      app.error = 'No tienes acceso. Pide a un superadmin que te dé de alta como manager.';
      return;
    }
    const { persistence, refresh } = await createDoraContainer({
      mode: 'firestore',
      leaderUid: user.uid,
      viewAll: canGovern(access), // el gobierno de instancia ve y gestiona los repos de toda la organización
    });
    // El manager gestiona SUS repos; el gobierno, todos. El viewer (solo lectura,
    // tipo C-level) nunca edita: solo ve la lista.
    app.canEdit = canGovern(access) || role === 'leader';
    app.refresh = refresh;
    app.interpret = interpretMetrics; // (re)generar la interpretación: solo el gobierno
    app.loadSaved = loadInterpretation; // interpretación guardada: la ven todos
    app.canInterpret = canGovern(access); // el botón solo lo ve el gobierno de instancia
    app.persistence = persistence;
  } catch (err) {
    app.error = err instanceof Error ? err.message : 'No se pudo inicializar DORA.';
  }
});
