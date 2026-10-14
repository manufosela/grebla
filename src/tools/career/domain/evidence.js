/**
 * Historial de una expectativa (RMR-TSK-0709). Dominio PURO.
 *
 * Nada de notas sueltas que se sobrescriben: cada expectativa acumula entradas
 * con su tipo (llega, no llega o prueba), un texto, enlaces opcionales, quién y
 * cuándo. La última entrada con estado dice dónde está; el historial entero es
 * la evolución. Las pruebas aportan sin mover el estado.
 *
 * @typedef {'meets'|'misses'|'proof'} EntryKind
 * @typedef {{ uid: string, name: string }} Author
 * @typedef {{ levelId: string, dimensionId: string, kind: EntryKind, text: string,
 *   links: { kind: string, url: string }[], by: Author, at: string }} EvidenceEntry
 */
import { validateEvidence } from './claims.js';

export const ENTRY_KINDS = Object.freeze(['meets', 'misses', 'proof']);

/**
 * Entrada nueva, validada. El texto y los enlaces siguen las mismas reglas que
 * la evidencia de una marca.
 * @returns {EvidenceEntry}
 */
export function newEntry({ levelId, dimensionId, kind, text, links = [], by, at }) {
  if (!ENTRY_KINDS.includes(kind)) throw new Error(`Tipo de entrada desconocido: «${kind}».`);
  for (const id of [levelId, dimensionId]) {
    // Ids tal cual del framework: con espacios no casarían nunca con su expectativa.
    if (typeof id !== 'string' || !id || id !== id.trim()) throw new Error('Falta la expectativa de la entrada (nivel y dimensión).');
  }
  const evidence = validateEvidence({ text, links });
  return { levelId, dimensionId, kind, text: evidence.text, links: evidence.links, by: author(by), at: canonicalInstant(at) };
}

/** Sin autor no hay historial que valga: quién lo dijo es parte de la entrada. */
function author(by) {
  const uid = typeof by?.uid === 'string' ? by.uid.trim() : '';
  const name = typeof by?.name === 'string' ? by.name.trim() : '';
  if (!uid || !name) throw new Error('Falta el autor de la entrada.');
  return { uid, name };
}

/** El orden del historial depende de la fecha: solo ISO 8601 en UTC, normalizada. */
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

function canonicalInstant(at) {
  const invalid = () => new Error(`Fecha no válida: «${at}» (se espera ISO 8601 en UTC).`);
  if (typeof at !== 'string' || !ISO_UTC.test(at)) throw invalid();
  const ms = Date.parse(at);
  if (Number.isNaN(ms)) throw invalid();
  const iso = new Date(ms).toISOString();
  // Date.parse corre las fechas imposibles (29-feb de un año no bisiesto) al día siguiente: se rechazan.
  if (iso.slice(0, 19) !== at.slice(0, 19)) throw invalid();
  return iso;
}

/**
 * Tipos que puede añadir quien mira: quien lleva a la persona, cualquiera; la
 * propia persona, solo pruebas (el estado no se lo pone ella). Mismo reparto
 * que las reglas.
 * @param {{ isSelf: boolean, leads: boolean }} viewer
 * @returns {EntryKind[]}
 */
export function entryKindsFor({ isSelf, leads }) {
  if (isSelf) return ['proof'];
  return leads ? [...ENTRY_KINDS] : [];
}

/**
 * Valoración antigua (/career/assessment, una nota por dimensión) convertida en
 * entradas del historial (RMR-TSK-0713). «No llega» siempre pasa: es información;
 * «cumple» solo si tenía nota, porque sin ella es el punto de partida. Ids fijos
 * por dimensión para que migrar dos veces no duplique.
 * @param {{ byDimension?: Record<string, { meets?: boolean, note?: string }> }|null} assessment
 * @param {{ levelId: string|null, by: Author, at: string }} context
 * @returns {Array<{ id: string, kind: EntryKind, entry: EvidenceEntry }>}
 */
export function entriesFromLegacyAssessment(assessment, { levelId, by, at }) {
  if (!levelId) return [];
  return Object.entries(assessment?.byDimension ?? {}).flatMap(([dimensionId, mark]) => {
    const note = String(mark?.note ?? '').trim();
    const kind = mark?.meets === false ? 'misses' : 'meets';
    if (kind === 'meets' && !note) return [];
    const text = note || 'Valoración anterior al historial, sin motivo escrito.';
    return [{ id: `legacy-${dimensionId}`, kind, entry: newEntry({ levelId, dimensionId, kind, text, by, at }) }];
  });
}

const DECISION_KIND = { accept: 'meets', reject: 'misses' };
const SLOT_ORDER = ['arbiter', 'second', 'first'];

/** Una ronda de marca como entradas: revisiones (la última primero) y la evidencia. */
function roundEntries({ evidence, reviews }, author, at) {
  const decided = SLOT_ORDER.map((s) => reviews?.[s]).filter(Boolean)
    .map((r) => ({ kind: DECISION_KIND[r.decision], text: r.reason ?? '', links: [], by: r.by ?? null, at: r.at ?? null }));
  // En la marca de un revisor su motivo hace de evidencia: no se repite.
  const repeated = decided.some((d) => d.by?.uid && d.by.uid === author?.uid && d.text === evidence?.text);
  const proof = evidence?.text && !repeated ? [{ kind: 'proof', text: evidence.text, links: evidence.links ?? [], by: author, at }] : [];
  return [...decided, ...proof];
}

/**
 * Una marca de nivel superior leída como historial (RMR-TSK-0714): la ronda
 * viva primero y después las archivadas, de la más reciente a la más antigua.
 * Las rondas archivadas no guardan quién aportó la evidencia: va sin autor.
 * @param {object|null} claim
 * @returns {Array<{ kind: EntryKind, text: string, links: object[], by: Author|null, at: string|null }>}
 */
export function claimTimeline(claim) {
  if (!claim) return [];
  const live = claim.status === 'claimed' ? roundEntries(claim, claim.claimedBy ?? null, claim.claimedAt ?? null) : [];
  const archived = (claim.history ?? []).toReversed().flatMap((round) => roundEntries(round, null, null));
  return [...live, ...archived];
}

const isOf = (levelId, dimensionId) => (e) => e?.levelId === levelId && e?.dimensionId === dimensionId;
const newestFirst = (a, b) => Date.parse(b.at) - Date.parse(a.at);

/**
 * Entradas de una expectativa, de la más reciente a la más antigua.
 * @param {EvidenceEntry[]} entries
 * @returns {EvidenceEntry[]}
 */
export function timelineFor(entries, levelId, dimensionId) {
  return (entries ?? []).filter(isOf(levelId, dimensionId)).toSorted(newestFirst);
}

/**
 * Estado vigente: el de la última entrada que lo dice; sin ninguna, `initial`
 * (el nivel actual parte de «llega»; los superiores, de abierto).
 * @param {EvidenceEntry[]} entries
 * @param {string} levelId @param {string} dimensionId
 * @param {string} initial
 * @returns {string}
 */
export function expectationState(entries, levelId, dimensionId, initial) {
  const last = timelineFor(entries, levelId, dimensionId).find((e) => e.kind !== 'proof');
  return last?.kind ?? initial;
}
