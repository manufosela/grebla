/**
 * Configuración de la ORGANIZACIÓN (instancia), en /config/org. Datos no secretos
 * y configurables sin rebuild: p.ej. el dominio de email de los empleados
 * (RMR-PCS-0027 · F6), que habilita el acceso base al hub. Se lee en cliente; solo
 * el superadmin lo escribe (reglas de Firestore).
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase.js';

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
