/**
 * Participantes desde el padrón (RMR-TSK-0629): por defecto van todas; se
 * desmarca a quien no y «Marcar/Desmarcar todas» actúa sobre la lista filtrada.
 */
import { describe, it, expect } from 'vitest';
import { SurveyAdmin } from './survey-admin.js';

const { _togglePadron, _toggleAllPadron } = SurveyAdmin.prototype;
const selection = [{ email: 'ana@example.com' }, { email: 'Bea@example.com' }];

describe('<survey-admin> — marcar y desmarcar a quién se envía', () => {
  it('desmarcar a una la excluye y volver a marcarla la recupera', () => {
    const ctx = { _padronExcluded: new Set() };
    _togglePadron.call(ctx, 'Bea@example.com', false);
    expect([...ctx._padronExcluded]).toEqual(['bea@example.com']);
    _togglePadron.call(ctx, 'Bea@example.com', true);
    expect(ctx._padronExcluded.size).toBe(0);
  });

  it('desmarcar todas excluye solo a las de la lista filtrada; marcar todas las devuelve', () => {
    const ctx = { _padronExcluded: new Set(['otra@example.com']), _padronSelection: selection };
    _toggleAllPadron.call(ctx, false);
    expect([...ctx._padronExcluded].toSorted()).toEqual(['ana@example.com', 'bea@example.com', 'otra@example.com']);
    _toggleAllPadron.call(ctx, true);
    expect([...ctx._padronExcluded]).toEqual(['otra@example.com']);
  });
});
