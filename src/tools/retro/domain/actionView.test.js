/** Tests de la lógica pura de acciones de retro (RMR-TSK-0246). */
import { describe, it, expect } from 'vitest';
import { ownersText, canToggle, sameScope, filterByStatus, actionsCsv } from './actionView.js';

describe('seguimiento de acciones (RMR-TSK-0644)', () => {
  const actions = [
    { id: 'a', text: 'Hacer "pairing"', ownerNames: ['Ana'], fromRetroId: 'r1', status: 'pending', createdAt: { seconds: 1791244800 } },
    { id: 'b', text: 'Línea 1\nlínea 2', owners: [], fromRetroId: 'r2', status: 'done', createdAt: null },
  ];

  it('filtra por pendientes, hechas o todas', () => {
    expect(filterByStatus(actions, 'pending').map((a) => a.id)).toEqual(['a']);
    expect(filterByStatus(actions, 'done').map((a) => a.id)).toEqual(['b']);
    expect(filterByStatus(actions, 'all')).toHaveLength(2);
  });

  it('CSV con cabecera, comillas y saltos escapados, y el nombre de la retro', () => {
    const csv = actionsCsv(actions, new Map([['r1', 'Sprint 29']]));
    expect(csv.split('\r\n')).toEqual([
      'Acción,Responsable,Retro,Estado,Creada',
      '"Hacer ""pairing""",Ana,Sprint 29,Pendiente,2026-10-06',
      '"Línea 1\nlínea 2",Sin owner,r2,Hecha,',
    ]);
  });

  it('una celda que empieza por = + - @ no se interpreta como fórmula al abrir en la hoja de cálculo', () => {
    expect(actionsCsv([{ text: '=HYPERLINK("x")', owners: [], status: 'pending' }], new Map()).split('\r\n')[1])
      .toMatch(/^"'=HYPERLINK/);
    expect(actionsCsv([{ text: ' \t@SUM(1)', owners: [], status: 'pending' }], new Map()).split('\r\n')[1])
      .toMatch(/^"' \t@SUM/);
  });
});

const members = [{ uid: 'ana', name: 'Ana P.' }, { uid: 'beto', name: 'Beto R.' }];

describe('ownersText', () => {
  it('resuelve owners a nombres', () => {
    expect(ownersText({ owners: ['ana', 'beto'] }, members)).toBe('Ana P., Beto R.');
  });
  it('sin owners → «Sin owner»', () => {
    expect(ownersText({ owners: [] }, members)).toBe('Sin owner');
    expect(ownersText({}, members)).toBe('Sin owner');
  });
});

describe('canToggle', () => {
  it('el líder siempre puede', () => {
    expect(canToggle({ owners: ['ana'] }, 'leader', 'leader')).toBe(true);
  });
  it('un owner puede la suya', () => {
    expect(canToggle({ owners: ['ana'] }, 'ana', 'leader')).toBe(true);
  });
  it('quien no es owner ni líder, no', () => {
    expect(canToggle({ owners: ['ana'] }, 'beto', 'leader')).toBe(false);
    expect(canToggle({ owners: ['ana'] }, null, 'leader')).toBe(false);
  });
});

describe('sameScope', () => {
  it('equipo con equipo', () => {
    expect(sameScope({ scope: { type: 'team' } }, { type: 'team' })).toBe(true);
  });
  it('squad solo si coincide el label', () => {
    expect(sameScope({ scope: { type: 'squad', label: 'Pagos' } }, { type: 'squad', label: 'Pagos' })).toBe(true);
    expect(sameScope({ scope: { type: 'squad', label: 'Pagos' } }, { type: 'squad', label: 'Otro' })).toBe(false);
  });
  it('tipos distintos no coinciden', () => {
    expect(sameScope({ scope: { type: 'team' } }, { type: 'squad', label: 'Pagos' })).toBe(false);
  });
});
