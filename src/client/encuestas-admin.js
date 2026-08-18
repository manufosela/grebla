/**
 * Glue del panel de administración de Encuestas (RMR-TSK-0325 / RMR-TSK-0328).
 * Acceso: superadmin O gestor de encuestas (People). El gate vive aquí (la página
 * ya no usa requireAdmin) y lo respaldan las reglas de Firestore.
 */
import '../components/common/tool-nav.js';
import '../components/survey/survey-admin.js';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { canGovern } from '../lib/accessRoles.js';
import { isSurveyAdmin } from '../lib/survey.js';

onUserChanged(async (user) => {
  if (!user) return; // el guard de requireAuth ya redirige a /login
  try {
    const access = await resolveAccess(user);
    const allowed = canGovern(access) || (await isSurveyAdmin(user.uid));
    if (!allowed) { location.replace('/'); return; }
    // Borrar encuestas es exclusivo del superadmin (eje de gobierno de instancia),
    // por su ROL real —no por el modo de vista activo— así el conmutador de vistas
    // no le oculta el borrado.
    const panel = document.querySelector('survey-admin');
    if (panel) panel.canDelete = canGovern(access);
  } catch {
    location.replace('/');
  }
});
