import { describe, it, expect } from 'vitest';
import { newObjective, closeObjective, editObjective, objectivesFor, looseObjectives, OBJECTIVE_STATUS } from './objectives.js';

const BY = { uid: 'em', name: 'Manager' };
const AT = '2026-10-17T10:00:00.000Z';
const base = { title: 'Medir el impacto de la IA', measure: 'Ahorro de esfuerzo ≥ 20 % frente a la línea base', dueDate: '2026-12-31', by: BY, at: AT };

describe('newObjective', () => {
  it('crea un objetivo abierto, enganchado a una expectativa', () => {
    const o = newObjective({ ...base, levelId: 'l2', dimensionId: 'orchestration' });
    expect(o).toEqual({
      title: base.title, measure: base.measure, dueDate: '2026-12-31', levelId: 'l2', dimensionId: 'orchestration',
      status: 'open', closingNote: '', closedAt: null, by: BY, at: AT,
    });
  });

  it('o suelto, sin expectativa ni fecha', () => {
    const o = newObjective({ ...base, dueDate: null });
    expect(o).toMatchObject({ levelId: null, dimensionId: null, dueDate: null });
  });

  it('sin medida no es un objetivo: es un deseo', () => {
    expect(() => newObjective({ ...base, measure: '  ' })).toThrow(/cómo se mide/);
  });

  it('rechaza título vacío, fecha mal escrita, expectativa a medias y autor vacío', () => {
    expect(() => newObjective({ ...base, title: '' })).toThrow(/título/);
    expect(() => newObjective({ ...base, dueDate: '31/12/2026' })).toThrow(/fecha/);
    expect(() => newObjective({ ...base, levelId: 'l2' })).toThrow(/expectativa/);
    expect(() => newObjective({ ...base, by: { uid: '', name: '' } })).toThrow(/autor/);
  });
});

describe('editObjective (RMR-TSK-0771): en curso se ajusta; cerrado, no', () => {
  const open = newObjective(base);

  it('devuelve solo lo editable, validado', () => {
    expect(editObjective(open, { title: ' Medir mejor ', measure: 'Ahorro ≥ 25 %', dueDate: '2027-01-31', levelId: 'l2', dimensionId: 'tech' }))
      .toEqual({ title: 'Medir mejor', measure: 'Ahorro ≥ 25 %', dueDate: '2027-01-31', levelId: 'l2', dimensionId: 'tech' });
  });

  it('con las mismas reglas que al crearlo', () => {
    expect(() => editObjective(open, { ...base, measure: '' })).toThrow(/cómo se mide/);
  });

  it('un objetivo cerrado no se reescribe', () => {
    expect(() => editObjective({ ...open, status: 'achieved' }, base)).toThrow(/cerrado/);
  });
});

describe('closeObjective', () => {
  const open = newObjective(base);

  it('cierra una vez, con nota', () => {
    expect(closeObjective(open, 'achieved', 'Medido: 23 %', AT)).toEqual({ status: 'achieved', closingNote: 'Medido: 23 %', closedAt: AT });
  });

  it('no se cierra dos veces ni con un estado inventado', () => {
    expect(() => closeObjective({ ...open, status: 'achieved' }, 'missed', '', AT)).toThrow(/cerrado/);
    expect(() => closeObjective(open, 'open', '', AT)).toThrow(/Estado/);
    expect(() => closeObjective(open, 'toString', '', AT)).toThrow(/Estado/);
  });
});

describe('dónde se enseña cada objetivo', () => {
  const list = [
    { ...newObjective({ ...base, levelId: 'l2', dimensionId: 'tech' }), id: 'a' },
    { ...newObjective({ ...base, levelId: 'l1', dimensionId: 'tech' }), id: 'b' },
    { ...newObjective(base), id: 'c' },
  ];

  it('bajo su expectativa del nivel que se mira', () => {
    expect(objectivesFor(list, 'l2', 'tech').map((o) => o.id)).toEqual(['a']);
  });

  it('y arriba, los sueltos y los de otro nivel', () => {
    expect(looseObjectives(list, 'l2').map((o) => o.id)).toEqual(['b', 'c']);
  });

  it('cada estado tiene su rótulo', () => {
    expect(Object.keys(OBJECTIVE_STATUS)).toEqual(['open', 'achieved', 'missed', 'dropped']);
  });
});
