/**
 * GATE de página de las herramientas (RMR-TSK-0387, épica RMR-PCS-0027 · F3):
 * aplica la política de acceso (/toolPolicies) también al navegar DIRECTO por
 * URL — hasta ahora solo se ocultaban los iconos de la landing y cualquiera con
 * la URL entraba igual.
 *
 * Cada entry de cliente llama a `guardToolPage(toolId, user, {isSuperadmin,
 * appEl})` tras resolver el acceso y ANTES de crear stores/persistencia: si la
 * política deniega, el nodo raíz del tool se sustituye por una pantalla de
 * «sin acceso» y el entry corta (no se monta nada ni se cargan datos).
 *
 * Política de fallos (paridad con la landing, RMR-PCS-0027 · F6):
 *  - superadmin siempre pasa;
 *  - /toolPolicies VACÍO (instancia sin sembrar, pre-F3) → fail-open;
 *  - políticas presentes pero falta la de este tool → DENIEGA (como la landing);
 *  - error de carga (red) → fail-open con console.error — cada herramienta
 *    conserva su validación interna, no se brickea la app por un fallo puntual.
 */
import { getMyPerson } from './engineer.js';
import { listToolPolicies } from './toolPolicies.js';
import { canUseTool, canManageTool } from '../tools/team/domain/toolAccess.js';
import { TOOL_LABELS } from '../tools/team/data/tools.js';

/**
 * PersonRef para evaluar acceso a partir de la ficha (o su ausencia). Incluye
 * los toolOverrides — las excepciones por persona cuentan también en el gate.
 * @param {{ id?: string, orgBranch?: string, orgRole?: string|null, toolOverrides?: Record<string, unknown> }|null} person
 * @returns {import('../tools/team/domain/toolAccess.js').PersonRef}
 */
export function buildPersonRef(person) {
  if (!person) return { personId: null, branch: 'generico', roleId: null, toolOverrides: {} };
  return {
    personId: person.id ?? null,
    branch: person.orgBranch ?? 'generico',
    roleId: person.orgRole ?? null,
    toolOverrides: person.toolOverrides ?? {},
  };
}

/** Pantalla estándar de «sin acceso» (nodos DOM, sin innerHTML). */
function buildNoAccessSection(toolId) {
  const section = document.createElement('section');
  section.style.cssText = 'max-width:34rem;margin:4rem auto;padding:2rem;text-align:center;';
  const icon = document.createElement('p');
  icon.textContent = '🔒';
  icon.style.cssText = 'font-size:2.4rem;margin:0 0 0.6rem;';
  const title = document.createElement('h2');
  title.textContent = 'No tienes acceso a esta herramienta';
  title.style.cssText = 'margin:0 0 0.6rem;';
  const label = TOOL_LABELS[toolId];
  const body = document.createElement('p');
  body.textContent = `El acceso a ${label ? `«${label}»` : 'esta herramienta'} lo gestiona tu organización. Si crees que deberías tenerlo, pídeselo a un superadmin.`;
  body.style.cssText = 'color:var(--rm-muted, #5b6b7d);margin:0 0 1.4rem;line-height:1.5;';
  const back = document.createElement('a');
  back.href = '/';
  back.textContent = '← Volver al inicio';
  back.style.cssText = 'color:var(--rm-accent,#2a9d8f);font-weight:600;text-decoration:none;';
  section.append(icon, title, body, back);
  return section;
}

/**
 * ¿Puede esta persona usar la herramienta? Si NO, sustituye `appEl` por la
 * pantalla de sin-acceso y devuelve false. Si SÍ, devuelve `{ manage }` — el
 * grant managedBy de la política (RMR-TSK-0388), para que el entry COMPONGA sus
 * controles de administración con los roles legacy (las reglas lo respaldan vía
 * el espejo /toolManagers, RMR-TSK-0389). El objeto es truthy: los entries que
 * solo comprueban `if (!gate)` siguen funcionando igual.
 * @param {string} toolId
 * @param {{ uid: string }|null} user
 * @param {{ isSuperadmin?: boolean, appEl?: Element|null }} [opts]
 * @returns {Promise<false | { manage: boolean }>}
 */
export async function guardToolPage(toolId, user, { isSuperadmin = false, appEl = null } = {}) {
  if (isSuperadmin) return { manage: true };
  let allowed = true;
  let manage = false;
  try {
    const [person, policies] = await Promise.all([getMyPerson(user?.uid), listToolPolicies()]);
    if (policies.length > 0) {
      const policy = policies.find((p) => p.toolId === toolId) ?? null;
      const ref = buildPersonRef(person);
      allowed = policy != null && canUseTool(ref, policy);
      manage = policy != null && canManageTool(ref, policy);
    }
  } catch (err) {
    console.error(`[toolGate] no se pudo evaluar el acceso a «${toolId}» — se permite el paso:`, err);
    return { manage: false };
  }
  if (!allowed) {
    if (appEl) appEl.replaceWith(buildNoAccessSection(toolId));
    return false;
  }
  return { manage };
}
