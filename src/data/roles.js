/**
 * Modelo de roles de ingeniería: ARQUETIPOS de comportamiento, no niveles ni
 * tecnologías. El cuestionario reparte peso entre ocho dimensiones y de ahí sale
 * el rol dominante: dice CÓMO trabajas, no cuánto alcance tienes ni en qué
 * dominio. «Staff» se retiró por eso (RMR-TSK-0472) — es un NIVEL del framework
 * de carrera, y tenerlo aquí duplicaba el eje: obligaba a elegir entre decir el
 * nivel o decir el arquetipo, perdiendo el otro.
 *
 * Cada rol es un objeto de datos. Añadir un rol nuevo a este array NO requiere
 * cambios en los componentes: la UI y el scoring iteran sobre `ROLES` y usan
 * `role.key` como clave dentro del objeto de pesos de cada ítem (ver items.js).
 *
 * @typedef {'engineer'|'em'|'hoe'|'techLead'|'cto'|'vp'} RoleKey
 *
 * @typedef {Object} Role
 * @property {RoleKey} key        Clave usada en `item.weights[key]`. Única.
 * @property {string}  label      Nombre completo mostrado en la UI.
 * @property {string}  short      Etiqueta corta (badges, ejes del radar, CSV).
 * @property {string}  tagline    Frase descriptiva del rol dominante.
 * @property {string}  description Descripción larga del foco del rol.
 * @property {string}  color      Color CSS asociado (barras, leyendas).
 */

/** @type {ReadonlyArray<Role>} */
export const ROLES = [
  {
    key: 'engineer',
    label: 'Engineer',
    short: 'ENG',
    tagline: 'Tu valor está en construir: profundizas en el código y entregas con autonomía.',
    description:
      'Individual contributor de squad. Foco en implementar bien, aprender y crecer técnicamente dentro del equipo.',
    color: '#2a9d8f',
  },
  {
    key: 'techLead',
    label: 'Tech Lead',
    short: 'TL',
    tagline: 'Alineas a tu squad técnicamente: decides el cómo y desbloqueas a la gente.',
    description:
      'Referente técnico de un equipo. Equilibra contribución hands-on con coordinación técnica, calidad y delivery del squad.',
    color: '#4fb3a6',
  },
  {
    key: 'em',
    label: 'Engineering Manager',
    short: 'EM',
    tagline: 'Tu producto son las personas: haces crecer al equipo y proteges su delivery.',
    description:
      'Responsable de personas y delivery de uno o varios equipos. Foco en 1:1s, desempeño, procesos y salud del equipo.',
    color: '#5566a6',
  },
  {
    key: 'hoe',
    label: 'Head of Engineering',
    short: 'HoE',
    tagline: 'Diriges la función de ingeniería: equilibras personas, técnica y negocio a escala de área.',
    description:
      'Lidera varios equipos o un área de producto. Conecta estrategia técnica con objetivos de negocio y gestiona managers.',
    color: '#e0a458',
  },
  {
    key: 'vp',
    label: 'VP of Engineering',
    short: 'VP',
    tagline: 'Escalas la organización: procesos, cultura y ejecución de toda la ingeniería.',
    description:
      'Responsable de la ejecución de la organización de ingeniería. Foco en escalado de equipos, procesos, presupuesto y cultura.',
    color: '#c9748a',
  },
  {
    key: 'cto',
    label: 'CTO',
    short: 'CTO',
    tagline: 'Defines hacia dónde va la tecnología: visión, apuestas técnicas y relación con el negocio.',
    description:
      'Máximo responsable de la estrategia tecnológica. Foco en visión, decisiones de plataforma a largo plazo y representación técnica ante el negocio y el mercado.',
    color: '#f2887a',
  },
];

/**
 * Índice rol por clave para acceso O(1).
 * @type {Readonly<Record<RoleKey, Role>>}
 */
export const ROLE_BY_KEY = Object.freeze(
  Object.fromEntries(ROLES.map((role) => [role.key, role])),
);

/** @type {ReadonlyArray<RoleKey>} */
export const ROLE_KEYS = ROLES.map((role) => role.key);

/**
 * Etiqueta de un rol por su clave, tolerando los RETIRADOS (RMR-TSK-0472).
 *
 * Las mediciones guardadas conservan la clave del rol dominante que salió en su
 * momento, y el catálogo cambia: «Staff» se fue de aquí porque es un nivel, no
 * un arquetipo. Pintar «—» en esos casos diría que no hubo rol dominante, que es
 * falso; el historial se respeta diciendo que ese rol ya no está en el catálogo.
 *
 * @param {string|null|undefined} key
 * @returns {string} etiqueta, «Rol retirado» si la clave no está, «—» si no hay clave
 */
export function roleLabelOf(key) {
  if (!key) return '—';
  return ROLES.find((r) => r.key === key)?.label ?? 'Rol retirado';
}
