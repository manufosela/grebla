/**
 * Ítems del cuestionario adaptativo.
 *
 * Cada ítem declara su peso por rol (0 = no aplica, 1 = participa, 2 =
 * responsabilidad principal) y, opcionalmente, una condición de visibilidad:
 * una función pura `visibleWhen(answers)` que decide si el ítem se muestra
 * en función del estado actual de respuestas. Así el cuestionario ramifica.
 *
 * El scoring (lib/scoring.js) solo tiene en cuenta los ítems VISIBLES dado el
 * estado de respuestas, recalculando el máximo posible de forma dinámica.
 *
 * @typedef {import('./roles.js').RoleKey} RoleKey
 * @typedef {Object<string, (boolean|number|string[])>} Answers
 *
 * @typedef {Object} ItemOption
 * @property {string} value
 * @property {string} label
 *
 * @typedef {Object} Item
 * @property {string} id                       Identificador único.
 * @property {string} text                     Enunciado de la pregunta.
 * @property {string} dimension                Clave de dimensión (ver DIMENSIONS).
 * @property {'checkbox'|'scale'|'multi'} type Tipo de respuesta.
 * @property {ItemOption[]} [options]          Opciones (solo para 'multi').
 * @property {Record<RoleKey, 0|1|2>} weights  Peso del ítem por rol.
 * @property {(answers: Answers) => boolean} [visibleWhen] Condición de visibilidad.
 */

/**
 * Dimensiones de evaluación. El orden define el orden del mapa de competencias.
 * @type {ReadonlyArray<{ key: string, label: string }>}
 */
export const DIMENSIONS = [
  { key: 'strategy', label: 'Estrategia y visión' },
  { key: 'people', label: 'Personas y equipo' },
  { key: 'delivery', label: 'Procesos y delivery' },
  { key: 'org', label: 'Relaciones y organización' },
  { key: 'technical', label: 'Técnico' },
  { key: 'architecture', label: 'Arquitectura' },
  { key: 'product', label: 'Producto y negocio' },
  { key: 'growth', label: 'Crecimiento propio' },
];

/** IDs de los ítems "gate" que controlan la ramificación. */
export const GATES = Object.freeze({
  MANAGES_PEOPLE: 'gate_manages_people',
  MANAGES_MANAGERS: 'gate_manages_managers',
  CROSS_TEAM: 'gate_cross_team',
  ORG_STRATEGY: 'gate_org_strategy',
});

/** @param {Answers} a @param {string} id */
const isChecked = (a, id) => a[id] === true;

/**
 * Catálogo de ítems. Añadir un ítem nuevo no requiere tocar componentes.
 * @type {ReadonlyArray<Item>}
 */
