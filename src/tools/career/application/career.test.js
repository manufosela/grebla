import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryCareerStore } from '../infrastructure/memory/index.js';
import { getMaps, getMap, getJourney, startMap, toggleVisited, setTarget, stats } from './usecases.js';

describe('career — casos de uso', () => {
  /** @type {ReturnType<typeof createMemoryCareerStore>} */
  let store;
  beforeEach(() => {
    store = createMemoryCareerStore();
  });

  it('hay mapas de muestra y se obtienen por id', () => {
    expect(getMaps().length).toBeGreaterThanOrEqual(2);
    expect(getMap('frontend')?.name).toBe('Frontend');
    expect(getMap('nope')).toBeNull();
  });

  it('startMap inicia el journey vacío y persiste', async () => {
    await startMap(store, 'u1', 'frontend');
    const j = await getJourney(store, 'u1');
    expect(j).toMatchObject({ mapId: 'frontend', visited: [], current: null, target: null });
  });

  it('toggleVisited respeta los prerequisitos y actualiza el progreso', async () => {
    const map = getMap('frontend');
    let j = await startMap(store, 'u1', 'frontend');
    // 'js' requiere html y css → bloqueada al inicio
    await expect(toggleVisited(store, 'u1', map, j, 'js')).rejects.toThrow();
    j = await toggleVisited(store, 'u1', map, j, 'html');
    j = await toggleVisited(store, 'u1', map, j, 'css');
    j = await toggleVisited(store, 'u1', map, j, 'js'); // ya alcanzable
    expect(j.visited).toContain('js');
    const s = stats(map, j);
    expect(s.points).toBeGreaterThan(0);
    expect(s.reachable).toContain('react'); // siguiente paso
  });

  it('setTarget guarda el objetivo', async () => {
    let j = await startMap(store, 'u1', 'frontend');
    j = await setTarget(store, 'u1', j, 'arch');
    expect((await getJourney(store, 'u1')).target).toBe('arch');
  });
});
