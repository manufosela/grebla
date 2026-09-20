/**
 * El puerto de los E2E (RMR-TSK-0537). Sin E2E_PORT, el de siempre; con ella,
 * el que diga, y un valor imposible se para en el boundary en vez de levantar
 * un servidor en un puerto al azar y sondear otro.
 */
import { describe, it, expect } from 'vitest';
import { portFromEnv } from './playwright.config.js';

describe('portFromEnv', () => {
  it('sin variable (o vacía) usa el 4321 de siempre', () => {
    expect([portFromEnv(undefined), portFromEnv('')]).toEqual([4321, 4321]);
  });

  it('acepta un puerto válido como número', () => {
    expect([portFromEnv('4399'), portFromEnv('1'), portFromEnv('65535')]).toEqual([4399, 1, 65535]);
  });

  it('rechaza lo que no es un puerto: 0, negativos, decimales, fuera de rango o texto', () => {
    for (const malo of ['0', '-1', '4321.5', '65536', 'abc', 'NaN']) {
      expect(() => portFromEnv(malo)).toThrow(/E2E_PORT/);
    }
  });
});
