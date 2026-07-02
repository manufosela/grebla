import { describe, it, expect } from 'vitest';
import { normalizeText, filterGlossary, countTerms } from './glossarySearch.js';

/** Glosario mínimo de prueba (mismo shape que src/data/glossary.js). */
const SAMPLE = [
  {
    id: 'desarrollo',
    title: 'Principios de desarrollo',
    terms: [
      { term: 'YAGNI', aka: 'You Aren’t Gonna Need It', desc: 'No construyas hasta necesitarlo.' },
      { term: 'DRY', aka: 'Don’t Repeat Yourself', desc: 'Única fuente de verdad.' },
    ],
  },
  {
    id: 'liderazgo',
    title: 'Liderazgo',
    terms: [
      { term: 'Principio de Peter', desc: 'Se asciende hasta el nivel de incompetencia.' },
    ],
  },
];

describe('normalizeText', () => {
  it('pasa a minúsculas y elimina acentos', () => {
    expect(normalizeText('Organización')).toBe('organizacion');
    expect(normalizeText('PÉTER')).toBe('peter');
  });

  it('deja intacto un texto sin acentos ni mayúsculas', () => {
    expect(normalizeText('dry')).toBe('dry');
  });
});

describe('filterGlossary', () => {
  it('devuelve todas las categorías cuando la consulta está vacía', () => {
    expect(filterGlossary(SAMPLE, '')).toBe(SAMPLE);
    expect(filterGlossary(SAMPLE, '   ')).toBe(SAMPLE);
  });

  it('filtra por nombre de término (case-insensitive)', () => {
    const result = filterGlossary(SAMPLE, 'yagni');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('desarrollo');
    expect(result[0].terms).toHaveLength(1);
    expect(result[0].terms[0].term).toBe('YAGNI');
  });

  it('filtra por alias (aka)', () => {
    const result = filterGlossary(SAMPLE, 'repeat yourself');
    expect(result).toHaveLength(1);
    expect(result[0].terms[0].term).toBe('DRY');
  });

  it('filtra por descripción', () => {
    const result = filterGlossary(SAMPLE, 'incompetencia');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('liderazgo');
  });

  it('es tolerante a acentos en la consulta', () => {
    const result = filterGlossary(SAMPLE, 'péter');
    expect(result).toHaveLength(1);
    expect(result[0].terms[0].term).toBe('Principio de Peter');
  });

  it('devuelve lista vacía cuando no hay coincidencias', () => {
    expect(filterGlossary(SAMPLE, 'xyz-inexistente')).toEqual([]);
  });

  it('no muta las categorías originales', () => {
    const result = filterGlossary(SAMPLE, 'dry');
    expect(result[0]).not.toBe(SAMPLE[0]);
    expect(SAMPLE[0].terms).toHaveLength(2);
  });
});

describe('countTerms', () => {
  it('suma los términos de todas las categorías', () => {
    expect(countTerms(SAMPLE)).toBe(3);
  });

  it('devuelve 0 para una lista vacía', () => {
    expect(countTerms([])).toBe(0);
  });
});
