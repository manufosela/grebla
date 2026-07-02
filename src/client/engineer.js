/**
 * Glue de «Mi espacio» (página personal del ingeniero, G2). Protege la ruta en
 * cliente: solo un usuario con persona vinculada (rol engineer) la usa; cualquier
 * otro (sin sesión, superadmin/viewer/líder o sin vínculo) vuelve a la home. Pinta
 * la cabecera de identidad —nombre + título compuesto del framework— en solo
 * lectura, sin ningún control de edición. El contenido de las secciones llega en
 * G3; la protección real de datos la dan además las reglas de Firestore.
 */
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { getMyPerson } from '../lib/engineer.js';
import { getFramework } from '../lib/careerFramework.js';
import { composeTitle } from '../tools/career/data/framework.js';

const identity = document.getElementById('engineer-identity');
const errorBox = document.getElementById('engineer-error');

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
    const [person, framework] = await Promise.all([getMyPerson(user.uid), getFramework()]);
    if (!person) {
      location.replace('/');
      return;
    }
    renderIdentity(person, framework);
  } catch {
    showError('No se pudo cargar tu espacio. Vuelve a intentarlo en unos minutos.');
  }
});

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
