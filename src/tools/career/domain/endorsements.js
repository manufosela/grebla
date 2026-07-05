/**
 * Avales del manager sobre certificados (JG-6): lógica PURA del sello ✓.
 *
 * Al obtener un certificado (casa visitada) el manager puede AVALARLO — un
 * reconocimiento con su nombre y fecha, NUNCA un bloqueo: el certificado vale
 * desde el momento en que el jugador lo obtiene, con o sin aval. El doc
 * (/people/{personId}/career/endorsements) guarda solo:
 *
 *   { byCity: { [cityId]: { by: { uid, name }, at: ISO } } }
 *
 * DECISIONES (documentadas):
 *  - El doc de avales es la CLAVE DE SEGURIDAD del sello: NO figura entre los
 *    docs que el jugador vinculado puede escribir (journey/playtime/
 *    achievements, JG-1) — cae en el {document=**} del subárbol de la persona,
 *    que solo abren líder dueño / compartido-edit / superadmin. El jugador no
 *    puede auto-avalarse por diseño de reglas, sin reglas nuevas.
 *  - Un aval NUNCA se re-escribe (addEndorsement no pisa existentes): el
 *    primer sello es el que cuenta. Retirar el aval (removeEndorsement) es la
 *    única corrección posible — quien avaló puede desdecirse.
 *  - Fechas ISO con el reloj del CLIENTE, como los achievements (MC-21): el
 *    modelo se mantiene puro y testeable sin Firestore; la precisión de
 *    minutos no es requisito de negocio.
 */

/**
 * Autor de un aval: la cuenta del manager que lo firma.
 * @typedef {Object} EndorsementAuthor
 * @property {string} uid
 * @property {string} name
 */

/**
 * Registro de UN aval: quién lo firma y cuándo (ISO 8601, o null si la fecha
 * llegó corrupta — «fecha no registrada», nunca una fecha inventada).
 * @typedef {Object} EndorsementRecord
 * @property {EndorsementAuthor} by
 * @property {string|null} at
 */

/**
 * Avales de una persona (doc /people/{id}/career/endorsements).
 * @typedef {Object} Endorsements
 * @property {Record<string, EndorsementRecord>} byCity Por id de ciudad (casa).
 */

/** Avales vacíos (nadie ha sellado nada todavía). @type {Endorsements} */
export const EMPTY_ENDORSEMENTS = Object.freeze({ byCity: Object.freeze({}) });

/**
 * Sanea un registro crudo a EndorsementRecord, o null si no tiene la forma
 * mínima: un objeto con autor válido (uid y name strings no vacíos). Un aval
 * sin firmante no es un aval — se descarta. `at` solo se acepta como string
 * no vacío (cualquier otra cosa cae a null: «fecha no registrada»).
 * @param {unknown} raw
 * @returns {EndorsementRecord|null}
 */
function normalizeRecord(raw) {
  if (typeof raw !== 'object' || raw === null) return null;
  const { by, at } = /** @type {Record<string, unknown>} */ (raw);
  if (typeof by !== 'object' || by === null) return null;
  const { uid, name } = /** @type {Record<string, unknown>} */ (by);
  if (typeof uid !== 'string' || uid.trim() === '') return null;
  if (typeof name !== 'string' || name.trim() === '') return null;
  return {
    by: { uid, name },
    at: typeof at === 'string' && at.trim() !== '' ? at : null,
  };
}

/**
 * Reconstruye los avales desde el documento de Firestore (o null si no
 * existe): sanea tipos y descarta claves sin registro válido. Sin doc → vacíos.
 * @param {Record<string, unknown>|null|undefined} data data() del doc de endorsements.
 * @returns {Endorsements}
 */
export function normalizeEndorsements(data) {
  if (!data) return { byCity: {} };
  /** @type {Record<string, EndorsementRecord>} */
  const byCity = {};
  const raw = data.byCity;
  if (typeof raw === 'object' && raw !== null) {
    for (const [cityId, record] of Object.entries(raw)) {
      const clean = normalizeRecord(record);
      if (clean && cityId.trim() !== '') byCity[cityId] = clean;
    }
  }
  return { byCity };
}

/**
 * El aval de una casa, o null si nadie la ha sellado.
 * @param {Endorsements|null|undefined} endorsements
 * @param {string} cityId
 * @returns {EndorsementRecord|null}
 */
export function endorsementFor(endorsements, cityId) {
  return endorsements?.byCity?.[cityId] ?? null;
}

/**
 * Añade el aval de una casa (inmutable): devuelve unos avales NUEVOS con el
 * sello firmado. Si la casa YA tiene aval devuelve los avales tal cual (el
 * primer sello no se re-escribe — misma semántica solo-añadir que los
 * achievements de MC-21); el caller compara referencias para ahorrarse la
 * escritura. Falla en alto con datos inválidos: un aval sin firmante o sin
 * casa no es un aval.
 * @param {Endorsements} endorsements
 * @param {string} cityId
 * @param {EndorsementAuthor} by Manager que firma el sello.
 * @param {string} at Fecha ISO del gesto.
 * @returns {Endorsements}
 */
export function addEndorsement(endorsements, cityId, by, at) {
  if (typeof cityId !== 'string' || cityId.trim() === '') {
    throw new Error('El aval requiere la casa (cityId).');
  }
  if (!by?.uid || !by?.name) {
    throw new Error('El aval requiere el firmante (by: { uid, name }).');
  }
  if (typeof at !== 'string' || at.trim() === '') {
    throw new Error('El aval requiere la fecha ISO del gesto (at).');
  }
  if (cityId in (endorsements?.byCity ?? {})) return endorsements;
  return {
    byCity: {
      ...(endorsements?.byCity ?? {}),
      [cityId]: { by: { uid: by.uid, name: by.name }, at },
    },
  };
}

/**
 * Retira el aval de una casa (inmutable): devuelve unos avales NUEVOS sin ese
 * sello. Sin aval que retirar devuelve los avales tal cual (el caller compara
 * referencias para ahorrarse la escritura). Quién PUEDE retirarlo (solo quien
 * lo dio) se decide en la UI/reglas, no aquí: el dominio solo quita la clave.
 * @param {Endorsements} endorsements
 * @param {string} cityId
 * @returns {Endorsements}
 */
export function removeEndorsement(endorsements, cityId) {
  if (!(cityId in (endorsements?.byCity ?? {}))) return endorsements;
  const byCity = { ...endorsements.byCity };
  delete byCity[cityId];
  return { byCity };
}

/**
 * Número de certificados avalados (contador «N avalados ✓» de la ficha).
 * @param {Endorsements|null|undefined} endorsements
 * @returns {number}
 */
export function endorsedCount(endorsements) {
  return Object.keys(endorsements?.byCity ?? {}).length;
}
