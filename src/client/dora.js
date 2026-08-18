/**
 * Glue de cliente de la herramienta DORA. Define <dora-app>, resuelve el acceso
 * de la instancia (superadmin/manager), crea el container (Firestore) e inyecta la
 * persistencia. El guard de /tools/dora (requireAuth) ya redirige a /login sin sesión.
 */
import '../components/dora/dora-app.js';
import { onUserChanged } from '../lib/auth.js';
import { createDoraContainer } from '../tools/dora/composition/container.js';
import { resolveAccess } from '../lib/access.js';
import { canGovern, hasAccess, leadsTeam } from '../lib/accessRoles.js';
import { guardToolPage } from '../lib/toolGate.js';
import { interpretMetrics, loadInterpretation } from '../lib/metricsAi.js';

const app = document.querySelector('dora-app');

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    const access = await resolveAccess(user);
    // Gate por política de la herramienta (RMR-TSK-0387): PRIMERO la política
    // (si deniega, pantalla de sin-acceso); después los requisitos internos.
    const gate = await guardToolPage('dora', user, { isSuperadmin: canGovern(access), appEl: app });
    if (!gate) return;
    if (!hasAccess(access)) {
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
    // Gestión por política (RMR-TSK-0388): managedBy compone con los roles legacy
    // (las reglas lo respaldan vía /toolManagers).
    app.canEdit = canGovern(access) || leadsTeam(access) || gate.manage;
    // Asignar/compartir repos (RMR-TSK-0185): solo el gobierno; necesita el
    // catálogo de líderes para los selects (best-effort, sin líderes no aparece).
    app.isAdmin = canGovern(access);
    if (app.isAdmin) {
      const { listLeaders } = await import('../lib/leaders.js');
      app.leaders = await listLeaders().catch(() => []);
    }
    app.refresh = refresh;
    app.interpret = interpretMetrics; // (re)generar la interpretación: solo el gobierno
    app.loadSaved = loadInterpretation; // interpretación guardada: la ven todos
    app.canInterpret = canGovern(access); // el botón solo lo ve el gobierno de instancia
    app.persistence = persistence;
  } catch (err) {
    app.error = err instanceof Error ? err.message : 'No se pudo inicializar DORA.';
  }
});
