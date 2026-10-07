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
import { createHash, randomBytes } from 'node:crypto';

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
 * Una clave nueva para un agente (RMR-TSK-0650): 32 bytes aleatorios. Se le
 * enseña UNA vez a quien la crea; GREBLA solo guarda su huella.
 */
export function generateAgentKey() {
  return `gk_${randomBytes(32).toString('base64url')}`;
}

/**
 * Huella de una clave: el id del documento en /agentKeys. Buscar por huella no
 * filtra la clave (no hay comparación carácter a carácter que medir), y quien lea
 * la colección no obtiene ninguna clave usable.
 */
export function agentKeyId(key) {
  return createHash('sha256').update(String(key ?? '')).digest('hex');
}

/**
 * ¿Qué puede hacer esta clave? Escribir SOLO en los O2O de su manager. Si el
 * envío dice otro manager, se rechaza: no hay cruce entre agentes.
 * @param {{ active?: boolean, managerUid?: string, managerEmail?: string }|null} keyDoc
 * @param {string|null} managerEmail el que trae el envío (opcional)
 */
export function agentKeyVerdict(keyDoc, managerEmail) {
  if (!keyDoc || keyDoc.active !== true || !keyDoc.managerUid) return { ok: false, status: 401, error: 'unauthorized' };
  if (managerEmail && managerEmail.toLowerCase() !== String(keyDoc.managerEmail ?? '').toLowerCase()) {
    return { ok: false, status: 403, error: 'manager_mismatch' };
  }
  return { ok: true, managerUid: keyDoc.managerUid };
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

  // Quien hizo el O2O (RMR-TSK-0649), opcional: sin él, el O2O es de su manager.
  const managerEmail = texto(body?.managerEmail, 200).toLowerCase() || null;
  if (managerEmail && !EMAIL_RE.test(managerEmail)) throw new IngestError('El campo `managerEmail` no es un correo.');

  return { email, type, date, notes, summary, managerEmail, source: { system, id, url: sourceUrl(body?.source?.url) } };
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
 * La sesión O2O que se guarda en `/leaders/{manager}/o2o`.
 * @param {ReturnType<typeof normalizeIngest>} input
 * @param {{ personId: string, periodId?: string|null, at: string }} meta  persona, periodo y momento (ISO)
 */
export function o2oSessionFrom(input, meta) {
  // Un O2O PRIVADO del manager (RMR-TSK-0649): antes iba a las conversaciones de
  // la ficha, que la propia persona puede leer. Nada se comparte con ella.
  return {
    personId: meta.personId,
    periodId: meta.periodId ?? null,
    date: input.date,
    guideVersion: null,
    answers: [],
    // El agente trae la nota ya redactada, no la transcripción.
    transcript: '',
    privateNotes: input.notes,
    summary: input.summary,
    sharedSummary: '',
    sharedWithPerson: false,
    automated: true,
    source: input.source,
    createdAt: meta.at,
  };
}

/**
 * Lo que el agente puede saber del equipo de su manager (RMR-TSK-0657): nombre y
 * correo de cada persona activa de la organización que le tiene como manager de
 * O2O, para decidir si una reunión es un O2O. Nada más sale de la ficha.
 * @param {Array<{ name?: unknown, email?: unknown, pendingEmail?: unknown, uid?: unknown, active?: unknown, external?: unknown }>} people
 * @param {Map<string, string>} emailByUid correo verificado de las cuentas vinculadas
 * @returns {Array<{ name: string, email: string }>}
 */
export function agentTeamView(people, emailByUid) {
  return (people ?? [])
    .filter((p) => p && p.active !== false && p.external !== true)
    .map((p) => ({
      name: texto(p.name, 200),
      email: texto(p.email || p.pendingEmail || emailByUid.get(p.uid) || '', 320).toLowerCase(),
    }))
    .filter((p) => p.email)
    .toSorted((a, b) => a.name.localeCompare(b.name, 'es'));
}

/**
 * ¿Entra esta persona en el ámbito de la ingesta de ESTE manager? Activa, de la
 * organización y con él entre sus managers de O2O (RMR-TSK-0655): una clave solo
 * escribe O2O de quien su manager lleva. Fuera de eso, el agente se guarda la
 * nota en su lado: mejor eso que dejarla donde no toca.
 * @param {{ active?: unknown, external?: unknown, o2oManagerUids?: unknown }|null|undefined} person
 * @param {string} managerUid
 */
export function personIsInScope(person, managerUid) {
  if (!person || person.external === true) return false;
  if (person.active === false || !managerUid) return false;
  return Array.isArray(person.o2oManagerUids) && person.o2oManagerUids.includes(managerUid);
}
