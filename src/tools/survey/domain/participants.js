/**
 * Parseo del padrón de participantes pegado a mano (RMR-TSK-0326). Dominio puro.
 *
 * Una persona por línea: `email`, o `email,departamento`, o
 * `email,departamento,fecha-alta`. Separador coma, punto y coma o tabulador
 * (para pegar desde una hoja). Descarta líneas sin email válido y deduplica por
 * email (en minúsculas). Los metadatos alimentan la segmentación (en tramos).
 */

/** @returns {Array<{ email: string, metadata: { department?: string, startDate?: string } }>} */
export function parseParticipants(text) {
  const byEmail = new Map();
  for (const rawLine of String(text ?? '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(/[,;\t]/).map((s) => s.trim());
    const email = parts[0];
    if (!email || !email.includes('@')) continue;
    const metadata = {};
    if (parts[1]) metadata.department = parts[1];
    if (parts[2]) metadata.startDate = parts[2];
    byEmail.set(email.toLowerCase(), { email, metadata });
  }
  return [...byEmail.values()];
}
