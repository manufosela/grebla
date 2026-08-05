import { describe, it, expect } from 'vitest';
import { sanitizePolishedItems, buildPolishPrompt, JD_POLISH_TOOL } from './jdPolish.js';

describe('sanitizePolishedItems — barandillas del pulido IA (RMR-TSK-0418)', () => {
  const original = [
    'Capacidad para identificar patrones que hay que mejorar en el código y lidera su adopción',
    'Capacidad para moldear cómo construye el equipo, no solo qué construye',
  ];

  it('acepta correcciones mínimas y respeta las intactas', () => {
    const polished = [
      'Capacidad para identificar patrones que hay que mejorar en el código y liderar su adopción',
      'Capacidad para moldear cómo construye el equipo, no solo qué construye',
    ];
    const { items, changed } = sanitizePolishedItems(original, polished);
    expect(items).toEqual(polished);
    expect(changed).toBe(1);
  });

  it('si el número de ítems no coincide, conserva TODOS los originales', () => {
    const { items, changed } = sanitizePolishedItems(original, ['solo uno']);
    expect(items).toEqual(original);
    expect(changed).toBe(0);
  });

  it('un ítem vacío o desproporcionado conserva su original (los demás sí pasan)', () => {
    const polished = [
      '',
      'Capacidad para moldear cómo construye el equipo, no solo qué construye (y además reescribo entero este ítem añadiendo un montón de contenido nuevo que la IA se ha inventado por su cuenta y que no estaba en el original de ninguna manera, violando la barandilla de longitud)',
    ];
    const { items, changed } = sanitizePolishedItems(original, polished);
    expect(items).toEqual(original);
    expect(changed).toBe(0);
  });

  it('entrada no-array → originales tal cual', () => {
    expect(sanitizePolishedItems(original, null).items).toEqual(original);
    expect(sanitizePolishedItems(original, 'nope').items).toEqual(original);
  });
});

describe('buildPolishPrompt / JD_POLISH_TOOL', () => {
  it('el prompt exige corregir SOLO lo roto y devolver el resto idéntico', () => {
    const prompt = buildPolishPrompt({ responsibilities: ['a'], niceToHave: ['b'], month3: 'c' });
    expect(prompt).toMatch(/EXACTAMENTE igual/i);
    expect(prompt).toMatch(/no añadas/i);
  });

  it('la tool declara los tres campos', () => {
    const props = JD_POLISH_TOOL.input_schema.properties;
    expect(Object.keys(props)).toEqual(expect.arrayContaining(['responsibilities', 'niceToHave', 'month3']));
  });
});
