/**
 * Tests del dominio puro de Marea (RMR-TSK-0234): claves de día/semana y saneado.
 */
import { describe, it, expect } from 'vitest';
import { dayKey, isoWeekKey, sanitizePulse, PULSE_DIMS, PULSE_WORD_MAX } from './pulse.js';

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
