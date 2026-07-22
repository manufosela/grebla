import { describe, it, expect } from 'vitest';
import { createFirestorePersistence, chunk } from './persistence.js';
import { DIMENSIONS } from '../../domain/types.js';

describe('chunk (troceo para el operador `in` de Firestore)', () => {
  it('trocea en lotes de como mucho 30 (límite de Firestore para `in`)', () => {
    const values = Array.from({ length: 65 }, (_, i) => `l${i}`);
    const batches = chunk(values);
    expect(batches.map((b) => b.length)).toEqual([30, 30, 5]);
    expect(batches.flat()).toEqual(values);
  });

  it('deduplica y descarta vacíos antes de trocear (no repite consultas)', () => {
    expect(chunk(['a', 'a', '', null, 'b'])).toEqual([['a', 'b']]);
  });

  it('lista vacía o ausente → sin lotes', () => {
    expect(chunk([])).toEqual([]);
    expect(chunk(undefined)).toEqual([]);
  });
});

describe('Firestore persistence (forma del puerto)', () => {
  it('expone el PersistencePort completo con db inyectado', () => {
    // db falso: la construcción no invoca a Firestore (closures perezosos).
    const p = createFirestorePersistence({}, 'leader1');
    expect(typeof p.people.list).toBe('function');
    expect(typeof p.people.deactivate).toBe('function');
    expect(typeof p.areas.create).toBe('function');
    expect(typeof p.conversations.create).toBe('function');
    expect(typeof p.supportNotes.create).toBe('function');
    expect(typeof p.config.getSettings).toBe('function');
    for (const dim of DIMENSIONS) {
      expect(typeof p.readings[dim].add).toBe('function');
      expect(typeof p.readings[dim].latest).toBe('function');
    }
  });

  it('exige db y leaderUid (sin fallbacks silenciosos)', () => {
    expect(() => createFirestorePersistence(null, 'l1')).toThrow();
    expect(() => createFirestorePersistence({}, '')).toThrow();
  });

  it('acepta leaderUids (alcance de rama del supermanager) sin romper la forma del puerto', () => {
    const p = createFirestorePersistence({}, 'head1', { leaderUids: ['l1', 'l2'] });
    expect(typeof p.people.list).toBe('function');
  });
});
