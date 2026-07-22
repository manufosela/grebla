/**
 * Lógica pura del acceso a retros: troceo para el límite del operador `in` de
 * Firestore y orden al fusionar lotes. Se testea aparte de la IO (que necesita
 * Firestore) porque es donde está el riesgo real del alcance de rama
 * (RMR-TSK-0294): perder documentos al trocear o devolverlos desordenados.
 */
import { describe, it, expect } from 'vitest';
import { chunkIds, byCreatedAtDesc } from './retros.js';

describe('chunkIds', () => {
  it('trocea en lotes de 30 como máximo (límite del `in` de Firestore)', () => {
    const ids = Array.from({ length: 65 }, (_, i) => `uid-${i}`);
    const chunks = chunkIds(ids);
    expect(chunks.map((c) => c.length)).toEqual([30, 30, 5]);
    expect(chunks.flat()).toEqual(ids); // no se pierde ninguno
  });

  it('deduplica y descarta valores vacíos', () => {
    expect(chunkIds(['a', 'a', '', null, 'b', undefined])).toEqual([['a', 'b']]);
  });

  it('sin ids no devuelve ningún lote (evita lanzar una query imposible)', () => {
    expect(chunkIds([])).toEqual([]);
    expect(chunkIds(undefined)).toEqual([]);
    expect(chunkIds([null, ''])).toEqual([]);
  });

  it('respeta un tamaño de lote a medida', () => {
    expect(chunkIds(['a', 'b', 'c'], 2)).toEqual([['a', 'b'], ['c']]);
  });
});

describe('byCreatedAtDesc', () => {
  const ts = (ms) => ({ toMillis: () => ms });

  it('deja los más recientes primero al fusionar lotes de distintos líderes', () => {
    const merged = [
      { id: 'vieja', createdAt: ts(100) },
      { id: 'nueva', createdAt: ts(300) },
      { id: 'media', createdAt: ts(200) },
    ].sort(byCreatedAtDesc);
    expect(merged.map((r) => r.id)).toEqual(['nueva', 'media', 'vieja']);
  });

  it('acepta milisegundos sueltos además de Timestamp de Firestore', () => {
    const merged = [{ id: 'a', createdAt: 10 }, { id: 'b', createdAt: 50 }].sort(byCreatedAtDesc);
    expect(merged.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('una retro recién creada (createdAt aún nulo por serverTimestamp) no rompe el orden', () => {
    const merged = [
      { id: 'sin-fecha', createdAt: null },
      { id: 'con-fecha', createdAt: ts(5) },
    ].sort(byCreatedAtDesc);
    expect(merged.map((r) => r.id)).toEqual(['con-fecha', 'sin-fecha']);
  });
});
