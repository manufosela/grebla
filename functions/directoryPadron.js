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

const SYNCED_FIELDS = ['name', 'department', 'hireDate'];

/**
 * Qué escribir en /padron para dejarlo al día con el directorio (RMR-TSK-0631).
 * Upsert por email como el CSV: solo actualiza los campos con valor que cambian
 * (nunca vacía lo que People ya cargó) y da de alta a quien falta. No borra:
 * quitar a alguien del padrón es una decisión de People.
 * @param {Array<Record<string, any>>} existing documentos actuales de /padron (con id)
 * @param {ReturnType<typeof directoryPadronRows>} rows
 * @returns {{ updates: Array<{ id: string, patch: Record<string, string> }>, adds: Array<Record<string, any>> }}
 */
export function padronUpsertPlan(existing, rows) {
  const byEmail = new Map(existing.filter((p) => norm(p.email)).map((p) => [norm(p.email), p]));
  const updates = [];
  const adds = [];
  for (const row of rows) {
    const current = byEmail.get(row.email);
    if (!current) {
      const person = { email: row.email, name: row.name, department: row.department, hireDate: row.hireDate, birthDate: null, location: null, active: true };
      adds.push(person);
      byEmail.set(row.email, person);
      continue;
    }
    if (!current.id) continue;
    const patch = Object.fromEntries(SYNCED_FIELDS.filter((k) => row[k] && row[k] !== current[k]).map((k) => [k, row[k]]));
    if (Object.keys(patch).length > 0) updates.push({ id: current.id, patch });
  }
  return { updates, adds };
}
