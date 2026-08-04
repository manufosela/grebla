/**
 * Glue de cliente de la Biblioteca de la bodega: define <library-app>, pasa el
 * gate de política ('library') e inyecta uid + displayName + canCurate. El
 * catálogo lo curan managers/superadmin: canCurate ESPEJA la regla
 * (isSuperAdmin() || isLeader()) leyendo el propio doc /leaders/{uid} — no un
 * rol derivado que diverge (un supermanager sin doc de líder no cura).
 */
import { doc, getDoc } from 'firebase/firestore';
import '../components/common/tool-nav.js';
import '../components/library/library-app.js';
import { db } from '../lib/firebase.js';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { canGovern } from '../lib/accessRoles.js';
import { guardToolPage } from '../lib/toolGate.js';

const app = document.querySelector('library-app');

onUserChanged(async (user) => {
  if (!user || !app) return;
  let isSuperadmin = false;
  try { isSuperadmin = canGovern(await resolveAccess(user)); } catch { /* sin acceso de gobierno */ }
  if (!(await guardToolPage('library', user, { isSuperadmin, appEl: app }))) return;
  let isLeader = false;
  try {
    isLeader = (await getDoc(doc(db, 'leaders', user.uid))).exists();
  } catch { /* sin doc de líder */ }
  app.canCurate = isSuperadmin || isLeader;
  app.displayName = user.displayName ?? user.email ?? null;
  app.uid = user.uid;
});
