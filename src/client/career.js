/**
 * Glue de cliente del Mapa de Carrera. Define <career-app>, resuelve el acceso de
 * la instancia y construye el container según el rol:
 *  - manager/superadmin: carga las personas de su equipo (igual que Role Mirror) y
 *    juega/gestiona con el selector de persona (canEdit).
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

const app = document.querySelector('career-app');

onUserChanged(async (user) => {
  if (!app) return;
  if (!user) {
    app.people = [];
    app.personId = null;
    return;
  }
  try {
    const { role } = await resolveAccess(user);
    if (!role) {
      app.error = 'No tienes acceso. Pide a un superadmin que te dé de alta como manager.';
      return;
    }
    const { store } = await createCareerContainer({ mode: 'firestore' });
    // El login firma la autoría (brujo, carpools) en TODOS los roles.
    app.currentUser = { uid: user.uid, name: user.displayName ?? user.email ?? 'Usuario' };
    if (role === 'engineer') {
      // El ingeniero juega SU plan (JG-1): sin container de equipo (no puede
      // listar people), su persona vinculada fijada y sin gestión de equipo.
      const person = await getMyPerson(user.uid);
      if (!person) {
        app.error = 'No se encontró tu persona vinculada. Habla con tu manager.';
        return;
      }
      // El objetivo de carrera declarado viaja con la persona: el catálogo de
      // retos (JG-14) sugiere con él la ruta de su hito.
      app.people = [{
        id: person.id,
        name: person.name,
        uid: person.uid ?? null,
        careerTargetLevelId: person.careerTargetLevelId ?? null,
      }];
      app.canPlay = true;
      app.canEdit = false;
      app.personId = person.id;
      app.store = store;
      return;
    }
    // Personas del equipo del manager (reusa la tool Equipo), como en Role Mirror.
    const { persistence } = await createTeamContainer({ mode: 'firestore', leaderUid: user.uid });
    const people = await listActivePeople(persistence);
    // El uid vinculado viaja con la persona: el panel del brujo (MC-22) decide
    // con él si el usuario logado es el jugador vinculado. El objetivo de
    // carrera alimenta la ruta sugerida del catálogo de retos (JG-14).
    app.people = people.map((p) => ({
      id: p.id,
      name: p.name,
      uid: p.uid ?? null,
      careerTargetLevelId: p.careerTargetLevelId ?? null,
      external: p.external ?? false, // los externos no tienen carrera: el selector los deshabilita
    }));
    // Rol para el brujo (MC-22) y la gestión de equipo: canEdit habilita la
    // cola del manager, el tiempo agregado y el selector de persona.
    app.canEdit = role === 'leader' || role === 'superadmin';
    app.store = store;
  } catch (err) {
    app.error = err instanceof Error ? err.message : 'No se pudo inicializar el mapa de carrera.';
  }
});
