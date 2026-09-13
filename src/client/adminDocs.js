/**
 * Glue de la gestión de documentos (RMR-PCS-0041): corta el paso a quien no
 * gestiona la herramienta y, a quien solo mira, le deja la lista en lectura.
 *
 * La pantalla ORGANIZA; quien protege de verdad son las reglas de Storage y de
 * Firestore, que piden lo mismo que se comprueba aquí.
 */
import '../components/admin/docs-manager.js';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { canGovern } from '../lib/accessRoles.js';
import { guardToolPage } from '../lib/toolGate.js';

const app = document.getElementById('docs');

onUserChanged(async (user) => {
  if (!user || !app) return;
  let gobierna = false;
  try { gobierna = canGovern(await resolveAccess(user)); } catch { /* sin gobierno */ }
  const gate = await guardToolPage('docs', user, { isSuperadmin: gobierna, appEl: app });
  if (!gate) return;
  // Sin permiso de gestión se ve la lista, pero no se publica ni se retira: es
  // la misma información que en /documentacion, sin los botones que no le tocan.
  app.readOnly = !(gobierna || gate.manage);
});
