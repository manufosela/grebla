/**
 * Framework de carrera de MUESTRA (en código): el catálogo GLOBAL de la
 * organización. Un framework = una familia ('engineering') con cuatro catálogos
 * independientes: tracks (itinerarios), levels (niveles), disciplines
 * (disciplinas) y dimensions (ejes de evaluación). Todos los ids son strings
 * estables; el campo `order` (numérico) controla el orden de presentación.
 *
 * Estas funciones son PURAS (sin Firebase): normalizan el documento leído y lo
 * serializan para escribir, de modo que se pueden testear sin Firestore. La IO
 * vive en src/lib/careerFramework.js.
 *
 * @typedef {Object} Track          Itinerario de carrera
 * @property {string} id
 * @property {string} name
 * @property {number} order
 * @property {string} description
 *
 * @typedef {Object} Level          Nivel dentro de un track
 * @property {string} id
 * @property {string} code
 * @property {string} title
 * @property {string} trackId       id del Track al que pertenece
 * @property {number} order
 * @property {string} description
 * @property {string} typicalProfile
 * @property {string|null} branchesFrom  id del nivel del que ramifica, o null
 *
 * @typedef {Object} NamedItem      Disciplina o dimensión (misma forma)
 * @property {string} id
 * @property {string} name
 * @property {number} order
 * @property {string} description
 *
 * @typedef {Object} Expectation    Celda «meeting expectations» de la matriz Nivel × Dimensión
 * @property {string} levelId       id del Level
 * @property {string} dimensionId   id de la dimensión
 * @property {string} text          expectativa esperada en esa celda (no vacía)
 *
 * @typedef {Object} Addendum       Foco de una dimensión dentro de una disciplina (sección 10)
 * @property {string} disciplineId  id de la disciplina
 * @property {string} dimensionId   id de la dimensión
 * @property {string} text          matiz/foco de esa dimensión en la disciplina (no vacío)
 *
 * @typedef {Object} CareerFramework
 * @property {string} id
 * @property {string} name
 * @property {Track[]} tracks
 * @property {Level[]} levels
 * @property {NamedItem[]} disciplines
 * @property {NamedItem[]} dimensions
 * @property {Expectation[]} expectations  matriz de expectativas Nivel × Dimensión (solo celdas con texto)
 * @property {Addendum[]} addendums        addendums por disciplina Disciplina × Dimensión (solo con texto)
 */

/**
 * Semilla/fallback del framework: el catálogo Engineering en código. Se usa
 * cuando todavía no existe el documento /careerFramework/engineering.
 * @type {CareerFramework}
 */
