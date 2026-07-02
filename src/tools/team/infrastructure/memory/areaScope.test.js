import { describe, it, expect } from 'vitest';
import { createMemoryAreaRepository } from './areaRepository.js';

describe('Area con ámbito personal/global (memory)', () => {
  it('list de un líder devuelve globales + propias, no las de otros', async () => {
    const repo = createMemoryAreaRepository(
      [
        { id: 'g', name: 'Global' },
        { id: 'a', name: 'Mía', ownerLeaderUid: 'l1' },
        { id: 'b', name: 'De otro', ownerLeaderUid: 'l2' },
      ],
      'l1',
    );
    const list = await repo.list();
    expect(list.map((a) => a.name).sort()).toEqual(['Global', 'Mía']);
  });

  it('create marca el área como personal del líder que mira', async () => {
    const repo = createMemoryAreaRepository([], 'l1');
    const id = await repo.create('Pagos');
    const area = (await repo.list()).find((a) => a.id === id);
    expect(area.ownerLeaderUid).toBe('l1');
  });

  it('sin viewer, list devuelve todas y create crea global (sin owner)', async () => {
    const repo = createMemoryAreaRepository([{ id: 'a', name: 'A', ownerLeaderUid: 'l1' }]);
    expect((await repo.list()).length).toBe(1);
    const id = await repo.create('Global');
    const a = (await repo.list()).find((r) => r.id === id);
    expect(a.ownerLeaderUid).toBeUndefined();
  });
});
