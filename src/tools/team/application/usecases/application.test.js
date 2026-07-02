import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryPersistence } from '../../infrastructure/memory/index.js';
import {
  addPerson,
  listActivePeople,
  listDepartedPeople,
  deactivatePerson,
  getTurnover,
  normalizePerson,
  addGuild,
  listGuilds,
  removeGuild,
  addArea,
  getSettings,
  updateSettings,
  addReading,
  getPersonTimeline,
  registerConversation,
  addSupportNote,
  listSupportNotes,
  listConversations,
  getTeamCoverage,
  getBusFactor,
  getSilenceAlerts,
  getTeamHealth,
  getDiagnosis,
  exportAggregate,
  getTeamMap,
} from './index.js';

const NOW = '2026-06-07T00:00:00.000Z';

/** Monta un equipo de prueba y devuelve ids. */
async function seedTeam(p) {
  const ana = await addPerson(p, { name: 'Ana', guilds: ['Backend'], startDate: '2025-01-01' });
  const beto = await addPerson(p, { name: 'Beto', guilds: ['Frontend'], startDate: '2025-01-01' });
  const caro = await addPerson(p, { name: 'Caro', guilds: ['QA'], startDate: '2025-01-01', active: false });
  const pagos = await addArea(p, 'Pagos');
  const auth = await addArea(p, 'Auth');

  await addReading(p, 'knowledge', ana, { areaId: pagos, level: 5, date: '2026-05-01' });
  await addReading(p, 'knowledge', beto, { areaId: pagos, level: 3, date: '2026-05-01' });
  await addReading(p, 'knowledge', ana, { areaId: auth, level: 4, date: '2026-05-01' });

  await addReading(p, 'seniority', ana, { level: 5, date: '2026-05-01' });
  await addReading(p, 'seniority', beto, { level: 3, date: '2026-05-01' });

  await addReading(p, 'contribution', ana, { roles: { PL: 'primary', CO: 'secondary' }, date: '2026-05-01' });
  await addReading(p, 'contribution', beto, { roles: { SH: 'primary' }, date: '2026-05-01' });
  await addReading(p, 'contribution', caro, { roles: { PL: 'primary' }, date: '2026-05-01' }); // inactiva

  await registerConversation(p, ana, { type: 'o2o', date: '2026-06-01', notes: 'ok' });
  await registerConversation(p, beto, { type: 'o2o', date: '2026-01-01', notes: 'hace tiempo' });

  return { ana, beto, caro, pagos, auth };
}

