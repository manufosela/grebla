/**
 * Glue de cliente de Retros: define <retro-app> y le inyecta el contexto según el
 * rol. El manager (o superadmin como manager) gestiona sus retros con el roster de su
 * equipo; el ingeniero participa en las de su equipo (sin roster: los nombres de
 * owner van denormalizados en cada acción).
 */
import '../components/common/tool-nav.js';
import '../components/retro/retro-app.js';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { getMyPerson } from '../lib/engineer.js';
import { listToolPolicies } from '../lib/toolPolicies.js';
import { listOrgRoles } from '../lib/orgRoles.js';
import { watchersOf } from '../tools/retro/domain/membership.js';
import { listTeamMembers } from '../lib/retros.js';
import { listLeaders } from '../lib/leaders.js';
import { branchScopeFor, canGovern, leadsTeam, leaderChainsFrom } from '../lib/accessRoles.js';
import { guardToolPage } from '../lib/toolGate.js';

const app = document.querySelector('retro-app');

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    const access = await resolveAccess(user);
    // Gate por política de la herramienta (RMR-TSK-0387): corta ANTES de crear nada.
    const gate = await guardToolPage('retros', user, { isSuperadmin: canGovern(access), appEl: app });
    if (!gate) return;

    app.uid = user.uid;
    // Convocar una retro puede CUALQUIERA (ADR «Retros por membresía»): con el
    // listado por membresía, que mucha gente convoque no molesta a nadie —solo
    // ves las tuyas y aquellas en las que entras— y convocar una retro no es
    // cosa de un perfil técnico ni de un manager.
    app.canManage = true;
    app.leaderUid = user.uid;
    // La cadena de managers de quien convoca viaja a la retro al crearla, para
    // que su rama la vea sin invitación.
    const leaders = await listLeaders().catch(() => []);
    app.chain = leaderChainsFrom(leaders).get(user.uid) ?? [];
    if (leadsTeam(access) || canGovern(access) || gate.manage) {
      // Quien lidera un equipo trae además su roster, para poder asignar las
      // acciones de la retro a su gente. El alcance de rama (RMR-TSK-0294) sigue
      // sirviendo para eso, no para decidir qué retros ve: eso ya lo resuelve el
      // propio listado con branchUids.
      const leaderUids = branchScopeFor(access, leaders, user.uid);
      app.leaderUids = leaderUids;
      app.members = await listTeamMembers(leaderUids ?? user.uid).catch(() => []);
    } else {
      // Quien no lidera puede convocar igual; simplemente no tiene roster al que
      // asignar acciones.
      app.members = [];
    }
    // Quién más puede ver estas retros, para decirlo en pantalla POR ROL. Se
    // deriva de la política real de la herramienta, no de una lista escrita a
    // mano: decir «lo ve People» sin que sea verdad es peor que no decir nada.
    app.alsoVisibleTo = watchersOf(await listToolPolicies().catch(() => []), await listOrgRoles().catch(() => []));
  } catch (err) {
    console.error('[retros] no se pudo inicializar', err);
  }
});
