import { describe, expect, it } from 'vitest';
import { sendTargets, isQuotaError, SEND_INTERVAL_MS } from './surveySend.js';

const tok = (id, extra = {}) => ({ id, data: { email: `${id}@example.com`, used: false, ...extra } });
const tokens = [
  tok('a'),
  tok('b', { sentAt: 'ayer' }),
  tok('c', { used: true }),
  tok('d', { test: true }),
  tok('e', { email: '' }),
  tok('f', { sendError: 'Resend API respondió 500' }),
];

describe('envío masivo de la encuesta (RMR-TSK-0643)', () => {
  it('«a quienes faltan»: sin enviar y sin responder; ni pruebas ni enlaces sin email', () => {
    expect(sendTargets(tokens, 'pending').map((t) => t.id)).toEqual(['a', 'f']);
  });

  it('«recordatorio»: quien aún no ha respondido, se le enviara antes o no', () => {
    expect(sendTargets(tokens, 'reminder').map((t) => t.id)).toEqual(['a', 'b', 'f']);
  });

  it('un modo desconocido falla en alto', () => {
    expect(() => sendTargets(tokens, 'todos')).toThrow(/Modo de envío desconocido/);
  });

  it('reconoce el límite diario de Resend, y no confunde otros errores con él', () => {
    expect(isQuotaError(new Error('Resend API respondió 429: {"name":"daily_quota_exceeded"}'))).toBe(true);
    expect(isQuotaError(new Error('Resend API respondió 429: {"name":"monthly_quota_exceeded"}'))).toBe(true);
    expect(isQuotaError(new Error('Resend API respondió 429: {"name":"rate_limit_exceeded"}'))).toBe(false);
    expect(isQuotaError(new Error('Resend API respondió 500: boom'))).toBe(false);
  });

  it('reconoce el límite diario de Gmail (RMR-TSK-0646)', () => {
    expect(isQuotaError(new Error('Gmail API respondió 403: {"error":{"errors":[{"reason":"dailyLimitExceeded"}]}}'))).toBe(true);
    expect(isQuotaError(new Error('Gmail API respondió 429: Daily user sending limit exceeded'))).toBe(true);
    expect(isQuotaError(new Error('Gmail API respondió 400: Invalid To header'))).toBe(false);
  });

  it('nunca más de 2 correos por segundo', () => {
    expect(SEND_INTERVAL_MS).toBeGreaterThanOrEqual(500);
  });
});
