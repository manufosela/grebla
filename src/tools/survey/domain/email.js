/**
 * Plantilla del correo de invitación a una encuesta (RMR-TSK-0341). Dominio puro.
 *
 * El cuerpo debe contener el marcador `{{enlace}}`, que se sustituye por el enlace
 * personal de cada persona al enviar. La validación de la plantilla se aplica en
 * el momento de ENVIAR (no al guardar la encuesta), para poder guardar borradores
 * sin el correo aún redactado.
 */

export const LINK_PLACEHOLDER = '{{enlace}}';

/** Plantilla por defecto (asunto + cuerpo con el marcador del enlace). */
export function defaultEmailTemplate() {
  return {
    subject: 'Tu encuesta de clima de TRIBBU',
    body: [
      'Hola,',
      '',
      'Queremos conocer tu opinión. Responde esta breve encuesta anónima desde tu enlace personal:',
      '',
      LINK_PLACEHOLDER,
      '',
      'Gracias por tu tiempo.',
    ].join('\n'),
  };
}

/** Errores de la plantilla: asunto no vacío y cuerpo con el marcador del enlace. */
export function emailTemplateErrors({ subject, body } = {}) {
  const errors = [];
  if (!String(subject ?? '').trim()) errors.push('El asunto del correo no puede estar vacío.');
  if (!String(body ?? '').includes(LINK_PLACEHOLDER)) {
    errors.push(`El cuerpo del correo debe incluir ${LINK_PLACEHOLDER} donde irá el enlace.`);
  }
  return errors;
}

/** Sustituye el marcador por el enlace real (para la previsualización y el envío). */
export function renderEmailBody(body, link) {
  return String(body ?? '').replaceAll(LINK_PLACEHOLDER, String(link ?? ''));
}
