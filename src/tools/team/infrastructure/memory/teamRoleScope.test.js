import { describe, it, expect } from 'vitest';
import { createMemoryTeamRoleRepository } from './teamRoleRepository.js';

describe('TeamRole con ámbito personal/global (memory)', () => {
  it('list de un líder devuelve globales + propios, no los de otros', async () => {
    const repo = createMemoryTeamRoleRepository(
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

  it('create marca el rol como personal del líder que mira', async () => {
    const repo = createMemoryTeamRoleRepository([], 'l1');
    const id = await repo.create('Backend');
    const role = (await repo.list()).find((r) => r.id === id);
    expect(role.ownerLeaderUid).toBe('l1');
  });

  it('sin viewer, list devuelve todos y create crea global (sin owner)', async () => {
    const repo = createMemoryTeamRoleRepository([{ id: 'a', name: 'A', ownerLeaderUid: 'l1' }]);
    expect((await repo.list()).length).toBe(1);
    const id = await repo.create('Global');
    const g = (await repo.list()).find((r) => r.id === id);
    expect(g.ownerLeaderUid).toBeUndefined();
  });
});
