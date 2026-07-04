/**
 * Glue de «Mi espacio» (página personal del ingeniero, G2). Protege la ruta en
 * cliente: solo un usuario con persona vinculada (rol engineer) la usa; cualquier
 * otro (sin sesión, superadmin/viewer/líder o sin vínculo) vuelve a la home. Pinta
 * la cabecera de identidad —nombre + título compuesto del framework— en solo
 * lectura, sin ningún control de edición. El contenido de las secciones llega en
 * G3; la protección real de datos la dan además las reglas de Firestore.
 */
import '../components/engineer-space.js';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { getMyPerson, getMyRoleMirrorProfile, getMyCareerMap } from '../lib/engineer.js';
import { getFramework } from '../lib/careerFramework.js';
import { composeTitle } from '../tools/career/data/framework.js';
import { ROLES } from '../data/roles.js';

const identity = document.getElementById('engineer-identity');
const errorBox = document.getElementById('engineer-error');
const space = document.querySelector('engineer-space');

onUserChanged(async (user) => {
  if (!user) {
    location.replace('/');
    return;
  }
  try {
    const access = await resolveAccess(user);
    if (access.role !== 'engineer') {
      location.replace('/');
      return;
    }
    const person = await getMyPerson(user.uid);
    if (!person) {
      location.replace('/');
      return;
    }
    // Carga en paralelo del contenido de las tres secciones (todo solo lectura).
    const [framework, profile, career] = await Promise.all([
      getFramework(),
      getMyRoleMirrorProfile(person.id),
      getMyCareerMap(person.id),
    ]);
    renderIdentity(person, framework);
    renderSpace(person, framework, profile, career);
  } catch {
    showError('No se pudo cargar tu espacio. Vuelve a intentarlo en unos minutos.');
  }
});

/**
 * Inyecta los datos ya cargados en el componente <engineer-space>, que renderiza
 * las tres secciones (Carrera / Role Mirror / Mapa) en solo lectura.
 * @param {import('../lib/engineer.js').Person & { id: string }} person
 * @param {import('../tools/career/data/framework.js').CareerFramework} framework
 * @param {import('../lib/scoring.js').Profile|null} profile
 * @param {Awaited<ReturnType<import('../lib/engineer.js').getMyCareerMap>>} career
 * @returns {void}
 */
function renderSpace(person, framework, profile, career) {
  if (!space) return;
  space.person = person;
  space.framework = framework;
  space.profile = profile;
  space.roles = ROLES;
  space.island = career.island;
  space.journey = career.journey;
  // Ficha de ciudadanía (MC-21): índice del archipiélago y logros registrados.
  space.archipelago = career.archipelago;
  space.achievements = career.achievements;
  // Consultas al brujo (MC-22): la ficha las lista como Q&A (solo lectura).
  space.questions = career.questions;
}

/**
 * Pinta la cabecera de identidad: nombre de la persona y su título compuesto
 * (nivel + disciplinas) según el framework. Todo en solo lectura.
 * @param {import('../lib/engineer.js').Person & { id: string }} person
 * @param {import('../tools/career/data/framework.js').CareerFramework} framework
 * @returns {void}
 */
function renderIdentity(person, framework) {
  if (!identity) return;
  const nameEl = identity.querySelector('[data-name]');
  const titleEl = identity.querySelector('[data-title]');
  if (nameEl) nameEl.textContent = person.name;
  if (titleEl) {
    const title = composeTitle(framework, person.levelId, person.disciplines);
    titleEl.textContent = title;
    titleEl.hidden = !title;
  }
  identity.hidden = false;
}

/**
 * Muestra un mensaje de error sobrio sin dejar la página en blanco.
 * @param {string} message
 * @returns {void}
 */
function showError(message) {
  if (!errorBox) return;
  errorBox.textContent = message;
  errorBox.hidden = false;
}
