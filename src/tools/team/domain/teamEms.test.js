import { describe, it, expect } from 'vitest';
import { teamEmChoices, cleanTeamEms } from './teamEms.js';

const p = (id, level, team, extra = {}) => ({ id, name: id.toUpperCase(), active: true, orgBranch: 'engineering', notion: { level, team }, ...extra });

describe('teamEmChoices: equipos de Tech y quién puede ser su EM (RMR-TSK-0717)', () => {
  const people = [
    p('nico', 'Manager', 'Mobile'), p('mario', 'Manager', 'Backend'), p('jorge', 'Head of', 'Backend'),
    p('dev', 'Individual Contributor', 'IA'), p('tl', 'Lead', 'Platform'),
    p('baja', 'Manager', 'QA', { active: false }), p('ops', 'Manager', 'Ops', { orgBranch: 'operations' }),
  ];

  it('equipos con gente activa de Tech, ordenados', () => {
    expect(teamEmChoices(people).teams).toEqual(['Backend', 'IA', 'Mobile', 'Platform']);
  });

  it('candidatos: los managers activos de Tech, por nombre', () => {
    expect(teamEmChoices(people).candidates).toEqual([{ id: 'mario', name: 'MARIO' }, { id: 'nico', name: 'NICO' }]);
  });
});

describe('cleanTeamEms: lo que se guarda', () => {
  it('quita los equipos sin EM y los que no existen', () => {
    expect(cleanTeamEms({ IA: 'nico', Platform: '', Mobile: 'fantasma' }, ['nico', 'mario'])).toEqual({ IA: 'nico' });
  });
});
