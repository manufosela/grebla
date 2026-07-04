/**
 * Audio procedural de la isla de carrera (MC-11), 100% WebAudio: sin MP3 ni
 * assets. Síntesis de cada sonido:
 *
 *  - OLAS: ruido blanco (buffer generado) en bucle → filtro lowpass grave →
 *    ganancia modulada por un LFO lentísimo (la «respiración» del mar).
 *  - GAVIOTA: chirp muy ocasional — oscilador triangular con glissando
 *    descendente (el «kee-ow») y envolvente corta, 2-3 gritos por pasada.
 *  - PASOS: tick corto de ruido por un bandpass con envolvente de ~70 ms;
 *    el RATE lo pone el llamante (un tick por zancada: proporcional a la
 *    velocidad de marcha, ver career-island-3d).
 *  - FANFARRIA de ciudadanía: tres notas ascendentes (C5-E5-G5, arpegio de
 *    do mayor) con osciladores triangulares y envolvente ataque/caída, más
 *    una octava inferior suave de cuerpo.
 *
 * IMPORTANTE — Math.random SOLO AQUÍ: este módulo es la ÚNICA parte del juego
 * donde se permite aleatoriedad no determinista (relleno del buffer de ruido,
 * intervalo/tono de la gaviota y micro-variación de los pasos). Es audio: la
 * variación no afecta al determinismo de la geometría de la escena (que sigue
 * derivándose de hash+índice, ver islandLayout/walk/celebration).
 *
 * Autoplay policy: el AudioContext se crea/reanuda EXCLUSIVAMENTE desde
 * `unlock()`, que el componente 3D llama en gestos reales del usuario
 * (pointerdown/keydown). Hasta entonces todos los métodos son no-op
 * silenciosos (sin errores). El silenciado persiste en localStorage.
 *
 * Volúmenes: ambiente ~-24 dB relativo (ganancia ≈ 0.06) para que no canse;
 * los one-shot (pasos/fanfarria) algo por encima pero contenidos.
 */

/** Clave de persistencia de la preferencia de silencio. */
const MUTED_KEY = 'grebla:career:audioMuted';

/** Ganancias de cada voz (relativas al master). Olas ≈ -24 dB (10^(-24/20)). */
export const VOLUMES = Object.freeze({
  master: 0.9,
  waves: 0.06,
  seagull: 0.05,
  step: 0.16,
  fanfare: 0.3,
});

/**
 * Plan de la fanfarria de ciudadanía: notas ASCENDENTES (arpegio C5-E5-G5)
 * con su instante de inicio y duración. Puro y exportado para test.
 * @returns {{freq: number, at: number, dur: number}[]}
 */
export function fanfarePlan() {
  return [
    { freq: 523.25, at: 0, dur: 0.2 }, // C5
    { freq: 659.25, at: 0.14, dur: 0.2 }, // E5
    { freq: 783.99, at: 0.28, dur: 0.55 }, // G5, más larga: la nota de llegada
  ];
}

/** Intervalo (ms) entre pasadas de gaviota; el valor concreto es aleatorio. */
export const SEAGULL_INTERVAL = Object.freeze({ minMs: 14000, maxMs: 38000 });

/**
 * Lee la preferencia de silencio persistida (false si no hay localStorage:
 * SSR/estático de Astro o tests en node).
 * @returns {boolean}
 */
export function readStoredMuted() {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(MUTED_KEY) === '1';
}

/**
 * Persiste la preferencia de silencio (no-op sin localStorage).
 * @param {boolean} muted
 * @returns {boolean} El mismo valor, para encadenar.
 */
export function writeStoredMuted(muted) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
  }
  return muted;
}

