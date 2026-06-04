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

  // Estado de sesión: asigna uid y carga la configuración de org activa.
  onUserChanged(async (user) => {
    el.uid = user ? user.uid : null;
    if (user) {
      try {
        el.orgConfig = await getOrgConfig();
      } catch {
        el.orgConfig = null;
      }
    } else {
      el.orgConfig = null;
    }
  });
}
