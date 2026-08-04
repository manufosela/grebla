/**
 * CONTRATO de una Job Description de GREBLA (RMR-PCS-0031 · F1). Lógica PURA:
 * ni Firebase ni DOM — solo el schema y su validador, testeables en seco.
 *
 * El payload es un schema.org/JobPosting en JSON-LD (el estándar que consumen
 * Google for Jobs y el tooling web), EXTENDIDO con un bloque propio
 * `x-careerLevel` que expresa lo que JobPosting no sabe decir: el nivel (o
 * rango) del framework de carrera y las competencias por dimensión que salen
 * de la matriz de expectativas. Los campos estándar (qualifications, skills,
 * experienceRequirements) llevan la proyección legible de ese bloque.
 *
 * VERSIONADO (semver en `x-schemaVersion`):
 *  - PATCH/MINOR: cambios compatibles (campos nuevos opcionales).
 *  - MAJOR: cambios incompatibles (renombrar/quitar campos, semántica).
 * Un consumidor debe aceptar la misma versión mayor e ignorar campos que no
 * conozca. GREBLA es GENÉRICO: este contrato no sabe nada de sus consumidores.
 *
 * @typedef {Object} JdDimension
 * @property {string} id                       Id de la dimensión del framework.
 * @property {string} name                     Nombre visible.
 * @property {Array<{level: string, text: string}>} expectations  Expectativa por nivel del rango.
 *
 * @typedef {Object} JdCareerLevel
 * @property {string} framework                Id del framework (p.ej. 'engineering').
 * @property {string|null} track               Track del framework (o null si no aplica).
 * @property {string[]} levels                 1 o 2 ids de nivel (rango «entre niveles»).
 * @property {string[]} levelLabels            Etiquetas visibles de esos niveles.
 * @property {string[]} disciplines            Disciplinas/stack de la vacante.
 * @property {JdDimension[]} dimensions        Competencias por dimensión.
 *
 * @typedef {Object} JobDescription
 * @property {string} `@context`               'https://schema.org'
 * @property {string} `@type`                  'JobPosting'
 * @property {string} `x-schemaVersion`        Versión del contrato (semver).
 * @property {string} title
 * @property {string} description
 * @property {string} datePosted               Fecha ISO (YYYY-MM-DD).
 * @property {{['@type']: 'PropertyValue', propertyID: 'grebla-jd', value: string}} identifier
 * @property {string} qualifications
 * @property {string[]} skills
 * @property {string} experienceRequirements
 * @property {JdCareerLevel} `x-careerLevel`
 */

/** Versión VIGENTE del contrato. */
export const JD_SCHEMA_VERSION = '1.2.0';

const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** ¿Misma versión MAYOR que la vigente? (lo que un consumidor debe comprobar). */
export function isCompatibleSchemaVersion(version) {
  if (!SEMVER_RE.test(String(version ?? ''))) return false;
  return String(version).split('.')[0] === JD_SCHEMA_VERSION.split('.')[0];
}

const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';
const isStringArray = (v) => Array.isArray(v) && v.every(isNonEmptyString);

