/**
 * Adapter del puerto de ficheros (FileStoragePort) sobre Firebase Storage. Se
 * usa solo cuando settings.features.fileStorage = true. `storage` se inyecta (no
 * se importa firebase.js aquí) para mantener el adapter testeable.
 *
 * @typedef {import('firebase/storage').FirebaseStorage} FirebaseStorage
 * @typedef {import('../../domain/types.js').FileRef} FileRef
 * @typedef {import('../../domain/ports.js').FileStoragePort} FileStoragePort
 */
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/**
 * @param {FirebaseStorage} storage
 * @returns {FileStoragePort}
 */
export function createFirebaseStorageAdapter(storage) {
  if (!storage) throw new Error('createFirebaseStorageAdapter requiere una instancia de Storage');
  return {
    enabled: true,
    async put(blob, meta = {}) {
      const path = meta.path ?? `uploads/${crypto.randomUUID()}`;
      const target = storageRef(storage, path);
      await uploadBytes(target, blob, meta.contentType ? { contentType: meta.contentType } : undefined);
      const url = await getDownloadURL(target);
      return /** @type {FileRef} */ ({ ref: path, url, provider: 'firebase' });
    },
    async getUrl(ref) {
      return getDownloadURL(storageRef(storage, ref));
    },
    async remove(ref) {
      await deleteObject(storageRef(storage, ref));
    },
  };
}
