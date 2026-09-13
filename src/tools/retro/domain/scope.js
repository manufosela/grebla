/**
 * Ámbito de una retro: de quién es (RMR-TSK-0498, F5 del ADR de dominios).
 *
 * Había dos ámbitos: el equipo de quien convoca y un SQUAD del catálogo viejo.
 * Desde el ADR la gente pertenece a un DOMINIO —su producto— y los equipos son
 * fluidos, así que el segundo ámbito pasa a ser el dominio.
 *
 * Las retros ya convocadas NO se migran: se rotulan con la etiqueta que llevan
 * guardada. Una retro es un acta de algo que pasó; reescribirle el ámbito años
 * después sería cambiar el pasado para que encaje con el modelo de hoy.
 */

/** Ámbitos que se pueden elegir al convocar. */
export const RETRO_SCOPES = Object.freeze([
  Object.freeze({ id: 'team', label: 'Equipo' }),
  Object.freeze({ id: 'domain', label: 'Dominio' }),
]);

/**
 * Ámbito guardado a partir de lo elegido en el formulario.
 * @param {{ scopeType?: string, domainKey?: string|null, label?: string|null }} elegido
 * @returns {{ type: string, domainKey: string|null, label: string|null }}
 */
export function scopeFromForm(elegido = {}) {
  if (elegido.scopeType !== 'domain') return { type: 'team', domainKey: null, label: null };
  return {
    type: 'domain',
    domainKey: elegido.domainKey || null,
    // Se guarda también el nombre: si mañana el dominio se renombra o se retira,
    // la retro sigue diciendo de quién fue.
    label: elegido.label || null,
  };
}

/**
 * Rótulo del ámbito de una retro, ya sea de las nuevas o de las de antes.
 * @param {{ scope?: { type?: string, domainKey?: string|null, squadId?: string|null, label?: string|null } }} retro
 * @param {ReadonlyArray<{ key?: string, name?: string }>} [domains]
 * @returns {string}
 */
export function scopeLabel(retro, domains = []) {
  const scope = retro?.scope ?? {};
  if (scope.type === 'domain') {
    const actual = domains.find((d) => d.key === scope.domainKey)?.name;
    return `Dominio · ${actual ?? scope.label ?? '—'}`;
  }
  // Retros de antes del ADR: su ámbito era un squad, y así se dice. Llamarlo
  // «dominio» le pondría al acta un nombre que nadie eligió.
  if (scope.type === 'squad') return `Squad · ${scope.label ?? '—'}`;
  return 'Equipo';
}

/**
 * ¿Falta elegir el dominio? Convocar una retro de dominio sin dominio dejaría
 * un acta que no es de nadie.
 * @param {{ scopeType?: string, domainKey?: string|null }} elegido
 * @returns {boolean}
 */
export function needsDomain(elegido = {}) {
  return elegido.scopeType === 'domain' && !elegido.domainKey;
}
