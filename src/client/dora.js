/**
 * Glue de cliente de la herramienta DORA. Define <dora-app>, resuelve la sesión
 * y el rol admin, crea el container (Firestore) e inyecta la persistencia.
 * El guard de /tools/dora (requireAuth) ya redirige a /login sin sesión.
 */
import '../components/dora/dora-app.js';
import { onUserChanged } from '../lib/auth.js';
import { createDoraContainer } from '../tools/dora/composition/container.js';
import { resolveTenantContext } from './tenant-context.js';

const app = document.querySelector('dora-app');

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    const { tenant, role } = await resolveTenantContext(user);
    if (!role) {
      app.error = 'No perteneces a esta organización. Pide acceso a un administrador.';
      return;
    }
    const { persistence, refresh } = await createDoraContainer({ mode: 'firestore', tenantId: tenant.id });
    app.isAdmin = role === 'admin'; // solo tenant-admin configura repos
    app.refresh = refresh;
    app.persistence = persistence;
  } catch (err) {
    app.error = err instanceof Error ? err.message : 'No se pudo inicializar DORA.';
  }
});
