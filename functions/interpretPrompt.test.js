import { describe, it, expect } from 'vitest';
import {
  buildInterpretPrompt, isInterpretableTool, INTERPRET_TOOL, INTERPRET_TOOLS,
} from './interpretPrompt.js';

const resumen = [
  { label: 'Despliegues por semana', state: 'valor', value: '12' },
  { label: 'Fallo en producción', state: 'sinFuente', note: 'no hay registro de incidentes' },
  { label: 'Trabajo en curso', state: 'sinDato' },
];

describe('qué se puede interpretar', () => {
  it('hoy, solo Entrega', () => {
    expect(INTERPRET_TOOLS).toEqual(['entrega']);
    expect(isInterpretableTool('entrega')).toBe(true);
  });

  it('las herramientas retiradas ya no: no se interpreta lo que no se calcula', () => {
    expect(isInterpretableTool('dora')).toBe(false);
    expect(isInterpretableTool('lean')).toBe(false);
    expect(isInterpretableTool('')).toBe(false);
    expect(isInterpretableTool(null)).toBe(false);
  });

  it('y pedirlo falla en alto en vez de mandar un prompt a medias', () => {
    expect(() => buildInterpretPrompt('dora', resumen)).toThrow(/dora/);
  });
});

describe('lo que el prompt PROHÍBE', () => {
  const prompt = buildInterpretPrompt('entrega', resumen);

  it('interpretar a personas: estas métricas son del sistema', () => {
    expect(prompt).toContain('NUNCA de personas');
    expect(prompt).toContain('No menciones ni evalúes a personas concretas');
  });

  it('rellenar los huecos, que es el error que deshace todo el trabajo', () => {
    // El resumen se toma la molestia de distinguir «no se puede medir» de «no
    // hay medida esta semana». Una conjetura encima convierte la ausencia en
    // dato, que es justo lo que se evitó al pintarla.
    expect(prompt).toContain('sinFuente');
    expect(prompt).toContain('sinDato');
    expect(prompt).toContain('NO saques conclusiones');
    expect(prompt).toMatch(/ni lo estimes a partir de otra métrica/);
  });

  it('y deja abierta la salida honesta: que todavía no se pueda juzgar', () => {
    expect(prompt).toContain('todavía no se puede juzgar');
  });
});

describe('lo que el prompt lleva', () => {
  it('el resumen tal cual, en JSON, sin recortarlo por el camino', () => {
    const prompt = buildInterpretPrompt('entrega', resumen);
    expect(prompt).toContain(JSON.stringify(resumen));
  });

  it('aguanta un resumen vacío sin romperse', () => {
    expect(buildInterpretPrompt('entrega', [])).toContain('[]');
  });

  it('avisa de que el recuento no es un porcentaje', () => {
    expect(buildInterpretPrompt('entrega', resumen)).toContain('recuento');
  });
});

describe('la forma de la respuesta', () => {
  it('no es prosa libre: son campos, y el veredicto es cerrado', () => {
    expect(INTERPRET_TOOL.input_schema.properties.verdict.enum).toEqual(['bien', 'regular', 'mal']);
    expect(INTERPRET_TOOL.input_schema.required).toEqual(['verdict', 'summary']);
  });
});
