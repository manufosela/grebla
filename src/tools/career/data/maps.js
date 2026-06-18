/**
 * Mapas de carrera de MUESTRA (en código). En MC-2 los mapas serán por tenant y
 * podrán importarse de roadmap.sh. Coordenadas x/y en 0..100.
 *
 * @typedef {import('../domain/types.js').CareerMap} CareerMap
 */

/** @type {ReadonlyArray<CareerMap>} */
export const SAMPLE_MAPS = [
  {
    id: 'frontend',
    name: 'Frontend',
    tag: 'frontend',
    cities: [
      { id: 'html', name: 'HTML', kind: 'tech', x: 10, y: 18, weight: 1, prereqs: [] },
      { id: 'css', name: 'CSS', kind: 'tech', x: 10, y: 50, weight: 1, prereqs: [] },
      { id: 'git', name: 'Git', kind: 'skill', x: 10, y: 82, weight: 1, prereqs: [] },
      { id: 'js', name: 'JavaScript', kind: 'tech', x: 32, y: 34, weight: 2, prereqs: ['html', 'css'] },
      { id: 'ts', name: 'TypeScript', kind: 'tech', x: 52, y: 20, weight: 2, prereqs: ['js'] },
      { id: 'react', name: 'Componentes/React', kind: 'tech', x: 55, y: 50, weight: 3, prereqs: ['js'] },
      { id: 'testing', name: 'Testing', kind: 'skill', x: 50, y: 78, weight: 2, prereqs: ['js'] },
      { id: 'a11y', name: 'Accesibilidad', kind: 'skill', x: 76, y: 32, weight: 2, prereqs: ['react'] },
      { id: 'perf', name: 'Rendimiento', kind: 'skill', x: 80, y: 62, weight: 3, prereqs: ['react', 'testing'] },
      { id: 'arch', name: 'Arquitectura FE', kind: 'milestone', x: 95, y: 46, weight: 4, prereqs: ['a11y', 'perf', 'ts'] },
    ],
  },
  {
    id: 'backend',
    name: 'Backend',
    tag: 'backend',
    cities: [
      { id: 'lang', name: 'Lenguaje base', kind: 'tech', x: 10, y: 30, weight: 1, prereqs: [] },
      { id: 'git', name: 'Git', kind: 'skill', x: 10, y: 70, weight: 1, prereqs: [] },
      { id: 'api', name: 'APIs / REST', kind: 'tech', x: 32, y: 28, weight: 2, prereqs: ['lang'] },
      { id: 'db', name: 'Bases de datos', kind: 'tech', x: 34, y: 62, weight: 2, prereqs: ['lang'] },
      { id: 'auth', name: 'Auth & Seguridad', kind: 'skill', x: 55, y: 22, weight: 3, prereqs: ['api'] },
      { id: 'testing', name: 'Testing', kind: 'skill', x: 55, y: 50, weight: 2, prereqs: ['api', 'db'] },
      { id: 'docker', name: 'Contenedores', kind: 'tech', x: 56, y: 80, weight: 2, prereqs: ['lang'] },
      { id: 'ci', name: 'CI/CD', kind: 'skill', x: 78, y: 62, weight: 3, prereqs: ['testing', 'docker'] },
      { id: 'arch', name: 'Arquitectura BE', kind: 'milestone', x: 94, y: 40, weight: 4, prereqs: ['auth', 'ci'] },
    ],
  },
];
