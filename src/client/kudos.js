/**
 * Glue de cliente de Kudos: define <kudos-app> e inyecta el uid logado tras
 * pasar el gate de política (guardToolPage) — mismo esquema que Marea.
 */
import '../components/common/tool-nav.js';
import '../components/kudos/kudos-app.js';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { canGovern } from '../lib/accessRoles.js';
import { guardToolPage } from '../lib/toolGate.js';

const app = document.querySelector('kudos-app');

onUserChanged(async (user) => {
  if (!user || !app) return;
  let isSuperadmin = false;
  try { isSuperadmin = canGovern(await resolveAccess(user)); } catch { /* sin acceso de gobierno */ }
  if (!(await guardToolPage('kudos', user, { isSuperadmin, appEl: app }))) return;
  app.uid = user.uid;
});
