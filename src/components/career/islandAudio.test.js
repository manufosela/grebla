/**
 * Tests de islandAudio (MC-11). El audio real no suena en tests: se inyecta un
 * AudioContext FALSO (via createContext) que registra los nodos creados y sus
 * start/stop, y se verifica que el grafo se monta y se desmonta sin errores
 * incluso con el contexto en estado 'suspended' (autoplay policy: es el estado
 * en el que quedará hasta un gesto real del usuario).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  IslandAudio,
  VOLUMES,
  fanfarePlan,
  readStoredMuted,
  writeStoredMuted,
} from './islandAudio.js';

/** Parámetro de audio falso: registra el valor y las automatizaciones. */
class FakeParam {
  constructor(value = 0) {
    this.value = value;
    this.calls = [];
  }

  setValueAtTime(v, t) {
    this.calls.push(['set', v, t]);
  }

  linearRampToValueAtTime(v, t) {
    this.calls.push(['linear', v, t]);
  }

  exponentialRampToValueAtTime(v, t) {
    this.calls.push(['exp', v, t]);
  }
}

/** Nodo falso: connect/disconnect/start/stop registrados. `kind` es el tipo
 * de nodo del registro (el código de producción escribe en `type` cosas como
 * 'lowpass' o 'triangle'). */
class FakeNode {
  constructor(ctx, kind) {
    this.ctx = ctx;
    this.kind = kind;
    this.type = '';
    this.gain = new FakeParam(1);
    this.frequency = new FakeParam(0);
    this.Q = new FakeParam(0);
    this.playbackRate = new FakeParam(1);
    this.buffer = null;
    this.loop = false;
    this.started = false;
    this.stopped = false;
    this.connected = [];
    this.onended = null;
  }

  connect(target) {
    this.connected.push(target);
  }

  disconnect() {
    this.connected = [];
  }

  start() {
    this.started = true;
  }

  stop() {
    this.stopped = true;
  }
}

/** AudioContext falso, SIEMPRE 'suspended' (como en headless sin gesto). */
class FakeAudioContext {
  constructor() {
    this.state = 'suspended';
    this.sampleRate = 48000;
    this.currentTime = 0;
    this.destination = new FakeNode(this, 'destination');
    /** @type {FakeNode[]} Todos los nodos creados, por orden. */
    this.nodes = [];
    this.resumed = 0;
    this.suspended = 0;
    this.closed = false;
  }

  _node(kind) {
    const node = new FakeNode(this, kind);
    this.nodes.push(node);
    return node;
  }

  createGain() {
    return this._node('gain');
  }

  createOscillator() {
    return this._node('oscillator');
  }

  createBiquadFilter() {
    return this._node('biquad');
  }

  createBufferSource() {
    return this._node('bufferSource');
  }

  createBuffer(channels, length, sampleRate) {
    return { channels, length, sampleRate, getChannelData: () => new Float32Array(length) };
  }

  resume() {
    this.resumed += 1;
    return Promise.resolve();
  }

  suspend() {
    this.suspended += 1;
    return Promise.resolve();
  }

  close() {
    this.closed = true;
    return Promise.resolve();
  }

  byType(kind) {
    return this.nodes.filter((n) => n.kind === kind);
  }
}

/** IslandAudio con contexto falso inyectado. */
const build = () => {
  const ctx = new FakeAudioContext();
  const audio = new IslandAudio({ createContext: () => ctx });
  return { ctx, audio };
};

describe('fanfarePlan (puro)', () => {
  it('son 3 notas ASCENDENTES con instantes crecientes y duración positiva', () => {
    const plan = fanfarePlan();
    expect(plan).toHaveLength(3);
    for (let i = 1; i < plan.length; i += 1) {
      expect(plan[i].freq).toBeGreaterThan(plan[i - 1].freq);
      expect(plan[i].at).toBeGreaterThan(plan[i - 1].at);
    }
    for (const note of plan) expect(note.dur).toBeGreaterThan(0);
    // 'city' es la variante por defecto (compat MC-11).
    expect(fanfarePlan('city')).toEqual(plan);
  });

  it('la variante island (MC-20) es la fanfarria LARGA: arpegio extendido más acorde final', () => {
    const city = fanfarePlan();
    const island = fanfarePlan('island');
    // Más notas y más duración total que la de certificado.
    expect(island.length).toBeGreaterThan(city.length);
    const endOf = (plan) => Math.max(...plan.map((n) => n.at + n.dur));
    expect(endOf(island)).toBeGreaterThan(endOf(city));
    // Arranca con el MISMO arpegio (es la celebración «que sigue subiendo»).
    expect(island.slice(0, 2)).toEqual(city.slice(0, 2));
    // El tramo de arpegio (todo lo anterior al acorde final) es ascendente en
    // frecuencia e instantes.
    const lastAt = Math.max(...island.map((n) => n.at));
    const arpeggio = island.filter((n) => n.at < lastAt);
    for (let i = 1; i < arpeggio.length; i += 1) {
      expect(arpeggio[i].freq).toBeGreaterThan(arpeggio[i - 1].freq);
      expect(arpeggio[i].at).toBeGreaterThan(arpeggio[i - 1].at);
    }
    // Remata en ACORDE: varias notas simultáneas en el último instante.
    expect(island.filter((n) => n.at === lastAt).length).toBeGreaterThanOrEqual(3);
    for (const note of island) expect(note.dur).toBeGreaterThan(0);
  });
});

