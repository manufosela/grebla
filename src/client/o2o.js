/**
 * Glue de cliente de la herramienta O2O. Define <o2o-app>, resuelve el acceso
 * (superadmin/líder), crea el container (Firestore) e inyecta la persistencia.
 * El guard de /tools/o2o (requireAuth) ya redirige a /login sin sesión. La parte
 * del ingeniero NO vive aquí: irá en mi-espacio (fase futura).
 */
import '../components/o2o/o2o-app.js';
import { onUserChanged } from '../lib/auth.js';
import { createO2OContainer } from '../tools/o2o/composition/container.js';
import { createTeamContainer } from '../tools/team/composition/container.js';
import { resolveAccess } from '../lib/access.js';
import { proposePrep } from '../lib/o2oAi.js';
import { ROLES } from '../data/roles.js';

const app = document.querySelector('o2o-app');

/** Personas activas del líder (o de toda la org si superadmin) para el selector. */
async function loadPeople(uid, viewAll) {
  const { persistence } = await createTeamContainer({ mode: 'firestore', leaderUid: uid, viewAll });
  const people = await persistence.people.list();
  return people
    .filter((p) => p.active)
    .map((p) => ({ id: p.id, name: p.name, external: !!p.external }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

onUserChanged(async (user) => {
  if (!user || !app) return;
  try {
    const { role, uid } = await resolveAccess(user);
    if (role !== 'superadmin' && role !== 'leader') {
      app.error = 'Esta herramienta es para líderes. Tu espacio de O2O está en «Mi espacio».';
      return;
    }
    const [{ persistence }, people] = await Promise.all([
      createO2OContainer({ mode: 'firestore', leaderUid: uid }),
      loadPeople(uid, role === 'superadmin'),
    ]);
    app.canEdit = true; // líder/superadmin
    app.people = people;
    app.roles = ROLES; // para mostrar el rol Role Mirror en «Registrar O2O» (RMR-TSK-0226)
    app.aiPropose = proposePrep; // activa «Generar con IA» en «Preparar O2O»
    app.persistence = persistence;
  } catch (err) {
    app.error = err instanceof Error ? err.message : 'No se pudo inicializar el O2O.';
  }
});