/**
 * Valida un payload contra el contrato. Devuelve TODOS los errores (no corta en
 * el primero): el consumidor y los tests ven el cuadro completo.
 * @param {unknown} payload
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateJobDescription(payload) {
  /** @type {string[]} */
  const errors = [];
  const jd = /** @type {Record<string, any>} */ (payload);
  if (jd === null || typeof jd !== 'object' || Array.isArray(jd)) {
    return { valid: false, errors: ['El payload debe ser un objeto JSON-LD.'] };
  }
  if (jd['@context'] !== 'https://schema.org') errors.push('@context debe ser "https://schema.org".');
  if (jd['@type'] !== 'JobPosting') errors.push('@type debe ser "JobPosting".');
  if (!SEMVER_RE.test(String(jd['x-schemaVersion'] ?? ''))) errors.push('x-schemaVersion debe ser semver (X.Y.Z).');
  if (!isNonEmptyString(jd.title)) errors.push('title es obligatorio.');
  if (!isNonEmptyString(jd.description)) errors.push('description es obligatoria.');
  if (!ISO_DATE_RE.test(String(jd.datePosted ?? ''))) errors.push('datePosted debe ser fecha ISO (YYYY-MM-DD).');
  const ident = jd.identifier;
  if (
    !ident ||
    ident['@type'] !== 'PropertyValue' ||
    ident.propertyID !== 'grebla-jd' ||
    !isNonEmptyString(ident.value)
  ) {
    errors.push('identifier debe ser un PropertyValue con propertyID "grebla-jd" y value (id de la JD).');
  }
  if (!isNonEmptyString(jd.qualifications)) errors.push('qualifications es obligatorio.');
  if (!isNonEmptyString(jd.responsibilities)) {
    errors.push('responsibilities es obligatorio (bullets del nivel base, 1.1.0).');
  }
  if (jd['x-niceToHave'] !== null && jd['x-niceToHave'] !== undefined && !isNonEmptyString(jd['x-niceToHave'])) {
    errors.push('x-niceToHave debe ser un texto o null.');
  }
  if (!isNonEmptyString(jd['x-mustHave'])) {
    errors.push('x-mustHave es obligatorio (bullets de imprescindibles, 1.2.0).');
  }
  const onboarding = jd['x-onboardingExpectations'];
  if (!onboarding || typeof onboarding !== 'object' || Array.isArray(onboarding)
    || !['month1', 'month3', 'month6'].every((k) => isNonEmptyString(onboarding[k]))) {
    errors.push('x-onboardingExpectations debe llevar month1, month3 y month6 (qué se espera a 1/3/6 meses).');
  }
  if (!isStringArray(jd.skills)) errors.push('skills debe ser un array de textos no vacíos.');
  if (!isNonEmptyString(jd.experienceRequirements)) errors.push('experienceRequirements es obligatorio.');
  errors.push(...validateCareerLevel(jd['x-careerLevel']));
  return { valid: errors.length === 0, errors };
}

/**
 * GENERA una Job Description conforme al contrato a partir del FRAMEWORK
 * (RMR-PCS-0031 · F2). Función PURA: recibe el framework normalizado de la
 * instancia (con sus ediciones), no el seed — y unos parámetros mínimos.
 * Sin fallbacks silenciosos: parámetros inválidos LANZAN con mensaje claro.
 *
 * @param {{ id?: string, name?: string,
 *   tracks: Array<{id: string, name: string}>,
 *   levels: Array<{id: string, code: string, title: string, trackId: string, order: number, description?: string, typicalProfile?: string}>,
 *   disciplines: Array<{id: string, name: string}>,
 *   dimensions: Array<{id: string, name: string, order: number}>,
 *   expectations: Array<{levelId: string, dimensionId: string, text: string}> }} framework
 * @param {{ jdId: string, roleName: string, levelIds: string[], disciplineIds?: string[],
 *   datePosted: string, descriptionIntro?: string }} opts
 * @returns {Record<string, unknown>} payload que pasa validateJobDescription
 */