export const ITEMS = [
  // ── Gates de ramificación ────────────────────────────────────────────────
  {
    id: GATES.MANAGES_PEOPLE,
    text: '¿Tienes personas reportando directamente a ti (responsabilidad jerárquica)?',
    dimension: 'people',
    type: 'checkbox',
    weights: { engineer: 0, techLead: 0, staff: 0, em: 2, hoe: 2, vp: 2, cto: 1 },
  },
  {
    id: GATES.MANAGES_MANAGERS,
    text: '¿Gestionas a otras personas que a su vez gestionan equipos (managers de managers)?',
    dimension: 'people',
    type: 'checkbox',
    weights: { engineer: 0, techLead: 0, staff: 0, em: 0, hoe: 2, vp: 2, cto: 1 },
    visibleWhen: (a) => isChecked(a, GATES.MANAGES_PEOPLE),
  },
  {
    id: GATES.CROSS_TEAM,
    text: '¿Tu trabajo impacta de forma habitual a varios equipos a la vez?',
    dimension: 'org',
    type: 'checkbox',
    weights: { engineer: 0, techLead: 1, staff: 2, em: 1, hoe: 2, vp: 2, cto: 2 },
  },
  {
    id: GATES.ORG_STRATEGY,
    text: '¿Participas en la definición de la estrategia técnica de la organización?',
    dimension: 'strategy',
    type: 'checkbox',
    weights: { engineer: 0, techLead: 0, staff: 1, em: 1, hoe: 2, vp: 2, cto: 2 },
  },

  // ── Estrategia y visión ──────────────────────────────────────────────────
  {
    id: 'strategy_roadmap',
    text: 'Defino o influyo en el roadmap técnico a 6-12 meses.',
    dimension: 'strategy',
    type: 'scale',
    weights: { engineer: 0, techLead: 1, staff: 1, em: 1, hoe: 2, vp: 2, cto: 2 },
  },
  {
    id: 'strategy_tech_bets',
    text: 'Tomo decisiones sobre apuestas tecnológicas de plataforma a largo plazo.',
    dimension: 'strategy',
    type: 'scale',
    weights: { engineer: 0, techLead: 1, staff: 1, em: 0, hoe: 1, vp: 1, cto: 2 },
    visibleWhen: (a) => isChecked(a, GATES.ORG_STRATEGY),
  },
  {
    id: 'strategy_vision_comm',
    text: 'Comunico una visión técnica que alinea a varios equipos u áreas.',
    dimension: 'strategy',
    type: 'scale',
    weights: { engineer: 0, techLead: 0, staff: 1, em: 0, hoe: 2, vp: 2, cto: 2 },
    visibleWhen: (a) => isChecked(a, GATES.ORG_STRATEGY),
  },

  // ── Personas y equipo (gated por MANAGES_PEOPLE) ─────────────────────────
  {
    id: 'people_one_on_ones',
    text: 'Mantengo 1:1s periódicos para desarrollar a las personas de mi equipo.',
    dimension: 'people',
    type: 'scale',
    weights: { engineer: 0, techLead: 1, staff: 0, em: 2, hoe: 2, vp: 1, cto: 0 },
    visibleWhen: (a) => isChecked(a, GATES.MANAGES_PEOPLE),
  },
  {
    id: 'people_performance',
    text: 'Soy responsable de la evaluación de desempeño y la progresión de carrera de otras personas.',
    dimension: 'people',
    type: 'scale',
    weights: { engineer: 0, techLead: 0, staff: 0, em: 2, hoe: 2, vp: 2, cto: 1 },
    visibleWhen: (a) => isChecked(a, GATES.MANAGES_PEOPLE),
  },
  {
    id: 'people_hiring',
    text: 'Lidero procesos de contratación y conformación de equipos.',
    dimension: 'people',
    type: 'scale',
    weights: { engineer: 0, techLead: 1, staff: 0, em: 2, hoe: 2, vp: 2, cto: 1 },
    visibleWhen: (a) => isChecked(a, GATES.MANAGES_PEOPLE),
  },
  {
    id: 'people_org_design',
    text: 'Diseño la estructura organizativa (cómo se dividen y dimensionan los equipos).',
    dimension: 'people',
    type: 'scale',
    weights: { engineer: 0, techLead: 0, staff: 0, em: 0, hoe: 2, vp: 2, cto: 1 },
    visibleWhen: (a) => isChecked(a, GATES.MANAGES_MANAGERS),
  },
  // Rama IC: si NO gestiona personas, aparece mentoring horizontal
  {
    id: 'people_mentoring',
    text: 'Hago mentoring técnico a otras personas sin tener responsabilidad jerárquica sobre ellas.',
    dimension: 'people',
    type: 'scale',
    weights: { engineer: 1, techLead: 2, staff: 2, em: 1, hoe: 0, vp: 0, cto: 0 },
    visibleWhen: (a) => !isChecked(a, GATES.MANAGES_PEOPLE),
  },

  // ── Procesos y delivery ──────────────────────────────────────────────────
  {
    id: 'delivery_estimation',
    text: 'Participo en la estimación y el desglose del trabajo del equipo.',
    dimension: 'delivery',
    type: 'scale',
    weights: { engineer: 1, techLead: 2, staff: 1, em: 2, hoe: 1, vp: 1, cto: 0 },
  },
  {
    id: 'delivery_process_owner',
    text: 'Soy responsable de que el equipo cumpla sus compromisos de entrega (delivery).',
    dimension: 'delivery',
    type: 'scale',
    weights: { engineer: 0, techLead: 2, staff: 0, em: 2, hoe: 2, vp: 1, cto: 0 },
  },
  {
    id: 'delivery_metrics',
    text: 'Defino y superviso métricas de eficiencia de ingeniería (lead time, throughput, etc.).',
    dimension: 'delivery',
    type: 'scale',
    weights: { engineer: 0, techLead: 1, staff: 1, em: 1, hoe: 2, vp: 2, cto: 1 },
    visibleWhen: (a) => isChecked(a, GATES.CROSS_TEAM) || isChecked(a, GATES.MANAGES_PEOPLE),
  },

  // ── Relaciones y organización ────────────────────────────────────────────
  {
    id: 'org_stakeholders',
    text: 'Gestiono relaciones con stakeholders de otras áreas (producto, negocio, dirección).',
    dimension: 'org',
    type: 'scale',
    weights: { engineer: 0, techLead: 1, staff: 1, em: 1, hoe: 2, vp: 2, cto: 2 },
  },
  {
    id: 'org_cross_team_align',
    text: 'Coordino y desbloqueo dependencias entre varios equipos.',
    dimension: 'org',
    type: 'scale',
    weights: { engineer: 0, techLead: 1, staff: 2, em: 1, hoe: 2, vp: 2, cto: 1 },
    visibleWhen: (a) => isChecked(a, GATES.CROSS_TEAM),
  },
  {
    id: 'org_budget',
    text: 'Gestiono presupuesto, proveedores o contratación de la función de ingeniería.',
    dimension: 'org',
    type: 'scale',
    weights: { engineer: 0, techLead: 0, staff: 0, em: 1, hoe: 1, vp: 2, cto: 2 },
    visibleWhen: (a) => isChecked(a, GATES.MANAGES_MANAGERS) || isChecked(a, GATES.ORG_STRATEGY),
  },

  // ── Técnico ──────────────────────────────────────────────────────────────
  {
    id: 'technical_hands_on',
    text: 'Escribo código de producción de forma habitual.',
    dimension: 'technical',
    type: 'scale',
    weights: { engineer: 2, techLead: 2, staff: 2, em: 1, hoe: 0, vp: 0, cto: 1 },
  },
  {
    id: 'technical_code_review',
    text: 'Reviso código y establezco estándares de calidad técnica.',
    dimension: 'technical',
    type: 'scale',
    weights: { engineer: 1, techLead: 2, staff: 2, em: 1, hoe: 1, vp: 0, cto: 1 },
  },
  {
    id: 'technical_deep_expertise',
    text: 'Soy la persona de referencia ante problemas técnicos profundos en algún dominio.',
    dimension: 'technical',
    type: 'scale',
    weights: { engineer: 1, techLead: 2, staff: 2, em: 0, hoe: 0, vp: 0, cto: 1 },
    visibleWhen: (a) => !isChecked(a, GATES.MANAGES_PEOPLE),
  },

  // ── Arquitectura ─────────────────────────────────────────────────────────
  {
    id: 'architecture_decisions',
    text: 'Tomo decisiones de arquitectura para mi equipo o sistema.',
    dimension: 'architecture',
    type: 'scale',
    weights: { engineer: 1, techLead: 2, staff: 2, em: 1, hoe: 1, vp: 0, cto: 2 },
  },
  {
    id: 'architecture_scope',
    text: '¿En qué ámbitos defines la arquitectura?',
    dimension: 'architecture',
    type: 'multi',
    options: [
      { value: 'component', label: 'Componente / módulo' },
      { value: 'service', label: 'Servicio o aplicación completa' },
      { value: 'cross', label: 'Varios sistemas o equipos' },
      { value: 'platform', label: 'Plataforma de toda la organización' },
    ],
    weights: { engineer: 1, techLead: 1, staff: 2, em: 0, hoe: 1, vp: 0, cto: 2 },
  },
  {
    id: 'architecture_cross_system',
    text: 'Diseño arquitectura que abarca múltiples sistemas o equipos.',
    dimension: 'architecture',
    type: 'scale',
    weights: { engineer: 0, techLead: 1, staff: 2, em: 0, hoe: 1, vp: 1, cto: 2 },
    visibleWhen: (a) => isChecked(a, GATES.CROSS_TEAM),
  },

  // ── Producto y negocio ───────────────────────────────────────────────────
  {
    id: 'product_discovery',
    text: 'Participo en la definición de qué se construye (no solo del cómo).',
    dimension: 'product',
    type: 'scale',
    weights: { engineer: 1, techLead: 1, staff: 1, em: 2, hoe: 2, vp: 2, cto: 2 },
  },
  {
    id: 'product_business_tradeoffs',
    text: 'Equilibro decisiones técnicas con su impacto en negocio y coste.',
    dimension: 'product',
    type: 'scale',
    weights: { engineer: 0, techLead: 1, staff: 1, em: 1, hoe: 2, vp: 2, cto: 2 },
  },
  {
    id: 'product_external',
    text: 'Represento a la ingeniería ante clientes, partners o el mercado.',
    dimension: 'product',
    type: 'scale',
    weights: { engineer: 0, techLead: 0, staff: 0, em: 0, hoe: 1, vp: 1, cto: 2 },
    visibleWhen: (a) => isChecked(a, GATES.ORG_STRATEGY),
  },

  // ── Crecimiento propio (transversal, siempre visible) ────────────────────
  {
    id: 'growth_learning',
    text: 'Dedico tiempo de forma deliberada a aprender y mejorar mis competencias.',
    dimension: 'growth',
    type: 'scale',
    weights: { engineer: 2, techLead: 1, staff: 2, em: 1, hoe: 1, vp: 1, cto: 1 },
  },
  {
    id: 'growth_feedback',
    text: 'Busco activamente feedback sobre mi desempeño y actúo sobre él.',
    dimension: 'growth',
    type: 'scale',
    weights: { engineer: 2, techLead: 1, staff: 1, em: 1, hoe: 1, vp: 1, cto: 1 },
  },
  {
    id: 'growth_aspiration',
    text: '¿Hacia qué tipo de impacto te gustaría crecer?',
    dimension: 'growth',
    type: 'multi',
    options: [
      { value: 'depth', label: 'Mayor profundidad técnica' },
      { value: 'breadth', label: 'Impacto técnico más amplio (multi-equipo)' },
      { value: 'people', label: 'Liderazgo de personas' },
      { value: 'strategy', label: 'Estrategia y negocio' },
    ],
    weights: { engineer: 1, techLead: 1, staff: 1, em: 1, hoe: 1, vp: 1, cto: 1 },
  },
];

/**
 * IDs de todos los ítems, en orden.
 * @type {ReadonlyArray<string>}
 */
export const ITEM_IDS = ITEMS.map((item) => item.id);
