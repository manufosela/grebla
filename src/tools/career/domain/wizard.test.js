import { describe, it, expect } from 'vitest';
import {
  QUESTION_STATUSES,
  normalizeQuestion,
  sortQuestionsByDateDesc,
  pendingQuestions,
  wizardState,
} from './wizard.js';

/** Consulta de prueba con overrides. @param {object} [over] */
const q = (over = {}) => ({
  id: 'q1',
  islandId: 'island',
  islandName: 'Bases de software',
  text: '¿Por dónde empiezo con testing?',
  status: 'pending',
  createdAt: '2026-07-04T10:00:00.000Z',
  ...over,
});

describe('wizard — dominio del brujo (MC-22)', () => {
  it('expone los tres estados válidos de consulta', () => {
    expect(QUESTION_STATUSES).toEqual(['pending', 'answered', 'seen']);
  });

  describe('normalizeQuestion', () => {
    it('sanea strings y conserva los campos presentes', () => {
      const normalized = normalizeQuestion(
        q({
          text: '  ¿Qué es TDD?  ',
          createdBy: { uid: 'u1', name: ' Ada ' },
          answer: ' Empieza por un test. ',
          answeredAt: '2026-07-04T12:00:00.000Z',
          answeredBy: { uid: 'u2', name: 'Líder' },
          creditedTo: ' Grace ',
          seenAt: '2026-07-04T13:00:00.000Z',
          status: 'seen',
        }),
      );
      expect(normalized).toEqual({
        id: 'q1',
        islandId: 'island',
        islandName: 'Bases de software',
        text: '¿Qué es TDD?',
        status: 'seen',
        createdAt: '2026-07-04T10:00:00.000Z',
        createdBy: { uid: 'u1', name: 'Ada' },
        answer: 'Empieza por un test.',
        answeredAt: '2026-07-04T12:00:00.000Z',
        answeredBy: { uid: 'u2', name: 'Líder' },
        creditedTo: 'Grace',
        seenAt: '2026-07-04T13:00:00.000Z',
      });
    });

    it('omite los opcionales ausentes y las autorías corruptas', () => {
      const normalized = normalizeQuestion(q({ createdBy: { uid: '', name: 'X' } }));
      expect(normalized.createdBy).toBeUndefined();
      expect('answer' in normalized).toBe(false);
      expect('creditedTo' in normalized).toBe(false);
    });

    it('degrada un estado desconocido de forma visible: con respuesta → answered, sin ella → pending', () => {
      expect(normalizeQuestion(q({ status: 'wat' })).status).toBe('pending');
      expect(normalizeQuestion(q({ status: 'wat', answer: 'Hecho.' })).status).toBe('answered');
    });

    it('falla en alto sin objeto o sin id (nunca una consulta anónima)', () => {
      expect(() => normalizeQuestion(null)).toThrow();
      expect(() => normalizeQuestion(q({ id: '  ' }))).toThrow();
    });
  });

  describe('sortQuestionsByDateDesc', () => {
    it('ordena por fecha descendente y manda las fechas vacías al final', () => {
      const list = [
        q({ id: 'a', createdAt: '2026-07-01T00:00:00.000Z' }),
        q({ id: 'b', createdAt: '' }),
        q({ id: 'c', createdAt: '2026-07-03T00:00:00.000Z' }),
      ];
      expect(sortQuestionsByDateDesc(list).map((x) => x.id)).toEqual(['c', 'a', 'b']);
      // No muta la lista original.
      expect(list.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    });

    it('desempata por id de forma determinista', () => {
      const list = [q({ id: 'b' }), q({ id: 'a' })];
      expect(sortQuestionsByDateDesc(list).map((x) => x.id)).toEqual(['a', 'b']);
    });
  });

  describe('pendingQuestions', () => {
    it('devuelve solo las pendientes en orden de llegada (FIFO)', () => {
      const list = [
        q({ id: 'nueva', createdAt: '2026-07-04T00:00:00.000Z' }),
        q({ id: 'resuelta', status: 'answered', createdAt: '2026-07-02T00:00:00.000Z' }),
        q({ id: 'vieja', createdAt: '2026-07-01T00:00:00.000Z' }),
      ];
      expect(pendingQuestions(list).map((x) => x.id)).toEqual(['vieja', 'nueva']);
    });
  });

  describe('wizardState', () => {
    it('sin consultas (o solo vistas) → none', () => {
      expect(wizardState([])).toBe('none');
      expect(wizardState(undefined)).toBe('none');
      expect(wizardState([q({ status: 'seen' })])).toBe('none');
    });

    it('con alguna pendiente y ninguna respondida → pending', () => {
      expect(wizardState([q(), q({ id: 'q2', status: 'seen' })])).toBe('pending');
    });

    it('con alguna respondida → ready (la respuesta manda sobre lo pendiente)', () => {
      expect(wizardState([q(), q({ id: 'q2', status: 'answered' })])).toBe('ready');
    });
  });
});
