/**
 * TRIBBU-COINS (CP-2): dominio PURO del libro mayor firmado y verificable.
 *
 * Los tribbu-coins se emiten SOLO por contratos versionados (CONTRACTS_V1) y
 * quedan en un ledger estilo Certificate Transparency: apuntes con id
 * determinista, numerados (seq), encadenados por hash (prevHash → hash) y
 * firmados con una clave asimétrica en Cloud KMS que solo posee la Cloud
 * Function emisora. Cualquier cliente puede recomputar hashes, verificar la
 * cadena, contrastar cada delta contra su contrato y comparar los saldos
 * materializados con la suma del ledger: si alguien tocase la BBDD a mano
 * («me pongo 1000 puntos»), la manipulación se detecta.
 *
 * Este módulo es ISOMÓRFICO (navegador y Node ≥ 20): el hash usa Web Crypto
 * (`crypto.subtle`, disponible en ambos). La Cloud Function emisora NO importa
 * de src/ (convención del repo): functions/coins.js es su ESPEJO — si tocas un
 * contrato o el canónico aquí, tócalo allí en el mismo commit.
 *
 * Rutas en Firestore (IO en src/lib/coins.js; escribe solo el Admin SDK):
 *  - /coins/meta                      { seq, headHash, updatedAt }
 *  - /coins/ledger/entries/{entryId}  los apuntes (id determinista)
 *  - /coins/balances/people/{personId} { balance, updatedAt }
 * OJO: el diseño decía /coins/ledger/{entryId} y /coins/balances/{personId},
 * pero esos paths tienen un número IMPAR de segmentos (en Firestore un
 * documento necesita un número par): se cuelgan de los docs-fantasma `ledger`
 * y `balances`. La regla `match /coins/{document=**}` cubre todo el subárbol.
 *
 * Un APUNTE (CoinsEntry) tiene esta forma:
 *   { id, seq, personId, delta, reason, ruleId, ruleVersion, refs, ts,
 *     prevHash, hash, sig?, kid?, unsigned? }
 * donde `hash = sha256(JSON canónico de todo MENOS hash/sig/kid)` en hex y
 * `sig` es la firma (base64, ECDSA P-256/SHA-256 de Cloud KMS) del mensaje
 * canónico (KMS firma el digest = hash). El marcador `unsigned: true` (apuntes
 * emitidos sin COINS_KMS_KEY configurada) SÍ entra en el hash: si no, quien
 * tocase la BBDD podría quitar la firma de un apunte legítimo y marcarlo
 * unsigned sin romper la cadena (downgrade).
 *
 * @typedef {'certificate'|'citizenship'|'superCitizen'|'legend'|'carpoolCompleted'} CoinsRuleId
 *
 * @typedef {Object} CoinsEntry
 * @property {string} id          Id determinista (idempotencia del emisor)
 * @property {number} seq         Nº de apunte, 1..n contiguo
 * @property {string} personId    Persona que recibe los coins
 * @property {number} delta       Coins emitidos (siempre > 0 en v1)
 * @property {string} reason      Texto legible en español (queda hasheado)
 * @property {CoinsRuleId} ruleId Contrato aplicado
 * @property {number} ruleVersion Versión del contrato (1)
 * @property {Record<string, unknown>} refs Evidencia del contrato (cityId/weight, islandId, carpoolId/stops…)
 * @property {string} ts          ISO 8601 de la emisión
 * @property {string} prevHash    Hash del apunte anterior (o GENESIS_HASH)
 * @property {string} hash        sha256 hex del canónico
 * @property {string} [sig]       Firma base64 (ausente en apuntes sin firmar)
 * @property {string} [kid]       Recurso de la versión de clave KMS que firmó
 * @property {boolean} [unsigned] true si se emitió sin clave KMS (degradación)
 *
 * @typedef {Object} CoinsCheckpoint  Última cabeza VISTA por este cliente
 * @property {number} seq
 * @property {string} headHash
 */

/** Versión vigente de los contratos de emisión. */
export const RULE_VERSION = 1;

/** prevHash del primer apunte del ledger (no hay apunte anterior). */
export const GENESIS_HASH = '0'.repeat(64);

/**
 * A partir de cuántos apuntes el verificador avisa de que la lectura completa
 * del ledger empieza a ser cara (v1 lee todo; la paginación llegará después).
 */
