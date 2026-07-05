import { describe, it, expect } from 'vitest';
import {
  normalizeChallenge,
  challengeRouteForIsland,
  challengeProgress,
  stopNumberByCity,
  challengeEvents,
} from './challenge.js';

/** Isla de prueba: pesos y prerequisitos variados, con una casa deprecada. */
const MAP = {
  id: 'php',
  name: 'Backend PHP',
  areas: [{ id: 'a', name: 'Comarca' }],
  cities: [
    { id: 'php/sintaxis', name: 'Sintaxis', kind: 'tech', area: 'a', x: 10, y: 10, weight: 1, prereqs: [] },
    { id: 'php/composer', name: 'Composer', kind: 'tech', area: 'a', x: 20, y: 20, weight: 2, prereqs: ['php/sintaxis'] },
    { id: 'php/laravel', name: 'Laravel', kind: 'tech', area: 'a', x: 30, y: 30, weight: 3, prereqs: ['php/composer'] },
    { id: 'php/testing', name: 'Testing', kind: 'skill', area: 'a', x: 40, y: 40, weight: 3, prereqs: ['php/composer'] },
    { id: 'php/viejuno', name: 'mysql_*', kind: 'tech', area: 'a', x: 50, y: 50, weight: 1, prereqs: [], deprecated: true },
    { id: 'php/apis', name: 'APIs', kind: 'skill', area: 'a', x: 60, y: 60, weight: 2, prereqs: ['php/laravel', 'php/testing'] },
  ],
};

/** Journey mínimo con reto activo. @param {string[]} visited @param {object|null} challenge */
const journeyWith = (visited, challenge) => ({
  visitedCities: visited,
  currentCity: null,
  plannedRoute: [],
  currentIsland: 'island',
  visitedIslands: ['island'],
  evidences: {},
  challenge,
});

describe('normalizeChallenge', () => {
  it('devuelve null sin dato, con basura o sin paradas', () => {
    expect(normalizeChallenge(null)).toBeNull();
    expect(normalizeChallenge(undefined)).toBeNull();
    expect(normalizeChallenge('reto')).toBeNull();
    expect(normalizeChallenge([])).toBeNull();
    expect(normalizeChallenge({ routeId: 'php', stops: [] })).toBeNull();
    expect(normalizeChallenge({ routeId: '', stops: ['php/a'] })).toBeNull();
    expect(normalizeChallenge({ routeId: 'php', stops: [42, ''] })).toBeNull();
  });

  it('sanea paradas (strings no vacíos, sin duplicados, orden preservado)', () => {
    const c = normalizeChallenge({
      routeId: ' php ',
      name: '  Reto: Backend PHP  ',
      stops: ['php/a', '', 'php/b', 'php/a', 42, ' php/c '],
      startedAt: '2026-07-05T10:00:00Z',
    });
    expect(c).toEqual({
      routeId: 'php',
      name: 'Reto: Backend PHP',
      stops: ['php/a', 'php/b', 'php/c'],
      startedAt: '2026-07-05T10:00:00Z',
    });
  });

  it('sin nombre o sin startedAt cae a los valores por defecto', () => {
    const c = normalizeChallenge({ routeId: 'php', stops: ['php/a'] });
    expect(c?.name).toBe('Reto');
    expect(c?.startedAt).toBeNull();
  });
});

describe('challengeRouteForIsland', () => {
  it('ninguna casa aparece antes que sus prerequisitos', () => {
    const { stops } = challengeRouteForIsland(MAP);
    const position = new Map(stops.map((id, i) => [id, i]));
    for (const city of MAP.cities.filter((c) => !c.deprecated)) {
      for (const prereq of city.prereqs) {
        if (!position.has(prereq)) continue; // deprecada o de otra isla: no es parada
        expect(position.get(prereq)).toBeLessThan(position.get(city.id));
      }
    }
  });

  it('excluye las casas deprecadas y cubre todas las demás', () => {
    const { stops } = challengeRouteForIsland(MAP);
    expect(stops).not.toContain('php/viejuno');
    expect(stops).toHaveLength(5);
    expect(new Set(stops).size).toBe(5);
  });

  it('es determinista y desempata por peso desc y luego orden de definición', () => {
    const first = challengeRouteForIsland(MAP);
    const second = challengeRouteForIsland(MAP);
    expect(second.stops).toEqual(first.stops);
    // Tras composer quedan listas laravel (peso 3, definida antes) y testing
    // (peso 3): gana laravel por orden de definición.
    expect(first.stops).toEqual([
      'php/sintaxis',
      'php/composer',
      'php/laravel',
      'php/testing',
      'php/apis',
    ]);
  });

  it('nombra la ruta con la isla y arranca sin startedAt', () => {
    const route = challengeRouteForIsland(MAP);
    expect(route.routeId).toBe('php');
    expect(route.name).toBe('Reto: Backend PHP');
    expect(route.startedAt).toBeNull();
  });

  it('ignora prerequisitos que no son parada (deprecados o de otra isla)', () => {
    const map = {
      id: 'x',
      name: 'X',
      cities: [
        { id: 'x/a', name: 'A', kind: 'tech', area: 'a', x: 0, y: 0, weight: 1, prereqs: ['bases/git', 'x/dep'] },
        { id: 'x/dep', name: 'Dep', kind: 'tech', area: 'a', x: 0, y: 0, weight: 1, prereqs: [], deprecated: true },
      ],
    };
    expect(challengeRouteForIsland(map).stops).toEqual(['x/a']);
  });

  it('falla en alto con prerequisitos cíclicos', () => {
    const map = {
      id: 'x',
      name: 'X',
      cities: [
        { id: 'x/a', name: 'A', kind: 'tech', area: 'a', x: 0, y: 0, weight: 1, prereqs: ['x/b'] },
        { id: 'x/b', name: 'B', kind: 'tech', area: 'a', x: 0, y: 0, weight: 1, prereqs: ['x/a'] },
      ],
    };
    expect(() => challengeRouteForIsland(map)).toThrow(/ciclo/);
  });
});