export const ENGINEERING_FRAMEWORK = {
  id: 'engineering',
  name: 'Engineering',
  tracks: [
    { id: 'ic', name: 'Individual Contributor (IC)', order: 1, description: 'Ingeniero cuyo principal output es el trabajo técnico.' },
    { id: 'tl', name: 'Tech Lead / Architect', order: 2, description: 'Liderazgo técnico de un equipo o dominio, sin gestión de personas.' },
    { id: 'em', name: 'Engineering Manager', order: 3, description: 'Responsable del crecimiento, desempeño y bienestar de las personas del equipo.' },
  ],
  levels: [
    { id: 'l1', code: 'L1', title: 'Engineer', trackId: 'ic', order: 1, description: 'Trabaja de forma independiente en features bien definidas dentro de un código establecido.', typicalProfile: '2–5 años', branchesFrom: null },
    { id: 'l2', code: 'L2', title: 'Senior Engineer', trackId: 'ic', order: 2, description: 'Dueño principal de features y decisiones técnicas no triviales en su área; mejora al equipo. Nivel destino más importante.', typicalProfile: '5+ años', branchesFrom: null },
    { id: 'l3', code: 'L3', title: 'Senior Engineer II', trackId: 'ic', order: 3, description: 'Mejora consistentemente el trabajo de quienes le rodean; su criterio técnico moldea cómo construye el equipo.', typicalProfile: '6+ años', branchesFrom: null },
    { id: 'l4', code: 'L4', title: 'Staff Engineer', trackId: 'ic', order: 4, description: 'Impacto más allá de su equipo; multiplicador de la calidad y dirección de la organización.', typicalProfile: '7+ años', branchesFrom: null },
    { id: 'l5', code: 'L5', title: 'Principal Engineer', trackId: 'ic', order: 5, description: 'Una de las voces técnicas más senior de la empresa; su influencia va más allá de su disciplina.', typicalProfile: '10+ años', branchesFrom: null },
    { id: 'l4tl', code: 'L4-TL', title: 'Architect', trackId: 'tl', order: 4, description: 'Dirección técnica a largo plazo de un dominio; define principios y estándares de arquitectura.', typicalProfile: '', branchesFrom: 'l3' },
    { id: 'l3em', code: 'L3-EM', title: 'Engineering Manager', trackId: 'em', order: 3, description: 'Responsable de un equipo (4–8 personas): crecimiento, desempeño, contratación y dinámica.', typicalProfile: '', branchesFrom: 'l3' },
    { id: 'l4em', code: 'L4-EM', title: 'Senior Engineering Manager', trackId: 'em', order: 4, description: 'Salud organizativa de varios equipos o un dominio; desarrolla Engineering Managers.', typicalProfile: '', branchesFrom: null },
  ],
  disciplines: [
    { id: 'backend', name: 'Backend', order: 1, description: 'Diseño de APIs, modelado de datos, sistemas distribuidos, observabilidad, fiabilidad y seguridad.' },
    { id: 'infra', name: 'Infra / Platform', order: 2, description: 'Cloud, IaC, CI/CD, contenedores/orquestación, FinOps, respuesta a incidentes y mentalidad de plataforma.' },
    { id: 'web', name: 'Web / Frontend', order: 3, description: 'Arquitectura frontend, rendimiento (Core Web Vitals), accesibilidad, compatibilidad y design systems.' },
    { id: 'data', name: 'Data / ML', order: 4, description: 'Pipelines de datos, modelado, experimentación, productivización de ML y calidad de datos.' },
    { id: 'mobile', name: 'Mobile', order: 5, description: 'Sigue el framework específico de Mobile; añade concerns móviles (cross-platform, releases, rendimiento).' },
  ],
  dimensions: [
    { id: 'tech', name: 'Technical Excellence', order: 1, description: 'Calidad de código, diseño de sistemas, profundidad técnica y craft de ingeniería.' },
    { id: 'reliability', name: 'Reliability & Performance', order: 2, description: 'Fiabilidad, rendimiento, eficiencia y calidad operativa.' },
    { id: 'product', name: 'Product & Business Thinking', order: 3, description: 'Entender usuarios, resultados y el porqué del trabajo.' },
    { id: 'execution', name: 'Execution & Delivery', order: 4, description: 'Fiabilidad, ownership y capacidad de sacar las cosas adelante.' },
    { id: 'leadership', name: 'Leadership & Collaboration', order: 5, description: 'Mentoría, comunicación y hacer mejor al equipo que te rodea.' },
    { id: 'culture', name: 'Cultural Contribution', order: 6, description: 'Cómo contribuyes a la cultura (honestidad, ownership, respeto, cuidar el listón del equipo).' },
  ],
  // La matriz de expectativas y los addendums se editan/cargan desde el panel;
  // la semilla en código va vacía (no inventamos el contenido del documento).
  expectations: [],
  addendums: [],
};

/**
 * Semilla/fallback: copia profunda del framework Engineering en código. Se usa
 * cuando todavía no existe el documento /careerFramework/engineering.
 * @returns {CareerFramework}
 */
export function seedFramework() {
  return structuredClone(ENGINEERING_FRAMEWORK);
}

/** @param {unknown} value @param {number} fallback @returns {number} */
function toFiniteNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Comparador estable por el campo `order`. @param {{order:number}} a @param {{order:number}} b */
function byOrder(a, b) {
  return a.order - b.order;
}

/**
 * Normaliza un item con nombre (track/disciplina/dimensión: misma forma).
 * @param {Record<string, unknown>} item
 * @returns {NamedItem}
 */
function normalizeNamed(item) {
  return {
    id: String(item?.id ?? '').trim(),
    name: String(item?.name ?? '').trim(),
    order: toFiniteNumber(item?.order, 0),
    description: String(item?.description ?? '').trim(),
  };
}

/**
 * Normaliza un nivel crudo del documento.
 * @param {Record<string, unknown>} level
 * @returns {Level}
 */
function normalizeLevel(level) {
  const branchesFrom = String(level?.branchesFrom ?? '').trim();
  return {
    id: String(level?.id ?? '').trim(),
    code: String(level?.code ?? '').trim(),
    title: String(level?.title ?? '').trim(),
    trackId: String(level?.trackId ?? '').trim(),
    order: toFiniteNumber(level?.order, 0),
    description: String(level?.description ?? '').trim(),
    typicalProfile: String(level?.typicalProfile ?? '').trim(),
    branchesFrom: branchesFrom || null,
  };
}

