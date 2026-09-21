import { describe, it, expect } from 'vitest';
import {
  PROGRESS_THRESHOLDS, expectationWeight, levelCompletion,
  subLevelFromCompletion, levelProgressLabel, levelProgressFor,
} from './levelProgress.js';

/**
 * Progresión dentro del nivel por CUMPLIMIENTO de expectativas (RMR-PCS-0044).
 * El peso lo pone el framework y la valoración es binaria: lo que se discute es
 * si una expectativa está cubierta, nunca cuánto vale.
 */
const framework = {
  levels: [
    { id: 'l1', code: 'L1', trackId: 'ic', order: 1 },
    { id: 'l2', code: 'L2', trackId: 'ic', order: 2 },
    { id: 'l3', code: 'L3', trackId: 'ic', order: 3 },
    { id: 'l3em', code: 'L3EM', trackId: 'em', order: 3 },
  ],
  dimensions: [
    { id: 'tech', name: 'Técnica', order: 1 },
    { id: 'product', name: 'Producto', order: 2 },
    { id: 'execution', name: 'Ejecución', order: 3 },
    { id: 'culture', name: 'Cultura', order: 4 },
  ],
  expectations: [
    { levelId: 'l2', dimensionId: 'tech', text: 'Diseña un servicio', weight: 3, core: true },
    { levelId: 'l2', dimensionId: 'product', text: 'Discute el alcance', weight: 2 },
    { levelId: 'l2', dimensionId: 'execution', text: 'Entrega sin arrastrar', weight: 1 },
    { levelId: 'l2', dimensionId: 'culture', text: 'Acompaña a quien entra', weight: 4 },
  ],
};
const persona = { levelId: 'l1' };
/** Pesos: tech 3 · product 2 · execution 1 · culture 4 = 10. */
const marcas = (...cumplidas) => Object.fromEntries(cumplidas.map((d) => [d, true]));

describe('expectationWeight', () => {
  it('sin peso vale 1: el framework de hoy no los tiene y no se inventa nada', () => {
    expect([expectationWeight({}), expectationWeight({ weight: undefined })]).toEqual([1, 1]);
  });

  it('respeta el peso entero del framework y descarta lo que no es un peso', () => {
    expect(expectationWeight({ weight: 3 })).toBe(3);
    for (const malo of [0, -2, 1.5, '2', null, NaN]) expect(expectationWeight({ weight: malo })).toBe(1);
  });
});

describe('levelCompletion', () => {
  it('suma los pesos de lo cumplido sobre el total del nivel', () => {
    const c = levelCompletion(framework, 'l2', marcas('tech', 'product'));
    expect([c.earned, c.total, c.pct]).toEqual([5, 10, 50]);
  });

  it('lo que nadie ha valorado NO cumple: el nivel siguiente se gana, no se presupone', () => {
    const c = levelCompletion(framework, 'l2', {});
    expect([c.earned, c.pct]).toEqual([0, 0]);
    expect(c.missing.map((m) => m.id)).toEqual(['tech', 'product', 'execution', 'culture']);
  });

  it('una marca false pesa igual que una ausente, y lo demás sigue sumando', () => {
    const c = levelCompletion(framework, 'l2', { tech: false, culture: true });
    expect([c.earned, c.pct]).toEqual([4, 40]);
  });

  it('señala aparte las imprescindibles que faltan', () => {
    expect(levelCompletion(framework, 'l2', marcas('product', 'execution', 'culture')).coreMissing).toEqual(['tech']);
    expect(levelCompletion(framework, 'l2', marcas('tech')).coreMissing).toEqual([]);
  });

  it('las dimensiones sin expectativa en ese nivel no cuentan', () => {
    const parcial = { ...framework, expectations: framework.expectations.filter((e) => e.dimensionId !== 'culture') };
    const c = levelCompletion(parcial, 'l2', marcas('tech', 'product', 'execution'));
    expect([c.earned, c.total, c.pct]).toEqual([6, 6, 100]);
  });

  it('un nivel sin expectativas no se puede medir', () => {
    expect(levelCompletion(framework, 'l1', {})).toBeNull();
    expect(levelCompletion(null, 'l2', {})).toBeNull();
  });
});

