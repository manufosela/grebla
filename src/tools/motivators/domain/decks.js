/**
 * Datasets (config-driven) de los dos juegos de motivadores. El motor es el mismo;
 * solo cambian estas cartas y el branding. Los `id` son slugs estables en inglés
 * (no cambian aunque se retoque el texto); nombres y descripciones en español,
 * verbatim del diseño. Ilustraciones originales — NO se usan las oficiales de
 * Management 3.0 (viven en el componente, referenciadas por `id`).
 *
 * @typedef {import('./types.js').Deck} Deck
 * @typedef {import('./types.js').GameId} GameId
 */
import { DECK_SIZE, GAMES } from './types.js';

/** @type {Deck} */
const MOVING_MOTIVATORS = {
  game: 'moving_motivators',
  name: 'Moving Motivators',
  tagline: 'Ordena qué te mueve de verdad en el trabajo, de más a menos importante.',
  accent: 'teal',
  cards: [
    { id: 'curiosity', name: 'Curiosidad', description: 'Necesito espacio para explorar, hacerme preguntas y probar cosas nuevas, no solo ejecutar lo ya definido.' },
    { id: 'honor', name: 'Honor', description: 'Necesito que mis valores personales y los del equipo/empresa estén alineados, no actuar contra lo que creo correcto.' },
    { id: 'acceptance', name: 'Aceptación', description: 'Necesito sentir que las personas de mi entorno aprueban quién soy y lo que hago.' },
    { id: 'mastery', name: 'Maestría', description: 'Necesito seguir mejorando en lo que hago, notar que progreso y domino mi trabajo.' },
    { id: 'power', name: 'Poder', description: 'Necesito capacidad real de influir en lo que pasa a mi alrededor, no sentirme un mero ejecutor.' },
    { id: 'freedom', name: 'Libertad', description: 'Necesito autonomía para decidir cómo organizo mi trabajo y mi tiempo.' },
    { id: 'relatedness', name: 'Relación', description: 'Necesito buenas relaciones sociales con la gente con la que trabajo, más allá de lo puramente profesional.' },
    { id: 'order', name: 'Orden', description: 'Necesito reglas y estructuras estables que den previsibilidad a mi entorno de trabajo.' },
    { id: 'goal', name: 'Propósito', description: 'Necesito que mi trabajo tenga un objetivo que valga la pena, más allá de la tarea en sí.' },
    { id: 'status', name: 'Estatus', description: 'Necesito que mi posición sea reconocida y visible frente a los demás.' },
  ],
};

/** @type {Deck} */
const AFFECTIVE_MOTIVATORS = {
  game: 'affective_motivators',
  name: 'Affective Motivators',
  tagline: 'Ordena qué necesitas sentir en tu equipo, de más a menos importante.',
  accent: 'coral',
  cards: [
    { id: 'listening', name: 'Escucha', description: 'Sentir que cuando hablo, de verdad me escuchan.' },
    { id: 'trust', name: 'Confianza', description: 'Sentir que confían en mí y poder confiar en quien lidera y en el equipo.' },
    { id: 'authenticity', name: 'Autenticidad', description: 'Poder ser yo mismo/a sin máscara.' },
    { id: 'psychological_safety', name: 'Seguridad psicológica', description: 'Poder equivocarme, preguntar o discrepar sin miedo a represalias.' },
    { id: 'accompanied_vulnerability', name: 'Vulnerabilidad acompañada', description: 'Poder mostrar dudas, errores o emociones sin que se usen en mi contra.' },
    { id: 'holistic_care', name: 'Cuidado integral', description: 'Sentir que mi bienestar importa como persona completa, no solo como recurso.' },
    { id: 'belonging', name: 'Pertenencia', description: 'Sentir afecto genuino en el equipo, formar parte de algo.' },
    { id: 'growth_support', name: 'Acompañamiento en mi crecimiento', description: 'Sentir que alguien invierte en mi desarrollo, no solo en mi rendimiento.' },
    { id: 'mutual_commitment', name: 'Compromiso mutuo', description: 'Sentir que el vínculo va en las dos direcciones.' },
    { id: 'closeness', name: 'Proximidad', description: 'Sentir cercanía real con quien lidera, más allá del cargo o la jerarquía.' },
  ],
};

/** @type {Record<GameId, Deck>} */
export const DECKS = {
  moving_motivators: MOVING_MOTIVATORS,
  affective_motivators: AFFECTIVE_MOTIVATORS,
};

/**
 * Devuelve el mazo de un juego. Lanza si el juego no existe: sin fallbacks
 * silenciosos (el sistema funciona o falla).
 * @param {GameId} game
 * @returns {Deck}
 */
export function getDeck(game) {
  const deck = DECKS[game];
  if (!deck) throw new Error(`Juego desconocido: ${game}`);
  return deck;
}

/** Ids de las cartas de un juego, en el orden del mazo. @param {GameId} game @returns {string[]} */
export function deckCardIds(game) {
  return getDeck(game).cards.map((c) => c.id);
}

// Invariante de diseño: cada mazo tiene exactamente DECK_SIZE cartas con ids únicos.
for (const game of GAMES) {
  const { cards } = getDeck(game);
  if (cards.length !== DECK_SIZE) throw new Error(`El mazo ${game} debe tener ${DECK_SIZE} cartas`);
  if (new Set(cards.map((c) => c.id)).size !== DECK_SIZE) throw new Error(`El mazo ${game} tiene ids duplicados`);
}
