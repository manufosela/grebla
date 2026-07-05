import { describe, it, expect } from 'vitest';
import {
  EMPTY_ENDORSEMENTS,
  normalizeEndorsements,
  endorsementFor,
  addEndorsement,
  removeEndorsement,
  endorsedCount,
} from './endorsements.js';

const NOW = '2026-07-05T12:00:00.000Z';
const MANAGER = { uid: 'lead-1', name: 'Grace' };

describe('normalizeEndorsements (saneo del doc, JG-6)', () => {
  it('sin documento devuelve avales vacíos', () => {
    expect(normalizeEndorsements(null)).toEqual({ byCity: {} });
    expect(normalizeEndorsements(undefined)).toEqual({ byCity: {} });
    expect(normalizeEndorsements({})).toEqual({ byCity: {} });
  });

  it('conserva registros válidos con su firmante y su fecha', () => {
    const e = normalizeEndorsements({
      byCity: { 'bases/html': { by: MANAGER, at: NOW } },
    });
    expect(e.byCity['bases/html']).toEqual({ by: MANAGER, at: NOW });
  });

  it('una fecha corrupta cae a null («fecha no registrada»), nunca inventada', () => {
    const e = normalizeEndorsements({
      byCity: { 'bases/html': { by: MANAGER, at: 12345 } },
    });
    expect(e.byCity['bases/html']).toEqual({ by: MANAGER, at: null });
  });

  it('descarta basura: sin firmante, firmante incompleto, claves vacías, no-objetos', () => {
    const e = normalizeEndorsements({
      byCity: {
        'bases/html': { at: NOW }, // sin by
        'bases/css': { by: { uid: 'x' }, at: NOW }, // by sin name
        'bases/js': { by: { uid: '', name: 'Grace' }, at: NOW }, // uid vacío
        '': { by: MANAGER, at: NOW }, // clave vacía
        'bases/testing': 'avalado', // no-objeto
      },
    });
    expect(e.byCity).toEqual({});
  });
});

describe('endorsementFor (el sello de una casa)', () => {
  it('devuelve el aval de la casa, o null si nadie la selló', () => {
    const e = { byCity: { 'bases/html': { by: MANAGER, at: NOW } } };
    expect(endorsementFor(e, 'bases/html')).toEqual({ by: MANAGER, at: NOW });
    expect(endorsementFor(e, 'bases/css')).toBeNull();
    expect(endorsementFor(null, 'bases/html')).toBeNull();
  });
});

describe('addEndorsement (firmar el sello, inmutable y solo-añadir)', () => {
  it('añade el aval sin mutar los avales de partida', () => {
    const before = { byCity: {} };
    const after = addEndorsement(before, 'bases/html', MANAGER, NOW);
    expect(after.byCity['bases/html']).toEqual({ by: MANAGER, at: NOW });
    expect(before.byCity).toEqual({}); // inmutable
    expect(after).not.toBe(before);
  });

  it('NO re-escribe un aval existente: devuelve los avales tal cual (misma referencia)', () => {
    const before = addEndorsement(EMPTY_ENDORSEMENTS, 'bases/html', MANAGER, NOW);
    const again = addEndorsement(before, 'bases/html', { uid: 'otro', name: 'Otro' }, '2027-01-01T00:00:00Z');
    expect(again).toBe(before); // el primer sello es el que cuenta
    expect(again.byCity['bases/html'].by).toEqual(MANAGER);
  });

  it('conserva los avales previos al añadir uno nuevo', () => {
    const one = addEndorsement(EMPTY_ENDORSEMENTS, 'bases/html', MANAGER, NOW);
    const two = addEndorsement(one, 'bases/css', MANAGER, NOW);
    expect(Object.keys(two.byCity).sort()).toEqual(['bases/css', 'bases/html']);
  });

  it('falla en alto con datos inválidos (sin casa, sin firmante, sin fecha)', () => {
    expect(() => addEndorsement(EMPTY_ENDORSEMENTS, '', MANAGER, NOW)).toThrow(/cityId/);
    expect(() => addEndorsement(EMPTY_ENDORSEMENTS, 'bases/html', { uid: '', name: '' }, NOW)).toThrow(/firmante/);
    expect(() => addEndorsement(EMPTY_ENDORSEMENTS, 'bases/html', MANAGER, '')).toThrow(/fecha/);
  });
});

describe('removeEndorsement (retirar el sello, inmutable)', () => {
  it('quita el aval sin mutar los avales de partida', () => {
    const before = addEndorsement(EMPTY_ENDORSEMENTS, 'bases/html', MANAGER, NOW);
    const after = removeEndorsement(before, 'bases/html');
    expect(after.byCity).toEqual({});
    expect(before.byCity['bases/html']).toBeDefined(); // inmutable
  });

  it('sin aval que retirar devuelve los avales tal cual (misma referencia)', () => {
    const e = addEndorsement(EMPTY_ENDORSEMENTS, 'bases/html', MANAGER, NOW);
    expect(removeEndorsement(e, 'bases/css')).toBe(e);
  });

  it('solo quita la casa pedida: el resto de sellos se quedan', () => {
    const one = addEndorsement(EMPTY_ENDORSEMENTS, 'bases/html', MANAGER, NOW);
    const two = addEndorsement(one, 'bases/css', MANAGER, NOW);
    const after = removeEndorsement(two, 'bases/html');
    expect(Object.keys(after.byCity)).toEqual(['bases/css']);
  });
});

describe('endorsedCount (contador de la ficha)', () => {
  it('cuenta los certificados avalados; vacío o ausente → 0', () => {
    expect(endorsedCount(null)).toBe(0);
    expect(endorsedCount(EMPTY_ENDORSEMENTS)).toBe(0);
    const one = addEndorsement(EMPTY_ENDORSEMENTS, 'bases/html', MANAGER, NOW);
    expect(endorsedCount(one)).toBe(1);
    expect(endorsedCount(addEndorsement(one, 'bases/css', MANAGER, NOW))).toBe(2);
  });
});
