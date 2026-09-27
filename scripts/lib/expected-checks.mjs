/**
 * Qué checks TIENE que traer una PR, según los workflows del propio repo
 * (RMR-BUG-0131).
 *
 * Por qué existe: «todos los checks en verde» no dice nada si GitHub todavía no
 * los ha registrado todos. En la PR #922 el script miró justo tras el push, vio
 * UN check —GitGuardian, que responde en un segundo—, lo encontró verde y
 * mergeó. Los otros cuatro llegaron después, y `e2e` tardó ocho minutos. Salió
 * bien por suerte, que es exactamente lo que este script venía a evitar.
 *
 * La primera solución fue esperar a que la lista dejara de crecer. La revisión
 * cruzada la tumbó, y con razón: un rato sin novedades no PRUEBA que estén
 * todos, solo que no han llegado aún. Un workflow que tarde en registrarse más
 * que la espera vuelve a colar el merge.
 *
 * Así que la fuente es la única que no depende del reloj: los ficheros de
 * `.github/workflows` que este mismo commit lleva. Son los que GitHub va a
 * ejecutar, están versionados y se leen sin red.
 *
 * Lo que NO cubre, dicho para que no se confunda con una garantía total: los
 * checks de apps externas (GitGuardian y compañía) no están en esos ficheros y
 * no se pueden enumerar. Si aparecen, se les exige el verde como a cualquiera;
 * si no aparecen, no se les espera. Lo que este módulo garantiza es que no se
 * mergea sin NUESTROS checks, que son los que miran el código.
 */

/** Parseo acotado de YAML: solo hace falta saber si dispara en PR y sus jobs. */
const JOB_ID = /^ {2}([A-Za-z_][\w-]*):\s*$/;

/**
 * Dentro del bloque `on:`, cualquiera de las formas en que YAML deja escribir el
 * evento: clave suelta (`pull_request:`), clave con valor en línea
 * (`pull_request: { branches: [main] }`) o elemento de lista (`- pull_request`).
 */
const PULL_REQUEST_LINE = /^\s+(?:-\s*)?pull_request\b/;

/**
 * ¿Este workflow se dispara al abrir o actualizar una PR?
 *
 * Se aceptan las cuatro formas válidas, porque las cuatro son YAML correcto y
 * cualquiera de ellas la ejecuta GitHub igual:
 *
 *     on: pull_request
 *     on: [push, pull_request]
 *     on: { pull_request: { branches: [main] } }
 *     on:
 *       pull_request:
 *     on:
 *       pull_request: { branches: [main] }
 *     on:
 *       - pull_request
 *
 * Reconocer solo una parte era el agujero que este módulo venía a tapar: un
 * workflow escrito de otra manera se quedaba fuera de «lo esperado» y su check
 * dejaba de bloquear el merge.
 *
 * No se interpretan los filtros de rama a propósito. Un workflow limitado a
 * otras ramas quedaría como esperado y el merge se bloquearía esperando un check
 * que no va a llegar: eso es un falso bloqueo, que se ve enseguida y se arregla.
 * El error contrario —mergear sin esperar— es el que no se ve.
 *
 * @param {string} content
 */
export function runsOnPullRequest(content) {
  const lines = content.split('\n');
  const start = lines.findIndex((l) => /^on:/.test(l));
  if (start === -1) return false;

  // Todo lo que quepa en la misma línea: escalar (`on: pull_request`), lista
  // (`on: [push, pull_request]`) o mapa en línea (`on: { pull_request: … }`).
  //
  // Aquí NO se distingue el anidamiento, y se acepta a sabiendas: un
  // `on: { push: { branches: [pull_request] } }` daría un falso positivo, pero
  // eso exige una rama llamada «pull_request» y el precio sería esperar por un
  // check que no llega —visible y barato—. No reconocer `on: pull_request`, en
  // cambio, deja mergear antes de tiempo, que es el fallo que no se ve.
  const enLinea = /^on:\s*(\S.*)$/.exec(lines[start])?.[1];
  if (enLinea) return /\bpull_request\b/.test(enLinea);

  // Solo cuentan los HIJOS DIRECTOS de `on:`. Mirar a cualquier profundidad daba
  // por evento un `on:\n  push:\n    branches: [pull_request]`, y ese workflow
  // entraba en «lo esperado»: el merge se quedaría esperando para siempre un
  // check que no va a correr nunca.
  let nivel = null;
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '' || /^\s*#/.test(line)) continue;
    if (/^\S/.test(line)) break; // se acabó el bloque `on:`
    const sangria = line.length - line.trimStart().length;
    nivel ??= sangria; // el primer hijo fija cuál es el nivel de los eventos
    if (sangria > nivel) continue; // esto es configuración de otro evento
    if (sangria < nivel) break; // ya no estamos dentro de `on:`
    if (PULL_REQUEST_LINE.test(line)) return true;
  }
  return false;
}

/**
 * Los ids de job de un workflow. El id del job es el nombre con el que el check
 * aparece en la PR cuando el job no declara `name:`, que es el caso aquí.
 * @param {string} content
 */
export function jobIds(content) {
  const lines = content.split('\n');
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (start === -1) return [];
  const ids = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break; // se acabó el bloque `jobs:`
    const m = JOB_ID.exec(line);
    if (m) ids.push(m[1]);
  }
  return ids;
}

/**
 * Nombres de check que este repo espera en cualquier PR.
 * @param {Array<{ file: string, content: string }>} workflows
 * @returns {string[]}
 */
export function expectedChecks(workflows) {
  const nombres = (workflows ?? [])
    .filter((w) => runsOnPullRequest(w?.content ?? ''))
    .flatMap((w) => jobIds(w.content));
  return [...new Set(nombres)].toSorted();
}

/**
 * Los que este repo espera y la PR todavía no trae. Vacío = están todos.
 * @param {string[]} expected
 * @param {Array<{ name: string }>} checks
 */
export function missingChecks(expected, checks) {
  const presentes = new Set((checks ?? []).map((c) => c.name));
  return (expected ?? []).filter((n) => !presentes.has(n));
}