describe('challengeProgress', () => {
  const challenge = {
    routeId: 'php',
    name: 'Reto: Backend PHP',
    stops: ['php/sintaxis', 'php/composer', 'php/laravel'],
    startedAt: null,
  };

  it('sin nada visitado la siguiente es la primera parada', () => {
    const p = challengeProgress(challenge, journeyWith([], challenge));
    expect(p).toEqual({
      done: 0,
      total: 3,
      nextIndex: 0,
      nextCityId: 'php/sintaxis',
      completed: false,
    });
  });

  it('la siguiente es la primera NO visitada en orden; las fuera de orden cuentan', () => {
    // laravel (parada 3) se certificó fuera de orden: cuenta para done, pero
    // la siguiente sigue siendo composer (parada 2).
    const p = challengeProgress(challenge, journeyWith(['php/sintaxis', 'php/laravel'], challenge));
    expect(p.done).toBe(2);
    expect(p.nextIndex).toBe(1);
    expect(p.nextCityId).toBe('php/composer');
    expect(p.completed).toBe(false);
  });

  it('los certificados ajenos al reto no cuentan', () => {
    const p = challengeProgress(challenge, journeyWith(['bases/git'], challenge));
    expect(p.done).toBe(0);
  });

  it('con todas las paradas certificadas el reto está completado', () => {
    const p = challengeProgress(challenge, journeyWith(challenge.stops, challenge));
    expect(p).toEqual({ done: 3, total: 3, nextIndex: -1, nextCityId: null, completed: true });
  });

  it('sin reto no hay progreso ni completitud', () => {
    const p = challengeProgress(null, journeyWith(['php/sintaxis'], null));
    expect(p).toEqual({ done: 0, total: 0, nextIndex: -1, nextCityId: null, completed: false });
  });
});

describe('stopNumberByCity', () => {
  it('numera las paradas 1-based en el orden de la ruta', () => {
    const numbers = stopNumberByCity({
      routeId: 'php',
      name: 'Reto',
      stops: ['php/a', 'php/b', 'php/c'],
      startedAt: null,
    });
    expect([...numbers.entries()]).toEqual([
      ['php/a', 1],
      ['php/b', 2],
      ['php/c', 3],
    ]);
  });

  it('sin reto devuelve un mapa vacío', () => {
    expect(stopNumberByCity(null).size).toBe(0);
  });
});

describe('challengeEvents', () => {
  const challenge = {
    routeId: 'php',
    name: 'Reto: Backend PHP',
    stops: ['php/sintaxis', 'php/composer'],
    startedAt: '2026-07-05T10:00:00Z',
  };

  it('al certificar una parada avisa de la SIGUIENTE con su número', () => {
    const prev = journeyWith([], challenge);
    const next = journeyWith(['php/sintaxis'], challenge);
    expect(challengeEvents(prev, next)).toEqual([
      {
        kind: 'challenge-next',
        routeId: 'php',
        name: 'Reto: Backend PHP',
        nextCityId: 'php/composer',
        stopNumber: 2,
        done: 1,
        total: 2,
      },
    ]);
  });

  it('al certificar la ÚLTIMA parada avisa del reto completado', () => {
    const prev = journeyWith(['php/sintaxis'], challenge);
    const next = journeyWith(['php/sintaxis', 'php/composer'], challenge);
    expect(challengeEvents(prev, next)).toEqual([
      { kind: 'challenge-done', routeId: 'php', name: 'Reto: Backend PHP' },
    ]);
  });

  it('sin reto activo, sin gesto de certificado o al retirar uno, no avisa', () => {
    const noChallenge = journeyWith(['php/sintaxis'], null);
    expect(challengeEvents(journeyWith([], null), noChallenge)).toEqual([]);
    // Retirar un certificado no es el gesto de obtener uno.
    expect(
      challengeEvents(journeyWith(['php/sintaxis'], challenge), journeyWith([], challenge)),
    ).toEqual([]);
    // Cargar el journey de otra persona (salto de más de una) tampoco.
    expect(
      challengeEvents(journeyWith([], challenge), journeyWith(challenge.stops, challenge)),
    ).toEqual([]);
  });

  it('certificar una casa AJENA al reto no avisa', () => {
    const prev = journeyWith([], challenge);
    const next = journeyWith(['bases/git'], challenge);
    expect(challengeEvents(prev, next)).toEqual([]);
  });
});
