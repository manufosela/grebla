import { describe, it, expect } from 'vitest';
import {
  PLAYTIME,
  accumulate,
  isActiveSample,
  dayKey,
  minutesFromMs,
  normalizePlaytime,
  playtimeSummary,
  staleDayKeys,
  formatPlayMinutes,
} from './playtime.js';

describe('accumulate (MC-23)', () => {
  it('suma deltas dentro de rango', () => {
    expect(accumulate(0, 5000)).toBe(5000);
    expect(accumulate(1200, 4800)).toBe(6000);
  });

  it('descarta deltas de timer suspendido (dt > 2 ticks) y deltas no positivos', () => {
    expect(accumulate(3000, PLAYTIME.tickMs * 2 + 1)).toBe(3000); // pestaña dormida
    expect(accumulate(3000, 0)).toBe(3000);
    expect(accumulate(3000, -50)).toBe(3000);
  });

  it('acepta un techo propio con opts.maxMs', () => {
    expect(accumulate(0, 15_000, { maxMs: 20_000 })).toBe(15_000);
    expect(accumulate(0, 25_000, { maxMs: 20_000 })).toBe(0);
  });

  it('falla en alto con entradas inválidas (sin fallbacks silenciosos)', () => {
    expect(() => accumulate(Number.NaN, 100)).toThrow();
    expect(() => accumulate(-1, 100)).toThrow();
    expect(() => accumulate(0, Number.NaN)).toThrow();
    expect(() => accumulate(0, 100, { maxMs: 0 })).toThrow();
  });
});

describe('isActiveSample (MC-23)', () => {
  it('activo solo con pestaña visible e interacción dentro de la ventana', () => {
    expect(isActiveSample(true, 1000, 1000 + PLAYTIME.idleMs)).toBe(true);
    expect(isActiveSample(true, 1000, 1000 + PLAYTIME.idleMs + 1)).toBe(false); // inactividad
    expect(isActiveSample(false, 1000, 2000)).toBe(false); // pestaña oculta
  });

  it('ventana de inactividad configurable y relojes inválidos → inactivo', () => {
    expect(isActiveSample(true, 0, 500, 400)).toBe(false);
    expect(isActiveSample(true, Number.NaN, 500)).toBe(false);
  });
});

describe('dayKey (MC-23)', () => {
  it('clave de día LOCAL con ceros a la izquierda', () => {
    expect(dayKey(new Date(2026, 6, 4, 23, 59))).toBe('2026-07-04');
    expect(dayKey(new Date(2026, 0, 9, 0, 0))).toBe('2026-01-09');
  });

  it('falla en alto con fechas inválidas', () => {
    expect(() => dayKey(new Date('nope'))).toThrow();
    expect(() => dayKey(/** @type {never} */ ('2026-07-04'))).toThrow();
  });
});

describe('minutesFromMs (MC-23)', () => {
  it('convierte a minutos con 2 decimales', () => {
    expect(minutesFromMs(60_000)).toBe(1);
    expect(minutesFromMs(90_000)).toBe(1.5);
    expect(minutesFromMs(61_000)).toBe(1.02);
    expect(minutesFromMs(0)).toBe(0);
  });

  it('falla en alto con entradas inválidas', () => {
    expect(() => minutesFromMs(-1)).toThrow();
    expect(() => minutesFromMs(Number.NaN)).toThrow();
  });
});

describe('normalizePlaytime (MC-23)', () => {
  it('sin documento devuelve el playtime vacío', () => {
    expect(normalizePlaytime(null)).toEqual({ totalMinutes: 0, byDay: {} });
    expect(normalizePlaytime(undefined)).toEqual({ totalMinutes: 0, byDay: {} });
  });

  it('sanea números corruptos y descarta claves que no son días', () => {
    const doc = {
      totalMinutes: /** @type {unknown} */ ('12'),
      byDay: { '2026-07-04': 10, 'no-es-dia': 5, '2026-07-03': Number.NaN, '2026-07-02': -3 },
    };
    expect(normalizePlaytime(/** @type {never} */ (doc))).toEqual({
      totalMinutes: 0,
      byDay: { '2026-07-04': 10, '2026-07-03': 0, '2026-07-02': 0 },
    });
  });
});

