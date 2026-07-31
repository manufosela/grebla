/**
 * Envío de correo con la Gmail API por delegación de dominio (RMR-TSK-0343).
 *
 * La cuenta de servicio (clave en el secret GMAIL_SA_KEY) impersona un buzón real
 * del dominio (`senderUser`) con el único scope `gmail.send`. Solo texto plano.
 * No lee correo ni impersona a nadie más que el buzón emisor de encuestas.
 */
import { JWT } from 'google-auth-library';
import { assertHeaderSafe } from './resend.js';

const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

/** Construye el mensaje RFC822 (texto plano UTF-8) en base64url para la Gmail API. */
export function buildRawMessage({ from, to, subject, text }) {
  // `from`/`to` van en claro en las cabeceras: nunca deben contener saltos de línea.
  assertHeaderSafe(from, 'From');
  assertHeaderSafe(to, 'To');
  const b64 = (value) => Buffer.from(String(value ?? ''), 'utf8').toString('base64');
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${b64(subject)}?=`, // encoded-word: asuntos con acentos
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
  ].join('\r\n');
  const raw = `${headers}\r\n\r\n${b64(text)}`;
  return Buffer.from(raw, 'utf8').toString('base64url');
}

/**
 * Envía un correo de texto plano impersonando `senderUser` (buzón real del
 * dominio, vía delegación de dominio). Lanza un Error si la API responde error.
 * @param {{ saKeyJson: string, senderUser: string, from: string, to: string, subject: string, text: string }} p
 */
export async function sendGmail({ saKeyJson, senderUser, from, to, subject, text }) {
  const key = JSON.parse(saKeyJson);
  const client = new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: [GMAIL_SEND_SCOPE],
    subject: senderUser,
  });
  const { token } = await client.getAccessToken();
  const raw = buildRawMessage({ from, to, subject, text });
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    throw new Error(`Gmail API respondió ${res.status}: ${await res.text()}`);
  }
  return res.json();
}
