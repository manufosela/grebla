/**
 * Glue de cliente del Mapa de Carrera. Define <career-app>, resuelve el acceso de
 * la instancia y construye el container según el rol:
 *  - manager/supermanager/superadmin: carga las personas de su alcance (igual que
 *    Role Mirror — su equipo, su rama o toda la organización) y juega/gestiona
 *    con el selector de persona (canEdit).
 *  - engineer (JG-1, RMR-TSK-0139): EL INGENIERO JUEGA su propio plan. No puede
 *    listar el equipo (las reglas no se lo permiten): se carga SOLO su persona
 *    vinculada (getMyPerson), con personId fijado, canPlay = true y canEdit =
 *    false (nada de cola del brujo ni tiempo del equipo).
 *  - viewer: como hoy (solo lectura; sin personas propias no hay journey que tocar).
 */
import '../components/career/career-app.js';
import { onUserChanged } from '../lib/auth.js';
import { createCareerContainer } from '../tools/career/composition/container.js';
import { resolveAccess } from '../lib/access.js';
import { getMyPerson } from '../lib/engineer.js';
import { createTeamContainer } from '../tools/team/composition/container.js';
import { listActivePeople } from '../tools/team/application/usecases/index.js';
import { listLeaders } from '../lib/leaders.js';
import { branchScopeFor, canGovern } from '../lib/accessRoles.js';
import { guardToolPage } from '../lib/toolGate.js';

const app = document.querySelector('career-app');

onUserChanged(async (user) => {
  if (!app) return;
  if (!user) {
    app.people = [];
    app.personId = null;
    return;
  }
  try {
    // Acceso en dos ejes (RMR-PCS-0024): `role` (derivado) distingue "es SOLO
    // ingeniero" para el branch de jugar su plan; el gobierno (canGovern) da el
    // "ver todo"; la rama sale del rol funcional.
    const access = await resolveAccess(user);
    // Gate por política de la herramienta (RMR-TSK-0387): corta ANTES de crear nada.
    if (!(await guardToolPage('career', user, { isSuperadmin: canGovern(access), appEl: app }))) return;

    const { role } = access;
    if (!role) {
      app.error = 'No tienes acceso. Pide a un superadmin que te dé de alta como manager.';
      return;
    }
    const { store } = await createCareerContainer({ mode: 'firestore' });
    // El login firma la autoría (brujo, carpools) en TODOS los roles.
    app.currentUser = { uid: user.uid, name: user.displayName ?? user.email ?? 'Usuario' };
    // RMR-PCS-0029 · F2a: TODOS juegan SU PROPIA ficha. No hay selector de
    // «jugar como otro» ni impersonación (ni superadmin). Se resuelve la persona
    // vinculada al login (getMyPerson) para cualquier rol.
    const ownPerson = await getMyPerson(user.uid);
    if (!ownPerson) {
      app.error = role === 'engineer'
        ? 'No se encontró tu persona vinculada. Habla con tu manager.'
        : 'No tienes una ficha propia para jugar tu carrera. Pide que te vinculen una; el progreso de tu equipo está en la herramienta Equipo.';
      return;
    }
    // Su persona fijada: es la ÚNICA que juega (con una sola persona y canPlay el
    // selector ni se pinta). El objetivo de carrera viaja con la persona (JG-14).
    app.people = [{
      id: ownPerson.id,
      name: ownPerson.name,
      uid: ownPerson.uid ?? null,
      careerTargetLevelId: ownPerson.careerTargetLevelId ?? null,
    }];
    app.canPlay = true;
    app.personId = ownPerson.id;
    // Gestión (líder/supermanager/superadmin): además del juego personal, carga
    // el ROSTER de su equipo para la cola del brujo (MC-22) y el tiempo agregado
    // (MC-23) — overlays de manager, SIN selector. Alcance (RMR-TSK-0293): admin
    // → toda la organización; supermanager → su rama de líderes; líder → la suya.
    const isManager = role === 'leader' || role === 'supermanager' || canGovern(access);
    if (isManager) {
      app.canEdit = true;
      // Rama transitiva (RMR-TSK-0421): todo líder con managers debajo ve el
      // roster de su subárbol, no solo el supermanager.
      const leaderUids = branchScopeFor(access, await listLeaders(), user.uid);
      const { persistence } = await createTeamContainer({
        mode: 'firestore',
        leaderUid: user.uid,
        viewAll: canGovern(access),
        leaderUids,
      });
      const roster = await listActivePeople(persistence);
      app.teamRoster = roster.map((p) => ({ id: p.id, name: p.name, uid: p.uid ?? null }));
    } else {
      app.canEdit = false;
    }
    app.store = store;
  } catch (err) {
    app.error = err instanceof Error ? err.message : 'No se pudo inicializar el mapa de carrera.';
  }
});
