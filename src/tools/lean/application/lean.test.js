import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryLeanPersistence } from '../infrastructure/memory/index.js';
import { addUnit, listUnits, removeUnit, getFlowSummary } from './usecases.js';

describe('LEAN usecases (unidades = labels de Linear)', () => {
  let p;
  beforeEach(() => { p = createMemoryLeanPersistence(); });

  it('addUnit trimea el label, exige que no esté vacío y guarda el kind', async () => {
    const id = await addUnit(p, { linearLabel: ' Trust ', kind: 'squad', name: 'Equipo Trust' });
    const [u] = await listUnits(p);
    expect(u.id).toBe(id);
    expect(u.linearLabel).toBe('Trust');
    expect(u.kind).toBe('squad');
    expect(u.name).toBe('Equipo Trust');
    expect(() => addUnit(p, { linearLabel: '  ', kind: 'squad' })).toThrow(/obligatorio/);
  });

  it('name por defecto = label; kind inválido cae a squad', async () => {
    await addUnit(p, { linearLabel: 'Backend', kind: 'nope' });
    const [u] = await listUnits(p);
    expect(u.name).toBe('Backend');
    expect(u.kind).toBe('squad');
  });

  it('removeUnit quita la unidad', async () => {
    const id = await addUnit(p, { linearLabel: 'Trust', kind: 'squad' });
    await removeUnit(p, id);
    expect(await listUnits(p)).toEqual([]);
  });

  it('getFlowSummary separa squads (equipos) y chapters (gremios) con su global', async () => {
    const seed = [
      { id: '1', linearLabel: 'Trust', kind: 'squad', name: 'Trust', metrics: { completed: 10, throughputPerWeek: 2.5, wip: 3, cycleTimeP50Hours: 20, cycleTimeP85Hours: 40, agingDaysMax: 5 } },
      { id: '2', linearLabel: 'Backend', kind: 'chapter', name: 'Backend', metrics: { completed: 6, throughputPerWeek: 1.5, wip: 2, cycleTimeP50Hours: 12, cycleTimeP85Hours: 30, agingDaysMax: 9 } },
    ];
    const pp = createMemoryLeanPersistence(seed);
    const { squads, chapters } = await getFlowSummary(pp);
    expect(squads.units).toHaveLength(1);
    expect(chapters.units).toHaveLength(1);
    expect(squads.global.completed).toBe(10);
    expect(chapters.global.completed).toBe(6);
  });
});
