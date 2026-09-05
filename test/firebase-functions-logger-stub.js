/**
 * Stub de `firebase-functions/v2` para los tests.
 *
 * `functions/` es un bundle aparte con sus propios node_modules, que en CI no se
 * instalan: importar functions/portal.js desde Vitest reventaba con
 * ERR_MODULE_NOT_FOUND al llegar al logger, y la suite entera se caía por una
 * dependencia que el test ni usa.
 *
 * Solo se aliasa el logger, que es lo único que el código bajo prueba toca de
 * firebase-functions. Si algún día se usa más, fallará aquí y a la vista, en vez
 * de en el despliegue.
 */
const noop = () => {};
export const logger = { info: noop, error: noop, warn: noop, debug: noop, log: noop };
