import { describe, it, expect } from 'vitest';
import { withoutExcluded } from './padronSelection.js';

describe('withoutExcluded (RMR-TSK-0629) — marcar y desmarcar a quién se envía', () => {
  const list = [{ email: 'ana@example.com', metadata: {} }, { email: 'Bea@example.com', metadata: {} }];

  it('por defecto van todas; desmarcar a alguien lo saca, sin distinguir mayúsculas', () => {
    expect(withoutExcluded(list, new Set())).toEqual(list);
    expect(withoutExcluded(list, new Set(['bea@example.com'])).map((p) => p.email)).toEqual(['ana@example.com']);
  });

  it('desmarcar a todas deja la lista vacía', () => {
    expect(withoutExcluded(list, new Set(['ana@example.com', 'bea@example.com']))).toEqual([]);
  });
});
