import { describe, it, expect } from 'vitest';
import { effectiveDirectory, validTeamEms, teamsWithChangedEm } from './teamEms.js';

describe('teamsWithChangedEm: qué equipos recalcular (RMR-TSK-0716)', () => {
  it('los que ganan, pierden o cambian de EM; los iguales no', () => {
    expect(teamsWithChangedEm({ IA: 'nico', Backend: 'mario' }, { IA: 'otro', Platform: 'mario', Backend: 'mario' }).toSorted())
      .toEqual(['IA', 'Platform']);
    expect(teamsWithChangedEm({ IA: 'nico' }, {})).toEqual(['IA']);
    expect(teamsWithChangedEm(null, null)).toEqual([]);
  });
});

const tech = (id, level, team, reportsToPersonId, extra = {}) => ({
  id, uid: `u-${id}`, reportsToPersonId, orgBranch: 'engineering', notion: { level, team }, ...extra,
});
const people = [
  tech('cto', 'C-level', 'Backend', null),
  tech('nico', 'Manager', 'Mobile', 'cto'),
  tech('mario', 'Manager', 'Backend', 'cto'),
  tech('tl-ia', 'Lead', 'IA', 'cto'),
  tech('ia-dev', 'Individual Contributor', 'IA', 'mario'),
  tech('pl-dev', 'Individual Contributor', 'Platform', 'mario'),
  tech('be-dev', 'Individual Contributor', 'Backend', 'mario'),
  { id: 'ops', uid: 'u-ops', reportsToPersonId: 'cto', orgBranch: 'operations', notion: { level: 'Individual Contributor', team: 'IA' } },
];
const bossOf = (dir, id) => dir.find((p) => p.id === id).reportsToPersonId;

describe('effectiveDirectory: el EM de cada equipo en GREBLA (RMR-TSK-0701)', () => {
  const dir = effectiveDirectory(people, { IA: 'nico', Platform: 'mario' });

  it('ICs y leads de un equipo con EM pasan a depender de ese EM', () => {
    expect(bossOf(dir, 'tl-ia')).toBe('nico');
    expect(bossOf(dir, 'ia-dev')).toBe('nico');
    expect(bossOf(dir, 'pl-dev')).toBe('mario');
  });

  it('quien no está en un equipo con EM sigue con su jefe de Notion', () => {
    expect(bossOf(dir, 'be-dev')).toBe('mario');
    expect(bossOf(dir, 'nico')).toBe('cto');
  });

  it('los managers, heads y el CTO no cambian, ni nadie fuera de Tech', () => {
    const conEm = effectiveDirectory(people, { Backend: 'mario', IA: 'nico' });
    expect(bossOf(conEm, 'cto')).toBeNull();
    expect(bossOf(conEm, 'mario')).toBe('cto');
    expect(bossOf(conEm, 'ops')).toBe('cto');
  });

  it('un EM que no existe en el directorio no se aplica, ni el EM a sí mismo', () => {
    const raro = effectiveDirectory([...people, tech('nico2', 'Individual Contributor', 'Ghost', 'cto')], { Ghost: 'nadie' });
    expect(bossOf(raro, 'nico2')).toBe('cto');
  });

  it('no toca las fichas originales', () => {
    expect(bossOf(people, 'ia-dev')).toBe('mario');
  });
});

describe('validTeamEms: el mapa equipo → EM que se guarda', () => {
  it('limpia lo vacío y exige ids de texto', () => {
    expect(validTeamEms({ IA: 'nico', Platform: '', Mobile: null })).toEqual({ IA: 'nico' });
    expect(validTeamEms(null)).toEqual({});
    expect(() => validTeamEms({ IA: 7 })).toThrow(/EM/);
  });
});
