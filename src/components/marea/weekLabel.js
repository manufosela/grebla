/**
 * Etiqueta legible del rango de una semana ISO para Marea (RMR-TSK-0273):
 * «Semana 30» a secas no dice de qué días habla. La usan <marea-fill> y
 * <marea-results>, de ahí que viva aparte y no duplicada en cada uno.
 *
 * El formateo con locale es presentación, por eso está aquí y no en el dominio
 * (`weekRange` sí es puro y vive en tools/pulse/domain/pulse.js).
 */
import { weekRange } from '../../tools/pulse/domain/pulse.js';

// timeZone UTC: `weekRange` devuelve fechas UTC a medianoche; sin esto, en husos
// al oeste de Greenwich el día formateado se iría al anterior.
const monthFmt = new Intl.DateTimeFormat('es-ES', { month: 'long', timeZone: 'UTC' });

/**
 * @param {string} weekIso Clave «YYYY-Www» (p. ej. «2026-W30»).
 * @returns {string} p. ej. «del 20/julio al 24/julio»; cadena vacía si no parsea.
 */
export function weekRangeLabel(weekIso) {
  const range = weekRange(weekIso);
  if (!range) return '';
  const day = (d) => `${d.getUTCDate()}/${monthFmt.format(d)}`;
  return `del ${day(range.start)} al ${day(range.end)}`;
}