export const LEDGER_SOFT_LIMIT = 2000;

/**
 * CONTRATOS v1 de emisión de tribbu-coins. Mismos valores que en
 * functions/coins.js (espejo): el cliente recomputa con ESTOS y detecta
 * cualquier delta inventado.
 *  - certificate: peso de la ciudad (1-3) × 10 → 10/20/30.
 *  - citizenship: 100 por ciudadanía de isla.
 *  - superCitizen: 500 (badge ⭐, ≥3 ciudadanías incluyendo Bases).
 *  - legend: 1000 (badge 👑, ≥6 ciudadanías).
 *  - carpoolCompleted: paradas de la ruta × 2 (el «+20%» del bonus: 2 = 20% de 10).
 */
export const CONTRACTS_V1 = Object.freeze({
  /** @param {number} weight Peso 1-3 de la ciudad. */
  certificate: (weight) => weight * 10,
  citizenship: 100,
  superCitizen: 500,
  legend: 1000,
  /** @param {number} stops Paradas de la ruta del carpool. */
  carpoolCompleted: (stops) => stops * 2,
});

// ── Ids deterministas (idempotencia del emisor) ─────────────────────────────

/**
 * Clave de ciudad apta para id de documento: los ids de ciudad llevan '/'
 * ('bases/git') y Firestore no admite '/' en un id de doc — se sustituye por
 * '~' (carácter que no aparece en ids de ciudad). Determinista y reversible.
 * @param {string} cityId
 * @returns {string}
 */
export function cityKey(cityId) {
  return String(cityId ?? '').replaceAll('/', '~');
}

/** Id del apunte de un certificado. @param {string} personId @param {string} cityId */
export function certEntryId(personId, cityId) {
  return `cert:${personId}:${cityKey(cityId)}`;
}

/** Id del apunte de una ciudadanía de isla. @param {string} personId @param {string} islandId */
export function citizenshipEntryId(personId, islandId) {
  return `citz:${personId}:${islandId}`;
}

/** Id del apunte de un badge. @param {string} personId @param {'superCitizen'|'legend'} badge */
export function badgeEntryId(personId, badge) {
  return `badge:${personId}:${badge}`;
}

/** Id del apunte de un carpool completado. @param {string} carpoolId @param {string} personId */
export function carpoolEntryId(carpoolId, personId) {
  return `carpool:${carpoolId}:${personId}`;
}

// ── Canónico y hash ─────────────────────────────────────────────────────────

/**
 * JSON canónico: claves de objeto ORDENADAS alfabéticamente en todos los
 * niveles (los arrays conservan su orden) y sin claves undefined. Dos entradas
 * con el mismo contenido producen SIEMPRE el mismo texto — condición para que
 * el hash sea recomputable por cualquier actor.
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  const obj = /** @type {Record<string, unknown>} */ (value);
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

/**
 * Texto canónico de un apunte: TODO menos hash/sig/kid (que se calculan
 * después). `id`, `unsigned` y el resto de campos SÍ entran (ver cabecera).
 * @param {CoinsEntry|Record<string, unknown>} entry
 * @returns {string}
 */
export function canonicalEntry(entry) {
  const rest = { .../** @type {Record<string, unknown>} */ (entry) };
  delete rest.hash;
  delete rest.sig;
  delete rest.kid;
  return canonicalJson(rest);
}

/** Bytes → hex minúscula. @param {ArrayBuffer|Uint8Array} bytes @returns {string} */
function toHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * sha256 hex de un texto (Web Crypto: navegador y Node ≥ 20 comparten
 * `crypto.subtle`, así que el módulo es isomórfico sin inyección).
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return toHex(digest);
}

/**
 * Hash de un apunte: sha256 hex de su canónico.
 * @param {CoinsEntry|Record<string, unknown>} entry
 * @returns {Promise<string>}
 */
export function entryHash(entry) {
  return sha256Hex(canonicalEntry(entry));
}

// ── Verificación de la cadena ───────────────────────────────────────────────

/**
 * Resultado de verificar la cadena de apuntes.
 * @typedef {Object} ChainResult
 * @property {boolean} ok
 * @property {number} length     Apuntes verificados hasta el fallo (o todos)
 * @property {string} headHash   Hash de la cabeza verificada (GENESIS si vacío)
 * @property {number} [brokenAt] seq del apunte donde se rompe
 * @property {string} [reason]   Motivo legible del fallo
 */

