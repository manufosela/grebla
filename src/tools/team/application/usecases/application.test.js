import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryPersistence } from '../../infrastructure/memory/index.js';
import {
  addPerson,
  listActivePeople,
  addArea,
  addReading,
  getPersonTimeline,
  registerConversation,
  addSupportNote,
  getTeamCoverage,
  getBusFactor,
  getSilenceAlerts,
  getTeamHealth,
  exportAggregate,
} from './index.js';

const NOW = '2026-06-07T00:00:00.000Z';

/** Monta un equipo de prueba y devuelve ids. */
async function seedTeam(p) {
  const ana = await addPerson(p, { name: 'Ana', teamRole: 'Backend', startDate: '2025-01-01' });
  const beto = await addPerson(p, { name: 'Beto', teamRole: 'Frontend', startDate: '2025-01-01' });
  const caro = await addPerson(p, { name: 'Caro', teamRole: 'QA', startDate: '2025-01-01', active: false });
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
});
