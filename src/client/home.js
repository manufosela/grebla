/**
 * Glue de Role Mirror: el LÍDER elige una persona de su equipo y rellena su
 * perfil (heteroevaluación). Carga las personas del manager (tool Equipo) en un
 * selector y, al elegir una, inyecta personId en <role-questionnaire>.
 */
import '../components/role-questionnaire.js';
import { ITEMS, DIMENSIONS } from '../data/items.js';
import { ROLES } from '../data/roles.js';
import { onUserChanged } from '../lib/auth.js';
import { getOrgConfig } from '../lib/firestore.js';
import { resolveAccess } from '../lib/access.js';
import { createTeamContainer } from '../tools/team/composition/container.js';
import { listActivePeople } from '../tools/team/application/usecases/index.js';

const el = document.querySelector('role-questionnaire');
const select = document.querySelector('#rm-person');

if (el) {
  el.items = ITEMS;
  el.roles = ROLES;
  el.dimensions = DIMENSIONS;

  el.addEventListener('session-created', (event) => {
    const url = new URL(location.href);
    url.searchParams.set('session', event.detail.sessionId);
    history.replaceState(null, '', url);
  });

  if (select) {
    select.addEventListener('change', () => {
      el.sessionId = null;
      el.personId = select.value || null;
    });
  }

  onUserChanged(async (user) => {
    if (!user) {
      el.personId = null;
      el.orgConfig = null;
      return;
    }
    try {
      const { role } = await resolveAccess(user);
      if (!role) {
        el.orgConfig = null;
        return;
      }
      el.orgConfig = await getOrgConfig();
      // Atribución (RMR-TSK-0226): quien rellena aquí es el manager.
      el.editorKind = 'leader';
      el.editorUid = user.uid;
      el.editorName = user.displayName ?? null;
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
