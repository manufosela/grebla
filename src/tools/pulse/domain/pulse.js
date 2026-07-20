/**
 * Dominio puro de GREBLA Marea (RMR-TSK-0234): claves de día/semana y saneado de
 * un registro de marea. Sin Firestore ni DOM, para poder testearlo sin mocks.
 *
 * Modelo: una marea = un punto en la rejilla (energia × animo) + cuatro anclas
 * (carga, rumbo, tripulacion, reconocimiento) + una palabra libre. Todas las
 * dimensiones son 0..100. Se guarda un registro por persona y día.
 */

/** Dimensiones numéricas de una marea (0..100). El orden no importa. */
export const PULSE_DIMS = /** @type {const} */ ([
  'energia', 'animo', 'carga', 'rumbo', 'tripulacion', 'reconocimiento',
]);

/** Máximo de caracteres de la palabra libre. */
export const PULSE_WORD_MAX = 40;

/**
 * Clave del día (YYYY-MM-DD) en hora LOCAL: es el id del doc, así solo puede
 * haber un registro por persona y día. Local (no UTC) para que «hoy» sea el día
 * de la persona.
 * @param {Date} [date]
 * @returns {string}
 */
export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Clave de semana ISO 8601 (p. ej. "2026-W29") para agrupar por semana. La
 * semana ISO empieza en lunes y la semana 1 es la del primer jueves del año.
 * @param {Date} [date]
 * @returns {string}
 */
export function isoWeekKey(date = new Date()) {
  // Trabaja en UTC sobre la fecha civil (sin horas) para evitar saltos por DST.
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // lunes=1 … domingo=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // jueves de esta semana
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Descompone una clave de semana ISO ("2026-W29") en año y número de semana, para
 * mostrar el título («Semana 29 · 2026»). Devuelve null si el formato no encaja.
 * @param {string} weekIso
 * @returns {{ year: number, week: number }|null}
 */
export function parseWeekIso(weekIso) {
  const match = /^(\d{4})-W(\d{2})$/.exec(String(weekIso ?? ''));
  if (!match) return null;
  return { year: Number(match[1]), week: Number(match[2]) };
}

/**
 * Lectura (nombre náutico + matiz) del cuadrante según energía y ánimo (0..100).
 * Compartida por la pantalla de rellenar y por Resultados.
 * @param {number} energia @param {number} animo
 * @returns {{ name: string, sub: string }}
 */
export function pulseReading(energia, animo) {
  if (Math.abs(energia - 50) < 14 && Math.abs(animo - 50) < 14) return { name: 'Aguas medias', sub: 'ni fu ni fa esta semana' };
  if (energia >= 50 && animo >= 50) return { name: 'Viento a favor', sub: 'con energía y a gusto' };
  if (energia >= 50) return { name: 'Mar de fondo', sub: 'con marcha, pero a la contra' };
  if (animo < 50) return { name: 'Calma chicha', sub: 'sin viento y cuesta arriba' };
  return { name: 'Fondeado', sub: 'en calma, con poca marcha' };
}

/** Redondea y acota un valor de dimensión al rango 0..100. */
function clampDim(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/**
 * Sanea la entrada del usuario a un registro de marea válido: cada dimensión
 * acotada a 0..100, la palabra recortada y el opt-in de compartirla (shareWord).
 * No incluye metadatos (uid, fechas): los pone la capa de IO.
 * @param {Record<string, unknown>} [input]
 * @returns {{ energia: number, animo: number, carga: number, rumbo: number, tripulacion: number, reconocimiento: number, palabra: string, shareWord: boolean }}
 */
export function sanitizePulse(input = {}) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const dim of PULSE_DIMS) out[dim] = clampDim(input[dim]);
  const palabra = typeof input.palabra === 'string' ? input.palabra : '';
  out.palabra = palabra.trim().slice(0, PULSE_WORD_MAX);
  // Opt-in explícito: la palabra solo entra en la nube anónima del equipo si el
  // usuario lo marca; por defecto es privada (RMR-TSK-0240).
  out.shareWord = input.shareWord === true;
  return /** @type {any} */ (out);
}

/**
 * Rango de fechas LABORAL (lunes→viernes) de una semana ISO, para dar contexto
 * al «Semana 30» de Marea (RMR-TSK-0273). Inverso de `isoWeekKey`: el jueves de
 * la semana ISO siempre cae en su año, así que se ancla ahí y se retrocede al
 * lunes. Devuelve fechas UTC a medianoche (sin horas, sin saltos por DST).
 * @param {string} weekIso Clave «YYYY-Www» (p. ej. «2026-W30»).
 * @returns {{ start: Date, end: Date }|null} lunes y viernes, o null si no parsea.
 */
export function weekRange(weekIso) {
  const parsed = parseWeekIso(weekIso);
  if (!parsed) return null;
  const { year, week } = parsed;
  // 4 de enero siempre pertenece a la semana ISO 1.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // lunes=1 … domingo=7
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 4); // viernes
  return { start, end };
}
