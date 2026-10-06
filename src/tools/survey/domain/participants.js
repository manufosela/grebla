/**
 * Convierte el padrón de empresa en participantes para generar los enlaces,
 * filtrando por departamento y (por defecto) solo personas activas. Mapea
 * `hireDate → startDate` (tramo de antigüedad) y `birthDate` (tramo de edad).
 * Las fechas exactas van solo al token (que ve el gestor); en la respuesta
 * anónima se guardan SOLO en tramos (bucketMetadata), nunca la fecha, así no
 * reidentifican. La ubicación se pasa tal cual (categórica) y se protege con k.
 * Los ejes CUSTOM declarados (RMR-TSK-0355) viajan planos (metadata[id] = valor)
 * — solo los declarados: un campo custom sin declarar (p. ej. texto libre) se
 * queda en el padrón y jamás llega al token ni a la respuesta.
 * @param {Array<{email:string,department?:string,hireDate?:string,birthDate?:string,location?:string,active?:boolean,custom?:Record<string,string>}>} padron
 * @param {{ department?: string|null, onlyActive?: boolean, axisIds?: string[] }} [opts]
 * @returns {Array<{ email: string, metadata: Record<string, string> }>}
 */
export function padronToParticipants(padron, { department = null, onlyActive = true, axisIds = [] } = {}) {
  const byEmail = new Map();
  for (const person of padron ?? []) {
    const email = String(person?.email ?? '').trim();
    if (!email.includes('@')) continue;
    if (onlyActive && person.active === false) continue;
    if (department && person.department !== department) continue;
    const metadata = {};
    if (person.department) metadata.department = person.department;
    if (person.hireDate) metadata.startDate = person.hireDate;
    if (person.birthDate) metadata.birthDate = person.birthDate;
    if (person.location) metadata.location = person.location;
    for (const id of axisIds) {
      const value = person.custom?.[id];
      if (value != null && String(value).trim()) metadata[id] = String(value).trim();
    }
    byEmail.set(email.toLowerCase(), { email, metadata });
  }
  return [...byEmail.values()];
}
