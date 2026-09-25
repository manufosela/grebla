/**
 * Glue del SEGUIMIENTO del plan de desarrollo (RMR-TSK-0566).
 *
 * Es el lado de gestión de la herramienta: entra quien la gestiona, y se le dan
 * las personas de su ámbito —su equipo, su rama o toda la organización, el mismo
 * alcance que en el resto— más el store del juego para leer el viaje y el
 * cronómetro de cada una. Quien no gestiona no pasa.
 */
import '../components/career/career-tracking.js';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { branchScopeFor, canGovern } from '../lib/accessRoles.js';
import { guardToolPage } from '../lib/toolGate.js';
import { listLeaders } from '../lib/leaders.js';
import { createCareerContainer } from '../tools/career/composition/container.js';
import { createTeamContainer } from '../tools/team/composition/container.js';
import { listActivePeople } from '../tools/team/application/usecases/index.js';

const app = document.querySelector('career-tracking');
const denied = document.querySelector('#ct-denied');
const navAdmin = document.querySelector('#cm-nav-admin');

onUserChanged(async (user) => {
  if (!user || !app) return;
  let access = null;
  try { access = await resolveAccess(user); } catch { /* sin acceso resuelto */ }
  const gobierna = canGovern(access);
  const gate = await guardToolPage('career', user, { isSuperadmin: gobierna, appEl: app });
  if (!gate) return;
  // Usar la herramienta no da derecho a ver por dónde va el resto del equipo.
  if (!(gobierna || gate.manage)) {
    app.remove();
    denied?.toggleAttribute('hidden', false);
    return;
  }
  navAdmin?.toggleAttribute('hidden', false);

  try {
    const [{ store }, leaders] = await Promise.all([
      createCareerContainer({ mode: 'firestore' }),
      listLeaders(),
    ]);
    const viewAll = gobierna;
    const { persistence } = await createTeamContainer({
      mode: 'firestore',
      leaderUid: user.uid,
      viewAll,
      leaderUids: viewAll ? null : branchScopeFor(access, leaders, user.uid),
    });
    const roster = await listActivePeople(persistence);
    app.people = roster.map((p) => ({
      id: p.id,
      name: p.name,
      careerTargetLevelId: p.careerTargetLevelId ?? null,
    }));
    app.store = store;
  } catch {
    app.people = [];
  }
});
