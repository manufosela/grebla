/**
 * Documentos de la organización (RMR-PCS-0041): los HTML que explican cómo
 * trabajamos.
 *
 * El FICHERO vive en Firebase Storage bajo `docs/` y sus datos —nombre legible,
 * descripción, carpeta y ruta— en Firestore. Se separan a propósito: listar la
 * documentación no puede obligar a descargar cada presentación.
 *
 * Y se leen con `getBlob`, no con `getDownloadURL`: la URL de descarga lleva un
 * token que funciona sin sesión y se puede reenviar, que es exactamente lo que
 * este diseño viene a evitar. Con getBlob manda la regla de Storage.
 */
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { storagePathOf } from '../tools/docs/domain/paths.js';

const COL = 'docs';

/** Storage bajo demanda: no lo carga quien solo pasa por el hub. */
async function storage() {
  const [{ getStorage }, { app }] = await Promise.all([
    import('firebase/storage'),
    import('./firebase.js'),
  ]);
  return getStorage(app);
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
 * Publica un documento: sube el fichero y guarda sus datos.
 *
 * El orden importa. Primero el fichero: si se guardaran antes los datos y
 * fallara la subida, la lista ofrecería un documento que no se puede abrir.
 *
 * @param {{ id?: string, name: string, description?: string, folder?: string, fileName: string, file: Blob }} input
 * @returns {Promise<string>} id del documento
 */
export async function publishDoc(input) {
  const path = storagePathOf({ folder: input.folder, fileName: input.fileName });
  if (!path) throw new Error('El documento necesita un nombre de fichero utilizable');
  if (!input?.name?.trim()) throw new Error('El documento necesita un nombre');

  const { ref, uploadBytes } = await import('firebase/storage');
  await uploadBytes(ref(await storage(), path), input.file, { contentType: 'text/html' });

  const id = input.id || path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  await setDoc(doc(db, COL, id), {
    name: input.name.trim(),
    description: String(input.description ?? '').trim(),
    folder: input.folder ?? '',
    path,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return id;
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
 * Retira un documento: el fichero y sus datos.
 *
 * Primero los datos: si se borrara antes el fichero y fallara lo segundo,
 * quedaría en la lista un documento que ya no existe.
 * @param {{ id: string, path: string }} document
 */
export async function removeDoc(document) {
  await deleteDoc(doc(db, COL, document.id));
  const { ref, deleteObject } = await import('firebase/storage');
  await deleteObject(ref(await storage(), document.path));
}
