import { describe, it, expect } from 'vitest';
import { parseParticipants } from './participants.js';

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
});
