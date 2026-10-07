import { describe, it, expect } from 'vitest';
import {
  INGEST_TYPES, bearerFrom, normalizeIngest,
  conversationIdFor, o2oSessionFrom, personIsInScope,
  generateAgentKey, agentKeyId, agentKeyVerdict, agentTeamView,
} from './agentIngest.js';

describe('agentTeamView: lo único que el agente sabe del equipo (RMR-TSK-0657)', () => {
  const emails = new Map([['u-ana', 'ana@e2e.test']]);
  it('nombre y correo de quien está activa y es de la organización, por nombre', () => {
    const people = [
      { name: 'Zoe', email: 'Zoe@E2E.test', levelId: 'l3', notes: 'privado' },
      { name: 'Ana', uid: 'u-ana' },
      { name: 'Pablo', pendingEmail: 'pablo@e2e.test' },
    ];
    expect(agentTeamView(people, emails)).toEqual([
      { name: 'Ana', email: 'ana@e2e.test' },
      { name: 'Pablo', email: 'pablo@e2e.test' },
      { name: 'Zoe', email: 'zoe@e2e.test' },
    ]);
  });
  it('fuera: dadas de baja, externas y sin correo conocido', () => {
    const people = [
      { name: 'Baja', email: 'baja@e2e.test', active: false },
      { name: 'Externa', email: 'externa@e2e.test', external: true },
      { name: 'Sin correo', uid: 'u-nadie' },
    ];
    expect(agentTeamView(people, emails)).toEqual([]);
  });
});

describe('una clave por agente, atada a su manager (RMR-TSK-0650)', () => {
  it('cada clave nueva es distinta, larga y reconocible', () => {
    const a = generateAgentKey();
    expect(a).toMatch(/^gk_[A-Za-z0-9_-]{43}$/);
    expect(generateAgentKey()).not.toBe(a);
  });

  it('en GREBLA se guarda la huella, no la clave', () => {
    expect(agentKeyId('gk_abc')).toMatch(/^[0-9a-f]{64}$/);
    expect(agentKeyId('gk_abc')).toBe(agentKeyId('gk_abc'));
    expect(agentKeyId('gk_abd')).not.toBe(agentKeyId('gk_abc'));
  });

  const key = { active: true, managerUid: 'u-manu', managerEmail: 'manu@ejemplo.test' };

  it('una clave activa escribe en los O2O de SU manager', () => {
    expect(agentKeyVerdict(key, null)).toEqual({ ok: true, managerUid: 'u-manu' });
    expect(agentKeyVerdict(key, 'MANU@ejemplo.test')).toEqual({ ok: true, managerUid: 'u-manu' });
  });

  it('no hay cruce: si el envío dice otro manager, se rechaza', () => {
    expect(agentKeyVerdict(key, 'otra@ejemplo.test')).toEqual({ ok: false, status: 403, error: 'manager_mismatch' });
  });

  it('sin clave o con una clave retirada, no se entra', () => {
    expect(agentKeyVerdict(null, null)).toEqual({ ok: false, status: 401, error: 'unauthorized' });
    expect(agentKeyVerdict({ ...key, active: false }, null)).toEqual({ ok: false, status: 401, error: 'unauthorized' });
  });
});

/**
 * Ingesta de notas de 1-1 desde un agente externo (RMR-TSK-0549). Lo puro: qué
 * se acepta, qué id le toca a cada nota y qué documento acaba en la ficha.
 */
const nota = {
  email: ' Ana@Ejemplo.test ',
  type: 'o2o',
  date: '2026-09-22',
  notes: '  Hablamos de su paso a L2  ',
  summary: 'Acuerda preparar el diseño del servicio',
  source: { system: 'matias', id: 'thread-abc', url: 'https://mail.google.com/x/thread-abc' },
};

describe('bearerFrom', () => {
  it('saca la clave del header Authorization', () => {
    expect(bearerFrom('Bearer abc123')).toBe('abc123');
    expect(bearerFrom('bearer abc123')).toBe('abc123');
    expect(bearerFrom('Basic abc123')).toBe('');
    expect(bearerFrom(undefined)).toBe('');
  });
});

