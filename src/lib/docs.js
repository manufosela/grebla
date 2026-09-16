/**
 * Documentos de la organización (RMR-PCS-0041): los HTML que explican cómo
 * trabajamos.
 *
 * El FICHERO vive en Firebase Storage bajo `docs/` y sus datos —nombre legible,
 * descripción, carpeta y ruta— en Firestore. Se separan a propósito: listar la
 * documentación no puede obligar a descargar cada presentación.
 *
 * ESCRIBIR va por Cloud Function (RMR-BUG-0116: las reglas de Storage deciden
 * consultando Firestore, y esa consulta cruzada no se resuelve en estos
 * proyectos —denegaba a todo el mundo, superadmin incluido—). Listar va directo
 * a Firestore.
 *
 * VER un documento también va por Cloud Function (RMR-BUG-0124): `openDoc`
 * da un token de UN documento con caducidad y `serveDoc` lo sirve con el origen
 * de la función, no con el nuestro. Así la presentación corre entera (vista del
 * orador de reveal.js incluida) sin alcanzar la sesión ni los datos de GREBLA.
 * No es la URL de descarga de Storage: esa lleva un token que vale para siempre
 * y se reenvía, que es exactamente lo que este diseño viene a evitar.
 */
import { collection, getDocs } from 'firebase/firestore';
import { db, app } from './firebase.js';
import { storagePathOf } from '../tools/docs/domain/paths.js';
import { docViewUrl } from '../tools/docs/domain/viewUrl.js';

const COL = 'docs';

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
 * Cambia los datos de un documento publicado. Si cambia la carpeta, la función
 * mueve además el fichero: cambiar solo la ficha la dejaría apuntando a una ruta
 * donde no hay nada.
 * @param {{ id: string, name: string, description?: string, folder?: string }} input
 */
export async function updateDocMeta(input) {
  if (!input?.name?.trim()) throw new Error('El documento necesita un nombre');
  const { httpsCallable } = await import('firebase/functions');
  const { getRegionalFunctions } = await import('./firebase.js');
  await httpsCallable(await getRegionalFunctions(), 'updateDoc')({
    id: input.id,
    name: input.name.trim(),
    description: input.description ?? '',
    folder: input.folder ?? '',
  });
}

/**
 * URL con la que el visor carga un documento: pide el token de visionado a
 * `openDoc` y lo pega en la URL de `serveDoc`. Caduca sola (4 h): pasado ese
 * tiempo hay que volver a abrir el documento desde la lista.
 * @param {{ id: string }} document
 * @returns {Promise<string>}
 */
export async function openDocView(document) {
  const { httpsCallable } = await import('firebase/functions');
  const { getRegionalFunctions } = await import('./firebase.js');
  const res = await httpsCallable(await getRegionalFunctions(), 'openDoc')({ id: document.id });
  const emulators = import.meta.env.PUBLIC_USE_EMULATORS === 'true' && typeof window !== 'undefined';
  return docViewUrl({
    projectId: app.options.projectId,
    token: res.data?.token,
    emulatorHost: emulators ? (import.meta.env.PUBLIC_FIRESTORE_EMULATOR_HOST ?? '127.0.0.1') : '',
  });
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
