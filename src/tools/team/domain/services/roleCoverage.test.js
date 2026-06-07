import { describe, it, expect } from 'vitest';
import { roleCoverage, uncoveredRoles } from './roleCoverage.js';

describe('roleCoverage (R9a — cobertura de equipo, sin comparar personas)', () => {
  it('suma 1.0 por primario y 0.5 por secundario entre el equipo', () => {
    const contributions = [
      { roles: { PL: 'primary', CO: 'secondary' } },
      { roles: { PL: 'secondary', SH: 'primary' } },
    ];
    const cov = roleCoverage(contributions);
    const by = Object.fromEntries(cov.map((r) => [r.sigla, r.score]));
    expect(by.PL).toBe(1.5); // 1.0 + 0.5
    expect(by.CO).toBe(0.5);
    expect(by.SH).toBe(1.0);
    expect(by.ME).toBe(0); // nadie lo ejerce
  });

  it('devuelve los 9 roles en orden con metadatos', () => {
    const cov = roleCoverage([]);
    expect(cov).toHaveLength(9);
    expect(cov[0]).toMatchObject({ sigla: 'PL', name: 'Cerebro', category: 'mental', score: 0 });
  });

  it('es robusto ante entradas vacías o malformadas', () => {
    expect(roleCoverage(null)).toHaveLength(9);
    expect(roleCoverage([{}, { roles: null }]).every((r) => r.score === 0)).toBe(true);
  });

  it('uncoveredRoles detecta los gaps (score 0)', () => {
    const gaps = uncoveredRoles([{ roles: { PL: 'primary' } }]);
    expect(gaps.find((g) => g.sigla === 'PL')).toBeUndefined();
    expect(gaps.find((g) => g.sigla === 'ME')).toBeDefined();
    expect(gaps).toHaveLength(8);
  });
});
