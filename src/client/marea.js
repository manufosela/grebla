/**
 * Glue de cliente de Marea: define <marea-fill> e inyecta el uid del usuario
 * logado. La ruta es protegida (requireAuth en Base + client/layout.js redirige
 * a /login si no hay sesión), así que cuando llega un `user` ya está autenticado.
 */
import '../components/common/tool-nav.js';
import '../components/marea/marea-app.js';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { canGovern } from '../lib/accessRoles.js';
import { guardToolPage } from '../lib/toolGate.js';

const app = document.querySelector('marea-app');

onUserChanged(async (user) => {
  if (!user || !app) return;
  // Gate por política de la herramienta (RMR-TSK-0387): corta ANTES de montar.
  let isSuperadmin = false;
  try { isSuperadmin = canGovern(await resolveAccess(user)); } catch { /* sin acceso de gobierno */ }
  const gate = await guardToolPage('marea', user, { isSuperadmin, appEl: app });
  if (!gate) return;
  app.uid = user.uid;
  // La pestaña de administración sale del MISMO permiso que ya decide quién
  // gestiona la herramienta; no hay un rol nuevo ni una lista aparte.
  app.canManage = gate.manage;
});
