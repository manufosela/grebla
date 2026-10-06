import { describe, it, expect } from 'vitest';
import { selectedOnes, departmentsOf, departmentState, toggleDepartment, togglePerson, selectAll, NO_DEPARTMENT } from './padronSelection.js';

const p = (email, department) => ({ email, metadata: department ? { department } : {} });
const list = [p('ana@example.com', 'Tech'), p('Bea@example.com', 'Tech'), p('carla@example.com', 'PeopOps'), p('dani@example.com', null)];

describe('a quién se envía (RMR-TSK-0630): solo a quien se marca', () => {
  it('por defecto no va nadie', () => {
    expect(selectedOnes(list, new Set())).toEqual([]);
  });

  it('marcar a una persona la incluye, sin distinguir mayúsculas; desmarcarla la saca', () => {
    const s = togglePerson(new Set(), 'Bea@example.com', true);
    expect(selectedOnes(list, s).map((x) => x.email)).toEqual(['Bea@example.com']);
    expect(selectedOnes(list, togglePerson(s, 'BEA@example.com', false))).toEqual([]);
  });

  it('Todos marca a la lista entera; Ninguno es el conjunto vacío', () => {
    expect(selectedOnes(list, selectAll(list))).toEqual(list);
  });
});

describe('selección por departamento', () => {
  it('los departamentos salen ordenados, con «Sin departamento» al final', () => {
    expect(departmentsOf(list)).toEqual(['PeopOps', 'Tech', NO_DEPARTMENT]);
  });

  it('marcar Tech marca a todo Tech y luego se puede quitar a una persona', () => {
    let s = toggleDepartment(list, new Set(), 'Tech', true);
    expect(departmentState(list, s, 'Tech')).toBe('all');
    s = togglePerson(s, 'ana@example.com', false);
    expect(departmentState(list, s, 'Tech')).toBe('some');
    expect(selectedOnes(list, s).map((x) => x.email)).toEqual(['Bea@example.com']);
  });

  it('desmarcar un departamento no toca a los demás', () => {
    let s = selectAll(list);
    s = toggleDepartment(list, s, 'Tech', false);
    expect(departmentState(list, s, 'Tech')).toBe('none');
    expect(departmentState(list, s, 'PeopOps')).toBe('all');
  });

  it('quien no tiene departamento se marca con «Sin departamento»', () => {
    const s = toggleDepartment(list, new Set(), NO_DEPARTMENT, true);
    expect(selectedOnes(list, s).map((x) => x.email)).toEqual(['dani@example.com']);
  });
});
