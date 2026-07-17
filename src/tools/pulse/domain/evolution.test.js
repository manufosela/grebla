import { describe, it, expect } from 'vitest';
import { weeklyMeans, netTrend, trendSentiment } from './evolution.js';

describe('weeklyMeans', () => {
  it('agrupa por semana ISO y promedia cada dimensión (redondeando)', () => {
    const entries = [
      { weekIso: '2026-W02', energia: 60, animo: 40, carga: 50, rumbo: 50, tripulacion: 50, reconocimiento: 50 },
      { weekIso: '2026-W02', energia: 80, animo: 60, carga: 70, rumbo: 50, tripulacion: 50, reconocimiento: 50 },
      { weekIso: '2026-W01', energia: 30, animo: 30, carga: 20, rumbo: 40, tripulacion: 40, reconocimiento: 40 },
    ];
    const weeks = weeklyMeans(entries);
    expect(weeks.map((w) => w.weekIso)).toEqual(['2026-W01', '2026-W02']); // orden ascendente
    expect(weeks[1].count).toBe(2);
    expect(weeks[1].means.energia).toBe(70); // (60+80)/2
    expect(weeks[1].means.animo).toBe(50); // (40+60)/2
  });

  it('ignora entradas sin weekIso y trata dims ausentes como 0', () => {
    const weeks = weeklyMeans([
      { weekIso: '2026-W05', energia: 50 },
      { energia: 99 }, // sin weekIso → se ignora
      {},
    ]);
    expect(weeks).toHaveLength(1);
    expect(weeks[0].means.animo).toBe(0);
  });

  it('ordena correctamente cruzando el cambio de año', () => {
    const weeks = weeklyMeans([
      { weekIso: '2026-W01', energia: 10 },
      { weekIso: '2025-W52', energia: 20 },
    ]);
    expect(weeks.map((w) => w.weekIso)).toEqual(['2025-W52', '2026-W01']);
  });

  it('sin entradas devuelve lista vacía', () => {
    expect(weeklyMeans()).toEqual([]);
  });
});

describe('netTrend', () => {
  it('con menos de dos puntos es estable', () => {
    expect(netTrend([50])).toEqual({ delta: 0, dir: 'flat' });
    expect(netTrend([])).toEqual({ delta: 0, dir: 'flat' });
  });

  it('detecta subida, bajada y estabilidad según el umbral', () => {
    expect(netTrend([40, 60]).dir).toBe('up'); // +20
    expect(netTrend([70, 50]).dir).toBe('down'); // -20
    expect(netTrend([50, 54]).dir).toBe('flat'); // +4 < 8
  });

  it('compara el último con el primero, no los intermedios', () => {
    expect(netTrend([50, 90, 55])).toEqual({ delta: 5, dir: 'flat' });
    expect(netTrend([30, 10, 80])).toEqual({ delta: 50, dir: 'up' });
  });
});

describe('trendSentiment', () => {
  it('en dimensiones normales subir es mejorar', () => {
    expect(trendSentiment('up')).toBe('better');
    expect(trendSentiment('down')).toBe('worse');
    expect(trendSentiment('flat')).toBe('steady');
  });

  it('en carga (warnHigh) subir es empeorar', () => {
    expect(trendSentiment('up', true)).toBe('worse');
    expect(trendSentiment('down', true)).toBe('better');
    expect(trendSentiment('flat', true)).toBe('steady');
  });
});
