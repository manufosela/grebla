import { describe, it, expect } from 'vitest';
import {
  insertRouteAt,
  routeNumberByCity,
  resolveRouteStops,
  routeSeaModel,
  formatStopRanges,
} from './route.js';

/** Mapas mínimos de dos islas para resolver paradas. */
const MAPS = [
  {
    id: 'island',
    name: 'Bases de software',
    cities: [
      { id: 'bases/html', name: 'HTML' },
      { id: 'bases/css', name: 'CSS' },
    ],
  },
  {
    id: 'frontend',
    name: 'Frontend',
    cities: [{ id: 'front/react', name: 'React' }],
  },
];

describe('route — ruta libre planificada (JG-9)', () => {
  describe('insertRouteAt', () => {
    it('inserta en la posición pedida sin mutar la ruta original', () => {
      const route = ['a', 'b', 'c'];
      expect(insertRouteAt(route, 'x', 1)).toEqual(['a', 'x', 'b', 'c']);
      expect(insertRouteAt(route, 'x', 0)).toEqual(['x', 'a', 'b', 'c']);
      expect(route).toEqual(['a', 'b', 'c']); // intacta
    });

    it('sin índice (o al final) la casa va la última — el «por defecto» del selector', () => {
      expect(insertRouteAt(['a', 'b'], 'x')).toEqual(['a', 'b', 'x']);
      expect(insertRouteAt(['a', 'b'], 'x', 2)).toEqual(['a', 'b', 'x']);
      expect(insertRouteAt([], 'x')).toEqual(['x']);
      expect(insertRouteAt(null, 'x', 0)).toEqual(['x']);
    });

    it('una casa que ya era parada se MUEVE: nunca hay duplicados', () => {
      expect(insertRouteAt(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b']);
      expect(insertRouteAt(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a']);
      // Moverla a donde ya está la deja igual.
      expect(insertRouteAt(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'b', 'c']);
    });

    it('el índice fuera de rango se acota a los extremos', () => {
      expect(insertRouteAt(['a', 'b'], 'x', -5)).toEqual(['x', 'a', 'b']);
      expect(insertRouteAt(['a', 'b'], 'x', 99)).toEqual(['a', 'b', 'x']);
      // Subir la primera parada la deja primera (el gestor no falla).
      expect(insertRouteAt(['a', 'b'], 'a', -1)).toEqual(['a', 'b']);
    });

    it('falla en alto con casa sin id o índice no entero', () => {
      expect(() => insertRouteAt(['a'], '', 0)).toThrow();
      expect(() => insertRouteAt(['a'], '   ', 0)).toThrow();
      expect(() => insertRouteAt(['a'], 'x', 1.5)).toThrow();
      expect(() => insertRouteAt(['a'], 'x', Number.NaN)).toThrow();
    });
  });

  describe('routeNumberByCity', () => {
    it('numera la ruta completa 1-based en su orden global', () => {
      const numbers = routeNumberByCity(['a', 'b', 'c']);
      expect(numbers.get('a')).toBe(1);
      expect(numbers.get('c')).toBe(3);
      expect(numbers.get('x')).toBeUndefined();
    });

    it('sin ruta devuelve un mapa vacío', () => {
      expect(routeNumberByCity(null).size).toBe(0);
      expect(routeNumberByCity([]).size).toBe(0);
    });
  });

  describe('resolveRouteStops', () => {
    it('resuelve nombre e isla de cada parada conservando el número global', () => {
      const { stops, missing } = resolveRouteStops(
        ['bases/html', 'front/react', 'bases/css'],
        MAPS,
      );
      expect(missing).toEqual([]);
      expect(stops).toEqual([
        { n: 1, cityId: 'bases/html', cityName: 'HTML', islandId: 'island', islandName: 'Bases de software' },
        { n: 2, cityId: 'front/react', cityName: 'React', islandId: 'frontend', islandName: 'Frontend' },
        { n: 3, cityId: 'bases/css', cityName: 'CSS', islandId: 'island', islandName: 'Bases de software' },
      ]);
    });

    it('las casas que no están en ningún mapa van a missing CON su número', () => {
      const { stops, missing } = resolveRouteStops(['bases/html', 'fantasma', 'bases/css'], MAPS);
      expect(missing).toEqual([{ n: 2, cityId: 'fantasma' }]);
      // La numeración global no se recompacta: la isla y el gestor coinciden.
      expect(stops.map((s) => s.n)).toEqual([1, 3]);
    });
  });

  describe('routeSeaModel', () => {
    it('agrupa islas consecutivas y agrega los números por isla', () => {
      const { stops } = resolveRouteStops(
        ['bases/html', 'bases/css', 'front/react'],
        MAPS,
      );
      const sea = routeSeaModel(stops);
      expect(sea.hops).toEqual(['island', 'frontend']);
      expect(sea.byIsland.get('island')).toEqual([1, 2]);
      expect(sea.byIsland.get('frontend')).toEqual([3]);
    });

    it('la vuelta a una isla anterior es un tramo real del viaje', () => {
      const { stops } = resolveRouteStops(
        ['bases/html', 'front/react', 'bases/css'],
        MAPS,
      );
      const sea = routeSeaModel(stops);
      expect(sea.hops).toEqual(['island', 'frontend', 'island']);
      expect(sea.byIsland.get('island')).toEqual([1, 3]);
    });

    it('sin paradas no hay tramos ni etiquetas', () => {
      expect(routeSeaModel([])).toEqual({ hops: [], byIsland: new Map() });
    });
  });

  describe('formatStopRanges', () => {
    it('colapsa consecutivos en rangos y lista los sueltos', () => {
      expect(formatStopRanges([1, 2, 3])).toBe('1–3');
      expect(formatStopRanges([1, 2, 3, 5])).toBe('1–3, 5');
      expect(formatStopRanges([4])).toBe('4');
      expect(formatStopRanges([1, 3, 5])).toBe('1, 3, 5');
    });

    it('ordena antes de agrupar y sin números devuelve cadena vacía', () => {
      expect(formatStopRanges([3, 1, 2])).toBe('1–3');
      expect(formatStopRanges([])).toBe('');
    });
  });
});
