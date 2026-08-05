import { describe, it, expect } from 'vitest';
import { splitSentences, toCapabilityItems, toResponsibilityItems } from './requirementPhrasing.js';

describe('splitSentences', () => {
  it('separa por punto + mayúscula y descarta vacíos', () => {
    expect(splitSentences('Toma decisiones. Sube el listón de calidad. ')).toEqual([
      'Toma decisiones',
      'Sube el listón de calidad',
    ]);
  });

  it('no parte abreviaturas tipo «p. ej.» ni paréntesis', () => {
    expect(splitSentences('Diagnostica problemas (p. ej. una query lenta) con ayuda.')).toEqual([
      'Diagnostica problemas (p. ej. una query lenta) con ayuda',
    ]);
  });
});

describe('toCapabilityItems — «Capacidad para …» (RMR-TSK-0417)', () => {
  it('el ejemplo literal del usuario', () => {
    expect(toCapabilityItems('Empieza a moldear cómo construye el equipo, no solo qué construye.')).toEqual([
      'Capacidad para moldear cómo construye el equipo, no solo qué construye',
    ]);
  });

  it('3ª persona → infinitivo con el diccionario', () => {
    expect(toCapabilityItems('Toma decisiones de arquitectura acertadas.')).toEqual([
      'Capacidad para tomar decisiones de arquitectura acertadas',
    ]);
    expect(toCapabilityItems('Es dueño de entregas completas.')).toEqual([
      'Capacidad para ser dueño de entregas completas',
    ]);
  });

  it('quita abridores aspectuales (Puede/Sabe) dejando el infinitivo que sigue', () => {
    expect(toCapabilityItems('Puede investigar un problema básico.')).toEqual([
      'Capacidad para investigar un problema básico',
    ]);
    expect(toCapabilityItems('Sabe señalar cuándo una decisión técnica perjudica.')).toEqual([
      'Capacidad para señalar cuándo una decisión técnica perjudica',
    ]);
  });

  it('«Va dominando» → dominar', () => {
    expect(toCapabilityItems('Va dominando el stack principal de su disciplina.')).toEqual([
      'Capacidad para dominar el stack principal de su disciplina',
    ]);
  });

  it('cada frase es un ítem propio', () => {
    const items = toCapabilityItems('Mentoriza a ingenieros Senior. Da feedback que cambia cómo piensa la gente.');
    expect(items).toEqual([
      'Capacidad para mentorizar a ingenieros Senior',
      'Capacidad para dar feedback que cambia cómo piensa la gente',
    ]);
  });

  it('una frase sin verbo reconocido se conserva TAL CUAL (no se inventa)', () => {
    expect(toCapabilityItems('Las revisiones de código son una herramienta de coaching.')).toEqual([
      'Las revisiones de código son una herramienta de coaching',
    ]);
  });
});

describe('toResponsibilityItems — infinitivo capitalizado', () => {
  it('convierte a infinitivo sin el prefijo de capacidad', () => {
    expect(toResponsibilityItems('Toma decisiones acertadas. Sube el listón en las revisiones.')).toEqual([
      'Tomar decisiones acertadas',
      'Subir el listón en las revisiones',
    ]);
  });

  it('conserva las frases no transformables', () => {
    expect(toResponsibilityItems('Su criterio moldea al equipo.')).toEqual(['Su criterio moldea al equipo']);
  });
});
