/**
 * Ejes de segmentación A MEDIDA del padrón (RMR-TSK-0355). Dominio puro.
 *
 * El padrón admite columnas arbitrarias (género, modalidad remoto, rango de
 * edad…) que People declara como ejes de segmentación en /padron/_axes. Solo se
 * admiten CATEGÓRICOS con pocos valores: un campo de texto libre reidentifica
 * (nadie más escribe esa frase) y por eso se rechaza en la declaración. Los
 * ejes declarados viajan planos en la metadata (metadata[id] = valor), igual
 * que department/location, así el motor de resultados (segmentedScale + k) los
 * segmenta sin cambios. Añadir un eje nuevo = subir el CSV con la columna y
 * declararla — nunca tocar código.
 */

/** Claves que el pipeline ya usa: un eje custom no puede llamarse así. */
export const RESERVED_AXIS_IDS = Object.freeze([
  'email', 'name', 'department', 'startDate', 'hireDate', 'birthDate',
  'location', 'tenure', 'age', 'active', 'used', 'test', 'custom',
]);

/** Límites de lo «categórico»: más valores o valores más largos = texto libre. */
export const AXIS_LIMITS = Object.freeze({ maxValues: 12, maxValueLength: 40 });

/**
 * Slug estable de una cabecera de columna: minúsculas, sin acentos, separadores
 * a guion bajo. Sin cuantificadores anidados (sin backtracking).
 * @param {string} label
 * @returns {string}
 */
export function axisSlug(label) {
  return String(label ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '');
}

/**
 * Columnas custom presentes en las filas del padrón: id (slug), valores
 * distintos ordenados y en cuántas personas aparece. Base para que People
 * decida cuáles declarar como ejes.
 * @param {ReadonlyArray<{ custom?: Record<string, string> }>|null|undefined} rows
 * @returns {Array<{ id: string, values: string[], count: number }>}
 */
export function customColumnsOf(rows) {
  /** @type {Map<string, { values: Set<string>, count: number }>} */
  const byId = new Map();
  for (const row of rows ?? []) {
    for (const [id, value] of Object.entries(row?.custom ?? {})) {
      const entry = byId.get(id) ?? { values: new Set(), count: 0 };
      entry.count += 1;
      if (String(value).trim()) entry.values.add(String(value).trim());
      byId.set(id, entry);
    }
  }
  return [...byId.entries()]
    .map(([id, e]) => ({ id, values: [...e.values].toSorted((a, b) => a.localeCompare(b)), count: e.count }))
    .toSorted((a, b) => a.id.localeCompare(b.id));
}

/**
 * ¿Es declarable como eje de segmentación? Devuelve null si vale, o el MOTIVO
 * del rechazo (para mostrarlo, no para silenciarlo): ids reservados, sin
 * valores, texto libre (demasiados valores distintos o valores largos).
 * @param {{ id: string, values: string[] }} axis
 * @param {{ maxValues?: number, maxValueLength?: number }} [limits]
 * @returns {string|null}
 */
export function validateAxis(axis, limits = {}) {
  const { maxValues = AXIS_LIMITS.maxValues, maxValueLength = AXIS_LIMITS.maxValueLength } = limits;
  const id = String(axis?.id ?? '');
  if (!id) return 'La columna no tiene nombre utilizable.';
  if (RESERVED_AXIS_IDS.includes(id)) return `«${id}» es una clave reservada del sistema.`;
  const values = axis?.values ?? [];
  if (values.length === 0) return 'La columna no tiene valores: sin valores no hay nada que segmentar.';
  if (values.length > maxValues) {
    return `Tiene ${values.length} valores distintos (máximo ${maxValues}): parece texto libre, y el texto libre reidentifica.`;
  }
  const long = values.find((v) => String(v).length > maxValueLength);
  if (long) return `Hay valores demasiado largos («${String(long).slice(0, 20)}…»): parece texto libre.`;
  return null;
}
