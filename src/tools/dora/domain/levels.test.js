import { describe, it, expect } from 'vitest';
import { leadTimeLevel, deployFrequencyLevel, changeFailureRateLevel, mttrLevel, levelLabel } from './levels.js';

describe('changeFailureRateLevel', () => {
  it('clasifica por porcentaje (menos es mejor)', () => {
    expect(changeFailureRateLevel(0)).toBe('elite');
    expect(changeFailureRateLevel(5)).toBe('elite');
    expect(changeFailureRateLevel(15)).toBe('high');
    expect(changeFailureRateLevel(30)).toBe('medium');
    expect(changeFailureRateLevel(31)).toBe('low');
  });
  it('sin dato o inválido → null', () => {
    expect(changeFailureRateLevel(null)).toBeNull();
    expect(changeFailureRateLevel(undefined)).toBeNull();
    expect(changeFailureRateLevel(-1)).toBeNull();
  });
});

describe('mttrLevel', () => {
  it('clasifica por horas de restauración', () => {
    expect(mttrLevel(0.5)).toBe('elite');
    expect(mttrLevel(1)).toBe('high');
    expect(mttrLevel(23)).toBe('high');
    expect(mttrLevel(24)).toBe('medium');
    expect(mttrLevel(24 * 7)).toBe('low');
  });
  it('sin dato o inválido → null', () => {
    expect(mttrLevel(null)).toBeNull();
    expect(mttrLevel(-1)).toBeNull();
  });
});

describe('leadTimeLevel', () => {
  it('clasifica por horas en los límites de cada nivel', () => {
    expect(leadTimeLevel(0.9)).toBe('elite'); // <1h
    expect(leadTimeLevel(1)).toBe('high'); // 1 día > x ≥ 1h
    expect(leadTimeLevel(23)).toBe('high');
    expect(leadTimeLevel(24)).toBe('medium'); // ≥1 día, <1 semana
    expect(leadTimeLevel(167)).toBe('medium');
    expect(leadTimeLevel(168)).toBe('low'); // ≥1 semana
  });
  it('sin dato → null', () => {
    expect(leadTimeLevel(null)).toBeNull();
    expect(leadTimeLevel(undefined)).toBeNull();
    expect(leadTimeLevel(-1)).toBeNull();
  });
});

describe('deployFrequencyLevel', () => {
  it('clasifica por despliegues/semana', () => {
    expect(deployFrequencyLevel(56.3)).toBe('elite'); // ≥7
    expect(deployFrequencyLevel(7)).toBe('elite');
    expect(deployFrequencyLevel(6.9)).toBe('high');
    expect(deployFrequencyLevel(1)).toBe('high');
    expect(deployFrequencyLevel(0.9)).toBe('medium');
    expect(deployFrequencyLevel(0.3)).toBe('medium'); // ≥ ~0.23
    expect(deployFrequencyLevel(0.1)).toBe('low');
    expect(deployFrequencyLevel(0)).toBe('low');
  });
  it('sin dato → null', () => {
    expect(deployFrequencyLevel(null)).toBeNull();
    expect(deployFrequencyLevel(undefined)).toBeNull();
  });
});

describe('levelLabel', () => {
  it('traduce el nivel a etiqueta legible', () => {
    expect(levelLabel('elite')).toBe('Elite');
    expect(levelLabel('high')).toBe('Alto');
    expect(levelLabel('medium')).toBe('Medio');
    expect(levelLabel('low')).toBe('Bajo');
    expect(levelLabel(null)).toBe('—');
  });
});
