import { describe, it, expect } from 'vitest';
import {
  IDENTITY_FIELDS, IDENTITY_KEYS, IDENTITY_MAX_LEN, normalizeIdentity, labelOf,
} from './orgIdentity.js';

describe('lo que se guarda de la identidad', () => {
  it('es lista blanca: lo que no es un campo conocido no entra', () => {
    // Igual que normalizeJourney: si la forma la decide quien escribe, cualquiera
    // con permiso puede meter lo que quiera en el documento.
    const out = normalizeIdentity({ orgName: 'TRIBBU', colorFavorito: 'rojo' });
    expect(out.colorFavorito).toBeUndefined();
    expect(Object.keys(out).toSorted()).toEqual([...IDENTITY_KEYS].toSorted());
  });

  it('recorta los espacios: un rótulo con cola se ve igual y se compara distinto', () => {
    expect(normalizeIdentity({ orgName: '  TRIBBU  ' }).orgName).toBe('TRIBBU');
  });

  it('corta los rótulos largos, que son rótulos y no párrafos', () => {
    const largo = 'x'.repeat(200);
    expect(normalizeIdentity({ everyoneLabel: largo }).everyoneLabel).toHaveLength(IDENTITY_MAX_LEN);
  });

  it('el dominio se guarda en minúsculas y sin arroba', () => {
    expect(normalizeIdentity({ employeeDomain: '@TribbuApp.com' }).employeeDomain).toBe('tribbuapp.com');
  });

  it('lo que falta sale como cadena vacía, no como undefined', () => {
    const out = normalizeIdentity(null);
    for (const key of IDENTITY_KEYS) expect(out[key]).toBe('');
  });

  it('lo que no es texto se trata como vacío, no se convierte', () => {
    // Convertirlo pintaría «[object Object]» de rótulo: un bug disfrazado de dato.
    for (const basura of [{ a: 1 }, 42, [], true]) {
      expect(normalizeIdentity({ orgName: basura }).orgName).toBe('');
    }
  });
});

describe('cómo se llama quien tiene ficha (RMR-TSK-0639)', () => {
  it('por defecto «Tripulante»; cada instancia pone el suyo', () => {
    expect(labelOf({}, 'memberLabel')).toBe('Tripulante');
    expect(labelOf(normalizeIdentity({ memberLabel: ' TRIBBUlante ' }), 'memberLabel')).toBe('TRIBBUlante');
  });
});

describe('qué texto se enseña', () => {
  it('el de la instancia cuando lo hay', () => {
    expect(labelOf({ everyoneLabel: 'Toda la tribbu' }, 'everyoneLabel')).toBe('Toda la tribbu');
  });

  it('el del producto cuando está vacío: el defecto no desaparece por dejarlo en blanco', () => {
    for (const vacio of [null, undefined, {}, { everyoneLabel: '' }, { everyoneLabel: '   ' }]) {
      expect(labelOf(vacio, 'everyoneLabel')).toBe('Toda la organización');
    }
  });

  it('pedir un campo que no existe falla en alto, no devuelve vacío', () => {
    // Un rótulo vacío en pantalla es un bug que nadie reporta porque parece
    // intencionado; un error se arregla.
    expect(() => labelOf({}, 'inventado')).toThrow();
  });

  it('cada campo declara su defecto, aunque sea vacío', () => {
    for (const f of IDENTITY_FIELDS) expect(typeof f.fallback).toBe('string');
  });
});
