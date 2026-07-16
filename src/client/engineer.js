/**
 * Glue de «Mi espacio» (página personal del ingeniero, G2). Protege la ruta en
 * cliente: solo un usuario con persona vinculada (rol engineer) la usa; cualquier
 * otro (sin sesión, superadmin/viewer/manager o sin vínculo) vuelve a la home. Pinta
 * la cabecera de identidad —nombre + título compuesto del framework— en solo
 * lectura, sin ningún control de edición. El contenido de las secciones llega en
 * G3; la protección real de datos la dan además las reglas de Firestore.
 */
import '../components/engineer-space.js';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { getMyPerson, getMyRoleMirrorProfile, getMyCareerMap } from '../lib/engineer.js';
import { getMyO2O } from '../lib/o2o.js';
import { getFramework } from '../lib/careerFramework.js';
import { getOrgConfig } from '../lib/firestore.js';
import { composeTitle } from '../tools/career/data/framework.js';
import { ROLES } from '../data/roles.js';
import { ITEMS, DIMENSIONS } from '../data/items.js';

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
    const person = await getMyPerson(user.uid);
    if (!person) {
      // Conmutador de vistas (RMR-TSK-0250): un manager/superadmin sin ficha ha
      // entrado a «vista de ingeniero» para previsualizarla → aviso (no se le
      // expulsa: el conmutador de la nav le deja volver). El resto vuelve a la home.
      if (access.role === 'superadmin' || access.role === 'leader') {
        showNoFicha();
        return;
      }
      location.replace('/');
      return;
    }
    // Carga en paralelo del contenido de las secciones (de solo lectura). El
    // O2O va por Cloud Function y es NO crítico: si falla, la vista sigue con el
    // resto y «Mis O2O» queda vacío (no tumba «Mi espacio»).
    const [framework, profile, career, o2o, orgConfig] = await Promise.all([
      getFramework(),
      getMyRoleMirrorProfile(person.id),
      getMyCareerMap(person.id),
      getMyO2O().catch(() => null),
      getOrgConfig().catch(() => null),
    ]);
    renderIdentity(person, framework);
    renderSpace(person, framework, profile, career, o2o, orgConfig);
  } catch {
    showError('No se pudo cargar tu espacio. Vuelve a intentarlo en unos minutos.');
  }
});

/**
 * Inyecta los datos ya cargados en el componente <engineer-space>, que renderiza
 * las secciones. Carrera y Mapa van en solo lectura; «Mi Role Mirror» es editable
 * por el propio ingeniero (RMR-TSK-0224).
 * @param {import('../lib/engineer.js').Person & { id: string }} person
 * @param {import('../tools/career/data/framework.js').CareerFramework} framework
 * @param {import('../lib/scoring.js').Profile|null} profile
 * @param {Awaited<ReturnType<import('../lib/engineer.js').getMyCareerMap>>} career
 * @param {import('../lib/o2o.js').MyO2O|null} o2o  proyección compartida de mis O2O (o null si falló)
 * @param {import('../lib/scoring.js').OrgConfig|null} orgConfig  config de organización (para el cálculo del rol)
 * @returns {void}
 */
function renderSpace(person, framework, profile, career, o2o, orgConfig) {
  if (!space) return;
  space.person = person;
  space.framework = framework;
  space.profile = profile;
  space.roles = ROLES;
  // Role Mirror editable por el ingeniero (RMR-TSK-0224): el cuestionario necesita
  // los ítems, dimensiones y la config de organización para calcular el perfil.
  space.items = ITEMS;
  space.dimensions = DIMENSIONS;
  space.orgConfig = orgConfig;
  space.island = career.island;
  space.journey = career.journey;
  // Ficha de ciudadanía (MC-21): índice del archipiélago y logros registrados.
  space.archipelago = career.archipelago;
  space.achievements = career.achievements;
  // Avales del manager (JG-6): el contador «N avalados ✓» de la ficha.
  space.endorsements = career.endorsements;
  // Consultas al brujo (MC-22): la ficha las lista como Q&A (solo lectura).
  space.questions = career.questions;
  // Mis O2O (F4): resúmenes compartidos + mis acciones (proyección de getMyO2O).
  space.o2o = o2o;
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

/**
 * Aviso para un manager/superadmin que entra a «vista de ingeniero» sin ficha
 * de persona propia (RMR-TSK-0250): no hay carrera/mapa que mostrar, pero se le
 * explica que es la vista que verá un ingeniero y que vuelva con el conmutador.
 * Oculta el contenido de <engineer-space> (que quedaría vacío).
 * @returns {void}
 */
function showNoFicha() {
  space?.setAttribute('hidden', '');
  const header = document.querySelector('.me-header');
  if (!header || document.getElementById('no-ficha-notice')) return;
  // Estilos inline (tokens --rm-*): el nodo se crea en JS, sin el atributo de
  // scope de Astro, así que las clases scoped de la página no le aplicarían.
  const box = document.createElement('div');
  box.id = 'no-ficha-notice';
  Object.assign(box.style, {
    marginTop: '0.5rem', padding: '1.1rem 1.35rem', background: 'var(--rm-surface)',
    border: '1px solid var(--rm-border)', borderLeft: '4px solid var(--rm-accent)',
    borderRadius: 'var(--rm-radius, 14px)',
  });
  const title = document.createElement('p');
  Object.assign(title.style, { margin: '0', fontSize: '1.1rem', fontWeight: '700', color: 'var(--rm-text)' });
  title.textContent = '👷 Vista de ingeniero';
  const body = document.createElement('p');
  Object.assign(body.style, { margin: '0.5rem 0 0', color: 'var(--rm-muted)', maxWidth: '62ch' });
  body.textContent =
    'Esta es la vista que ve una persona de tu equipo en su «Mi espacio». Como tu cuenta '
    + 'no tiene ficha de persona propia, no hay datos personales que mostrar aquí. Un ingeniero '
    + 'con ficha vería, con sus propios datos:';
  const list = document.createElement('ul');
  Object.assign(list.style, { margin: '0.6rem 0 0', paddingLeft: '1.2rem', color: 'var(--rm-muted)', maxWidth: '62ch' });
  for (const item of [
    'Carrera — su nivel y disciplinas según el framework',
    'Mi Role Mirror — su autodiagnóstico de perfil (lo edita él)',
    'Mapa de carrera — su ruta de crecimiento gamificada',
    'Mis O2O — resúmenes y acciones de sus one-to-ones',
    'Marea — su pulso afectivo semanal (privado)',
    'Retros — participa en las retrospectivas de su equipo',
  ]) {
    const li = document.createElement('li');
    li.textContent = item;
    li.style.margin = '0.15rem 0';
    list.appendChild(li);
  }
  const hint = document.createElement('p');
  Object.assign(hint.style, { margin: '0.7rem 0 0', color: 'var(--rm-muted)', fontSize: '0.9rem' });
  hint.textContent = 'Vuelve a tu vista habitual con el conmutador de arriba a la derecha.';
  box.append(title, body, list, hint);
  header.appendChild(box);
}
