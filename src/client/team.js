/**
 * Glue de cliente de la herramienta de seguimiento de equipo. Define <team-app>,
 * resuelve la sesión y el TENANT (por el dominio), comprueba la pertenencia y
 * construye el container Firestore bajo /tenants/{tenantId} (las personas viven a
 * nivel de tenant con ownerLeaderUid). El guard de /tools/team (requireAuth) ya
 * redirige a /login sin sesión.
 */
import '../components/team/team-app.js';
import { onUserChanged } from '../lib/auth.js';
import { createTeamContainer } from '../tools/team/composition/container.js';
import { listTenantMembers } from '../lib/firestore.js';
import { resolveTenantContext } from './tenant-context.js';

const app = document.querySelector('team-app');

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    const { tenant, role } = await resolveTenantContext(user);
    if (!role) {
      app.error = 'No perteneces a esta organización. Pide acceso a un administrador.';
      return;
    }
    const { persistence, storage } = await createTeamContainer({
      mode: 'firestore',
      tenantId: tenant.id,
      leaderUid: user.uid,
    });
    app.uid = user.uid;
    app.storage = storage;
    app.isAdmin = role === 'admin'; // tenant-admin gobierna el catálogo de roles
    // Líderes del tenant, para el selector de compartir personas (Fase 3b).
    app.members = await listTenantMembers(tenant.id);
    app.persistence = persistence; // dispara la carga inicial en el componente
  } catch (err) {
    app.error = err instanceof Error ? err.message : 'No se pudo inicializar la herramienta.';
  }
});
