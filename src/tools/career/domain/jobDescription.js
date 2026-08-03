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
export const JD_SCHEMA_VERSION = '1.0.0';

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
  if (!isStringArray(jd.skills)) errors.push('skills debe ser un array de textos no vacíos.');
  if (!isNonEmptyString(jd.experienceRequirements)) errors.push('experienceRequirements es obligatorio.');
  errors.push(...validateCareerLevel(jd['x-careerLevel']));
  return { valid: errors.length === 0, errors };
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
