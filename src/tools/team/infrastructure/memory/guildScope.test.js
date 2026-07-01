import { describe, it, expect } from 'vitest';
import { createMemoryGuildRepository } from './guildRepository.js';

describe('Guild con ámbito personal/global (memory)', () => {
  it('list de un líder devuelve globales + propios, no los de otros', async () => {
    const repo = createMemoryGuildRepository(
      [
        { id: 'g', name: 'Global' },
        { id: 'a', name: 'Mío', ownerLeaderUid: 'l1' },
        { id: 'b', name: 'De otro', ownerLeaderUid: 'l2' },
      ],
      'l1',
    );
    const list = await repo.list();
    expect(list.map((r) => r.name).sort()).toEqual(['Global', 'Mío']);
  });

  it('create marca el gremio como personal del líder que mira', async () => {
    const repo = createMemoryGuildRepository([], 'l1');
    const id = await repo.create('Python');
    const guild = (await repo.list()).find((r) => r.id === id);
    expect(guild.ownerLeaderUid).toBe('l1');
  });

  it('sin viewer, list devuelve todos y create crea global (sin owner)', async () => {
    const repo = createMemoryGuildRepository([{ id: 'a', name: 'A', ownerLeaderUid: 'l1' }]);
    expect((await repo.list()).length).toBe(1);
    const id = await repo.create('Global');
    const g = (await repo.list()).find((r) => r.id === id);
    expect(g.ownerLeaderUid).toBeUndefined();
  });
});
