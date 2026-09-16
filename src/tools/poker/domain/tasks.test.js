import { describe, it, expect } from 'vitest';
import { parseTaskLines, currentTask, nextPendingTask, closeTask, appendTask, cleanTitle } from './tasks.js';

describe('parseTaskLines: lo escrito una tarea por línea', () => {
  it('una tarea por línea, en orden, sin vacías ni espacios de más', () => {
    const tasks = parseTaskLines('BB-1231 - nuevo onboarding\n\n  Migrar   el login  \n', 7);
    expect(tasks.map((t) => t.title)).toEqual(['BB-1231 - nuevo onboarding', 'Migrar el login']);
    expect(tasks.every((t) => t.value === null)).toBe(true);
    expect(new Set(tasks.map((t) => t.id)).size).toBe(2);
  });

  it('sin texto no hay tareas', () => {
    expect(parseTaskLines('')).toEqual([]);
    expect(parseTaskLines(null)).toEqual([]);
  });

  it('un título se recorta a un tamaño razonable', () => {
    expect(cleanTitle('x'.repeat(500))).toHaveLength(160);
  });
});

describe('avanzar por las tareas', () => {
  const tasks = [
    { id: 'a', title: 'A', value: null },
    { id: 'b', title: 'B', value: null },
    { id: 'c', title: 'C', value: null },
  ];

  it('currentTask es la que marca la sesión', () => {
    expect(currentTask({ tasks, currentTaskId: 'b' })).toEqual(tasks[1]);
    expect(currentTask({ tasks, currentTaskId: 'zz' })).toBeNull();
    expect(currentTask(null)).toBeNull();
  });

  it('closeTask guarda el valor y pasa a la siguiente pendiente', () => {
    const r = closeTask(tasks, 'a', '5');
    expect(r.tasks[0]).toEqual({ id: 'a', title: 'A', value: '5' });
    expect(r.nextId).toBe('b');
  });

  it('al cerrar la última no queda siguiente: es cuando se termina o se añade otra', () => {
    const r = closeTask([{ id: 'a', title: 'A', value: '3' }, { id: 'b', title: 'B', value: null }], 'b', '8');
    expect(r.nextId).toBeNull();
  });

  it('una pendiente anterior que se saltó vuelve a tocar cuando se acaban las de después', () => {
    const list = [{ id: 'a', title: 'A', value: null }, { id: 'b', title: 'B', value: null }];
    expect(nextPendingTask(list, 'b')).toEqual(list[0]);
  });

  it('appendTask añade al final con id propio, y con título vacío no añade nada', () => {
    const r = appendTask(tasks, '  Otra  ', 9);
    expect(r.tasks).toHaveLength(4);
    expect(r.task.title).toBe('Otra');
    expect(r.task.value).toBeNull();
    expect(appendTask(tasks, '   ').task).toBeNull();
  });
});
