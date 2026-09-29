/**
 * De dónde viene una conversación de la ficha (RMR-TSK-0578).
 *
 * En `/people/{id}/conversations` conviven dos cosas que se leen igual y no lo
 * son: lo que escribió una persona —su manager, después de hablar— y lo que
 * dejó ahí un agente automático leyendo otro sistema. Quien lee sobre sí mismo
 * tiene derecho a saber cuál es cuál **antes** de leer el texto: no se responde
 * igual a una nota que escribió tu manager que a un resumen que generó una
 * máquina a partir de un calendario.
 *
 * El dato ya lo trae la ingesta (`automated`, `source.system`); aquí solo se
 * interpreta, sin inventar nada cuando no está.
 */

/**
 * @typedef {Object} Origen
 * @property {'agente'|'persona'|'desconocido'} kind
 * @property {string} label     Cómo se dice en pantalla.
 * @property {string|null} system  Qué sistema lo trajo, si fue un agente.
 * @property {string|null} url  Enlace al origen, si lo hay.
 */

/** Solo se enlazan orígenes http(s): un `javascript:` en un href es un agujero. */
function urlSegura(value) {
  if (typeof value !== 'string' || value === '') return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:' ? value : null;
  } catch {
    return null;
  }
}

/**
 * @param {{ automated?: boolean, source?: { system?: string, url?: string|null }, createdBy?: { name?: string } }|null|undefined} conversation
 * @returns {Origen}
 */
export function conversationOrigin(conversation) {
  const system = typeof conversation?.source?.system === 'string' ? conversation.source.system.trim() : '';
  const url = urlSegura(conversation?.source?.url);

  if (conversation?.automated === true || system) {
    return {
      kind: 'agente',
      label: system ? `Automática · ${system}` : 'Automática',
      system: system || null,
      url,
    };
  }

  const quien = typeof conversation?.createdBy?.name === 'string' ? conversation.createdBy.name.trim() : '';
  if (quien) return { kind: 'persona', label: `Escrita por ${quien}`, system: null, url: null };

  // Las notas antiguas no guardaban autor. Decirlo es mejor que atribuirlas a
  // alguien o dejar el hueco en blanco, que se lee como si nadie la hubiera
  // escrito.
  return { kind: 'desconocido', label: 'Sin autor registrado', system: null, url: null };
}

/**
 * Las conversaciones de la persona, de la más reciente a la más antigua. El
 * orden es el que se espera al mirar lo tuyo: lo último, primero.
 * @param {Array<{ date?: string }>} conversations
 */
export function conversationsNewestFirst(conversations) {
  return [...(conversations ?? [])].sort((a, b) => String(b?.date ?? '').localeCompare(String(a?.date ?? '')));
}
