/**
 * El padrón de las encuestas desde el censo (RMR-TSK-0629). Puro: de las
 * fichas a las filas que entiende el padrón (las mismas que el CSV). Quien
 * gestiona encuestas no lee /people, así que esto lo sirve una callable que
 * solo deja salir nombre, email, departamento y alta de las personas activas.
 */

const norm = (email) => (typeof email === 'string' && email.includes('@') ? email.trim().toLowerCase() : null);

/**
 * @param {Array<{ id: string, data: Record<string, any>, authEmail?: string|null }>} people
 * @param {Map<string, string>} branchLabels id de rama → nombre visible
 * @returns {Array<{ email: string, name: string|null, department: string|null, hireDate: string|null }>}
 */
export function directoryPadronRows(people, branchLabels) {
  const seen = new Set();
  const rows = [];
  for (const { data, authEmail } of people) {
    if (data.active === false) continue;
    const email = norm(data.email) ?? norm(data.pendingEmail) ?? norm(authEmail);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    rows.push({
      email,
      name: data.name ?? null,
      department: branchLabels.get(data.orgBranch) ?? null,
      hireDate: data.startDate ?? null,
    });
  }
  return rows;
}
