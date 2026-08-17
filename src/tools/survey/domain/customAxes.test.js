import { describe, it, expect } from 'vitest';
import { axisSlug, RESERVED_AXIS_IDS, customColumnsOf, validateAxis } from './customAxes.js';

describe('axisSlug — id estable de una columna del CSV', () => {
  it('minúsculas, sin acentos, espacios a guion bajo', () => {
    expect(axisSlug('Género')).toBe('genero');
    expect(axisSlug('Rango de edad')).toBe('rango_de_edad');
    expect(axisSlug('  100% Remoto ')).toBe('100_remoto');
  });

  it('vacío o solo símbolos → cadena vacía (no es declarable)', () => {
    expect(axisSlug('')).toBe('');
    expect(axisSlug('%%%')).toBe('');
  });
});

describe('customColumnsOf — columnas extra detectadas en el padrón', () => {
  const rows = [
    { email: 'a@x.com', custom: { genero: 'Mujer', remoto: 'Híbrido' } },
    { email: 'b@x.com', custom: { genero: 'Hombre', remoto: 'Híbrido' } },
    { email: 'c@x.com', custom: { genero: 'Mujer' } },
  ];

  it('devuelve cada columna con sus valores distintos y cuántas personas la tienen', () => {
    const cols = customColumnsOf(rows);
    const genero = cols.find((c) => c.id === 'genero');
    expect(genero.values).toEqual(['Hombre', 'Mujer']);
    expect(genero.count).toBe(3);
    const remoto = cols.find((c) => c.id === 'remoto');
    expect(remoto.values).toEqual(['Híbrido']);
    expect(remoto.count).toBe(2);
  });

  it('sin columnas custom → lista vacía', () => {
    expect(customColumnsOf([{ email: 'a@x.com' }])).toEqual([]);
    expect(customColumnsOf(null)).toEqual([]);
  });
});

describe('validateAxis — solo categóricos con pocos valores (anti-reidentificación)', () => {
  it('un eje categórico normal pasa', () => {
    expect(validateAxis({ id: 'genero', values: ['Mujer', 'Hombre', 'Otro'] })).toBe(null);
  });

  it('texto libre (demasiados valores distintos) se rechaza con motivo', () => {
    const values = Array.from({ length: 13 }, (_, i) => `v${i}`);
    expect(validateAxis({ id: 'comentario', values })).toMatch(/valores distintos/i);
  });

  it('valores largos (frases) se rechazan', () => {
    expect(validateAxis({ id: 'nota', values: ['x'.repeat(41)] })).toMatch(/largo/i);
  });

  it('ids reservados del pipeline se rechazan', () => {
    for (const id of ['department', 'tenure', 'age', 'email']) {
      expect(validateAxis({ id, values: ['a'] })).toMatch(/reservad/i);
    }
    expect(RESERVED_AXIS_IDS).toContain('startDate');
  });

  it('sin valores no hay nada que segmentar', () => {
    expect(validateAxis({ id: 'genero', values: [] })).toMatch(/sin valores/i);
  });
});
