/**
 * Glue de cliente de la herramienta O2O. Define <o2o-app>, resuelve el acceso
 * (superadmin/líder), crea el container (Firestore) e inyecta la persistencia.
 * El guard de /tools/o2o (requireAuth) ya redirige a /login sin sesión. La parte
 * del ingeniero NO vive aquí: irá en mi-espacio (fase futura).
 */
import '../components/o2o/o2o-app.js';
import { onUserChanged } from '../lib/auth.js';
import { createO2OContainer } from '../tools/o2o/composition/container.js';
import { resolveAccess } from '../lib/access.js';

const app = document.querySelector('o2o-app');

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    const { role } = await resolveAccess(user);
    if (role !== 'superadmin' && role !== 'leader') {
      app.error = 'Esta herramienta es para líderes. Tu espacio de O2O está en «Mi espacio».';
      return;
    }
    const { persistence } = await createO2OContainer({ mode: 'firestore' });
    app.canEdit = true; // líder/superadmin
    app.persistence = persistence;
  } catch (err) {
    app.error = err instanceof Error ? err.message : 'No se pudo inicializar el O2O.';
  }
});
