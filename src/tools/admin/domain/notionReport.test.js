import { describe, expect, it } from 'vitest';
import { reportRows } from './notionReport.js';

const names = new Map([['p1', 'Ana'], ['p2', 'Jefa'], ['new1', 'Bea']]);
const nameOf = (id) => names.get(id) ?? id;

describe('reportRows — el informe de Notion en filas que se leen', () => {
  it('un cambio por fila, con el campo en castellano y el manager por su nombre', () => {
    const report = {
      updates: [{ personId: 'p1', name: 'Ana', changes: {
        reportsToPersonId: { from: 'p2', to: 'new1' }, external: { from: null, to: false }, orgBranch: { from: 'product', to: 'engineering' },
      } }],
      creates: [{ personId: 'new1', name: 'Bea' }], skipped: [{ name: 'X', reason: 'sin email en Notion' }],
      notInNotion: [{ personId: 'p9', name: 'Solo GREBLA' }],
    };
    expect(reportRows(report, nameOf)).toEqual({
      changes: [
        { name: 'Ana', field: 'Manager', from: 'Jefa', to: 'Bea' },
        { name: 'Ana', field: 'Externo', from: '—', to: 'no' },
        { name: 'Ana', field: 'Departamento', from: 'product', to: 'engineering' },
      ],
      creates: ['Bea'],
      skipped: [{ name: 'X', reason: 'sin email en Notion' }],
      notInNotion: ['Solo GREBLA'],
    });
  });

  it('un informe vacío o sin cambios no rompe', () => {
    expect(reportRows({}, nameOf)).toEqual({ changes: [], creates: [], skipped: [], notInNotion: [] });
    expect(reportRows({ updates: [{ personId: 'p1', name: 'Ana' }] }, nameOf).changes).toEqual([]);
  });
});
