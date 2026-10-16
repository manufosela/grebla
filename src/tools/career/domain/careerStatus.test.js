import { describe, it, expect } from 'vitest';
import { careerStatus } from './careerStatus.js';

/** Framework mínimo: dos dimensiones y dos niveles con expectativas. */
const framework = {
  name: 'Test',
  tracks: [],
  disciplines: [],
  levels: [
    { id: 'l2', code: 'L2', title: 'Junior', trackId: 'ic', order: 2 },
    { id: 'l3', code: 'L3', title: 'Mid', trackId: 'ic', order: 3 },
    { id: 'l9', code: 'L9', title: 'Sin expectativas', trackId: 'ic', order: 9 },
  ],
  dimensions: [
    { id: 'd1', name: 'Autonomía', order: 1 },
    { id: 'd2', name: 'Impacto', order: 2 },
  ],
  expectations: [
    { levelId: 'l2', dimensionId: 'd1', text: 'Resuelve con apoyo' },
    { levelId: 'l2', dimensionId: 'd2', text: 'Impacto en su tarea' },
    { levelId: 'l3', dimensionId: 'd1', text: 'Resuelve sola' },
    { levelId: 'l3', dimensionId: 'd2', text: 'Impacto en el equipo' },
  ],
  addendums: [],
};

const persona = (extra = {}) => ({ id: 'p1', name: 'Persona', levelId: 'l3', ...extra });
const entry = (dimensionId, kind, day, levelId = 'l3') => ({ levelId, dimensionId, kind, text: kind, links: [],
  by: { uid: 'em', name: 'EM' }, at: `${day}T09:00:00.000Z` });

describe('careerStatus', () => {
  it('una persona externa no tiene plan de carrera que valorar', () => {
    const estado = careerStatus(framework, persona({ external: true }), []);
    expect(estado.kind).toBe('external');
  });

  it('sin nivel asignado no hay nada contra lo que valorar', () => {
    expect(careerStatus(framework, persona({ levelId: null }), []).kind).toBe('no-level');
    expect(careerStatus(framework, persona({ levelId: '' }), null).kind).toBe('no-level');
  });

  it('un nivel que el framework ya no conoce se dice, no se disfraza de «sin nivel»', () => {
    const estado = careerStatus(framework, persona({ levelId: 'l-borrado' }), []);
    expect(estado.kind).toBe('unknown-level');
    expect(estado.levelName).toBe('l-borrado');
  });

  it('el nivel actual cumple por defecto, como en la ficha (RMR-TSK-0731)', () => {
    const estado = careerStatus(framework, persona(), []);
    expect(estado).toMatchObject({ kind: 'meets', reds: 0, total: 2, levelName: 'L3 · Mid' });
  });

  it('cuenta los «no llega» según la ÚLTIMA entrada con estado de cada expectativa', () => {
    const entries = [
      entry('d1', 'misses', '2026-10-01'), entry('d1', 'meets', '2026-10-10'),
      entry('d2', 'misses', '2026-10-05'), entry('d2', 'proof', '2026-10-12'),
    ];
    expect(careerStatus(framework, persona(), entries)).toMatchObject({ kind: 'gaps', reds: 1, total: 2 });
  });

  it('lo de otro nivel no cuenta en el suyo', () => {
    expect(careerStatus(framework, persona(), [entry('d1', 'misses', '2026-10-01', 'l2')]).kind).toBe('meets');
  });

  it('con subnivel, el nivel se nombra como la cabecera de la ficha', () => {
    expect(careerStatus(framework, persona(), [], { label: 'L3-2' }).levelName).toBe('L3-2 · Mid');
  });

  it('un nivel sin expectativas definidas no se puede valorar', () => {
    const estado = careerStatus(framework, persona({ levelId: 'l9' }), []);
    expect(estado.kind).toBe('no-expectations');
    expect(estado.levelName).toBe('L9 · Sin expectativas');
  });

  it('las dimensiones sin expectativa escrita no cuentan en el total', () => {
    // El framework tiene dos dimensiones, pero en L2 solo una tiene texto: la
    // celda vacía no es algo que se cumpla o se deje de cumplir.
    const parcial = {
      ...framework,
      expectations: [{ levelId: 'l2', dimensionId: 'd1', text: 'Resuelve con apoyo' }],
    };
    const estado = careerStatus(parcial, persona({ levelId: 'l2' }), [entry('d2', 'misses', '2026-10-01', 'l2')]);
    expect(estado).toMatchObject({ kind: 'meets', reds: 0, total: 1 });
  });

  it('nombra el nivel como la ficha, y aguanta que falte el código o el título', () => {
    const raro = {
      ...framework,
      levels: [{ id: 'lc', code: 'L4', title: '', trackId: 'ic', order: 4 }],
      expectations: [{ levelId: 'lc', dimensionId: 'd1', text: 'algo' }],
    };
    const estado = careerStatus(raro, persona({ levelId: 'lc' }), []);
    expect(estado.levelName).toBe('L4');
  });

  it('sin framework cargado no inventa un estado', () => {
    expect(careerStatus(null, persona(), []).kind).toBe('unknown-level');
  });
});
