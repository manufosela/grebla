import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryPersistence, createMemoryPeopleRepository } from '../../infrastructure/memory/index.js';
import { addPerson, sharePerson, unsharePerson } from './index.js';

describe('Fase 3b — compartir personas entre líderes', () => {
  /** @type {ReturnType<typeof createMemoryPersistence>} */
  let p;
  let id;
  beforeEach(async () => {
    p = createMemoryPersistence();
    id = await addPerson(p, { name: 'Ana', teamRole: 'Backend', startDate: '2025-01-01' });
  });

  it('sharePerson registra el permiso en sharedWith y su espejo sharedWithUids', async () => {
    await sharePerson(p, id, 'leader-2', 'edit');
    const person = await p.people.getById(id);
    expect(person.sharedWith).toEqual({ 'leader-2': 'edit' });
    expect(person.sharedWithUids).toEqual(['leader-2']);
  });

  it('unsharePerson elimina el permiso y actualiza el espejo', async () => {
    await sharePerson(p, id, 'leader-2', 'view');
    await sharePerson(p, id, 'leader-3', 'edit');
    await unsharePerson(p, id, 'leader-2');
    const person = await p.people.getById(id);
    expect(person.sharedWith).toEqual({ 'leader-3': 'edit' });
    expect(person.sharedWithUids).toEqual(['leader-3']);
  });

  it('sharePerson rechaza permisos inválidos', async () => {
    await expect(sharePerson(p, id, 'leader-2', 'owner')).rejects.toThrow(/inválido/);
  });

  it('sharePerson exige el uid del líder con quien compartir', async () => {
    await expect(sharePerson(p, id, '', 'view')).rejects.toThrow(/requiere/);
  });

  it('list de un líder devuelve sus personas y las compartidas con él (no las ajenas)', async () => {
    const repo = createMemoryPeopleRepository(
      [
        { id: 'a', name: 'Ana', active: true, ownerLeaderUid: 'leader-1' },
        {
          id: 'b',
          name: 'Beto',
          active: true,
          ownerLeaderUid: 'leader-2',
          sharedWith: { 'leader-1': 'view' },
          sharedWithUids: ['leader-1'],
        },
        { id: 'c', name: 'Caro', active: true, ownerLeaderUid: 'leader-2' },
      ],
      () => '',
      'leader-1',
    );
    const list = await repo.list();
    expect(list.map((x) => x.name).sort()).toEqual(['Ana', 'Beto']);
  });
});
