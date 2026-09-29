import { describe, it, expect } from 'vitest';
import { conversationOrigin, conversationsNewestFirst } from './conversationOrigin.js';

describe('de dónde viene una conversación', () => {
  it('de un agente, cuando la ingesta lo marca, y se dice QUÉ sistema', () => {
    const o = conversationOrigin({
      automated: true,
      source: { system: 'matias', url: 'https://calendario.example/evento/1' },
      createdBy: { name: 'matias (automático)' },
    });
    expect(o.kind).toBe('agente');
    expect(o.label).toBe('Automática · matias');
    expect(o.system).toBe('matias');
  });

  it('de una persona, con su nombre', () => {
    const o = conversationOrigin({ createdBy: { name: 'Manu' } });
    expect(o).toMatchObject({ kind: 'persona', label: 'Escrita por Manu', system: null });
  });

  it('las notas viejas sin autor lo DICEN, en vez de atribuirse a nadie', () => {
    // Dejar el hueco en blanco se lee como si nadie la hubiera escrito, y
    // ponerle un nombre sería inventarlo.
    expect(conversationOrigin({}).label).toBe('Sin autor registrado');
    expect(conversationOrigin(null).kind).toBe('desconocido');
  });

  it('con `source` pero sin la marca de automática, sigue siendo de agente', () => {
    // Las primeras notas ingestadas no llevaban `automated`.
    expect(conversationOrigin({ source: { system: 'matias' } }).kind).toBe('agente');
  });
});

describe('el enlace al origen', () => {
  it('se conserva si es http(s)', () => {
    const o = conversationOrigin({ automated: true, source: { system: 'x', url: 'https://a.example/1' } });
    expect(o.url).toBe('https://a.example/1');
  });

  it('y se descarta si no lo es: un href no es sitio para cualquier esquema', () => {
    const malo = (url) => conversationOrigin({ automated: true, source: { system: 'x', url } }).url;
    expect(malo('javascript:alert(1)')).toBeNull();
    expect(malo('data:text/html;base64,AAAA')).toBeNull();
    expect(malo('no-es-una-url')).toBeNull();
    expect(malo('')).toBeNull();
  });
});

describe('en qué orden se leen', () => {
  it('lo último, primero: es lo tuyo y lo que buscas es lo reciente', () => {
    const out = conversationsNewestFirst([
      { date: '2026-01-01' }, { date: '2026-09-01' }, { date: '2026-05-01' },
    ]);
    expect(out.map((c) => c.date)).toEqual(['2026-09-01', '2026-05-01', '2026-01-01']);
  });

  it('no toca la lista original ni se rompe sin fechas', () => {
    const original = [{ date: '2026-01-01' }, {}];
    const out = conversationsNewestFirst(original);
    expect(original[0].date).toBe('2026-01-01');
    expect(out).toHaveLength(2);
    expect(conversationsNewestFirst(null)).toEqual([]);
  });
});