export function generateJobDescription(framework, opts) {
  const { jdId, roleName, levelIds, disciplineIds = [], datePosted, descriptionIntro = '' } = opts ?? {};
  if (!framework || !Array.isArray(framework.levels)) throw new Error('Falta el framework de carrera.');
  if (!isNonEmptyString(jdId)) throw new Error('Falta el id de la JD (jdId).');
  if (!isNonEmptyString(roleName)) throw new Error('Falta el nombre del rol (roleName).');
  if (!ISO_DATE_RE.test(String(datePosted ?? ''))) throw new Error('datePosted debe ser fecha ISO (YYYY-MM-DD).');
  if (!Array.isArray(levelIds) || levelIds.length < 1 || levelIds.length > 2) {
    throw new Error('Elige 1 o 2 niveles (rango «entre niveles»).');
  }
  if (new Set(levelIds).size !== levelIds.length) {
    throw new Error('Un rango no puede repetir el mismo nivel dos veces.');
  }
  const levels = levelIds.map((id) => {
    const level = framework.levels.find((l) => l.id === id);
    if (!level) throw new Error(`El nivel «${id}» no existe en el framework.`);
    return level;
  }).toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Track: el común de los niveles; si el rango cruza tracks, null (el contrato lo permite).
  const trackIds = new Set(levels.map((l) => l.trackId));
  const track = trackIds.size === 1 ? (levels[0].trackId ?? null) : null;

  const disciplineNames = disciplineIds.map((id) => {
    const discipline = framework.disciplines?.find((d) => d.id === id);
    if (!discipline) throw new Error(`La disciplina «${id}» no existe en el framework.`);
    return discipline.name;
  });
  const codes = levels.map((l) => l.code);
  const levelLabels = levels.map((l) => `${l.code} · ${l.title}`);
  const isRange = levels.length === 2;

  // Dimensiones con la(s) expectativa(s) de los niveles elegidos, en el orden
  // del framework. Una dimensión sin expectativa para NINGUNO de los niveles
  // se omite (el contrato exige al menos una por dimensión).
  const dimensions = [...(framework.dimensions ?? [])]
    .toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((dim) => ({
      id: dim.id,
      name: dim.name,
      expectations: levels
        .map((level) => {
          const exp = (framework.expectations ?? []).find(
            (e) => e.levelId === level.id && e.dimensionId === dim.id,
          );
          return exp ? { level: level.id, text: exp.text } : null;
        })
        .filter(Boolean),
    }))
    .filter((dim) => dim.expectations.length > 0);
  if (dimensions.length === 0) {
    throw new Error('El framework no tiene expectativas para esos niveles: no se puede generar la JD.');
  }

  // Nomenclatura PÚBLICA (1.2.0): los códigos Lx son internos — de cara a la
  // oferta se usa la etiqueta pública del nivel (publicLabel del framework,
  // p. ej. Junior/Mid/Senior; fallback al título). Con dedupe: un rango
  // Senior–Senior se publica como «Senior».
  const seniorityLabels = levels.map((l) => (isNonEmptyString(l.publicLabel) ? l.publicLabel.trim() : l.title));
  const seniorityPublic = [...new Set(seniorityLabels)].join(' – ');
  const profileBits = levels.map((l) => l.typicalProfile).filter(isNonEmptyString);
  const description = [
    descriptionIntro.trim(),
    `Buscamos ${roleName}${disciplineNames.length ? ` (${disciplineNames.join(', ')})` : ''}. Seniority: ${seniorityPublic}.`,
    ...(isRange
      ? [
          isNonEmptyString(levels[0].description) ? `Perfil de entrada: ${levels[0].description}` : null,
          isNonEmptyString(levels[1].description) ? `Crecerás hacia: ${levels[1].description}` : null,
        ]
      : [isNonEmptyString(levels[0].description) ? levels[0].description : null]),
  ].filter(isNonEmptyString).join('\n\n');

  // 1.1.0 — campos DIRECTOS para el prefill del consumidor (el portal no
  // debería tener que bucear en x-careerLevel): lo que harás = expectativas del
  // nivel BASE; lo valorable = las del nivel SUPERIOR del rango (si lo hay).
  const responsibilities = dimensions
    .map((dim) => `• ${dim.name}: ${dim.expectations[0].text}`)
    .join('\n');
  const topLevelId = levels.at(-1).id;
  const niceToHave = isRange
    ? dimensions
        .map((dim) => {
          const top = dim.expectations.find((e) => e.level === topLevelId);
          return top && dim.expectations.length > 1 ? `• ${dim.name}: ${top.text}` : null;
        })
        .filter(Boolean)
        .join('\n') || null
    : null;
  // Imprescindible explícito (1.2.0): bullets para el prefill del consumidor;
  // qualifications (schema.org) lleva el mismo contenido en prosa.
  const mustHaveBits = [
    profileBits.length ? `Experiencia típica: ${profileBits.join(' / ')}.` : null,
    disciplineNames.length ? `Disciplinas: ${disciplineNames.join(', ')}.` : null,
    `Áreas de evaluación: ${dimensions.map((d) => d.name).join(' · ')}.`,
  ].filter(Boolean);
  const mustHave = mustHaveBits.map((b) => `• ${b}`).join('\n');
  const qualifications = mustHaveBits.join(' ');

  // Qué se espera de ti a 1/3/6 meses (1.2.0, teórico pero honesto): derivado
  // del nivel BASE — aterrizar, entregar con autonomía creciente (expectativa
  // de ejecución si existe) y operar plenamente al nivel.
  const executionBase = dimensions.find((d) => d.id === 'execution')?.expectations[0]?.text
    ?? dimensions[0].expectations[0].text;
  const onboardingExpectations = {
    month1: `Aterrizar: conocer al equipo, el producto y el código; primeras entregas acotadas${disciplineNames.length ? ` en ${disciplineNames.join(', ')}` : ''} con acompañamiento.`,
    month3: `Entregar con autonomía creciente. ${executionBase}`,
    month6: `Operar plenamente al nivel ${seniorityLabels[0]} en ${dimensions.map((d) => d.name).join(', ')}.`,
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    'x-schemaVersion': JD_SCHEMA_VERSION,
    title: `${roleName} (${seniorityPublic})`,
    description,
    datePosted,
    identifier: { '@type': 'PropertyValue', propertyID: 'grebla-jd', value: jdId },
    qualifications,
    responsibilities,
    'x-mustHave': mustHave,
    'x-niceToHave': niceToHave,
    'x-onboardingExpectations': onboardingExpectations,
    skills: [...disciplineNames, ...dimensions.map((d) => d.name)],
    experienceRequirements: profileBits.length
      ? `Experiencia típica: ${profileBits.join(' / ')}.`
      : `Seniority: ${seniorityPublic}.`,
    'x-careerLevel': {
      framework: framework.id ?? 'engineering',
      track,
      levels: levels.map((l) => l.id),
      levelLabels,
      seniorityLabels,
      disciplines: disciplineNames,
      dimensions,
    },
  };
}