export class IslandAudio {
  /**
   * @param {{ createContext?: () => (AudioContext|null) }} [opts]
   *   createContext: fábrica del contexto, inyectable para tests (por defecto
   *   `new AudioContext()`, o null si el runtime no tiene WebAudio).
   */
  constructor(opts = {}) {
    /** Preferencia de silencio (persistida). */
    this.muted = readStoredMuted();
    this._createContext =
      opts.createContext ??
      (() => (typeof AudioContext === 'undefined' ? null : new AudioContext()));
    /** @type {AudioContext|null} Creado perezosamente en unlock() (gesto). */
    this._ctx = null;
    /** @type {GainNode|null} Ganancia maestra (todas las voces cuelgan de ella). */
    this._master = null;
    /** Nodos del ambiente de olas (fuente de ruido, LFO), para el teardown. */
    this._waveSource = null;
    this._waveLfo = null;
    /** Buffer de ruido compartido (olas y pasos). @type {AudioBuffer|null} */
    this._noiseBuffer = null;
    /** Timer de la próxima gaviota (0 = sin programar). */
    this._seagullTimer = 0;
  }

  /** true si hay contexto y el audio no está silenciado (se puede sonar). */
  get enabled() {
    return this._ctx !== null && !this.muted;
  }

  /**
   * Crea/reanuda el AudioContext. LLAMAR SOLO DESDE UN GESTO DEL USUARIO
   * (pointerdown/keydown): es lo que permite la autoplay policy. Idempotente y
   * barato: se puede llamar en cada gesto. Con el audio silenciado no crea
   * nada (se creará al reactivar el sonido, que también es un gesto).
   */
  unlock() {
    if (this.muted) return;
    if (!this._ctx) {
      const ctx = this._createContext();
      if (!ctx) return; // runtime sin WebAudio: silencio sin errores
      this._ctx = ctx;
      this._master = ctx.createGain();
      this._master.gain.value = VOLUMES.master;
      this._master.connect(ctx.destination);
      this._startAmbient();
    }
    // resume() puede quedar pendiente si el navegador aún no lo permite: no es
    // un error de la app (sonará al primer gesto válido).
    if (this._ctx.state === 'suspended') this._ctx.resume?.()?.catch?.(() => {});
  }

  /**
   * Silencia/activa el audio y persiste la preferencia. Activar cuenta como
   * gesto (el botón HUD): crea/reanuda el contexto si hace falta.
   * @param {boolean} muted
   * @returns {boolean} El estado aplicado.
   */
  setMuted(muted) {
    this.muted = writeStoredMuted(muted);
    if (muted) {
      this._stopSeagulls();
      this._ctx?.suspend?.()?.catch?.(() => {});
    } else {
      this.unlock();
      if (this._ctx) this._startSeagulls();
    }
    return this.muted;
  }

  // ---- Ambiente: olas y gaviota ------------------------------------------------

