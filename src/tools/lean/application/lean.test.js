import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryLeanPersistence } from '../infrastructure/memory/index.js';
import { addTeam, listTeams, removeTeam, getFlowSummary } from './usecases.js';

describe('LEAN usecases', () => {
  let p;
  beforeEach(() => { p = createMemoryLeanPersistence(); });

  it('addTeam normaliza la key (mayúsculas/trim) y la exige', async () => {
    const id = await addTeam(p, { linearTeamKey: ' eng ', name: 'Ingeniería' });
    const [t] = await listTeams(p);
    expect(t.id).toBe(id);
    expect(t.linearTeamKey).toBe('ENG');
    expect(t.name).toBe('Ingeniería');
    expect(() => addTeam(p, { linearTeamKey: '  ' })).toThrow(/obligatoria/);
  });

  it('name por defecto = key', async () => {
    await addTeam(p, { linearTeamKey: 'ops' });
    expect((await listTeams(p))[0].name).toBe('OPS');
  });

  it('removeTeam quita el equipo', async () => {
    const id = await addTeam(p, { linearTeamKey: 'ENG' });
    await removeTeam(p, id);
    expect(await listTeams(p)).toEqual([]);
  });

  it('getFlowSummary agrega el global (suma throughput/wip, cycle ponderado, aging máx)', async () => {
    const seed = [
      { id: '1', linearTeamKey: 'ENG', name: 'Eng', metrics: { completed: 10, throughputPerWeek: 2.5, wip: 3, cycleTimeP50Hours: 20, cycleTimeP85Hours: 40, agingDaysMax: 5 } },
      { id: '2', linearTeamKey: 'OPS', name: 'Ops', metrics: { completed: 0, throughputPerWeek: 0, wip: 1, cycleTimeP50Hours: null, cycleTimeP85Hours: null, agingDaysMax: 12 } },
    ];
    const pp = createMemoryLeanPersistence(seed);
    const { teams, global } = await getFlowSummary(pp);
    expect(teams).toHaveLength(2);
    expect(global.completed).toBe(10);
    expect(global.wip).toBe(4);
    expect(global.throughputPerWeek).toBe(2.5);
    expect(global.cycleTimeP50Hours).toBe(20); // solo ENG (completed>0) pondera
    expect(global.agingDaysMax).toBe(12);
  });
});
