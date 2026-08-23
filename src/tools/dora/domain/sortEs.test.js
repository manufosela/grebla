import { describe, it, expect } from 'vitest';
import { sortedEs, compareEs } from './sortEs.js';

describe('sortedEs — orden alfabético como lo espera una persona', () => {
  it('las tildes no mandan el nombre al final', () => {
    // Con el orden por código UTF-16, «Ángel» cae detrás de «Zoe»: la Á está
    // fuera del rango ASCII. Es lo que se veía en los selectores de DORA.
    expect(sortedEs(['Zoe', 'Ángel', 'Ana'])).toEqual(['Ana', 'Ángel', 'Zoe']);
  });

  it('las mayúsculas no se agrupan aparte de las minúsculas', () => {
    expect(sortedEs(['iOS', 'Backend', 'android'])).toEqual(['android', 'Backend', 'iOS']);
  });

  it('la ñ va donde tiene que ir, entre la n y la o', () => {
    expect(sortedEs(['Ortega', 'Núñez', 'Nadal'])).toEqual(['Nadal', 'Núñez', 'Ortega']);
  });

  it('los números se ordenan por valor, no dígito a dígito', () => {
    expect(sortedEs(['Squad 10', 'Squad 2', 'Squad 1'])).toEqual(['Squad 1', 'Squad 2', 'Squad 10']);
  });

  it('no modifica la lista que recibe', () => {
    const original = ['Zoe', 'Ana'];
    expect(sortedEs(original)).toEqual(['Ana', 'Zoe']);
    expect(original).toEqual(['Zoe', 'Ana']);
  });

  it('aguanta una lista vacía o sin definir', () => {
    expect(sortedEs([])).toEqual([]);
    expect(sortedEs(undefined)).toEqual([]);
  });
});

describe('compareEs', () => {
  it('devuelve el signo esperado y trata los huecos como cadena vacía', () => {
    expect(compareEs('a', 'b')).toBeLessThan(0);
    expect(compareEs('b', 'a')).toBeGreaterThan(0);
    expect(compareEs('a', 'a')).toBe(0);
    expect(compareEs(null, '')).toBe(0);
  });
});
