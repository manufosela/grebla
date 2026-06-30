import { describe, it, expect } from 'vitest';
import { createMemoryLabelRepository } from './labelRepository.js';

describe('Label con ámbito personal/global (memory)', () => {
  it('list de un líder devuelve globales + propios, no los de otros', async () => {
    const repo = createMemoryLabelRepository(
      [
        { id: 'g', name: 'Plataforma' },
        { id: 'a', name: 'Mi gremio', ownerLeaderUid: 'l1' },
        { id: 'b', name: 'De otro', ownerLeaderUid: 'l2' },
      ],
      'l1',
    );
    const list = await repo.list();
    expect(list.map((l) => l.name).sort()).toEqual(['Mi gremio', 'Plataforma']);
  });

  it('create marca el label como personal del líder que mira', async () => {
    const repo = createMemoryLabelRepository([], 'l1');
    const id = await repo.create('Frontend');
    const label = (await repo.list()).find((l) => l.id === id);
    expect(label.ownerLeaderUid).toBe('l1');
  });
});
