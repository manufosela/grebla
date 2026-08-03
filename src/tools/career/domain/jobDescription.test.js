import { describe, it, expect } from 'vitest';
import { JD_SCHEMA_VERSION, isCompatibleSchemaVersion, validateJobDescription } from './jobDescription.js';

/** Una JD VÁLIDA de referencia (rango L2–L3, dos dimensiones). */
const validJd = () => ({
  '@context': 'https://schema.org',
  '@type': 'JobPosting',
  'x-schemaVersion': JD_SCHEMA_VERSION,
  title: 'Backend Engineer (L2–L3)',
  description: 'Construirás servicios de producción con criterio y autonomía creciente.',
  datePosted: '2026-08-03',
  identifier: { '@type': 'PropertyValue', propertyID: 'grebla-jd', value: 'jd-abc123' },
  qualifications: 'Diseño de APIs, testing, operación básica de producción.',
  skills: ['Python', 'PostgreSQL', 'Testing'],
  experienceRequirements: 'Entre nivel L2 y L3 del framework de ingeniería.',
  'x-careerLevel': {
    framework: 'engineering',
    track: 'ic',
    levels: ['l2', 'l3'],
    levelLabels: ['L2 · Mid', 'L3 · Senior'],
    disciplines: ['backend-python'],
    dimensions: [
      {
        id: 'ownership',
        name: 'Ownership',
        expectations: [
          { level: 'l2', text: 'Saca adelante tareas acotadas sin supervisión.' },
          { level: 'l3', text: 'Responde de un área completa.' },
        ],
      },
      {
        id: 'craft',
        name: 'Craft',
        expectations: [{ level: 'l2', text: 'Código legible y testeado.' }],
      },
    ],
  },
});

describe('career — contrato de Job Description (RMR-PCS-0031 · F1)', () => {
  it('la JD de referencia es válida y la versión vigente es semver', () => {
    expect(JD_SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    const { valid, errors } = validateJobDescription(validJd());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('rechaza payloads que no son objetos', () => {
    for (const bad of [null, undefined, 'jd', 42, ['x']]) {
      expect(validateJobDescription(bad).valid).toBe(false);
    }
  });

  it('exige la base JSON-LD de JobPosting y el versionado', () => {
    const jd = validJd();
    delete jd['@context'];
    jd['@type'] = 'Occupation';
    jd['x-schemaVersion'] = 'v1';
    const { errors } = validateJobDescription(jd);
    expect(errors.join(' ')).toMatch(/@context/);
    expect(errors.join(' ')).toMatch(/@type/);
    expect(errors.join(' ')).toMatch(/x-schemaVersion/);
  });

  it('exige título, descripción, fecha ISO, identifier grebla-jd y proyección estándar', () => {
    const jd = validJd();
    jd.title = ' ';
    jd.datePosted = '3 de agosto';
    jd.identifier = { '@type': 'PropertyValue', propertyID: 'otro', value: 'x' };
    jd.skills = ['Python', ''];
    const { errors } = validateJobDescription(jd);
    expect(errors.join(' ')).toMatch(/title/);
    expect(errors.join(' ')).toMatch(/datePosted/);
    expect(errors.join(' ')).toMatch(/identifier/);
    expect(errors.join(' ')).toMatch(/skills/);
  });

  it('x-careerLevel: niveles 1..2, etiquetas parejas y expectativas dentro del rango', () => {
    const jd = validJd();
    jd['x-careerLevel'].levels = ['l1', 'l2', 'l3']; // 3 niveles: no es un rango
    let res = validateJobDescription(jd);
    expect(res.errors.join(' ')).toMatch(/1 o 2 niveles/);

    const jd2 = validJd();
    jd2['x-careerLevel'].dimensions[0].expectations.push({ level: 'l5', text: 'Fuera de rango.' });
    res = validateJobDescription(jd2);
    expect(res.errors.join(' ')).toMatch(/no está entre los niveles declarados/);

    const jd3 = validJd();
    jd3['x-careerLevel'] = undefined;
    res = validateJobDescription(jd3);
    expect(res.errors.join(' ')).toMatch(/x-careerLevel es obligatorio/);
  });

  it('acumula TODOS los errores (no corta en el primero)', () => {
    const { errors } = validateJobDescription({});
    expect(errors.length).toBeGreaterThan(5);
  });

  it('isCompatibleSchemaVersion: misma versión mayor', () => {
    expect(isCompatibleSchemaVersion(JD_SCHEMA_VERSION)).toBe(true);
    expect(isCompatibleSchemaVersion('1.9.4')).toBe(true);
    expect(isCompatibleSchemaVersion('2.0.0')).toBe(false);
    expect(isCompatibleSchemaVersion('v1')).toBe(false);
    expect(isCompatibleSchemaVersion(undefined)).toBe(false);
  });
});
