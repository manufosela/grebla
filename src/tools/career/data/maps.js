/**
 * Mapa de carrera de MUESTRA (en código): UNA isla dividida en comarcas (áreas).
 * Cada ciudad pertenece a una comarca. Se parte de un puerto neutro (`startPort`).
 * En MC-2 los mapas serán por tenant y podrán importarse de roadmap.sh.
 * Coordenadas x/y en 0..100.
 *
 * @typedef {import('../domain/types.js').CareerMap} CareerMap
 * @typedef {import('../domain/types.js').Area} Area
 */

/** Comarcas de la isla. Fundamentos es la comarca de entrada. */
/** @type {ReadonlyArray<Area>} */
export const ISLAND_AREAS = [
  { id: 'fundamentos', name: 'Fundamentos' },
  { id: 'frontend', name: 'Frontend' },
  { id: 'backend', name: 'Backend' },
  { id: 'data', name: 'Data' },
];

/**
 * La isla GREBLA. Todas las rutas parten de la comarca Fundamentos.
 * @type {CareerMap}
 */
export const ISLAND = {
  id: 'island',
  name: 'Isla GREBLA',
  startPort: { x: 4, y: 50 },
  areas: ISLAND_AREAS,
  cities: [
    // — Fundamentos (comarca de entrada) —
    { id: 'git', name: 'Git', kind: 'skill', area: 'fundamentos', x: 12, y: 50, weight: 1, prereqs: [] },
    { id: 'html', name: 'HTML', kind: 'tech', area: 'fundamentos', x: 12, y: 22, weight: 1, prereqs: [] },
    { id: 'css', name: 'CSS', kind: 'tech', area: 'fundamentos', x: 20, y: 34, weight: 1, prereqs: [] },
    {
      id: 'js',
      name: 'JavaScript',
      kind: 'tech',
      area: 'fundamentos',
      x: 28,
      y: 50,
      weight: 2,
      prereqs: ['html', 'css'],
      recommendations: [
        { kind: 'curso', label: 'JavaScript moderno (ES2025)' },
        { kind: 'doc', label: 'MDN — JavaScript', url: 'https://developer.mozilla.org/es/docs/Web/JavaScript' },
      ],
    },
    { id: 'testing', name: 'Testing', kind: 'skill', area: 'fundamentos', x: 24, y: 72, weight: 2, prereqs: ['js'] },

    // — Frontend —
    { id: 'ts', name: 'TypeScript', kind: 'tech', area: 'frontend', x: 50, y: 14, weight: 2, prereqs: ['js'] },
    { id: 'react', name: 'Componentes/React', kind: 'tech', area: 'frontend', x: 55, y: 30, weight: 3, prereqs: ['js'] },
    { id: 'a11y', name: 'Accesibilidad', kind: 'skill', area: 'frontend', x: 72, y: 16, weight: 2, prereqs: ['react'] },
    { id: 'perf', name: 'Rendimiento', kind: 'skill', area: 'frontend', x: 78, y: 36, weight: 3, prereqs: ['react', 'testing'] },
    { id: 'jquery', name: 'jQuery', kind: 'tech', area: 'frontend', x: 46, y: 42, weight: 1, prereqs: ['js'], deprecated: true },
    { id: 'arch-fe', name: 'Arquitectura FE', kind: 'milestone', area: 'frontend', x: 92, y: 24, weight: 4, prereqs: ['a11y', 'perf', 'ts'] },

    // — Backend —
    { id: 'lang', name: 'Lenguaje servidor', kind: 'tech', area: 'backend', x: 44, y: 66, weight: 1, prereqs: ['git'] },
    { id: 'api', name: 'APIs / REST', kind: 'tech', area: 'backend', x: 56, y: 60, weight: 2, prereqs: ['lang'] },
    { id: 'db', name: 'Bases de datos', kind: 'tech', area: 'backend', x: 56, y: 82, weight: 2, prereqs: ['lang'] },
    { id: 'auth', name: 'Auth & Seguridad', kind: 'skill', area: 'backend', x: 72, y: 64, weight: 3, prereqs: ['api'] },
    { id: 'docker', name: 'Contenedores', kind: 'tech', area: 'backend', x: 66, y: 90, weight: 2, prereqs: ['lang'] },
    { id: 'ci', name: 'CI/CD', kind: 'skill', area: 'backend', x: 84, y: 80, weight: 3, prereqs: ['testing', 'docker'] },
    { id: 'arch-be', name: 'Arquitectura BE', kind: 'milestone', area: 'backend', x: 94, y: 70, weight: 4, prereqs: ['auth', 'ci'] },

    // — Data —
    { id: 'sql', name: 'SQL', kind: 'tech', area: 'data', x: 50, y: 50, weight: 2, prereqs: ['db'] },
    { id: 'python', name: 'Python', kind: 'tech', area: 'data', x: 62, y: 46, weight: 2, prereqs: ['lang'] },
    { id: 'analytics', name: 'Analítica', kind: 'skill', area: 'data', x: 76, y: 50, weight: 3, prereqs: ['sql', 'python'] },
    { id: 'ml', name: 'Machine Learning', kind: 'milestone', area: 'data', x: 88, y: 52, weight: 4, prereqs: ['analytics'] },
  ],
};

/**
 * Compatibilidad: el resto del tool sigue trabajando con una lista de mapas.
 * Hoy la lista contiene una única isla.
 * @type {ReadonlyArray<CareerMap>}
 */
export const SAMPLE_MAPS = [ISLAND];
