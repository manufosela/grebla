/**
 * Clave PÚBLICA del firmante de TRIBBU-COINS (CP-2), embebida en el cliente.
 *
 * Es la pareja pública de la clave EC P-256 de Cloud KMS con la que la Cloud
 * Function firma cada apunte del ledger. Embebida en el bundle, cualquier
 * cliente verifica las firmas SIN pedir nada a nadie (estilo Certificate
 * Transparency): ni siquiera quien administre Firestore puede falsificar
 * apuntes sin la privada, que nunca sale de KMS.
 *
 * Clave: projects/grebla-app/locations/europe-west1/keyRings/grebla/
 * cryptoKeys/coins-signer/cryptoKeyVersions/1 (EC_SIGN_P256_SHA256).
 * Si se ROTA la clave en KMS, regenerar este PEM:
 *
 *   gcloud kms keys versions get-public-key <versión> \
 *     --key=coins-signer --keyring=grebla --location=europe-west1 \
 *     --project=grebla-app --output-file=coins-public-key.pem
 *
 * @type {string|null}
 */
export const COINS_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEeuNJiEBh22Top0bDtd25gEDVypzX
z2N6/85Pi1fohveu+EIe9dFFu7Zq2TNOTuPbXANs1rxFx9WXOQW8Hw114Q==
-----END PUBLIC KEY-----`;
