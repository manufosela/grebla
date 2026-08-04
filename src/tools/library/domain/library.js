/**
 * Biblioteca de la bodega — dominio puro (RMR-PCS-0033 · F1).
 *
 * Catálogo de libros técnicos recomendados: físicos (se prestan indicando quién
 * lo tiene y una fecha máxima de devolución — el compromiso de lectura) y
 * digitales (enlace directo). El préstamo vive en el doc del libro (un ejemplar
 * por título, sin histórico: YAGNI); las peticiones piden comprar (físico) o
 * subir (digital). Sin dependencias de Firebase: lo comparten la UI y los tests.
 */

/** Formatos válidos de libro. */
export const BOOK_FORMATS = ['physical', 'digital'];

/** Tipos de petición: comprar un físico o subir/enlazar un digital. */
export const REQUEST_TYPES = ['buy', 'upload'];

/** Días de margen a partir de los cuales un préstamo se considera «por vencer». */
export const DUE_SOON_DAYS = 7;

const DAY_MS = 86_400_000;

/** @param {unknown} value @returns {string|null} */
const cleanText = (value) => {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text || null;
};

/**
 * Valida y normaliza un libro del catálogo.
 * @param {{ title?: unknown, author?: unknown, format?: unknown, url?: unknown, topics?: unknown, recommended?: unknown }} input
 * @returns {{ title: string, author: string|null, format: 'physical'|'digital', url: string|null, topics: string[], recommended: boolean }}
 */
export function validateBookInput(input) {
  const title = cleanText(input?.title);
  if (!title) throw new Error('El libro necesita un título');
  const format = input?.format;
  if (!BOOK_FORMATS.includes(format)) {
    throw new Error(`Formato desconocido: usa ${BOOK_FORMATS.join(' o ')}`);
  }
  const url = cleanText(input?.url);
  if (format === 'digital' && !/^https?:\/\/.+/.test(url ?? '')) {
    throw new Error('Un libro digital necesita su enlace (http/https)');
  }
  const topics = Array.isArray(input?.topics)
    ? input.topics.map((t) => cleanText(t)).filter(Boolean)
    : [];
  return {
    title,
    author: cleanText(input?.author),
    format,
    url: format === 'digital' ? url : null,
    topics,
    recommended: Boolean(input?.recommended),
  };
}

/**
 * Valida un préstamo: quién se lo lleva y hasta cuándo se compromete a leerlo.
 * La fecha máxima de devolución debe ser FUTURA (respecto a `now`). El nombre
 * es obligatorio; el personId solo si hay ficha vinculada (las reglas anclan
 * ambos a la identidad autenticada).
 * @param {{ personId?: unknown, personName?: unknown, dueDate?: unknown }} input
 * @param {Date} now
 * @returns {{ personId: string|null, personName: string, dueDate: string }} dueDate en ISO YYYY-MM-DD
 */
export function validateLoan(input, now) {
  const personId = cleanText(input?.personId);
  const personName = cleanText(input?.personName);
  if (!personName) throw new Error('El préstamo necesita una persona');
  const dueDate = cleanText(input?.dueDate);
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(dueDate))) {
    throw new Error('Elige la fecha máxima de devolución');
  }
  // Comparación lexicográfica de fechas ISO con el día LOCAL de quien presta
  // (no el UTC: cerca de medianoche divergen): mañana o después — a «hoy» no
  // le queda margen de lectura.
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (dueDate <= localToday) {
    throw new Error('La fecha de devolución debe ser futura: date margen para leerlo');
  }
  return { personId, personName, dueDate };
}

/**
 * Valida una petición de libro: comprar (físico) o subir (digital).
 * @param {{ type?: unknown, title?: unknown, author?: unknown, reason?: unknown }} input
 * @returns {{ type: 'buy'|'upload', title: string, author: string|null, reason: string|null }}
 */
export function validateRequestInput(input) {
  const type = input?.type;
  if (!REQUEST_TYPES.includes(type)) {
    throw new Error(`Tipo de petición desconocido: usa ${REQUEST_TYPES.join(' o ')}`);
  }
  const title = cleanText(input?.title);
  if (!title) throw new Error('La petición necesita el título del libro');
  return { type, title, author: cleanText(input?.author), reason: cleanText(input?.reason) };
}

/**
 * Estado de préstamo de un libro para pintar la estantería.
 * @param {{ borrowedByPersonId?: string|null, dueDate?: string|null }} book
 * @param {Date} today
 * @returns {'free'|'borrowed'|'due-soon'|'overdue'}
 */
export function bookLoanStatus(book, today) {
  if (!book?.borrowedByPersonId) return 'free';
  const due = book.dueDate ? Date.parse(`${book.dueDate}T23:59:59Z`) : Number.NaN;
  if (Number.isNaN(due)) return 'borrowed';
  const remaining = due - today.getTime();
  if (remaining < 0) return 'overdue';
  if (remaining <= DUE_SOON_DAYS * DAY_MS) return 'due-soon';
  return 'borrowed';
}
