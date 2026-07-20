import { describe, it, expect } from 'vitest';
import { isColumnRevealed, areAllRevealed, canReadGroup, canReveal, revealPatch } from './visibility.js';

const openRetro = (revealed = {}) => ({ status: 'open', ownerLeaderUid: 'leader', revealed });

describe('isColumnRevealed', () => {
  it('oculta por defecto mientras la retro está abierta', () => {
    expect(isColumnRevealed(openRetro(), 'viento')).toBe(false);
  });

  it('revela la zona marcada, y solo esa', () => {
    const retro = openRetro({ viento: true });
    expect(isColumnRevealed(retro, 'viento')).toBe(true);
    expect(isColumnRevealed(retro, 'ancla')).toBe(false);
  });

  it('en una retro cerrada se ve todo aunque nunca se revelara', () => {
    expect(isColumnRevealed({ status: 'closed', revealed: {} }, 'viento')).toBe(true);
  });

  it('sin retro no revela nada', () => {
    expect(isColumnRevealed(null, 'viento')).toBe(false);
  });
});

describe('areAllRevealed', () => {
  const zones = ['viento', 'ancla', 'rocas', 'isla'];

  it('es falso si queda una sola zona oculta', () => {
    expect(areAllRevealed(openRetro({ viento: true, ancla: true, rocas: true }), zones)).toBe(false);
  });

  it('es cierto con todas reveladas', () => {
    expect(areAllRevealed(openRetro({ viento: true, ancla: true, rocas: true, isla: true }), zones)).toBe(true);
  });

  it('es cierto en una retro cerrada aunque nunca se revelara', () => {
    expect(areAllRevealed({ status: 'closed', revealed: {} }, zones)).toBe(true);
  });
});

describe('canReadGroup', () => {
  const group = { columnId: 'viento', notes: [{ authorUid: 'ana' }, { authorUid: 'bea' }] };

  it('deja leer las propias aunque la zona esté oculta', () => {
    expect(canReadGroup(group, 'ana', openRetro())).toBe(true);
  });

  it('oculta las de los demás mientras la zona no se revele', () => {
    expect(canReadGroup(group, 'carlos', openRetro())).toBe(false);
  });

  it('deja leer las de los demás cuando la zona está revelada', () => {
    expect(canReadGroup(group, 'carlos', openRetro({ viento: true }))).toBe(true);
  });

  it('sin usuario logado no lee tarjetas ocultas', () => {
    expect(canReadGroup(group, null, openRetro())).toBe(false);
  });
});

describe('canReveal', () => {
  it('lo puede hacer el líder dueño de la retro', () => {
    expect(canReveal(openRetro(), 'leader')).toBe(true);
  });

  it('no lo puede hacer un participante cualquiera', () => {
    expect(canReveal(openRetro(), 'ana')).toBe(false);
  });

  it('lo puede hacer un superadmin aunque no sea el dueño', () => {
    expect(canReveal(openRetro(), 'root', true)).toBe(true);
  });

  it('sin usuario no puede', () => {
    expect(canReveal(openRetro(), null)).toBe(false);
  });
});

describe('revealPatch', () => {
  it('usa claves con punto para no pisar el resto del mapa', () => {
    expect(revealPatch(['viento', 'ancla'], true)).toEqual({ 'revealed.viento': true, 'revealed.ancla': true });
  });

  it('sirve también para ocultar', () => {
    expect(revealPatch(['isla'], false)).toEqual({ 'revealed.isla': false });
  });

  it('descarta ids vacíos', () => {
    expect(revealPatch(['viento', '', null], true)).toEqual({ 'revealed.viento': true });
  });
});
