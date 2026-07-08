import { describe, it, expect } from 'vitest';
import { createMemoryO2O } from '../../infrastructure/memory/index.js';
import {
  listPeriods, getPeriod, createPeriod, renamePeriod, removePeriod,
  savePeriodGuide, savePeriodForm, defaultPeriodName, blankGuide, blankForm,
} from './periods.js';
import { createSession, listSessions } from './sessions.js';

const p = () => createMemoryO2O();

describe('o2o periods usecases', () => {
  it('crea un periodo EN BLANCO con nombre y guía/form vacíos', async () => {
    const store = p();
    const id = await createPeriod(store, { name: 'Periodo Julio 2026' });
    const period = await getPeriod(store, id);
    expect(period.name).toBe('Periodo Julio 2026');
    expect(period.status).toBe('open');
    expect(period.guide.blocks).toEqual([]);
    expect(period.form.sections).toEqual([]);
    expect(period.createdAt).toBeTruthy();
  });

  it('acepta guía/form dados (p. ej. importados) al crear', async () => {
    const store = p();
    const guide = { version: 1, blocks: [{ id: 'b1', title: 'B1', questions: [{ id: 'q1', text: '¿?' }] }] };
    const id = await createPeriod(store, { name: 'X', guide });
    expect((await getPeriod(store, id)).guide.blocks).toHaveLength(1);
  });

  it('lista, renombra y borra periodos', async () => {
    const store = p();
    const id = await createPeriod(store, { name: 'Uno' });
    expect(await listPeriods(store)).toHaveLength(1);
    await renamePeriod(store, id, 'Uno renombrado');
    expect((await getPeriod(store, id)).name).toBe('Uno renombrado');
    await removePeriod(store, id);
    expect(await listPeriods(store)).toHaveLength(0);
  });

  it('exige nombre al crear/renombrar', async () => {
    const store = p();
    const id = await createPeriod(store, { name: 'X' });
    await expect(renamePeriod(store, id, '   ')).rejects.toThrow(/nombre/i);
  });

  it('savePeriodGuide/Form incrementan versión y sellan updatedAt', async () => {
    const store = p();
    const id = await createPeriod(store, { name: 'X' });
    const g = await savePeriodGuide(store, id, blankGuide());
    expect(g.version).toBe(2);
    expect(g.updatedAt).toBeTruthy();
    expect((await getPeriod(store, id)).guide.version).toBe(2);
    const f = await savePeriodForm(store, id, blankForm());
    expect(f.version).toBe(2);
  });

  it('defaultPeriodName usa mes y año', () => {
    expect(defaultPeriodName(new Date('2026-07-15T00:00:00Z'))).toBe('Periodo Julio 2026');
  });

  it('las sesiones se filtran por periodo', async () => {
    const store = p();
    await createSession(store, { personId: 'ana', date: '2026-07-01', periodId: 'jul' });
    await createSession(store, { personId: 'ana', date: '2026-09-01', periodId: 'sep' });
    expect(await listSessions(store, 'ana')).toHaveLength(2);
    expect(await listSessions(store, 'ana', 'jul')).toHaveLength(1);
    expect((await listSessions(store, 'ana', 'jul'))[0].periodId).toBe('jul');
  });
});
