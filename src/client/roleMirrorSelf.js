/**
 * Glue de la PUERTA de Role Mirror: lo tuyo (RMR-TSK-0562).
 *
 * Quien entra en la herramienta ve su propio perfil, sea ingeniero, manager o
 * superadmin: gobernar añade una puerta —el enlace a la administración—, no
 * cambia lo que la herramienta es. Antes, quien gestionaba aterrizaba en un
 * selector de personas de su equipo y no tenía forma de ver lo suyo sin irse a
 * «Mi espacio».
 *
 * Se afina en modo PROPUESTA, igual que en Mi espacio: la versión que cuenta la
 * fija el manager, y aquí se le manda qué cambiarías. Es el mismo trato para
 * todos, incluido quien administra.
 */
import '../components/role-questionnaire.js';
import { ITEMS, DIMENSIONS } from '../data/items.js';
import { ROLES } from '../data/roles.js';
import { onUserChanged } from '../lib/auth.js';
import { getOrgConfig } from '../lib/firestore.js';
import { getMyPerson } from '../lib/engineer.js';
import { getFramework } from '../lib/careerFramework.js';
import { getPersonSubLevel } from '../lib/careerAssessment.js';
import { subLevelDetail } from '../tools/career/domain/levelProgress.js';
import { resolveAccess } from '../lib/access.js';
import { canGovern } from '../lib/accessRoles.js';
import { guardToolPage } from '../lib/toolGate.js';

const questionnaire = document.querySelector('role-questionnaire');
const vacio = document.querySelector('#rm-self-empty');
const adminLink = document.querySelector('#rm-nav-admin');

if (questionnaire) {
  questionnaire.items = ITEMS;
  questionnaire.roles = ROLES;
  questionnaire.dimensions = DIMENSIONS;
  // Tus ajustes viajan como propuesta a tu manager, como en Mi espacio.
  questionnaire.proposalMode = true;
}

onUserChanged(async (user) => {
  if (!user || !questionnaire) return;
  let gobierna = false;
  try { gobierna = canGovern(await resolveAccess(user)); } catch { /* sin gobierno */ }
  const gate = await guardToolPage('rolemirror', user, { isSuperadmin: gobierna, appEl: questionnaire });
  if (!gate) return;
  // La puerta de la administración solo se desvela a quien la gestiona.
  adminLink?.toggleAttribute('hidden', !(gobierna || gate.manage));

  try {
    questionnaire.orgConfig = await getOrgConfig();
  } catch {
    questionnaire.orgConfig = null;
  }

  const person = await getMyPerson(user.uid).catch(() => null);
  // Sin ficha no hay perfil que rellenar, y un cuestionario que no guarda en
  // ningún sitio es peor que decirlo.
  vacio?.toggleAttribute('hidden', Boolean(person?.id));
  questionnaire.toggleAttribute('hidden', !person?.id);
  if (!person?.id) return;

  questionnaire.editorKind = 'engineer';
  questionnaire.editorUid = person.uid ?? user.uid ?? '';
  questionnaire.editorName = person.name ?? user.displayName ?? '';
  questionnaire.personId = person.id;

  mostrarNivel(person);
});

/**
 * Nivel de carrera con su sub-nivel efectivo (RMR-TSK-0605). Quien mira su Role
 * Mirror quiere saber también dónde está en la escalera: tener que irse a otra
 * pantalla a por el dato es justo lo que se evita.
 *
 * El número sale de `getPersonSubLevel`, el MISMO que lee el Seguimiento del
 * plan y la tabla de Personas. Calcularlo aquí por nuestra cuenta acabaría
 * dando otro, y la persona vería un sub-nivel distinto del que ve su manager.
 *
 * Se pinta con `textContent`, nunca con HTML: la nota del ajuste manual la
 * escribe su manager y no hay razón para dejar que llegue como marcado.
 *
 * Sin nivel o sin valoración no se inventa badge: el bloque se queda oculto,
 * igual que hace el resto de la aplicación.
 * @param {{ id: string, levelId?: string|null }} person
 */
async function mostrarNivel(person) {
  const bloque = document.querySelector('#rm-level');
  const badge = document.querySelector('#rm-level-badge');
  const texto = document.querySelector('#rm-level-text');
  if (!bloque || !badge || !texto) return;
  try {
    const subLevel = await getPersonSubLevel(person, await getFramework());
    if (!subLevel) return;
    badge.textContent = subLevel.label;
    // La etiqueta va en el badge; su detalle, al lado.
    texto.textContent = subLevelDetail(subLevel) ?? '';
    bloque.removeAttribute('hidden');
  } catch {
    /* Sin framework o sin valoración legible, no hay badge — ni un hueco raro. */
  }
}
