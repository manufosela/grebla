/**
 * Envío de correo con la API de Resend (RMR-TSK-0363).
 *
 * Sustituye a la Gmail API (delegación de dominio) para el envío de encuestas.
 * Solo texto plano. La API key vive en el secret RESEND_API_KEY; jamás se vuelca
 * en logs ni en los mensajes de error.
 */
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** Rechaza CR/LF en un valor de cabecera (evita inyección de cabeceras SMTP). */
export function assertHeaderSafe(value, field) {
  if (/[\r\n]/.test(String(value ?? ''))) {
    throw new Error(`Cabecera ${field} con caracteres de control no permitidos.`);
  }
}

/**
 * Construye el cuerpo JSON para la API de Resend validando las cabeceras.
 * `from`/`to`/`subject` viajan como cabeceras del correo: nunca deben contener
 * CR/LF (evita inyección de cabeceras). Función pura y testeable.
 * @param {{ from: string, to: string, subject: string, text: string }} p
 * @returns {{ from: string, to: string, subject: string, text: string }}
 */
export function buildResendPayload({ from, to, subject, text }) {
  assertHeaderSafe(from, 'From');
  assertHeaderSafe(to, 'To');
  assertHeaderSafe(subject, 'Subject');
  return { from, to, subject, text };
}

/**
 * Envía un correo de texto plano vía Resend. Lanza un Error claro (con status y
 * cuerpo de la respuesta) si la API falla; NUNCA incluye la API key en el error.
 * @param {{ apiKey: string, from: string, to: string, subject: string, text: string }} p
 */
export async function sendResend({ apiKey, from, to, subject, text }) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('RESEND_API_KEY no está configurado.');
  }
  const payload = buildResendPayload({ from, to, subject, text });
  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    // Solo status y cuerpo de la respuesta de Resend: la API key nunca se filtra.
    throw new Error(`Resend API respondió ${res.status}: ${await res.text()}`);
  }
  return res.json();
}
