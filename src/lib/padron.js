/**
 * Padrón de empresa (RMR-TSK-0333): personas + metadatos que alimentan la
 * segmentación de las encuestas. Lo gestiona People (superadmin o gestor de
 * encuestas). Escribe /padron directamente (las reglas lo permiten). El padrón es
 * DATOS, no cuentas: no provisiona uid ni auth; los tokens de una encuesta se
 * generarán a partir de él (Fase 2). Guarda la FECHA DE NACIMIENTO (la edad se
 * calcula al vuelo).
 */
import { doc, collection, addDoc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, query, orderBy } from 'firebase/firestore';
import { db } from './firebase.js';

const COL = 'padron';

/** Normaliza una persona del padrón (email en minúsculas, campos ausentes a null). */
function clean(person) {
  return {
    email: String(person.email ?? '').trim().toLowerCase(),
    name: person.name ?? null,
    department: person.department ?? null,
    hireDate: person.hireDate ?? null,
    birthDate: person.birthDate ?? null,
    location: person.location ?? null,
    active: person.active !== false,
    // Campos custom (RMR-TSK-0355): columnas arbitrarias del CSV, por slug.
    ...(person.custom && Object.keys(person.custom).length > 0 ? { custom: person.custom } : {}),
  };
}

/** Doc de EJES declarados (RMR-TSK-0355): vive dentro de /padron para heredar
 *  su regla (People); listPadron lo excluye (no es una persona). */
const AXES_DOC = '_axes';

/** Todo el padrón, ordenado por email. */
export async function listPadron() {
  const snap = await getDocs(query(collection(db, COL), orderBy('email')));
  return snap.docs.filter((d) => d.id !== AXES_DOC).map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Ejes de segmentación a medida declarados: [{ id, label }]. Sin doc → [].
 * @returns {Promise<Array<{ id: string, label: string }>>}
 */
export async function getPadronAxes() {
  const snap = await getDoc(doc(db, COL, AXES_DOC));
  const axes = snap.exists() ? snap.data().axes : null;
  return Array.isArray(axes)
    ? axes
        .filter((a) => a && typeof a.id === 'string' && a.id)
        .map((a) => ({ id: a.id, label: typeof a.label === 'string' && a.label ? a.label : a.id }))
    : [];
}

/**
 * Guarda la declaración de ejes (reemplaza la lista completa: declarar y
 * retirar se hace desde la misma pantalla del padrón).
 * @param {Array<{ id: string, label: string }>} axes
 */
export function savePadronAxes(axes) {
  return setDoc(doc(db, COL, AXES_DOC), { axes });
}

/** Alta manual de una persona. @returns {Promise<string>} id */
export async function addPadronPerson(data) {
  const ref = await addDoc(collection(db, COL), clean(data));
  return ref.id;
}

/** Edita valores de una persona (corregir errores, rotación de departamento…). */
export function updatePadronPerson(id, patch) {
  return updateDoc(doc(db, COL, id), patch);
}

/** Borra a una persona (dejó la empresa). */
export function deletePadronPerson(id) {
  return deleteDoc(doc(db, COL, id));
}

/**
 * Importa/actualiza el padrón desde filas parseadas (CSV). Upsert por email:
 * actualiza las existentes (solo los campos que trae el CSV, sin pisar con
 * vacíos) y añade las nuevas. En lotes para respetar el límite de batch.
 * @param {Array<{email:string,name?:string,department?:string,hireDate?:string,birthDate?:string,location?:string}>} rows
 * @returns {Promise<{ added: number, updated: number }>}
 */
export async function importPadron(rows) {
  const existing = await listPadron();
  const idByEmail = new Map(existing.map((p) => [String(p.email ?? '').toLowerCase(), p.id]));
  let batch = writeBatch(db);
  let pending = 0;
  let added = 0;
  let updated = 0;
  for (const row of rows ?? []) {
    const email = String(row.email ?? '').trim().toLowerCase();
    if (!email) continue;
    const id = idByEmail.get(email);
    if (id) {
      const patch = {};
      for (const key of ['name', 'department', 'hireDate', 'birthDate', 'location']) {
        if (row[key]) patch[key] = row[key];
      }
      // Campos custom por clave (dot-path): re-subir el CSV actualiza cada eje
      // sin pisar los custom que no vengan en esta subida (RMR-TSK-0355).
      for (const [key, value] of Object.entries(row.custom ?? {})) {
        if (value) patch[`custom.${key}`] = value;
      }
      batch.update(doc(db, COL, id), patch);
      updated += 1;
    } else {
      batch.set(doc(collection(db, COL)), clean({ ...row, active: true }));
      added += 1;
    }
    pending += 1;
    if (pending >= 400) { await batch.commit(); batch = writeBatch(db); pending = 0; }
  }
  if (pending > 0) await batch.commit();
  return { added, updated };
}
