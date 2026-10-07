/**
 * A quién se envía la encuesta y cuándo parar (RMR-TSK-0643). Puro.
 *
 * El envío masivo mandaba a todos los enlaces sin apuntar a quién le llegaba, sin
 * pausa entre correos y sin distinguir el límite diario de Resend de cualquier
 * otro fallo: al pasarse del cupo, nadie sabía quién se había quedado sin correo.
 */

/** Resend admite 2 peticiones por segundo por equipo: una cada 600 ms deja margen. */
export const SEND_INTERVAL_MS = 600;

const MODES = new Set(['pending', 'reminder']);

/**
 * Enlaces a los que toca enviar. `pending`: a quien aún no se le envió (o falló)
 * y no ha respondido. `reminder`: a todo el que no ha respondido. Nunca a los
 * enlaces de prueba ni a los que no tienen email.
 * @template {{ id: string, data: Record<string, any> }} T
 * @param {T[]} tokens
 * @param {'pending'|'reminder'} mode
 * @returns {T[]}
 */
export function sendTargets(tokens, mode) {
  if (!MODES.has(mode)) throw new Error(`Modo de envío desconocido: ${mode}`);
  return tokens.filter(({ data }) => data.test !== true && data.email && data.used !== true
    && (mode === 'reminder' || !data.sentAt));
}

/**
 * ¿Es el límite de cupo del proveedor? Ahí hay que parar: seguir solo acumula
 * fallos. Resend: 429 daily/monthly_quota_exceeded. Gmail (RMR-TSK-0646): 403 o
 * 429 con dailyLimitExceeded / «Daily user sending limit exceeded».
 */
export function isQuotaError(err) {
  const msg = err?.message ?? '';
  return /\b(403|429)\b/.test(msg)
    && /(daily|monthly)_quota_exceeded|dailyLimitExceeded|Daily user sending limit/i.test(msg);
}
