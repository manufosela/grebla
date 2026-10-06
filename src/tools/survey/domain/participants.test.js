import { describe, it, expect } from 'vitest';
import { padronToParticipants } from './participants.js';

describe('padronToParticipants', () => {
  const padron = [
    { email: 'a@x.com', department: 'Eng', hireDate: '2022-01-01', active: true },
    { email: 'b@x.com', department: 'People', hireDate: '2020-05-01' },
    { email: 'c@x.com', department: 'Eng', active: false },
    { email: 'sin-arroba', department: 'Eng' },
  ];

  it('mapea hireDate→startDate y descarta emails inválidos', () => {
    expect(padronToParticipants(padron, { onlyActive: false })).toEqual([
      { email: 'a@x.com', metadata: { department: 'Eng', startDate: '2022-01-01' } },
      { email: 'b@x.com', metadata: { department: 'People', startDate: '2020-05-01' } },
      { email: 'c@x.com', metadata: { department: 'Eng' } },
    ]);
  });

  it('por defecto excluye a las personas de baja', () => {
    const out = padronToParticipants(padron);
    expect(out.map((p) => p.email)).toEqual(['a@x.com', 'b@x.com']);
  });

  it('filtra por departamento', () => {
    const out = padronToParticipants(padron, { department: 'Eng', onlyActive: false });
    expect(out.map((p) => p.email)).toEqual(['a@x.com', 'c@x.com']);
  });

  it('pasa nacimiento y ubicación al metadata del token (la anonimización a tramos va en bucketMetadata)', () => {
    const out = padronToParticipants([{ email: 'd@x.com', department: 'X', birthDate: '1990-01-01', location: 'Madrid' }]);
    expect(out[0].metadata).toEqual({ department: 'X', birthDate: '1990-01-01', location: 'Madrid' });
  });
});

describe('padronToParticipants — ejes custom declarados (RMR-TSK-0355)', () => {
  const padron = [
    { email: 'a@x.com', department: 'Data', custom: { genero: 'Mujer', comentario: 'texto libre peligroso' } },
    { email: 'b@x.com', department: 'Eng', custom: { genero: 'Hombre', remoto: 'Híbrido' } },
    { email: 'c@x.com', department: 'Eng' },
  ];

  it('SOLO los ejes declarados viajan al metadata, planos (metadata[id]=valor)', () => {
    const out = padronToParticipants(padron, { axisIds: ['genero', 'remoto'] });
    expect(out[0].metadata.genero).toBe('Mujer');
    expect(out[0].metadata.comentario).toBeUndefined();
    expect(out[1].metadata.remoto).toBe('Híbrido');
    expect(out[2].metadata.genero).toBeUndefined();
  });

  it('sin ejes declarados no viaja ningún custom (comportamiento anterior intacto)', () => {
    const out = padronToParticipants(padron);
    expect(out[0].metadata).toEqual({ department: 'Data' });
  });
});
