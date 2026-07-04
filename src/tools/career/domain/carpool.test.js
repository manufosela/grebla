import { describe, it, expect } from 'vitest';
import {
  CARPOOL_STATUSES,
  DEFAULT_CARPOOL_SEATS,
  MIN_CARPOOL_SEATS,
  MAX_CARPOOL_SEATS,
  localIsoDay,
  normalizeCarpoolStop,
  normalizeCarpool,
  seatsLeft,
  isMember,
  canJoin,
  routeSummary,
  memberStopState,
  carpoolProgress,
  carpoolFromPlannedRoute,
} from './carpool.js';

/** Parada mínima válida para componer fixtures. */
const stop = (cityId, islandId = 'island', targetDate = null) => ({
  cityId,
  islandId,
  islandName: islandId === 'island' ? 'Isla GREBLA' : islandId,
  cityName: cityId.toUpperCase(),
  targetDate,
});

/** Carpool válido de fixture: Ana conduce, Bea va de copiloto. */
const carpool = (over = {}) => ({
  id: 'cp1',
  name: 'Ruta JS',
  status: 'open',
  seats: 3,
  conductor: { personId: 'ana', name: 'Ana' },
  members: [
    { personId: 'ana', name: 'Ana', joinedAt: '2026-07-01T10:00:00Z' },
    { personId: 'bea', name: 'Bea', joinedAt: '2026-07-02T10:00:00Z' },
  ],
  memberIds: ['ana', 'bea'],
  route: [stop('html'), stop('css'), stop('js', 'island', '2026-07-01')],
  createdAt: '2026-07-01T10:00:00Z',
  createdBy: { uid: 'uid-ana', name: 'Ana Líder' },
  ...over,
});

/** Journey mínimo con las ciudades visitadas dadas. */
const journeyWith = (...visitedCities) => ({
  visitedCities,
  currentCity: null,
  plannedRoute: [],
  currentIsland: 'island',
  visitedIslands: ['island'],
  evidences: {},
});

describe('carpool: normalización', () => {
  it('normaliza un documento completo (con espejo memberIds y ruta saneada)', () => {
    const cp = normalizeCarpool(
      {
        name: '  Ruta JS  ',
        status: 'open',
        seats: 4,
        conductor: { personId: 'ana', name: 'Ana' },
        members: [
          { personId: 'ana', name: 'Ana', joinedAt: '2026-07-01T10:00:00Z' },
          { personId: '', name: 'fantasma' }, // miembro corrupto: fuera
        ],
        route: [
          { cityId: 'html', islandId: 'island', islandName: 'Isla GREBLA', cityName: 'HTML', targetDate: '2026-08-01' },
          { cityId: '', islandId: 'island' }, // parada corrupta: fuera
          { cityId: 'css', islandId: 'island', targetDate: 'no-es-fecha' },
        ],
        createdAt: '2026-07-01T10:00:00Z',
        createdBy: { uid: 'uid-ana', name: 'Ana Líder' },
      },
      'cp1',
    );
    expect(cp).not.toBeNull();
    expect(cp.name).toBe('Ruta JS');
    expect(cp.memberIds).toEqual(['ana']);
    expect(cp.route).toHaveLength(2);
    expect(cp.route[0].targetDate).toBe('2026-08-01');
    expect(cp.route[1].targetDate).toBeNull(); // fecha malformada NO viaja
    expect(cp.route[1].cityName).toBe('css'); // sin nombre: cae al id
  });

  it('descarta documentos no salvables (sin nombre, sin conductor o status desconocido)', () => {
    const base = carpool();
    expect(normalizeCarpool({ ...base, name: '  ' }, 'cp1')).toBeNull();
    expect(normalizeCarpool({ ...base, conductor: {} }, 'cp1')).toBeNull();
    expect(normalizeCarpool({ ...base, status: 'volando' }, 'cp1')).toBeNull();
    expect(normalizeCarpool(base, '')).toBeNull();
  });

  it('acota seats al rango válido y nunca por debajo de los miembros', () => {
    const base = carpool();
    expect(normalizeCarpool({ ...base, seats: 'nan' }, 'cp1').seats).toBe(DEFAULT_CARPOOL_SEATS);
    expect(normalizeCarpool({ ...base, seats: 0 }, 'cp1').seats).toBe(MIN_CARPOOL_SEATS);
    expect(normalizeCarpool({ ...base, seats: 99 }, 'cp1').seats).toBe(MAX_CARPOOL_SEATS);
    const crowded = { ...base, seats: 1 }; // 2 miembros dentro: no se expulsa a nadie
    expect(normalizeCarpool(crowded, 'cp1').seats).toBe(2);
  });

  it('normalizeCarpoolStop descarta paradas sin ciudad o sin isla', () => {
    expect(normalizeCarpoolStop({ cityId: '', islandId: 'island' })).toBeNull();
    expect(normalizeCarpoolStop({ cityId: 'js', islandId: '' })).toBeNull();
    expect(normalizeCarpoolStop(null)).toBeNull();
  });

  it('el catálogo de estados es el esperado', () => {
    expect(CARPOOL_STATUSES).toEqual(['open', 'full', 'completed', 'closed']);
  });
});

describe('carpool: aforo y unión', () => {
  it('seatsLeft nunca es negativo', () => {
    expect(seatsLeft(carpool())).toBe(1);
    expect(seatsLeft(carpool({ seats: 2 }))).toBe(0);
  });

  it('canJoin: solo abierto, con plaza y sin estar ya dentro', () => {
    const cp = carpool();
    expect(canJoin(cp, 'carla')).toBe(true);
    expect(canJoin(cp, 'ana')).toBe(false); // ya es miembro (conductor)
    expect(canJoin(cp, null)).toBe(false); // sin persona seleccionada
    expect(canJoin(carpool({ status: 'full' }), 'carla')).toBe(false);
    expect(canJoin(carpool({ status: 'closed' }), 'carla')).toBe(false);
    expect(canJoin(carpool({ seats: 2 }), 'carla')).toBe(false); // sin plaza
  });

  it('isMember consulta el espejo memberIds', () => {
    expect(isMember(carpool(), 'bea')).toBe(true);
    expect(isMember(carpool(), 'carla')).toBe(false);
  });
});

