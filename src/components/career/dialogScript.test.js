/**
 * Tests de la máquina de estados PURA del guion de <game-dialog> (JG-8):
 * normalización de pasos, avance narrativo, resolución de interacciones con
 * continuación en caliente y validaciones del formulario/opciones.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeStep,
  createDialog,
  currentStep,
  isDone,
  advance,
  continueDialog,
  validateSubmission,
  assertChoice,
} from './dialogScript.js';

describe('normalizeStep', () => {
  it('valida un say con texto', () => {
    expect(normalizeStep({ kind: 'say', text: '  Hola, viajero.  ' })).toEqual({
      kind: 'say',
      text: 'Hola, viajero.',
    });
  });

  it('rechaza un say sin texto', () => {
    expect(() => normalizeStep({ kind: 'say', text: '   ' })).toThrow(/necesita texto/);
  });

  it('rechaza tipos desconocidos y no-objetos', () => {
    expect(() => normalizeStep({ kind: 'dance' })).toThrow(/desconocido/);
    expect(() => normalizeStep(null)).toThrow(/objeto/);
  });

  it('completa placeholder y submitLabel del ask con los defaults', () => {
    const step = normalizeStep({ kind: 'ask' });
    expect(step).toEqual({ kind: 'ask', placeholder: 'Escribe aquí…', submitLabel: 'Enviar' });
  });

  it('conserva los textos propios del ask', () => {
    const step = normalizeStep({
      kind: 'ask',
      text: 'Cuéntame…',
      placeholder: 'Tu duda',
      submitLabel: 'Consultar',
    });
    expect(step).toEqual({
      kind: 'ask',
      text: 'Cuéntame…',
      placeholder: 'Tu duda',
      submitLabel: 'Consultar',
    });
  });

  it('valida el efecto trance y rechaza efectos desconocidos', () => {
    expect(normalizeStep({ kind: 'effect', effect: 'trance', text: 'mmm…' })).toEqual({
      kind: 'effect',
      effect: 'trance',
      text: 'mmm…',
    });
    expect(() => normalizeStep({ kind: 'effect', effect: 'explode' })).toThrow(/efecto/);
  });

  it('valida choices: opciones con id/label, sin duplicados ni vacíos', () => {
    const step = normalizeStep({
      kind: 'choices',
      text: '¿Te sirve?',
      options: [{ id: 'ok', label: 'Entendido' }],
    });
    expect(step.options).toEqual([{ id: 'ok', label: 'Entendido' }]);
    expect(() => normalizeStep({ kind: 'choices', options: [] })).toThrow(/al menos una/);
    expect(() =>
      normalizeStep({ kind: 'choices', options: [{ id: 'a', label: '' }] }),
    ).toThrow(/id y label/);
    expect(() =>
      normalizeStep({
        kind: 'choices',
        options: [
          { id: 'a', label: 'A' },
          { id: 'a', label: 'B' },
        ],
      }),
    ).toThrow(/duplicada/);
  });
});

describe('createDialog / currentStep / isDone', () => {
  it('arranca en el primer paso', () => {
    const dialog = createDialog([{ kind: 'say', text: 'Hola' }]);
    expect(dialog.index).toBe(0);
    expect(currentStep(dialog)?.kind).toBe('say');
    expect(isDone(dialog)).toBe(false);
  });

  it('rechaza guiones vacíos o no-array', () => {
    expect(() => createDialog([])).toThrow(/al menos un paso/);
    expect(() => createDialog(undefined)).toThrow(/al menos un paso/);
  });

  it('un paso malformado en el guion revienta al crear (no en mitad de la escena)', () => {
    expect(() => createDialog([{ kind: 'say', text: 'ok' }, { kind: 'say' }])).toThrow();
  });
});

describe('advance', () => {
  it('avanza say y effect, y termina el guion', () => {
    let dialog = createDialog([
      { kind: 'say', text: 'Hola' },
      { kind: 'effect', effect: 'trance' },
    ]);
    dialog = advance(dialog);
    expect(currentStep(dialog)?.kind).toBe('effect');
    dialog = advance(dialog);
    expect(isDone(dialog)).toBe(true);
    expect(currentStep(dialog)).toBeNull();
  });

  it('no muta el estado anterior (inmutable)', () => {
    const dialog = createDialog([{ kind: 'say', text: 'Hola' }]);
    const next = advance(dialog);
    expect(dialog.index).toBe(0);
    expect(next.index).toBe(1);
  });

  it('rechaza avanzar un ask/choices (esperan al jugador) o un guion terminado', () => {
    const asking = createDialog([{ kind: 'ask' }]);
    expect(() => advance(asking)).toThrow(/continueDialog/);
    const chosen = createDialog([{ kind: 'choices', options: [{ id: 'a', label: 'A' }] }]);
    expect(() => advance(chosen)).toThrow(/continueDialog/);
    const done = advance(createDialog([{ kind: 'say', text: 'fin' }]));
    expect(() => advance(done)).toThrow(/terminó/);
  });
});

describe('continueDialog', () => {
  it('resuelve el ask actual encolando la continuación (trance + despedida)', () => {
    let dialog = createDialog([{ kind: 'ask', placeholder: 'Tu duda' }]);
    dialog = continueDialog(dialog, [
      { kind: 'effect', effect: 'trance', text: 'mmm…' },
      { kind: 'say', text: 'Está hecho.' },
    ]);
    expect(dialog.steps).toHaveLength(3);
    expect(currentStep(dialog)).toEqual({ kind: 'effect', effect: 'trance', text: 'mmm…' });
    dialog = advance(dialog);
    expect(currentStep(dialog)?.text).toBe('Está hecho.');
  });

  it('sin pasos extra simplemente avanza (choices resuelto sin cola)', () => {
    const dialog = createDialog([
      { kind: 'choices', options: [{ id: 'ok', label: 'Entendido' }] },
      { kind: 'say', text: 'Seguimos.' },
    ]);
    const next = continueDialog(dialog);
    expect(currentStep(next)?.text).toBe('Seguimos.');
  });

  it('valida los pasos encolados y rechaza continuar un guion terminado', () => {
    const dialog = createDialog([{ kind: 'ask' }]);
    expect(() => continueDialog(dialog, [{ kind: 'say' }])).toThrow(/necesita texto/);
    const done = continueDialog(dialog);
    expect(() => continueDialog(done)).toThrow(/terminó/);
  });
});

describe('validateSubmission', () => {
  it('sanea el texto del jugador en un ask', () => {
    const dialog = createDialog([{ kind: 'ask' }]);
    expect(validateSubmission(dialog, '  ¿Cómo subo de nivel?  ')).toBe('¿Cómo subo de nivel?');
  });

  it('rechaza texto vacío con mensaje mostrable', () => {
    const dialog = createDialog([{ kind: 'ask' }]);
    expect(() => validateSubmission(dialog, '   ')).toThrow(/Escribe algo/);
    expect(() => validateSubmission(dialog, undefined)).toThrow(/Escribe algo/);
  });

  it('rechaza enviar texto fuera de un ask', () => {
    const dialog = createDialog([{ kind: 'say', text: 'Hola' }]);
    expect(() => validateSubmission(dialog, 'algo')).toThrow(/no espera texto/);
  });
});

describe('assertChoice', () => {
  it('devuelve la opción elegida si existe', () => {
    const dialog = createDialog([
      { kind: 'choices', options: [{ id: 'ok', label: 'Entendido' }] },
    ]);
    expect(assertChoice(dialog, 'ok')).toEqual({ id: 'ok', label: 'Entendido' });
  });

  it('rechaza opciones desconocidas o pasos sin opciones', () => {
    const dialog = createDialog([
      { kind: 'choices', options: [{ id: 'ok', label: 'Entendido' }] },
    ]);
    expect(() => assertChoice(dialog, 'nope')).toThrow(/desconocida/);
    const saying = createDialog([{ kind: 'say', text: 'Hola' }]);
    expect(() => assertChoice(saying, 'ok')).toThrow(/no ofrece opciones/);
  });
});
