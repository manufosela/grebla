import { describe, it, expect } from 'vitest';
import { validateResponses, sanitizeResponses, tenureBucket, ageBucket, bucketMetadata, answerId } from './survey.js';

const enps = { id: 'enps', type: 'scale', min: 1, max: 10, required: true };
const reason = { id: 'reason', type: 'text' };

describe('validateResponses (espejo del dominio)', () => {
  it('válido con la obligatoria respondida en rango', () => {
    expect(validateResponses([enps, reason], { enps: 9 }).valid).toBe(true);
  });
  it('inválido fuera de rango o si falta la obligatoria', () => {
    expect(validateResponses([enps], { enps: 11 }).valid).toBe(false);
    expect(validateResponses([enps], {}).valid).toBe(false);
  });
});

describe('sanitizeResponses', () => {
  const questions = [{ id: 'enps', type: 'scale' }, { id: 'reason', type: 'text' }];
  it('descarta claves que no son preguntas de la encuesta', () => {
    expect(sanitizeResponses(questions, { enps: 9, reason: 'ok', evil: 'x', __proto__: 'y' }))
      .toEqual({ enps: 9, reason: 'ok' });
  });
  it('sin respuestas devuelve objeto vacío', () => {
    expect(sanitizeResponses(questions, null)).toEqual({});
  });
});

describe('tenureBucket', () => {
  it('reparte en tramos', () => {
    expect(tenureBucket('2024-01-01T00:00:00Z', '2026-07-27T00:00:00Z')).toBe('1-3');
    expect(tenureBucket('2010-01-01T00:00:00Z', '2026-07-27T00:00:00Z')).toBe('10+');
  });
});

describe('ageBucket', () => {
  it('reparte la edad en tramos y descarta fechas inválidas', () => {
    expect(ageBucket('1995-06-01T00:00:00Z', '2026-07-27T00:00:00Z')).toBe('25-34'); // 31 años
    expect(ageBucket('1970-01-01T00:00:00Z', '2026-07-27T00:00:00Z')).toBe('55+');
    expect(ageBucket('no-fecha', '2026-07-27T00:00:00Z')).toBeNull();
  });
});

describe('bucketMetadata', () => {
  const REF = '2026-07-27T00:00:00Z';

  it('NUNCA copia el email ni las fechas exactas (alta/nacimiento)', () => {
    const meta = bucketMetadata({ email: 'ana@tribbuapp.com', startDate: '2024-01-01', birthDate: '1990-01-01', department: 'People', name: 'Ana' }, REF);
    expect(meta.email).toBeUndefined();
    expect(meta.startDate).toBeUndefined();
    expect(meta.birthDate).toBeUndefined();
    expect(meta.name).toBeUndefined();
    expect(meta.age).toBe('35-44'); // solo el tramo, nunca la fecha
  });

  it('convierte la fecha de alta en tramo y pasa department/location', () => {
    const meta = bucketMetadata({ startDate: '2024-01-01', department: 'People', location: 'Madrid' }, REF);
    expect(meta).toEqual({ department: 'People', location: 'Madrid', tenure: '1-3' });
  });

  it('sin fecha de alta no incluye tenure', () => {
    expect(bucketMetadata({ department: 'Eng' }, REF)).toEqual({ department: 'Eng' });
  });
});

describe('answerId', () => {
  it('es determinista para el mismo token+salt', () => {
    expect(answerId('tok-123', 'salt')).toBe(answerId('tok-123', 'salt'));
  });
  it('cambia con el token y con el salt (no se puede recomputar sin el salt)', () => {
    expect(answerId('tok-123', 'salt')).not.toBe(answerId('tok-999', 'salt'));
    expect(answerId('tok-123', 'salt')).not.toBe(answerId('tok-123', 'otro-salt'));
  });
  it('es un hex de 64 chars (sha256)', () => {
    expect(answerId('t', 's')).toMatch(/^[0-9a-f]{64}$/);
  });
});
