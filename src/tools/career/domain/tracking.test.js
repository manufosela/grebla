import { describe, it, expect } from 'vitest';
import { PLAYTIME } from './playtime.js';
import { activityFrom, trackingRow, sortByNeglect, ACTIVITY_WINDOW_DAYS } from './tracking.js';

const HOY = new Date('2026-09-25T10:00:00');

describe('la ventana de la que se puede hablar', () => {
  it('es la que de verdad guarda el cronómetro, no una inventada', () => {
    // El histórico por día se poda a PLAYTIME.maxDays: decir «días activos» sin
    // acotar la ventana sería contar sobre datos que ya no existen.
    expect(ACTIVITY_WINDOW_DAYS).toBe(PLAYTIME.maxDays);
  });
});

describe('la dedicación de una persona', () => {
  const playtime = {
    totalMinutes: 300,
    byDay: { '2026-09-20': 60, '2026-09-22': 90, '2026-09-25': 30 },
  };

  it('cuenta los días en que tocó el plan, no los del calendario', () => {
    expect(activityFrom(playtime, HOY).daysActive).toBe(3);
  });

  it('la media es por día ACTIVO: repartirla sobre el mes mentiría a la baja', () => {
    expect(activityFrom(playtime, HOY).avgMinutesPerActiveDay).toBe(60);
  });

  it('dice cuándo fue la última vez y cuánto hace de eso', () => {
    const a = activityFrom(playtime, HOY);
    expect(a.lastDay).toBe('2026-09-25');
    expect(a.idleDays).toBe(0);
  });

  it('cuenta los días de abandono desde la última vez', () => {
    const a = activityFrom({ totalMinutes: 60, byDay: { '2026-09-18': 60 } }, HOY);
    expect(a.idleDays).toBe(7);
  });

  it('quien no ha tocado nunca el plan no tiene medias ni última vez', () => {
    expect(activityFrom(null, HOY)).toEqual({
      daysActive: 0, windowMinutes: 0, totalMinutes: 0,
      avgMinutesPerActiveDay: 0, lastDay: null, idleDays: null,
    });
  });

  it('ignora los días con 0 minutos: estar el documento no es haber jugado', () => {
    const a = activityFrom({ totalMinutes: 60, byDay: { '2026-09-20': 60, '2026-09-21': 0 } }, HOY);
    expect(a.daysActive).toBe(1);
  });

  it('separa el total histórico de lo que cabe en la ventana', () => {
    // totalMinutes es acumulado de siempre; byDay solo guarda los últimos días.
    const a = activityFrom(playtime, HOY);
    expect(a.totalMinutes).toBe(300);
    expect(a.windowMinutes).toBe(180);
  });

  it('un día futuro no cuenta: es un reloj mal puesto, no dedicación', () => {
    const a = activityFrom({ totalMinutes: 60, byDay: { '2026-12-01': 60, '2026-09-24': 20 } }, HOY);
    expect(a.daysActive).toBe(1);
    expect(a.lastDay).toBe('2026-09-24');
  });
});

describe('la fila de seguimiento de una persona', () => {
  const person = { id: 'p1', name: 'Ana', careerTargetLevelId: 'L3' };
  // `plannedRoute` es el nombre real del campo persistido: con `route` el test
  // pasaría contando 0 paradas de una ruta que sí existe.
  const journey = { currentIsland: 'bases', visitedCities: ['a', 'b'], plannedRoute: ['a', 'b', 'c'] };
  const stats = { pct: 40, points: 4, total: 10 };

  it('junta en una línea por dónde va y cuánto le dedica', () => {
    const row = trackingRow({ person, journey, stats, playtime: { totalMinutes: 30, byDay: { '2026-09-25': 30 } } }, HOY);
    expect(row).toMatchObject({
      personId: 'p1',
      name: 'Ana',
      targetLevelId: 'L3',
      currentIsland: 'bases',
      visitedCount: 2,
      routeCount: 3,
      pct: 40,
    });
    expect(row.activity.daysActive).toBe(1);
  });

  it('quien no ha empezado se ve como lo que es, sin inventar ceros con aire de dato', () => {
    const row = trackingRow({ person, journey: null, stats: null, playtime: null }, HOY);
    expect(row.started).toBe(false);
    expect(row.visitedCount).toBe(0);
    expect(row.pct).toBe(null);
    expect(row.currentIsland).toBe(null);
  });

  it('haber visitado algo ya es haber empezado, aunque no haya ruta', () => {
    const row = trackingRow({ person, journey: { visitedCities: ['a'] }, stats, playtime: null }, HOY);
    expect(row.started).toBe(true);
  });

  it('haberse trazado una ruta también es haber empezado, aunque no haya pisado nada', () => {
    const row = trackingRow({ person, journey: { plannedRoute: ['a', 'b'] }, stats, playtime: null }, HOY);
    expect(row.started).toBe(true);
    expect(row.routeCount).toBe(2);
  });
});

describe('a quién hay que mirar primero', () => {
  const fila = (id, idleDays, started = true) => ({ personId: id, started, activity: { idleDays } });

  it('primero quien lleva más tiempo sin tocarlo: es a quien hay que acompañar', () => {
    const orden = sortByNeglect([fila('a', 2), fila('b', 30), fila('c', 10)]).map((r) => r.personId);
    expect(orden).toEqual(['b', 'c', 'a']);
  });

  it('quien no ha empezado nunca va el primero de todos', () => {
    const orden = sortByNeglect([fila('a', 2), fila('z', null, false), fila('b', 30)]).map((r) => r.personId);
    expect(orden).toEqual(['z', 'b', 'a']);
  });

  it('no toca la lista que recibe', () => {
    const filas = [fila('a', 2), fila('b', 30)];
    sortByNeglect(filas);
    expect(filas.map((r) => r.personId)).toEqual(['a', 'b']);
  });
});
