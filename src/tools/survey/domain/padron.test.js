import { describe, it, expect } from 'vitest';
import { parsePadron } from './padron.js';

describe('parsePadron', () => {
  it('con cabecera mapea por nombre en cualquier orden; las extras se conservan como custom (RMR-TSK-0355)', () => {
    const csv = [
      'Nombre,Email,Departamento,Fecha_alta,Fecha_nacimiento,Ubicacion,Otra',
      'Ana Ruiz,ana@x.com,People,2024-01-15,1990-05-02,Madrid,algo',
    ].join('\n');
    expect(parsePadron(csv)).toEqual([
      { email: 'ana@x.com', name: 'Ana Ruiz', department: 'People', hireDate: '2024-01-15', birthDate: '1990-05-02', location: 'Madrid', custom: { otra: 'algo' } },
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

describe('parsePadron — columnas custom (RMR-TSK-0355)', () => {
  it('las columnas de cabecera no reconocidas se conservan en custom (por slug)', () => {
    const csv = 'email,nombre,departamento,Género,Rango de edad\na@x.com,Ana,Data,Mujer,30-40\nb@x.com,Bo,Eng,Hombre,<30';
    const rows = parsePadron(csv);
    expect(rows[0].custom).toEqual({ genero: 'Mujer', rango_de_edad: '30-40' });
    expect(rows[1].custom).toEqual({ genero: 'Hombre', rango_de_edad: '<30' });
    expect(rows[0].department).toBe('Data');
  });

  it('celdas vacías no generan clave custom; sin extras no hay campo custom', () => {
    const csv = 'email,departamento,Género\na@x.com,Data,\nb@x.com,Eng,Mujer';
    const rows = parsePadron(csv);
    expect(rows[0].custom).toBeUndefined();
    expect(rows[1].custom).toEqual({ genero: 'Mujer' });
    const plain = parsePadron('email,departamento\na@x.com,Data');
    expect(plain[0].custom).toBeUndefined();
  });

  it('sin cabecera (orden posicional) no hay columnas custom', () => {
    const rows = parsePadron('a@x.com,Ana,Data');
    expect(rows[0].custom).toBeUndefined();
  });
});
