import { describe, it, expect } from 'vitest';
import { JD_SCHEMA_VERSION, isCompatibleSchemaVersion, validateJobDescription, generateJobDescription } from './jobDescription.js';

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
  responsibilities: '• Ownership: Saca adelante tareas acotadas sin supervisión.\n• Craft: Código legible y testeado.',
  'x-niceToHave': '• Ownership: Responde de un área completa.',
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

describe('generateJobDescription — generador desde el framework (F2)', async () => {
  const { seedFramework } = await import('../data/framework.js');
  const fw = seedFramework();

  it('nivel ÚNICO: payload válido, fiel al framework real', () => {
    const jd = generateJobDescription(fw, {
      jdId: 'jd-1', roleName: 'Backend Engineer', levelIds: ['l2'],
      disciplineIds: ['backend'], datePosted: '2026-08-03',
    });
    expect(validateJobDescription(jd).errors).toEqual([]);
    expect(jd.title).toBe('Backend Engineer (L2)');
    expect(jd['x-careerLevel'].track).toBe('ic');
    expect(jd['x-careerLevel'].disciplines).toEqual(['Backend']);
    // Las 7 dimensiones del seed tienen expectativa en l2.
    expect(jd['x-careerLevel'].dimensions.length).toBe(7);
    expect(jd['x-careerLevel'].dimensions[0].expectations[0].level).toBe('l2');
  });

  it('RANGO l2–l3: expectativas de ambos niveles atribuidas, ordenado por order', () => {
    const jd = generateJobDescription(fw, {
      jdId: 'jd-2', roleName: 'Senior Engineer', levelIds: ['l3', 'l2'], // desordenados a propósito
      datePosted: '2026-08-03',
    });
    expect(validateJobDescription(jd).errors).toEqual([]);
    expect(jd.title).toBe('Senior Engineer (L2–L3)');
    const tech = jd['x-careerLevel'].dimensions.find((d) => d.id === 'tech');
    expect(tech.expectations.map((e) => e.level)).toEqual(['l2', 'l3']);
  });

  it('rango que CRUZA tracks → track null (el contrato lo permite)', () => {
    const jd = generateJobDescription(fw, {
      jdId: 'jd-3', roleName: 'Tech Lead', levelIds: ['l3', 'l3tl'], datePosted: '2026-08-03',
    });
    expect(jd['x-careerLevel'].track).toBeNull();
    expect(validateJobDescription(jd).errors).toEqual([]);
  });

  it('falla FUERTE con parámetros inválidos (sin fallbacks silenciosos)', () => {
    expect(() => generateJobDescription(fw, { jdId: 'x', roleName: 'R', levelIds: ['l99'], datePosted: '2026-08-03' })).toThrow(/no existe/);
    expect(() => generateJobDescription(fw, { jdId: 'x', roleName: 'R', levelIds: [], datePosted: '2026-08-03' })).toThrow(/1 o 2 niveles/);
    expect(() => generateJobDescription(fw, { jdId: 'x', roleName: 'R', levelIds: ['l1', 'l2', 'l3'], datePosted: '2026-08-03' })).toThrow(/1 o 2 niveles/);
    expect(() => generateJobDescription(fw, { jdId: 'x', roleName: 'R', levelIds: ['l2', 'l2'], datePosted: '2026-08-03' })).toThrow(/repetir/);
    expect(() => generateJobDescription(fw, { jdId: 'x', roleName: 'R', levelIds: ['l1'], disciplineIds: ['cobol'], datePosted: '2026-08-03' })).toThrow(/disciplina/);
    expect(() => generateJobDescription(fw, { jdId: '', roleName: 'R', levelIds: ['l1'], datePosted: '2026-08-03' })).toThrow(/jdId/);
    expect(() => generateJobDescription(fw, { jdId: 'x', roleName: 'R', levelIds: ['l1'], datePosted: 'hoy' })).toThrow(/ISO/);
  });

  it('1.1.0: responsibilities = expectativas del nivel BASE por dimensión (bullets)', () => {
    const jd = generateJobDescription(fw, {
      jdId: 'jd-x', roleName: 'Backend Engineer', levelIds: ['l2', 'l3'], disciplineIds: ['backend'], datePosted: '2026-08-04',
    });
    expect(jd.responsibilities).toMatch(/^• /);
    // Cada línea es un bullet «• Dimensión: texto» del nivel más bajo del rango.
    for (const line of jd.responsibilities.split('\n')) expect(line).toMatch(/^• .+: .+/);
    expect(validateJobDescription(jd).valid).toBe(true);
  });

  it('1.1.0: x-niceToHave = expectativas del nivel SUPERIOR en un rango; null con nivel único', () => {
    const range = generateJobDescription(fw, {
      jdId: 'jd-x', roleName: 'Backend Engineer', levelIds: ['l2', 'l3'], disciplineIds: ['backend'], datePosted: '2026-08-04',
    });
    expect(range['x-niceToHave']).toMatch(/^• /);
    const single = generateJobDescription(fw, {
      jdId: 'jd-y', roleName: 'Backend Engineer', levelIds: ['l2'], disciplineIds: ['backend'], datePosted: '2026-08-04',
    });
    expect(single['x-niceToHave']).toBeNull();
    expect(validateJobDescription(single).valid).toBe(true);
  });

  it('1.1.0: qualifications lleva experiencia, disciplinas y dimensiones (no solo nombres)', () => {
    const jd = generateJobDescription(fw, {
      jdId: 'jd-x', roleName: 'Backend Engineer', levelIds: ['l2'], disciplineIds: ['backend'], datePosted: '2026-08-04',
    });
    expect(jd.qualifications).toContain('Backend');
    expect(jd.qualifications).toMatch(/framework/i);
  });

  it('el validador exige responsibilities y x-niceToHave string|null', () => {
    const jd = validJd();
    delete jd.responsibilities;
    expect(validateJobDescription(jd).errors.some((e) => /responsibilities/.test(e))).toBe(true);
    const jd2 = validJd();
    jd2['x-niceToHave'] = 42;
    expect(validateJobDescription(jd2).errors.some((e) => /niceToHave/.test(e))).toBe(true);
  });

  it('omite dimensiones sin expectativa y falla si NINGUNA tiene', () => {
    const mini = {
      id: 'engineering', name: 'Engineering',
      tracks: [{ id: 'ic', name: 'IC' }],
      levels: [{ id: 'l1', code: 'L1', title: 'Engineer', trackId: 'ic', order: 1 }],
      disciplines: [],
      dimensions: [
        { id: 'a', name: 'Con expectativa', order: 1 },
        { id: 'b', name: 'Sin expectativa', order: 2 },
      ],
      expectations: [{ levelId: 'l1', dimensionId: 'a', text: 'Hace cosas.' }],
    };
    const jd = generateJobDescription(mini, { jdId: 'x', roleName: 'R', levelIds: ['l1'], datePosted: '2026-08-03' });
    expect(jd['x-careerLevel'].dimensions.map((d) => d.id)).toEqual(['a']);
    const vacio = { ...mini, expectations: [] };
    expect(() => generateJobDescription(vacio, { jdId: 'x', roleName: 'R', levelIds: ['l1'], datePosted: '2026-08-03' })).toThrow(/no tiene expectativas/);
  });
});
