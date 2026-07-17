import { describe, it, expect } from 'vitest';
import { teamSignals } from './trends.js';

/** Semana con medias base 55 y overrides. */
const W = (over = {}, meta = {}) => ({
  weekIso: over.weekIso ?? 'W',
  means: { energia: 55, animo: 55, carga: 50, rumbo: 55, tripulacion: 55, reconocimiento: 55, ...over.means },
  respondents: meta.respondents ?? 8,
  totalPeople: meta.totalPeople ?? 10,
});

const keys = (signals) => signals.map((s) => s.key);

describe('teamSignals', () => {
  it('sin semanas no hay señales', () => {
    expect(teamSignals()).toEqual([]);
    expect(teamSignals([])).toEqual([]);
  });

  it('carga al alza sostenida (3 semanas crecientes) dispara señal de carga', () => {
    const s = teamSignals([
      W({ means: { carga: 40 } }), W({ means: { carga: 55 } }), W({ means: { carga: 70 } }),
    ]);
    expect(keys(s)).toContain('carga-alza');
  });

  it('carga estable no dispara señal de carga', () => {
    const s = teamSignals([W({ means: { carga: 50 } }), W({ means: { carga: 52 } }), W({ means: { carga: 51 } })]);
    expect(keys(s)).not.toContain('carga-alza');
  });

  it('ánimo cayendo −12 o más en 3 semanas dispara señal', () => {
    const s = teamSignals([W({ means: { animo: 65 } }), W({ means: { animo: 58 } }), W({ means: { animo: 50 } })]);
    expect(keys(s)).toContain('animo-baja');
  });

  it('reconocimiento y rumbo bajos sostenidos (2 semanas < 45) disparan señales', () => {
    const s = teamSignals([
      W({ means: { reconocimiento: 40, rumbo: 42 } }),
      W({ means: { reconocimiento: 38, rumbo: 40 } }),
    ]);
    expect(keys(s)).toEqual(expect.arrayContaining(['reconocimiento-bajo', 'rumbo-bajo']));
  });

  it('buen momento (energía y ánimo ≥ 60, ánimo no baja) da señal positiva', () => {
    const s = teamSignals([W({ means: { energia: 62, animo: 60 } }), W({ means: { energia: 68, animo: 66 } })]);
    expect(keys(s)).toContain('buen-momento');
    expect(s.find((x) => x.key === 'buen-momento').level).toBe('good');
  });

  it('participación baja (<40%) da señal informativa', () => {
    const s = teamSignals([W({}, { respondents: 3, totalPeople: 10 })]);
    expect(keys(s)).toContain('participacion-baja');
    expect(s.find((x) => x.key === 'participacion-baja').level).toBe('info');
  });

  it('ordena las señales: warn antes que good antes que info', () => {
    const s = teamSignals([
      W({ means: { energia: 62, animo: 62, carga: 40 } }, { respondents: 3, totalPeople: 10 }),
      W({ means: { energia: 66, animo: 66, carga: 55 } }, { respondents: 3, totalPeople: 10 }),
      W({ means: { energia: 66, animo: 66, carga: 70 } }, { respondents: 3, totalPeople: 10 }),
    ]);
    const levels = s.map((x) => x.level);
    const sorted = [...levels].sort((a, b) => ({ warn: 0, good: 1, info: 2 }[a] - { warn: 0, good: 1, info: 2 }[b]));
    expect(levels).toEqual(sorted);
  });
});
