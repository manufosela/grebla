import { describe, it, expect } from 'vitest';
import {
  CELEBRATION,
  CONFETTI_COLOR_COUNT,
  justVisitedCity,
  confettiParticles,
  confettiPosition,
} from './celebration.js';

describe('justVisitedCity (diff de visitadas, MC-11)', () => {
  it('detecta la ciudad que acaba de pasar a visitada', () => {
    expect(justVisitedCity(['a', 'b'], ['a', 'b', 'c'])).toBe('c');
  });

  it('detecta la primera ciudadanía (de cero a una)', () => {
    expect(justVisitedCity([], ['a'])).toBe('a');
    expect(justVisitedCity(undefined, ['a'])).toBe('a');
  });

  it('no celebra al quitar de visitadas', () => {
    expect(justVisitedCity(['a', 'b'], ['a'])).toBeNull();
  });

  it('no celebra sin cambios', () => {
    expect(justVisitedCity(['a', 'b'], ['a', 'b'])).toBeNull();
    expect(justVisitedCity([], [])).toBeNull();
  });

  it('no celebra al cargar el journey de otra persona (conjunto distinto)', () => {
    // Mismo tamaño +1 pero con una ciudad anterior desaparecida: NO es el
    // gesto de «marcar como visitada».
    expect(justVisitedCity(['a', 'b'], ['a', 'c', 'd'])).toBeNull();
    // Varias nuevas de golpe tampoco.
    expect(justVisitedCity(['a'], ['a', 'b', 'c'])).toBeNull();
  });
});

describe('confettiParticles (trayectorias deterministas)', () => {
  it('produce el número de partículas pedido (y el de CELEBRATION por defecto)', () => {
    expect(confettiParticles(123)).toHaveLength(CELEBRATION.count);
    expect(confettiParticles(123, 8)).toHaveLength(8);
  });

  it('es determinista: misma semilla e índice, misma partícula', () => {
    expect(confettiParticles(42)).toEqual(confettiParticles(42));
  });

  it('semillas distintas producen lluvias distintas', () => {
    const a = confettiParticles(1, 4);
    const b = confettiParticles(2, 4);
    expect(a).not.toEqual(b);
  });

  it('los índices de color caen dentro de la paleta', () => {
    for (const p of confettiParticles(7)) {
      expect(p.colorIndex).toBeGreaterThanOrEqual(0);
      expect(p.colorIndex).toBeLessThan(CONFETTI_COLOR_COUNT);
    }
  });

  it('todas las partículas brotan hacia ARRIBA', () => {
    for (const p of confettiParticles(99)) expect(p.vy).toBeGreaterThan(0);
  });
});

describe('confettiPosition (balística simple)', () => {
  const particle = confettiParticles(5, 1)[0];

  it('en t=0 parte del tejado con su desplazamiento inicial', () => {
    const p0 = confettiPosition(particle, 0, 5);
    expect(p0.x).toBeCloseTo(particle.x0);
    expect(p0.z).toBeCloseTo(particle.z0);
    expect(p0.y).toBeCloseTo(5);
  });

  it('primero sube y con la gravedad acaba cayendo', () => {
    const topY = 5;
    const early = confettiPosition(particle, 0.15, topY);
    expect(early.y).toBeGreaterThan(topY); // brote inicial hacia arriba
    const late = confettiPosition(particle, CELEBRATION.durationS, topY);
    expect(late.y).toBeLessThan(early.y); // la gravedad manda al final
  });

  it('nunca se hunde bajo el suelo', () => {
    const settled = confettiPosition(particle, 60, 5); // t absurdo: ya posado
    expect(settled.y).toBeGreaterThan(0);
  });
});
