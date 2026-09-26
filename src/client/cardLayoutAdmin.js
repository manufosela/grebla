/**
 * Glue del editor del ORDEN DE LAS TARJETAS (RMR-TSK-0571).
 *
 * Solo entra quien gobierna la instancia. No es una restricción por prudencia:
 * el orden es uno solo para toda la organización, y con varios editores se pisa
 * —dos personas con criterios distintos se sobrescriben sin enterarse.
 */
import '../components/admin/card-layout-editor.js';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { canGovern } from '../lib/accessRoles.js';
import { getCardLayout, saveCardLayout } from '../lib/cardLayout.js';
import { HUB_TOOLS, ADMIN_CARDS } from '../data/hubCards.js';
import { HUB_GROUPS, GROUP_IDS, groupOf } from '../lib/hubGroups.js';

/**
 * Qué tarjetas NO ve todo el mundo por su ROL (no por su política). Se marcan
 * para que se entienda por qué aparecen en una lista que ordena quien quizá no
 * las vea nunca. Las demás dependen de la política de su herramienta, que se
 * gestiona en otra parte.
 */
const SOLO_QUIEN_LIDERA = new Set(['/tools/team', '/tools/o2o']);

const app = document.querySelector('card-layout-editor');
const denied = document.querySelector('#cl-denied');

// Las tarjetas salen del CATÁLOGO, no de lo guardado: así una herramienta nueva
// aparece aquí sola y una retirada no deja una fila fantasma imposible de quitar.
if (app) {
  app.cards = {
    // El inicio se ordena AGRUPADO, como se ve: `groupLabel` es lo que separa
    // los bloques en el editor.
    home: HUB_TOOLS.map((t) => ({
      key: t.href,
      label: t.name,
      groupLabel: HUB_GROUPS[groupOf(t)].label,
      // El índice del grupo ordena los bloques igual que en el inicio; sin él,
      // el editor los colocaría según el orden guardado, que es plano.
      groupIndex: GROUP_IDS.indexOf(groupOf(t)),
      only: SOLO_QUIEN_LIDERA.has(t.href) ? 'solo quien lidera' : null,
    })),
    admin: ADMIN_CARDS.map((c) => ({
      key: c.id,
      label: c.name,
      only: c.govern ? 'solo superadmin' : null,
    })),
  };
}

onUserChanged(async (user) => {
  if (!user || !app) return;
  let gobierna = false;
  try { gobierna = canGovern(await resolveAccess(user)); } catch { /* sin gobierno */ }
  if (!gobierna) {
    app.remove();
    denied?.toggleAttribute('hidden', false);
    return;
  }

  app.layout = await getCardLayout();
  // La persistencia se inyecta: el componente decide el orden y ESPERA a que se
  // guarde de verdad antes de decir que se guardó.
  app.save = saveCardLayout;
});