/**
 * Normaliza una celda de la matriz de expectativas (Nivel × Dimensión).
 * @param {Record<string, unknown>} item
 * @returns {Expectation}
 */
function normalizeExpectation(item) {
  return {
    levelId: String(item?.levelId ?? '').trim(),
    dimensionId: String(item?.dimensionId ?? '').trim(),
    text: String(item?.text ?? '').trim(),
  };
}

/**
 * Normaliza un addendum (Disciplina × Dimensión).
 * @param {Record<string, unknown>} item
 * @returns {Addendum}
 */
function normalizeAddendum(item) {
  return {
    disciplineId: String(item?.disciplineId ?? '').trim(),
    dimensionId: String(item?.dimensionId ?? '').trim(),
    text: String(item?.text ?? '').trim(),
  };
}

/**
 * Reconstruye un CareerFramework completo a partir del documento de Firestore.
 * Si no hay datos (documento inexistente) devuelve la semilla en código. Cada
 * catálogo se ordena por su campo `order`. Expectations y addendums descartan
 * las celdas incompletas (sin ids o con texto vacío tras trim).
 * @param {Record<string, unknown>|null|undefined} data  data() del documento
 * @returns {CareerFramework}
 */
export function normalizeFramework(data) {
  if (!data) return seedFramework();
  /** @param {unknown} arr @returns {NamedItem[]} */
  const named = (arr) => (Array.isArray(arr) ? arr.map(normalizeNamed).filter((x) => x.id).toSorted(byOrder) : []);
  return {
    id: 'engineering',
    name: String(data.name ?? '').trim() || ENGINEERING_FRAMEWORK.name,
    tracks: named(data.tracks),
    levels: Array.isArray(data.levels) ? data.levels.map(normalizeLevel).filter((l) => l.id).toSorted(byOrder) : [],
    disciplines: named(data.disciplines),
    dimensions: named(data.dimensions),
    expectations: Array.isArray(data.expectations)
      ? data.expectations.map(normalizeExpectation).filter((e) => e.levelId && e.dimensionId && e.text)
      : [],
    addendums: Array.isArray(data.addendums)
      ? data.addendums.map(normalizeAddendum).filter((a) => a.disciplineId && a.dimensionId && a.text)
      : [],
  };
}

/**
 * Serializa un CareerFramework a un objeto plano apto para Firestore (sin
 * `undefined`, que Firestore rechaza; `branchesFrom` es null cuando no ramifica).
 * No incluye `id` (es el id del documento).
 * @param {CareerFramework} fw
 * @returns {{ name: string, tracks: NamedItem[], levels: Level[], disciplines: NamedItem[], dimensions: NamedItem[], expectations: Expectation[], addendums: Addendum[] }}
 */
export function serializeFramework(fw) {
  /** @param {NamedItem[]|undefined} arr @returns {NamedItem[]} */
  const named = (arr) => (arr ?? []).map((x) => ({
    id: String(x.id ?? '').trim(),
    name: String(x.name ?? '').trim(),
    order: toFiniteNumber(x.order, 0),
    description: String(x.description ?? '').trim(),
  })).filter((x) => x.id);
  const levels = (fw?.levels ?? []).map((l) => {
    const branchesFrom = String(l.branchesFrom ?? '').trim();
    return {
      id: String(l.id ?? '').trim(),
      code: String(l.code ?? '').trim(),
      title: String(l.title ?? '').trim(),
      trackId: String(l.trackId ?? '').trim(),
      order: toFiniteNumber(l.order, 0),
      description: String(l.description ?? '').trim(),
      typicalProfile: String(l.typicalProfile ?? '').trim(),
      branchesFrom: branchesFrom || null,
    };
  }).filter((l) => l.id);
  const expectations = (fw?.expectations ?? []).map((e) => ({
    levelId: String(e.levelId ?? '').trim(),
    dimensionId: String(e.dimensionId ?? '').trim(),
    text: String(e.text ?? '').trim(),
  })).filter((e) => e.levelId && e.dimensionId && e.text);
  const addendums = (fw?.addendums ?? []).map((a) => ({
    disciplineId: String(a.disciplineId ?? '').trim(),
    dimensionId: String(a.dimensionId ?? '').trim(),
    text: String(a.text ?? '').trim(),
  })).filter((a) => a.disciplineId && a.dimensionId && a.text);
  return {
    name: String(fw?.name ?? '').trim() || ENGINEERING_FRAMEWORK.name,
    tracks: named(fw?.tracks),
    levels,
    disciplines: named(fw?.disciplines),
    dimensions: named(fw?.dimensions),
    expectations,
    addendums,
  };
}
