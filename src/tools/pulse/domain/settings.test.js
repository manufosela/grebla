/**
 * Tests del umbral de anonimato de Marea (RMR-TSK-0496).
 *
 * Lo que se defiende aquí no es el redondeo: es que el suelo de 3 aguante todo
 * lo que le echen —un 2, un «2», un vacío, un decimal— porque ese número es la
 * promesa que se le hizo a quien rellena su marea.
 */
import { describe, it, expect } from 'vitest';
import { sanitizeMinCount, validateMinCount, MIN_ANON, MAX_ANON, DEFAULT_ANON } from './settings.js';

describe('sanitizeMinCount: qué umbral se usa al calcular', () => {
  it('deja pasar un valor válido', () => {
    expect(sanitizeMinCount(5)).toBe(5);
  });

  it('nunca devuelve menos que el suelo, venga como venga', () => {
    // Si esto cede, el agregado empieza a señalar personas.
    for (const malo of [2, 1, 0, -7, '2', 2.9]) expect(sanitizeMinCount(malo)).toBe(MIN_ANON);
  });

  it('no pasa del techo: un umbral inalcanzable apaga la herramienta en silencio', () => {
    expect(sanitizeMinCount(9999)).toBe(MAX_ANON);
  });

  it('ante lo que no es número, el valor por defecto', () => {
    for (const basura of [null, undefined, 'cinco', {}, NaN]) expect(sanitizeMinCount(basura)).toBe(DEFAULT_ANON);
  });

  it('acepta un número escrito como texto, que es como llega de un formulario', () => {
    expect(sanitizeMinCount('7')).toBe(7);
  });
});

describe('validateMinCount: qué se puede guardar', () => {
  it('acepta lo que está en rango', () => {
    expect(validateMinCount(3)).toEqual({ ok: true });
    expect(validateMinCount(MAX_ANON)).toEqual({ ok: true });
  });

  it('rechaza bajar del suelo, y dice por qué', () => {
    const r = validateMinCount(2);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('anonimato');
  });

  it('rechaza pasarse del techo', () => {
    expect(validateMinCount(MAX_ANON + 1).ok).toBe(false);
  });

  it('rechaza lo que no es un entero en vez de redondearlo a espaldas de quien lo teclea', () => {
    for (const malo of [3.5, 'tres', null, undefined]) expect(validateMinCount(malo).ok).toBe(false);
  });
});
