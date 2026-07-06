/**
 * Bitácora del jugador (JG-23): lógica PURA del histórico de travesía. El
 * journey guarda el ESTADO actual (qué casas visitadas, qué reto), pero no la
 * HISTORIA — qué hiciste y cuándo. Este módulo modela esa historia como un
 * registro SOLO-AÑADIR de apuntes con fecha, en el doc
 * /people/{personId}/career/logbook: { entries: LogEntry[] }.
 *
 * DECISIONES (simétricas con achievements, MC-21):
 *  - Solo-añadir: un apunte nunca se re-escribe ni se borra — retirar un
 *    certificado no borra el apunte de cuándo lo obtuviste. La bitácora es
 *    historia, no estado.
 *  - Fechas ISO con el reloj del CLIENTE (el mismo gesto que muta el journey),
 *    para mantener el dominio puro y testeable sin Firestore.
 *  - Deduplicado por CLAVE natural del apunte (kind + ref): certificar la
 *    misma casa dos veces (retirar y volver a obtener) no duplica el apunte;
 *    el primero se queda. Los eventos de ruta llevan la fecha en la clave para
 *    poder repetirse (empezar el mismo reto en dos momentos son dos apuntes).
 *
 * @typedef {'certificate'|'route-start'|'route-abandon'} LogKind
 * @typedef {Object} LogEntry
 * @property {LogKind} kind
 * @property {string} ref  Referencia natural (cityId o routeId).
 * @property {string} label Texto legible (nombre de la casa o del reto).
 * @property {string} at   ISO 8601 del momento.
 */

/** Tipos de apunte reconocidos (cualquier otro se descarta al normalizar). */
const LOG_KINDS = /** @type {ReadonlyArray<LogKind>} */ (
  Object.freeze(['certificate', 'route-start', 'route-abandon'])
);

/** Bitácora vacía. @type {{ entries: LogEntry[] }} */
export const EMPTY_LOGBOOK = Object.freeze({ entries: Object.freeze([]) });

/**
 * Clave natural de un apunte para deduplicar. Los certificados son únicos por
 * casa (kind:ref); los eventos de ruta incluyen la fecha (dos inicios del
 * mismo reto en momentos distintos son dos apuntes legítimos).
 * @param {LogEntry} entry
 * @returns {string}
 */
export function logEntryKey(entry) {
  return entry.kind === 'certificate' ? `${entry.kind}:${entry.ref}` : `${entry.kind}:${entry.ref}:${entry.at}`;
}

/**
 * Sanea un apunte crudo, o null si no tiene la forma mínima (kind válido, ref
 * y label no vacíos; `at` string no vacío o null → «fecha no registrada»).
 * @param {unknown} raw
 * @returns {LogEntry|null}
 */
function normalizeEntry(raw) {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = /** @type {Record<string, unknown>} */ (raw);
  const kind = value.kind;
  if (typeof kind !== 'string' || !LOG_KINDS.includes(/** @type {LogKind} */ (kind))) return null;
  const ref = typeof value.ref === 'string' ? value.ref.trim() : '';
  const label = typeof value.label === 'string' ? value.label.trim() : '';
  if (!ref || !label) return null;
  const at = typeof value.at === 'string' && value.at.trim() !== '' ? value.at : '';
  if (!at) return null;
  return { kind: /** @type {LogKind} */ (kind), ref, label, at };
}

/**
 * Reconstruye la bitácora desde el documento de Firestore (o vacía si no hay):
 * sanea los apuntes y descarta los inválidos, preservando el orden guardado.
 * @param {Record<string, unknown>|null|undefined} data
 * @returns {{ entries: LogEntry[] }}
 */
export function normalizeLogbook(data) {
  const rawEntries = Array.isArray(data?.entries) ? data.entries : [];
  const entries = rawEntries.map(normalizeEntry).filter((e) => e !== null);
  return { entries };
}

/**
 * Apuntes de CERTIFICADO que faltan por registrar: uno por casa recién visitada
 * que aún no esté en la bitácora. El label se resuelve con `cityName` (si no
 * casa, cae al propio id — nunca inventa). Orden estable por el de visita.
 * @param {ReadonlyArray<string>} visitedCities
 * @param {{ entries: LogEntry[] }} logbook
 * @param {(cityId: string) => string} cityName Resolutor de nombre.
 * @param {string} at ISO del momento.
 * @returns {LogEntry[]}
 */
export function newCertificateEntries(visitedCities, logbook, cityName, at) {
  const logged = new Set(
    logbook.entries.filter((e) => e.kind === 'certificate').map((e) => e.ref),
  );
  const out = [];
  for (const cityId of visitedCities ?? []) {
    if (typeof cityId !== 'string' || logged.has(cityId)) continue;
    logged.add(cityId); // evita duplicar si visitedCities trae repetidos
    out.push({ kind: 'certificate', ref: cityId, label: cityName(cityId), at });
  }
  return out;
}

/**
 * Añade apuntes a la bitácora (solo-añadir): descarta los que ya existen por
 * su clave natural y devuelve una NUEVA bitácora. Sin apuntes nuevos, devuelve
 * la misma referencia (el caller puede saltarse la escritura).
 * @param {{ entries: LogEntry[] }} logbook
 * @param {ReadonlyArray<LogEntry>} additions
 * @returns {{ entries: LogEntry[] }}
 */
export function appendLogbook(logbook, additions) {
  const seen = new Set(logbook.entries.map(logEntryKey));
  const fresh = [];
  for (const entry of additions) {
    const key = logEntryKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(entry);
  }
  if (fresh.length === 0) return logbook;
  return { entries: [...logbook.entries, ...fresh] };
}

/**
 * Apuntes de la bitácora ordenados para MOSTRAR: más reciente primero. Empate
 * de fecha → el añadido después va antes (orden de inserción inverso), estable.
 * @param {{ entries: LogEntry[] }} logbook
 * @returns {LogEntry[]}
 */
export function logbookView(logbook) {
  return logbook.entries
    .map((entry, i) => ({ entry, i }))
    .toSorted((a, b) => (a.entry.at === b.entry.at ? b.i - a.i : a.entry.at < b.entry.at ? 1 : -1))
    .map((x) => x.entry);
}