/**
 * Verifica la cadena completa: seq contiguo desde 1, cada prevHash enlaza con
 * el hash anterior (el primero con GENESIS_HASH) y cada hash coincide con el
 * recomputado de su contenido. `entries` debe venir ordenado por seq
 * ascendente (así lo devuelve getLedger).
 * @param {CoinsEntry[]} entries
 * @returns {Promise<ChainResult>}
 */
export async function verifyChain(entries) {
  let prevHash = GENESIS_HASH;
  let prevSeq = 0;
  for (const entry of entries) {
    if (entry.seq !== prevSeq + 1) {
      return {
        ok: false,
        length: prevSeq,
        headHash: prevHash,
        brokenAt: entry.seq,
        reason: `seq ${entry.seq} no es consecutivo (se esperaba ${prevSeq + 1}): falta o sobra un apunte`,
      };
    }
    if (entry.prevHash !== prevHash) {
      return {
        ok: false,
        length: prevSeq,
        headHash: prevHash,
        brokenAt: entry.seq,
        reason: 'prevHash no enlaza con el apunte anterior (cadena rota)',
      };
    }
    const recomputed = await entryHash(entry);
    if (recomputed !== entry.hash) {
      return {
        ok: false,
        length: prevSeq,
        headHash: prevHash,
        brokenAt: entry.seq,
        reason: 'el hash no coincide con el contenido del apunte (apunte alterado)',
      };
    }
    prevHash = entry.hash;
    prevSeq = entry.seq;
  }
  return { ok: true, length: prevSeq, headHash: prevHash };
}

// ── Verificación de contratos (delta == regla aplicada a refs) ──────────────

/** @param {unknown} value @returns {number|null} Entero positivo o null. */
function toPositiveInt(value) {
  return Number.isInteger(value) && /** @type {number} */ (value) > 0
    ? /** @type {number} */ (value)
    : null;
}

/**
 * Delta que DEBERÍA tener un apunte según su contrato y sus refs, o null si
 * la regla es desconocida, la versión no es la vigente o las refs no dan para
 * recomputar (peso fuera de 1-3, paradas no enteras…).
 * @param {CoinsEntry} entry
 * @returns {number|null}
 */
export function expectedDelta(entry) {
  if (entry?.ruleVersion !== RULE_VERSION) return null;
  switch (entry.ruleId) {
    case 'certificate': {
      const weight = toPositiveInt(entry.refs?.weight);
      return weight !== null && weight <= 3 ? CONTRACTS_V1.certificate(weight) : null;
    }
    case 'citizenship':
      return CONTRACTS_V1.citizenship;
    case 'superCitizen':
      return CONTRACTS_V1.superCitizen;
    case 'legend':
      return CONTRACTS_V1.legend;
    case 'carpoolCompleted': {
      const stops = toPositiveInt(entry.refs?.stops);
      return stops !== null ? CONTRACTS_V1.carpoolCompleted(stops) : null;
    }
    default:
      return null;
  }
}

/**
 * Id determinista que DEBERÍA tener el apunte según su regla y refs, o null
 * si la regla es desconocida o faltan refs.
 * @param {CoinsEntry} entry
 * @returns {string|null}
 */
export function expectedEntryId(entry) {
  const personId = String(entry?.personId ?? '');
  switch (entry?.ruleId) {
    case 'certificate':
      return typeof entry.refs?.cityId === 'string' ? certEntryId(personId, entry.refs.cityId) : null;
    case 'citizenship':
      return typeof entry.refs?.islandId === 'string'
        ? citizenshipEntryId(personId, entry.refs.islandId)
        : null;
    case 'superCitizen':
    case 'legend':
      return badgeEntryId(personId, entry.ruleId);
    case 'carpoolCompleted':
      return typeof entry.refs?.carpoolId === 'string'
        ? carpoolEntryId(entry.refs.carpoolId, personId)
        : null;
    default:
      return null;
  }
}

