/**
 * Valoración de una persona contra UN nivel concreto (RMR-PCS-0044 · F2).
 * Dominio PURO; la IO vive en src/lib/careerAssessment.js.
 *
 * Es otra cosa que `assessment.js`, y por eso vive aparte:
 * - aquella valora el nivel que la persona YA tiene («¿cumple su L1?») y una
 *   dimensión sin marcar cuenta como que cumple;
 * - esta valora el nivel SIGUIENTE («¿cuánto lleva de L2?»), donde lo que nadie
 *   ha valorado no cumple, y se guarda por nivel para no reinterpretar marcas
 *   viejas cuando la persona sube.
 *
 * La marca es BINARIA —cumple o no cumple— y lleva autor y fecha: valora el EM
 * y el head complementa sobre la MISMA marca, así que lo único que hace falta
 * saber es quién fue el último en decirlo.
 *
 * Los cierres (`closures`) solo se añaden. Son la evidencia de que el 80 % se
 * mantuvo: sin ellos, «sostenido» sería una palabra bonita.
 *
 * @typedef {Object} Author
 * @property {string} uid
 * @property {string} name
 *
 * @typedef {Object} LevelMark
 * @property {boolean} meets
 * @property {string} note
 * @property {Author|null} by
 * @property {string|null} at   ISO
 *
 * @typedef {Object} Closure
 * @property {string} at        ISO
 * @property {number} earned
 * @property {number} total
 * @property {number} pct
 * @property {Author|null} by
 *
 * @typedef {Object} LevelAssessment
 * @property {string} levelId                        nivel valorado (el objetivo)
 * @property {Record<string, LevelMark>} byDimension
 * @property {Closure[]} closures                    del más antiguo al más reciente
 */

const author = (raw) => (raw && typeof raw.uid === 'string' ? { uid: raw.uid, name: String(raw.name ?? '').trim() } : null);
const iso = (raw) => (typeof raw === 'string' && raw.trim() !== '' ? raw : null);

/** Una marca saneada: lo que no es `true` no cumple, no se presupone nada. */
function normalizeMark(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    meets: raw.meets === true,
    note: String(raw.note ?? '').trim(),
    by: author(raw.by),
    at: iso(raw.at),
  };
}

function normalizeClosure(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const at = iso(raw.at);
  const { earned, total } = raw;
  if (!at || !Number.isFinite(earned) || !Number.isFinite(total) || total <= 0) return null;
  return {
    at,
    earned,
    total,
    pct: Number.isFinite(raw.pct) ? raw.pct : Math.round((earned * 100) / total),
    by: author(raw.by),
  };
}

/**
 * Documento saneado. Sin documento, una valoración vacía de ese nivel: la UI no
 * tiene que distinguir el caso.
 * @param {unknown} raw @param {string} levelId nivel que se pidió leer
 * @returns {LevelAssessment}
 */
export function normalizeLevelAssessment(raw, levelId) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const byDimension = {};
  for (const [id, mark] of Object.entries(data.byDimension ?? {})) {
    const limpia = normalizeMark(mark);
    if (limpia) byDimension[id] = limpia;
  }
  // El nivel es el que se pidió (que es el id del documento), nunca el que diga
  // el contenido: si alguien edita el campo a mano, la valoración no puede pasar
  // a hablar de otro nivel a espaldas de quien la lee.
  if (typeof data.levelId === 'string' && data.levelId && levelId && data.levelId !== levelId) {
    throw new Error(`La valoración guardada dice ser de ${data.levelId} y se pidió la de ${levelId}.`);
  }
  return {
    levelId: levelId ?? (typeof data.levelId === 'string' ? data.levelId : null),
    byDimension,
    closures: (Array.isArray(data.closures) ? data.closures : []).map(normalizeClosure).filter(Boolean),
  };
}

/**
 * Marca (o corrige) una dimensión. Inmutable: devuelve una valoración nueva.
 * @param {LevelAssessment} assessment @param {string} dimensionId
 * @param {{ meets: boolean, note?: string, by?: Author|null, at?: string|null }} mark
 * @returns {LevelAssessment}
 */
export function markDimension(assessment, dimensionId, mark) {
  if (!dimensionId) return assessment;
  return {
    ...assessment,
    byDimension: {
      ...assessment.byDimension,
      [dimensionId]: {
        meets: mark?.meets === true,
        note: String(mark?.note ?? '').trim(),
        by: author(mark?.by),
        at: iso(mark?.at),
      },
    },
  };
}

/**
 * Las marcas en el formato que espera `levelCompletion`: id de dimensión →
 * cumple sí o no.
 * @param {LevelAssessment|null|undefined} assessment
 * @returns {Record<string, boolean>}
 */
export function marksOf(assessment) {
  return Object.fromEntries(Object.entries(assessment?.byDimension ?? {}).map(([id, m]) => [id, m.meets === true]));
}

/**
 * Cierra la valoración: deja constancia del cumplimiento de este momento. Solo
 * AÑADE; lo anterior no se toca, porque es la prueba de la racha.
 * @param {LevelAssessment} assessment
 * @param {{ earned: number, total: number, pct: number }|null|undefined} completion
 * @param {{ by?: Author|null, at?: string }} meta
 * @returns {LevelAssessment}
 */
export function closeAssessment(assessment, completion, meta = {}) {
  const cierre = normalizeClosure({ ...completion, at: meta.at ?? new Date().toISOString(), by: meta.by });
  if (!cierre) return assessment;
  return { ...assessment, closures: [...assessment.closures, cierre] };
}

/**
 * Los cierres del más reciente al más antiguo, que es como los lee
 * `levelProgressFor({ history })`.
 * @param {LevelAssessment|null|undefined} assessment
 * @returns {Closure[]}
 */
export function closureHistory(assessment) {
  return [...(assessment?.closures ?? [])].reverse();
}

/** El último cierre, o null si todavía no se ha cerrado ninguna valoración. */
export function lastClosure(assessment) {
  return closureHistory(assessment).at(0) ?? null;
}

/**
 * Dos cierres son el mismo cuando coinciden ENTEROS: fecha, pesos, porcentaje y
 * quién lo cerró. Comparar solo la fecha y los pesos dejaría reescribir el autor
 * o el porcentaje de un cierre viejo, que es exactamente lo que no puede pasar.
 */
function sameClosure(a, b) {
  return a.at === b.at && a.earned === b.earned && a.total === b.total && a.pct === b.pct
    && (a.by?.uid ?? null) === (b.by?.uid ?? null) && (a.by?.name ?? null) === (b.by?.name ?? null);
}

/**
 * Comprueba que unos cierres son los de antes MÁS lo nuevo al final. Solo-añadir
 * en memoria no basta: quien pueda escribir el documento podría mandar una lista
 * recortada y borrar la evidencia de la racha, así que esto se verifica también
 * al persistir, contra lo que hay en ese momento en el servidor.
 * @param {Closure[]} previous @param {Closure[]} next
 * @throws {Error} si falta alguno de los anteriores o si alguno cambió
 */
export function assertAppendOnlyClosures(previous, next) {
  const antes = previous ?? [];
  const ahora = next ?? [];
  if (ahora.length < antes.length) throw new Error('Los cierres de una valoración no se borran: solo se añaden.');
  for (const [i, cierre] of antes.entries()) {
    if (!sameClosure(cierre, ahora[i])) throw new Error(`El cierre ${cierre.at} no se puede modificar: los cierres solo se añaden.`);
  }
}
