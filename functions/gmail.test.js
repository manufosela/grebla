import { describe, expect, it, vi } from 'vitest';

// El CI de calidad no instala las dependencias de functions/: la librería de
// Google no hace falta para construir el mensaje, así que se sustituye.
vi.mock('google-auth-library', () => ({ JWT: class {} }));
const { buildRawMessage } = await import('./gmail.js');

const decode = (raw) => Buffer.from(raw, 'base64url').toString('utf8');

describe('gmail.buildRawMessage (RMR-TSK-0646)', () => {
  it('mensaje de texto plano UTF-8 con el asunto codificado (acentos)', () => {
    const msg = decode(buildRawMessage({ from: 'Encuestas <noreply@example.com>', to: 'ana@example.com', subject: 'Tu opinión', text: 'Hola, ¿qué tal?' }));
    expect(msg).toContain('From: Encuestas <noreply@example.com>\r\nTo: ana@example.com\r\n');
    expect(msg).toContain(`Subject: =?UTF-8?B?${Buffer.from('Tu opinión').toString('base64')}?=`);
    expect(msg).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(msg.split('\r\n\r\n')[1]).toBe(Buffer.from('Hola, ¿qué tal?').toString('base64'));
  });

  it('un salto de línea en una cabecera se rechaza (inyección de cabeceras)', () => {
    expect(() => buildRawMessage({ from: 'a@example.com', to: 'b@example.com\r\nBcc: x@example.com', subject: 's', text: 't' })).toThrow();
  });
});
