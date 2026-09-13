/**
 * A QUÉ PERTENECE UNA PERSONA (ADR «De squads a dominios y subdominios», F4).
 *
 * El squad mezclaba dos cosas: dónde ocurre el trabajo y quién pertenece a él.
 * Con equipos fluidos, lo segundo deja de tener sentido — hoy estás en Trust y
 * mañana en Matcher, y eso no puede exigir que nadie te reasigne—. Así que la
 * persona pertenece al DOMINIO (el producto) y se mueve libre por sus
 * subdominios.
 *
 * La pertenencia se guarda por `key` del dominio, nunca por su nombre ni por el
 * id del documento: es la misma regla que sostiene todo el modelo, y es lo que
 * permite renombrar un dominio sin tocar 19 fichas.
 *
 * Puro: sin Firestore.
 *
 * @typedef {{ id: string, key: string, name: string }} Domain
 * @typedef {{ domainKeys?: string[], squadIds?: string[] }} PersonLike
 */

/**
 * Dominios a los que pertenece una persona, resueltos contra el catálogo. Los
 * que ya no existen se descartan: una pertenencia a algo borrado no es
 * pertenencia, y arrastrarla haría creer que la ficha está al día.
 * @param {PersonLike|null|undefined} person
 * @param {ReadonlyArray<Domain>} domains
 * @returns {Domain[]}
 */
export function domainsOf(person, domains = []) {
  const claves = new Set(person?.domainKeys ?? []);
  return domains.filter((d) => claves.has(d.key));
}

/**
 * Cómo se escribe la pertenencia de una persona. Vacío cuando no tiene ninguna:
 * decir «sin dominio» es información, y dejarlo en blanco parece un olvido.
 * @param {PersonLike|null|undefined} person
 * @param {ReadonlyArray<Domain>} domains
 * @returns {string}
 */
export function membershipLabel(person, domains = []) {
  const suyos = domainsOf(person, domains);
  if (suyos.length === 0) return 'Sin dominio';
  return suyos.map((d) => d.name).join(', ');
}

/**
 * Marca o desmarca un dominio en la lista de una persona. Devuelve una lista
 * nueva, ordenada y sin repetidos, para poder guardarla tal cual.
 * @param {ReadonlyArray<string>} actuales
 * @param {string} key
 * @param {boolean} pertenece
 * @returns {string[]}
 */
export function toggleDomain(actuales, key, pertenece) {
  const limpia = new Set((actuales ?? []).filter(Boolean));
  if (pertenece) limpia.add(key);
  else limpia.delete(key);
  return [...limpia].toSorted((a, b) => a.localeCompare(b, 'es'));
}

/**
 * A qué dominio pertenece quien estaba en un squad. Se usa SOLO para migrar lo
 * que ya había: cada squad del catálogo viejo era o un subdominio de un producto
 * o el producto entero, y el mapeo se escribe a mano porque es una decisión de
 * modelo, no una transformación del nombre.
 * @param {ReadonlyArray<string>} squadIds
 * @param {Record<string, string>} squadToDomain  id de squad → key de dominio
 * @returns {string[]}
 */
export function domainKeysFromSquads(squadIds, squadToDomain) {
  const claves = (squadIds ?? [])
    .map((id) => squadToDomain[id])
    .filter(Boolean);
  return [...new Set(claves)].toSorted((a, b) => a.localeCompare(b, 'es'));
}
