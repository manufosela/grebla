/**
 * Genera un documento compatible con Word (.doc) a partir de la guía o el
 * formulario previo del O2O, SIN dependencias: es HTML con los namespaces de MS
 * Office y se sirve con MIME `application/msword`, de forma que Word y Google
 * Docs lo abren con formato (títulos + listas) y permiten «Guardar como .docx».
 *
 * Puro: no toca el DOM. El disparo de la descarga (Blob + <a download>) vive en
 * el componente que lo usa (o2o-questions-editor).
 */

/** MIME de un documento Word clásico (lo entienden Word y Google Docs). */
export const WORD_DOC_MIME = 'application/msword';

/** Escapa los caracteres especiales de HTML para insertar texto como contenido. */
export function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Título del documento y nombre de fichero según la batería.
 * @param {'guide'|'form'} kind
 * @returns {{ title: string, filename: string }}
 */
export function o2oDocMeta(kind) {
  return kind === 'form'
    ? { title: 'Preguntas previas al O2O', filename: 'preguntas-previas-o2o.doc' }
    : { title: 'Guía del O2O', filename: 'guia-o2o.doc' };
}

/**
 * Construye el HTML compatible con Word.
 * @param {{ title: string, intro?: string, groups: Array<{ title?: string, questions?: Array<{ text?: string }> }> }} doc
 * @returns {string}
 */
export function buildO2ODocHtml({ title, intro = '', groups = [] }) {
  const body = [`<h1>${escapeHtml(title)}</h1>`];
  const introText = String(intro ?? '').trim();
  if (introText) body.push(`<p>${escapeHtml(introText)}</p>`);

  for (const group of groups) {
    const groupTitle = String(group?.title ?? '').trim();
    if (groupTitle) body.push(`<h2>${escapeHtml(groupTitle)}</h2>`);
    const questions = (group?.questions ?? [])
      .map((q) => String(q?.text ?? '').trim())
      .filter(Boolean);
    if (questions.length) {
      body.push('<ol>');
      for (const q of questions) body.push(`<li>${escapeHtml(q)}</li>`);
      body.push('</ol>');
    }
  }

  // Cabecera con los namespaces de Office: es lo que hace que Word lo trate como
  // documento (no como página web) y respete títulos/listas.
  return [
    "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>",
    '<head><meta charset="utf-8"><title>' + escapeHtml(title) + '</title></head>',
    '<body>',
    body.join('\n'),
    '</body></html>',
  ].join('\n');
}
