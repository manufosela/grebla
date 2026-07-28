import { describe, it, expect } from 'vitest';
import { parsePadron } from './padron.js';

describe('parsePadron', () => {
  it('con cabecera mapea por nombre en cualquier orden, ignorando extras', () => {
    const csv = [
      'Nombre,Email,Departamento,Fecha_alta,Fecha_nacimiento,Ubicacion,Otra',
      'Ana Ruiz,ana@x.com,People,2024-01-15,1990-05-02,Madrid,basura',
    ].join('\n');
    expect(parsePadron(csv)).toEqual([
      { email: 'ana@x.com', name: 'Ana Ruiz', department: 'People', hireDate: '2024-01-15', birthDate: '1990-05-02', location: 'Madrid' },
    ]);
  });

  it('distingue fecha de alta y de nacimiento por su nombre', () => {
    const [p] = parsePadron('email,fecha_nacimiento,fecha_alta\nbob@x.com,1985-03-03,2020-09-01');
    expect(p.birthDate).toBe('1985-03-03');
    expect(p.hireDate).toBe('2020-09-01');
  });

  it('sin cabecera usa el orden posicional', () => {
    expect(parsePadron('c@x.com,Carla,Eng,2022-01-01,1992-07-07,Remoto')).toEqual([
      { email: 'c@x.com', name: 'Carla', department: 'Eng', hireDate: '2022-01-01', birthDate: '1992-07-07', location: 'Remoto' },
    ]);
  });

  it('descarta filas sin email y deduplica por email (gana la última)', () => {
    const out = parsePadron('email,departamento\nsin-email,X\nA@x.com,Eng\na@x.com,Data');
    expect(out).toHaveLength(1);
    expect(out[0].department).toBe('Data');
  });

  it('admite solo email', () => {
    expect(parsePadron('email\nsolo@x.com')).toEqual([{ email: 'solo@x.com' }]);
  });
});
