import { describe, it, expect } from 'vitest';
import { parseParticipants, padronToParticipants } from './participants.js';

describe('parseParticipants', () => {
  it('parsea email + departamento + fecha de alta', () => {
    expect(parseParticipants('ana@tribbuapp.com,People,2024-01-15')).toEqual([
      { email: 'ana@tribbuapp.com', metadata: { department: 'People', startDate: '2024-01-15' } },
    ]);
  });

  it('admite solo email (sin metadatos)', () => {
    expect(parseParticipants('bob@tribbuapp.com')).toEqual([{ email: 'bob@tribbuapp.com', metadata: {} }]);
  });

  it('acepta coma, punto y coma y tabulador', () => {
    const out = parseParticipants('a@x.com;Eng\nb@x.com\tData');
    expect(out).toEqual([
      { email: 'a@x.com', metadata: { department: 'Eng' } },
      { email: 'b@x.com', metadata: { department: 'Data' } },
    ]);
  });

  it('descarta líneas sin email válido y vacías', () => {
    expect(parseParticipants('\n  \nno-email\nc@x.com')).toEqual([{ email: 'c@x.com', metadata: {} }]);
  });

  it('deduplica por email (ignorando mayúsculas), gana la última', () => {
    const out = parseParticipants('A@x.com,Eng\na@x.com,Data');
    expect(out).toHaveLength(1);
    expect(out[0].metadata.department).toBe('Data');
  });

  it('con cabecera mapea por nombre en cualquier orden e ignora columnas extra', () => {
    const csv = 'Nombre,Email,Departamento,Fecha_alta,Otra\nAna Ruiz,ana@x.com,People,2024-01-15,basura';
    expect(parseParticipants(csv)).toEqual([
      { email: 'ana@x.com', metadata: { department: 'People', startDate: '2024-01-15' } },
    ]);
  });

  it('con cabecera de solo email', () => {
    expect(parseParticipants('email\nbob@x.com')).toEqual([{ email: 'bob@x.com', metadata: {} }]);
  });

  it('no confunde «no-email» (contiene «email») con una cabecera', () => {
    expect(parseParticipants('no-email\nc@x.com')).toEqual([{ email: 'c@x.com', metadata: {} }]);
  });
});

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

  it('parseParticipants reconoce columnas de nacimiento y ubicación por cabecera', () => {
    const csv = 'email,departamento,nacimiento,ciudad\nz@x.com,Eng,1988-05-02,Bilbao';
    expect(parseParticipants(csv)[0].metadata).toEqual({ department: 'Eng', birthDate: '1988-05-02', location: 'Bilbao' });
  });
});
