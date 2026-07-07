import { describe, it, expect } from 'vitest';
import { createMemoryO2O } from '../../infrastructure/memory/index.js';
import {
  listActions, createAction, updateAction, toggleAction, removeAction,
} from './actions.js';

const persistence = () => createMemoryO2O();

describe('o2o actions usecases', () => {
  it('crea una acción abierta con owner por defecto = persona', async () => {
    const p = persistence();
    const id = await createAction(p, 'ana', { description: 'Preparar demo' });
    const [a] = await listActions(p, 'ana');
    expect(a.id).toBe(id);
    expect(a.owner).toBe('person');
    expect(a.status).toBe('open');
    expect(a.doneAt).toBeNull();
    expect(a.createdAt).toBeTruthy();
  });

  it('exige descripción y persona', async () => {
    const p = persistence();
    await expect(createAction(p, 'ana', { description: '  ' })).rejects.toThrow(/descripción/i);
    await expect(createAction(p, '', { description: 'x' })).rejects.toThrow(/persona/i);
  });

  it('no mezcla acciones entre personas', async () => {
    const p = persistence();
    await createAction(p, 'ana', { description: 'A' });
    await createAction(p, 'leo', { description: 'B', owner: 'leader' });
    expect(await listActions(p, 'ana')).toHaveLength(1);
    const [leo] = await listActions(p, 'leo');
    expect(leo.owner).toBe('leader');
  });

  it('alterna hecho/abierto sellando doneAt', async () => {
    const p = persistence();
    const id = await createAction(p, 'ana', { description: 'A' });
    let [a] = await listActions(p, 'ana');
    await toggleAction(p, 'ana', a);
    [a] = await listActions(p, 'ana');
    expect(a.status).toBe('done');
    expect(a.doneAt).toBeTruthy();
    await toggleAction(p, 'ana', a);
    [a] = await listActions(p, 'ana');
    expect(a.status).toBe('open');
    expect(a.doneAt).toBeNull();
  });

  it('actualiza y borra', async () => {
    const p = persistence();
    const id = await createAction(p, 'ana', { description: 'A' });
    await updateAction(p, 'ana', id, { description: 'A editada' });
    expect((await listActions(p, 'ana'))[0].description).toBe('A editada');
    await removeAction(p, 'ana', id);
    expect(await listActions(p, 'ana')).toHaveLength(0);
  });
});
