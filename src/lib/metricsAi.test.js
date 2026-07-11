import { describe, it, expect } from 'vitest';
import { withMeta } from './metricsAi.js';

describe('withMeta', () => {
  it('sanea el núcleo y conserva fecha y autor', () => {
    const r = withMeta({
      verdict: 'mal',
      summary: '  Atascos  ',
      causes: ['WIP alto', ''],
      recommendations: ['Baja el WIP'],
      at: '2026-07-11T10:00:00Z',
      by: { uid: 'u1', name: 'Jefa' },
    });
    expect(r.verdict).toBe('mal');
    expect(r.summary).toBe('Atascos');
    expect(r.causes).toEqual(['WIP alto']);
    expect(r.at).toBe('2026-07-11T10:00:00Z');
    expect(r.by).toEqual({ uid: 'u1', name: 'Jefa' });
  });

  it('sin metadata → at y by en null (y núcleo saneado)', () => {
    const r = withMeta({ verdict: 'bien', summary: 'OK', causes: [], recommendations: [] });
    expect(r.at).toBeNull();
    expect(r.by).toBeNull();
    expect(r.verdict).toBe('bien');
  });

  it('tolera basura sin lanzar', () => {
    const r = withMeta(null);
    expect(r.verdict).toBe('regular'); // sanitize da el default
    expect(r.at).toBeNull();
    expect(r.by).toBeNull();
  });
});
