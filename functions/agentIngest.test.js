import { describe, it, expect } from 'vitest';
import {
  INGEST_TYPES, bearerFrom, keyMatches, normalizeIngest,
  conversationIdFor, conversationFrom, personIsInScope,
} from './agentIngest.js';

/**
 * Ingesta de notas de 1-1 desde un agente externo (RMR-TSK-0549). Lo puro: qué
 * se acepta, qué id le toca a cada nota y qué documento acaba en la ficha.
 */
const nota = {
  email: ' Ana@Ejemplo.test ',
  type: 'o2o',
  date: '2026-09-22',
  notes: '  Hablamos de su paso a L2  ',
  summary: 'Acuerda preparar el diseño del servicio',
  source: { system: 'matias', id: 'thread-abc', url: 'https://mail.google.com/x/thread-abc' },
};

describe('bearerFrom y keyMatches', () => {
  it('saca la clave del header Authorization', () => {
    expect(bearerFrom('Bearer abc123')).toBe('abc123');
    expect(bearerFrom('bearer abc123')).toBe('abc123');
    expect(bearerFrom('Basic abc123')).toBe('');
    expect(bearerFrom(undefined)).toBe('');
  });

  it('compara sin filtrar el tiempo, y una clave vacía nunca vale', () => {
    expect(keyMatches('secreto', 'secreto')).toBe(true);
    expect(keyMatches('secreto', 'secretO')).toBe(false);
    expect(keyMatches('secreto', 'secreto-largo')).toBe(false);
    // Sin clave configurada no se abre la puerta a quien mande cadena vacía.
    expect(keyMatches('', '')).toBe(false);
  });
});

describe('normalizeIngest', () => {
  it('normaliza el email, recorta los textos y conserva el origen', () => {
    const limpia = normalizeIngest(nota);
    expect(limpia.email).toBe('ana@ejemplo.test');
    expect(limpia.notes).toBe('Hablamos de su paso a L2');
    expect(limpia.type).toBe('o2o');
    expect(limpia.source).toEqual({ system: 'matias', id: 'thread-abc', url: 'https://mail.google.com/x/thread-abc' });
  });

  it('solo acepta 1-1 y catchup: el resto de reuniones no viaja a la ficha', () => {
    expect(INGEST_TYPES).toEqual(['o2o', 'catchup']);
    expect(normalizeIngest({ ...nota, type: 'catchup' }).type).toBe('catchup');
    expect(() => normalizeIngest({ ...nota, type: 'planning' })).toThrow(/type/);
  });

  it('exige email, fecha, origen con sistema e id, y algo escrito', () => {
    expect(() => normalizeIngest({ ...nota, email: 'no-es-un-email' })).toThrow(/email/);
    expect(() => normalizeIngest({ ...nota, date: '22-09-2026' })).toThrow(/date/);
    // Y un día que no existe tampoco pasa: la forma no basta.
    expect(() => normalizeIngest({ ...nota, date: '2026-02-30' })).toThrow(/date/);
    expect(() => normalizeIngest({ ...nota, date: '2026-99-99' })).toThrow(/date/);
    expect(normalizeIngest({ ...nota, date: '2028-02-29' }).date).toBe('2028-02-29'); // bisiesto sí
    expect(() => normalizeIngest({ ...nota, source: { system: 'matias' } })).toThrow(/source/);
    expect(() => normalizeIngest({ ...nota, notes: '   ', summary: '' })).toThrow(/notes/);
  });

  it('una URL de origen que no es http(s) se descarta, no se guarda', () => {
    const limpia = normalizeIngest({ ...nota, source: { ...nota.source, url: 'javascript:alert(1)' } });
    expect(limpia.source.url).toBeNull();
  });

  it('acota el tamaño: una nota no es un volcado de correo entero', () => {
    const limpia = normalizeIngest({ ...nota, notes: 'x'.repeat(50_000) });
    expect(limpia.notes.length).toBeLessThanOrEqual(20_000);
  });
});

describe('conversationIdFor', () => {
  it('el mismo origen da el mismo id: reenviar no duplica', () => {
    const id = conversationIdFor(nota.source);
    expect(conversationIdFor({ ...nota.source, url: 'otra' })).toBe(id);
    expect(id).toMatch(/^agent-[a-f0-9]{24}$/);
  });

  it('orígenes distintos dan ids distintos, y el sistema cuenta', () => {
    expect(conversationIdFor({ system: 'matias', id: 'otro' })).not.toBe(conversationIdFor(nota.source));
    expect(conversationIdFor({ system: 'otro', id: 'thread-abc' })).not.toBe(conversationIdFor(nota.source));
  });
});

describe('conversationFrom', () => {
  const doc = conversationFrom(normalizeIngest(nota), { at: '2026-09-22T10:00:00.000Z' });

  it('es una conversación de la ficha, con su tipo y su fecha', () => {
    expect(doc.type).toBe('o2o');
    expect(doc.date).toBe('2026-09-22');
    expect(doc.notes).toBe('Hablamos de su paso a L2');
    expect(doc.transcription).toBe('');
  });

  it('queda marcada como AUTOMÁTICA y con quién la trajo: no es un registro del manager', () => {
    expect(doc.automated).toBe(true);
    expect(doc.createdBy.uid).toBe('agent:matias');
    expect(doc.createdBy.name).toMatch(/autom/i);
    expect(doc.source.url).toBe('https://mail.google.com/x/thread-abc');
  });
});

describe('personIsInScope', () => {
  it('dentro: persona activa con manager asignado', () => {
    expect(personIsInScope({ active: true, ownerLeaderUid: 'u-em' })).toBe(true);
    expect(personIsInScope({ ownerLeaderUid: 'u-em' })).toBe(true); // sin campo `active` cuenta como activa
  });

  it('fuera: sin manager, desactivada o externa', () => {
    expect(personIsInScope({ active: true, ownerLeaderUid: '' })).toBe(false);
    expect(personIsInScope({ active: false, ownerLeaderUid: 'u-em' })).toBe(false);
    expect(personIsInScope({ active: true, ownerLeaderUid: 'u-em', external: true })).toBe(false);
    expect(personIsInScope(null)).toBe(false);
  });
});
