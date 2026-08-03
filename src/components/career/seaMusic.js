/**
 * Musiquita de MAR procedural (RMR-TSK-0390): suena mientras se muestra el
 * archipiélago y durante la travesía del barco. Sin assets: WebAudio puro —
 * una melodía suave de aire marinero en 6/8 (péntatónica menor de Re) con un
 * pluck cálido y un bordón grave ocasional. Respeta la preferencia de silencio
 * persistida del HUD (la misma de islandAudio) y se apaga con stop().
 *
 * Como en islandAudio, la ALEATORIEDAD en audio está permitida (ornamentos y
 * elección de octava): es textura, no lógica de juego.
 */
import { readStoredMuted } from './islandAudio.js';

/** Escala pentatónica menor de Re (D3 F3 G3 A3 C4 D4 F4), en Hz. */
const SCALE = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23];
/** Patrón base de la melodía (índices de SCALE; -1 = silencio) en corcheas de 6/8. */
const PATTERN = [0, 2, 3, -1, 4, 3, 2, 0, 1, 2, -1, 0];
/** Duración de corchea (s) a ~84 ppm en 6/8. */
const EIGHTH = 0.36;

export class SeaMusic {
  constructor() {
    /** @type {AudioContext|null} */
    this._ctx = null;
    /** @type {GainNode|null} */
    this._master = null;
    /** Timer del planificador de compases (0 = parado). */
    this._timer = 0;
    /** Próximo instante (ctx.currentTime) a partir del cual programar. */
    this._nextAt = 0;
    /** Paso del patrón por el que va la melodía. */
    this._step = 0;
  }

  get playing() {
    return this._timer !== 0;
  }

  /** Arranca la música (idempotente). Con el audio silenciado, no hace nada. */
  start() {
    if (this._timer || readStoredMuted()) return;
    try {
      const Ctx = globalThis.AudioContext;
      if (!Ctx) return;
      this._ctx = this._ctx ?? new Ctx();
      if (!this._master) {
        this._master = this._ctx.createGain();
        this._master.connect(this._ctx.destination);
      }
      // Cancela cualquier fundido pendiente de un stop() reciente: si no, ese
      // ramp silenciaría la música recién arrancada (cerrar y reabrir rápido).
      const now = this._ctx.currentTime;
      this._master.gain.cancelScheduledValues(now);
      this._master.gain.setValueAtTime(0.11, now);
      if (this._ctx.state === 'suspended') this._ctx.resume?.()?.catch?.(() => {});
      this._nextAt = this._ctx.currentTime + 0.1;
      this._step = 0;
      const schedule = () => {
        if (!this._ctx) return;
        // Planifica por delante hasta ~1.2s (lookahead corto y barato).
        while (this._nextAt < this._ctx.currentTime + 1.2) {
          const idx = PATTERN[this._step % PATTERN.length];
          if (idx >= 0) {
            // Ornamento ocasional: sube una octava una de cada ~7 notas.
            const octave = Math.random() < 0.14 ? 2 : 1;
            this._pluck(SCALE[idx] * octave, this._nextAt, EIGHTH * 0.92);
            // Bordón grave al inicio de compás (cada 6 corcheas), suave.
            if (this._step % 6 === 0) this._pluck(SCALE[0] / 2, this._nextAt, EIGHTH * 4, 0.35);
          }
          this._nextAt += EIGHTH;
          this._step += 1;
        }
        this._timer = globalThis.setTimeout(schedule, 400);
      };
      schedule();
    } catch {
      this.stop(); // runtime sin WebAudio: silencio sin errores
    }
  }

  /** Para la música (idempotente); el contexto queda listo para reanudar. */
  stop() {
    if (this._timer) globalThis.clearTimeout(this._timer);
    this._timer = 0;
    // Corta con un fundido corto lo ya planificado (sin chasquido).
    if (this._ctx && this._master) {
      const t = this._ctx.currentTime;
      this._master.gain.cancelScheduledValues(t);
      this._master.gain.setValueAtTime(this._master.gain.value, t);
      this._master.gain.linearRampToValueAtTime(0.0001, t + 0.25);
    }
  }

  /** Teardown total (al desmontar la app). */
  dispose() {
    this.stop();
    this._ctx?.close?.()?.catch?.(() => {});
    this._ctx = null;
    this._master = null;
  }

  /** Una nota: pluck cálido (triángulo + paso-bajo) con envolvente corta. */
  _pluck(freq, at, dur, level = 0.6) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(lp);
    lp.connect(g);
    g.connect(this._master);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }
}
