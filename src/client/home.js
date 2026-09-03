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
import { branchScopeFor, canGovern, hasAccess } from '../lib/accessRoles.js';
import { guardToolPage } from '../lib/toolGate.js';
import { listLeaders } from '../lib/leaders.js';
import { createTeamContainer } from '../tools/team/composition/container.js';
import { listActivePeople } from '../tools/team/application/usecases/index.js';

const el = document.querySelector('role-questionnaire');
const review = document.querySelector('rm-proposal-review');
const select = document.querySelector('#rm-person');
const picker = document.querySelector('#rm-person-picker');
const empty = document.querySelector('#rm-empty');
const questionnaire = document.querySelector('role-questionnaire');

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
      // Alcance REAL de quien abre, igual que en la herramienta Equipo
      // (RMR-BUG-0107): antes se pedía solo `leaderUid`, así que la lista se
      // quedaba en quien te reporta directamente. Un superadmin no veía a toda
      // la organización, y un CTO o un Head no llegaba a la gente que cuelga de
      // sus managers — parecía que hacía falta gobierno de instancia para
      // consultar a alguien de tu propia rama, y no es así.
      const viewAll = canGovern(access);
      // Rama transitiva: todo líder con managers debajo ve su subárbol. Sin
      // nadie debajo, null → el ámbito simple de siempre.
      const leaderUids = viewAll ? null : branchScopeFor(access, await listLeaders(), user.uid);
      const { persistence } = await createTeamContainer({
        mode: 'firestore', leaderUid: user.uid, viewAll, leaderUids,
      });
      const people = await listActivePeople(persistence);
      // Sin nadie a quien evaluar no se enseña un desplegable vacío, que parece
      // una app rota: se explica y se envía a «Mi Role Mirror», que es lo que esa
      // persona buscaba (RMR-BUG-0110). Le pasa a cualquier ingeniero, porque la
      // audiencia de la herramienta es toda su rama pero la pantalla es de quien
      // tiene equipo.
      picker?.toggleAttribute('hidden', people.length === 0);
      empty?.toggleAttribute('hidden', people.length > 0);
      questionnaire?.toggleAttribute('hidden', people.length === 0);
      if (select) {
        select.replaceChildren(new Option('— Elige una persona —', ''));
        for (const p of people) select.appendChild(new Option(p.name, p.id));
      }
    } catch {
      el.orgConfig = null;
    }
  });
}
