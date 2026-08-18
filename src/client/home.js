/**
 * Glue de Role Mirror: el LÍDER elige una persona de su equipo y rellena su
 * perfil (heteroevaluación). Carga las personas del manager (tool Equipo) en un
 * selector y, al elegir una, inyecta personId en <role-questionnaire>.
 */
import '../components/role-questionnaire.js';
import '../components/rm-proposal-review.js';
import { ITEMS, DIMENSIONS } from '../data/items.js';
import { ROLES } from '../data/roles.js';
import { onUserChanged } from '../lib/auth.js';
import { getOrgConfig } from '../lib/firestore.js';
import { resolveAccess } from '../lib/access.js';
import { canGovern, hasAccess } from '../lib/accessRoles.js';
import { guardToolPage } from '../lib/toolGate.js';
import { createTeamContainer } from '../tools/team/composition/container.js';
import { listActivePeople } from '../tools/team/application/usecases/index.js';

const el = document.querySelector('role-questionnaire');
const review = document.querySelector('rm-proposal-review');
const select = document.querySelector('#rm-person');

if (el) {
  el.items = ITEMS;
  el.roles = ROLES;
  el.dimensions = DIMENSIONS;
  // Revisión de propuesta (RM-v2, RMR-TSK-0423): mismo catálogo; al decidir,
  // el cuestionario se re-inicializa para reflejar la canónica resultante.
  if (review) {
    review.items = ITEMS;
    review.roles = ROLES;
    review.addEventListener('proposal-decided', async () => {
      // Lit agrupa cambios en el mismo tick: para forzar la re-carga hay que
      // dejar que el null se asiente antes de re-poner el personId.
      const personId = el.personId;
      el.sessionId = null;
      el.personId = null;
      await el.updateComplete;
      el.personId = personId;
    });
  }

  el.addEventListener('session-created', (event) => {
    const url = new URL(location.href);
    url.searchParams.set('session', event.detail.sessionId);
    history.replaceState(null, '', url);
  });

  if (select) {
    select.addEventListener('change', () => {
      el.sessionId = null;
      el.personId = select.value || null;
      if (review) {
        review.personId = select.value || null;
        review.personName = select.selectedOptions[0]?.textContent ?? '';
      }
    });
  }

  onUserChanged(async (user) => {
    if (!user) {
      el.personId = null;
      el.orgConfig = null;
      return;
    }
    try {
      const access = await resolveAccess(user);
      // Gate por política de la herramienta (RMR-TSK-0387): PRIMERO la política
      // (si deniega, pantalla de sin-acceso); después los requisitos internos.
      if (!(await guardToolPage('rolemirror', user, { isSuperadmin: canGovern(access), appEl: el }))) return;
      if (!hasAccess(access)) {
        el.orgConfig = null;
        return;
      }
      el.orgConfig = await getOrgConfig();
      // Atribución (RMR-TSK-0226): quien rellena aquí es el manager.
      el.editorKind = 'leader';
      el.editorUid = user.uid;
      el.editorName = user.displayName ?? null;
      if (review) {
        review.orgConfig = el.orgConfig;
        review.editorUid = user.uid;
        review.editorName = user.displayName ?? null;
      }
      // Personas del equipo del manager (reusa la tool Equipo).
      const { persistence } = await createTeamContainer({ mode: 'firestore', leaderUid: user.uid });
      const people = await listActivePeople(persistence);
      if (select) {
        select.replaceChildren(new Option('— Elige una persona —', ''));
        for (const p of people) select.appendChild(new Option(p.name, p.id));
      }
    } catch {
      el.orgConfig = null;
    }
  });
}
