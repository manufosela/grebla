/**
 * Glue de cliente de la herramienta O2O. Define <o2o-app>, resuelve el acceso
 * (superadmin/manager), crea el container (Firestore) e inyecta la persistencia.
 * El guard de /tools/o2o (requireAuth) ya redirige a /login sin sesión. La parte
 * del ingeniero NO vive aquí: irá en mi-espacio (fase futura).
 */
import '../components/o2o/o2o-app.js';
import { onUserChanged } from '../lib/auth.js';
import { createO2OContainer } from '../tools/o2o/composition/container.js';
import { listMyO2OPeople } from '../lib/o2oManagers.js';import { resolveAccess } from '../lib/access.js';
import { canGovern, leadsTeam } from '../lib/accessRoles.js';
import { proposePrep } from '../lib/o2oAi.js';
import { guardToolPage } from '../lib/toolGate.js';
import { isAdminOnly } from '../tools/o2o/domain/views.js';
import { ROLES } from '../data/roles.js';

const app = document.querySelector('o2o-app');

/**
 * Personas activas a las que estás asignado como manager de O2O (RMR-TSK-0655).
 * Gobernar la instancia no hace que tu equipo sea toda la organización
 * (RMR-TSK-0647), y ser dueño de una ficha tampoco: la lista la fija el superadmin.
 */
function forSelector(people) {
  return people
    .filter((p) => p.active)
    // `levelId` viaja con la persona para el contexto de carrera del registro
    // (RMR-PCS-0044 · F4): sin él no hay contra qué nivel medir el avance.
    // uid y rama, para separar directos del resto en «Para quién» (RMR-TSK-0664).
    .map((p) => ({
      id: p.id, name: p.name, external: !!p.external, levelId: p.levelId ?? null,
      uid: p.uid ?? null, directoryManagerUids: p.directoryManagerUids ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    const access = await resolveAccess(user);
    // Gate por política de la herramienta (RMR-TSK-0387): corta ANTES de crear nada.
    const gate = await guardToolPage('o2o', user, { isSuperadmin: canGovern(access), appEl: app });
    if (!gate) return;

    const { uid } = access;
    const mine = await listMyO2OPeople(uid);
    // Tres papeles distintos (RMR-TSK-0497): quien gobierna y quien lleva equipo
    // USAN la herramienta; quien solo la gestiona entra a cambiar las preguntas.
    // Llevar gente asignada para O2O también es llevar equipo (RMR-TSK-0655).
    const quien = { governs: canGovern(access), leads: leadsTeam(access) || mine.length > 0, managesTool: gate.manage };
    if (!quien.governs && !quien.leads && !quien.managesTool) {
      app.error = 'Esta herramienta es para managers. Tu espacio de O2O está en «Mi espacio».';
      return;
    }
    app.access = quien;
    const soloAdmin = isAdminOnly(quien);
    // En modo administración no se cargan personas: lo que se habló en un O2O es
    // de dos, y aquí solo se vienen a cambiar las preguntas. Lo que no se pide,
    // no llega al navegador.
    const { persistence } = await createO2OContainer({ mode: 'firestore', leaderUid: uid });
    const people = soloAdmin ? [] : forSelector(mine);
    app.myUid = uid;
    app.canEdit = true;
    app.people = people;
    app.roles = ROLES; // para mostrar el rol Role Mirror en «Registrar O2O» (RMR-TSK-0226)
    app.aiPropose = proposePrep; // activa «Generar con IA» en «Preparar O2O»
    app.persistence = persistence;
  } catch (err) {
    app.error = err instanceof Error ? err.message : 'No se pudo inicializar el O2O.';
  }
});
