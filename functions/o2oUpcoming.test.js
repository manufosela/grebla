import { describe, it, expect } from 'vitest';
import { upcomingFrom } from './o2oUpcoming.js';

/** Periodo tal y como vive en /leaders/{uid}/o2oPeriods. */
const periodo = (over = {}) => ({
  id: 'p1',
  name: 'Periodo Septiembre 2026',
  status: 'open',
  createdAt: '2026-09-01T10:00:00.000Z',
  guide: {
    version: 3,
    blocks: [{ id: 'b1', title: 'Cómo trabajan hoy', questions: [{ id: 'q1', text: 'PREGUNTA DEL MANAGER' }] }],
  },
  form: {
    version: 2,
    intro: 'Piensa en esto antes de vernos',
    sections: [
      { id: 's1', title: 'Tu trabajo', questions: [{ id: 'f1', text: '¿Qué te está costando?' }] },
    ],
  },
  ...over,
});

describe('upcomingFrom', () => {
  it('no proyecta NUNCA la guía del manager', () => {
    // La guía son las preguntas que usará ÉL durante la conversación, y vive en
    // el mismo documento que el formulario previo. Proyectar el periodo entero
    // por comodidad se la enseñaría a la persona.
    const out = upcomingFrom('e2e-leader', [periodo()]);
    const serializado = JSON.stringify(out);
    expect(serializado).not.toContain('PREGUNTA DEL MANAGER');
    expect(serializado).not.toContain('guide');
    expect(out).toEqual({
      periodId: 'p1',
      leaderUid: 'e2e-leader',
      name: 'Periodo Septiembre 2026',
      form: {
        intro: 'Piensa en esto antes de vernos',
        sections: [
          { id: 's1', title: 'Tu trabajo', questions: [{ id: 'f1', text: '¿Qué te está costando?' }] },
        ],
      },
    });
  });

  it('el próximo O2O es el periodo más reciente', () => {
    const viejo = periodo({ id: 'viejo', name: 'Periodo Julio 2026', createdAt: '2026-07-01T10:00:00.000Z' });
    const nuevo = periodo({ id: 'nuevo', name: 'Periodo Septiembre 2026', createdAt: '2026-09-01T10:00:00.000Z' });
    expect(upcomingFrom('l', [viejo, nuevo]).periodId).toBe('nuevo');
    expect(upcomingFrom('l', [nuevo, viejo]).periodId).toBe('nuevo');
  });

  it('un periodo recién creado, con el formulario en blanco, no es nada que enseñar', () => {
    const blanco = periodo({ form: { version: 1, intro: '', sections: [] } });
    expect(upcomingFrom('l', [blanco])).toBeNull();
  });

  it('secciones sin preguntas tampoco cuentan como preguntas', () => {
    const vacio = periodo({ form: { version: 1, intro: 'Hola', sections: [{ id: 's1', title: 'Vacía', questions: [] }] } });
    expect(upcomingFrom('l', [vacio])).toBeNull();
  });

  it('sin periodos no hay próximo O2O', () => {
    expect(upcomingFrom('l', [])).toBeNull();
    expect(upcomingFrom('l', null)).toBeNull();
  });

  it('descarta las preguntas vacías y las secciones que se quedan sin ninguna', () => {
    const sucio = periodo({
      form: {
        intro: '  Piensa  ',
        sections: [
          { id: 's1', title: 'Con hueco', questions: [{ id: 'f1', text: '  ' }, { id: 'f2', text: 'Válida' }] },
          { id: 's2', title: 'Toda vacía', questions: [{ id: 'f3', text: '' }] },
        ],
      },
    });
    const out = upcomingFrom('l', [sucio]);
    expect(out.form.intro).toBe('Piensa');
    expect(out.form.sections).toEqual([
      { id: 's1', title: 'Con hueco', questions: [{ id: 'f2', text: 'Válida' }] },
    ]);
  });

  it('un periodo sin createdAt no gana por accidente al que sí lo tiene', () => {
    const sinFecha = periodo({ id: 'sin', createdAt: undefined });
    const conFecha = periodo({ id: 'con', createdAt: '2026-08-01T10:00:00.000Z' });
    expect(upcomingFrom('l', [sinFecha, conFecha]).periodId).toBe('con');
  });
});