describe('subLevelFromCompletion', () => {
  const con = (pct) => ({ pct });

  it('los cortes son 50 y 80', () => {
    expect(PROGRESS_THRESHOLDS).toEqual({ consolidating: 50, atTheGates: 80 });
    expect(subLevelFromCompletion(con(0), []).sub).toBe(1);
    expect(subLevelFromCompletion(con(49), []).sub).toBe(1);
    expect(subLevelFromCompletion(con(50), []).sub).toBe(2);
    expect(subLevelFromCompletion(con(79), []).sub).toBe(2);
  });

  it('el .3 exige el 80 % SOSTENIDO: con una sola valoración se queda en .2 y avisa', () => {
    const solo = subLevelFromCompletion(con(85), []);
    expect([solo.sub, solo.sustained, solo.pendingSub]).toEqual([2, false, 3]);
    const seguidas = subLevelFromCompletion(con(85), [con(80), con(20)]);
    expect([seguidas.sub, seguidas.sustained, seguidas.pendingSub]).toEqual([3, true, null]);
  });

  it('los cortes miran los PESOS, no el porcentaje redondeado: 99 de 200 es 49,5 % y no llega', () => {
    expect(subLevelFromCompletion({ earned: 99, total: 200, pct: 50 }, []).sub).toBe(1);
    expect(subLevelFromCompletion({ earned: 159, total: 200, pct: 80 }, []).sub).toBe(2);
    expect(subLevelFromCompletion({ earned: 160, total: 200, pct: 80 }, [{ earned: 160, total: 200 }]).sub).toBe(3);
  });

  it('una valoración anterior floja rompe el sostenido: cuenta la ÚLTIMA, no la mejor', () => {
    expect(subLevelFromCompletion(con(90), [con(40), con(95)]).sub).toBe(2);
  });

  it('bajar de umbral baja el sub-nivel: la progresión no es un trinquete', () => {
    expect(subLevelFromCompletion(con(30), [con(90), con(90)]).sub).toBe(1);
  });
});

describe('levelProgressLabel', () => {
  it('usa el guion de Mánu: L1-1, L1-2, L1-3', () => {
    expect([levelProgressLabel('L1', 1), levelProgressLabel('L1', 3)]).toEqual(['L1-1', 'L1-3']);
    expect(levelProgressLabel('', 2)).toBeNull();
  });
});

describe('levelProgressFor', () => {
  const llamar = (marks, history = []) => levelProgressFor({ person: persona, framework, marks, history });

  it('junta nivel, siguiente, porcentaje y sub-nivel en una sola lectura', () => {
    const p = llamar(marcas('tech', 'product'));
    expect(p).toMatchObject({
      levelId: 'l1', levelCode: 'L1', nextLevelId: 'l2', nextLevelCode: 'L2',
      sub: 2, label: 'L1-2', pct: 50, earned: 5, total: 10, readyToPromote: false,
    });
  });

  it('el 100 % propone subir ya; el .3, en cambio, espera a la segunda valoración', () => {
    const primera = llamar(marcas('tech', 'product', 'execution', 'culture'));
    expect([primera.pct, primera.readyToPromote, primera.sub, primera.pendingSub]).toEqual([100, true, 2, 3]);
    const firme = llamar(marcas('tech', 'product', 'execution', 'culture'), [{ pct: 100 }]);
    expect([firme.sub, firme.readyToPromote]).toEqual([3, true]);
  });

  it('un 99,5 % que se muestra como 100 no propone subir: falta lo que falta', () => {
    const gordo = {
      ...framework,
      expectations: [
        { levelId: 'l2', dimensionId: 'tech', text: 'Diseña un servicio', weight: 199 },
        { levelId: 'l2', dimensionId: 'product', text: 'Discute el alcance', weight: 1 },
      ],
    };
    const p = levelProgressFor({ person: persona, framework: gordo, marks: marcas('tech'), history: [{ pct: 100 }] });
    expect([p.pct, p.readyToPromote]).toEqual([100, false]);
  });

  it('con una imprescindible sin cubrir se dice cuál es, y no se propone subir', () => {
    const p = llamar(marcas('product', 'execution', 'culture'), [{ pct: 70 }]);
    expect([p.pct, p.coreMissing, p.readyToPromote]).toEqual([70, ['tech'], false]);
  });

  it('sin nivel, sin nivel siguiente o sin expectativas medibles, no hay veredicto', () => {
    expect(levelProgressFor({ person: {}, framework, marks: {} })).toBeNull();
    const ultimo = { ...persona, levelId: 'l3' };
    expect(levelProgressFor({ person: ultimo, framework, marks: {} })).toBeNull();
    const sinMatriz = { ...framework, expectations: [] };
    expect(levelProgressFor({ person: persona, framework: sinMatriz, marks: {} })).toBeNull();
  });

  it('el siguiente nivel es el de SU escalera: un IC no mide contra los EM', () => {
    const p = llamar(marcas('tech'));
    expect(p.nextLevelId).toBe('l2');
  });
});
