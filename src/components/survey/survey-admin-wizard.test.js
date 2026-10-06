/**
 * El asistente de una encuesta (RMR-TSK-0631): se avanza paso a paso y la
 * selección de destinatarios se guarda en la encuesta al salir de su paso.
 */
import { describe, it, expect, vi } from 'vitest';
import { SurveyAdmin } from './survey-admin.js';

const { _goStep } = SurveyAdmin.prototype;

describe('<survey-admin> — asistente por pasos', () => {
  it('al salir de Destinatarios guarda la selección y avanza', async () => {
    const ctx = { _step: 'recipients', _saveRecipients: vi.fn(async () => true) };
    await _goStep.call(ctx, 'links');
    expect(ctx._saveRecipients).toHaveBeenCalledOnce();
    expect(ctx._step).toBe('links');
  });

  it('si no se pudo guardar la selección, no se mueve', async () => {
    const ctx = { _step: 'recipients', _saveRecipients: vi.fn(async () => false) };
    await _goStep.call(ctx, 'links');
    expect(ctx._step).toBe('recipients');
  });

  it('desde otros pasos se mueve sin escribir nada', async () => {
    const ctx = { _step: 'links', _saveRecipients: vi.fn() };
    await _goStep.call(ctx, 'send');
    expect(ctx._saveRecipients).not.toHaveBeenCalled();
    expect(ctx._step).toBe('send');
  });
});
