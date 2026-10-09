/**
 * Lista de personas del O2O (RMR-TSK-0662): junta a quien está asignado a mano y
 * a la rama del directorio. A quién va cada O2O se elige en «Para quién».
 */

/** Une la lista manual y la rama del directorio sin repetir a nadie. */
export function mergeO2OPeople(manual, branch) {
  const byId = new Map([...manual, ...branch].map((p) => [p.id, p]));
  return [...byId.values()];
}

