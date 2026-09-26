/**
 * Glue de la home (modelo multi-leader): con sesión y acceso (superadmin o manager)
 * muestra las tarjetas de herramientas; sin acceso, la landing pública de
 * presentación. Por defecto el HTML muestra la landing y oculta las tools.
 */
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { canGovern, hubAsView, leadsTeam } from '../lib/accessRoles.js';
import { isSurveyAdmin } from '../lib/survey.js';
import { getMyPerson, ensureEmployeePerson } from '../lib/engineer.js';
import { listToolPolicies } from '../lib/toolPolicies.js';
import { canUseTool, canManageTool } from '../tools/team/domain/toolAccess.js';
import { applyCardOrder } from '../lib/cardOrder.js';
import { buildPersonRef } from '../lib/toolGate.js';
import { getEmployeeDomain } from '../lib/orgConfig.js';
import { groupsWithCards } from '../lib/hubGroups.js';
import { isEmployeeOf, hubDestination, needsEmployeePerson, managesSomeTool } from './hubBoot.js';

const VIEW_FLAG = 'grebla-view';
/** Pestaña que se estaba mirando, mientras dure la sesión. */
/** ¿Se está previsualizando el hub como otro rol? */
const esSimulada = () => ['leader', 'engineer', 'empleado'].includes(sessionStorage.getItem(VIEW_FLAG));
const landing = document.getElementById('platform-landing');
const hubLoading = document.getElementById('hub-loading');
// Cortafuegos (RMR-BUG-0090): si el arranque no resuelve en 10 s (auth colgada,
// red rota), cae a la landing en vez de dejar el spinner eterno. Cualquier
// showLanding/showTools posterior sigue mandando.
setTimeout(() => {
  if (hubLoading && !hubLoading.hidden) showLanding();
}, 10_000);
const tools = document.getElementById('tenant-tools');
const hubBar = document.getElementById('hub-bar');
const toolsEmpty = document.getElementById('tools-empty');
const adminLink = document.getElementById('admin-link');
// La administración se abre en VENTANA APARTE, así que la vista de esta ventana
// NO se toca: no has cambiado de vista, has abierto otra cosa. Antes era una
// tarjeta que navegaba aquí mismo y había que anotar la vista «admin» para que
// al volver el conmutador no marcara «Manager» (RMR-BUG-0104); con `noopener` la
// ventana nueva arranca sin flag, y sin flag el hub se pinta con tu rol real.

