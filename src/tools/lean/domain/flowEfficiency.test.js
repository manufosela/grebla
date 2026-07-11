import { describe, it, expect } from 'vitest';
import { activeAndTotal, flowEfficiency, isActiveWork } from './flowEfficiency.js';

const H = 3_600_000;
const base = new Date('2026-01-01T00:00:00Z').getTime();
const at = (h) => new Date(base + h * H).toISOString();

describe('isActiveWork', () => {
  it('started + trabajo hands-on → activo', () => {
    expect(isActiveWork('started', 'In Progress')).toBe(true);
    expect(isActiveWork('started', 'Doing')).toBe(true);
    expect(isActiveWork('started', ' in progress ')).toBe(true); // normaliza mayúsculas/espacios
  });

  it('revisión/QA y colas/bloqueos → espera (criterio estricto, aunque Linear los tipe started)', () => {
    expect(isActiveWork('started', 'In Review')).toBe(false);
    expect(isActiveWork('started', 'In Code Review')).toBe(false);
    expect(isActiveWork('started', 'In QA')).toBe(false);
    expect(isActiveWork('started', 'Blocked')).toBe(false);
    expect(isActiveWork('started', 'Ready for CR')).toBe(false);
    expect(isActiveWork('started', 'Ready for QA')).toBe(false);
    expect(isActiveWork('started', 'Merged')).toBe(false);
  });

  it('no started (o desconocido) → espera', () => {
    expect(isActiveWork('unstarted', 'ToDo')).toBe(false);
    expect(isActiveWork('completed', 'Done')).toBe(false);
    expect(isActiveWork('backlog', 'Backlog')).toBe(false);
    expect(isActiveWork('started', 'Estado Nuevo Raro')).toBe(false);
  });
});

describe('activeAndTotal', () => {
  it('todo el tiempo en started → activo == total', () => {
    const r = activeAndTotal({ startedAt: at(0), completedAt: at(10), transitions: [] });
    expect(r.activeMs).toBe(10 * H);
    expect(r.totalMs).toBe(10 * H);
  });

  it('con una espera (In Progress→ToDo→In Progress→completed)', () => {
    // 0-2h In Progress, 2-8h de vuelta a ToDo (espera), 8-10h In Progress → activo 4h de 10h
    const issue = {
      startedAt: at(0),
      completedAt: at(10),
      transitions: [
        { stateType: 'started', stateName: 'In Progress', at: at(0) },
        { stateType: 'unstarted', stateName: 'ToDo', at: at(2) }, // vuelve a espera
        { stateType: 'started', stateName: 'In Progress', at: at(8) },
      ],
    };
    const r = activeAndTotal(issue);
    expect(r.activeMs).toBe(4 * H);
    expect(r.totalMs).toBe(10 * H);
  });

  it('started por type pero ESPERA por nombre (Blocked) cuenta como espera', () => {
    // 0-2h In Progress (activo), 2-8h Blocked (started por type, pero espera), 8-10h In Progress
    const issue = {
      startedAt: at(0),
      completedAt: at(10),
      transitions: [
        { stateType: 'started', stateName: 'In Progress', at: at(0) },
        { stateType: 'started', stateName: 'Blocked', at: at(2) },
        { stateType: 'started', stateName: 'In Progress', at: at(8) },
      ],
    };
    const r = activeAndTotal(issue);
    expect(r.activeMs).toBe(4 * H); // solo las 4h en In Progress; las 6h de Blocked son espera
    expect(r.totalMs).toBe(10 * H);
  });

  it('sin started/completed válidos → 0', () => {
    expect(activeAndTotal({ startedAt: at(5), completedAt: at(2) })).toEqual({ activeMs: 0, totalMs: 0 });
  });
});

describe('flowEfficiency', () => {
  it('agrega Σactivo/Σtotal en %', () => {
    const issues = [
      { startedAt: at(0), completedAt: at(10), transitions: [{ stateType: 'started', stateName: 'In Progress', at: at(0) }, { stateType: 'unstarted', stateName: 'ToDo', at: at(2) }, { stateType: 'started', stateName: 'In Progress', at: at(8) }] }, // 4/10
      { startedAt: at(0), completedAt: at(10), transitions: [] }, // 10/10 (sin historial → activo por defecto)
    ];
    // (4 + 10) / (10 + 10) = 70 %
    expect(flowEfficiency(issues)).toBe(70);
  });

  it('sin datos → null', () => {
    expect(flowEfficiency([])).toBeNull();
  });
});
