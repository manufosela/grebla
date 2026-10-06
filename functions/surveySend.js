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

/** ¿Es el límite de cupo (diario o mensual) de Resend? Ahí hay que parar: seguir solo acumula fallos. */
export function isQuotaError(err) {
  return /\b429\b/.test(err?.message ?? '') && /(daily|monthly)_quota_exceeded/.test(err.message);
}