onUserChanged(async (user) => {
  if (!user) return showLanding();
  try {
    // Las cinco lecturas, en paralelo (RMR-BUG-0112). Antes eran cuatro esperas encadenadas
    // y ninguna dependía de la anterior: se encadenaban solo porque cada
    // decisión se tomaba con el dato recién llegado. Con allSettled, un fallo
    // transitorio de una lectura no tumba a quien YA está autorizado: el hub se
    // pinta sin filtrar —como antes de las políticas— y cada herramienta sigue
    // aplicando su propio control.
    const [accessRes, domainRes, surveyRes, personRes, policiesRes] = await Promise.allSettled([
      resolveAccess(user),
      getEmployeeDomain(),
      isSurveyAdmin(user.uid),
      getMyPerson(user.uid),
      listToolPolicies(),
    ]);
    if (accessRes.status !== 'fulfilled') return showLanding({ signedIn: true });
    const access = accessRes.value;

    const employeeDomain = domainRes.status === 'fulfilled' ? domainRes.value : '';
    const isEmployee = isEmployeeOf(user.email ?? '', user.emailVerified, employeeDomain);
    // Quien gestiona ALGUNA herramienta llega al hub aunque no tenga otro rol:
    // si no entrara, no podría llegar a lo suyo (RMR-TSK-0475). Antes esto era
    // un caso especial de encuestas, heredado de cuando People era un rol
    // suelto; ahora vale para todas.
    //
    // `isSurveyAdmin` cubre además la colección /surveyAdmins, que sigue viva
    // mientras dure la migración —hay cuentas que solo están ahí— exactamente
    // igual que en las reglas de Firestore. Es lo único que queda del rol viejo.
    const managesAnyTool = canGovern(access)
      || (surveyRes.status === 'fulfilled' && surveyRes.value === true)
      || managesSomeTool(
        buildPersonRef(personRes.status === 'fulfilled' ? personRes.value : null),
        policiesRes.status === 'fulfilled' ? policiesRes.value : [],
        canManageTool,
      );

    const destino = hubDestination({ access, isEmployee, managesAnyTool });
    if (destino === 'landing') return showLanding({ signedIn: true });
    // El viewer va DIRECTO a la organización, no al hub de administración: es
    // observador puro y ahí no administra herramientas, así que el hub le
    // saldría vacío (RMR-TSK-0495).
    if (destino === 'admin') { location.replace('/admin/organizacion'); return; }

    let person = personRes.status === 'fulfilled' ? personRes.value : null;
    const filterFailed = personRes.status !== 'fulfilled' || policiesRes.status !== 'fulfilled';
    const policies = policiesRes.status === 'fulfilled' ? policiesRes.value : [];

    // La Cloud Function que crea la ficha del empleado solo se llama si de
    // verdad falta. Antes se esperaba en cada entrada, aunque la ficha llevara
    // meses creada, y con la función fría son segundos de pantalla en blanco.
    if (needsEmployeePerson({ isEmployee, person })) {
      try {
        await ensureEmployeePerson();
        person = await getMyPerson(user.uid);
      } catch {
        // Que no se pueda sellar la ficha no deja a nadie fuera: entra como
        // genérico y el superadmin lo verá en las cuentas sin ficha.
      }
    }

    // Vista elegida en el conmutador: cambia QUÉ se ve, nunca a dónde se va ni
    // qué se puede. Los permisos reales no se tocan y cada herramienta valida.
    const vista = hubAsView(sessionStorage.getItem(VIEW_FLAG), {
      isSuperadmin: canGovern(access),
      isLeaderish: canGovern(access) || leadsTeam(access),
    });
    await showTools({
      personRef: vista.generic ? buildPersonRef(null) : buildPersonRef(person),
      policies,
      isSuperadmin: vista.isSuperadmin,
      isLeaderish: vista.isLeaderish,
      filterFailed,
    });
  } catch {
    showLanding({ signedIn: true });
  }
});

/**
 * Portada sin herramientas. Con `signedIn`, la persona ha entrado pero esta
 * instancia no la reconoce (RMR-TSK-0519): se le dice, en vez de enseñarle la
 * misma portada muda que a quien no ha iniciado sesión.
 */
function showLanding({ signedIn = false } = {}) {
  hubLoading?.setAttribute('hidden', '');
  tools?.setAttribute('hidden', '');
  hubBar?.setAttribute('hidden', '');
  landing?.removeAttribute('hidden');
  const anon = document.getElementById('landing-anon');
  const noAccess = document.getElementById('landing-no-access');
  if (signedIn) { anon?.setAttribute('hidden', ''); noAccess?.removeAttribute('hidden'); }
  else { noAccess?.setAttribute('hidden', ''); anon?.removeAttribute('hidden'); }
}

/**
 * Enseña los grupos que TIENEN alguna tarjeta visible, a partir de lo que ha
 * quedado tras aplicar políticas, ficha y vista simulada — nunca calculándolos
 * aparte desde el rol: dos fuentes de verdad acabarían pintando un encabezado
 * sin nada debajo, o uno que aparece al simular un rol que no lo tiene.
 */
