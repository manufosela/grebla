import { describe, it, expect } from 'vitest';
import { CAREER_ROUTES, routeDocs } from './index.js';
import { ISLAND_CONTENT } from '../islands/index.js';
import {
  ROUTE_TIER_KEYS,
  normalizeCareerRoute,
  routeDocId,
} from '../../domain/careerRoutes.js';

/**
 * Guardas de la CONVENCIÓN de rutas de rol (JG-14, ver cabecera de
 * ./backend-php.js). Todo rol registrado en CAREER_ROUTES pasa por aquí
 * automáticamente: si una ruta nueva rompe la convención, el test dice cuál
 * y por qué.
 */

/** Tamaños orientativos de cada hito (paradas mín/máx, convención JG-14). */
const TIER_SIZES = {
  peritus: { min: 8, max: 16 },
  veteranus: { min: 16, max: 26 },
  magister: { min: 26, max: 40 },
};

/** Nº mínimo de paradas de Bases con las que arranca toda ruta. */
const MIN_BASES_START = 4;

/** Catálogo GLOBAL de casas del archipiélago: id → ciudad (con sus prereqs). */
const cityById = new Map(
  Object.values(ISLAND_CONTENT).flatMap((map) => map.cities.map((c) => [c.id, c])),
);

const roles = Object.entries(CAREER_ROUTES);

describe('career — rutas de rol y nivel (JG-14, convención)', () => {
  it('hay al menos un rol con itinerario (Backend PHP)', () => {
    expect(roles.length).toBeGreaterThanOrEqual(1);
    expect(CAREER_ROUTES['backend-php']?.roleName).toBe('Backend PHP');
  });

  describe.each(roles)('rol %s', (discipline, role) => {
    const tiers = ROUTE_TIER_KEYS.filter((key) => role.tiers[key]).map((key) => [
      key,
      role.tiers[key],
    ]);

    it('declara su disciplina, su rol y solo hitos de la escala', () => {
      expect(role.discipline).toBe(discipline);
      expect(role.roleName.trim()).not.toBe('');
      expect(Object.keys(role.tiers).every((k) => ROUTE_TIER_KEYS.includes(k))).toBe(true);
      expect(tiers.length).toBeGreaterThanOrEqual(1);
    });

    describe.each(tiers)('hito %s', (tierKey, tier) => {
      it('tiene nombre, descripción y un tamaño dentro de su rango', () => {
        expect(tier.name.trim()).not.toBe('');
        expect(tier.description.trim()).not.toBe('');
        const { min, max } = TIER_SIZES[tierKey];
        expect(tier.stops.length).toBeGreaterThanOrEqual(min);
        expect(tier.stops.length).toBeLessThanOrEqual(max);
      });

      it('todas sus paradas existen en el contenido de las islas, sin duplicados', () => {
        for (const stop of tier.stops) {
          expect(cityById.has(stop), `parada inexistente en ISLAND_CONTENT: ${stop}`).toBe(true);
        }
        expect(new Set(tier.stops).size).toBe(tier.stops.length);
      });

      it(`entra por Bases: las ${MIN_BASES_START} primeras paradas son bases/`, () => {
        for (const stop of tier.stops.slice(0, MIN_BASES_START)) {
          expect(stop, `la ruta no arranca en Bases: ${stop}`).toMatch(/^bases\//);
        }
      });

      it('su orden respeta los prerequisitos INTRA-isla entre paradas', () => {
        const position = new Map(tier.stops.map((stop, index) => [stop, index]));
        for (const stop of tier.stops) {
          for (const prereq of cityById.get(stop)?.prereqs ?? []) {
            if (!position.has(prereq)) continue; // prereq fuera de la ruta: no ordena
            expect(
              position.get(prereq),
              `${prereq} es prereq de ${stop} y va después en la ruta`,
            ).toBeLessThan(position.get(stop));
          }
        }
      });
    });

    it('sus hitos son CRECIENTES: peritus ⊆ veteranus ⊆ magister (como conjuntos)', () => {
      for (let i = 1; i < tiers.length; i += 1) {
        const [lowerKey, lower] = tiers[i - 1];
        const [upperKey, upper] = tiers[i];
        const upperSet = new Set(upper.stops);
        expect(
          new Set(lower.stops).isSubsetOf(upperSet),
          `paradas de ${lowerKey} fuera de ${upperKey}: ${lower.stops.filter((s) => !upperSet.has(s)).join(', ')}`,
        ).toBe(true);
      }
    });
  });

  describe('routeDocs (lo que publica el seed)', () => {
    const docs = routeDocs();

    it('un doc por hito, con id {disciplina}--{hito} sin barras', () => {
      const expected = roles.flatMap(([discipline, role]) =>
        ROUTE_TIER_KEYS.filter((key) => role.tiers[key]).map((key) => routeDocId(discipline, key)),
      );
      expect(docs.map((d) => d.routeId)).toEqual(expected);
      for (const { routeId } of docs) expect(routeId).not.toContain('/');
    });

    it('cada doc sobrevive al saneo de lectura (normalizeCareerRoute) sin pérdidas', () => {
      for (const { routeId, data } of docs) {
        expect(normalizeCareerRoute(data, routeId)).toEqual({ routeId, ...data });
      }
    });
  });
});
