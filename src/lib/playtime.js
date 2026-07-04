/**
 * Tracker del TIEMPO DE JUEGO del Mapa de Carrera (MC-23) — la capa FINA de
 * DOM sobre el dominio puro (src/tools/career/domain/playtime.js).
 *
 * Cronómetro de sesión activa: corre mientras la pestaña está VISIBLE y hubo
 * interacción (puntero/tecla/rueda/touch) en los últimos PLAYTIME.idleMs
 * (120 s); se pausa con document.hidden o por inactividad. Acumula en memoria
 * (muestreo cada PLAYTIME.tickMs) y VUELCA vía `onFlush(minutes)`:
 *  - cada PLAYTIME.flushMs (60 s) de juego acumulado,
 *  - al ocultarse la pestaña (visibilitychange → hidden),
 *  - en pagehide (cierre/navegación) y al pararlo (stop()).
 *
 * El volcado es BEST-EFFORT sobre Firestore (no hay sendBeacon para
 * increment()): si el navegador mata la pestaña sin disparar visibilitychange/
 * pagehide, o el write en vuelo no llega a salir, se pierde COMO MÁXIMO
 * ~PLAYTIME.flushMs (60 s) de juego — pérdida documentada y asumida. Un fallo
 * de onFlush no re-encola (console.warn): el SDK de Firestore ya reintenta
 * los writes offline por su cuenta.
 *
 * Los deltas de muestreo mayores de 2 ticks se DESCARTAN (accumulate, puro):
 * un timer suspendido (pestaña dormida, portátil en reposo) no fue juego.
 *
 * QUIÉN mide: el flujo actual de juego (líder/superadmin jugando a la persona
 * seleccionada) — <career-app> solo arranca el tracker con canEdit. El
 * jugador vinculado NO escribe (se ampliará cuando juegue con su cuenta).
 */
import { PLAYTIME, accumulate, isActiveSample, minutesFromMs } from '../tools/career/domain/playtime.js';

/** Eventos de interacción que re-sellan el reloj de actividad. */
const ACTIVITY_EVENTS = Object.freeze(['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']);

/**
 * Arranca el cronómetro de juego. Devuelve el handle para pararlo (con volcado
 * final) o forzar un volcado.
 *
 * @param {{
 *   onFlush: (minutes: number) => void|Promise<void>,
 *   now?: () => number,
 * }} options `onFlush` recibe MINUTOS (> 0) a persistir; `now` inyecta el
 *   reloj (tests).
 * @returns {{ flush: () => void, stop: () => void }}
 */
export function startPlaytimeTracker({ onFlush, now = () => Date.now() }) {
  if (typeof onFlush !== 'function') {
    throw new Error('startPlaytimeTracker requiere un onFlush(minutes) función.');
  }

  let bufferMs = 0;
  // Arrancar cuenta como interacción: el usuario ACABA de elegir persona/mapa.
  let lastActivity = now();
  let lastSample = now();
  let lastFlush = now();
  let stopped = false;

  /** Re-sella el reloj de actividad, con throttle (pointermove va a ráfagas). */
  const onActivity = () => {
    const ts = now();
    if (ts - lastActivity >= PLAYTIME.activityThrottleMs) lastActivity = ts;
  };

  /** Acumula el tramo desde el último muestreo si fue juego activo. */
  const sample = () => {
    const ts = now();
    const visible = document.visibilityState === 'visible';
    if (isActiveSample(visible, lastActivity, ts)) {
      bufferMs = accumulate(bufferMs, ts - lastSample);
    }
    lastSample = ts;
  };

  /** Vuelca el buffer (si supera el mínimo) — best-effort, nunca lanza. */
  const flush = () => {
    if (bufferMs < PLAYTIME.minFlushMs) return;
    const minutes = minutesFromMs(bufferMs);
    bufferMs = 0;
    lastFlush = now();
    try {
      Promise.resolve(onFlush(minutes)).catch((err) => {
        console.warn('Tiempo de juego: no se pudo volcar el incremento.', err);
      });
    } catch (err) {
      console.warn('Tiempo de juego: no se pudo volcar el incremento.', err);
    }
  };

  const tick = () => {
    sample();
    if (now() - lastFlush >= PLAYTIME.flushMs) flush();
  };

  /** La pestaña se oculta → cerrar el tramo y volcar; al volver, re-sellar el
   * muestreo (el hueco oculto no cuenta) sin fingir interacción. */
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      sample();
      flush();
      return;
    }
    lastSample = now();
  };

  /** Cierre/navegación: último volcado best-effort (puede no llegar a salir). */
  const onPageHide = () => {
    sample();
    flush();
  };

  for (const type of ACTIVITY_EVENTS) {
    window.addEventListener(type, onActivity, { passive: true });
  }
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  const interval = setInterval(tick, PLAYTIME.tickMs);

  return {
    /** Volcado manual (cierra el tramo en curso primero). */
    flush() {
      sample();
      flush();
    },
    /** Para el cronómetro: volcado final y retirada de listeners/timer. */
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(interval);
      for (const type of ACTIVITY_EVENTS) {
        window.removeEventListener(type, onActivity);
      }
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      sample();
      flush();
    },
  };
}
