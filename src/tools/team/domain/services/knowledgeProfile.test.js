import { describe, it, expect } from 'vitest';
import { knowledgeProfile, knowledgeProfileFromAreas, SOLID_THRESHOLD } from './knowledgeProfile.js';

describe('knowledgeProfile (I/T/π/Comb)', () => {
  it('mapea el nº de áreas sólidas a la forma del perfil', () => {
    expect(knowledgeProfile(0).shape).toBeNull();
    expect(knowledgeProfile(1).shape).toBe('I');
    expect(knowledgeProfile(2).shape).toBe('I');
    expect(knowledgeProfile(3).shape).toBe('T');
    expect(knowledgeProfile(5).shape).toBe('T');
    expect(knowledgeProfile(6).shape).toBe('π');
    expect(knowledgeProfile(9).shape).toBe('π');
    expect(knowledgeProfile(10).shape).toBe('Comb');
  });

  it('cuenta como sólidas las áreas con nivel ≥ umbral', () => {
    const areas = [{ level: 5 }, { level: 6 }, { level: 4 }, { level: 7 }];
    const p = knowledgeProfileFromAreas(areas);
    expect(SOLID_THRESHOLD).toBe(5);
    expect(p.solidCount).toBe(3); // 5, 6, 7
    expect(p.shape).toBe('T');
  });

  it('es robusto ante entradas vacías', () => {
    expect(knowledgeProfileFromAreas([]).shape).toBeNull();
    expect(knowledgeProfileFromAreas(undefined).solidCount).toBe(0);
  });
});
