/**
 * Ítems del cuestionario de apoyo para situar los ROLES DE CONTRIBUCIÓN
 * (RMR-TSK-0494).
 *
 * Hasta ahora el manager marcaba las siglas a ojo, y ese dato alimenta la
 * cobertura de roles y el bus factor: el diagnóstico del equipo se apoyaba en
 * una corazonada. Estas preguntas no deciden nada — proponen, y el manager
 * confirma.
 *
 * PREGUNTAS PROPIAS, A PROPÓSITO. El cuestionario oficial de Belbin (el SPI) es
 * propiedad de Belbin Associates y no se reproduce ni se «adapta». Estas están
 * escritas desde cero y preguntan por CONDUCTAS OBSERVADAS en el trabajo del
 * día a día —qué hace esta persona cuando pasa X—, no por rasgos de carácter:
 * un manager puede haber visto lo primero; lo segundo se lo inventaría.
 *
 * Cada ítem suma a un solo rol. Que una conducta cuente para dos roles haría el
 * resultado imposible de explicar, y explicar el porqué es justamente lo que
 * convierte la propuesta en algo discutible en vez de en un oráculo.
 *
 * @typedef {Object} BelbinItem
 * @property {string} id
 * @property {string} sigla   Rol al que suma (ver domain/belbin.js)
 * @property {string} text    Conducta observable, en pasado o presente habitual
 */

/** @type {ReadonlyArray<BelbinItem>} */
export const BELBIN_ITEMS = Object.freeze([
  // Mentales
  { id: 'pl-1', sigla: 'PL', text: 'Cuando el equipo se atasca, es quien propone el enfoque que a nadie se le había ocurrido.' },
  { id: 'pl-2', sigla: 'PL', text: 'Trae ideas propias sin que se las pidan, aunque a veces estén a medio cocer.' },
  { id: 'me-1', sigla: 'ME', text: 'Antes de decidir, pone sobre la mesa los riesgos y las pegas que nadie había mirado.' },
  { id: 'me-2', sigla: 'ME', text: 'Cuando hay entusiasmo por una idea, es quien pregunta con qué datos se sostiene.' },
  { id: 'sp-1', sigla: 'SP', text: 'Es a quien se acude por un conocimiento concreto que los demás no tienen.' },
  { id: 'sp-2', sigla: 'SP', text: 'Profundiza en su especialidad por su cuenta, más allá de lo que el trabajo le exige.' },

  // Sociales
  { id: 'co-1', sigla: 'CO', text: 'En una reunión sin rumbo, es quien ordena los temas y reparte el trabajo.' },
  { id: 'co-2', sigla: 'CO', text: 'Hace hablar a quien no ha hablado, en vez de decidir por su cuenta.' },
  { id: 'ri-1', sigla: 'RI', text: 'Trae información, contactos o soluciones de fuera del equipo.' },
  { id: 'ri-2', sigla: 'RI', text: 'Se mueve con soltura entre otros equipos y sabe a quién preguntar en cada sitio.' },
  { id: 'tw-1', sigla: 'TW', text: 'Cuando hay tensión entre dos personas, es quien la baja.' },
  { id: 'tw-2', sigla: 'TW', text: 'Se ofrece a echar una mano en lo que haga falta, aunque no sea lo suyo.' },

  // De acción
  { id: 'sh-1', sigla: 'SH', text: 'Empuja para que se decida y se avance cuando el equipo se queda dando vueltas.' },
  { id: 'sh-2', sigla: 'SH', text: 'No le frena la incomodidad: dice lo que hay que oír aunque moleste.' },
  { id: 'imp-1', sigla: 'IMP', text: 'Convierte lo hablado en tareas concretas y se pone con ellas.' },
  { id: 'imp-2', sigla: 'IMP', text: 'Es de fiar con lo que se compromete, aunque el trabajo sea ingrato.' },
  { id: 'cf-1', sigla: 'CF', text: 'Detecta los cabos sueltos que a los demás se les pasan antes de dar algo por hecho.' },
  { id: 'cf-2', sigla: 'CF', text: 'Revisa lo suyo —y lo del equipo— antes de que salga por la puerta.' },
]);

/** Escala de respuesta: cuánto se reconoce a la persona en esa conducta. */
export const BELBIN_SCALE = Object.freeze([
  { value: 0, label: 'No lo he visto' },
  { value: 1, label: 'A veces' },
  { value: 2, label: 'Es muy suyo' },
]);
