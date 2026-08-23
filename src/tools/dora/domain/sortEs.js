/**
 * Orden alfabético en español (RMR-BUG-0099).
 *
 * `Array.prototype.sort()` sin comparador ordena por código UTF-16, así que
 * «Ángel» cae detrás de «Zoe» y las mayúsculas se agrupan antes que las
 * minúsculas. Para nombres que ve una persona, eso está mal.
 *
 * OJO: esto es SOLO para listas que se muestran. Donde el orden tiene que ser
 * estable e independiente del idioma —claves de un JSON canónico que se firma,
 * fechas en ISO— hay que dejar el orden por código: localizarlo rompería la
 * firma o el orden cronológico.
 *
 * Vive en el dominio de DORA, no en `src/lib`, porque el guard de arquitectura
 * prohíbe que una herramienta dependa de la app. Si otra lo necesita, se copia:
 * es el patrón del repo (tool→tool también está prohibido).
 */

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/**
 * Compara dos textos como los ordenaría una persona hispanohablante.
 * @param {string} a @param {string} b
 */
export const compareEs = (a, b) => collator.compare(a ?? '', b ?? '');

/**
 * Copia ordenada alfabéticamente en español.
 * @param {ReadonlyArray<string>} list
 * @returns {string[]}
 */
export const sortedEs = (list) => [...(list ?? [])].toSorted(compareEs);
