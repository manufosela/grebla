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

const app = document.querySelector('card-layout-editor');
const denied = document.querySelector('#cl-denied');

// Las tarjetas salen del CATÁLOGO, no de lo guardado: así una herramienta nueva
// aparece aquí sola y una retirada no deja una fila fantasma imposible de quitar.
if (app) {
  app.cards = {
    home: HUB_TOOLS.map((t) => ({ key: t.href, label: t.name })),
    admin: ADMIN_CARDS.map((c) => ({ key: c.id, label: c.name })),
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
