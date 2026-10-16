import { describe, it, expect } from 'vitest';
import { newRecommendation, decideRecommendation, applyToRoute, openRecommendations } from './recommendations.js';

const EM = { uid: 'em', name: 'Ana EM' };
const AT = '2026-10-16T09:00:00.000Z';

describe('newRecommendation: el manager recomienda una ruta o una casa (RMR-TSK-0737)', () => {
  it('una ruta prehecha lleva sus casas en orden, su nombre y la nota', () => {
    const rec = newRecommendation({ kind: 'route', routeId: 'backend--peritus', cityIds: ['c1', 'c2'], label: 'Backend · Peritus', note: ' Para tu próximo paso ', by: EM, at: AT });
    expect(rec).toEqual({ kind: 'route', routeId: 'backend--peritus', cityIds: ['c1', 'c2'], label: 'Backend · Peritus',
      note: 'Para tu próximo paso', by: EM, at: AT, status: 'open', decidedAt: null });
  });

  it('una casa suelta va sin ruta', () => {
    const rec = newRecommendation({ kind: 'city', cityIds: ['c3'], label: 'Colas', note: '', by: EM, at: AT });
    expect(rec).toMatchObject({ kind: 'city', routeId: null, cityIds: ['c3'], note: '' });
  });

  it('falla en alto con datos que no casan', () => {
    const base = { kind: 'city', cityIds: ['c3'], label: 'Colas', by: EM, at: AT };
    expect(() => newRecommendation({ ...base, kind: 'curso' })).toThrow(/tipo/i);
    expect(() => newRecommendation({ ...base, cityIds: [] })).toThrow(/casa/i);
    expect(() => newRecommendation({ ...base, cityIds: ['c1', 'c2'] })).toThrow(/una casa/i);
    expect(() => newRecommendation({ ...base, kind: 'route', cityIds: ['c1'] })).toThrow(/ruta/i);
    expect(() => newRecommendation({ ...base, kind: 'route', routeId: 'r', cityIds: ['c1', 'c1'] })).toThrow(/repetida/i);
    expect(() => newRecommendation({ ...base, note: 'x'.repeat(501) })).toThrow(/nota/i);
    expect(() => newRecommendation({ ...base, by: { uid: '', name: 'X' } })).toThrow(/autor/i);
    expect(() => newRecommendation({ ...base, at: '16/10/2026' })).toThrow(/fecha/i);
  });
});

describe('decideRecommendation: decide la persona, una vez', () => {
  const open = newRecommendation({ kind: 'city', cityIds: ['c3'], label: 'Colas', by: EM, at: AT });
  it('aceptar o descartar sella la fecha', () => {
    expect(decideRecommendation(open, 'accepted', AT)).toEqual({ status: 'accepted', decidedAt: AT });
    expect(decideRecommendation(open, 'dismissed', AT)).toEqual({ status: 'dismissed', decidedAt: AT });
  });
  it('lo ya decidido no se vuelve a decidir; ni decisiones inventadas', () => {
    expect(() => decideRecommendation({ ...open, status: 'accepted' }, 'dismissed', AT)).toThrow(/decidida/i);
    expect(() => decideRecommendation(open, 'maybe', AT)).toThrow(/decisión/i);
    expect(() => decideRecommendation(open, 'accepted', '')).toThrow(/fecha/i);
  });
});

describe('applyToRoute: aceptar añade a su ruta lo que falte, sin mover lo que ya tenía', () => {
  it('añade al final, en orden, solo las casas nuevas', () => {
    expect(applyToRoute(['c2', 'c9'], { cityIds: ['c1', 'c2', 'c3'] })).toEqual(['c2', 'c9', 'c1', 'c3']);
    expect(applyToRoute(null, { cityIds: ['c1'] })).toEqual(['c1']);
    expect(applyToRoute([], { cityIds: ['c1', 'c1'] })).toEqual(['c1']);
  });
});

describe('openRecommendations: lo pendiente de decidir, lo más reciente primero', () => {
  it('filtra y ordena', () => {
    const list = [
      { id: 'a', status: 'open', at: '2026-10-01T00:00:00.000Z' },
      { id: 'b', status: 'accepted', at: '2026-10-05T00:00:00.000Z' },
      { id: 'c', status: 'open', at: '2026-10-10T00:00:00.000Z' },
    ];
    expect(openRecommendations(list).map((r) => r.id)).toEqual(['c', 'a']);
  });
});
