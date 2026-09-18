import { describe, it, expect } from 'vitest';
import {
  sanitizeIssue, fetchLinearIssue, LINEAR_REF_RE, DESCRIPTION_MAX,
  subIssueTitle, estimateNumber, planSubIssues, summaryComment, pushGuildEstimates,
} from './linearIssue.js';

const respuesta = (body, ok = true, status = 200) => async () => ({ ok, status, json: async () => body });

const cruda = {
  identifier: 'BB-1234', title: '  Migrar el login a OAuth ', description: 'x'.repeat(DESCRIPTION_MAX + 50),
  url: 'https://linear.app/tribbu/issue/BB-1234/migrar', estimate: 5, priorityLabel: 'High',
  state: { name: 'Backlog', type: 'backlog' }, assignee: { name: 'Ana' },
  labels: { nodes: [{ name: 'Squad A' }, { name: '' }, null] }, project: { name: 'Login' },
  extra: 'no debe salir',
};

describe('LINEAR_REF_RE', () => {
  it('acepta equipo-número y rechaza lo demás', () => {
    for (const ok of ['BB-1', 'ENG-1234', 'A1B-99']) expect(LINEAR_REF_RE.test(ok)).toBe(true);
    for (const mal of ['bb-12', 'BB12', 'BB-', '-12', 'https://linear.app/x', 'BB-12 ', 'B-1']) {
      expect(LINEAR_REF_RE.test(mal)).toBe(false);
    }
  });
});

describe('sanitizeIssue: solo lo que la mesa pinta, acotado', () => {
  it('recorta, limpia y descarta campos que no son suyos', () => {
    const ficha = sanitizeIssue(cruda);
    expect(ficha.title).toBe('Migrar el login a OAuth');
    expect(ficha.description).toHaveLength(DESCRIPTION_MAX);
    expect(ficha.labels).toEqual(['Squad A']);
    expect(ficha.state).toBe('Backlog');
    expect(ficha.assignee).toBe('Ana');
    expect(ficha.project).toBe('Login');
    expect(ficha.priority).toBe('High');
    expect(ficha.estimate).toBe(5);
    expect('extra' in ficha).toBe(false);
  });

  it('solo acepta enlaces de linear.app: una URL ajena no llega a la mesa', () => {
    expect(sanitizeIssue({ ...cruda, url: 'https://evil.example/x' }).url).toBeNull();
  });

  it('sin identificador no hay ficha', () => {
    expect(sanitizeIssue(null)).toBeNull();
    expect(sanitizeIssue({ title: 'sin id' })).toBeNull();
  });
});

describe('fetchLinearIssue', () => {
  it('pregunta por el identificador y devuelve la ficha saneada', async () => {
    let enviado = null;
    const f = async (url, init) => { enviado = { url, init }; return respuesta({ data: { issue: cruda } })(); };
    const ficha = await fetchLinearIssue('BB-1234', 'clave', f);
    expect(ficha.identifier).toBe('BB-1234');
    expect(enviado.url).toBe('https://api.linear.app/graphql');
    expect(enviado.init.headers.Authorization).toBe('clave');
    expect(JSON.parse(enviado.init.body).variables).toEqual({ id: 'BB-1234' });
  });

  it('«no existe» es null, no un fallo', async () => {
    const f = respuesta({ errors: [{ message: 'Entity not found: Issue' }] });
    expect(await fetchLinearIssue('BB-9999', 'clave', f)).toBeNull();
  });

  it('otros errores de la API y los HTTP se propagan con su mensaje', async () => {
    await expect(fetchLinearIssue('BB-1', 'clave', respuesta({ errors: [{ message: 'Rate limited' }] })))
      .rejects.toThrow('Rate limited');
    await expect(fetchLinearIssue('BB-1', 'clave', respuesta({}, false, 401))).rejects.toThrow('401');
  });

  it('no llama a Linear con una referencia que no es una referencia', async () => {
    let llamado = false;
    await expect(fetchLinearIssue('bb-12', 'clave', async () => { llamado = true; })).rejects.toThrow('no válida');
    expect(llamado).toBe(false);
  });
});

