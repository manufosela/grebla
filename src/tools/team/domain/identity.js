/**
 * Resolvedor de identidad organizativa PERSONA-CÉNTRICO (ADR «Identidad
 * persona-céntrica»). RMR-PCS-0027 · F1.
 *
 * PRINCIPIO: la organización de una persona (su rol y a quién reporta) se lee de
 * su FICHA por `personId` (la clave inmutable que genera la BBDD), NO de su `uid`
 * de login. Una persona es manager porque su ficha lo dice (`orgRole`), no porque
 * exista `/leaders/{uid}`. Así la jerarquía existe y es coherente aunque nadie se
 * haya logado; el login solo corrobora (vincula el uid), nunca crea jerarquía.
 *
 * `name`/`alias`/`email`/`uid` son ATRIBUTOS mutables: jamás se usan como clave.
 * El superior se referencia por `reportsToPersonId` (personId), nunca por nombre.
 *
 * TRANSICIÓN: mientras se migran los datos (F2), las fichas antiguas aún no traen
 * `orgRole`/`reportsToPersonId`. Para no romper, el resolvedor cae al modelo
 * anterior (rol por uid→/leaders, superior por ownerLeaderUid/reportsTo) y traduce
 * ese uid a personId. Cuando todas las fichas están migradas, el fallback deja de
 * dispararse y `/leaders` pasa a ser solo espejo de permiso.
 *
 * Módulo puro (sin Firestore ni Lit): se prueba aislado.
 *
 * @typedef {'engineer'|'manager'|'head'} OrgRole
 * @typedef {import('./superior.js').LeaderLike} LeaderLike
 * @typedef {import('./superior.js').HeadLike} HeadLike
 * @typedef {{ id: string, uid?: string|null, orgRole?: OrgRole|null,
 *   reportsToPersonId?: string|null, ownerLeaderUid?: string|null }} PersonLike
 *
 * @typedef {Object} PersonIdentity
 * @property {string} personId                        clave inmutable de la persona
 * @property {OrgRole} orgRole                         rol organizativo
 * @property {'manager'|'head'|'none'} superiorKind    qué tipo de superior aplica
 * @property {string|null} superiorPersonId            personId del superior (canónico), o null
 * @property {string|null} superiorUidLegacy           uid del superior según el modelo antiguo (solo durante la transición)
 * @property {string} emptyLabel                       texto cuando no hay superior
 * @property {boolean} canTransfer                     si el nivel admite transferencia hoy
 */
import { personRole } from './superior.js';

/**
 * Rol organizativo de una persona. Prioriza el campo explícito de la ficha
 * (`orgRole`); si falta (dato pre-migración), cae al modelo antiguo por uid.
 * @param {PersonLike} person
 * @param {{ leaders?: LeaderLike[], heads?: HeadLike[] }} [roleSets]
 * @returns {OrgRole}
 */
export function orgRoleOf(person, { leaders = [], heads = [] } = {}) {
  if (person?.orgRole === 'engineer' || person?.orgRole === 'manager' || person?.orgRole === 'head') {
    return person.orgRole;
  }
  return personRole(person ?? {}, leaders, heads);
}

/**
 * Traduce un uid de cuenta al personId de la ficha vinculada (para el fallback:
 * el modelo antiguo guarda el superior por uid y aquí se pasa a personId).
 * @param {string|null|undefined} uid
 * @param {PersonLike[]} people
 * @returns {string|null}
 */
function personIdByUid(uid, people) {
  if (!uid) return null;
  const match = (people ?? []).find((p) => p.uid === uid);
  return match ? match.id : null;
}

/**
 * Identidad organizativa completa de una persona, resuelta por personId. Todas
 * las vistas (lista, ficha, panel) deben consumir ESTE resolvedor para leer lo
 * mismo siempre.
 * @param {PersonLike} person
 * @param {{ people?: PersonLike[], leaders?: LeaderLike[], heads?: HeadLike[] }} [ctx]
 * @returns {PersonIdentity}
 */
export function resolvePerson(person, { people = [], leaders = [], heads = [] } = {}) {
  const orgRole = orgRoleOf(person, { leaders, heads });
  const personId = person?.id ?? null;

  if (orgRole === 'head') {
    return {
      personId,
      orgRole,
      superiorKind: 'none',
      superiorPersonId: null,
      superiorUidLegacy: null,
      emptyLabel: 'Sin superior',
      canTransfer: false,
    };
  }

  const superiorKind = orgRole === 'manager' ? 'head' : 'manager';
  const emptyLabel = orgRole === 'manager' ? 'Sin head' : 'Sin manager';

  // Nuevo modelo: superior explícito por personId.
  if (person?.reportsToPersonId) {
    return {
      personId,
      orgRole,
      superiorKind,
      superiorPersonId: person.reportsToPersonId,
      superiorUidLegacy: null,
      emptyLabel,
      canTransfer: true,
    };
  }

  // Fallback (dato pre-migración): superior por uid → se traduce a personId.
  const superiorUidLegacy = orgRole === 'manager'
    ? ((leaders ?? []).find((l) => l.uid === person?.uid)?.reportsTo ?? null)
    : (person?.ownerLeaderUid ?? null);

  return {
    personId,
    orgRole,
    superiorKind,
    superiorPersonId: personIdByUid(superiorUidLegacy, people),
    superiorUidLegacy,
    emptyLabel,
    canTransfer: true,
  };
}
