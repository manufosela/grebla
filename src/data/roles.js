/**
 * Modelo de roles de ingeniería.
 *
 * Cada rol es un objeto de datos. Añadir un rol nuevo a este array NO requiere
 * cambios en los componentes: la UI y el scoring iteran sobre `ROLES` y usan
 * `role.key` como clave dentro del objeto de pesos de cada ítem (ver items.js).
 *
 * @typedef {'engineer'|'em'|'hoe'|'techLead'|'staff'|'cto'|'vp'} RoleKey
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
    key: 'staff',
    label: 'Staff Engineer',
    short: 'STF',
    tagline: 'Tu impacto cruza equipos: resuelves los problemas técnicos que nadie más toca.',
    description:
      'IC senior con impacto multi-equipo. Lidera arquitectura transversal, mentoring horizontal y decisiones técnicas de alto alcance sin gestionar personas.',
    color: '#3e7cb1',
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
