/**
 * Lecturas que no pueden venir de la copia local (RMR-BUG-0140): `getDocs` va al
 * servidor, pero si no llega se conforma con la caché del navegador SIN avisar.
 * Una lista de gestión (Bajas) tiene que ser la del servidor o fallar.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls = { getDocs: 0, getDocsFromServer: 0 };
vi.mock('firebase/firestore', async (importOriginal) => {
  const real = await importOriginal();
  const empty = { docs: [] };
  return {
    ...real,
    collection: () => ({}),
    query: () => ({}),
    where: () => ({}),
    getDocs: async () => { calls.getDocs += 1; return empty; },
    getDocsFromServer: async () => { calls.getDocsFromServer += 1; return empty; },
  };
});

const { createFirestorePersistence } = await import('./persistence.js');

describe('people.list({ fromServer })', () => {
  beforeEach(() => { calls.getDocs = 0; calls.getDocsFromServer = 0; });

  it('por defecto puede servir de la caché local (getDocs)', async () => {
    await createFirestorePersistence({}, 'l1', { viewAll: true }).people.list();
    expect(calls).toEqual({ getDocs: 1, getDocsFromServer: 0 });
  });

  it('con fromServer va SIEMPRE al servidor, en todos los alcances', async () => {
    await createFirestorePersistence({}, 'l1', { viewAll: true }).people.list({ fromServer: true });
    await createFirestorePersistence({}, 'l1', { leaderUids: ['a'] }).people.list({ fromServer: true });
    await createFirestorePersistence({}, 'l1').people.list({ fromServer: true });
    expect(calls).toEqual({ getDocs: 0, getDocsFromServer: 4 });
  });
});
