import { describe, it, expect } from 'vitest';
import {
  KUDO_MAX_LEN,
  isoWeekKey,
  validateKudoInput,
  groupWallByWeek,
} from './kudos.js';

describe('isoWeekKey', () => {
  it('calcula la semana ISO de fechas normales', () => {
    expect(isoWeekKey(new Date('2026-08-04T12:00:00Z'))).toBe('2026-W32');
    expect(isoWeekKey(new Date('2026-01-19T00:00:00Z'))).toBe('2026-W04');
  });

  it('bordes de año: los primeros días pueden caer en la última semana del año anterior', () => {
    // El 1 de enero de 2027 es viernes → pertenece a la W53 de 2026.
    expect(isoWeekKey(new Date('2027-01-01T12:00:00Z'))).toBe('2026-W53');
    // El 31 de diciembre de 2024 es martes → W01 de 2025.
    expect(isoWeekKey(new Date('2024-12-31T12:00:00Z'))).toBe('2025-W01');
  });

  it('el lunes y el domingo de la misma semana comparten clave', () => {
    expect(isoWeekKey(new Date('2026-08-03T00:00:00Z'))).toBe(
      isoWeekKey(new Date('2026-08-09T23:59:59Z')),
    );
  });

  it('rechaza fechas inválidas', () => {
    expect(() => isoWeekKey(new Date('nope'))).toThrow(/fecha/i);
  });
});

describe('validateKudoInput', () => {
  const base = { recipientPersonId: 'p1', publicText: 'Gracias por el apoyo', privateText: null };

  it('acepta un kudo válido y recorta espacios', () => {
    const out = validateKudoInput({ ...base, publicText: '  Gracias por el apoyo  ' });
    expect(out).toEqual({ recipientPersonId: 'p1', publicText: 'Gracias por el apoyo', privateText: null });
  });

  it('acepta solo privado (sin público)', () => {
    const out = validateKudoInput({ recipientPersonId: 'p1', publicText: '', privateText: 'Gracias de corazón' });
    expect(out).toEqual({ recipientPersonId: 'p1', publicText: null, privateText: 'Gracias de corazón' });
  });

  it('exige destinatario', () => {
    expect(() => validateKudoInput({ ...base, recipientPersonId: '' })).toThrow(/destinatario/i);
    expect(() => validateKudoInput({ ...base, recipientPersonId: 42 })).toThrow(/destinatario/i);
  });

  it('exige al menos un mensaje (solo espacios no cuenta)', () => {
    expect(() => validateKudoInput({ recipientPersonId: 'p1', publicText: '   ', privateText: '' })).toThrow(
      /al menos/i,
    );
  });

  it(`rechaza mensajes de más de ${KUDO_MAX_LEN} caracteres en cualquiera de los dos campos`, () => {
    const long = 'a'.repeat(KUDO_MAX_LEN + 1);
    expect(() => validateKudoInput({ ...base, publicText: long })).toThrow(/280/);
    expect(() => validateKudoInput({ ...base, privateText: long })).toThrow(/280/);
    expect(validateKudoInput({ ...base, publicText: 'a'.repeat(KUDO_MAX_LEN) }).publicText).toHaveLength(
      KUDO_MAX_LEN,
    );
  });

  it('rechaza tipos no-string en los textos', () => {
    expect(() => validateKudoInput({ ...base, publicText: 42 })).toThrow(/texto/i);
  });
});

describe('groupWallByWeek', () => {
  const kudo = (recipientPersonId, recipientName, weekKey, publicText = null) => ({
    id: `${recipientPersonId}-${weekKey}-${publicText ?? 'x'}`,
    recipientPersonId,
    recipientName,
    weekKey,
    publicText,
  });

  it('agrupa por semana y por persona, con los mensajes públicos de cada una', () => {
    const wall = groupWallByWeek([
      kudo('p1', 'Ana', '2026-W32', 'Gracias por la demo'),
      kudo('p1', 'Ana', '2026-W32', null),
      kudo('p2', 'Luis', '2026-W32', 'Por el rescate del deploy'),
      kudo('p1', 'Ana', '2026-W31', 'Semana anterior'),
    ]);
    expect([...wall.keys()]).toEqual(['2026-W32', '2026-W31']);
    const w32 = wall.get('2026-W32');
    expect(w32.map((p) => p.recipientPersonId)).toEqual(['p1', 'p2']);
    expect(w32[0]).toEqual({
      recipientPersonId: 'p1',
      recipientName: 'Ana',
      messages: ['Gracias por la demo'],
    });
  });

  it('NO es competición: orden neutro alfabético por nombre, sin contadores', () => {
    const wall = groupWallByWeek([
      kudo('p2', 'Zoe', '2026-W32', 'a'),
      kudo('p2', 'Zoe', '2026-W32', 'b'),
      kudo('p2', 'Zoe', '2026-W32', 'c'),
      kudo('p1', 'Ana', '2026-W32', 'd'),
    ]);
    const w32 = wall.get('2026-W32');
    // Ana primero aunque Zoe tenga más kudos: alfabético, nunca por cantidad.
    expect(w32.map((p) => p.recipientName)).toEqual(['Ana', 'Zoe']);
    expect(Object.keys(w32[0])).not.toContain('count');
  });

  it('semanas más recientes primero', () => {
    const wall = groupWallByWeek([
      kudo('p1', 'Ana', '2026-W02', 'x'),
      kudo('p1', 'Ana', '2026-W10', 'y'),
      kudo('p1', 'Ana', '2025-W52', 'z'),
    ]);
    expect([...wall.keys()]).toEqual(['2026-W10', '2026-W02', '2025-W52']);
  });
});
