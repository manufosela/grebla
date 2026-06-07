import { describe, it, expect } from 'vitest';
import { createNullStorageAdapter } from './nullStorage.js';
import { createFirebaseStorageAdapter } from './firebaseStorage.js';

describe('NullStorageAdapter (default del MVP)', () => {
  it('enabled=false; put lanza; getUrl devuelve la ref; remove es no-op', async () => {
    const s = createNullStorageAdapter();
    expect(s.enabled).toBe(false);
    await expect(s.put(new Blob(['x']), {})).rejects.toThrow();
    expect(await s.getUrl('https://ext.example/audio.mp3')).toBe('https://ext.example/audio.mp3');
    await expect(s.remove('x')).resolves.toBeUndefined();
  });
});

describe('FirebaseStorageAdapter (forma)', () => {
  it('enabled=true y expone put/getUrl/remove', () => {
    const s = createFirebaseStorageAdapter({});
    expect(s.enabled).toBe(true);
    for (const m of ['put', 'getUrl', 'remove']) expect(typeof s[m]).toBe('function');
  });
  it('exige una instancia de storage', () => {
    expect(() => createFirebaseStorageAdapter(null)).toThrow();
  });
});
