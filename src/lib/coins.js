/**
 * IO de TRIBBU-COINS (CP-2) contra Firestore + checkpoint local.
 *
 * El cliente SOLO LEE (/coins es de solo lectura por reglas: escribe
 * únicamente la Cloud Function emisora vía Admin SDK). La lógica de
 * verificación es PURA y vive en src/tools/career/domain/coins.js; aquí las
 * lecturas y el checkpoint en localStorage (última cabeza del ledger VISTA
 * por este navegador: si la historia vista cambia, el verificador alerta).
 *
 * Paths (nº PAR de segmentos, ver la cabecera del dominio):
 *  - /coins/meta                        doc { seq, headHash, updatedAt }
 *  - /coins/ledger/entries/{entryId}    apuntes (consulta orderBy seq)
 *  - /coins/balances/people/{personId}  doc { balance, updatedAt }
 *
 * @typedef {import('../tools/career/domain/coins.js').CoinsEntry} CoinsEntry
 * @typedef {import('../tools/career/domain/coins.js').CoinsCheckpoint} CoinsCheckpoint
 */
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from './firebase.js';
import { LEDGER_SOFT_LIMIT } from '../tools/career/domain/coins.js';

/** Colección de apuntes del ledger. */
const ledgerCol = () => collection(db, 'coins', 'ledger', 'entries');

/** Colección de saldos materializados. */
const balancesCol = () => collection(db, 'coins', 'balances', 'people');

/**
 * Lee /coins/meta (contador y cabeza de la cadena), o null si aún no existe
 * (ningún apunte emitido).
 * @returns {Promise<{ seq: number, headHash: string }|null>}
 */
export async function getCoinsMeta() {
  const snap = await getDoc(doc(db, 'coins', 'meta'));
  if (!snap.exists()) return null;
  const data = snap.data();
  const seq = Number(data.seq);
  const headHash = String(data.headHash ?? '');
  if (!Number.isInteger(seq) || seq < 0 || headHash === '') {
    throw new Error('El documento /coins/meta está corrupto (seq o headHash inválidos).');
  }
  return { seq, headHash };
}

/**
 * Lee el ledger COMPLETO ordenado por seq (v1: sin paginar; el verificador
 * necesita la cadena entera). Con más de LEDGER_SOFT_LIMIT apuntes se deja
 * constancia por consola — la paginación por checkpoints es trabajo futuro.
 * Los apuntes se devuelven TAL CUAL (sin normalizar): la verificación
 * recomputa hashes sobre los campos exactos del documento.
 * @returns {Promise<CoinsEntry[]>}
 */
export async function getLedger() {
  const snap = await getDocs(query(ledgerCol(), orderBy('seq')));
  if (snap.size > LEDGER_SOFT_LIMIT) {
    console.warn(
      `Tribbu-coins: el ledger tiene ${snap.size} apuntes (> ${LEDGER_SOFT_LIMIT}); la verificación completa empieza a ser cara.`,
    );
  }
  return snap.docs.map((d) => /** @type {CoinsEntry} */ (d.data()));
}

/**
 * Saldo materializado de una persona (0 si aún no tiene doc: nadie nace con
 * coins).
 * @param {string} personId
 * @returns {Promise<number>}
 */
export async function getCoinsBalance(personId) {
  const id = String(personId ?? '').trim();
  if (!id) throw new Error('Hace falta una persona para leer su saldo de tribbu-coins.');
  const snap = await getDoc(doc(db, 'coins', 'balances', 'people', id));
  if (!snap.exists()) return 0;
  const balance = Number(snap.data().balance);
  if (!Number.isFinite(balance)) {
    throw new Error(`El saldo de tribbu-coins de ${id} está corrupto.`);
  }
  return balance;
}

/**
 * Todos los saldos materializados, para contrastarlos con la recomputación
 * del ledger. `{ personId: balance }`.
 * @returns {Promise<Record<string, number>>}
 */
export async function listCoinsBalances() {
  const snap = await getDocs(balancesCol());
  /** @type {Record<string, number>} */
  const balances = {};
  for (const d of snap.docs) {
    const balance = Number(d.data().balance);
    balances[d.id] = Number.isFinite(balance) ? balance : Number.NaN; // NaN nunca cuadra: corrupto = discrepancia
  }
  return balances;
}

// ── Checkpoint local (última cabeza vista por ESTE navegador) ───────────────

/** Clave de localStorage del checkpoint (mismo prefijo que el onboarding). */
const CHECKPOINT_KEY = 'grebla:coins:checkpoint';

/**
 * Lee el checkpoint local, o null si no hay (primer arranque) o está corrupto
 * (se descarta: mejor «sin historia previa» que comparar contra basura).
 * @returns {CoinsCheckpoint|null}
 */
export function readCoinsCheckpoint() {
  try {
    const raw = localStorage.getItem(CHECKPOINT_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    const seq = Number(parsed?.seq);
    const headHash = String(parsed?.headHash ?? '');
    if (!Number.isInteger(seq) || seq < 1 || !/^[0-9a-f]{64}$/.test(headHash)) return null;
    return { seq, headHash };
  } catch {
    return null; // localStorage bloqueado o JSON corrupto: sin checkpoint
  }
}

/**
 * Guarda la cabeza del ledger recién VERIFICADA como nueva historia vista.
 * Solo debe llamarse tras una verificación sin alerta: avanzar el checkpoint
 * sobre una historia manipulada la «bendeciría».
 * @param {CoinsCheckpoint} checkpoint
 */
export function writeCoinsCheckpoint(checkpoint) {
  try {
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint));
  } catch {
    // localStorage lleno o bloqueado: sin checkpoint esta vez (no es crítico).
  }
}
