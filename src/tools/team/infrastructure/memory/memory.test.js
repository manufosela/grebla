import { describe, it, expect } from 'vitest';
import { DIMENSIONS, DEFAULT_SETTINGS } from '../../domain/types.js';
import {
  createMemoryPersistence,
  createMemoryPeopleRepository,
  createMemoryReadingRepository,
  createMemoryAreaRepository,
  createMemoryConversationRepository,
  createMemorySupportNoteRepository,
  createMemoryConfigRepository,
} from './index.js';

describe('memory PeopleRepository', () => {
  it('crea, lee, actualiza y desactiva sin borrar', async () => {
    const repo = createMemoryPeopleRepository();
    const id = await repo.create({ name: 'Ana', teamRole: 'Backend', startDate: '2025-01-01', active: true });
    expect(await repo.getById(id)).toMatchObject({ id, name: 'Ana', active: true });

    await repo.update(id, { teamRole: 'Fullstack' });
    expect((await repo.getById(id)).teamRole).toBe('Fullstack');

    await repo.deactivate(id);
    expect((await repo.getById(id)).active).toBe(false);
    expect(await repo.list()).toHaveLength(1); // sigue existiendo
  });

  it('getById devuelve null si no existe y update falla', async () => {
    const repo = createMemoryPeopleRepository();
    expect(await repo.getById('x')).toBeNull();
    await expect(repo.update('x', { name: 'Z' })).rejects.toThrow();
  });

  it('no expone referencias internas', async () => {
    const repo = createMemoryPeopleRepository();
    const id = await repo.create({ name: 'Ana', teamRole: 'BE', startDate: '2025-01-01', active: true });
    const a = await repo.getById(id);
    a.name = 'MUTADO';
    expect((await repo.getById(id)).name).toBe('Ana');
  });
});

describe('memory ReadingRepository', () => {
  it('histórico ascendente por fecha y latest = más reciente', async () => {
    const repo = createMemoryReadingRepository();
    await repo.add('p1', { level: 3, date: '2025-03-01' });
    await repo.add('p1', { level: 5, date: '2025-06-01' });
    await repo.add('p1', { level: 4, date: '2025-01-01' });

    const history = await repo.listByPerson('p1');
    expect(history.map((r) => r.date)).toEqual(['2025-01-01', '2025-03-01', '2025-06-01']);
    expect(history.every((r) => typeof r.id === 'string')).toBe(true);

    expect((await repo.latest('p1')).level).toBe(5);
  });

  it('latest null y listado vacío sin lecturas', async () => {
    const repo = createMemoryReadingRepository();
    expect(await repo.latest('nadie')).toBeNull();
    expect(await repo.listByPerson('nadie')).toEqual([]);
  });
});

describe('memory AreaRepository', () => {
  it('crea, lista y elimina', async () => {
    const repo = createMemoryAreaRepository();
    const id = await repo.create('Pagos');
    expect(await repo.list()).toEqual([{ id, name: 'Pagos' }]);
    await repo.remove(id);
    expect(await repo.list()).toEqual([]);
    await expect(repo.remove(id)).rejects.toThrow();
  });
});

describe('memory ConversationRepository', () => {
  it('crea, lista por fecha y actualiza', async () => {
    const repo = createMemoryConversationRepository();
    await repo.create('p1', { type: 'o2o', date: '2025-05-01', notes: 'a' });
    const id = await repo.create('p1', { type: 'catchup', date: '2025-02-01', notes: 'b' });
    const list = await repo.listByPerson('p1');
    expect(list.map((c) => c.date)).toEqual(['2025-02-01', '2025-05-01']);

    await repo.update('p1', id, { notes: 'editado' });
    expect((await repo.listByPerson('p1')).find((c) => c.id === id).notes).toBe('editado');
    await expect(repo.update('p1', 'noid', { notes: 'x' })).rejects.toThrow();
  });
});

describe('memory SupportNoteRepository (R5)', () => {
  it('crea con fecha sellada, lista y elimina', async () => {
    const repo = createMemorySupportNoteRepository(() => '2025-04-04T00:00:00.000Z');
    const id = await repo.create('p1', 'situación personal');
    const notes = await repo.listByPerson('p1');
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ id, text: 'situación personal', date: '2025-04-04T00:00:00.000Z' });
    expect(notes[0]).not.toHaveProperty('level'); // R5: sin nivel
    await repo.remove('p1', id);
    expect(await repo.listByPerson('p1')).toEqual([]);
  });
});

describe('memory ConfigRepository', () => {
  it('parte de DEFAULT_SETTINGS y mergea features en updates', async () => {
    const repo = createMemoryConfigRepository();
    expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS);
    await repo.updateSettings({ cadenceDays: 45, features: { fileStorage: true } });
    const s = await repo.getSettings();
    expect(s.cadenceDays).toBe(45);
    expect(s.busFactorMinLevel).toBe(DEFAULT_SETTINGS.busFactorMinLevel); // intacto
    expect(s.features.fileStorage).toBe(true);
  });
});

describe('createMemoryPersistence (PersistencePort)', () => {
  it('expone los repos y una lectura por cada dimensión', () => {
    const p = createMemoryPersistence();
    for (const key of ['people', 'readings', 'areas', 'conversations', 'supportNotes', 'config']) {
      expect(p).toHaveProperty(key);
    }
    for (const dim of DIMENSIONS) {
      expect(typeof p.readings[dim].add).toBe('function');
    }
  });

  it('las dimensiones son independientes (R1)', async () => {
    const p = createMemoryPersistence();
    await p.readings.seniority.add('p1', { level: 5, date: '2025-01-01' });
    expect(await p.readings.emotional.listByPerson('p1')).toEqual([]);
  });
});
