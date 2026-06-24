import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDoraPersistence } from '../infrastructure/memory/index.js';
import {
  addRepo,
  listRepos,
  updateRepo,
  removeRepo,
  listTeams,
  listGuilds,
  getDoraSummary,
  updateRepoConfig,
} from './usecases.js';

describe('DORA — configuración de repos', () => {
  /** @type {ReturnType<typeof createMemoryDoraPersistence>} */
  let p;
  beforeEach(() => {
    p = createMemoryDoraPersistence();
  });

  it('addRepo valida el formato owner/repo; la fecha es opcional', async () => {
    expect(() => addRepo(p, { fullName: 'sin-barra' })).toThrow(/owner\/repo/i);
    await addRepo(p, { fullName: 'org/repo' }); // sin fecha → ok
    expect((await listRepos(p))[0].startDate).toBeNull();
  });

  it('crea y lista repos ordenados, con equipo y gremios normalizados', async () => {
    await addRepo(p, { fullName: 'org/web', team: ' Plataforma ', guilds: [' Frontend ', ''], startDate: '2025-01-01' });
    await addRepo(p, { fullName: 'org/api', team: 'Pagos', guilds: ['Backend'], startDate: '2025-02-01' });
    const repos = await listRepos(p);
    expect(repos.map((r) => r.fullName)).toEqual(['org/api', 'org/web']);
    const web = repos.find((r) => r.fullName === 'org/web');
    expect(web.team).toBe('Plataforma');
    expect(web.guilds).toEqual(['Frontend']);
  });

  it('listTeams y listGuilds derivan los catálogos vivos (distinct)', async () => {
    await addRepo(p, { fullName: 'org/web', team: 'Plataforma', guilds: ['Frontend'], startDate: '2025-01-01' });
    await addRepo(p, { fullName: 'org/api', team: 'Pagos', guilds: ['Backend', 'Frontend'], startDate: '2025-01-01' });
    expect(await listTeams(p)).toEqual(['Pagos', 'Plataforma']);
    expect(await listGuilds(p)).toEqual(['Backend', 'Frontend']);
  });

  it('getDoraSummary agrega global, por equipo y por gremio', async () => {
    const a = await addRepo(p, { fullName: 'org/a', team: 'Plataforma', guilds: ['Frontend'], startDate: '2025-01-01' });
    await addRepo(p, { fullName: 'org/b', team: 'Plataforma', guilds: ['Backend'], startDate: '2025-01-01' });
    // simula métricas calculadas en un repo
    await updateRepo(p, a, { metrics: { deployments: 10, deployFrequencyPerWeek: 2.5, leadTimeHoursAvg: 10 } });
    const s = await getDoraSummary(p);
    expect(s.global.measured).toBe(1);
    expect(s.global.deployments).toBe(10);
    expect(s.byTeam.find((g) => g.key === 'Plataforma').deployments).toBe(10);
    expect(s.byGuild.map((g) => g.key)).toContain('Frontend');
  });

  it('actualiza y elimina', async () => {
    const id = await addRepo(p, { fullName: 'org/web', startDate: '2025-01-01' });
    await updateRepo(p, id, { team: 'Plataforma' });
    expect((await listRepos(p))[0].team).toBe('Plataforma');
    await removeRepo(p, id);
    expect(await listRepos(p)).toEqual([]);
  });

  it('updateRepoConfig asigna equipo/gremios a posteriori, normalizados', async () => {
    // Alta sin clasificación (solo el repo), como en el flujo real.
    const id = await addRepo(p, { fullName: 'org/web', startDate: '2025-01-01' });
    expect((await listRepos(p))[0].team).toBeNull();
    // Asignación a posteriori, con espacios, vacíos y duplicados a normalizar.
    await updateRepoConfig(p, id, { team: '  Plataforma  ', guilds: [' Frontend ', '', 'Frontend', 'Backend'] });
    const repo = (await listRepos(p))[0];
    expect(repo.team).toBe('Plataforma');
    expect(repo.guilds).toEqual(['Frontend', 'Backend']);
    // Ya aparece en los catálogos vivos y en el agregado por equipo/gremio.
    expect(await listTeams(p)).toEqual(['Plataforma']);
    expect(await listGuilds(p)).toEqual(['Backend', 'Frontend']);
  });

  it('updateRepoConfig con equipo vacío deja el repo en (sin equipo)', async () => {
    const id = await addRepo(p, { fullName: 'org/web', team: 'Plataforma', startDate: '2025-01-01' });
    await updateRepoConfig(p, id, { team: '   ', guilds: [] });
    const repo = (await listRepos(p))[0];
    expect(repo.team).toBeNull();
    expect(repo.guilds).toEqual([]);
    const s = await getDoraSummary(p);
    expect(s.byTeam.map((g) => g.key)).toContain('(sin equipo)');
  });

  it('baseBranch: main por defecto en el alta; updateRepoConfig la cambia normalizada', async () => {
    const id = await addRepo(p, { fullName: 'org/web', startDate: '2025-01-01' });
    expect((await listRepos(p))[0].baseBranch).toBe('main');
    await updateRepoConfig(p, id, { baseBranch: '  develop  ' });
    expect((await listRepos(p))[0].baseBranch).toBe('develop');
    // rama vacía → vuelve al default 'main'
    await updateRepoConfig(p, id, { baseBranch: '' });
    expect((await listRepos(p))[0].baseBranch).toBe('main');
  });
});
