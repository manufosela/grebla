/**
 * Sub-nivel (.1/.2/.3): piezas comunes. El CÁLCULO vive en levelProgress.js y sale
 * solo de las expectativas aceptadas; el mapa de carrera es formación y no mueve
 * el nivel (RMR-PCS-0044, RMR-TSK-0695). Aquí: el nivel siguiente, la etiqueta
 * «L1-2» y el ajuste manual del manager, que manda sobre el cálculo.
 */

/**
 * Siguiente nivel del MISMO track por `order`, o null si es el último (o el
 * nivel no existe). Los tracks no se cruzan: la progresión .x es dentro de tu
 * escalera.
 * @param {ReadonlyArray<{ id: string, trackId: string, order: number }>} levels
 * @param {string} levelId
 * @returns {{ id: string, code?: string } | null}
 */
export function nextLevelFor(levels, levelId) {
  const current = (levels ?? []).find((l) => l.id === levelId);
  if (!current) return null;
  return (
    (levels ?? [])
      .filter((l) => l.trackId === current.trackId && l.order > current.order)
      .toSorted((a, b) => a.order - b.order)
      .at(0) ?? null
  );
}

/**
 * Etiqueta del badge: código del nivel + sub («L1-2», la notación de Mánu).
 * Solo para vistas internas (ficha, listado del manager) — nunca para JDs.
 * @param {string} code @param {1|2|3} sub
 */
export function subLevelLabel(code, sub) {
  return `${code}-${sub}`;
}

/**
 * Sub-nivel EFECTIVO: el ajuste manual del manager (person.subLevelOverride,
 * F3) manda sobre el derivado — el juicio humano decide, el juego informa. El
 * override aplica incluso sin derivado (sin ruta publicada); uno inválido se
 * ignora. Sin código de nivel no hay etiqueta posible → null.
 * @param {{ subLevelOverride?: { value?: number, note?: string|null } | null }} person
 * @param {{ sub: 1|2|3, done: number, total: number, pct: number, label: string } | null} derived
 * @param {string|null} levelCode
 * @returns {{ sub: 1|2|3, done: number|null, total: number|null, pct: number|null, label: string, source: 'auto'|'manual', note: string|null } | null}
 */
export function effectiveSubLevel(person, derived, levelCode) {
  const override = person?.subLevelOverride;
  const value = Number(override?.value);
  if (override && [1, 2, 3].includes(value) && levelCode) {
    return {
      sub: /** @type {1|2|3} */ (value),
      done: derived?.done ?? null,
      total: derived?.total ?? null,
      pct: derived?.pct ?? null,
      label: subLevelLabel(levelCode, /** @type {1|2|3} */ (value)),
      source: 'manual',
      note: override.note ?? null,
    };
  }
  return derived ? { ...derived, source: 'auto', note: null } : null;
}
