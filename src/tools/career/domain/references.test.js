import { describe, it, expect } from 'vitest';
import { sanitizeReference, isValidReference, cityRefKey, REF_TITLE_MAX, REF_NOTE_MAX } from './references.js';

describe('sanitizeReference', () => {
  it('hace trim y recorta a los máximos', () => {
    const out = sanitizeReference({ url: '  https://x.io  ', title: ' ' + 'a'.repeat(120), note: ' hola ' });
    expect(out.url).toBe('https://x.io');
    expect(out.title).toHaveLength(REF_TITLE_MAX);
    expect(out.note).toBe('hola');
  });
  it('campos ausentes o no-string → cadenas vacías', () => {
    expect(sanitizeReference({})).toEqual({ url: '', title: '', note: '' });
    expect(sanitizeReference({ url: 5, title: null, note: {} })).toEqual({ url: '', title: '', note: '' });
  });
  it('recorta la nota al máximo', () => {
    expect(sanitizeReference({ note: 'n'.repeat(300) }).note).toHaveLength(REF_NOTE_MAX);
  });
});

describe('isValidReference', () => {
  it('exige url http(s) y título', () => {
    expect(isValidReference({ url: 'https://x.io', title: 'Curso' })).toBe(true);
    expect(isValidReference({ url: 'http://x.io/a', title: 'A' })).toBe(true);
  });
  it('rechaza sin título, sin url o con esquema no http', () => {
    expect(isValidReference({ url: 'https://x.io', title: '   ' })).toBe(false);
    expect(isValidReference({ url: '', title: 'A' })).toBe(false);
    expect(isValidReference({ url: 'ftp://x.io', title: 'A' })).toBe(false);
    expect(isValidReference({ url: 'javascript:alert(1)', title: 'A' })).toBe(false);
  });
});

describe('cityRefKey', () => {
  it('combina isla y ciudad', () => {
    expect(cityRefKey('island', 'kubernetes')).toBe('island::kubernetes');
    expect(cityRefKey(undefined, undefined)).toBe('::');
  });
});
