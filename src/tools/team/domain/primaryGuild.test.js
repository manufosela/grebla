import { describe, it, expect } from 'vitest';
import { normalizePrimaryGuild, guildsOrdered, needsPrimaryGuild } from './primaryGuild.js';

describe('gremio principal', () => {
  it('sin gremios no hay principal', () => {
    expect(normalizePrimaryGuild([], null)).toBeNull();
    expect(normalizePrimaryGuild([], 'Frontend')).toBeNull();
  });

  it('con un solo gremio, ese es el principal aunque nadie lo haya elegido', () => {
    // No es un fallback: con un único gremio no hay elección posible, así que
    // pedirla sería preguntar por algo que ya se sabe.
    expect(normalizePrimaryGuild(['Frontend'], null)).toBe('Frontend');
  });

  it('respeta el elegido cuando de verdad es uno de sus gremios', () => {
    expect(normalizePrimaryGuild(['Frontend', 'QA'], 'QA')).toBe('QA');
  });

  it('con dos gremios y ninguno elegido, el principal queda SIN decidir', () => {
    // Coger el primero de la lista sería inventarse la respuesta: el orden de
    // `guilds` no significa nada. Que falte se dice, no se adivina.
    expect(normalizePrimaryGuild(['Frontend', 'QA'], null)).toBeNull();
  });

  it('un principal que ya no está entre sus gremios se descarta', () => {
    // Le quitaron el gremio: dejarlo como principal contaría a la persona en un
    // gremio al que ya no pertenece.
    expect(normalizePrimaryGuild(['Frontend', 'QA'], 'Datos')).toBeNull();
  });

  it('si le queda un solo gremio, ese pasa a ser el principal', () => {
    expect(normalizePrimaryGuild(['Frontend'], 'Datos')).toBe('Frontend');
  });

  it('no se traga entradas basura', () => {
    expect(normalizePrimaryGuild(null, undefined)).toBeNull();
    expect(normalizePrimaryGuild(['Frontend', 'QA'], '')).toBeNull();
    expect(normalizePrimaryGuild(['Frontend', 'QA'], '  QA  ')).toBe('QA');
  });
});

describe('a quién le falta elegir', () => {
  it('a quien milita en dos gremios y no ha elegido', () => {
    expect(needsPrimaryGuild({ guilds: ['Frontend', 'QA'], primaryGuild: null })).toBe(true);
  });

  it('no a quien ya eligió', () => {
    expect(needsPrimaryGuild({ guilds: ['Frontend', 'QA'], primaryGuild: 'QA' })).toBe(false);
  });

  it('no a quien tiene uno o ninguno: no hay nada que elegir', () => {
    expect(needsPrimaryGuild({ guilds: ['Frontend'], primaryGuild: null })).toBe(false);
    expect(needsPrimaryGuild({ guilds: [], primaryGuild: null })).toBe(false);
    expect(needsPrimaryGuild({})).toBe(false);
  });
});

describe('orden de los gremios al pintarlos', () => {
  it('el principal va delante y los demás conservan su orden', () => {
    expect(guildsOrdered(['Frontend', 'QA', 'Datos'], 'QA')).toEqual(['QA', 'Frontend', 'Datos']);
  });

  it('sin principal, el orden no se toca', () => {
    expect(guildsOrdered(['Frontend', 'QA'], null)).toEqual(['Frontend', 'QA']);
  });

  it('un principal ajeno a la lista no la altera ni se cuela', () => {
    expect(guildsOrdered(['Frontend', 'QA'], 'Datos')).toEqual(['Frontend', 'QA']);
  });

  it('sin gremios, lista vacía', () => {
    expect(guildsOrdered(null, 'QA')).toEqual([]);
  });
});
