/**
 * Glue de la página de Documentación (RMR-PCS-0041). La lista la lee cualquiera
 * con sesión; el gate de la herramienta decide si la tarjeta se ofrece.
 */
import '../components/docs/docs-reader.js';
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
  app.canManage = gobierna || gate.manage;
  app.ready = true;
});
