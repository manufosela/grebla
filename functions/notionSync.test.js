import { describe, expect, it } from 'vitest';
import { directoryFromPages, runNotionSync } from './notionSync.js';
import { notionPage } from './notionPeople.fixtures.js';

/** Página con las propiedades que el módulo vendorizado no lee (Join Date). */
const page = (id, name, email, status = 'Active', joinDate = null, managerId = null) => {
  const p = notionPage(id, name, { email, department: 'Tech' }, status, managerId);
  p.properties['Join Date'] = { date: joinDate ? { start: joinDate } : null };
  return p;
};

/** Firestore en memoria: lo justo que usa runNotionSync. */
function fakeDb(collections) {
  const writes = [];
  let seq = 0;
  const docs = (name) => Object.entries(collections[name] ?? {}).map(([id, data]) => ({ id, data: () => data }));
  return {
    writes,
    collection: (name) => ({ get: async () => ({ docs: docs(name) }), doc: () => ({ id: `nuevo${++seq}` }) }),
    doc: (path) => ({ path }),
    batch: () => {
      const ops = [];
      return {
        set: (ref, data) => ops.push({ op: 'set', path: ref.path, data }),
        update: (ref, data) => ops.push({ op: 'update', path: ref.path, data }),
        commit: async () => { writes.push(...ops); },
      };
    },
  };
}
const fakeAuth = (emails) => ({ getUsers: async (ids) => ({ users: ids.filter((i) => emails[i.uid]).map((i) => ({ uid: i.uid, email: emails[i.uid] })) }) });
const fetchPages = (pages) => async () => pages;
const now = new Date('2026-10-03T08:00:00Z');

describe('directoryFromPages', () => {
  it('añade al mapeo vendorizado el Status y la Join Date, y deja fuera a los Inactive', () => {
    const dir = directoryFromPages([page('a-1', 'Ana', 'ana@example.com', 'Active', '2024-01-15'), page('b-2', 'Baja', 'b@example.com', 'Inactive')]);
    expect(dir).toEqual([expect.objectContaining({ id: 'a1', name: 'Ana', status: 'Active', joinDate: '2024-01-15' })]);
  });
});

describe('runNotionSync', () => {
  const setup = () => fakeDb({
    people: { p1: { name: 'Ana', active: true, uid: 'u1' } },
    orgBranches: { engineering: { label: 'Tech' } },
  });

  it('en seco: informa y no toca /people, pero guarda el informe', async () => {
    const db = setup();
    const report = await runNotionSync({ db, auth: fakeAuth({ u1: 'ana@example.com' }), fetchPages: fetchPages([page('a-1', 'Ana Pérez', 'ana@example.com')]), apply: false, now });
    expect(report).toMatchObject({ at: '2026-10-03T08:00:00.000Z', applied: false, errors: [], counts: { updates: 1, creates: 0 } });
    expect(report.updates[0]).toEqual({
      personId: 'p1', name: 'Ana Pérez', fields: ['name', 'external', 'notion', 'orgBranch'],
      changes: { name: { from: 'Ana', to: 'Ana Pérez' }, external: { from: null, to: false }, orgBranch: { from: null, to: 'engineering' } },
    });
    expect(db.writes.map((w) => w.path)).toEqual(['config/notionSync']);
  });

  it('aplicando: actualiza, crea y guarda el informe', async () => {
    const db = setup();
    const pages = [page('a-1', 'Ana Pérez', 'ana@example.com'), page('b-2', 'Bea Nueva', 'bea@example.com')];
    const report = await runNotionSync({ db, auth: fakeAuth({ u1: 'ana@example.com' }), fetchPages: fetchPages(pages), apply: true, now });
    expect(report.applied).toBe(true);
    expect(db.writes.map((w) => `${w.op} ${w.path}`)).toEqual(['update people/p1', 'set people/nuevo1', 'set config/notionSync']);
    expect(db.writes[1].data).toMatchObject({ name: 'Bea Nueva', pendingEmail: 'bea@example.com', startDate: '2026-10-03' });
  });

  it('con errores en el plan no escribe ninguna ficha aunque se pida aplicar', async () => {
    const db = setup();
    const pages = [page('a-1', 'Ana', 'ana@example.com'), page('b-2', 'Otra', 'ANA@example.com')];
    const report = await runNotionSync({ db, auth: fakeAuth({}), fetchPages: fetchPages(pages), apply: true, now });
    expect(report.applied).toBe(false);
    expect(report.errors).toEqual(['email repetido en Notion: ana@example.com']);
    expect(db.writes.map((w) => w.path)).toEqual(['config/notionSync']);
  });
});
