/**
 * Perfil de conocimiento individual (I/T/π/Comb) según el número de áreas que la
 * persona domina de forma SÓLIDA. Es una lectura de amplitud, no de cantidad
 * (GREBLA §6, Dim. 2). Función pura.
 *
 * Umbral de solidez: en la escala de 7 niveles, "sólido" (aplica con criterio en
 * casos nuevos y puede enseñar) se sitúa en Veteranus (5) o superior.
 */
export const SOLID_THRESHOLD = 5;

/**
 * @param {number} solidCount  Nº de áreas con nivel ≥ SOLID_THRESHOLD.
 * @returns {{ shape: 'I'|'T'|'π'|'Comb'|null, solidCount: number, label: string }}
 */
export function knowledgeProfile(solidCount) {
  const n = Number.isFinite(solidCount) ? Math.max(0, Math.floor(solidCount)) : 0;
  let shape = null;
  if (n >= 10) shape = 'Comb';
  else if (n >= 6) shape = 'π';
  else if (n >= 3) shape = 'T';
  else if (n >= 1) shape = 'I';
  const labels = {
    I: 'I-shape (especialista)',
    T: 'T-shape (especialidad + anchura)',
    'π': 'π-shape (doble especialidad)',
    Comb: 'Comb (visión sistémica)',
  };
  return { shape, solidCount: n, label: shape ? labels[shape] : 'Sin áreas sólidas' };
}

/**
 * Calcula el perfil a partir de los niveles por área.
 * @param {Array<{ level: number }>} areas
 * @returns {ReturnType<typeof knowledgeProfile>}
 */
export function knowledgeProfileFromAreas(areas) {
  const solid = (Array.isArray(areas) ? areas : []).filter((a) => (a?.level ?? 0) >= SOLID_THRESHOLD).length;
  return knowledgeProfile(solid);
}
