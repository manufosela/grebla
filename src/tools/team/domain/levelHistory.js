/**
 * Historial de nivel — el relato de promociones (épica RMR-PCS-0037 · F1).
 *
 * El nivel lo fija el manager y hasta ahora se SOBRESCRIBÍA: se perdía cuándo
 * alguien llegó a cada nivel y quién lo decidió. `levelHistory` es un array
 * SOLO-AÑADIR en la ficha: cada cambio de levelId registra {from, to, at,
 * byUid, note}. Las bajadas también cuentan (con su nota — en la fase de
 * calibración son notas, no estigmas). Módulo puro: lo comparten el editor del
 * manager, la self-ficha y los tests.
 */

/**
 * Añade un cambio de nivel al historial (inmutable). Mismo nivel → no-op
 * (devuelve el MISMO array: el caller sabe que no hay nada que persistir).
 * @param {ReadonlyArray<object>} history
 * @param {{ from?: string|null, to: string, at: string, byUid?: string|null, note?: string|null }} change
 * @returns {ReadonlyArray<object>}
 */
export function appendLevelChange(history, { from = null, to, at, byUid = null, note = null }) {
  if (typeof to !== 'string' || !to.trim()) throw new Error('El cambio necesita el nivel de destino');
  if (from === to) return history ?? [];
  if (typeof at !== 'string' || !at.trim()) throw new Error('El cambio necesita la fecha');
  const cleanNote = typeof note === 'string' && note.trim() ? note.trim() : null;
  return [...(history ?? []), { from: from ?? null, to, at, byUid: byUid ?? null, note: cleanNote }];
}

/**
 * Lectura tolerante del historial guardado: basura → []; entradas sin destino
 * o sin fecha se descartan (visibles solo las íntegras).
 * @param {unknown} raw
 * @returns {Array<{ from: string|null, to: string, at: string, byUid: string|null, note: string|null }>}
 */
export function normalizeLevelHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e && typeof e === 'object')
    .filter((e) => typeof e.to === 'string' && e.to.trim() && typeof e.at === 'string' && e.at.trim())
    .map((e) => ({
      from: typeof e.from === 'string' && e.from ? e.from : null,
      to: e.to,
      at: e.at,
      byUid: typeof e.byUid === 'string' && e.byUid ? e.byUid : null,
      note: typeof e.note === 'string' && e.note.trim() ? e.note.trim() : null,
    }));
}

/**
 * Filas listas para pintar la línea de tiempo (de reciente a antiguo): códigos
 * de nivel resueltos contra el framework (o el id tal cual si el nivel ya no
 * existe) y fecha formateada en el idioma de la app.
 * @param {unknown} raw
 * @param {Array<{ id: string, code: string }>} levels  niveles del framework
 * @param {string} [locale]
 * @returns {Array<{ fromCode: string|null, toCode: string, when: string, note: string|null }>}
 */
export function levelHistoryView(raw, levels = [], locale = 'es') {
  const codeOf = (id) => levels.find((l) => l.id === id)?.code ?? id;
  const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  return normalizeLevelHistory(raw)
    .map((e) => ({
      fromCode: e.from ? codeOf(e.from) : null,
      toCode: codeOf(e.to),
      when: fmt.format(new Date(e.at)),
      note: e.note,
    }))
    .toReversed();
}
