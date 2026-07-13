import { describe, it, expect } from 'vitest';
import {
  emptySlots, placedCount, canFinalize, placeCard, removeCard,
  trayCards, slotsToOrden, ordenToSlots, validateOrden,
} from './placement.js';

const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
const full = () => [...IDS];

describe('placement — tablero', () => {
  it('emptySlots crea 10 posiciones vacías', () => {
    const s = emptySlots();
    expect(s).toHaveLength(10);
    expect(s.every((x) => x === null)).toBe(true);
    expect(placedCount(s)).toBe(0);
  });

  it('placeCard coloca, saca de su posición previa y desaloja al ocupante', () => {
    let s = emptySlots();
    s = placeCard(s, 'a', 0);
    expect(s[0]).toBe('a');
    // mover 'a' a la posición 2 la quita de la 0
    s = placeCard(s, 'a', 2);
    expect(s[0]).toBe(null);
    expect(s[2]).toBe('a');
    // colocar 'b' donde está 'a' desaloja a 'a' (vuelve a la bandeja)
    s = placeCard(s, 'b', 2);
    expect(s[2]).toBe('b');
    expect(s.includes('a')).toBe(false);
  });

  it('removeCard devuelve la carta a la bandeja', () => {
    const s = placeCard(emptySlots(), 'a', 0);
    expect(removeCard(s, 'a')[0]).toBe(null);
  });

  it('canFinalize solo con 10 cartas distintas', () => {
    expect(canFinalize(emptySlots())).toBe(false);
    expect(canFinalize(full())).toBe(true);
    const dup = full();
    dup[9] = 'a';
    expect(canFinalize(dup)).toBe(false);
  });

  it('trayCards excluye las ya colocadas', () => {
    const cards = IDS.map((id) => ({ id, name: id, description: '' }));
    const s = placeCard(emptySlots(), 'a', 0);
    const tray = trayCards(cards, s);
    expect(tray.map((c) => c.id)).not.toContain('a');
    expect(tray).toHaveLength(9);
  });

  it('slotsToOrden lanza si incompleto y numera 1..10 si completo', () => {
    expect(() => slotsToOrden(emptySlots())).toThrow();
    const orden = slotsToOrden(full());
    expect(orden).toHaveLength(10);
    expect(orden[0]).toEqual({ motivadorId: 'a', posicion: 1 });
    expect(orden[9]).toEqual({ motivadorId: 'j', posicion: 10 });
  });

  it('ordenToSlots reconstruye el tablero (ida y vuelta)', () => {
    const orden = slotsToOrden(full());
    expect(ordenToSlots(orden)).toEqual(full());
  });

  it('validateOrden acepta un orden correcto', () => {
    expect(validateOrden(slotsToOrden(full()), IDS)).toEqual({ ok: true, errors: [] });
  });

  it('validateOrden detecta posición repetida, carta ajena y longitud', () => {
    const badLen = validateOrden([{ motivadorId: 'a', posicion: 1 }], IDS);
    expect(badLen.ok).toBe(false);

    const orden = slotsToOrden(full());
    orden[1].posicion = 1; // dos cartas en la posición 1
    expect(validateOrden(orden, IDS).ok).toBe(false);

    const foreign = slotsToOrden(full());
    foreign[0].motivadorId = 'zzz';
    const r = validateOrden(foreign, IDS);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('zzz'))).toBe(true);
  });
});
