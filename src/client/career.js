/**
 * Glue de cliente del Mapa de Carrera. Define <career-app>, resuelve la sesión y
 * el tenant (por el dominio), comprueba pertenencia y construye el container.
 */
import '../components/career/career-app.js';
import { onUserChanged } from '../lib/auth.js';
import { createCareerContainer } from '../tools/career/composition/container.js';
import { resolveTenantContext } from './tenant-context.js';

const app = document.querySelector('career-app');

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    const { tenant, role } = await resolveTenantContext(user);
    if (!role) {
      app.error = 'No perteneces a esta organización. Pide acceso a un administrador.';
      return;
    }
    const { store } = await createCareerContainer({ mode: 'firestore', tenantId: tenant.id });
    app.uid = user.uid;
    app.store = store;
  } catch (err) {
    app.error = err instanceof Error ? err.message : 'No se pudo inicializar el mapa de carrera.';
  }
});
