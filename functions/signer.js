/**
 * Firmante de TRIBBU-COINS (CP-2) con Cloud KMS.
 *
 * La clave privada (EC P-256, propósito ASYMMETRIC_SIGN con SHA-256) vive en
 * Cloud KMS y NUNCA sale de allí: nadie — ni quien administre Firestore —
 * puede falsificar apuntes del ledger. La Function firma el HASH del apunte
 * (KMS recibe el digest sha256 tal cual, sin re-hashear) y guarda `sig`
 * (firma DER en base64) y `kid` (la versión de clave que firmó, para poder
 * rotar claves sin invalidar la historia).
 *
 * DEGRADACIÓN DOCUMENTADA: si la variable de entorno COINS_KMS_KEY no está
 * definida (la clave aún no se creó en GCP), sign() devuelve null y el emisor
 * escribe el apunte SIN firma marcándolo `unsigned: true` (el marcador entra
 * en el hash: la cadena sigue siendo verificable y el flag no se puede
 * falsear). El verificador del cliente avisa «apuntes sin firma». Cuando la
 * clave exista bastará con setear la env y redesplegar: los apuntes nuevos
 * saldrán firmados sin migrar nada.
 *
 * COINS_KMS_KEY = nombre COMPLETO de la versión de clave, p. ej.:
 *   projects/grebla-app/locations/europe-west1/keyRings/grebla/cryptoKeys/coins-signer/cryptoKeyVersions/1
 */

/** Cliente de KMS, creado UNA vez y solo si hay clave configurada (import
 * dinámico: sin COINS_KMS_KEY no se paga ni el require en el cold start).
 * @type {Promise<import('@google-cloud/kms').KeyManagementServiceClient>|null} */
let kmsClientPromise = null;

/**
 * Nombre de la versión de clave KMS configurada, o null si no hay (modo
 * degradado sin firma).
 * @returns {string|null}
 */
export function coinsKmsKeyName() {
  const name = process.env.COINS_KMS_KEY?.trim();
  return name ? name : null;
}

/** @returns {Promise<import('@google-cloud/kms').KeyManagementServiceClient>} */
function getClient() {
  kmsClientPromise ??= import('@google-cloud/kms').then(
    ({ KeyManagementServiceClient }) => new KeyManagementServiceClient(),
  );
  return kmsClientPromise;
}

/**
 * Firma el hash (sha256 hex) de un apunte con la clave de KMS.
 * @param {string} hashHex  Hash sha256 del canónico del apunte, en hex.
 * @returns {Promise<{ sig: string, kid: string }|null>} Firma DER en base64 y
 *   versión de clave, o null si COINS_KMS_KEY no está definida (sin firma).
 *   Con clave configurada, un fallo de KMS LANZA (nada de apuntes firmados a
 *   medias en silencio): el trigger falla visible y no escribe.
 */
export async function sign(hashHex) {
  const keyName = coinsKmsKeyName();
  if (keyName === null) return null; // degradación documentada: apunte unsigned
  if (!/^[0-9a-f]{64}$/.test(hashHex)) {
    throw new Error(`Hash inválido para firmar: se esperaba sha256 hex (${hashHex}).`);
  }
  const client = await getClient();
  const [response] = await client.asymmetricSign({
    name: keyName,
    digest: { sha256: Buffer.from(hashHex, 'hex') },
  });
  if (!response.signature || response.signature.length === 0) {
    throw new Error('Cloud KMS no devolvió firma para el apunte.');
  }
  return {
    sig: Buffer.from(response.signature).toString('base64'),
    kid: response.name || keyName,
  };
}
