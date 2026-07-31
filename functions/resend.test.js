import { describe, it, expect } from 'vitest';
import { assertHeaderSafe, buildResendPayload } from './resend.js';

describe('assertHeaderSafe', () => {
  it('acepta valores sin saltos de línea', () => {
    expect(() => assertHeaderSafe('Encuestas TRIBBU <encuestas@tribbuapp.com>', 'From')).not.toThrow();
    expect(() => assertHeaderSafe('persona@example.com', 'To')).not.toThrow();
  });
  it('rechaza CR o LF (inyección de cabeceras)', () => {
    expect(() => assertHeaderSafe('a@b.com\r\nBcc: evil@x.com', 'To')).toThrow();
    expect(() => assertHeaderSafe('a@b.com\nBcc: evil@x.com', 'To')).toThrow();
    expect(() => assertHeaderSafe('a@b.com\rX', 'From')).toThrow();
  });
});

describe('buildResendPayload', () => {
  it('arma el cuerpo JSON esperado por la API de Resend', () => {
    const payload = buildResendPayload({
      from: 'Encuestas TRIBBU <encuestas@tribbuapp.com>',
      to: 'persona@example.com',
      subject: 'Encuesta de clima',
      text: 'Responde aquí: https://demo.web.app/encuesta?s=1&t=abc',
    });
    expect(payload).toEqual({
      from: 'Encuestas TRIBBU <encuestas@tribbuapp.com>',
      to: 'persona@example.com',
      subject: 'Encuesta de clima',
      text: 'Responde aquí: https://demo.web.app/encuesta?s=1&t=abc',
    });
  });
  it('rechaza un from con caracteres de control', () => {
    expect(() => buildResendPayload({ from: 'x\r\nBcc: e@x', to: 'a@b.com', subject: 's', text: 't' })).toThrow();
  });
  it('rechaza un to con caracteres de control', () => {
    expect(() => buildResendPayload({ from: 'a@b.com', to: 'x\nBcc: e@x', subject: 's', text: 't' })).toThrow();
  });
  it('rechaza un subject con caracteres de control', () => {
    expect(() => buildResendPayload({ from: 'a@b.com', to: 'a@b.com', subject: 's\r\nBcc: e@x', text: 't' })).toThrow();
  });
});
