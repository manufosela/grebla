import { describe, it, expect } from 'vitest';
import { LINK_PLACEHOLDER, defaultEmailTemplate, emailTemplateErrors, renderEmailBody } from './email.js';

describe('defaultEmailTemplate', () => {
  it('trae asunto y un cuerpo con el marcador del enlace', () => {
    const tpl = defaultEmailTemplate();
    expect(tpl.subject.trim()).not.toBe('');
    expect(tpl.body).toContain(LINK_PLACEHOLDER);
    expect(emailTemplateErrors(tpl)).toEqual([]);
  });
});

describe('emailTemplateErrors', () => {
  it('exige asunto no vacío', () => {
    expect(emailTemplateErrors({ subject: '  ', body: `x ${LINK_PLACEHOLDER}` })).toHaveLength(1);
  });
  it('exige el marcador del enlace en el cuerpo', () => {
    expect(emailTemplateErrors({ subject: 'Hola', body: 'sin enlace' })).toHaveLength(1);
  });
  it('sin errores cuando hay asunto y marcador', () => {
    expect(emailTemplateErrors({ subject: 'Hola', body: `Entra: ${LINK_PLACEHOLDER}` })).toEqual([]);
  });
});

describe('renderEmailBody', () => {
  it('sustituye todas las apariciones del marcador por el enlace', () => {
    const body = `${LINK_PLACEHOLDER} y de nuevo ${LINK_PLACEHOLDER}`;
    expect(renderEmailBody(body, 'https://x/y')).toBe('https://x/y y de nuevo https://x/y');
  });
  it('tolera cuerpo o enlace ausentes', () => {
    expect(renderEmailBody(undefined, 'l')).toBe('');
    expect(renderEmailBody('hola', undefined)).toBe('hola');
  });
});
