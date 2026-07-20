/**
 * Tests del dominio puro de Marea (RMR-TSK-0234): claves de día/semana y saneado.
 */
import { describe, it, expect } from 'vitest';
import { dayKey, isoWeekKey, parseWeekIso, weekRange, sanitizePulse, PULSE_DIMS, PULSE_WORD_MAX } from './pulse.js';

describe('dayKey', () => {
  it('formatea YYYY-MM-DD en hora local con ceros', () => {
    expect(dayKey(new Date(2026, 6, 5))).toBe('2026-07-05'); // 5 jul 2026 (mes 6 = julio)
    expect(dayKey(new Date(2026, 0, 1))).toBe('2026-01-01');
  });
});

describe('isoWeekKey', () => {
  it('calcula la semana ISO (lunes, primer jueves)', () => {
    // 2026-07-16 es jueves → semana ISO 29
    expect(isoWeekKey(new Date(Date.UTC(2026, 6, 16)))).toBe('2026-W29');
  });
  it('el 1 de enero puede caer en la última semana del año anterior', () => {
    // 2027-01-01 es viernes → pertenece a la semana ISO 53 de 2026
    expect(isoWeekKey(new Date(Date.UTC(2027, 0, 1)))).toBe('2026-W53');
  });
  it('días de la misma semana comparten clave', () => {
    const lun = isoWeekKey(new Date(Date.UTC(2026, 6, 13))); // lunes
    const vie = isoWeekKey(new Date(Date.UTC(2026, 6, 17))); // viernes
    expect(lun).toBe('2026-W29');
    expect(vie).toBe('2026-W29');
  });
});

describe('parseWeekIso', () => {
  it('descompone año y semana', () => {
    expect(parseWeekIso('2026-W29')).toEqual({ year: 2026, week: 29 });
    expect(parseWeekIso('2025-W01')).toEqual({ year: 2025, week: 1 });
  });
  it('devuelve null con formato inválido', () => {
    expect(parseWeekIso('2026-29')).toBeNull();
    expect(parseWeekIso('')).toBeNull();
    expect(parseWeekIso(null)).toBeNull();
  });
});

describe('sanitizePulse', () => {
  it('acota cada dimensión a 0..100 y redondea', () => {
    const out = sanitizePulse({ energia: 120, animo: -5, carga: 33.6, rumbo: 50, tripulacion: 'x', reconocimiento: 99 });
    expect(out.energia).toBe(100);
    expect(out.animo).toBe(0);
    expect(out.carga).toBe(34);
    expect(out.rumbo).toBe(50);
    expect(out.tripulacion).toBe(0); // no numérico → 0
    expect(out.reconocimiento).toBe(99);
  });
  it('rellena todas las dimensiones aunque falten en la entrada', () => {
    const out = sanitizePulse({});
    for (const dim of PULSE_DIMS) expect(out[dim]).toBe(0);
  });
  it('shareWord es opt-in explícito (por defecto false)', () => {
    expect(sanitizePulse({}).shareWord).toBe(false);
    expect(sanitizePulse({ shareWord: true }).shareWord).toBe(true);
    expect(sanitizePulse({ shareWord: 'yes' }).shareWord).toBe(false); // solo true literal
  });
  it('recorta la palabra y hace trim', () => {
    expect(sanitizePulse({ palabra: '  remando  ' }).palabra).toBe('remando');
    expect(sanitizePulse({ palabra: 'x'.repeat(60) }).palabra).toHaveLength(PULSE_WORD_MAX);
  });
  it('no arrastra campos ajenos al modelo', () => {
    const out = sanitizePulse({ energia: 10, uid: 'hacker', foo: 1 });
    expect(out.uid).toBeUndefined();
    expect(out.foo).toBeUndefined();
  });
});

describe('weekRange (RMR-TSK-0273)', () => {
  const iso = (d) => d.toISOString().slice(0, 10);

  it('da el lunes→viernes de la semana ISO', () => {
    const r = weekRange('2026-W30');
    expect(iso(r.start)).toBe('2026-07-20');
    expect(iso(r.end)).toBe('2026-07-24');
  });

  it('es el inverso de isoWeekKey (el lunes cae en su propia semana)', () => {
    for (const w of ['2026-W01', '2026-W30', '2025-W52']) {
      expect(isoWeekKey(weekRange(w).start)).toBe(w);
    }
  });

  it('semanas a caballo del año: la 1 puede empezar en diciembre', () => {
    expect(iso(weekRange('2026-W01').start)).toBe('2025-12-29');
    expect(iso(weekRange('2026-W53').end)).toBe('2027-01-01');
  });

  it('devuelve null si la clave no parsea', () => {
    expect(weekRange('no-va')).toBeNull();
    expect(weekRange('')).toBeNull();
    expect(weekRange(undefined)).toBeNull();
  });
});
