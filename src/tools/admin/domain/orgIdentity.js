/**
 * Identidad de la INSTANCIA (RMR-TSK-0596): los textos con los que cada
 * organización se reconoce dentro de GREBLA.
 *
 * GREBLA se despliega una vez por organización, así que el producto no puede
 * hablar como si solo hubiera una: «Toda la organización» es correcto en general
 * y frío en una casa que se llama a sí misma de otra forma. Aquí viven esos
 * textos, y en `/config/org` su valor.
 *
 * Dos de estos campos —`employeeDomain` y `usersCrownLabel`— ya existían y ya se
 * leían, pero no tenían pantalla: se editaban a mano en la consola de Firestore.
 * Un ajuste que solo se puede tocar entrando en la base de datos es un ajuste que
 * nadie toca.
 *
 * Módulo PURO: normaliza y describe. Quién lo lee y lo escribe es cosa de
 * `lib/orgConfig.js`, y quién puede hacerlo, de las reglas.
 */

/**
 * Los campos, en el orden en el que se ofrecen. `fallback` es lo que dice el
 * producto cuando la instancia no configura nada: el defecto NO desaparece por
 * dejar un campo en blanco, porque una pantalla con un rótulo vacío es peor que
 * una con un rótulo genérico.
 */
export const IDENTITY_FIELDS = Object.freeze([
  Object.freeze({
    key: 'orgName',
    label: 'Nombre de la organización',
    hint: 'Cómo se llama tu casa. Sale donde el producto la nombra.',
    fallback: '',
    placeholder: 'p. ej. TRIBBU',
  }),
  Object.freeze({
    key: 'everyoneLabel',
    label: 'Cuando se ve a todo el mundo, se llama',
    hint: 'El rótulo de Equipo al mirar más allá de tu gente. Vacío: «Toda la organización».',
    fallback: 'Toda la organización',
    placeholder: 'p. ej. Toda la tribbu',
  }),
  Object.freeze({
    key: 'usersCrownLabel',
    label: 'Corona del organigrama',
    hint: 'Quiénes están arriba del todo en la pirámide invertida. Vacío: no se muestra.',
    fallback: '',
    placeholder: 'p. ej. Usuarios de TRIBBU',
  }),
  Object.freeze({
    key: 'employeeDomain',
    label: 'Dominio de email de empleados',
    hint: 'Quien entre con un correo de este dominio tiene acceso base. Vacío: solo entra quien tenga ficha o rol.',
    fallback: '',
    placeholder: 'p. ej. tribbuapp.com',
    normalize: (v) => v.toLowerCase().replace(/^@/, ''),
  }),
]);

/** Claves configurables, para validar de un vistazo lo que llega. */
export const IDENTITY_KEYS = Object.freeze(IDENTITY_FIELDS.map((f) => f.key));

/** Tope por campo: son rótulos, no párrafos; uno largo rompe la cabecera. */
export const IDENTITY_MAX_LEN = 60;

/**
 * Lo guardado, saneado. Cualquier cosa que no sea una de las claves conocidas se
 * descarta —lista blanca, como `normalizeJourney`— y cada valor se recorta: un
 * rótulo con espacios al final se ve igual y se compara distinto.
 * @param {Record<string, unknown>|null|undefined} raw
 * @returns {Record<string, string>}
 */
export function normalizeIdentity(raw) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const field of IDENTITY_FIELDS) {
    // Solo texto. Lo que venga siendo otra cosa —un objeto, un número— se trata
    // como vacío: convertirlo pintaría «[object Object]» como rótulo, que es un
    // bug disfrazado de dato.
    const bruto = raw?.[field.key];
    const texto = typeof bruto === 'string' ? bruto : '';
    const valor = texto.trim().slice(0, IDENTITY_MAX_LEN);
    out[field.key] = field.normalize ? field.normalize(valor) : valor;
  }
  return out;
}

/**
 * El texto que toca enseñar: el de la instancia si lo hay, y si no el del
 * producto. No es un fallback silencioso —el defecto está declarado en el campo y
 * se ve en la pantalla de edición—, es el comportamiento pactado: vacío significa
 * «usa el tuyo», no «no pongas nada».
 * @param {Record<string, string>|null|undefined} identity
 * @param {string} key
 * @returns {string}
 */
export function labelOf(identity, key) {
  const field = IDENTITY_FIELDS.find((f) => f.key === key);
  if (!field) throw new Error(`No existe el campo de identidad «${key}».`);
  const valor = (identity?.[key] ?? '').toString().trim();
  return valor || field.fallback;
}
