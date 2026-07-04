import { describe, it, expect } from 'vitest';
import {
  ARCHIPELAGO_ISLANDS,
  START_ISLAND_ID,
  DEFAULT_CITIZENSHIP_PCT,
  seedArchipelago,
  normalizeArchipelago,
  serializeArchipelago,
} from './archipelago.js';

describe('career — archipiélago (índice de islas, helpers puros)', () => {
  it('la semilla tiene las 13 islas del ADR con ids únicos', () => {
    expect(ARCHIPELAGO_ISLANDS).toHaveLength(13);
    const ids = ARCHIPELAGO_ISLANDS.map((i) => i.id);
    expect(new Set(ids).size).toBe(13);
    expect(ids).toEqual(
      expect.arrayContaining([
        'island', 'frontend', 'backend-php', 'backend-python', 'android', 'ios',
        'ai-engineer', 'devops', 'postgres', 'engineering-manager',
        'software-architect', 'product-manager', 'fde',
      ]),
    );
  });

  it('solo la isla de inicio lleva startIsland y es «Bases de software»', () => {
    const starts = ARCHIPELAGO_ISLANDS.filter((i) => i.startIsland === true);
    expect(starts).toHaveLength(1);
    expect(starts[0].id).toBe(START_ISLAND_ID);
    expect(starts[0].name).toBe('Bases de software');
  });

  it('las posiciones están en 0..100 y dispersas (sin solapes en el mapa del mar)', () => {
    for (const island of ARCHIPELAGO_ISLANDS) {
      expect(island.x).toBeGreaterThanOrEqual(0);
      expect(island.x).toBeLessThanOrEqual(100);
      expect(island.y).toBeGreaterThanOrEqual(0);
      expect(island.y).toBeLessThanOrEqual(100);
    }
    // Dispersión mínima: ningún par de islas a menos de 10 unidades.
    for (let i = 0; i < ARCHIPELAGO_ISLANDS.length; i += 1) {
      for (let j = i + 1; j < ARCHIPELAGO_ISLANDS.length; j += 1) {
        const a = ARCHIPELAGO_ISLANDS[i];
        const b = ARCHIPELAGO_ISLANDS[j];
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id} vs ${b.id}`).toBeGreaterThanOrEqual(10);
      }
    }
  });

  it('seedArchipelago devuelve una copia profunda (fallback mutable sin efectos)', () => {
    const seed = seedArchipelago();
    expect(seed.islands).toEqual(ARCHIPELAGO_ISLANDS);
    seed.islands[0].name = 'cambiado';
    expect(ARCHIPELAGO_ISLANDS[0].name).not.toBe('cambiado');
  });

  it('normalizeArchipelago(null) usa la semilla (documento inexistente)', () => {
    expect(normalizeArchipelago(null)).toEqual(seedArchipelago());
    expect(normalizeArchipelago(undefined)).toEqual(seedArchipelago());
  });

  it('normalizeArchipelago sanea tipos, descarta sin id y deduplica conservando el orden', () => {
    const arch = normalizeArchipelago({
      islands: [
        { id: 'a', name: 'Isla A', x: '30', y: 200, discipline: ' front ', citizenshipPct: 85, citiesTotal: 12 },
        { id: '', name: 'sin id' },
        { id: 'b', x: 'no-num' },
        { id: 'a', name: 'duplicada' },
      ],
    });
    expect(arch.islands.map((i) => i.id)).toEqual(['a', 'b']);
    // x saneado a número; y fuera de rango acotada a 100.
    expect(arch.islands[0]).toEqual({
      id: 'a', name: 'Isla A', x: 30, y: 100, discipline: 'front', citizenshipPct: 85, citiesTotal: 12,
    });
    // Sin nombre → el id; x inválida → 50 (centro); sin campos MC-20 → defaults.
    expect(arch.islands[1]).toEqual({
      id: 'b', name: 'b', x: 50, y: 50, citizenshipPct: DEFAULT_CITIZENSHIP_PCT, citiesTotal: 0,
    });
  });

  it('un documento con islands vacío se respeta (no cae a la semilla en silencio)', () => {
    expect(normalizeArchipelago({ islands: [] })).toEqual({ islands: [] });
    expect(normalizeArchipelago({})).toEqual({ islands: [] });
  });

  it('serializeArchipelago no persiste undefined ni opcionales vacíos (Firestore-safe)', () => {
    const serialized = serializeArchipelago({
      islands: [
        { id: 'x', name: 'X', x: 10, y: 20, discipline: '', startIsland: false, citizenshipPct: 70, citiesTotal: 9 },
        { id: 'y', name: '', x: 1, y: 2, startIsland: true, citizenshipPct: 90, citiesTotal: 3 },
      ],
    });
    expect(serialized.islands[0]).toEqual({ id: 'x', name: 'X', x: 10, y: 20, citizenshipPct: 70, citiesTotal: 9 });
    expect(serialized.islands[1]).toEqual({ id: 'y', name: 'y', x: 1, y: 2, startIsland: true, citizenshipPct: 90, citiesTotal: 3 });
    expect(JSON.stringify(serialized)).not.toContain('undefined');
  });

  it('normalize→serialize→normalize es estable para la semilla', () => {
    const once = serializeArchipelago(seedArchipelago());
    const back = normalizeArchipelago(once);
    expect(serializeArchipelago(back)).toEqual(once);
    expect(once.islands).toEqual(ARCHIPELAGO_ISLANDS);
  });

  // ── Progresión (MC-20): objetivo de ciudadanía y total de ciudades ─────────

  it('la semilla lleva los objetivos de ciudadanía de la card (MC-20)', () => {
    const pct = Object.fromEntries(ARCHIPELAGO_ISLANDS.map((i) => [i.id, i.citizenshipPct]));
    expect(pct).toEqual({
      island: 100,
      postgres: 85,
      'software-architect': 85,
      'engineering-manager': 90,
      'product-manager': 90,
      frontend: 80,
      'backend-php': 80,
      'backend-python': 80,
      devops: 75,
      android: 75,
      ios: 75,
      'ai-engineer': 70,
      fde: 70,
    });
  });

  it('toda isla de la semilla trae citiesTotal > 0 (islands.test.js lo valida contra el contenido)', () => {
    for (const island of ARCHIPELAGO_ISLANDS) {
      expect(island.citiesTotal, island.id).toBeGreaterThan(0);
      expect(Number.isInteger(island.citiesTotal), island.id).toBe(true);
    }
  });

  it('un índice pre-MC-20 (sin campos de progresión) cae al pct de su isla homónima de la semilla', () => {
    const arch = normalizeArchipelago({
      islands: [
        { id: 'postgres', name: 'Isla Postgres', x: 78, y: 62 }, // conocida → 85 del ADR
        { id: 'atlantis', name: 'Atlantis', x: 5, y: 5 }, // desconocida → default documentado
      ],
    });
    expect(arch.islands[0]).toMatchObject({ citizenshipPct: 85, citiesTotal: 0 });
    expect(arch.islands[1]).toMatchObject({ citizenshipPct: DEFAULT_CITIZENSHIP_PCT, citiesTotal: 0 });
  });

  it('citizenshipPct y citiesTotal se sanean: acotados, enteros y nunca negativos', () => {
    const arch = normalizeArchipelago({
      islands: [
        { id: 'a', citizenshipPct: 130, citiesTotal: -4 },
        { id: 'b', citizenshipPct: 66.6, citiesTotal: 7.8 },
        { id: 'c', citizenshipPct: 'no-num', citiesTotal: 'no-num' },
      ],
    });
    expect(arch.islands[0]).toMatchObject({ citizenshipPct: 100, citiesTotal: 0 });
    expect(arch.islands[1]).toMatchObject({ citizenshipPct: 67, citiesTotal: 8 });
    expect(arch.islands[2]).toMatchObject({ citizenshipPct: DEFAULT_CITIZENSHIP_PCT, citiesTotal: 0 });
  });
});
