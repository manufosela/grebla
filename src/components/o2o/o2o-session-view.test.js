/**
 * <o2o-session-view> (RMR-TSK-0648): lo que es solo del manager, separado de lo
 * que ve la persona. Se ejercita la lógica de partes del prototipo.
 */
import { describe, it, expect } from 'vitest';
import { sessionParts } from './o2o-session-view.js';

describe('partes de un O2O: privado y compartido', () => {
  it('lo privado son las notas y el resumen privado; lo compartido, el resumen para la persona', () => {
    const parts = sessionParts({ privateNotes: 'notas', summary: 'resumen', sharedSummary: 'para ella', sharedWithPerson: true });
    expect(parts.private).toEqual([{ label: 'Notas privadas', text: 'notas' }, { label: 'Resumen privado', text: 'resumen' }]);
    expect(parts.shared).toEqual({ text: 'para ella', visible: true });
  });

  it('un resumen compartido sin marcar como visible se dice que la persona no lo ve', () => {
    expect(sessionParts({ sharedSummary: 'para ella', sharedWithPerson: false }).shared).toEqual({ text: 'para ella', visible: false });
  });

  it('lo vacío no se enseña', () => {
    expect(sessionParts({ privateNotes: '  ', summary: '' })).toEqual({ private: [], shared: { text: '', visible: false } });
  });
});
