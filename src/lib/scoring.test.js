import { describe, it, expect } from 'vitest';
import {
  normalizeAnswer,
  isNotApplicable,
  isAnswered,
  computeProfile,
  computeCompletion,
  computeDimensionLevels,
} from './scoring.js';

const multiItem = {
  id: 'm1',
  dimension: 'architecture',
  type: 'multi',
  options: [{ value: 'a' }, { value: 'b' }, { value: 'na' }],
  weights: { em: 2 },
};
const scaleItem = { id: 's1', dimension: 'people', type: 'scale', weights: { em: 2 } };
const roles = [{ key: 'em', label: 'EM', short: 'EM', color: '#000', tagline: '' }];

describe('normalizeAnswer (multi binario)', () => {
  it('cualquier opción real → 1', () => {
    expect(normalizeAnswer(multiItem, ['a'])).toBe(1);
    expect(normalizeAnswer(multiItem, ['a', 'b'])).toBe(1);
  });
  it('vacío o solo "No procede" → 0', () => {
    expect(normalizeAnswer(multiItem, [])).toBe(0);
    expect(normalizeAnswer(multiItem, ['na'])).toBe(0);
  });
});

describe('isNotApplicable', () => {
  it('solo "No procede" es no aplica', () => {
    expect(isNotApplicable(['na'])).toBe(true);
    expect(isNotApplicable(['a'])).toBe(false);
    expect(isNotApplicable(['na', 'a'])).toBe(false);
    expect(isNotApplicable([])).toBe(false);
    expect(isNotApplicable(undefined)).toBe(false);
  });
});

describe('isAnswered cuenta "No procede" como respondido', () => {
  it('["na"] cuenta como respondido, [] no', () => {
    expect(isAnswered(multiItem, { m1: ['na'] })).toBe(true);
    expect(isAnswered(multiItem, { m1: [] })).toBe(false);
  });
});

describe('completitud', () => {
  it('"No procede" sube la completitud (ítem respondido)', () => {
    const items = [scaleItem, multiItem];
    expect(computeCompletion(items, { s1: 5, m1: ['na'] })).toBe(100);
    expect(computeCompletion(items, { s1: 5, m1: [] })).toBe(50);
  });
});

describe('afinidad: "No procede" no penaliza', () => {
  const items = [scaleItem, multiItem];
  it('multi "No procede" se excluye del cálculo → 100%', () => {
    const profile = computeProfile({ items, roles, answers: { s1: 5, m1: ['na'] } });
    expect(Math.round(profile.affinities[0].affinity)).toBe(100);
  });
  it('multi sin responder sí penaliza', () => {
    const profile = computeProfile({ items, roles, answers: { s1: 5, m1: [] } });
    expect(profile.affinities[0].affinity).toBeLessThan(100);
  });
});

describe('nivel por dimensión excluye "No procede"', () => {
  it('la dimensión del multi no aplica → level 0, count 0', () => {
    const dims = computeDimensionLevels([multiItem], { m1: ['na'] });
    const arch = dims.find((d) => d.key === 'architecture');
    expect(arch.level).toBe(0);
    expect(arch.count).toBe(0);
  });
  it('con opción real → level 100', () => {
    const dims = computeDimensionLevels([multiItem], { m1: ['a'] });
    const arch = dims.find((d) => d.key === 'architecture');
    expect(arch.level).toBe(100);
    expect(arch.count).toBe(1);
  });
});

describe('afinidad por patrón distingue roles anidados', () => {
  // junior pondera un subconjunto de lo que pondera senior.
  const items = [
    { id: 'shared', dimension: 'technical', type: 'scale', weights: { junior: 2, senior: 2 } },
    { id: 'seniorOnly', dimension: 'strategy', type: 'scale', weights: { junior: 0, senior: 2 } },
  ];
  const roles = [
    { key: 'junior', label: 'Junior', short: 'J', color: '#000', tagline: '' },
    { key: 'senior', label: 'Senior', short: 'S', color: '#111', tagline: '' },
  ];

  it('un perfil senior maximizado NO sale dominante como junior', () => {
    const profile = computeProfile({ items, roles, answers: { shared: 5, seniorOnly: 5 } });
    expect(profile.dominant.key).toBe('senior');
    const junior = profile.affinities.find((a) => a.key === 'junior');
    const senior = profile.affinities.find((a) => a.key === 'senior');
    expect(senior.affinity).toBe(100);
    expect(junior.affinity).toBeLessThan(senior.affinity);
  });

  it('un perfil puramente junior sale dominante como junior', () => {
    const profile = computeProfile({ items, roles, answers: { shared: 5, seniorOnly: 1 } });
    expect(profile.dominant.key).toBe('junior');
  });

  it('sin respuestas no hay rol dominante', () => {
    const profile = computeProfile({ items, roles, answers: {} });
    expect(profile.dominant).toBeNull();
  });
});