/**
 * Verifica UN apunte contra su contrato (v1): el delta debe ser exactamente
 * la regla aplicada a sus refs y su id el determinista de la regla. (La
 * recomputación completa contra journeys/carpools de origen es v2: esto ya
 * detecta deltas inventados y apuntes bajo un id ajeno.)
 * @param {CoinsEntry} entry
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function verifyEntryAgainstRule(entry) {
  const expected = expectedDelta(entry);
  if (expected === null) {
    return { ok: false, reason: `regla desconocida o refs inválidas (ruleId=${entry?.ruleId}, v${entry?.ruleVersion})` };
  }
  if (entry.delta !== expected) {
    return { ok: false, reason: `delta ${entry.delta} ≠ ${expected} según el contrato ${entry.ruleId}` };
  }
  const id = expectedEntryId(entry);
  if (id === null || entry.id !== id) {
    return { ok: false, reason: `id «${entry.id}» no corresponde a la regla (esperado «${id}»)` };
  }
  return { ok: true };
}

// ── Saldos ──────────────────────────────────────────────────────────────────

/**
 * Saldos por persona derivados del ledger (suma de deltas).
 * @param {CoinsEntry[]} entries
 * @returns {Record<string, number>}
 */
export function computeBalances(entries) {
  /** @type {Record<string, number>} */
  const balances = {};
  for (const entry of entries) {
    balances[entry.personId] = (balances[entry.personId] ?? 0) + entry.delta;
  }
  return balances;
}

/**
 * Compara los saldos recomputados del ledger con los materializados en
 * /coins/balances. Una persona con saldo materializado y sin apuntes (o al
 * revés) también es una discrepancia.
 * @param {Record<string, number>} computed
 * @param {Record<string, number>} stored
 * @returns {{ ok: boolean, mismatches: { personId: string, computed: number, stored: number }[] }}
 */
export function diffBalances(computed, stored) {
  const mismatches = [];
  for (const personId of new Set([...Object.keys(computed), ...Object.keys(stored)])) {
    const a = computed[personId] ?? 0;
    const b = stored[personId] ?? 0;
    if (a !== b) mismatches.push({ personId, computed: a, stored: b });
  }
  return { ok: mismatches.length === 0, mismatches };
}

// ── Checkpoint local (historia vista) ───────────────────────────────────────

/**
 * Contrasta la historia vista (checkpoint local: última seq + headHash) con el
 * ledger actual. Si el apunte de esa seq ya no existe o su hash cambió, la
 * historia que este cliente vio fue REESCRITA: alerta roja.
 * @param {CoinsEntry[]} entries
 * @param {CoinsCheckpoint|null} checkpoint
 * @returns {{ ok: boolean, checked: boolean, reason?: string }}
 */
export function verifyCheckpoint(entries, checkpoint) {
  if (checkpoint === null) return { ok: true, checked: false };
  const entry = entries.find((e) => e.seq === checkpoint.seq);
  if (!entry) {
    return {
      ok: false,
      checked: true,
      reason: `el libro mayor ya no llega a la seq ${checkpoint.seq} que este cliente vio (historia acortada)`,
    };
  }
  if (entry.hash !== checkpoint.headHash) {
    return {
      ok: false,
      checked: true,
      reason: `el apunte ${checkpoint.seq} ya no es el que este cliente vio (historia reescrita)`,
    };
  }
  return { ok: true, checked: true };
}

// ── Firma (ECDSA P-256 / SHA-256, formato de Cloud KMS) ─────────────────────

