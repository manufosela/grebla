import { describe, it, expect } from 'vitest';
import { createMemoryDoraPersistence } from './index.js';

describe('DORA repos con ámbito personal/global (memory)', () => {
  it('list de un líder devuelve globales + propios, no los de otros', async () => {
    const p = createMemoryDoraPersistence(
      [
        { id: 'g', fullName: 'org/global' }, // sin owner → global
        { id: 'a', fullName: 'org/mio', ownerLeaderUid: 'l1' },
        { id: 'b', fullName: 'org/otro', ownerLeaderUid: 'l2' },
      ],
      { leaderUid: 'l1' },
    );
    const list = await p.repos.list();
    expect(list.map((r) => r.fullName).sort()).toEqual(['org/global', 'org/mio']);
  });

  it('el superadmin (viewAll) ve todos y crea a nivel global (sin owner)', async () => {
    const p = createMemoryDoraPersistence([{ id: 'x', fullName: 'org/x', ownerLeaderUid: 'l2' }], {
      leaderUid: 'super',
      viewAll: true,
    });
    expect((await p.repos.list()).length).toBe(1); // ve el de otro líder
    const id = await p.repos.add({ fullName: 'org/nuevo' });
    const created = (await p.repos.list()).find((r) => r.id === id);
    expect(created.ownerLeaderUid).toBeUndefined(); // global
  });

  it('el líder crea el repo como personal suyo', async () => {
    const p = createMemoryDoraPersistence([], { leaderUid: 'l1' });
    const id = await p.repos.add({ fullName: 'org/mio' });
    const created = (await p.repos.list()).find((r) => r.id === id);
    expect(created.ownerLeaderUid).toBe('l1');
  });
});
