import { describe, it, expect } from 'vitest';
import { createTeamContainer } from './container.js';

describe('createTeamContainer', () => {
  it('mode memory devuelve persistencia in-memory funcional', async () => {
    const { mode, persistence } = await createTeamContainer({ mode: 'memory' });
    expect(mode).toBe('memory');
    const id = await persistence.people.create({ name: 'X', guilds: ['BE'], startDate: '2025-01-01', active: true });
    expect((await persistence.people.getById(id)).name).toBe('X');
  });

  // El modo 'firestore' requiere un Firestore real (lee config para elegir el
  // adapter de ficheros); la forma del PersistencePort Firestore se valida en
  // infrastructure/firestore/firestore.test.js.

  it('modo desconocido lanza', async () => {
    await expect(createTeamContainer({ mode: 'nope' })).rejects.toThrow();
  });

  it('usa NullStorage por defecto (fileStorage OFF)', async () => {
    const { storage } = await createTeamContainer({ mode: 'memory' });
    expect(storage.enabled).toBe(false);
  });

  it('usa Firebase Storage cuando fileStorage está ON (storage inyectado)', async () => {
    const { storage } = await createTeamContainer({
      mode: 'memory',
      seed: { settings: { features: { fileStorage: true } } },
      storage: {},
    });
    expect(storage.enabled).toBe(true);
  });
});
