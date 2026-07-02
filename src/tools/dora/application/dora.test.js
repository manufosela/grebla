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
  registerDeployment,
  listDeployments,
  removeDeployment,
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

  it('deploySignal: branch por defecto; updateRepoConfig acepta release y normaliza lo inválido', async () => {
    const id = await addRepo(p, { fullName: 'org/web', startDate: '2025-01-01' });
    expect((await listRepos(p))[0].deploySignal).toBe('branch');
    await updateRepoConfig(p, id, { deploySignal: 'release' });
    expect((await listRepos(p))[0].deploySignal).toBe('release');
    await updateRepoConfig(p, id, { deploySignal: 'loquesea' });
    expect((await listRepos(p))[0].deploySignal).toBe('branch');
  });
});

describe('DORA — eventos de despliegue real', () => {
  /** @type {ReturnType<typeof createMemoryDoraPersistence>} */
  let p;
  /** @type {string} */
  let repoId;
  beforeEach(async () => {
    p = createMemoryDoraPersistence();
    repoId = await addRepo(p, { fullName: 'org/web', startDate: '2025-01-01' });
  });

  it('registra un evento normalizado (at ISO, environment y sha por defecto)', async () => {
    const id = await registerDeployment(p, repoId, { at: '2025-01-10T09:30', status: 'success' });
    const events = await listDeployments(p, repoId);
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.id).toBe(id);
    expect(e.environment).toBe('production');
    expect(e.status).toBe('success');
    expect(e.sha).toBeNull();
    expect(e.at).toBe(new Date('2025-01-10T09:30').toISOString());
    expect(e.createdAt).toBeTruthy();
  });

  it('guarda createdBy solo si viene completo (uid + name)', async () => {
    const conAutor = await registerDeployment(p, repoId, {
      at: '2025-01-11T10:00:00Z', status: 'success', createdBy: { uid: 'u1', name: 'Ana' },
    });
    const sinAutor = await registerDeployment(p, repoId, {
      at: '2025-01-12T10:00:00Z', status: 'failed', createdBy: { uid: 'u1' },
    });
    const events = await listDeployments(p, repoId);
    expect(events.find((e) => e.id === conAutor).createdBy).toEqual({ uid: 'u1', name: 'Ana' });
    expect(events.find((e) => e.id === sinAutor).createdBy).toBeUndefined();
  });

  it('rechaza estados y fechas inválidos', () => {
    // La validación lanza de forma síncrona (igual que addRepo), antes de tocar
    // la persistencia; el try/catch de la UI la recoge igual bajo await.
    expect(() => registerDeployment(p, repoId, { at: '2025-01-10T09:00:00Z', status: 'ok' }))
      .toThrow(/success.*failed/i);
    expect(() => registerDeployment(p, repoId, { at: 'no-fecha', status: 'success' }))
      .toThrow(/fecha/i);
  });

  it('lista ordenada por at desc y permite borrar', async () => {
    await registerDeployment(p, repoId, { at: '2025-01-05T10:00:00Z', status: 'success' });
    const nuevo = await registerDeployment(p, repoId, { at: '2025-01-20T10:00:00Z', status: 'success' });
    let events = await listDeployments(p, repoId);
    expect(events.map((e) => e.at)).toEqual([
      new Date('2025-01-20T10:00:00Z').toISOString(),
      new Date('2025-01-05T10:00:00Z').toISOString(),
    ]);
    await removeDeployment(p, repoId, nuevo);
    events = await listDeployments(p, repoId);
    expect(events).toHaveLength(1);
    expect(events[0].at).toBe(new Date('2025-01-05T10:00:00Z').toISOString());
  });
});

describe('DORA — repos owner-scoped (multi-leader)', () => {
  it('add estampa ownerLeaderUid con el líder que crea el repo', async () => {
    const leader = createMemoryDoraPersistence([], { leaderUid: 'uid-ana' });
    const id = await addRepo(leader, { fullName: 'org/web', startDate: '2025-01-01' });
    const repo = (await leader.repos.list()).find((r) => r.id === id);
    expect(repo.ownerLeaderUid).toBe('uid-ana');
  });

  it('list del líder filtra por owner; viewAll (superadmin) los ve todos', async () => {
    // Cada líder tiene su propia vista (mismo store no aplica: son instancias
    // distintas); aquí simulamos un store compartido con el seed.
    const seed = [
      { id: 'r1', fullName: 'org/web', ownerLeaderUid: 'uid-ana', guilds: [], baseBranch: 'main', deploySignal: 'branch', startDate: null },
      { id: 'r2', fullName: 'org/api', ownerLeaderUid: 'uid-luis', guilds: [], baseBranch: 'main', deploySignal: 'branch', startDate: null },
      { id: 'r3', fullName: 'org/legacy', guilds: [], baseBranch: 'main', deploySignal: 'branch', startDate: null },
    ];
    const ana = createMemoryDoraPersistence(seed, { leaderUid: 'uid-ana' });
    const superadmin = createMemoryDoraPersistence(seed, { leaderUid: 'uid-ana', viewAll: true });

    // El líder solo ve los suyos (no los de otro líder ni los legacy sin owner).
    expect((await listRepos(ana)).map((r) => r.fullName)).toEqual(['org/web']);
    // El superadmin (viewAll) ve todos, incluidos los legacy sin ownerLeaderUid.
    expect((await listRepos(superadmin)).map((r) => r.fullName)).toEqual(['org/api', 'org/legacy', 'org/web']);
  });

  it('sin leaderUid la lista es plana (compatibilidad con los tests existentes)', async () => {
    const flat = createMemoryDoraPersistence();
    await addRepo(flat, { fullName: 'org/web', startDate: '2025-01-01' });
    const repo = (await flat.repos.list())[0];
    expect(repo.ownerLeaderUid).toBeUndefined();
    expect((await listRepos(flat)).map((r) => r.fullName)).toEqual(['org/web']);
  });
});