describe('carpool: resumen de ruta', () => {
  it('islas en orden de aparición, sin repetir, y nº de paradas', () => {
    const cp = carpool({
      route: [stop('html'), stop('docker', 'devops'), stop('css'), stop('ci', 'devops')],
    });
    expect(routeSummary(cp)).toEqual({
      islandNames: ['Isla GREBLA', 'devops'],
      stops: 4,
    });
  });
});

describe('carpool: progreso', () => {
  const today = '2026-07-04';

  it('memberStopState: done / delayed / pending', () => {
    const late = stop('js', 'island', '2026-07-01');
    expect(memberStopState(late, journeyWith('js'), today)).toBe('done');
    expect(memberStopState(late, journeyWith(), today)).toBe('delayed');
    expect(memberStopState(stop('js'), journeyWith(), today)).toBe('pending');
    expect(memberStopState(stop('js', 'island', '2026-08-01'), journeyWith(), today)).toBe('pending');
    expect(memberStopState(stop('js'), undefined, today)).toBe('pending'); // sin journey
  });

  it('carpoolProgress: por miembro (X/Y, %, done) y por parada (quiénes, allDone, delayed)', () => {
    const cp = carpool(); // ruta: html, css, js(2026-07-01, pasada)
    const journeys = new Map([
      ['ana', journeyWith('html', 'css', 'js')],
      ['bea', journeyWith('html')],
    ]);
    const prog = carpoolProgress(cp, journeys, today);

    expect(prog.members).toEqual([
      { personId: 'ana', name: 'Ana', completed: 3, total: 3, pct: 100, done: true },
      { personId: 'bea', name: 'Bea', completed: 1, total: 3, pct: 33, done: false },
    ]);
    expect(prog.completed).toBe(false);

    const [html, css, js] = prog.stops;
    expect(html.completedBy).toEqual(['ana', 'bea']);
    expect(html.allDone).toBe(true);
    expect(html.delayed).toBe(false);
    expect(css.completedBy).toEqual(['ana']);
    expect(css.allDone).toBe(false);
    expect(css.delayed).toBe(false); // sin targetDate no hay retraso
    expect(js.delayed).toBe(true); // objetivo pasado y Bea no la tiene
    expect(js.states).toEqual({ ana: 'done', bea: 'delayed' });
  });

  it('carpool completado cuando TODOS terminan todas las paradas', () => {
    const cp = carpool();
    const journeys = new Map([
      ['ana', journeyWith('html', 'css', 'js')],
      ['bea', journeyWith('html', 'css', 'js')],
    ]);
    const prog = carpoolProgress(cp, journeys, today);
    expect(prog.completed).toBe(true);
    expect(prog.stops.every((s) => s.allDone)).toBe(true);
    expect(prog.stops[2].delayed).toBe(false); // completada por todos: ya no hay retraso
  });

  it('ruta vacía: 0% sin divisiones por cero y nunca "completado"', () => {
    const prog = carpoolProgress(carpool({ route: [] }), new Map(), today);
    expect(prog.members[0]).toMatchObject({ completed: 0, total: 0, pct: 0, done: false });
    expect(prog.completed).toBe(false);
  });
});

describe('carpool: desde la ruta planificada personal', () => {
  const maps = [
    {
      id: 'island',
      name: 'Isla GREBLA',
      areas: [],
      cities: [
        { id: 'html', name: 'HTML', kind: 'tech', area: 'a', x: 0, y: 0, weight: 1, prereqs: [] },
        { id: 'js', name: 'JavaScript', kind: 'tech', area: 'a', x: 0, y: 0, weight: 2, prereqs: [] },
      ],
    },
    {
      id: 'devops',
      name: 'DevOps',
      areas: [],
      cities: [{ id: 'docker', name: 'Contenedores', kind: 'tech', area: 'a', x: 0, y: 0, weight: 2, prereqs: [] }],
    },
  ];

  it('resuelve isla y nombres en el orden de la ruta, con targetDate null', () => {
    const journey = { ...journeyWith(), plannedRoute: ['js', 'docker', 'html'] };
    const { stops, missing } = carpoolFromPlannedRoute(journey, maps);
    expect(missing).toEqual([]);
    expect(stops.map((s) => [s.cityId, s.islandId, s.cityName])).toEqual([
      ['js', 'island', 'JavaScript'],
      ['docker', 'devops', 'Contenedores'],
      ['html', 'island', 'HTML'],
    ]);
    expect(stops.every((s) => s.targetDate === null)).toBe(true);
  });

  it('las ciudades sin mapa NO se inventan: van a missing', () => {
    const journey = { ...journeyWith(), plannedRoute: ['js', 'perdida'] };
    const { stops, missing } = carpoolFromPlannedRoute(journey, maps);
    expect(stops).toHaveLength(1);
    expect(missing).toEqual(['perdida']);
  });

  it('ruta planificada vacía: sin paradas y sin faltas', () => {
    expect(carpoolFromPlannedRoute(journeyWith(), maps)).toEqual({ stops: [], missing: [] });
  });
});

describe('carpool: día local', () => {
  it('localIsoDay produce YYYY-MM-DD', () => {
    expect(localIsoDay(new Date(2026, 6, 4, 23, 59))).toBe('2026-07-04');
  });
});
