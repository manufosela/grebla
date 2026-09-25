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
});
