/**
 * Documentos de la organización (RMR-PCS-0041): los HTML que explican cómo
 * trabajamos.
 *
 * El FICHERO vive en Firebase Storage bajo `docs/` y sus datos —nombre legible,
 * descripción, carpeta y ruta— en Firestore. Se separan a propósito: listar la
 * documentación no puede obligar a descargar cada presentación.
 *
 * ESCRIBIR va por Cloud Function y LEER va directo. No es una asimetría
 * caprichosa (RMR-BUG-0116): las reglas de Storage deciden consultando
 * Firestore, y esa consulta cruzada no se resuelve en estos proyectos —denegaba
 * a todo el mundo, superadmin incluido—. La regla de lectura no consulta nada y
 * funciona, así que se queda como está.
 *
 * Y se lee con `getBlob`, no con `getDownloadURL`: la URL de descarga lleva un
 * token que funciona sin sesión y se puede reenviar, que es exactamente lo que
 * este diseño viene a evitar. Con getBlob manda la regla de Storage.
 */
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase.js';
import { storagePathOf } from '../tools/docs/domain/paths.js';

const COL = 'docs';

/**
 * Storage bajo demanda: no lo carga quien solo pasa por el hub.
 *
 * En los E2E apunta al emulador, igual que auth y Firestore. Sin esto la subida
 * saldría hacia el bucket real desde un test — o no llegaría a ninguna parte.
 */
let storageRef = null;
async function storage() {
  if (storageRef) return storageRef;
  const [{ getStorage, connectStorageEmulator }, { app }] = await Promise.all([
    import('firebase/storage'),
    import('./firebase.js'),
  ]);
  storageRef = getStorage(app);
  if (import.meta.env.PUBLIC_USE_EMULATORS === 'true' && typeof window !== 'undefined') {
    const host = import.meta.env.PUBLIC_FIRESTORE_EMULATOR_HOST ?? '127.0.0.1';
    connectStorageEmulator(storageRef, host, 9199);
  }
  return storageRef;
}

/**
 * Los documentos publicados, con sus datos. El fichero no se toca aquí.
 * @returns {Promise<Array<{id: string, name: string, description: string, folder: string, path: string, updatedAt: unknown}>>}
 */
export async function listDocs() {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map((d) => ({
    id: d.id,
    name: d.data().name ?? d.id,
    description: d.data().description ?? '',
    folder: d.data().folder ?? '',
    path: d.data().path ?? '',
    updatedAt: d.data().updatedAt ?? null,
  }));
}

/**
 * Publica un documento. El fichero viaja como texto a la Cloud Function, que
 * comprueba el permiso contra Firestore y escribe con el Admin SDK.
 *
 * @param {{ name: string, description?: string, folder?: string, fileName: string, file: Blob }} input
 * @returns {Promise<string>} id del documento
 */
export async function publishDoc(input) {
  if (!input?.name?.trim()) throw new Error('El documento necesita un nombre');
  if (!storagePathOf({ folder: input.folder, fileName: input.fileName })) {
    throw new Error('El documento necesita un nombre de fichero utilizable');
  }
  const html = await input.file.text();
  const { httpsCallable } = await import('firebase/functions');
  const { getRegionalFunctions } = await import('./firebase.js');
  const res = await httpsCallable(await getRegionalFunctions(), 'publishDoc')({
    name: input.name.trim(),
    description: input.description ?? '',
    folder: input.folder ?? '',
    fileName: input.fileName,
    html,
  });
  return res.data.id;
}

/**
 * Contenido de un documento, como Blob. Lo trae respetando las reglas: sin
 * sesión, Storage lo deniega.
 * @param {string} path
 * @returns {Promise<Blob>}
 */
export async function fetchDocBlob(path) {
  if (!String(path ?? '').startsWith('docs/')) throw new Error(`Ruta de documento no válida: ${path}`);
  const { ref, getBlob } = await import('firebase/storage');
  return getBlob(ref(await storage(), path));
}

/**
 * Retira un documento: el fichero y su ficha, por la misma puerta que la
 * publicación.
 * @param {{ id: string }} document
 */
export async function removeDoc(document) {
  const { httpsCallable } = await import('firebase/functions');
  const { getRegionalFunctions } = await import('./firebase.js');
  await httpsCallable(await getRegionalFunctions(), 'removeDoc')({ id: document.id });
}
