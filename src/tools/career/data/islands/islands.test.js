import { describe, it, expect } from 'vitest';
import { ISLAND_CONTENT } from './index.js';
import { ARCHIPELAGO_ISLANDS } from '../archipelago.js';
import { normalizeCareerMap, serializeCareerMap } from '../maps.js';
import { RESOURCE_KINDS } from '../../domain/types.js';

/**
 * Guardas de la CONVENCIÓN de contenido de islas (MC-16, ver cabecera de
 * ./bases.js). Todo lo que se registre en ISLAND_CONTENT (oleada 2 incluida)
 * pasa por aquí automáticamente: si una isla nueva rompe la convención, el
 * test dice cuál y por qué.
 */

/** Separación mínima entre ciudades y respecto al puerto (unidades del mapa 0..100). */
const MIN_CITY_DISTANCE = 8;
const MIN_PORT_DISTANCE = 12;

/** @param {{x:number,y:number}} a @param {{x:number,y:number}} b */
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const entries = Object.entries(ISLAND_CONTENT);

describe('career — contenido de islas (MC-16, convención)', () => {
  it('hay al menos una isla con contenido (Bases de software)', () => {
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(ISLAND_CONTENT.island?.name).toBe('Bases de software');
  });

  it('los ids de ciudad son únicos GLOBALES en todo el archipiélago', () => {
    const all = entries.flatMap(([, map]) => map.cities.map((c) => c.id));
    expect(new Set(all).size).toBe(all.length);
  });

  describe.each(entries)('isla %s', (islandId, map) => {
    const ref = ARCHIPELAGO_ISLANDS.find((i) => i.id === islandId);

    it('está registrada en el índice del archipiélago y el id del mapa coincide', () => {
      expect(ref, `la isla ${islandId} no existe en ARCHIPELAGO_ISLANDS`).toBeDefined();
      expect(map.id).toBe(islandId);
      expect(map.name.trim()).not.toBe('');
    });

    it('sobrevive al roundtrip normalize→serialize sin pérdidas', () => {
      const roundtrip = normalizeCareerMap(serializeCareerMap(map), map.id);
      expect(roundtrip).toEqual(map);
    });

    it('las ciudades llevan el prefijo de la disciplina de la isla', () => {
      const prefix = `${ref?.discipline}/`;
      for (const city of map.cities) {
        expect(city.id, `id sin prefijo «${prefix}»: ${city.id}`).toMatch(new RegExp(`^${prefix}[a-z0-9-]+$`));
      }
    });

    it('las comarcas existen, no se repiten y todas tienen ciudades', () => {
      const areaIds = map.areas.map((a) => a.id);
      expect(new Set(areaIds).size).toBe(areaIds.length);
      for (const city of map.cities) {
        expect(areaIds, `la ciudad ${city.id} apunta a una comarca inexistente: ${city.area}`).toContain(city.area);
      }
      for (const areaId of areaIds) {
        expect(
          map.cities.some((c) => c.area === areaId),
          `la comarca ${areaId} no tiene ninguna ciudad`,
        ).toBe(true);
      }
    });

    it('los prereqs son internos a la isla, sin auto-referencias ni ciclos', () => {
      const ids = new Set(map.cities.map((c) => c.id));
      for (const city of map.cities) {
        expect(city.prereqs).not.toContain(city.id);
        for (const p of city.prereqs) {
          expect(ids.has(p), `prereq inexistente «${p}» en la ciudad ${city.id}`).toBe(true);
        }
      }
      // Detección de ciclos por DFS con coloreado (0 = sin visitar, 1 = en pila, 2 = cerrado).
      const byId = new Map(map.cities.map((c) => [c.id, c]));
      const color = new Map();
      /** @param {string} id @returns {boolean} true si hay ciclo alcanzable desde id */
      const hasCycle = (id) => {
        if (color.get(id) === 1) return true;
        if (color.get(id) === 2) return false;
        color.set(id, 1);
        const cycles = (byId.get(id)?.prereqs ?? []).some(hasCycle);
        color.set(id, 2);
        return cycles;
      };
      for (const city of map.cities) {
        expect(hasCycle(city.id), `ciclo de prereqs alcanzable desde ${city.id}`).toBe(false);
      }
    });

    it('hay ciudades raíz (sin prereqs) por las que empezar', () => {
      expect(map.cities.some((c) => c.prereqs.length === 0)).toBe(true);
    });

    it('su citiesTotal del índice coincide con las ciudades NO deprecadas (MC-20)', () => {
      // El HUD de progresión calcula la ciudadanía con el citiesTotal del
      // ÍNDICE: si el contenido de la isla cambia, la semilla debe seguirlo
      // (en Firestore lo mantiene scripts/seed-islands.mjs).
      const total = map.cities.filter((c) => !c.deprecated).length;
      expect(ref?.citiesTotal, `citiesTotal desactualizado en ARCHIPELAGO_ISLANDS para ${islandId}`).toBe(total);
      expect(ref?.citizenshipPct, `citizenshipPct sin definir para ${islandId}`).toBeGreaterThan(0);
    });

    it('posiciones en rango 0..100, separadas entre sí y lejos del puerto', () => {
      expect(map.startPort).toBeDefined();
      for (const city of map.cities) {
        expect(city.x).toBeGreaterThanOrEqual(0);
        expect(city.x).toBeLessThanOrEqual(100);
        expect(city.y).toBeGreaterThanOrEqual(0);
        expect(city.y).toBeLessThanOrEqual(100);
        expect(
          distance(city, map.startPort),
          `la ciudad ${city.id} está a menos de ${MIN_PORT_DISTANCE} del puerto`,
        ).toBeGreaterThanOrEqual(MIN_PORT_DISTANCE);
      }
      for (let i = 0; i < map.cities.length; i += 1) {
        for (let j = i + 1; j < map.cities.length; j += 1) {
          const [a, b] = [map.cities[i], map.cities[j]];
          expect(
            distance(a, b),
            `${a.id} y ${b.id} están a menos de ${MIN_CITY_DISTANCE} unidades`,
          ).toBeGreaterThanOrEqual(MIN_CITY_DISTANCE);
        }
      }
    });

    it('pesos 1..3 y kinds válidos', () => {
      for (const city of map.cities) {
        expect([1, 2, 3], `peso fuera de rango en ${city.id}`).toContain(city.weight);
        expect(['skill', 'tech', 'milestone']).toContain(city.kind);
        expect(city.name.trim()).not.toBe('');
      }
    });

    it('cada ciudad tiene un summary didáctico (≥80 caracteres)', () => {
      for (const city of map.cities) {
        expect(city.summary?.trim().length, `summary vacío o demasiado corto en ${city.id}`).toBeGreaterThanOrEqual(80);
      }
    });

    it('cada ciudad tiene keyPoints (4-6), aiFocus específico y 2-4 recursos reales', () => {
      for (const city of map.cities) {
        expect(city.keyPoints?.length, `keyPoints fuera de 4-6 en ${city.id}`).toBeGreaterThanOrEqual(4);
        expect(city.keyPoints?.length, `keyPoints fuera de 4-6 en ${city.id}`).toBeLessThanOrEqual(6);
        for (const point of city.keyPoints ?? []) expect(point.trim()).not.toBe('');
        expect(city.aiFocus?.trim().length, `aiFocus vacío o demasiado corto en ${city.id}`).toBeGreaterThanOrEqual(60);
        expect(city.resources?.length, `resources fuera de 2-4 en ${city.id}`).toBeGreaterThanOrEqual(2);
        expect(city.resources?.length, `resources fuera de 2-4 en ${city.id}`).toBeLessThanOrEqual(4);
        for (const res of city.resources ?? []) {
          expect(RESOURCE_KINDS).toContain(res.kind);
          expect(res.label.trim()).not.toBe('');
          if (res.url) expect(res.url, `url no https en ${city.id}: ${res.url}`).toMatch(/^https:\/\//);
          if (res.kind === 'libro' && !res.url) expect(res.format).toBe('papel');
        }
      }
    });
  });
});
