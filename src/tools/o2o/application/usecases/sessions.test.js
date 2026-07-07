import { describe, it, expect } from 'vitest';
import { createMemoryO2O } from '../../infrastructure/memory/index.js';
import {
  listSessions, listAllSessions, getSession, createSession, updateSession, removeSession,
} from './sessions.js';

const persistence = () => createMemoryO2O();

describe('o2o sessions usecases', () => {
  it('crea una sesión con persona y fecha, y la lista por persona', async () => {
    const p = persistence();
    const id = await createSession(p, { personId: 'ana', date: '2026-07-01', summary: 'ok' });
    expect(typeof id).toBe('string');
    const list = await listSessions(p, 'ana');
    expect(list).toHaveLength(1);
    expect(list[0].createdAt).toBeTruthy();
    expect(list[0].sharedWithPerson).toBe(false);
  });

  it('exige persona y fecha', async () => {
    const p = persistence();
    await expect(createSession(p, { date: '2026-07-01' })).rejects.toThrow(/persona/i);
    await expect(createSession(p, { personId: 'ana' })).rejects.toThrow(/fecha/i);
  });

  it('lista por persona, ordenada por fecha descendente, sin mezclar personas', async () => {
    const p = persistence();
    await createSession(p, { personId: 'ana', date: '2026-06-01' });
    await createSession(p, { personId: 'ana', date: '2026-07-01' });
    await createSession(p, { personId: 'leo', date: '2026-07-15' });
    const ana = await listSessions(p, 'ana');
    expect(ana.map((s) => s.date)).toEqual(['2026-07-01', '2026-06-01']);
    expect(await listSessions(p, 'leo')).toHaveLength(1);
    expect(await listAllSessions(p)).toHaveLength(3);
  });

  it('actualiza (sella updatedAt) y borra', async () => {
    const p = persistence();
    const id = await createSession(p, { personId: 'ana', date: '2026-07-01' });
    await updateSession(p, id, { summary: 'editado', sharedWithPerson: true });
    const s = await getSession(p, id);
    expect(s.summary).toBe('editado');
    expect(s.sharedWithPerson).toBe(true);
    expect(s.updatedAt).toBeTruthy();
    await removeSession(p, id);
    expect(await getSession(p, id)).toBeNull();
  });

  it('normaliza answers a array y por defecto vacío', async () => {
    const p = persistence();
    const id = await createSession(p, {
      personId: 'ana', date: '2026-07-01',
      answers: [{ questionId: 'b1-q1', answer: 'sí' }],
    });
    expect((await getSession(p, id)).answers).toEqual([{ questionId: 'b1-q1', answer: 'sí' }]);
    const id2 = await createSession(p, { personId: 'leo', date: '2026-07-02' });
    expect((await getSession(p, id2)).answers).toEqual([]);
  });
});