describe('normalizeIngest', () => {
  it('normaliza el email, recorta los textos y conserva el origen', () => {
    const limpia = normalizeIngest(nota);
    expect(limpia.email).toBe('ana@ejemplo.test');
    expect(limpia.notes).toBe('Hablamos de su paso a L2');
    expect(limpia.type).toBe('o2o');
    expect(limpia.source).toEqual({ system: 'matias', id: 'thread-abc', url: 'https://mail.google.com/x/thread-abc' });
  });

  it('solo acepta 1-1 y catchup: el resto de reuniones no viaja a la ficha', () => {
    expect(INGEST_TYPES).toEqual(['o2o', 'catchup']);
    expect(normalizeIngest({ ...nota, type: 'catchup' }).type).toBe('catchup');
    expect(() => normalizeIngest({ ...nota, type: 'planning' })).toThrow(/type/);
  });

  it('exige email, fecha, origen con sistema e id, y algo escrito', () => {
    expect(() => normalizeIngest({ ...nota, email: 'no-es-un-email' })).toThrow(/email/);
    expect(() => normalizeIngest({ ...nota, date: '22-09-2026' })).toThrow(/date/);
    // Y un día que no existe tampoco pasa: la forma no basta.
    expect(() => normalizeIngest({ ...nota, date: '2026-02-30' })).toThrow(/date/);
    expect(() => normalizeIngest({ ...nota, date: '2026-99-99' })).toThrow(/date/);
    expect(normalizeIngest({ ...nota, date: '2028-02-29' }).date).toBe('2028-02-29'); // bisiesto sí
    expect(() => normalizeIngest({ ...nota, source: { system: 'matias' } })).toThrow(/source/);
    expect(() => normalizeIngest({ ...nota, notes: '   ', summary: '' })).toThrow(/notes/);
  });

  it('una URL de origen que no es http(s) se descarta, no se guarda', () => {
    const limpia = normalizeIngest({ ...nota, source: { ...nota.source, url: 'javascript:alert(1)' } });
    expect(limpia.source.url).toBeNull();
  });

  it('quien hizo el O2O es opcional; si viene, tiene que ser un correo (RMR-TSK-0649)', () => {
    expect(normalizeIngest(nota).managerEmail).toBeNull();
    expect(normalizeIngest({ ...nota, managerEmail: ' Jefa@Ejemplo.test ' }).managerEmail).toBe('jefa@ejemplo.test');
    expect(() => normalizeIngest({ ...nota, managerEmail: 'no-es-un-email' })).toThrow(/managerEmail/);
  });

  it('acota el tamaño: una nota no es un volcado de correo entero', () => {
    const limpia = normalizeIngest({ ...nota, notes: 'x'.repeat(50_000) });
    expect(limpia.notes.length).toBeLessThanOrEqual(20_000);
  });
});

describe('conversationIdFor', () => {
  it('el mismo origen da el mismo id: reenviar no duplica', () => {
    const id = conversationIdFor(nota.source);
    expect(conversationIdFor({ ...nota.source, url: 'otra' })).toBe(id);
    expect(id).toMatch(/^agent-[a-f0-9]{24}$/);
  });

  it('orígenes distintos dan ids distintos, y el sistema cuenta', () => {
    expect(conversationIdFor({ system: 'matias', id: 'otro' })).not.toBe(conversationIdFor(nota.source));
    expect(conversationIdFor({ system: 'otro', id: 'thread-abc' })).not.toBe(conversationIdFor(nota.source));
  });
});

describe('o2oSessionFrom (RMR-TSK-0649)', () => {
  const doc = o2oSessionFrom(normalizeIngest(nota), { personId: 'p1', periodId: 'per1', at: '2026-09-22T10:00:00.000Z' });

  it('es un O2O PRIVADO del manager: nada compartido con la persona', () => {
    expect(doc).toMatchObject({ personId: 'p1', periodId: 'per1', date: '2026-09-22', sharedSummary: '', sharedWithPerson: false });
    expect(doc.privateNotes).toBe('Hablamos de su paso a L2');
    expect(doc.summary).toBe(normalizeIngest(nota).summary);
  });

  it('queda marcado como AUTOMÁTICO y con su origen', () => {
    expect(doc.automated).toBe(true);
    expect(doc.source.system).toBe('matias');
    expect(doc.source.url).toBe('https://mail.google.com/x/thread-abc');
  });
});

describe('personIsInScope: solo personas que tienen a ESE manager de O2O (RMR-TSK-0655)', () => {
  it('dentro: persona activa con el manager de la clave en su lista', () => {
    expect(personIsInScope({ active: true, o2oManagerUids: ['u-em'] }, 'u-em')).toBe(true);
    expect(personIsInScope({ o2oManagerUids: ['u-head', 'u-em'] }, 'u-em')).toBe(true); // sin `active` cuenta como activa
  });

  it('fuera: de otro manager, aunque sea su dueño, o sin lista', () => {
    expect(personIsInScope({ active: true, o2oManagerUids: ['u-otro'] }, 'u-em')).toBe(false);
    expect(personIsInScope({ active: true, ownerLeaderUid: 'u-em' }, 'u-em')).toBe(false);
    expect(personIsInScope({ active: true, o2oManagerUids: ['u-em'] }, '')).toBe(false);
  });

  it('fuera: desactivada o externa', () => {
    expect(personIsInScope({ active: false, o2oManagerUids: ['u-em'] }, 'u-em')).toBe(false);
    expect(personIsInScope({ active: true, o2oManagerUids: ['u-em'], external: true }, 'u-em')).toBe(false);
    expect(personIsInScope(null, 'u-em')).toBe(false);
  });
});
