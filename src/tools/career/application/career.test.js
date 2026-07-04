import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryCareerStore } from '../infrastructure/memory/index.js';
import {
  getMaps,
  getMap,
  getIslandMap,
  getJourney,
  toggleVisited,
  setCurrent,
  setCurrentIsland,
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

  it('el journey arranca en la isla de inicio y los journeys legados también (MC-14)', async () => {
    const fresh = await getJourney(store, 'p1');
    expect(fresh.currentIsland).toBe('island');
    // Journey persistido ANTES del archipiélago (sin currentIsland): normaliza a 'island'.
    await store.journeys.save('p2', { visitedCities: ['git'], currentCity: 'git', plannedRoute: [], evidences: {} });
    const legacy = await getJourney(store, 'p2');
    expect(legacy.currentIsland).toBe('island');
    expect(legacy.visitedCities).toEqual(['git']);
  });

  it('setCurrentIsland persiste el viaje y no toca el resto del journey (MC-14)', async () => {
    const map = getIslandMap();
    let j = await getJourney(store, 'p1');
    j = await toggleVisited(store, 'p1', map, j, 'git');
    j = await setCurrentIsland(store, 'p1', j, 'frontend');
    expect(j.currentIsland).toBe('frontend');
    const saved = await getJourney(store, 'p1');
    expect(saved.currentIsland).toBe('frontend');
    expect(saved.visitedCities).toContain('git'); // el journey es GLOBAL: nada se pierde al zarpar
    // Destino vacío: error alto, sin fallbacks silenciosos.
    await expect(setCurrentIsland(store, 'p1', saved, '  ')).rejects.toThrow();
  });
});
