import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDoraPersistence } from '../infrastructure/memory/index.js';
import { addRepo, listRepos, updateRepo, removeRepo, listTeams, listGuilds } from './usecases.js';

describe('DORA — configuración de repos', () => {
  /** @type {ReturnType<typeof createMemoryDoraPersistence>} */
  let p;
  beforeEach(() => {
    p = createMemoryDoraPersistence();
  });

  it('addRepo valida el formato owner/repo y la fecha', () => {
    expect(() => addRepo(p, { fullName: 'sin-barra', startDate: '2025-01-01' })).toThrow(/owner\/repo/i);
    expect(() => addRepo(p, { fullName: 'org/repo' })).toThrow(/fecha/i);
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

  it('actualiza y elimina', async () => {
    const id = await addRepo(p, { fullName: 'org/web', startDate: '2025-01-01' });
    await updateRepo(p, id, { team: 'Plataforma' });
    expect((await listRepos(p))[0].team).toBe('Plataforma');
    await removeRepo(p, id);
    expect(await listRepos(p)).toEqual([]);
  });
});
