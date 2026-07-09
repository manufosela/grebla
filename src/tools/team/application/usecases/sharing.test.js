import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryPersistence, createMemoryPeopleRepository } from '../../infrastructure/memory/index.js';
import {
  addPerson, sharePerson, unsharePerson, transferOwnership, releaseOwnership,
} from './index.js';

describe('Fase 3b — compartir personas entre líderes', () => {
  /** @type {ReturnType<typeof createMemoryPersistence>} */
  let p;
  let id;
  beforeEach(async () => {
    p = createMemoryPersistence();
    id = await addPerson(p, { name: 'Ana', guilds: ['Backend'], startDate: '2025-01-01' });
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

  it('transferOwnership cambia el dueño y retira al nuevo dueño de sharedWith', async () => {
    const repo = createMemoryPeopleRepository(
      [
        {
          id: 'a',
          name: 'Ana',
          active: true,
          ownerLeaderUid: 'leader-1',
          sharedWith: { 'leader-2': 'view' },
          sharedWithUids: ['leader-2'],
        },
      ],
      () => '',
    );
    await transferOwnership({ people: repo }, 'a', 'leader-2');
    const person = await repo.getById('a');
    expect(person.ownerLeaderUid).toBe('leader-2');
    expect(person.sharedWith).toEqual({});
    expect(person.sharedWithUids).toEqual([]);
  });

  it('tras transferir, el dueño anterior deja de ver la persona', async () => {
    const repo = createMemoryPeopleRepository(
      [{ id: 'a', name: 'Ana', active: true, ownerLeaderUid: 'leader-1' }],
      () => '',
      'leader-1',
    );
    expect((await repo.list()).map((x) => x.name)).toEqual(['Ana']);
    await transferOwnership({ people: repo }, 'a', 'leader-2');
    expect((await repo.list()).map((x) => x.name)).toEqual([]);
  });

  it('transferOwnership exige el uid del nuevo líder', async () => {
    const repo = createMemoryPeopleRepository([{ id: 'a', name: 'Ana', active: true, ownerLeaderUid: 'l1' }], () => '');
    await expect(transferOwnership({ people: repo }, 'a', '')).rejects.toThrow(/requiere/);
  });

  it('releaseOwnership deja a la persona sin dueño (sin líder)', async () => {
    const repo = createMemoryPeopleRepository([{ id: 'a', name: 'Ana', active: true, ownerLeaderUid: 'leader-1' }], () => '');
    await releaseOwnership({ people: repo }, 'a');
    const person = await repo.getById('a');
    expect(person.ownerLeaderUid).toBeUndefined();
  });

  it('tras soltar, el líder anterior deja de ver la persona (pool del superadmin)', async () => {
    const repo = createMemoryPeopleRepository(
      [{ id: 'a', name: 'Ana', active: true, ownerLeaderUid: 'leader-1' }],
      () => '',
      'leader-1',
    );
    expect((await repo.list()).map((x) => x.name)).toEqual(['Ana']);
    await releaseOwnership({ people: repo }, 'a');
    expect((await repo.list()).map((x) => x.name)).toEqual([]);
  });
});
