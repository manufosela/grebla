/**
 * Glue de la home (modelo multi-leader): con sesión y acceso (superadmin o manager)
 * muestra las tarjetas de herramientas; sin acceso, la landing pública de
 * presentación. Por defecto el HTML muestra la landing y oculta las tools.
 */
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { canGovern, hasAccess, leadsTeam } from '../lib/accessRoles.js';
import { isSurveyAdmin } from '../lib/survey.js';
import { getMyPerson, ensureEmployeePerson } from '../lib/engineer.js';
import { listToolPolicies } from '../lib/toolPolicies.js';
import { canUseTool } from '../tools/team/domain/toolAccess.js';
import { buildPersonRef } from '../lib/toolGate.js';
import { getEmployeeDomain } from '../lib/orgConfig.js';

const VIEW_FLAG = 'grebla-view';
const landing = document.getElementById('platform-landing');
const hubLoading = document.getElementById('hub-loading');
// Cortafuegos (RMR-BUG-0090): si el arranque no resuelve en 10 s (auth colgada,
// red rota), cae a la landing en vez de dejar el spinner eterno. Cualquier
// showLanding/showTools posterior sigue mandando.
setTimeout(() => {
  if (hubLoading && !hubLoading.hidden) showLanding();
}, 10_000);
const tools = document.getElementById('tenant-tools');
const backToAdmin = document.getElementById('back-to-admin');

backToAdmin?.querySelector('button')?.addEventListener('click', () => {
  sessionStorage.removeItem(VIEW_FLAG);
  location.assign('/admin');
});

onUserChanged(async (user) => {
  if (!user) return showLanding();
  try {
    const access = await resolveAccess(user);
    // Empleado del dominio de la instancia (acceso base, RMR-PCS-0027 · F6): con
    // email verificado del dominio configurado (/config/org.employeeDomain) accede
    // al hub aunque no tenga rol. Sin dominio configurado (demo) → siempre false.
    const email = (user.email ?? '').toLowerCase();
    const employeeDomain = await getEmployeeDomain();
    const isEmployee = employeeDomain !== '' && user.emailVerified === true && email.endsWith('@' + employeeDomain);
    // Gestor de encuestas (People): puede gestionar encuestas aunque no tenga otro
    // rol; debe llegar a las tools y ver la tarjeta Encuestas (RMR-TSK-0328).
    const canManageSurveys = canGovern(access) || (await isSurveyAdmin(user.uid));
    // Sin rol, sin gobierno, sin gestión de encuestas y sin ser empleado del
    // dominio: landing pública (comportamiento anterior, intacto en la demo).
    if (!hasAccess(access) && !canManageSurveys && !isEmployee) return showLanding();
    // Conmutador de vistas (RMR-TSK-0250): un manager/superadmin que ha elegido
    // «vista de ingeniero» va a su propio «Mi espacio», no a las herramientas.
    if (sessionStorage.getItem(VIEW_FLAG) === 'engineer' && (canGovern(access) || leadsTeam(access))) {
      location.replace('/mi-espacio');
      return;
    }
    // El ingeniero (persona vinculada) tiene su propio espacio personal: ni
    // landing pública ni herramientas de manager.
    if (access.functionalRole === 'engineer' && !access.instanceAccess) {
      location.replace('/mi-espacio');
      return;
    }
    // El viewer siempre entra al panel de gestión en modo solo lectura: no
    // gestiona personas propias, así que no hay "usar como manager" para él.
    // «Un viewer es viewer»: observador puro, sin faceta funcional (accessAxes
    // la anula en origen) → siempre al panel en solo lectura.
    if (access.instanceAccess === 'viewer') {
      location.replace('/admin');
      return;
    }
    // Hub filtrado por las políticas de herramientas según la PERSONA (RMR-PCS-0027):
    // el superadmin ve todas; el resto solo las que su rama/rol/personId permiten;
    // un empleado sin ficha se trata como «generico» (solo herramientas everyone).
    // Las lecturas de persona/políticas se aíslan: si fallan (transitorio), el
    // usuario YA autorizado no cae a la landing — ve el hub sin filtrar (como antes
    // de F6), y cada herramienta aplica su propio control de acceso.
    // Corroboración: un empleado del dominio sin ficha obtiene la suya ('generico')
    // en su primer login (Cloud Function, tolerante a fallos). Así queda registrado
    // para que el superadmin le asigne rol/equipo cuando toque.
    if (isEmployee) await ensureEmployeePerson();
    let person = null;
    let policies = [];
    let filterFailed = false;
    try {
      [person, policies] = await Promise.all([getMyPerson(user.uid), listToolPolicies()]);
    } catch {
      filterFailed = true;
    }
    // buildPersonRef incluye los toolOverrides: las excepciones por persona
    // cuentan también en la visibilidad de la landing (RMR-TSK-0387).
    const personRef = buildPersonRef(person);
    const isLeaderish = canGovern(access) || leadsTeam(access);
    showTools({ personRef, policies, isSuperadmin: canGovern(access), isLeaderish, canManageSurveys, filterFailed });
    if (canGovern(access)) backToAdmin?.removeAttribute('hidden');
  } catch {
    showLanding();
  }
});

function showLanding() {
  hubLoading?.setAttribute('hidden', '');
  backToAdmin?.setAttribute('hidden', '');
  tools?.setAttribute('hidden', '');
  landing?.removeAttribute('hidden');
}

function showTools({ personRef, policies = [], isSuperadmin = false, isLeaderish = false, canManageSurveys = false, filterFailed = false }) {
  hubLoading?.setAttribute('hidden', '');
  landing?.setAttribute('hidden', '');
  tools?.removeAttribute('hidden');
  const policyById = new Map(policies.map((p) => [p.toolId, p]));
  // Tarjetas de gobierno de instancia: solo superadmin.
  for (const card of tools?.querySelectorAll('[data-admin-only]') ?? []) {
    card.toggleAttribute('hidden', !isSuperadmin);
  }
  // Tarjeta de Encuestas: superadmin O gestor de encuestas (People). Marcador
  // propio para NO ensanchar el resto de tarjetas de gobierno.
  for (const card of tools?.querySelectorAll('[data-survey-tool]') ?? []) {
    card.toggleAttribute('hidden', !canManageSurveys);
  }
  // Resto de herramientas: visibles según la política de acceso de cada una
  // (RMR-PCS-0027 · F6). «team» es gestión (no tiene política): la ve quien lidera
  // o gobierna. Las demás, por canUseTool; el superadmin siempre las ve.
  for (const card of tools?.querySelectorAll('[data-tool-id]:not([data-survey-tool]):not([data-admin-only])') ?? []) {
    const id = card.dataset.toolId;
    // Fallback de disponibilidad: si no se pudieron cargar persona/políticas, no
    // se filtra (se muestran, como antes de F6); cada herramienta valida su acceso.
    if (filterFailed) { card.toggleAttribute('hidden', false); continue; }
    let visible;
    if (id === 'team') visible = isSuperadmin || isLeaderish;
    else {
      const policy = policyById.get(id);
      visible = isSuperadmin || (policy != null && canUseTool(personRef, policy));
    }
    card.toggleAttribute('hidden', !visible);
  }
}