describe('Fase 2b — casos de uso', () => {
  /** @type {ReturnType<typeof createMemoryPersistence>} */
  let p;
  let ids;
  beforeEach(async () => {
    p = createMemoryPersistence();
    ids = await seedTeam(p);
  });

  it('listActivePeople excluye inactivos', async () => {
    const active = await listActivePeople(p);
    expect(active.map((x) => x.name).sort()).toEqual(['Ana', 'Beto']);
  });

  it('addPerson guarda varios gremios y se normalizan al listar', async () => {
    await addPerson(p, { name: 'Zoe', guilds: ['Backend', 'Android'], startDate: '2025-02-01' });
    const zoe = (await listActivePeople(p)).find((x) => x.name === 'Zoe');
    expect(zoe.guilds).toEqual(['Backend', 'Android']);
  });

  it('addPerson normaliza el githubLogin (trim; vacío → null)', async () => {
    await addPerson(p, { name: 'Gita', guilds: [], startDate: '2025-01-01', githubLogin: '  gita-dev  ' });
    await addPerson(p, { name: 'NoGit', guilds: [], startDate: '2025-01-01', githubLogin: '   ' });
    const people = await listActivePeople(p);
    expect(people.find((x) => x.name === 'Gita').githubLogin).toBe('gita-dev');
    expect(people.find((x) => x.name === 'NoGit').githubLogin).toBeNull();
  });

  it('normalizePerson garantiza guilds como array', () => {
    expect(normalizePerson({ guilds: ['A', 'B'] }).guilds).toEqual(['A', 'B']);
    expect(normalizePerson({}).guilds).toEqual([]);
  });

  it('catálogo de gremios: add / list / remove', async () => {
    const id = await addGuild(p, 'Backend');
    expect((await listGuilds(p)).map((r) => r.name)).toEqual(['Backend']);
    await removeGuild(p, id);
    expect(await listGuilds(p)).toEqual([]);
    expect(() => addGuild(p, '   ')).toThrow();
  });

  it('deactivatePerson sella fecha, mueve a Bajas (no borra) y cuenta en rotación', async () => {
    const fresh = createMemoryPersistence();
    await addPerson(fresh, { name: 'Keep', guilds: [], startDate: '2025-01-01' });
    const gone = await addPerson(fresh, { name: 'Gone', guilds: [], startDate: '2025-01-01' });
    await deactivatePerson(fresh, gone);

    expect((await listActivePeople(fresh)).map((x) => x.name)).toEqual(['Keep']);
    const departed = await listDepartedPeople(fresh);
    expect(departed.map((x) => x.name)).toEqual(['Gone']);
    expect(departed[0].deactivatedAt).toBeTruthy();

    const t = await getTurnover(fresh, { from: '2025-01-01', to: '2100-01-01' });
    expect(t.hires).toBe(2);
    expect(t.departures).toBe(1);
  });

  it('addReading rechaza dimensión inválida', () => {
    expect(() => addReading(p, 'nope', ids.ana, {})).toThrow(/Dimensión desconocida/);
  });

  it('getPersonTimeline añade valor numérico en seniority (tránsito = N+0.5)', async () => {
    await addReading(p, 'seniority', ids.ana, { level: 5, toNext: true, date: '2026-06-01' });
    const t = await getPersonTimeline(p, ids.ana);
    expect(t.seniority.at(-1).value).toBe(5.5);
    expect(t.knowledge).toHaveLength(2); // dos áreas
  });

  it('getTeamCoverage suma 1.0 primario / 0.5 secundario y excluye inactivos (R3)', async () => {
    const { coverage } = await getTeamCoverage(p);
    const byRole = Object.fromEntries(coverage.map((c) => [c.sigla, c.score]));
    expect(byRole.PL).toBe(1.0); // solo Ana (Caro inactiva no cuenta)
    expect(byRole.CO).toBe(0.5);
    expect(byRole.SH).toBe(1.0);
    expect(byRole.ME).toBe(0);
  });

  it('getBusFactor: área con 2 cubiertas no es riesgo; con 1 sí', async () => {
    const bf = await getBusFactor(p);
    const pagos = bf.find((a) => a.areaId === ids.pagos);
    const auth = bf.find((a) => a.areaId === ids.auth);
    expect(pagos).toMatchObject({ count: 2, atRisk: false });
    expect(auth).toMatchObject({ count: 1, atRisk: true });
  });

  it('getSilenceAlerts marca a quien supera la cadencia', async () => {
    const alerts = await getSilenceAlerts(p, NOW);
    expect(alerts.map((a) => a.personId)).toContain(ids.beto);
    expect(alerts.map((a) => a.personId)).not.toContain(ids.ana);
  });

  it('getTeamHealth agrega sin promediar dimensiones (R1)', async () => {
    const h = await getTeamHealth(p, NOW);
    expect(h.teamSize).toBe(2);
    expect(h).not.toHaveProperty('globalLevel');
    expect(h.busFactorOneCount).toBe(1); // Auth
    expect(h.silenceCount).toBe(1);
  });

  it('getDiagnosis produce score y gaps (Auth con bus factor 1 es crítico)', async () => {
    const d = await getDiagnosis(p, NOW);
    expect(d.healthScore).toBeGreaterThanOrEqual(0);
    expect(d.healthScore).toBeLessThanOrEqual(100);
    expect(d.gaps.length).toBeGreaterThan(0);
    expect(d.counts.critical).toBeGreaterThanOrEqual(1); // Auth lo cubre solo Ana
  });

  it('getTeamMap reúne el estado actual de las 4 dimensiones por persona', async () => {
    const fresh = createMemoryPersistence();
    const id = await addPerson(fresh, { name: 'Ana', guilds: ['Backend'], startDate: '2025-01-01' });
    const pagos = await addArea(fresh, 'Pagos');
    await addReading(fresh, 'seniority', id, { level: 4, date: '2025-05-01' });
    await addReading(fresh, 'seniority', id, { level: 5, toNext: true, date: '2025-06-01' }); // más reciente
    await addReading(fresh, 'emotional', id, { level: 6, date: '2025-05-01' });
    await addReading(fresh, 'knowledge', id, { areaId: pagos, level: 6, date: '2025-05-01' });
    await addReading(fresh, 'contribution', id, { roles: { PL: 'primary', CO: 'secondary' }, date: '2025-05-01' });

    const [row] = await getTeamMap(fresh);
    expect(row.name).toBe('Ana');
    expect(row.seniority).toEqual({ level: 5, toNext: true }); // la última
    expect(row.emotional.level).toBe(6);
    expect(row.knowledge.areas).toEqual([{ areaId: pagos, level: 6, toNext: false }]);
    expect(row.knowledge.profile.shape).toBe('I'); // 1 área sólida
    expect(row.contribution).toEqual({ PL: 'primary', CO: 'secondary' });
  });

  it('configuración: getSettings devuelve defaults; updateSettings valida y guarda', async () => {
    const fresh = createMemoryPersistence();
    expect((await getSettings(fresh)).cadenceDays).toBeGreaterThan(0);
    await updateSettings(fresh, { cadenceDays: 45, busFactorMinLevel: 4 });
    const s = await getSettings(fresh);
    expect(s.cadenceDays).toBe(45);
    expect(s.busFactorMinLevel).toBe(4);
    expect(() => updateSettings(fresh, { cadenceDays: 0 })).toThrow();
    expect(() => updateSettings(fresh, { busFactorMinLevel: 9 })).toThrow();
  });

  it('exportAggregate (R6) no incluye datos individuales ni support notes', async () => {
    await addSupportNote(p, ids.ana, 'tema personal sensible');
    const out = await exportAggregate(p, NOW);
    expect(out).toHaveProperty('generatedAt');
    expect(out).toHaveProperty('silenceCount');
    expect(out).not.toHaveProperty('silence'); // sin lista nominal
    const json = JSON.stringify(out);
    expect(json).not.toContain(ids.ana); // sin personIds
    expect(json).not.toContain('tema personal sensible'); // R5 nunca se exporta
  });

  it('registra la autoría del login en notas y conversaciones (RMR-TSK-0109)', async () => {
    const author = { uid: 'u1', name: 'Ada Lovelace' };
    await addSupportNote(p, ids.ana, 'con autor', author);
    const notes = await listSupportNotes(p, ids.ana);
    expect(notes.at(-1).createdBy).toEqual(author);

    await registerConversation(p, ids.ana, {
      type: 'o2o',
      date: '2026-07-01',
      notes: 'con autor',
      createdBy: author,
    });
    const convs = await listConversations(p, ids.ana);
    expect(convs.at(-1).createdBy).toEqual(author);
  });
});
