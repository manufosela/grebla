import { describe, it, expect } from 'vitest';
import { groupNotes, summaryGroups, groupPatch, ungroupPatch, groupKeyOf, groupAuthors } from './grouping.js';

const n = (id, text, extra = {}) => ({ id, columnId: 'viento', text, voters: [], ...extra });

describe('groupNotes (RMR-TSK-0281)', () => {
  it('sin agrupar, cada nota es su propio grupo', () => {
    const groups = groupNotes([n('a', 'A'), n('b', 'B')]);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.notes.length === 1)).toBe(true);
  });

  it('las notas con el mismo groupId forman un grupo y toman el texto de la principal', () => {
    const groups = groupNotes([n('a', 'Falta contexto', { groupId: 'a' }), n('b', 'No sabemos el porqué', { groupId: 'a' })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].text).toBe('Falta contexto');
    expect(groups[0].notes).toHaveLength(2);
  });

  it('si la principal se borró, el grupo conserva el texto de la que queda', () => {
    const groups = groupNotes([n('b', 'La que queda', { groupId: 'a' })]);
    expect(groups[0].text).toBe('La que queda');
  });

  it('los votos del grupo son votantes ÚNICOS (quien votó dos notas cuenta una vez)', () => {
    const groups = groupNotes([
      n('a', 'A', { groupId: 'a', voters: ['u1', 'u2'] }),
      n('b', 'B', { groupId: 'a', voters: ['u2', 'u3'] }),
    ]);
    expect(groups[0].votes).toBe(3);
  });
});

describe('summaryGroups ordena por votos', () => {
  it('más votados primero; a igualdad, el grupo más grande', () => {
    const groups = summaryGroups([
      n('a', 'poco', { voters: ['u1'] }),
      n('b', 'mucho', { voters: ['u1', 'u2', 'u3'] }),
      n('c', 'empate', { groupId: 'c', voters: ['u1'] }),
      n('d', 'empate2', { groupId: 'c' }),
    ]);
    expect(groups.map((g) => g.text)).toEqual(['mucho', 'empate', 'poco']);
  });
});

describe('groupPatch / ungroupPatch', () => {
  it('agrupa bajo la primera nota y solo devuelve las que cambian', () => {
    expect(groupPatch(['a', 'b', 'c'])).toEqual([
      { id: 'a', groupId: 'a' }, { id: 'b', groupId: 'a' }, { id: 'c', groupId: 'a' },
    ]);
  });

  it('con menos de 2 notas no hay grupo', () => {
    expect(groupPatch(['a'])).toEqual([]);
    expect(groupPatch([])).toEqual([]);
  });

  it('deshacer devuelve todas las del grupo a null', () => {
    const notes = [n('a', 'A', { groupId: 'a' }), n('b', 'B', { groupId: 'a' }), n('c', 'C')];
    expect(ungroupPatch(notes, 'a')).toEqual([{ id: 'a', groupId: null }, { id: 'b', groupId: null }]);
  });

  it('groupKeyOf cae a su propio id si no está agrupada', () => {
    expect(groupKeyOf(n('a', 'A'))).toBe('a');
    expect(groupKeyOf(n('a', 'A', { groupId: 'g' }))).toBe('g');
  });
});

describe('groupAuthors', () => {
  it('firma una tarjeta con su autor', () => {
    expect(groupAuthors({ notes: [{ authorName: 'Ana' }] })).toEqual(['Ana']);
  });

  it('lista a todos los autores de un grupo, sin repetir', () => {
    const group = { notes: [{ authorName: 'Ana' }, { authorName: 'Beto' }, { authorName: 'Ana' }] };
    expect(groupAuthors(group)).toEqual(['Ana', 'Beto']);
  });

  it('descarta las notas antiguas sin autor en vez de inventarlo', () => {
    expect(groupAuthors({ notes: [{ authorName: 'Ana' }, {}, { authorName: '  ' }] })).toEqual(['Ana']);
  });

  it('sin notas no devuelve firmas', () => {
    expect(groupAuthors({})).toEqual([]);
  });
});