  /** Buffer de ruido blanco compartido (Math.random: permitido en audio). */
  _noise() {
    if (this._noiseBuffer) return this._noiseBuffer;
    const ctx = this._ctx;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 1.5), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    this._noiseBuffer = buffer;
    return buffer;
  }

  /**
   * Arranca el ambiente: olas en bucle (ruido → lowpass → ganancia con LFO de
   * amplitud) y programa la primera gaviota. Se llama una vez al crear el
   * contexto; el silencio se gestiona con suspend() (los nodos siguen vivos).
   */
  _startAmbient() {
    const ctx = this._ctx;
    // Olas: ruido lowpass-eado con la ganancia «respirando» al ritmo del LFO.
    const source = ctx.createBufferSource();
    source.buffer = this._noise();
    source.loop = true;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 380;
    lowpass.Q.value = 0.7;
    const waveGain = ctx.createGain();
    waveGain.gain.value = VOLUMES.waves;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08; // una «ola» cada ~12 s
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = VOLUMES.waves * 0.6; // la ganancia oscila ±60%
    lfo.connect(lfoDepth);
    lfoDepth.connect(waveGain.gain);
    source.connect(lowpass);
    lowpass.connect(waveGain);
    waveGain.connect(this._master);
    source.start();
    lfo.start();
    this._waveSource = source;
    this._waveLfo = lfo;
    this._startSeagulls();
  }

  /** Programa la próxima gaviota en un intervalo aleatorio (audio: permitido). */
  _startSeagulls() {
    if (this._seagullTimer || !this._ctx) return;
    const { minMs, maxMs } = SEAGULL_INTERVAL;
    const delay = minMs + Math.random() * (maxMs - minMs);
    this._seagullTimer = setTimeout(() => {
      this._seagullTimer = 0;
      if (this.enabled) this._seagull();
      this._startSeagulls();
    }, delay);
  }

  _stopSeagulls() {
    if (this._seagullTimer) clearTimeout(this._seagullTimer);
    this._seagullTimer = 0;
  }

  /**
   * Grito de gaviota: 2-3 «kee-ow» (glissando descendente con envolvente
   * corta), con tono ligeramente aleatorio por pasada (audio: permitido).
   */
  _seagull() {
    const ctx = this._ctx;
    const cries = 2 + (Math.random() < 0.4 ? 1 : 0);
    const pitch = 0.9 + Math.random() * 0.25;
    for (let i = 0; i < cries; i += 1) {
      const at = ctx.currentTime + i * 0.42;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1350 * pitch, at);
      osc.frequency.exponentialRampToValueAtTime(880 * pitch, at + 0.22);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(VOLUMES.seagull, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
      osc.connect(gain);
      gain.connect(this._master);
      osc.start(at);
      osc.stop(at + 0.3);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }
  }

  // ---- One-shots: pasos y fanfarria ----------------------------------------------

  /**
   * Un paso: tick suave de ruido corto (bandpass + envolvente de ~70 ms). El
   * llamante lo dispara UNA vez por zancada, así el rate es proporcional a la
   * velocidad de marcha. Micro-variación de tono por paso (audio: permitido).
   */
  step() {
    if (!this.enabled) return;
    const ctx = this._ctx;
    const at = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this._noise();
    source.playbackRate.value = 0.9 + Math.random() * 0.25;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 560;
    bandpass.Q.value = 1.1;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(VOLUMES.step, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
    source.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(this._master);
    source.start(at);
    source.stop(at + 0.08);
    source.onended = () => {
      source.disconnect();
      bandpass.disconnect();
      gain.disconnect();
    };
  }

  /**
   * Fanfarria de ciudadanía: el arpegio ascendente de fanfarePlan() con
   * osciladores triangulares (más una octava inferior suave de cuerpo) y
   * envolvente ataque rápido / caída exponencial.
   */
  fanfare() {
    if (!this.enabled) return;
    const ctx = this._ctx;
    const base = ctx.currentTime;
    for (const { freq, at, dur } of fanfarePlan()) {
      for (const [f, level] of [
        [freq, VOLUMES.fanfare],
        [freq / 2, VOLUMES.fanfare * 0.35], // octava inferior: cuerpo
      ]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = f;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, base + at);
        gain.gain.linearRampToValueAtTime(level, base + at + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, base + at + dur);
        osc.connect(gain);
        gain.connect(this._master);
        osc.start(base + at);
        osc.stop(base + at + dur + 0.05);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
      }
    }
  }

  // ---- Limpieza ------------------------------------------------------------------

  /**
   * Teardown TOTAL: para el ambiente, cancela la gaviota, desconecta el master
   * y cierra el contexto. El objeto queda reutilizable: un unlock() posterior
   * (nuevo gesto tras re-montar el componente) vuelve a crear todo.
   */
  dispose() {
    this._stopSeagulls();
    // stop() lanza si la fuente no llegó a arrancar: absorbido a propósito.
    try {
      this._waveSource?.stop();
    } catch {
      /* fuente sin arrancar */
    }
    try {
      this._waveLfo?.stop();
    } catch {
      /* LFO sin arrancar */
    }
    this._waveSource = null;
    this._waveLfo = null;
    this._noiseBuffer = null;
    this._master?.disconnect();
    this._master = null;
    this._ctx?.close?.()?.catch?.(() => {});
    this._ctx = null;
  }
}
