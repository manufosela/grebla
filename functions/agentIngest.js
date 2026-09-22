/**
 * Ingesta de notas de conversación desde un agente externo (RMR-TSK-0549).
 *
 * Lo puro de `ingestConversation`: sin Firestore, para poder probarlo a secas.
 *
 * El caso que lo motiva: MATIAS —el agente personal de Mánu— lee cada mañana el
 * correo y Slack, y cuando lo que encuentra es un 1-1 o un catchup, eso no
 * pertenece a su lista de tareas sino a la ficha de la persona.
 *
 * Tres decisiones que conviene no deshacer sin pensarlas:
 *
 * 1. Entra SOLO en `/people/{id}/conversations`. El O2O del manager
 *    (`/leaders/{uid}/o2o`) es su espacio privado y tiene una promesa hecha al
 *    ingeniero; la Marea, las encuestas, los kudos y las notas de apoyo tienen
 *    cada uno su garantía. Un agente no escribe en ninguno de esos sitios.
 * 2. La nota queda marcada como AUTOMÁTICA y con su origen. Es un borrador que
 *    el manager puede editar o borrar, no un registro que alguien haya revisado.
 * 3. El id sale del origen, no del reloj. Un relanzamiento del agente reprocesa
 *    el día entero, y sin esto cada incidencia dejaría notas duplicadas justo
 *    donde más molestan.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

/** Lo único que viaja a la ficha: una conversación de tú a tú. */
export const INGEST_TYPES = Object.freeze(['o2o', 'catchup']);

/** Tamaños máximos: una nota es una nota, no el volcado del correo entero. */
const MAX_NOTES = 20_000;
const MAX_SUMMARY = 4_000;
const MAX_ID = 200;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const texto = (value, max) => String(value ?? '').trim().slice(0, max);

/** Error de payload: el endpoint lo traduce a un 400 con su motivo. */
class IngestError extends Error {}

/**
 * La clave que trae la petición, si viene como bearer.
 * @param {unknown} authorization  cabecera Authorization
 * @returns {string}
 */
export function bearerFrom(authorization) {
  const raw = String(authorization ?? '');
  return /^bearer /i.test(raw) ? raw.slice(7).trim() : '';
}

/**
 * ¿Coincide la clave? Comparación de tiempo constante: comparar con `===` filtra
 * el tiempo y deja adivinar la clave carácter a carácter. Sin clave configurada
 * no se abre la puerta, por mucho que el cliente mande una cadena vacía.
 * @param {string} expected @param {string} received
 */
export function keyMatches(expected, received) {
  const a = Buffer.from(String(expected ?? ''));
  const b = Buffer.from(String(received ?? ''));
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * ¿Es un día que existe? La forma AAAA-MM-DD no basta: un `2026-02-30` la
 * cumple y luego aparece en la ficha como una conversación que nunca ocurrió.
 * Se compara contra la fecha ya interpretada, que es quien sabe de meses.
 */
function isRealDate(value) {
  if (!DATE_RE.test(value)) return false;
  const fecha = new Date(`${value}T00:00:00.000Z`);
  // Un mes 99 ni siquiera es una fecha: `toISOString` lanzaría en vez de decir que no.
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().startsWith(value);
}

/** La URL del origen solo se guarda si es una dirección web de verdad. */
function sourceUrl(value) {
  const url = texto(value, 500);
  return /^https?:\/\//i.test(url) ? url : null;
}

/**
 * El payload saneado, o un error con el campo que falla. Lo que no cumple no se
 * «arregla» por su cuenta: el agente se entera y lo corrige.
 * @param {Record<string, unknown>|null|undefined} body
 * @returns {{ email: string, type: string, date: string, notes: string, summary: string,
 *   source: { system: string, id: string, url: string|null } }}
 */
export function normalizeIngest(body) {
  const email = texto(body?.email, 200).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new IngestError('El campo `email` no es un correo.');

  const type = texto(body?.type, 20);
  if (!INGEST_TYPES.includes(type)) throw new IngestError(`El campo \`type\` solo admite ${INGEST_TYPES.join(' o ')}.`);

  const date = texto(body?.date, 10);
  if (!isRealDate(date)) throw new IngestError('El campo `date` va en formato AAAA-MM-DD y tiene que ser un día real.');

  const system = texto(body?.source?.system, 40).toLowerCase().replaceAll(/[^a-z0-9-]/g, '');
  const id = texto(body?.source?.id, MAX_ID);
  if (!system || !id) throw new IngestError('El campo `source` necesita `system` e `id` para no duplicar la nota.');

  const notes = texto(body?.notes, MAX_NOTES);
  const summary = texto(body?.summary, MAX_SUMMARY);
  if (!notes && !summary) throw new IngestError('La nota llega vacía: hace falta `notes` o `summary`.');

  return { email, type, date, notes, summary, source: { system, id, url: sourceUrl(body?.source?.url) } };
}

/**
 * Id del documento, derivado del ORIGEN: la misma nota reenviada cae en el mismo
 * sitio, así que el alta exclusiva la rechaza en vez de duplicarla.
 * @param {{ system: string, id: string }} source
 * @returns {string}
 */
export function conversationIdFor(source) {
  const huella = createHash('sha256').update(`${source?.system ?? ''}:${source?.id ?? ''}`).digest('hex');
  return `agent-${huella.slice(0, 24)}`;
}

/**
 * El documento que se guarda en `/people/{id}/conversations`.
 * @param {ReturnType<typeof normalizeIngest>} input
 * @param {{ at: string }} meta  momento de la ingesta (ISO)
 */
export function conversationFrom(input, meta) {
  return {
    type: input.type,
    date: input.date,
    notes: input.notes,
    summary: input.summary,
    // El agente trae la nota ya redactada, no el audio ni su transcripción.
    transcription: '',
    audio: null,
    linkedDimensions: [],
    automated: true,
    source: input.source,
    createdAt: meta.at,
    createdBy: { uid: `agent:${input.source.system}`, name: `${input.source.system} (automático)` },
  };
}

/**
 * ¿Entra esta persona en el ámbito de la ingesta? Activa, con manager asignado
 * y de la organización. Fuera de eso, el agente se guarda la nota en su lado:
 * mejor eso que dejarla en una ficha que nadie mira.
 * @param {{ active?: unknown, ownerLeaderUid?: unknown, external?: unknown }|null|undefined} person
 */
export function personIsInScope(person) {
  if (!person || person.external === true) return false;
  if (person.active === false) return false;
  return texto(person.ownerLeaderUid, 200) !== '';
}
