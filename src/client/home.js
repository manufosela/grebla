/**
 * Glue de cliente de la página principal: define <role-questionnaire> y le pasa
 * los datos del dominio como propiedades JS (no define:vars), conecta el estado
 * de auth y la configuración de organización.
 */
import '../components/role-questionnaire.js';
import { ITEMS, DIMENSIONS } from '../data/items.js';
import { ROLES } from '../data/roles.js';
import { onUserChanged } from '../lib/auth.js';
import { getOrgConfig } from '../lib/firestore.js';
import { resolveTenantContext } from './tenant-context.js';

const el = document.querySelector('role-questionnaire');

if (el) {
  el.items = ITEMS;
  el.roles = ROLES;
  el.dimensions = DIMENSIONS;

  // Sesión indicada en la URL (?session=...), si la hay.
  const params = new URLSearchParams(location.search);
  el.sessionId = params.get('session');

  // Cuando el componente crea una sesión nueva, reflejarla en la URL.
  el.addEventListener('session-created', (event) => {
    const url = new URL(location.href);
    url.searchParams.set('session', event.detail.sessionId);
    history.replaceState(null, '', url);
  });

  // Estado de sesión: asigna uid y carga la configuración del tenant activo
  // (resuelto por el path /{tenant}). Solo si el usuario es miembro del tenant.
  onUserChanged(async (user) => {
    el.uid = user ? user.uid : null;
    if (!user) {
      el.tenantId = null;
      el.orgConfig = null;
      return;
    }
    try {
      const { tenant, role } = await resolveTenantContext(user);
      // Solo miembros del tenant persisten/leen su perfil en él.
      el.tenantId = role ? tenant.id : null;
      el.orgConfig = role ? await getOrgConfig(tenant.id) : null;
    } catch {
      el.tenantId = null;
      el.orgConfig = null;
    }
  });
}
