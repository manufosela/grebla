import { describe, it, expect } from 'vitest';
import { ENGINEERING_FRAMEWORK, seedFramework, normalizeFramework, serializeFramework } from './framework.js';

describe('career — framework de carrera (helpers puros)', () => {
  it('seedFramework devuelve una copia profunda del framework (fallback)', () => {
    const seed = seedFramework();
    expect(seed).toEqual(ENGINEERING_FRAMEWORK);
    expect(seed).not.toBe(ENGINEERING_FRAMEWORK);
    seed.tracks[0].name = 'cambiado';
    expect(ENGINEERING_FRAMEWORK.tracks[0].name).not.toBe('cambiado');
  });

  it('normalizeFramework(null|undefined) usa la semilla (documento inexistente)', () => {
    expect(normalizeFramework(null)).toEqual(ENGINEERING_FRAMEWORK);
    expect(normalizeFramework(undefined)).toEqual(ENGINEERING_FRAMEWORK);
  });

  it('normalizeFramework ordena cada catálogo por `order` y descarta ids vacíos', () => {
    const fw = normalizeFramework({
      name: 'Ingeniería',
      tracks: [
        { id: 'b', name: 'B', order: 2, description: '' },
        { id: 'a', name: 'A', order: 1, description: '' },
        { id: '', name: 'descartado', order: 3 },
      ],
      levels: [
        { id: 'x', code: 'X', title: 'X', trackId: 'a', order: 5, description: '', typicalProfile: '', branchesFrom: 'y' },
        { id: 'y', code: 'Y', title: 'Y', trackId: 'a', order: 1, description: '', typicalProfile: '', branchesFrom: '' },
      ],
      disciplines: [{ id: 'd', name: 'D', order: 1, description: '' }],
      dimensions: [{ id: 'm', name: 'M', order: 1, description: '' }],
    });
    expect(fw.id).toBe('engineering');
    expect(fw.name).toBe('Ingeniería');
    expect(fw.tracks.map((t) => t.id)).toEqual(['a', 'b']); // ordenado y sin el vacío
    expect(fw.levels.map((l) => l.id)).toEqual(['y', 'x']); // ordenado por order
    expect(fw.levels[0].branchesFrom).toBeNull(); // '' → null
    expect(fw.levels[1].branchesFrom).toBe('y');
  });

  it('normalizeFramework sanea tipos: order no numérico → 0, campos ausentes → string vacía', () => {
    const fw = normalizeFramework({
      tracks: [{ id: 't', name: 'T', order: 'x', description: 5 }],
      levels: [{ id: 'l', trackId: 't', order: undefined }],
      disciplines: [],
      dimensions: [],
    });
    expect(fw.tracks[0].order).toBe(0);
    expect(fw.tracks[0].description).toBe('5');
    expect(fw.levels[0]).toMatchObject({ id: 'l', code: '', title: '', order: 0, typicalProfile: '', branchesFrom: null });
    expect(fw.name).toBe(ENGINEERING_FRAMEWORK.name); // sin name en data → nombre de la semilla
  });

  it('serializeFramework es Firestore-safe (sin undefined) y respeta branchesFrom null', () => {
    const serialized = serializeFramework({
      id: 'engineering',
      name: 'Mi framework',
      tracks: [{ id: 'ic', name: 'IC', order: 1, description: 'desc' }, { id: '', name: 'x', order: 2, description: '' }],
      levels: [
        { id: 'l1', code: 'L1', title: 'Eng', trackId: 'ic', order: 1, description: 'd', typicalProfile: '2+', branchesFrom: undefined },
      ],
      disciplines: [],
      dimensions: [],
    });
    expect(serialized.name).toBe('Mi framework');
    expect(serialized.tracks).toEqual([{ id: 'ic', name: 'IC', order: 1, description: 'desc' }]); // descarta id vacío
    expect(serialized.levels[0].branchesFrom).toBeNull();
    expect('id' in serialized).toBe(false); // el id es el del documento
    // ningún valor undefined en el objeto serializado
    expect(JSON.stringify(serialized)).not.toContain('undefined');
  });

  it('normalize→serialize→normalize es estable (idempotente)', () => {
    const base = normalizeFramework(serializeFramework(seedFramework()));
    const round = normalizeFramework(serializeFramework(base));
    expect(round).toEqual(base);
  });
});
