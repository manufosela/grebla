import { describe, it, expect } from 'vitest';
import { assessmentRows, improvementPoints, careerSuggestion } from './assessment.js';

/**
 * Framework mínimo con dos dimensiones y una expectativa para 'l1' en la
 * dimensión 'tech' (la de 'reliability' queda vacía a propósito).
 * @type {import('./framework.js').CareerFramework}
 */
const FW = {
  id: 'engineering',
  name: 'Engineering',
  tracks: [{ id: 'ic', name: 'IC', order: 1, description: '' }],
  levels: [
    { id: 'l1', code: 'L1', title: 'Engineer', trackId: 'ic', order: 1, description: '', typicalProfile: '', branchesFrom: null },
    { id: 'l2', code: 'L2', title: 'Senior', trackId: 'ic', order: 2, description: '', typicalProfile: '', branchesFrom: null },
  ],
  disciplines: [],
  dimensions: [
    { id: 'tech', name: 'Technical', order: 1, description: '' },
    { id: 'reliability', name: 'Reliability', order: 2, description: '' },
  ],
  expectations: [{ levelId: 'l1', dimensionId: 'tech', text: 'Escribe código de calidad.' }],
  addendums: [],
};

describe('career — assessmentRows', () => {
  it('sin valoración: una fila por dimensión y todas cumplen (verde) por defecto', () => {
    const rows = assessmentRows(FW, 'l1', null);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.dimension.id)).toEqual(['tech', 'reliability']);
    expect(rows.every((r) => r.meets === true)).toBe(true);
    expect(rows[0].note).toBe('');
  });

  it('marca hasExpectation según haya texto en la celda del framework', () => {
    const rows = assessmentRows(FW, 'l1', null);
    expect(rows[0]).toMatchObject({ text: 'Escribe código de calidad.', hasExpectation: true });
    expect(rows[1]).toMatchObject({ text: '', hasExpectation: false });
  });

  it('respeta las marcas y notas de la valoración', () => {
    const assessment = {
      byDimension: {
        tech: { meets: false, note: '  Le falta profundidad  ' },
        reliability: { meets: true },
      },
    };
    const rows = assessmentRows(FW, 'l1', assessment);
    expect(rows[0]).toMatchObject({ meets: false, note: 'Le falta profundidad' });
    expect(rows[1].meets).toBe(true);
  });
});

describe('career — improvementPoints', () => {
  it('devuelve solo las filas marcadas como «no llega»', () => {
    const rows = assessmentRows(FW, 'l1', {
      byDimension: { tech: { meets: false, note: 'foco aquí' } },
    });
    const reds = improvementPoints(rows);
    expect(reds).toHaveLength(1);
    expect(reds[0].dimension.id).toBe('tech');
    expect(reds[0].note).toBe('foco aquí');
  });

  it('sin rojos devuelve lista vacía', () => {
    expect(improvementPoints(assessmentRows(FW, 'l1', null))).toEqual([]);
  });
});

describe('career — careerSuggestion', () => {
  it('sin nivel (total 0) devuelve cadena vacía', () => {
    expect(careerSuggestion({ reds: 0, total: 0, aspirationalCodes: [] })).toBe('');
  });

  it('sin rojos propone aspirar a los códigos indicados', () => {
    expect(careerSuggestion({ reds: 0, total: 3, aspirationalCodes: ['L2', 'L3-TL'] }))
      .toBe('Cumple las expectativas de su nivel. Podría aspirar a: L2, L3-TL.');
  });

  it('sin rojos y sin niveles superiores indica tope de itinerario', () => {
    expect(careerSuggestion({ reds: 0, total: 3, aspirationalCodes: [] }))
      .toBe('Cumple las expectativas de su nivel. — tope de itinerario.');
  });

  it('un rojo sugiere foco en el punto de mejora', () => {
    expect(careerSuggestion({ reds: 1, total: 3 }))
      .toBe('Cerca de su nivel: foco en el punto de mejora.');
  });

  it('dos o más rojos sugieren replantear el nivel', () => {
    expect(careerSuggestion({ reds: 2, total: 3 }))
      .toBe('Varias expectativas sin cumplir: valora si el nivel es adecuado (mover lateral o bajar).');
    expect(careerSuggestion({ reds: 5, total: 6 }))
      .toContain('valora si el nivel es adecuado');
  });
});
