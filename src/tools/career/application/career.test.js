import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryCareerStore } from '../infrastructure/memory/index.js';
import {
  getMaps,
  getMap,
  getIslandMap,
  getJourney,
  toggleVisited,
  setCurrent,
  toggleRoute,
  setEvidence,
  stats,
} from './usecases.js';

describe('career — casos de uso', () => {
  /** @type {ReturnType<typeof createMemoryCareerStore>} */
  let store;
  beforeEach(() => {
    store = createMemoryCareerStore();
  });

  it('hay un mapa de isla con comarcas y se obtiene por id', () => {
    expect(getMaps()).toHaveLength(1);
    const island = getMap('island');
    expect(island?.name).toBe('Isla GREBLA');
    expect(island?.areas.map((a) => a.id)).toEqual(['fundamentos', 'frontend', 'backend', 'data']);
    expect(island?.startPort).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
    expect(getIslandMap()).toBe(island);
    expect(getMap('nope')).toBeNull();
  });

  it('el journey de una persona nueva está vacío', async () => {
    const j = await getJourney(store, 'p1');
    expect(j).toMatchObject({ visitedCities: [], currentCity: null, plannedRoute: [], evidences: {} });
  });

  it('toggleVisited respeta los prerequisitos y actualiza el progreso', async () => {
    const map = getIslandMap();
    let j = await getJourney(store, 'p1');
    // 'js' requiere html y css → bloqueada al inicio
    await expect(toggleVisited(store, 'p1', map, j, 'js')).rejects.toThrow();
    j = await toggleVisited(store, 'p1', map, j, 'html');
    j = await toggleVisited(store, 'p1', map, j, 'css');
    j = await toggleVisited(store, 'p1', map, j, 'js'); // ya alcanzable
    expect(j.visitedCities).toContain('js');
    const s = stats(map, j);
    expect(s.points).toBeGreaterThan(0);
    expect(s.reachable).toContain('react'); // siguiente paso
  });

  it('una ciudad deprecada no se puede visitar', async () => {
    const map = getIslandMap();
    let j = await getJourney(store, 'p1');
    j = await toggleVisited(store, 'p1', map, j, 'html');
    j = await toggleVisited(store, 'p1', map, j, 'css');
    j = await toggleVisited(store, 'p1', map, j, 'js');
    // 'jquery' está deprecada → bloqueada aunque su prereq (js) esté visitado
    await expect(toggleVisited(store, 'p1', map, j, 'jquery')).rejects.toThrow();
  });

  it('setCurrent y toggleRoute persisten por persona', async () => {
    let j = await getJourney(store, 'p1');
    j = await setCurrent(store, 'p1', j, 'html');
    j = await toggleRoute(store, 'p1', j, 'arch-fe');
    const saved = await getJourney(store, 'p1');
    expect(saved.currentCity).toBe('html');
    expect(saved.plannedRoute).toContain('arch-fe');
    // toggleRoute de nuevo lo quita
    j = await toggleRoute(store, 'p1', saved, 'arch-fe');
    expect(j.plannedRoute).not.toContain('arch-fe');
  });

  it('setEvidence guarda evidencias por ciudad', async () => {
    let j = await getJourney(store, 'p1');
    j = await setEvidence(store, 'p1', j, 'js', { priorExperienceYears: 3, cursos: ['ES2025'] });
    const saved = await getJourney(store, 'p1');
    expect(saved.evidences.js).toMatchObject({ priorExperienceYears: 3, cursos: ['ES2025'] });
  });

  it('el journey es independiente entre personas', async () => {
    const map = getIslandMap();
    let j1 = await getJourney(store, 'p1');
    j1 = await toggleVisited(store, 'p1', map, j1, 'git');
    const j2 = await getJourney(store, 'p2');
    expect(j2.visitedCities).toEqual([]);
  });
});
