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
  registerIncident,
  listIncidents,
  resolveIncident,
  removeIncident,
  normalizeDeploySignal,
  normalizeTagPattern,
  DEPLOY_SIGNALS,
} from './usecases.js';

describe('DORA — taxonomía de señal de despliegue', () => {
  /** @type {ReturnType<typeof createMemoryDoraPersistence>} */
  let p;
  beforeEach(() => {
    p = createMemoryDoraPersistence();
  });

  it('DEPLOY_SIGNALS cubre el modelo real (branch/release/tag/manual)', () => {
    expect([...DEPLOY_SIGNALS]).toEqual(['branch', 'release', 'tag', 'manual']);
  });

  it('normalizeDeploySignal acepta los válidos y cae a branch en lo demás', () => {
    expect(normalizeDeploySignal('release')).toBe('release');
    expect(normalizeDeploySignal('tag')).toBe('tag');
    expect(normalizeDeploySignal('manual')).toBe('manual');
    expect(normalizeDeploySignal('branch')).toBe('branch');
    expect(normalizeDeploySignal('cualquiera')).toBe('branch');
    expect(normalizeDeploySignal(undefined)).toBe('branch');
  });

  it('normalizeTagPattern recorta, admite vacío y rechaza regex inválida', () => {
    expect(normalizeTagPattern('  ^prod-  ')).toBe('^prod-');
    expect(normalizeTagPattern('')).toBe('');
    expect(normalizeTagPattern(undefined)).toBe('');
    expect(() => normalizeTagPattern('[')).toThrow(/inválido/i);
  });

  it('addRepo persiste deploySignal y tagPattern normalizados', async () => {
    await addRepo(p, { fullName: 'org/infra', deploySignal: 'tag', tagPattern: ' ^prod- ' });
    const repo = (await listRepos(p))[0];
    expect(repo.deploySignal).toBe('tag');
    expect(repo.tagPattern).toBe('^prod-');
  });

  it('updateRepoConfig cambia la señal a manual', async () => {
    const id = await addRepo(p, { fullName: 'org/mobile' });
    await updateRepoConfig(p, id, { deploySignal: 'manual' });
    expect((await listRepos(p))[0].deploySignal).toBe('manual');
  });
});

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

