/**
 * Solo se invita con emails de la organización (RMR-TSK-0774). Las reglas de
 * Firestore lo imponen; esto es para decirlo en pantalla antes, en vez de un
 * «sin permiso» que no explica nada. PURO.
 * @param {string|null|undefined} email  email de invitación (vacío = sin invitación)
 * @param {string|null|undefined} domain  dominio de empleados (vacío = sin restricción)
 * @returns {string|null}  el motivo, o null si vale
 */
export function inviteDomainError(email, domain) {
  const e = String(email ?? '').trim().toLowerCase();
  const d = String(domain ?? '').trim().toLowerCase().replace(/^@/, '');
  if (!e || !d || e.endsWith(`@${d}`)) return null;
  return `Solo se puede invitar con un email de la organización (@${d}).`;
}
