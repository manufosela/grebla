/**
 * Adapter NULO del puerto de ficheros (FileStoragePort). Es el DEFAULT del MVP
 * (settings.features.fileStorage = false): no sube nada, por coste. La UI degrada
 * (oculta el subir-audio y permite pegar una URL externa). `getUrl` devuelve la
 * referencia tal cual, de modo que una URL externa pegada a mano sigue resolviéndose.
 *
 * @typedef {import('../../domain/ports.js').FileStoragePort} FileStoragePort
 */

/**
 * @returns {FileStoragePort}
 */
export function createNullStorageAdapter() {
  return {
    enabled: false,
    async put() {
      throw new Error(
        'El almacenamiento de ficheros está desactivado (settings.features.fileStorage = false)',
      );
    },
    async getUrl(ref) {
      return ref; // URL externa pegada a mano → se devuelve sin cambios
    },
    async remove() {
      // No-op: no hay nada que borrar cuando el almacenamiento está desactivado.
    },
  };
}
