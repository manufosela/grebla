/**
 * Superior jerárquico de una persona según su ROL (RMR-TSK-0367).
 *
 * GREBLA tiene dos relaciones jerárquicas distintas y quién es el «superior» de
 * una persona en la lista depende de su rol:
 *  - engineer (persona sin rol de mando): su superior es su MANAGER, guardado en
 *    `person.ownerLeaderUid`. Transferirla cambia ese manager.
 *  - manager (uid presente en /leaders): su superior es su HEAD, guardado en
 *    `reportsTo` de su doc /leaders. Transferirlo cambia ese `reportsTo`.
 *  - head (uid presente en /supermanagers): su superior sería un CTO, que aún no
 *    existe; no tiene superior asignable ni transferencia.
 *
 * Módulo puro (sin Firestore ni Lit): la resolución del rol y del superior se
 * prueba de forma aislada y el componente solo pinta y dispara los casos de uso.
 *
 * @typedef {'engineer'|'manager'|'head'} PersonRole
 * @typedef {{ uid: string, displayName: string|null, email: string|null, reportsTo?: string|null }} LeaderLike
 * @typedef {{ uid: string, displayName: string|null, email: string|null }} HeadLike
 *
 * @typedef {Object} SuperiorDescriptor
 * @property {PersonRole} role                        rol jerárquico de la persona
 * @property {'manager'|'head'|'none'} superiorKind   qué tipo de superior aplica
 * @property {string|null} superiorUid                uid del superior, o null si no tiene
 * @property {string} emptyLabel                      texto cuando no hay superior
 * @property {boolean} canTransfer                    si el nivel admite transferencia hoy
 */

/**
 * Rol jerárquico de una persona a partir de las colecciones de leaders y
 * supermanagers. Head tiene precedencia sobre manager (mismo orden que el panel
 * superadmin). Sin cuenta vinculada (`uid` null) no puede ser mando: engineer.
 * @param {{ uid?: string|null }} person
 * @param {LeaderLike[]} leaders
 * @param {HeadLike[]} heads
 * @returns {PersonRole}
 */
export function personRole(person, leaders, heads) {
  const uid = person?.uid;
  if (!uid) return 'engineer';
  if ((heads ?? []).some((h) => h.uid === uid)) return 'head';
  if ((leaders ?? []).some((l) => l.uid === uid)) return 'manager';
  return 'engineer';
}

/**
 * Descriptor del superior de una persona según su rol. Concentra la decisión de
 * qué relación mostrar/editar para que la celda «superior» y el modal Transferir
 * no repitan la lógica.
 * @param {{ uid?: string|null, ownerLeaderUid?: string|null }} person
 * @param {{ leaders: LeaderLike[], heads: HeadLike[] }} roleSets
 * @returns {SuperiorDescriptor}
 */
export function resolveSuperior(person, { leaders, heads }) {
  const role = personRole(person, leaders, heads);
  if (role === 'engineer') {
    return {
      role,
      superiorKind: 'manager',
      superiorUid: person?.ownerLeaderUid ?? null,
      emptyLabel: 'Sin manager',
      canTransfer: true,
    };
  }
  if (role === 'manager') {
    const leader = (leaders ?? []).find((l) => l.uid === person.uid);
    return {
      role,
      superiorKind: 'head',
      superiorUid: leader?.reportsTo ?? null,
      emptyLabel: 'Sin head',
      canTransfer: true,
    };
  }
  return {
    role,
    superiorKind: 'none',
    superiorUid: null,
    emptyLabel: 'Sin superior',
    canTransfer: false,
  };
}