/** Valida el bloque x-careerLevel (extensión propia). @returns {string[]} */
function validateCareerLevel(block) {
  /** @type {string[]} */
  const errors = [];
  if (!block || typeof block !== 'object' || Array.isArray(block)) {
    return ['x-careerLevel es obligatorio (nivel de carrera y competencias por dimensión).'];
  }
  if (!isNonEmptyString(block.framework)) errors.push('x-careerLevel.framework es obligatorio.');
  if (block.track !== null && !isNonEmptyString(block.track)) {
    errors.push('x-careerLevel.track debe ser un id de track o null.');
  }
  if (!isStringArray(block.levels) || block.levels.length < 1 || block.levels.length > 2) {
    errors.push('x-careerLevel.levels debe tener 1 o 2 niveles (rango «entre niveles»).');
  }
  if (!isStringArray(block.levelLabels) || block.levelLabels.length !== (block.levels?.length ?? 0)) {
    errors.push('x-careerLevel.levelLabels debe tener una etiqueta por nivel.');
  }
  if (!Array.isArray(block.disciplines) || !block.disciplines.every(isNonEmptyString)) {
    errors.push('x-careerLevel.disciplines debe ser un array de textos (el rol/stack de la vacante).');
  }
  if (!Array.isArray(block.dimensions) || block.dimensions.length === 0) {
    errors.push('x-careerLevel.dimensions debe tener al menos una dimensión.');
    return errors;
  }
  const declaredLevels = new Set(block.levels ?? []);
  block.dimensions.forEach((dim, i) => {
    if (!isNonEmptyString(dim?.id)) errors.push(`dimensions[${i}].id es obligatorio.`);
    if (!isNonEmptyString(dim?.name)) errors.push(`dimensions[${i}].name es obligatorio.`);
    if (!Array.isArray(dim?.expectations) || dim.expectations.length === 0) {
      errors.push(`dimensions[${i}].expectations debe tener al menos una expectativa.`);
      return;
    }
    dim.expectations.forEach((exp, j) => {
      if (!isNonEmptyString(exp?.text)) errors.push(`dimensions[${i}].expectations[${j}].text es obligatorio.`);
      if (!declaredLevels.has(exp?.level)) {
        errors.push(`dimensions[${i}].expectations[${j}].level ("${exp?.level}") no está entre los niveles declarados.`);
      }
    });
  });
  return errors;
}