describe('playtimeSummary (MC-23)', () => {
  const now = new Date(2026, 6, 4, 12, 0); // 2026-07-04 local

  it('resume hoy, últimos 7 días (hoy incluido) y total', () => {
    const doc = {
      totalMinutes: 500,
      byDay: {
        '2026-07-04': 30, // hoy
        '2026-07-01': 20, // dentro de la ventana de 7 días
        '2026-06-28': 15, // hace 6 días: dentro
        '2026-06-27': 99, // hace 7 días: FUERA (la ventana son 7 claves)
      },
    };
    expect(playtimeSummary(doc, now)).toEqual({ today: 30, last7Days: 65, total: 500 });
  });

  it('sin datos devuelve ceros (jugador que aún no jugó)', () => {
    expect(playtimeSummary(null, now)).toEqual({ today: 0, last7Days: 0, total: 0 });
  });

  it('la ventana de 7 días cruza meses con aritmética de calendario', () => {
    const firstOfMonth = new Date(2026, 7, 2, 9, 0); // 2026-08-02
    const doc = { totalMinutes: 40, byDay: { '2026-07-28': 40 } }; // hace 5 días
    expect(playtimeSummary(doc, firstOfMonth).last7Days).toBe(40);
  });
});

describe('staleDayKeys (MC-23)', () => {
  /** @param {number} n @returns {Record<string, number>} n días consecutivos desde el 1 de enero. */
  const days = (n) =>
    Object.fromEntries(
      Array.from({ length: n }, (_, i) => {
        const d = new Date(2026, 0, 1 + i);
        return [dayKey(d), i + 1];
      }),
    );

  it('por debajo del umbral no poda (histéresis)', () => {
    expect(staleDayKeys(days(30))).toEqual([]);
    expect(staleDayKeys(days(PLAYTIME.pruneThreshold))).toEqual([]);
  });

  it('al superar el umbral devuelve las claves más antiguas dejando maxDays', () => {
    const byDay = days(PLAYTIME.pruneThreshold + 1); // 36 días
    const stale = staleDayKeys(byDay);
    expect(stale).toHaveLength(PLAYTIME.pruneThreshold + 1 - PLAYTIME.maxDays);
    expect(stale[0]).toBe('2026-01-01'); // la más vieja primero
    // Las claves conservadas son EXACTAMENTE las 30 más recientes: la más
    // vieja conservada va DESPUÉS de la más nueva podada.
    const kept = Object.keys(byDay)
      .filter((k) => !stale.includes(k))
      .toSorted();
    expect(kept).toHaveLength(PLAYTIME.maxDays);
    expect(kept.at(0) > stale.at(-1)).toBe(true);
  });

  it('el orden de inserción no importa: ordena por texto (cronológico)', () => {
    const byDay = days(40);
    const shuffled = Object.fromEntries(Object.entries(byDay).toReversed());
    expect(staleDayKeys(shuffled)).toEqual(staleDayKeys(byDay));
  });

  it('falla en alto con parámetros de poda inválidos', () => {
    expect(() => staleDayKeys({}, { maxDays: 0 })).toThrow();
    expect(() => staleDayKeys({}, { maxDays: 30, threshold: 20 })).toThrow();
  });
});

describe('formatPlayMinutes (MC-23)', () => {
  it('minutos hasta 1 hora, «H h M min» a partir de ahí', () => {
    expect(formatPlayMinutes(0)).toBe('0 min');
    expect(formatPlayMinutes(0.4)).toBe('<1 min');
    expect(formatPlayMinutes(12)).toBe('12 min');
    expect(formatPlayMinutes(59.4)).toBe('59 min');
    expect(formatPlayMinutes(60)).toBe('1 h');
    expect(formatPlayMinutes(125)).toBe('2 h 5 min');
    expect(formatPlayMinutes(180.2)).toBe('3 h');
  });

  it('devuelve null para valores no medibles (el llamador decide el texto)', () => {
    expect(formatPlayMinutes(null)).toBeNull();
    expect(formatPlayMinutes(undefined)).toBeNull();
    expect(formatPlayMinutes(Number.NaN)).toBeNull();
    expect(formatPlayMinutes(-5)).toBeNull();
  });
});