describe('DORA — incidentes (MTTR)', () => {
  /** @type {ReturnType<typeof createMemoryDoraPersistence>} */
  let p;
  /** @type {string} */
  let repoId;
  beforeEach(async () => {
    p = createMemoryDoraPersistence();
    repoId = await addRepo(p, { fullName: 'org/web', startDate: '2025-01-01' });
  });

  it('registra un incidente abierto (restoredAt null) normalizado', async () => {
    const id = await registerIncident(p, repoId, { startedAt: '2025-01-10T09:30', note: '  caída API  ' });
    const incidents = await listIncidents(p, repoId);
    expect(incidents).toHaveLength(1);
    const i = incidents[0];
    expect(i.id).toBe(id);
    expect(i.startedAt).toBe(new Date('2025-01-10T09:30').toISOString());
    expect(i.restoredAt).toBeNull();
    expect(i.note).toBe('caída API');
    expect(i.createdAt).toBeTruthy();
  });

  it('registra un incidente ya resuelto y enlazado a un despliegue', async () => {
    const id = await registerIncident(p, repoId, {
      startedAt: '2025-01-10T09:00',
      restoredAt: '2025-01-10T11:00',
      deploymentId: 'dep-123',
    });
    const i = (await listIncidents(p, repoId)).find((x) => x.id === id);
    expect(i.restoredAt).toBe(new Date('2025-01-10T11:00').toISOString());
    expect(i.deploymentId).toBe('dep-123');
  });

  it('guarda createdBy solo si viene completo (uid + name)', async () => {
    const conAutor = await registerIncident(p, repoId, {
      startedAt: '2025-01-10T09:00', createdBy: { uid: 'u1', name: 'Ana' },
    });
    const sinAutor = await registerIncident(p, repoId, {
      startedAt: '2025-01-11T09:00', createdBy: { uid: 'u1' },
    });
    const incidents = await listIncidents(p, repoId);
    expect(incidents.find((i) => i.id === conAutor).createdBy).toEqual({ uid: 'u1', name: 'Ana' });
    expect(incidents.find((i) => i.id === sinAutor).createdBy).toBeUndefined();
  });

  it('rechaza fechas inválidas (startedAt y restoredAt)', () => {
    expect(() => registerIncident(p, repoId, { startedAt: 'no-fecha' })).toThrow(/inicio.*ISO/i);
    expect(() => registerIncident(p, repoId, { startedAt: '2025-01-10T09:00', restoredAt: 'no-fecha' }))
      .toThrow(/restauración.*ISO/i);
  });

  it('resolveIncident marca un incidente abierto como resuelto', async () => {
    const id = await registerIncident(p, repoId, { startedAt: '2025-01-10T09:00' });
    expect((await listIncidents(p, repoId))[0].restoredAt).toBeNull();
    await resolveIncident(p, repoId, id, '2025-01-10T12:00');
    expect((await listIncidents(p, repoId))[0].restoredAt).toBe(new Date('2025-01-10T12:00').toISOString());
  });

  it('resolveIncident rechaza fecha inválida (validación síncrona)', async () => {
    const id = await registerIncident(p, repoId, { startedAt: '2025-01-10T09:00' });
    expect(() => resolveIncident(p, repoId, id, 'no-fecha')).toThrow(/restauración.*ISO/i);
  });

  it('lista ordenada por startedAt desc y permite borrar', async () => {
    await registerIncident(p, repoId, { startedAt: '2025-01-05T09:00' });
    const nuevo = await registerIncident(p, repoId, { startedAt: '2025-01-20T09:00' });
    let incidents = await listIncidents(p, repoId);
    expect(incidents.map((i) => i.startedAt)).toEqual([
      new Date('2025-01-20T09:00').toISOString(),
      new Date('2025-01-05T09:00').toISOString(),
    ]);
    await removeIncident(p, repoId, nuevo);
    incidents = await listIncidents(p, repoId);
    expect(incidents).toHaveLength(1);
    expect(incidents[0].startedAt).toBe(new Date('2025-01-05T09:00').toISOString());
  });
});

describe('DORA — repos owner-scoped (multi-leader)', () => {
  it('add estampa ownerLeaderUid con el líder que crea el repo', async () => {
    const leader = createMemoryDoraPersistence([], { leaderUid: 'uid-ana' });
    const id = await addRepo(leader, { fullName: 'org/web', startDate: '2025-01-01' });
    const repo = (await leader.repos.list()).find((r) => r.id === id);
    expect(repo.ownerLeaderUid).toBe('uid-ana');
  });

  it('list del líder ve globales + propios (no los de otro líder); viewAll ve todos', async () => {
    // Ámbito personal/global (como guilds/labels): el líder ve los globales (sin
    // owner, del superadmin) y los suyos, nunca los personales de otro líder.
    const seed = [
      { id: 'r1', fullName: 'org/web', ownerLeaderUid: 'uid-ana', guilds: [], baseBranch: 'main', deploySignal: 'branch', startDate: null },
      { id: 'r2', fullName: 'org/api', ownerLeaderUid: 'uid-luis', guilds: [], baseBranch: 'main', deploySignal: 'branch', startDate: null },
      { id: 'r3', fullName: 'org/legacy', guilds: [], baseBranch: 'main', deploySignal: 'branch', startDate: null },
    ];
    const ana = createMemoryDoraPersistence(seed, { leaderUid: 'uid-ana' });
    const superadmin = createMemoryDoraPersistence(seed, { leaderUid: 'uid-ana', viewAll: true });

    // Ana ve el global (legacy, sin owner) + el suyo (web), NO el de Luis (api).
    expect((await listRepos(ana)).map((r) => r.fullName)).toEqual(['org/legacy', 'org/web']);
    // El superadmin (viewAll) ve todos.
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
