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

describe('careerStatus', () => {
  it('una persona externa no tiene plan de carrera que valorar', () => {
    const estado = careerStatus(framework, persona({ external: true }), { byDimension: {} });
    expect(estado.kind).toBe('external');
  });

  it('sin nivel asignado no hay nada contra lo que valorar', () => {
    expect(careerStatus(framework, persona({ levelId: null }), { byDimension: {} }).kind).toBe('no-level');
    expect(careerStatus(framework, persona({ levelId: '' }), null).kind).toBe('no-level');
  });

  it('un nivel que el framework ya no conoce se dice, no se disfraza de «sin nivel»', () => {
    const estado = careerStatus(framework, persona({ levelId: 'l-borrado' }), { byDimension: {} });
    expect(estado.kind).toBe('unknown-level');
    expect(estado.levelName).toBe('l-borrado');
  });

  it('sin valorar NO es «cumple todo»: la marca ausente vale true por defecto', () => {
    // Éste es el riesgo del dato: assessmentRows asume «cumple» mientras nadie
    // diga lo contrario, así que contar rojos sobre un documento vacío daría
    // cero y el Mapa afirmaría que la persona cumple sin que nadie la haya mirado.
    const estado = careerStatus(framework, persona(), { byDimension: {} });
    expect(estado.kind).toBe('unassessed');
    expect(estado.total).toBe(2);
    expect(estado.levelName).toBe('L3 · Mid');
  });

  it('valorada y sin rojos: cumple las expectativas de su nivel', () => {
    const assessment = { byDimension: { d1: { meets: true }, d2: { meets: true } } };
    const estado = careerStatus(framework, persona(), assessment);
    expect(estado).toMatchObject({ kind: 'meets', reds: 0, total: 2, levelName: 'L3 · Mid' });
  });

  it('valorada con rojos: cuenta cuántas expectativas no llega', () => {
    const assessment = { byDimension: { d1: { meets: false }, d2: { meets: true } } };
    const estado = careerStatus(framework, persona(), assessment);
    expect(estado).toMatchObject({ kind: 'gaps', reds: 1, total: 2 });
  });

  it('una valoración a medias ya cuenta como valorada', () => {
    // El líder marcó una dimensión y dejó la otra: eso es una valoración en
    // curso, no una persona sin mirar.
    const estado = careerStatus(framework, persona(), { byDimension: { d1: { meets: false } } });
    expect(estado).toMatchObject({ kind: 'gaps', reds: 1, total: 2 });
  });

  it('un nivel sin expectativas definidas no se puede valorar', () => {
    const estado = careerStatus(framework, persona({ levelId: 'l9' }), { byDimension: {} });
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
    const assessment = { byDimension: { d1: { meets: true }, d2: { meets: false } } };
    const estado = careerStatus(parcial, persona({ levelId: 'l2' }), assessment);
    expect(estado).toMatchObject({ kind: 'meets', reds: 0, total: 1 });
  });

  it('una marca de una dimensión que este nivel no valora no la da por valorada', () => {
    // Marca heredada de otro nivel: d2 no tiene expectativa en L2. Contarla
    // como valoración dejaría a d1 «cumplida por defecto» y el Mapa diría que
    // cumple sin que nadie haya mirado lo que sí se valora aquí.
    const parcial = {
      ...framework,
      expectations: [{ levelId: 'l2', dimensionId: 'd1', text: 'Resuelve con apoyo' }],
    };
    const estado = careerStatus(parcial, persona({ levelId: 'l2' }), { byDimension: { d2: { meets: true } } });
    expect(estado).toMatchObject({ kind: 'unassessed', total: 1 });
  });

  it('nombra el nivel como la ficha, y aguanta que falte el código o el título', () => {
    const raro = {
      ...framework,
      levels: [{ id: 'lc', code: 'L4', title: '', trackId: 'ic', order: 4 }],
      expectations: [{ levelId: 'lc', dimensionId: 'd1', text: 'algo' }],
    };
    const estado = careerStatus(raro, persona({ levelId: 'lc' }), { byDimension: {} });
    expect(estado.levelName).toBe('L4');
  });

  it('sin framework cargado no inventa un estado', () => {
    expect(careerStatus(null, persona(), { byDimension: {} }).kind).toBe('unknown-level');
  });
});
