import { describe, it, expect } from 'vitest';
import { createMemoryPeopleRepository } from './peopleRepository.js';

// Alcance de rama del supermanager (Head of X, RMR-TSK-0292): un tercer modo,
// además de «todas» (superadmin) y «las mías + compartidas» (líder). La rama son
// los EMs que le reportan; ve las personas cuyo ownerLeaderUid está en esa lista.
// Es por PROPIEDAD (no incluye compartidas desde fuera): así la consulta coincide
// con las reglas Firestore, que autorizan por `leaders/$(ownerLeaderUid).reportsTo`.
describe('People con alcance de rama (supermanager, memory)', () => {
  const seed = [
    { id: 'p1', name: 'De l1', ownerLeaderUid: 'l1' },
    { id: 'p2', name: 'De l2', ownerLeaderUid: 'l2' },
    { id: 'p3', name: 'De l3 (fuera de rama)', ownerLeaderUid: 'l3' },
    { id: 'p4', name: 'Compartida desde fuera con l1', ownerLeaderUid: 'l9', sharedWithUids: ['l1'] },
  ];

  it('un Head ve las personas de TODOS los EMs de su rama (unión por owner), no las de fuera', async () => {
    const repo = createMemoryPeopleRepository(seed, undefined, null, ['l1', 'l2']);
    const list = await repo.list();
    expect(list.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
  });

  it('la rama es por propiedad: excluye compartidas cuyo dueño está fuera (las reglas tampoco las autorizan)', async () => {
    const repo = createMemoryPeopleRepository(seed, undefined, null, ['l1']);
    const list = await repo.list();
    expect(list.map((p) => p.id)).toEqual(['p1']); // p4 (owner l9) NO entra
  });

  it('rama vacía (Head sin EMs) → no ve a nadie (estado seguro, no escala a ver todo)', async () => {
    const repo = createMemoryPeopleRepository(seed, undefined, null, []);
    expect((await repo.list()).length).toBe(0);
  });

  it('sin rama (null) mantiene la paridad: ve todas las personas', async () => {
    const repo = createMemoryPeopleRepository(seed);
    expect((await repo.list()).length).toBe(seed.length);
  });

  it('la rama tiene prioridad sobre viewerLeaderUid (un Head no queda limitado a su propio uid)', async () => {
    const repo = createMemoryPeopleRepository(seed, undefined, 'l1', ['l2']);
    const list = await repo.list();
    expect(list.map((p) => p.id)).toEqual(['p2']);
  });
});