function showGroups({ canAdmin }) {
  const conTarjetas = [...(tools?.querySelectorAll('.tool-card:not([hidden])') ?? [])]
    .map((card) => card.closest('.tool-group')?.dataset.group)
    .filter(Boolean);
  const visibles = new Set(groupsWithCards(conTarjetas).map((g) => g.id));

  for (const grupo of tools?.querySelectorAll('.tool-group') ?? []) {
    grupo.toggleAttribute('hidden', !visibles.has(grupo.dataset.group));
  }
  // Sin ningun grupo, se dice. Un contenedor vacio no es una respuesta: deja la
  // pagina sin nada donde mirar y sin saber si falta algo o falla algo.
  toolsEmpty?.toggleAttribute('hidden', visibles.size > 0);
  adminLink?.toggleAttribute('hidden', !canAdmin);
  // La barra entera se oculta sin enlace: una franja vacía solo añade ruido.
  hubBar?.toggleAttribute('hidden', !canAdmin);
}

async function showTools({ personRef, policies = [], isSuperadmin = false, isLeaderish = false, filterFailed = false }) {
  landing?.setAttribute('hidden', '');
  const policyById = new Map(policies.map((p) => [p.toolId, p]));
  // Lo personal (RMR-TSK-0459): se ve siempre que haya ficha, sin pasar por la
  // política de audiencia. La política gobierna la herramienta de equipo —llevar
  // los O2O de tu gente—, no el derecho a mirar tus propios datos. Sin ficha no
  // hay nada que enseñar, así que se oculta.
  for (const card of tools?.querySelectorAll('[data-personal]') ?? []) {
    card.toggleAttribute('hidden', !personRef?.personId);
  }
  // Resto de herramientas: visibles según la política de acceso de cada una
  // (RMR-PCS-0027 · F6). «team» es gestión (no tiene política): la ve quien lidera
  // o gobierna. Las demás, por canUseTool; el superadmin siempre las ve.
  for (const card of tools?.querySelectorAll('[data-tool-id]') ?? []) {
    // Las personales ya quedaron decididas arriba, por ficha: «Mis O2O» es tuyo
    // y no lo gobierna la política de la herramienta de equipo. Se salta aquí,
    // y no con un selector lejano, para que se vea al leer la decisión.
    if (card.dataset.personal === 'true') continue;
    const id = card.dataset.toolId;
    // Fallback de disponibilidad: si no se pudieron cargar persona/políticas, no
    // se filtra (se muestran, como antes de F6); cada herramienta valida su acceso.
    if (filterFailed) { card.toggleAttribute('hidden', false); continue; }
    const policy = policyById.get(id);
    const permitido = isSuperadmin || (policy != null && canUseTool(personRef, policy));
    let visible;
    // «team» es gestión pura y no tiene política: se rige por el rol.
    if (id === 'team') visible = isSuperadmin || isLeaderish;
    // Las de GESTIÓN de equipo piden además liderar: quien no lidera no tiene a
    // quién gestionar, y ofrecérselas es mandarlo a una puerta que le rechaza.
    else if (card.dataset.manages === 'true') visible = permitido && (isSuperadmin || isLeaderish);
    else visible = permitido;
    card.toggleAttribute('hidden', !visible);
  }
  // Los grupos van DESPUÉS del filtrado: se derivan de lo que ha quedado visible.
  showGroups({ canAdmin: isSuperadmin });
  // Y el orden que decidió el superadmin (RMR-TSK-0571) ANTES de enseñar nada:
  // colocar las tarjetas con el hub ya a la vista las haría saltar delante de
  // quien mira. No cambia quién ve qué, solo en qué posición; si la lectura
  // falla, queda el orden del código.
  // Dentro de CADA grupo: el orden manda entre las tarjetas de un grupo, no
  // entre grupos. Ordenar sobre el contenedor de todos las sacaria del suyo.
  await applyCardOrder(
    tools?.querySelectorAll('.tool-group .tools') ?? [],
    'home', '.tool-card[href]', (el) => el.getAttribute('href'),
  );
  hubLoading?.setAttribute('hidden', '');
  tools?.removeAttribute('hidden');
}
