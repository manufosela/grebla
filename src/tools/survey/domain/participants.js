/**
 * Parseo del padrón de participantes (RMR-TSK-0326 / RMR-TSK-0332). Dominio puro.
 *
 * Una persona por fila. Separador coma, punto y coma o tabulador (para pegar o
 * subir un CSV). Con CABECERA (la 1ª fila no tiene email en la 1ª celda y nombra
 * una columna tipo «email»), las columnas se mapean por NOMBRE en cualquier orden
 * e ignorando columnas extra: email/correo, departamento (depart… / depto /
 * equipo / team) y fecha de alta (alta / start / antig… / incorpor… / fecha). Sin
 * cabecera, se asume el orden posicional email, departamento, fecha-alta. Descarta filas sin
 * email válido y deduplica por email (en minúsculas). La fecha de alta alimenta
 * el tramo de antigüedad.
 *
 * @returns {Array<{ email: string, metadata: { department?: string, startDate?: string } }>}
 */
export function parseParticipants(text) {
  const rows = String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/[,;\t]/).map((cell) => cell.trim()));
  if (!rows.length) return [];

  let emailIdx = 0;
  let deptIdx = 1;
  let startIdx = 2;
  let dataRows = rows;
  const header = rows[0].map((cell) => cell.toLowerCase());
  // Ancladas al inicio para no confundir «no-email» (contiene «email») con cabecera.
  const looksLikeHeader = !rows[0][0].includes('@') && header.some((cell) => /^(e-?mail|correo)/.test(cell));
  if (looksLikeHeader) {
    emailIdx = header.findIndex((cell) => /^(e-?mail|correo)/.test(cell));
    deptIdx = header.findIndex((cell) => /depart|depto|equipo|team/.test(cell));
    startIdx = header.findIndex((cell) => /alta|start|antig|incorpor|fecha/.test(cell));
    dataRows = rows.slice(1);
  }

  const byEmail = new Map();
  for (const cells of dataRows) {
    const email = cells[emailIdx] ?? '';
    if (!email || !email.includes('@')) continue;
    const metadata = {};
    if (deptIdx >= 0 && cells[deptIdx]) metadata.department = cells[deptIdx];
    if (startIdx >= 0 && cells[startIdx]) metadata.startDate = cells[startIdx];
    byEmail.set(email.toLowerCase(), { email, metadata });
  }
  return [...byEmail.values()];
}

/**
 * Convierte el padrón de empresa en participantes para generar los enlaces,
 * filtrando por departamento y (por defecto) solo personas activas. Mapea
 * `hireDate → startDate` (alimenta el tramo de antigüedad). NO incluye la fecha
 * de nacimiento ni la edad: iría en la respuesta anónima y podría reidentificar;
 * la edad se tratará por tramos en el dashboard.
 * @param {Array<{email:string,department?:string,hireDate?:string,active?:boolean}>} padron
 * @param {{ department?: string|null, onlyActive?: boolean }} [opts]
 * @returns {Array<{ email: string, metadata: { department?: string, startDate?: string } }>}
 */
export function padronToParticipants(padron, { department = null, onlyActive = true } = {}) {
  const byEmail = new Map();
  for (const person of padron ?? []) {
    const email = String(person?.email ?? '').trim();
    if (!email.includes('@')) continue;
    if (onlyActive && person.active === false) continue;
    if (department && person.department !== department) continue;
    const metadata = {};
    if (person.department) metadata.department = person.department;
    if (person.hireDate) metadata.startDate = person.hireDate;
    byEmail.set(email.toLowerCase(), { email, metadata });
  }
  return [...byEmail.values()];
}
