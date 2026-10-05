/**
 * Configuración de la ORGANIZACIÓN (instancia), en /config/org. Datos no secretos
 * y configurables sin rebuild: p.ej. el dominio de email de los empleados
 * (RMR-PCS-0027 · F6), que habilita el acceso base al hub. Se lee en cliente; solo
 * el superadmin lo escribe (reglas de Firestore).
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { normalizeIdentity } from '../tools/admin/domain/orgIdentity.js';
import { logoSrcFrom, logoDarkSrcFrom } from '../tools/admin/domain/orgLogo.js';
import { validateBrandColors } from '../tools/admin/domain/brandColors.js';

/**
 * Colores de marca de la instancia (RMR-TSK-0599), o null si no hay o si no
 * pasan la validación (entonces se queda la marca de GREBLA).
 * @returns {Promise<{ brand: string, accent: string, affective: string }|null>}
 */
export async function getBrandColors() {
  const snap = await getDoc(doc(db, 'config', 'org'));
  const colors = snap.exists() ? snap.data().brandColors : null;
  return colors && validateBrandColors(colors).length === 0 ? colors : null;
}

/**
 * Guarda los colores de marca, o los quita con `null`. Si alguno no llega a AA
 * en claro o en oscuro, NO se guarda: lanza con cada par que falla y su ratio.
 * @param {{ brand: string, accent: string, affective: string }|null} colors
 */
export async function saveBrandColors(colors) {
  if (colors !== null) {
    const errors = validateBrandColors(colors);
    if (errors.length) throw new Error(errors.join(' · '));
  }
  const clean = colors && { brand: colors.brand.toLowerCase(), accent: colors.accent.toLowerCase(), affective: colors.affective.toLowerCase() };
  await setDoc(doc(db, 'config', 'org'), { brandColors: clean }, { merge: true });
}

/**
 * Identidad de la instancia (RMR-TSK-0596): los textos con los que esta
 * organización se reconoce. Un fallo de lectura devuelve los campos vacíos, que
 * es exactamente «sin configurar»: cada rótulo cae a su defecto del producto y la
 * pantalla sigue diciendo algo.
 * @returns {Promise<Record<string, string>>}
 */
export async function getOrgIdentity() {
  try {
    const snap = await getDoc(doc(db, 'config', 'org'));
    return normalizeIdentity(snap.exists() ? snap.data() : null);
  } catch {
    return normalizeIdentity(null);
  }
}

/**
 * Guarda la identidad. `merge` porque `/config/org` tiene más campos que estos y
 * un documento completo se los llevaría por delante. Falla en alto: quien guarda
 * tiene que enterarse de que no se guardó.
 * @param {Record<string, unknown>} patch
 * @returns {Promise<Record<string, string>>} lo que ha quedado guardado
 */
export async function saveOrgIdentity(patch) {
  const limpio = normalizeIdentity(patch);
  await setDoc(doc(db, 'config', 'org'), limpio, { merge: true });
  return limpio;
}

/**
 * Logo de la instancia (RMR-TSK-0598), como data URI listo para un `<img src>`,
 * o null si no hay ninguno configurado —o si lo guardado no es un data URI de un
 * formato aceptado—. Vive en el MISMO documento que la identidad: es parte de
 * cómo se reconoce esta casa.
 * @returns {Promise<string|null>}
 */
export async function getOrgLogo() {
  try {
    const snap = await getDoc(doc(db, 'config', 'org'));
    return logoSrcFrom(snap.exists() ? snap.data() : null);
  } catch {
    return null;
  }
}

/**
 * Los dos logos de la instancia (RMR-TSK-0628): el del tema claro y el del
 * oscuro (que, sin versión propia, es el mismo). Null si no hay logo.
 * @returns {Promise<{ light: string, dark: string }|null>}
 */
export async function getOrgLogos() {
  try {
    const snap = await getDoc(doc(db, 'config', 'org'));
    const data = snap.exists() ? snap.data() : null;
    const light = logoSrcFrom(data);
    return light ? { light, dark: logoDarkSrcFrom(data) } : null;
  } catch {
    return null;
  }
}

/**
 * Logo para el tema oscuro guardado tal cual (o null si no hay versión propia):
 * lo que enseña el editor, no el que acaba pintándose.
 * @returns {Promise<string|null>}
 */
export async function getOrgLogoDark() {
  const snap = await getDoc(doc(db, 'config', 'org'));
  const data = snap.exists() ? snap.data() : null;
  return data?.logoDark && logoDarkSrcFrom(data) === data.logoDark ? data.logoDark : null;
}

/**
 * Guarda (o quita, con `null`) la versión del logo para el tema oscuro.
 * @param {string|null} dataUrl
 */
export async function saveOrgLogoDark(dataUrl) {
  const limpio = dataUrl === null ? null : logoSrcFrom({ logo: dataUrl });
  if (dataUrl !== null && limpio === null) {
    throw new Error('El logo tiene que ser un SVG o un PNG.');
  }
  await setDoc(doc(db, 'config', 'org'), { logoDark: limpio }, { merge: true });
}

/**
 * Guarda (o quita, con `null`) el logo de la instancia. `merge` por lo mismo que
 * la identidad: `/config/org` tiene más campos y un documento completo se los
 * llevaría por delante. Falla en alto: quien sube un logo tiene que enterarse de
 * que no se guardó.
 * @param {string|null} dataUrl
 * @returns {Promise<void>}
 */
export async function saveOrgLogo(dataUrl) {
  const limpio = dataUrl === null ? null : logoSrcFrom({ logo: dataUrl });
  if (dataUrl !== null && limpio === null) {
    throw new Error('El logo tiene que ser un SVG o un PNG.');
  }
  await setDoc(doc(db, 'config', 'org'), { logo: limpio }, { merge: true });
}

/**
 * Dominio de email de los empleados de la instancia, en minúsculas y sin arroba
 * (p.ej. «tribbuapp.com»), o cadena vacía si no está configurado. Cadena vacía
 * significa «sin acceso base por dominio» (la demo pública conserva su landing).
 * @returns {Promise<string>}
 */
export async function getEmployeeDomain() {
  try {
    const snap = await getDoc(doc(db, 'config', 'org'));
    const raw = snap.exists() ? snap.data().employeeDomain : '';
    return (raw ?? '').toString().trim().toLowerCase().replace(/^@/, '');
  } catch {
    return '';
  }
}

/**
 * Etiqueta del nivel SIMBÓLICO en la cima de la pirámide invertida (los usuarios
 * del producto, que no existen como fichas pero a quienes todo el equipo sostiene).
 * Vacío = no se muestra (p.ej. la demo). En la instancia real se configura, p.ej.
 * «Usuarios de TRIBBU». Se guarda en /config/org.usersCrownLabel.
 * @returns {Promise<string>}
 */
export async function getUsersCrownLabel() {
  try {
    const snap = await getDoc(doc(db, 'config', 'org'));
    const raw = snap.exists() ? snap.data().usersCrownLabel : '';
    return (raw ?? '').toString().trim();
  } catch {
    return '';
  }
}
