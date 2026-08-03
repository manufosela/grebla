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
  if (!(await guardToolPage('marea', user, { isSuperadmin, appEl: app }))) return;
  app.uid = user.uid;
});