describe('sub-issues por gremio (RMR-PCS-0043 · F5)', () => {
  it('subIssueTitle y estimateNumber: título con el gremio delante; solo los números son estimación', () => {
    expect(subIssueTitle('QA', ' Pago con Bizum ')).toBe('[QA] Pago con Bizum');
    expect([estimateNumber('5'), estimateNumber(13), estimateNumber('partir'), estimateNumber('M'), estimateNumber('')]).toEqual([5, 13, null, null, null]);
  });

  it('planSubIssues salta las que ya existen con ese título (idempotente) y crea el resto', () => {
    const hijas = [{ title: '[QA] Pago', identifier: 'BB-2', url: 'https://linear.app/t/issue/BB-2' }];
    const { create, skipped } = planSubIssues(hijas, { 'Backend PHP': '5', QA: '3' }, 'Pago');
    expect(create).toEqual([{ guild: 'Backend PHP', title: '[Backend PHP] Pago', estimate: 5, card: '5' }]);
    expect(skipped).toEqual([{ guild: 'QA', identifier: 'BB-2', url: 'https://linear.app/t/issue/BB-2' }]);
  });

  it('summaryComment lista cada gremio y la magnitud', () => {
    const md = summaryComment({ values: { 'Backend PHP': '5', QA: '3' }, value: '5', sessionName: 'Sprint 12' });
    expect(md).toContain('sesión «Sprint 12»');
    expect(md).toContain('- **Backend PHP**: 5');
    expect(md).toContain('- **QA**: 3');
    expect(md).toContain('**5**');
  });

  it('pushGuildEstimates consulta la padre, crea las que faltan con estimate y parentId, y comenta', async () => {
    const llamadas = [];
    const fetchImpl = async (_url, init) => {
      const { query, variables } = JSON.parse(init.body);
      llamadas.push({ query, variables });
      if (query.includes('query Parent')) {
        return { ok: true, json: async () => ({ data: { issue: {
          id: 'uuid-padre', identifier: 'BB-1', title: 'Pago', url: 'https://linear.app/t/issue/BB-1', team: { id: 'team-1' },
          children: { nodes: [{ title: '[QA] Pago', identifier: 'BB-2', url: 'https://linear.app/t/issue/BB-2' }] },
        } } }) };
      }
      if (query.includes('issueCreate')) {
        return { ok: true, json: async () => ({ data: { issueCreate: { success: true, issue: { identifier: 'BB-3', url: 'https://linear.app/t/issue/BB-3' } } } }) };
      }
      return { ok: true, json: async () => ({ data: { commentCreate: { success: true } } }) };
    };
    const out = await pushGuildEstimates({ identifier: 'BB-1', values: { 'Backend PHP': 'partir', QA: '3' }, value: 'partir', sessionName: 'S' }, 'key', fetchImpl);
    expect(out).toEqual({
      parent: { identifier: 'BB-1', url: 'https://linear.app/t/issue/BB-1' },
      subIssues: [{ guild: 'QA', identifier: 'BB-2', url: 'https://linear.app/t/issue/BB-2' }, { guild: 'Backend PHP', identifier: 'BB-3', url: 'https://linear.app/t/issue/BB-3' }],
      created: 1, skipped: 1, commented: true,
    });
    const creacion = llamadas.find((l) => l.query.includes('issueCreate')).variables.input;
    expect(creacion).toMatchObject({ teamId: 'team-1', parentId: 'uuid-padre', title: '[Backend PHP] Pago' });
    expect(creacion.estimate).toBeUndefined(); // «partir» no es un número
    const comentario = llamadas.find((l) => l.query.includes('commentCreate')).variables.input;
    expect(comentario.issueId).toBe('uuid-padre');
    expect(comentario.body).toContain('**QA**: 3');
  });

  it('un reintento no repite el comentario si la padre ya lleva ese mismo resumen', async () => {
    const body = summaryComment({ values: { QA: '3' }, value: '3', sessionName: '' });
    const llamadas = [];
    const fetchImpl = async (_u, init) => {
      const { query } = JSON.parse(init.body);
      llamadas.push(query);
      if (query.includes('query Parent')) {
        return { ok: true, json: async () => ({ data: { issue: { id: 'p', identifier: 'BB-1', title: 'T', team: { id: 't' }, children: { nodes: [{ title: '[QA] T', identifier: 'BB-2' }] }, comments: { nodes: [{ body }] } } } }) };
      }
      return { ok: true, json: async () => ({ data: {} }) };
    };
    const out = await pushGuildEstimates({ identifier: 'BB-1', values: { QA: '3' }, value: '3' }, 'k', fetchImpl);
    expect(out).toMatchObject({ created: 0, skipped: 1, commented: false });
    expect(llamadas.some((q) => q.includes('commentCreate'))).toBe(false);
  });

  it('pushGuildEstimates falla en voz alta: referencia mala, sin valores, padre desconocida o error de Linear', async () => {
    await expect(pushGuildEstimates({ identifier: 'x', values: { QA: '3' } }, 'k')).rejects.toThrow(/Referencia/);
    await expect(pushGuildEstimates({ identifier: 'BB-1', values: {} }, 'k')).rejects.toThrow(/valores/);
    const sinPadre = async () => ({ ok: true, json: async () => ({ data: { issue: null } }) });
    await expect(pushGuildEstimates({ identifier: 'BB-1', values: { QA: '3' } }, 'k', sinPadre)).rejects.toThrow(/no conoce BB-1/);
    const error = async () => ({ ok: true, json: async () => ({ errors: [{ message: 'estimate out of range' }] }) });
    await expect(pushGuildEstimates({ identifier: 'BB-1', values: { QA: '3' } }, 'k', error)).rejects.toThrow(/estimate out of range/);
    // Un comentario que Linear dice que no ha dejado también es un fallo.
    const sinComentario = async (_u, init) => {
      const { query } = JSON.parse(init.body);
      if (query.includes('query Parent')) return { ok: true, json: async () => ({ data: { issue: { id: 'p', identifier: 'BB-1', title: 'T', team: { id: 't' }, children: { nodes: [] } } } }) };
      if (query.includes('issueCreate')) return { ok: true, json: async () => ({ data: { issueCreate: { success: true, issue: { identifier: 'BB-9' } } } }) };
      return { ok: true, json: async () => ({ data: { commentCreate: { success: false } } }) };
    };
    await expect(pushGuildEstimates({ identifier: 'BB-1', values: { QA: '3' } }, 'k', sinComentario)).rejects.toThrow(/comentario/);
  });
});
