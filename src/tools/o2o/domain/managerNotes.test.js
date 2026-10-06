import { describe, expect, it } from 'vitest';
import { NOTE_TYPES, noteErrors, cleanNote, sortNotes } from './managerNotes.js';

describe('notas privadas del manager (RMR-TSK-0636)', () => {
  const valid = { type: 'perf-review', date: '2026-06-30', title: ' Review H1 ', content: ' Muy buen semestre. ' };

  it('dos tipos: performance review y contexto', () => {
    expect(NOTE_TYPES.map((t) => t.id)).toEqual(['perf-review', 'contexto']);
  });

  it('una nota completa no tiene errores', () => {
    expect(noteErrors(valid)).toEqual([]);
  });

  it('dice qué falta: tipo, fecha AAAA-MM-DD y contenido', () => {
    expect(noteErrors({ type: 'otra', date: '30/06/2026', title: '', content: '  ' })).toEqual([
      'Elige el tipo de nota.', 'La fecha debe ser AAAA-MM-DD.', 'Escribe el contenido.',
    ]);
  });

  it('una fecha que no existe en el calendario no vale', () => {
    expect(noteErrors({ ...valid, date: '2026-02-31' })).toEqual(['La fecha debe ser AAAA-MM-DD.']);
  });

  it('se guarda recortada y con título por defecto si no se da', () => {
    expect(cleanNote(valid)).toEqual({ type: 'perf-review', date: '2026-06-30', title: 'Review H1', content: 'Muy buen semestre.' });
    expect(cleanNote({ ...valid, title: '' }).title).toBe('Performance review');
  });

  it('se listan de la más reciente a la más antigua', () => {
    const notes = [{ id: 'a', date: '2025-12-01' }, { id: 'b', date: '2026-06-30' }, { id: 'c', date: '2026-01-15' }];
    expect(sortNotes(notes).map((n) => n.id)).toEqual(['b', 'c', 'a']);
  });
});
