/**
 * Glosario de términos y leyes útiles para desarrollo, equipos y liderazgo.
 * Contenido ESTÁTICO curado (sin Firestore): se muestra a cualquier persona
 * logada en /glosario. Agrupado por categoría; cada término lleva una
 * explicación breve (qué es + por qué importa).
 *
 * @typedef {Object} GlossaryTerm
 * @property {string} term      Nombre del término o ley.
 * @property {string} [aka]     Nombre completo o alias (siglas → expansión).
 * @property {string} desc      Explicación breve (1–2 frases).
 *
 * @typedef {Object} GlossaryCategory
 * @property {string} id
 * @property {string} title
 * @property {GlossaryTerm[]} terms
 */

/**
 * Término DESTACADO: se muestra arriba del todo y más grande que el resto,
 * porque es el concepto central de la cultura de ingeniería de la organización.
 * @type {GlossaryTerm}
 */
export const FEATURED = {
  term: 'Product Engineer',
  desc: 'Ingeniero que no solo programa bien, sino que además entiende bien por qué programa lo que programa y qué impacto tiene en los usuarios.',
};

/** @type {GlossaryCategory[]} */
export const GLOSSARY = [
  {
    id: 'desarrollo',
    title: 'Principios de desarrollo',
    terms: [
      { term: 'YAGNI', aka: 'You Aren’t Gonna Need It', desc: 'No construyas algo hasta que lo necesites de verdad. Evita el trabajo especulativo que casi nunca se usa.' },
      { term: 'KISS', aka: 'Keep It Simple, Stupid', desc: 'Prefiere siempre la solución más simple que funcione; la complejidad se paga en mantenimiento.' },
      { term: 'DRY', aka: 'Don’t Repeat Yourself', desc: 'Cada pieza de conocimiento debe tener una única fuente de verdad. Duplicar lógica multiplica los errores.' },
      { term: 'SOLID', desc: 'Cinco principios de diseño orientado a objetos (responsabilidad única, abierto/cerrado, sustitución de Liskov, segregación de interfaces, inversión de dependencias) para un código mantenible.' },
      { term: 'Regla del Boy Scout', desc: 'Deja el código un poco mejor de como lo encontraste. Pequeñas mejoras continuas evitan la degradación.' },
      { term: 'Ley de Demeter', aka: 'Principio de menor conocimiento', desc: 'Habla solo con tus vecinos directos: un objeto no debería depender de la estructura interna de otros. Reduce el acoplamiento.' },
      { term: 'Principio de menor sorpresa', desc: 'Un sistema debe comportarse como el usuario espera. Lo sorprendente confunde y genera errores.' },
      { term: 'Deuda técnica', desc: 'El coste futuro de elegir una solución rápida hoy en vez de la correcta. Como una deuda, acumula intereses si no se paga.' },
    ],
  },
  {
    id: 'organizacion',
    title: 'Leyes de equipos y organización',
    terms: [
      { term: 'Ley de Conway', desc: 'Las organizaciones diseñan sistemas que copian su estructura de comunicación. Si quieres cambiar la arquitectura, cambia también cómo se comunican los equipos.' },
      { term: 'Ley de Brooks', desc: 'Añadir gente a un proyecto de software que va tarde lo retrasa todavía más (por el coste de coordinación y de poner al día a los nuevos).' },
      { term: 'Ley de Gall', desc: 'Todo sistema complejo que funciona evolucionó de un sistema simple que funcionaba. Empieza simple, no diseñes lo complejo de golpe.' },
      { term: 'Ley de Parkinson', desc: 'El trabajo se expande hasta llenar el tiempo disponible para completarlo. Plazos y alcance acotados enfocan.' },
      { term: 'Ley de Hofstadter', desc: 'Siempre lleva más tiempo del que esperas, incluso teniendo en cuenta la ley de Hofstadter. Cuidado con el optimismo en las estimaciones.' },
      { term: 'Ley de Goodhart', desc: 'Cuando una métrica se convierte en objetivo, deja de ser una buena métrica (la gente optimiza el número, no el resultado). Clave al usar KPIs.' },
      { term: 'Número de Dunbar', desc: 'Límite cognitivo de relaciones estables (~150). Explica por qué los grupos grandes necesitan estructura y por qué los equipos pequeños coordinan mejor.' },
      { term: 'Ley de Little', desc: 'Trabajo en curso = ritmo de llegada × tiempo de ciclo. Base de la gestión de flujo: menos WIP → menor tiempo de entrega.' },
    ],
  },
  {
    id: 'liderazgo',
    title: 'Liderazgo y sesgos',
    terms: [
      { term: 'Efecto Dunning-Kruger', desc: 'Quienes menos saben de algo tienden a sobreestimar su competencia; los expertos, a subestimarla. Importante al calibrar autoevaluaciones.' },
      { term: 'Principio de Peter', desc: 'En una jerarquía, la gente asciende hasta su nivel de incompetencia. Argumento para carreras técnicas (IC) paralelas a las de gestión.' },
      { term: 'Ley de Hanlon', desc: 'Nunca atribuyas a malicia lo que se explica adecuadamente por descuido o falta de contexto. Ayuda a dar feedback sin hostilidad.' },
      { term: 'Bikeshedding', aka: 'Ley de la trivialidad de Parkinson', desc: 'Se dedica un tiempo desproporcionado a lo trivial (el color del cobertizo) y poco a lo importante (el reactor). Vigila las reuniones.' },
      { term: 'Síndrome del impostor', desc: 'Sensación persistente de no merecer tu posición pese a la evidencia de tu competencia. Muy común en perfiles técnicos senior.' },
      { term: 'Efecto halo', desc: 'Una impresión positiva (o negativa) en un rasgo contamina la valoración de los demás. Sesga las evaluaciones de desempeño.' },
      { term: 'Sesgo de confirmación', desc: 'Buscamos y damos más peso a la información que confirma lo que ya creemos. Distorsiona decisiones y valoraciones de personas.' },
      { term: 'Sesgo de reciencia', desc: 'Se pondera en exceso lo ocurrido hace poco. En una evaluación anual, lo del último mes pesa más de lo debido.' },
    ],
  },
  {
    id: 'producto',
    title: 'Producto y priorización',
    terms: [
      { term: 'Principio de Pareto', aka: 'Regla 80/20', desc: 'Aproximadamente el 80% de los resultados vienen del 20% de las causas. Enfoca el esfuerzo en el poco que rinde mucho.' },
      { term: 'MoSCoW', desc: 'Priorización en Must / Should / Could / Won’t (imprescindible, importante, deseable, fuera por ahora). Ordena el alcance.' },
      { term: 'RICE / ICE', desc: 'Scoring de priorización: RICE = Alcance × Impacto × Confianza ÷ Esfuerzo; ICE es su versión ligera (Impacto, Confianza, Facilidad).' },
      { term: 'Regla de las dos pizzas', desc: 'Un equipo no debería ser más grande de lo que alimentan dos pizzas (~6–8 personas). Equipos pequeños coordinan y deciden mejor.' },
      { term: 'MVP', aka: 'Producto Mínimo Viable', desc: 'La versión más pequeña que aporta valor y permite aprender de usuarios reales, en vez de construir todo de una.' },
    ],
  },
  {
    id: 'otras',
    title: 'Otras leyes útiles',
    terms: [
      { term: 'Ley de Cunningham', desc: 'La mejor forma de obtener la respuesta correcta en internet no es preguntar, sino publicar una respuesta incorrecta: alguien la corregirá.' },
      { term: 'Ley de Postel', aka: 'Principio de robustez', desc: 'Sé conservador en lo que envías y liberal en lo que aceptas. Guía para diseñar interfaces y APIs tolerantes.' },
      { term: 'Ley de Sturgeon', desc: 'El 90% de todo es mediocre. Útil para relativizar y centrarse en el 10% que importa.' },
      { term: 'Navaja de Occam', desc: 'Entre explicaciones que encajan con los hechos, la más simple suele ser la correcta. Buena heurística al depurar.' },
      { term: 'Ley de Murphy', desc: 'Todo lo que puede salir mal, saldrá mal. Justifica el diseño defensivo, los tests y los planes de contingencia.' },
      { term: 'Efecto bola de nieve del contexto', aka: 'Ley de Chesterton (valla de Chesterton)', desc: 'No elimines algo cuyo propósito no entiendes: primero averigua por qué está ahí. Aplica al refactorizar código o procesos.' },
    ],
  },
];
