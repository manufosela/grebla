/**
 * Lógica pura de búsqueda del glosario. Separada del componente <glossary-app>
 * para poder testearla sin DOM (utilidad → cobertura alta). Sin estado, sin
 * efectos: dada la lista de categorías y una consulta, devuelve las categorías
 * que contienen términos coincidentes con sus términos ya filtrados.
 *
 * @typedef {import('../data/glossary.js').GlossaryCategory} GlossaryCategory
 */

/**
 * Normaliza un texto para comparaciones tolerantes: minúsculas y sin acentos
 * (descompone en NFD y elimina las marcas diacríticas). Así «Peter» casa con
 * «péter» y «organizacion» con «organización».
 *
 * @param {string} value Texto a normalizar.
 * @returns {string} Texto en minúsculas y sin diacríticos.
 */
export function normalizeText(value) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Indica si un término del glosario casa con la consulta ya normalizada.
 * Busca en el nombre del término, su alias (`aka`) y su descripción.
 *
 * @param {import('../data/glossary.js').GlossaryTerm} term Término a evaluar.
 * @param {string} normalizedQuery Consulta ya normalizada (no vacía).
 * @returns {boolean} `true` si alguno de los campos contiene la consulta.
 */
function termMatches(term, normalizedQuery) {
  const haystack = normalizeText(`${term.term} ${term.aka ?? ''} ${term.desc}`);
  return haystack.includes(normalizedQuery);
}

/**
 * Filtra el glosario por una consulta de texto libre. Si la consulta está
 * vacía (o solo espacios) devuelve todas las categorías intactas. En caso
 * contrario, devuelve únicamente las categorías con al menos un término
 * coincidente, cada una con su lista de términos ya filtrada.
 *
 * No muta la entrada: cada categoría resultante es un objeto nuevo.
 *
 * @param {GlossaryCategory[]} glossary Categorías del glosario.
 * @param {string} query Texto de búsqueda introducido por la persona.
 * @returns {GlossaryCategory[]} Categorías con términos que casan.
 */
export function filterGlossary(glossary, query) {
  const normalizedQuery = normalizeText(query.trim());
  if (normalizedQuery === '') return glossary;

  const result = [];
  for (const category of glossary) {
    const terms = category.terms.filter((term) => termMatches(term, normalizedQuery));
    if (terms.length > 0) result.push({ ...category, terms });
  }
  return result;
}

/**
 * Cuenta el total de términos contenidos en un conjunto de categorías.
 *
 * @param {GlossaryCategory[]} categories Categorías (posiblemente filtradas).
 * @returns {number} Número total de términos.
 */
export function countTerms(categories) {
  return categories.reduce((total, category) => total + category.terms.length, 0);
}
