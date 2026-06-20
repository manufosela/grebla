/**
 * Resuelve, en el cliente, el tenant activo (por el dominio) y el rol del usuario
 * en él. Lo usan los glue de los tools (team, dora) para construir su container
 * bajo el tenant correcto.
 */
import { db } from '../lib/firebase.js';
import { createFirestoreTenantStore } from '../tenants/infrastructure/firestore/persistence.js';
import { resolveTenant, getRole } from '../tenants/application/usecases.js';

/**
 * @param {import('firebase/auth').User|null} user
 * @returns {Promise<{ tenant: import('../tenants/domain/types.js').Tenant, role: string|null }>}
 */
export async function resolveTenantContext(user) {
  const store = createFirestoreTenantStore(db);
  const tenant = await resolveTenant(store, {
    hostname: location.hostname,
    pathname: location.pathname,
  });
  if (!tenant) {
    throw new Error('No se ha podido resolver la organización para este dominio.');
  }
  const role = user ? await getRole(store, tenant.id, user.uid) : null;
  return { tenant, role };
}
