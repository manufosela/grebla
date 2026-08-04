import { describe, it, expect } from 'vitest';
import {
  validateBookInput,
  validateLoan,
  validateRequestInput,
  bookLoanStatus,
} from './library.js';

describe('validateBookInput', () => {
  it('acepta un físico con lo mínimo y normaliza', () => {
    const out = validateBookInput({ title: '  Clean Code ', author: ' Robert C. Martin ', format: 'physical' });
    expect(out).toEqual({
      title: 'Clean Code',
      author: 'Robert C. Martin',
      format: 'physical',
      url: null,
      topics: [],
      recommended: false,
    });
  });

  it('un digital exige url http(s)', () => {
    expect(() => validateBookInput({ title: 'SICP', format: 'digital' })).toThrow(/enlace/i);
    expect(() => validateBookInput({ title: 'SICP', format: 'digital', url: 'ftp://x' })).toThrow(/enlace/i);
    const out = validateBookInput({ title: 'SICP', format: 'digital', url: 'https://ejemplo.com/sicp.pdf' });
    expect(out.url).toBe('https://ejemplo.com/sicp.pdf');
  });

  it('exige título y formato válido', () => {
    expect(() => validateBookInput({ title: '  ', format: 'physical' })).toThrow(/título/i);
    expect(() => validateBookInput({ title: 'X', format: 'vinilo' })).toThrow(/formato/i);
  });

  it('topics se normalizan (trim, sin vacíos)', () => {
    const out = validateBookInput({ title: 'DDIA', format: 'physical', topics: [' data ', '', 'arquitectura'] });
    expect(out.topics).toEqual(['data', 'arquitectura']);
  });
});

describe('validateLoan', () => {
  const now = new Date('2026-08-04T10:00:00Z');

  it('acepta persona + fecha futura', () => {
    const out = validateLoan(
      { personId: 'p1', personName: 'Ana', dueDate: '2026-08-25' },
      now,
    );
    expect(out).toEqual({ personId: 'p1', personName: 'Ana', dueDate: '2026-08-25' });
  });

  it('rechaza fecha pasada o de hoy (el compromiso mira adelante)', () => {
    expect(() => validateLoan({ personId: 'p1', personName: 'Ana', dueDate: '2026-08-04' }, now)).toThrow(/futura/i);
    expect(() => validateLoan({ personId: 'p1', personName: 'Ana', dueDate: '2026-07-01' }, now)).toThrow(/futura/i);
  });

  it('rechaza fecha inválida o ausente y nombre ausente', () => {
    expect(() => validateLoan({ personId: 'p1', personName: 'Ana', dueDate: 'pronto' }, now)).toThrow(/fecha/i);
    expect(() => validateLoan({ personId: 'p1', personName: 'Ana', dueDate: '' }, now)).toThrow(/fecha/i);
    expect(() => validateLoan({ personId: 'p1', personName: ' ', dueDate: '2026-08-25' }, now)).toThrow(/persona/i);
  });

  it('sin ficha vinculada: personId null con nombre vale', () => {
    expect(validateLoan({ personId: '', personName: 'Ana', dueDate: '2026-08-25' }, now).personId).toBeNull();
  });
});

describe('validateRequestInput', () => {
  it('acepta buy y upload con título', () => {
    expect(validateRequestInput({ type: 'buy', title: ' Team Topologies ', author: '', reason: '' })).toEqual({
      type: 'buy',
      title: 'Team Topologies',
      author: null,
      reason: null,
    });
    expect(validateRequestInput({ type: 'upload', title: 'SRE Book', reason: 'está libre en la web de Google' }).type).toBe('upload');
  });

  it('rechaza tipo desconocido y título vacío', () => {
    expect(() => validateRequestInput({ type: 'robar', title: 'X' })).toThrow(/tipo/i);
    expect(() => validateRequestInput({ type: 'buy', title: '  ' })).toThrow(/título/i);
  });
});

describe('bookLoanStatus', () => {
  const today = new Date('2026-08-04T10:00:00Z');

  it('libre si no hay préstamo', () => {
    expect(bookLoanStatus({ borrowedByPersonId: null, dueDate: null }, today)).toBe('free');
  });

  it('prestado, por vencer (≤7 días) y vencido', () => {
    expect(bookLoanStatus({ borrowedByPersonId: 'p1', dueDate: '2026-09-01' }, today)).toBe('borrowed');
    expect(bookLoanStatus({ borrowedByPersonId: 'p1', dueDate: '2026-08-08' }, today)).toBe('due-soon');
    expect(bookLoanStatus({ borrowedByPersonId: 'p1', dueDate: '2026-08-01' }, today)).toBe('overdue');
  });
});