/** base64 → bytes (atob existe en navegador y Node ≥ 16). @param {string} b64 */
function base64ToBytes(b64) {
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/**
 * PEM (SPKI, «PUBLIC KEY») → DER. Lanza si el PEM no tiene la cabecera
 * esperada: una clave mal pegada debe fallar alto, no verificar en falso.
 * @param {string} pem
 * @returns {Uint8Array}
 */
export function pemToDer(pem) {
  const match = /-----BEGIN PUBLIC KEY-----([\s\S]+?)-----END PUBLIC KEY-----/.exec(pem ?? '');
  if (!match) throw new Error('Clave pública inválida: se esperaba un PEM «PUBLIC KEY» (SPKI).');
  return base64ToBytes(match[1].replaceAll(/\s/g, ''));
}

/**
 * Importa la clave pública del firmante (PEM SPKI, EC P-256) para verificar.
 * @param {string} pem
 * @returns {Promise<CryptoKey>}
 */
export function importCoinsPublicKey(pem) {
  return crypto.subtle.importKey(
    'spki',
    pemToDer(pem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
}

/**
 * Firma ECDSA DER (la que devuelve Cloud KMS: SEQUENCE { INTEGER r, INTEGER s })
 * → formato raw IEEE P1363 (r‖s, 32+32 bytes), que es el que espera Web Crypto.
 * @param {Uint8Array} der
 * @returns {Uint8Array}
 */
export function derToP1363(der) {
  /** Lee un INTEGER en `at` y lo devuelve como 32 bytes exactos. @param {number} at */
  const readInt = (at) => {
    if (der[at] !== 0x02) throw new Error('Firma DER inválida: se esperaba INTEGER.');
    const len = der[at + 1];
    let start = at + 2;
    let size = len;
    // Los INTEGER positivos con el bit alto llevan un 0x00 de relleno delante.
    while (size > 32 && der[start] === 0x00) {
      start += 1;
      size -= 1;
    }
    if (size > 32) throw new Error('Firma DER inválida: INTEGER de más de 32 bytes para P-256.');
    const out = new Uint8Array(32);
    out.set(der.subarray(start, start + size), 32 - size);
    return { bytes: out, next: at + 2 + len };
  };
  if (der[0] !== 0x30) throw new Error('Firma DER inválida: se esperaba SEQUENCE.');
  // Longitud de la SEQUENCE: forma corta (<128) o larga de 1 byte (0x81).
  const bodyAt = der[1] === 0x81 ? 3 : 2;
  const r = readInt(bodyAt);
  const s = readInt(r.next);
  const out = new Uint8Array(64);
  out.set(r.bytes, 0);
  out.set(s.bytes, 32);
  return out;
}

/**
 * Verifica la firma de un apunte con la clave pública del firmante. El mensaje
 * es el canónico del apunte (KMS firmó su digest sha256 == entry.hash, y Web
 * Crypto hashea el mensaje por su cuenta). Acepta firma DER (KMS) o raw P1363.
 * @param {CoinsEntry} entry
 * @param {CryptoKey} publicKey
 * @returns {Promise<boolean>}
 */
export async function verifyEntrySignature(entry, publicKey) {
  if (typeof entry?.sig !== 'string' || entry.sig === '') return false;
  let raw;
  try {
    const bytes = base64ToBytes(entry.sig);
    raw = bytes.length === 64 ? bytes : derToP1363(bytes);
  } catch {
    return false; // una firma imparseable NO verifica (nunca «pasa» en silencio)
  }
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    raw,
    new TextEncoder().encode(canonicalEntry(entry)),
  );
}

// ── Verificación completa (el «verificar libro mayor» del cliente) ──────────

/**
 * Resultado detallado de la verificación del libro mayor.
 * @typedef {Object} LedgerVerification
 * @property {boolean} ok       Todo lo COMPROBABLE pasó (lo saltado no cuenta como fallo)
 * @property {boolean} alert    Manipulación detectada: cadena rota, checkpoint
 *   traicionado o firma inválida — la alerta roja del HUD
 * @property {string[]} warnings Avisos no bloqueantes (clave pública pendiente,
 *   apuntes sin firma, ledger grande)
 * @property {{
 *   chain: ChainResult,
 *   meta: { ok: boolean, checked: boolean, reason?: string },
 *   rules: { ok: boolean, failures: { seq: number, reason: string }[] },
 *   balances: { ok: boolean, checked: boolean, mismatches: { personId: string, computed: number, stored: number }[] },
 *   signatures: { ok: boolean, checked: boolean, verified: number, unsigned: number, failures: number[] },
 *   checkpoint: { ok: boolean, checked: boolean, reason?: string },
 * }} checks
 */

/**
 * Verificación COMPLETA del libro mayor (v1): cadena de hashes, coherencia con
 * /coins/meta, contratos apunte a apunte, saldos materializados frente a la
 * recomputación, firmas (si hay clave pública) y checkpoint local (historia
 * vista). Puro: toda la IO (ledger, meta, saldos, localStorage) la aporta el
 * caller.
 * @param {{
 *   entries: CoinsEntry[],
 *   meta?: { seq: number, headHash: string }|null,
 *   balances?: Record<string, number>|null,
 *   publicKeyPem?: string|null,
 *   checkpoint?: CoinsCheckpoint|null,
 * }} input
 * @returns {Promise<LedgerVerification>}
 */
export async function verifyLedger({
  entries,
  meta = null,
  balances = null,
  publicKeyPem = null,
  checkpoint = null,
}) {
  /** @type {string[]} */
  const warnings = [];

  const chain = await verifyChain(entries);

  // /coins/meta debe apuntar a la cabeza real de la cadena.
  let metaCheck = { ok: true, checked: false, reason: /** @type {string|undefined} */ (undefined) };
  if (meta !== null) {
    const ok = meta.seq === chain.length && meta.headHash === chain.headHash;
    metaCheck = ok
      ? { ok: true, checked: true, reason: undefined }
      : {
          ok: false,
          checked: true,
          reason: `meta (seq ${meta.seq}, head …${meta.headHash.slice(-8)}) no coincide con la cabeza del ledger (seq ${chain.length})`,
        };
  }

  const ruleFailures = entries
    .map((entry) => ({ seq: entry.seq, result: verifyEntryAgainstRule(entry) }))
    .filter((r) => !r.result.ok)
    .map((r) => ({ seq: r.seq, reason: /** @type {{ok: false, reason: string}} */ (r.result).reason }));

  const balancesCheck =
    balances === null
      ? { ok: true, checked: false, mismatches: [] }
      : { checked: true, ...diffBalances(computeBalances(entries), balances) };

  const cp = verifyCheckpoint(entries, checkpoint);

  const unsigned = entries.filter((e) => typeof e.sig !== 'string' || e.sig === '').length;
  let signatures = { ok: true, checked: false, verified: 0, unsigned, failures: /** @type {number[]} */ ([]) };
  if (publicKeyPem === null || publicKeyPem === '') {
    warnings.push('Clave pública pendiente: las firmas de los apuntes no se han comprobado.');
  } else {
    const key = await importCoinsPublicKey(publicKeyPem);
    const failures = [];
    let verified = 0;
    for (const entry of entries) {
      if (typeof entry.sig !== 'string' || entry.sig === '') continue; // contado en unsigned
      if (await verifyEntrySignature(entry, key)) verified += 1;
      else failures.push(entry.seq);
    }
    signatures = { ok: failures.length === 0, checked: true, verified, unsigned, failures };
  }
  if (unsigned > 0) {
    warnings.push(`${unsigned} apunte${unsigned === 1 ? '' : 's'} sin firma (emitidos sin clave KMS configurada).`);
  }
  if (entries.length > LEDGER_SOFT_LIMIT) {
    warnings.push(`El ledger tiene ${entries.length} apuntes (> ${LEDGER_SOFT_LIMIT}): la verificación completa empieza a ser cara.`);
  }

  // Alerta ROJA: algo demuestra manipulación (no un simple aviso).
  const alert = !chain.ok || (cp.checked && !cp.ok) || !signatures.ok;
  const ok =
    chain.ok && metaCheck.ok && ruleFailures.length === 0 && balancesCheck.ok && cp.ok && signatures.ok;

  return {
    ok,
    alert,
    warnings,
    checks: {
      chain,
      meta: metaCheck,
      rules: { ok: ruleFailures.length === 0, failures: ruleFailures },
      balances: balancesCheck,
      signatures,
      checkpoint: cp,
    },
  };
}

// ── Presentación ────────────────────────────────────────────────────────────

/**
 * Etiqueta legible en español de un apunte para el historial (overlay y
 * ficha). Usa los nombres de las refs si el emisor los incluyó y cae al id.
 * @param {CoinsEntry} entry
 * @returns {string}
 */
export function entryLabel(entry) {
  const refs = entry?.refs ?? {};
  switch (entry?.ruleId) {
    case 'certificate':
      return `Certificado de ${refs.cityName ?? refs.cityId ?? '¿?'}`;
    case 'citizenship':
      return `Ciudadanía de ${refs.islandName ?? refs.islandId ?? '¿?'}`;
    case 'superCitizen':
      return 'Badge ⭐ Super-ciudadano';
    case 'legend':
      return 'Badge 👑 Leyenda del archipiélago';
    case 'carpoolCompleted':
      return `Carpool «${refs.carpoolName ?? refs.carpoolId ?? '¿?'}» completado`;
    default:
      return String(entry?.reason ?? entry?.ruleId ?? 'Apunte');
  }
}
