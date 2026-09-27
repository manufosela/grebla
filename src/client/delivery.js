/**
 * Glue de «Entrega» (RMR-TSK-0602): pide las métricas al portal a través de la
 * Cloud Function —que es quien tiene el bearer— y se las da al componente.
 *
 * Si falla, se pasa el MOTIVO y no una pantalla vacía: «el portal aún no ha
 * calculado», «no reconoce la credencial» y «no responde» se arreglan de formas
 * distintas, y unos ceros se leerían como «no entregamos», que es una respuesta
 * en vez de un error.
 */
import '../components/delivery/delivery-app.js';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { canGovern } from '../lib/accessRoles.js';
import { guardToolPage } from '../lib/toolGate.js';
import { httpsCallable } from 'firebase/functions';
import { getRegionalFunctions } from '../lib/firebase.js';
import { readPortalMetrics } from '../tools/metrics/domain/portalMetrics.js';

const el = document.querySelector('delivery-app');

/** Lo que se le enseña a una persona según por qué no se pudo leer. */
const MENSAJES = {
  'sin-calcular': 'El portal está en pie pero todavía no ha calculado las métricas. Vuelve a intentarlo en un rato.',
  credencial: 'El portal no reconoce a GREBLA. Seguramente el token se ha rotado y hay que ponerlo al día.',
  'no-configurado': 'Esta instancia no tiene configurado el portal de métricas.',
  caido: 'El portal de métricas no ha respondido.',
};

/** El motivo viaja en `details.reason`; sin él, se dice lo genérico. */
function motivoDe(err) {
  const reason = err?.details?.reason;
  return MENSAJES[reason] ?? 'No se pudo hablar con el portal de métricas.';
}

onUserChanged(async (user) => {
  if (!user || !el) return;
  let access = null;
  try { access = await resolveAccess(user); } catch { /* sin acceso resuelto */ }
  const gate = await guardToolPage('entrega', user, { isSuperadmin: canGovern(access), appEl: el });
  if (!gate) return;

  try {
    // `getRegionalFunctions` y no `getFunctions` a secas: apunta al emulador en
    // los E2E, que es donde se comprueba que esta pantalla dice lo que debe
    // cuando el portal falla.
    const call = httpsCallable(await getRegionalFunctions(), 'getPortalMetrics');
    const { data } = await call();
    el.metrics = readPortalMetrics(data?.metrics);
  } catch (err) {
    console.error('[entrega] no se pudieron leer las métricas:', err);
    // Un contrato que no entendemos NO es un fallo del portal: es que esta
    // versión de GREBLA se ha quedado atrás, y conviene decirlo como tal.
    const message = err?.message?.includes('schemaVersion')
      ? 'El portal habla una versión del contrato que esta versión de GREBLA no sabe leer. Hay que actualizarla.'
      : motivoDe(err);
    el.error = { message, reason: err?.details?.reason ?? null };
  }
});
