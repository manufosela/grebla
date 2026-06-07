import { describe, it, expect } from 'vitest';
import { createTeamContainer } from './container.js';

describe('createTeamContainer', () => {
  it('mode memory devuelve persistencia in-memory funcional', async () => {
    const { mode, persistence } = await createTeamContainer({ mode: 'memory' });
    expect(mode).toBe('memory');
    const id = await persistence.people.create({ name: 'X', teamRole: 'BE', startDate: '2025-01-01', active: true });
    expect((await persistence.people.getById(id)).name).toBe('X');
  });

  it('mode firestore con db y ownerId inyectados no inicializa Firebase', async () => {
    const { mode, persistence } = await createTeamContainer({ mode: 'firestore', db: {}, ownerId: 'o1' });
    expect(mode).toBe('firestore');
    expect(typeof persistence.people.list).toBe('function');
  });

  it('modo desconocido lanza', async () => {
    await expect(createTeamContainer({ mode: 'nope' })).rejects.toThrow();
  });
});