describe('persistencia del silencio (sin localStorage: node)', () => {
  it('readStoredMuted devuelve false y writeStoredMuted no lanza', () => {
    expect(readStoredMuted()).toBe(false);
    expect(writeStoredMuted(true)).toBe(true);
    expect(writeStoredMuted(false)).toBe(false);
  });
});

describe('IslandAudio (gating por gesto y grafo de nodos)', () => {
  it('antes de unlock() todo es no-op silencioso (sin contexto, sin errores)', () => {
    const { ctx, audio } = build();
    audio.step();
    audio.fanfare();
    audio.dispose();
    expect(ctx.nodes).toHaveLength(0);
    expect(audio.enabled).toBe(false);
  });

  it('unlock() crea el contexto, el ambiente de olas y pide resume', () => {
    const { ctx, audio } = build();
    audio.unlock();
    expect(audio.enabled).toBe(true);
    // Grafo del ambiente: ruido en bucle + lowpass + ganancia con LFO.
    const sources = ctx.byType('bufferSource');
    expect(sources).toHaveLength(1);
    expect(sources[0].loop).toBe(true);
    expect(sources[0].started).toBe(true);
    expect(ctx.byType('biquad')[0].type).toBe('lowpass');
    const lfo = ctx.byType('oscillator');
    expect(lfo).toHaveLength(1);
    expect(lfo[0].started).toBe(true);
    // Ganancia maestra con su volumen nominal.
    expect(ctx.byType('gain')[0].gain.value).toBe(VOLUMES.master);
    // Con el contexto 'suspended' se pide resume (queda pendiente sin gesto).
    expect(ctx.resumed).toBeGreaterThan(0);
    audio.dispose();
  });

  it('unlock() es idempotente (un solo grafo de ambiente)', () => {
    const { ctx, audio } = build();
    audio.unlock();
    audio.unlock();
    expect(ctx.byType('bufferSource')).toHaveLength(1);
    audio.dispose();
  });

  it('fanfare() crea 3 notas × 2 osciladores (octava de cuerpo) con start/stop', () => {
    const { ctx, audio } = build();
    audio.unlock();
    const before = ctx.byType('oscillator').length;
    audio.fanfare();
    const oscs = ctx.byType('oscillator').slice(before);
    expect(oscs).toHaveLength(6);
    for (const osc of oscs) {
      expect(osc.started).toBe(true);
      expect(osc.stopped).toBe(true); // stop programado: nada queda sonando
    }
    audio.dispose();
  });

  it('fanfare("island") programa la fanfarria larga completa (plan × 2 osciladores)', () => {
    const { ctx, audio } = build();
    audio.unlock();
    const before = ctx.byType('oscillator').length;
    audio.fanfare('island');
    const oscs = ctx.byType('oscillator').slice(before);
    expect(oscs).toHaveLength(fanfarePlan('island').length * 2);
    for (const osc of oscs) {
      expect(osc.started).toBe(true);
      expect(osc.stopped).toBe(true);
    }
    audio.dispose();
  });

  it('step() crea un tick de ruido corto con start/stop programados', () => {
    const { ctx, audio } = build();
    audio.unlock();
    audio.step();
    const burst = ctx.byType('bufferSource').at(-1);
    expect(burst.loop).toBe(false);
    expect(burst.started).toBe(true);
    expect(burst.stopped).toBe(true);
    audio.dispose();
  });

  it('setMuted(true) suspende y persiste; setMuted(false) reanuda', () => {
    const { ctx, audio } = build();
    audio.unlock();
    expect(audio.setMuted(true)).toBe(true);
    expect(ctx.suspended).toBe(1);
    expect(audio.enabled).toBe(false);
    audio.step(); // silenciado: no-op
    expect(ctx.byType('bufferSource')).toHaveLength(1); // solo el ambiente
    expect(audio.setMuted(false)).toBe(false);
    expect(audio.enabled).toBe(true);
    audio.dispose();
  });

  it('con el silencio activo, unlock() NO crea contexto (se crea al reactivar)', () => {
    const { ctx, audio } = build();
    audio.setMuted(true);
    audio.unlock();
    expect(ctx.nodes).toHaveLength(0);
    audio.setMuted(false); // el clic de reactivar es un gesto: ahora sí
    expect(ctx.byType('bufferSource')).toHaveLength(1);
    audio.dispose();
    writeStoredMuted(false);
  });

  it('dispose() para el ambiente, cierra el contexto y deja el objeto reutilizable', () => {
    const { ctx, audio } = build();
    audio.unlock();
    const wave = ctx.byType('bufferSource')[0];
    const lfo = ctx.byType('oscillator')[0];
    audio.dispose();
    expect(wave.stopped).toBe(true);
    expect(lfo.stopped).toBe(true);
    expect(ctx.closed).toBe(true);
    expect(audio.enabled).toBe(false);
    // Reutilizable: un nuevo unlock (nuevo gesto) reconstruye todo.
    const ctx2 = new FakeAudioContext();
    audio._createContext = () => ctx2;
    audio.unlock();
    expect(ctx2.byType('bufferSource')).toHaveLength(1);
    audio.dispose();
  });

  it('la gaviota queda programada y dispose() cancela el timer', () => {
    vi.useFakeTimers();
    try {
      const { audio } = build();
      audio.unlock();
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      audio.dispose();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('sin WebAudio en el runtime (fábrica null) todo es no-op sin errores', () => {
    const audio = new IslandAudio({ createContext: () => null });
    audio.unlock();
    audio.step();
    audio.fanfare();
    audio.setMuted(true);
    audio.setMuted(false);
    audio.dispose();
    expect(audio.enabled).toBe(false);
    writeStoredMuted(false);
  });
});
