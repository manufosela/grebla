import { describe, it, expect } from 'vitest';
import { createFirestorePersistence } from './persistence.js';
import { DIMENSIONS } from '../../domain/types.js';

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
});
