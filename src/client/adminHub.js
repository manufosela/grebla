/**
 * Glue del HUB DE ADMINISTRACIÓN (RMR-TSK-0495).
 *
 * Decide qué tarjetas se ven: la de la organización es de quien gobierna la
 * instancia, y la de cada herramienta, de quien la gestiona. Ese permiso YA
 * existe —el grant `managedBy` de su política, respaldado en las reglas por el
 * espejo /toolManagers—, así que aquí solo se lee; no se inventa un rol nuevo.
 *
 * Y manda el mismo principio que en el hub de herramientas: esto ORGANIZA, no
 * protege. Cada página sigue teniendo su gate, y las reglas de Firestore siguen
 * decidiendo quién escribe qué.
 */
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { canGovern } from '../lib/accessRoles.js';
import { getMyPerson } from '../lib/engineer.js';
import { listToolPolicies } from '../lib/toolPolicies.js';
import { canManageTool } from '../tools/team/domain/toolAccess.js';
import { buildPersonRef } from '../lib/toolGate.js';
import { applyCardOrder } from '../lib/cardOrder.js';

/** Hashes de cuando /admin ERA la gestión de la organización (RMR-TSK-0495). */
const SECCIONES = ['organigrama', 'areas', 'guilds', 'dominios', 'labels', 'career', 'users', 'permisos', 'squads', 'herramientas'];

// Un enlace guardado a /admin#usuarios tiene que seguir llevando a su sección:
// nadie debería reaprender sus favoritos porque hayamos movido una página.
const hash = globalThis.location.hash.slice(1);
if (SECCIONES.includes(hash.split('=')[0])) {
  globalThis.location.replace(`/admin/organizacion#${hash}`);
}

const cards = document.getElementById('admin-cards');
const vacio = document.getElementById('admin-empty');

onUserChanged(async (user) => {
  if (!user) return;
  try {
    const access = await resolveAccess(user);
    const gobierna = canGovern(access);
    // Persona y políticas en paralelo; si fallan, se cae a lo que el gobierno
    // permita en vez de dejar la página en blanco.
    const [person, policies] = await Promise.all([
      getMyPerson(user.uid).catch(() => null),
      listToolPolicies().catch(() => []),
    ]);
    const ref = buildPersonRef(person);
    const politica = new Map(policies.map((p) => [p.toolId, p]));

    let visibles = 0;
    for (const card of cards?.querySelectorAll('[data-admin-id]') ?? []) {
      const id = card.dataset.adminId;
      const puede = card.dataset.govern === 'true'
        ? gobierna
        : gobierna || canManageTool(ref, politica.get(id));
      card.toggleAttribute('hidden', !puede);
      if (puede) visibles += 1;
    }
    // El orden lo decide el superadmin (RMR-TSK-0571); se aplica DESPUES de
    // saber cuales se ven, porque el orden no decide visibilidad.
    await applyCardOrder(cards, 'admin', '[data-admin-id]', (el) => el.dataset.adminId);
    cards?.toggleAttribute('hidden', visibles === 0);
    // Sin nada que administrar se dice, en vez de dejar una página vacía que
    // parece rota.
    vacio?.toggleAttribute('hidden', visibles > 0);
  } catch {
    vacio?.removeAttribute('hidden');
  }
});
