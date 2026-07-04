import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryCareerStore } from '../infrastructure/memory/index.js';
import {
  getMaps,
  getMap,
  getIslandMap,
  getJourney,
  toggleVisited,
  setCurrent,
  setCurrentIsland,
  toggleRoute,
  setEvidence,
  getAchievements,
  recordAchievements,
  listQuestions,
  askQuestion,
  answerQuestion,
  markQuestionSeen,
  getPlaytime,
  recordPlaytime,
  prunePlaytime,
  stats,
} from './usecases.js';
import { PLAYTIME, dayKey } from '../domain/playtime.js';

describe('career — casos de uso', () => {
  /** @type {ReturnType<typeof createMemoryCareerStore>} */
  let store;
  beforeEach(() => {
    store = createMemoryCareerStore();
  });

  it('hay un mapa de isla con comarcas y se obtiene por id', () => {
    expect(getMaps()).toHaveLength(1);
    const island = getMap('island');
    expect(island?.name).toBe('Isla GREBLA');
    expect(island?.areas.map((a) => a.id)).toEqual(['fundamentos', 'frontend', 'backend', 'data']);
    expect(island?.startPort).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
    expect(getIslandMap()).toBe(island);
    expect(getMap('nope')).toBeNull();
  });

  it('el journey de una persona nueva está vacío', async () => {
    const j = await getJourney(store, 'p1');
    expect(j).toMatchObject({ visitedCities: [], currentCity: null, plannedRoute: [], evidences: {} });
  });

  it('toggleVisited respeta los prerequisitos y actualiza el progreso', async () => {
    const map = getIslandMap();
    let j = await getJourney(store, 'p1');
    // 'js' requiere html y css → bloqueada al inicio
    await expect(toggleVisited(store, 'p1', map, j, 'js')).rejects.toThrow();
    j = await toggleVisited(store, 'p1', map, j, 'html');
    j = await toggleVisited(store, 'p1', map, j, 'css');
    j = await toggleVisited(store, 'p1', map, j, 'js'); // ya alcanzable
    expect(j.visitedCities).toContain('js');
    const s = stats(map, j);
    expect(s.points).toBeGreaterThan(0);
    expect(s.reachable).toContain('react'); // siguiente paso
  });

  it('una ciudad deprecada no se puede visitar', async () => {
    const map = getIslandMap();
    let j = await getJourney(store, 'p1');
    j = await toggleVisited(store, 'p1', map, j, 'html');
    j = await toggleVisited(store, 'p1', map, j, 'css');
    j = await toggleVisited(store, 'p1', map, j, 'js');
    // 'jquery' está deprecada → bloqueada aunque su prereq (js) esté visitado
    await expect(toggleVisited(store, 'p1', map, j, 'jquery')).rejects.toThrow();
  });

  it('setCurrent y toggleRoute persisten por persona', async () => {
    let j = await getJourney(store, 'p1');
    j = await setCurrent(store, 'p1', j, 'html');
    j = await toggleRoute(store, 'p1', j, 'arch-fe');
    const saved = await getJourney(store, 'p1');
    expect(saved.currentCity).toBe('html');
    expect(saved.plannedRoute).toContain('arch-fe');
    // toggleRoute de nuevo lo quita
    j = await toggleRoute(store, 'p1', saved, 'arch-fe');
    expect(j.plannedRoute).not.toContain('arch-fe');
  });

  it('setEvidence guarda evidencias por ciudad', async () => {
    let j = await getJourney(store, 'p1');
    j = await setEvidence(store, 'p1', j, 'js', { priorExperienceYears: 3, cursos: ['ES2025'] });
    const saved = await getJourney(store, 'p1');
    expect(saved.evidences.js).toMatchObject({ priorExperienceYears: 3, cursos: ['ES2025'] });
  });

  it('el journey es independiente entre personas', async () => {
    const map = getIslandMap();
    let j1 = await getJourney(store, 'p1');
    j1 = await toggleVisited(store, 'p1', map, j1, 'git');
    const j2 = await getJourney(store, 'p2');
    expect(j2.visitedCities).toEqual([]);
  });

  it('el journey arranca en la isla de inicio y los journeys legados también (MC-14)', async () => {
    const fresh = await getJourney(store, 'p1');
    expect(fresh.currentIsland).toBe('island');
    // Journey persistido ANTES del archipiélago (sin currentIsland): normaliza a 'island'.
    await store.journeys.save('p2', { visitedCities: ['git'], currentCity: 'git', plannedRoute: [], evidences: {} });
    const legacy = await getJourney(store, 'p2');
    expect(legacy.currentIsland).toBe('island');
    expect(legacy.visitedCities).toEqual(['git']);
  });

  it('las islas pisadas se registran al viajar y migran suave al cargar (MC-20)', async () => {
    // Journey nuevo: la isla de inicio ya cuenta como pisada.
    let j = await getJourney(store, 'p1');
    expect(j.visitedIslands).toEqual(['island']);
    // Viajar registra la isla destino; repetir destino no duplica.
    j = await setCurrentIsland(store, 'p1', j, 'frontend');
    expect(j.visitedIslands).toEqual(['island', 'frontend']);
    j = await setCurrentIsland(store, 'p1', j, 'island');
    j = await setCurrentIsland(store, 'p1', j, 'frontend');
    expect(j.visitedIslands).toEqual(['island', 'frontend']);
    const saved = await getJourney(store, 'p1');
    expect(saved.visitedIslands).toEqual(['island', 'frontend']);
    // Journey pre-MC-20 (sin visitedIslands): la isla actual figura como pisada.
    await store.journeys.save('p2', { visitedCities: [], currentCity: null, plannedRoute: [], currentIsland: 'devops', evidences: {} });
    const legacy = await getJourney(store, 'p2');
    expect(legacy.visitedIslands).toEqual(['devops']);
    // Y uno con duplicados/basura persistidos se sanea al leer.
    await store.journeys.save('p3', { visitedIslands: ['island', 'island', ' ', 42, 'ios'], currentIsland: 'ios' });
    const dirty = await getJourney(store, 'p3');
    expect(dirty.visitedIslands).toEqual(['island', 'ios']);
  });

  it('setCurrentIsland persiste el viaje y no toca el resto del journey (MC-14)', async () => {
    const map = getIslandMap();
    let j = await getJourney(store, 'p1');
    j = await toggleVisited(store, 'p1', map, j, 'git');
    j = await setCurrentIsland(store, 'p1', j, 'frontend');
    expect(j.currentIsland).toBe('frontend');
    const saved = await getJourney(store, 'p1');
    expect(saved.currentIsland).toBe('frontend');
    expect(saved.visitedCities).toContain('git'); // el journey es GLOBAL: nada se pierde al zarpar
    // Destino vacío: error alto, sin fallbacks silenciosos.
    await expect(setCurrentIsland(store, 'p1', saved, '  ')).rejects.toThrow();
  });

  it('los logros se registran de solo-añadir y no re-escriben fechas (MC-21)', async () => {
    // Persona sin documento: logros vacíos.
    let a = await getAchievements(store, 'p1');
    expect(a).toEqual({ citizenships: {}, badges: {} });
    // Registro de una ciudadanía con fecha: persiste y devuelve el fusionado.
    const patch = { citizenships: { frontend: { achievedAt: '2026-07-04T12:00:00.000Z' } }, badges: {} };
    a = await recordAchievements(store, 'p1', a, patch);
    expect(a.citizenships.frontend).toEqual({ achievedAt: '2026-07-04T12:00:00.000Z' });
    expect((await getAchievements(store, 'p1')).citizenships.frontend.achievedAt).toBe('2026-07-04T12:00:00.000Z');
    // Un parche que trae la misma isla NO pisa la fecha registrada (merge de solo-añadir).
    const again = { citizenships: { frontend: { achievedAt: '2030-01-01T00:00:00.000Z' } }, badges: { legend: { achievedAt: null } } };
    a = await recordAchievements(store, 'p1', a, again);
    expect(a.citizenships.frontend.achievedAt).toBe('2026-07-04T12:00:00.000Z');
    expect(a.badges.legend).toEqual({ achievedAt: null });
    const saved = await getAchievements(store, 'p1');
    expect(saved.citizenships.frontend.achievedAt).toBe('2026-07-04T12:00:00.000Z');
    expect(saved.badges.legend).toEqual({ achievedAt: null });
    // Parche null: no escribe nada y devuelve lo que había.
    expect(await recordAchievements(store, 'p1', a, null)).toBe(a);
  });

  it('el brujo: preguntar, responder y marcar vista recorren el ciclo completo (MC-22)', async () => {
    // Persona sin consultas: lista vacía y cabaña en reposo.
    expect(await listQuestions(store, 'p1')).toEqual([]);
    // El jugador deja una consulta: nace pending con fecha y autoría.
    const created = await askQuestion(store, 'p1', {
      islandId: 'island',
      islandName: 'Bases de software',
      text: '  ¿Por dónde empiezo con testing?  ',
      createdBy: { uid: 'u-eng', name: 'Ada' },
    });
    expect(created).toMatchObject({
      islandId: 'island',
      text: '¿Por dónde empiezo con testing?',
      status: 'pending',
      createdBy: { uid: 'u-eng', name: 'Ada' },
    });
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // El líder responde con ayuda de un compañero (creditedTo).
    await answerQuestion(store, 'p1', created.id, {
      answer: 'Empieza por un test que falle.',
      answeredBy: { uid: 'u-lead', name: 'Líder' },
      creditedTo: 'Grace',
    });
    let [q] = await listQuestions(store, 'p1');
    expect(q).toMatchObject({
      status: 'answered',
      answer: 'Empieza por un test que falle.',
      answeredBy: { uid: 'u-lead', name: 'Líder' },
      creditedTo: 'Grace',
    });
    expect(q.answeredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // El jugador la marca como vista: solo status+seenAt cambian.
    await markQuestionSeen(store, 'p1', created.id);
    [q] = await listQuestions(store, 'p1');
    expect(q.status).toBe('seen');
    expect(q.seenAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(q.answer).toBe('Empieza por un test que falle.'); // la Q&A queda en la ficha
  });

  it('el brujo valida la entrada y aísla por persona (MC-22)', async () => {
    await expect(askQuestion(store, 'p1', { islandId: 'island', text: '   ' })).rejects.toThrow();
    await expect(askQuestion(store, 'p1', { islandId: '', text: 'Hola' })).rejects.toThrow();
    const created = await askQuestion(store, 'p1', { islandId: 'island', text: 'Hola brujo' });
    // Sin login con uid no se registra autoría (degradación con gracia).
    expect(created.createdBy).toBeUndefined();
    await expect(answerQuestion(store, 'p1', created.id, { answer: '  ' })).rejects.toThrow();
    await expect(answerQuestion(store, 'p1', 'no-existe', { answer: 'X' })).rejects.toThrow();
    // Las consultas de p1 no aparecen en p2.
    expect(await listQuestions(store, 'p2')).toEqual([]);
  });

  it('las consultas del brujo se listan ordenadas por fecha descendente (MC-22)', async () => {
    // Se siembran directamente en el store con fechas controladas.
    await store.questions.ask('p1', { islandId: 'island', islandName: '', text: 'vieja', status: 'pending', createdAt: '2026-07-01T00:00:00.000Z' });
    await store.questions.ask('p1', { islandId: 'frontend', islandName: '', text: 'nueva', status: 'pending', createdAt: '2026-07-03T00:00:00.000Z' });
    const list = await listQuestions(store, 'p1');
    expect(list.map((x) => x.text)).toEqual(['nueva', 'vieja']);
  });

  it('el tiempo de juego arranca vacío y acumula incrementos por día y total (MC-23)', async () => {
    expect(await getPlaytime(store, 'p1')).toEqual({ totalMinutes: 0, byDay: {} });
    const now = new Date(2026, 6, 4, 18, 30);
    await recordPlaytime(store, 'p1', 1, now);
    await recordPlaytime(store, 'p1', 0.5, now);
    const pt = await getPlaytime(store, 'p1');
    expect(pt.totalMinutes).toBe(1.5);
    expect(pt.byDay[dayKey(now)]).toBe(1.5);
    // Aislado por persona.
    expect(await getPlaytime(store, 'p2')).toEqual({ totalMinutes: 0, byDay: {} });
  });

  it('recordPlaytime falla en alto con minutos no positivos o sin persona (MC-23)', async () => {
    await expect(recordPlaytime(store, 'p1', 0)).rejects.toThrow();
    await expect(recordPlaytime(store, 'p1', -2)).rejects.toThrow();
    await expect(recordPlaytime(store, 'p1', Number.NaN)).rejects.toThrow();
    await expect(recordPlaytime(store, '', 1)).rejects.toThrow();
  });

  it('prunePlaytime deja los últimos 30 días cuando el histórico supera el umbral (MC-23)', async () => {
    // 36 días consecutivos de 1 minuto (> pruneThreshold = 35).
    for (let i = 0; i < PLAYTIME.pruneThreshold + 1; i += 1) {
      await recordPlaytime(store, 'p1', 1, new Date(2026, 0, 1 + i, 12, 0));
    }
    let pt = await getPlaytime(store, 'p1');
    expect(Object.keys(pt.byDay)).toHaveLength(PLAYTIME.pruneThreshold + 1);
    const pruned = await prunePlaytime(store, 'p1', pt);
    expect(Object.keys(pruned.byDay)).toHaveLength(PLAYTIME.maxDays);
    expect(pruned.byDay['2026-01-01']).toBeUndefined(); // la más vieja fuera
    expect(pruned.totalMinutes).toBe(PLAYTIME.pruneThreshold + 1); // el total NO se poda
    // Y lo persistido coincide con lo devuelto.
    pt = await getPlaytime(store, 'p1');
    expect(pt.byDay).toEqual(pruned.byDay);
    // Con el histórico ya podado no vuelve a escribir: devuelve el mismo objeto.
    expect(await prunePlaytime(store, 'p1', pruned)).toBe(pruned);
  });
});
