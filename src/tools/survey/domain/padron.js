/**
 * Parseo del padrón de empresa desde CSV (RMR-TSK-0333). Dominio puro.
 *
 * El padrón es la lista de personas de la empresa con los datos que alimentan la
 * segmentación de las encuestas. Una persona por fila; separador coma, punto y
 * coma o tabulador. Con CABECERA, las columnas se mapean por NOMBRE en cualquier
 * orden e ignorando extras; sin cabecera, se asume el orden posicional
 * `email, nombre, departamento, fecha_alta, fecha_nacimiento, ubicacion`.
 *
 * Se guarda la FECHA DE NACIMIENTO (no la edad): la edad se recalcula sola cada
 * año. Deduplica por email (en minúsculas) para poder hacer upsert.
 */

/** @typedef {{ email: string, name?: string, department?: string, hireDate?: string, birthDate?: string, location?: string, custom?: Record<string, string> }} PadronRow */

import { axisSlug, RESERVED_AXIS_IDS } from './customAxes.js';

const HEADER = {
  email: /^(e-?mail|correo)/,
  name: /nombre|name/,
  department: /depart|depto|equipo|team/,
  hireDate: /alta|hire|incorpor|antig|ingreso/,
  birthDate: /nacim|birth/,
  location: /ubica|locat|sede|oficina|ciudad|city/,
};

/** @param {string} text @returns {PadronRow[]} */
export function parsePadron(text) {
  const rows = String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/[,;\t]/).map((cell) => cell.trim()));
  if (!rows.length) return [];

  const cols = { email: 0, name: 1, department: 2, hireDate: 3, birthDate: 4, location: 5 };
  let dataRows = rows;
  const header = rows[0].map((cell) => cell.toLowerCase());
  const looksLikeHeader = !rows[0][0].includes('@') && header.some((cell) => HEADER.email.test(cell));
  /** Columnas EXTRA de la cabecera (RMR-TSK-0355): índice → slug del eje custom. */
  const customCols = new Map();
  if (looksLikeHeader) {
    for (const key of Object.keys(cols)) cols[key] = header.findIndex((cell) => HEADER[key].test(cell));
    const known = new Set(Object.values(cols).filter((i) => i >= 0));
    rows[0].forEach((label, idx) => {
      const slug = axisSlug(label);
      if (!known.has(idx) && slug && !RESERVED_AXIS_IDS.includes(slug)) customCols.set(idx, slug);
    });
    dataRows = rows.slice(1);
  }

  const byEmail = new Map();
  for (const cells of dataRows) {
    const email = (cols.email >= 0 ? cells[cols.email] : '') ?? '';
    if (!email || !email.includes('@')) continue;
    const person = { email };
    for (const key of ['name', 'department', 'hireDate', 'birthDate', 'location']) {
      const idx = cols[key];
      if (idx >= 0 && cells[idx]) person[key] = cells[idx];
    }
    for (const [idx, slug] of customCols) {
      if (!cells[idx]) continue;
      person.custom = { ...(person.custom ?? {}), [slug]: cells[idx] };
    }
    byEmail.set(email.toLowerCase(), person);
  }
  return [...byEmail.values()];
}
