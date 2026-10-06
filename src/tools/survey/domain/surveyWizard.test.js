import { describe, expect, it } from 'vitest';
import { WIZARD_STEPS, stepBlocker, savedRecipients, linksToCreate } from './surveyWizard.js';

describe('surveyWizard (RMR-TSK-0631) — una encuesta, un camino', () => {
  it('cuatro pasos en orden: preguntas, destinatarios, enlaces y envío', () => {
    expect(WIZARD_STEPS.map((s) => s.id)).toEqual(['questions', 'recipients', 'links', 'send']);
  });

  it('sin guardar la encuesta no se pasa de las preguntas', () => {
    expect(stepBlocker('questions', { surveyId: null })).toMatch(/Guarda la encuesta/);
    expect(stepBlocker('questions', { surveyId: 's1' })).toBeNull();
  });

  it('sin nadie marcado no se generan enlaces', () => {
    expect(stepBlocker('recipients', { surveyId: 's1', selected: 0 })).toMatch(/Marca al menos a una persona/);
    expect(stepBlocker('recipients', { surveyId: 's1', selected: 3 })).toBeNull();
  });

  it('sin enlaces no hay nada que enviar', () => {
    expect(stepBlocker('links', { surveyId: 's1', links: 0 })).toMatch(/Genera los enlaces/);
    expect(stepBlocker('links', { surveyId: 's1', links: 2 })).toBeNull();
  });

  it('la selección guardada en la encuesta se recupera en minúsculas y sin basura', () => {
    expect(savedRecipients({ recipients: ['Ana@Example.com', '', 7, 'bea@example.com'] }))
      .toEqual(new Set(['ana@example.com', 'bea@example.com']));
    expect(savedRecipients({})).toEqual(new Set());
  });

  it('solo se crean enlaces para quien está marcado y aún no tiene el suyo', () => {
    const marked = [{ email: 'Ana@example.com' }, { email: 'bea@example.com' }];
    expect(linksToCreate(marked, [{ email: 'ana@example.com' }]).map((p) => p.email)).toEqual(['bea@example.com']);
  });
});
