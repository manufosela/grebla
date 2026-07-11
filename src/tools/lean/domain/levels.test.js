import { describe, it, expect } from 'vitest';
import { flowEfficiencyLevel, agingLevel } from './levels.js';

describe('flowEfficiencyLevel (más es mejor)', () => {
  it('clasifica por umbrales y tolera null', () => {
    expect(flowEfficiencyLevel(null)).toBeNull();
    expect(flowEfficiencyLevel(50)).toBe('elite');
    expect(flowEfficiencyLevel(40)).toBe('elite');
    expect(flowEfficiencyLevel(30)).toBe('high');
    expect(flowEfficiencyLevel(20)).toBe('medium');
    expect(flowEfficiencyLevel(14)).toBe('low');
  });
});

describe('agingLevel (menos es mejor)', () => {
  it('clasifica por umbrales y tolera null', () => {
    expect(agingLevel(null)).toBeNull();
    expect(agingLevel(3)).toBe('high');
    expect(agingLevel(7)).toBe('medium');
    expect(agingLevel(14)).toBe('medium');
    expect(agingLevel(20)).toBe('low');
  });
});
