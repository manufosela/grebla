/**
 * <game-dialog> (JG-8): escena GENÉRICA de conversación con un personaje del
 * juego, estilo aventura gráfica (Monkey Island): retrato procedural del
 * personaje sobre fondo oscuro con viñeta, BOCADILLOS con texto progresivo
 * (máquina de escribir, saltable con clic/Enter) y cola apuntando al
 * personaje, avance con «▼», paso de PREGUNTA (textarea del jugador), efecto
 * de TRANCE (el retrato tiembla y brilla en púrpura con chispas ✨) y opciones
 * en el bocadillo (choices v1). La lógica del guion es la máquina PURA de
 * dialogScript.js; aquí vive solo la presentación (timers, canvas, eventos).
 *
 * API:
 *  - character: { name, portrait } — portrait es una CLAVE del registro de
 *    retratos procedurales (GAME_PORTRAITS, p. ej. 'brujo') o una función
 *    (ctx, size) que dibuja el retrato en un canvas 2D. Sin assets externos.
 *  - script: pasos del guion (ver dialogScript.js). Cambiarlo reinicia la escena.
 *  - busy: deshabilita formulario/opciones mientras el host resuelve algo.
 *  - error: mensaje de error del host junto al formulario (envío fallido).
 *
 * Eventos (composed):
 *  - 'dialog-submit' { text }  → el jugador envió texto en un paso 'ask'.
 *  - 'dialog-choice' { id }    → el jugador pulsó una opción de un 'choices'.
 *  - 'dialog-end'              → el guion terminó (último paso avanzado).
 * Tras 'dialog-submit'/'dialog-choice' la escena queda ESPERANDO: el host
 * llama a continueWith(pasos) para seguir (o deja `error` puesto y el paso
 * sigue vivo para reintentar).
 *
 * Accesibilidad: el texto COMPLETO de cada paso se anuncia en una región
 * aria-live (el bocadillo animado va aria-hidden), todo se maneja por teclado
 * (botón «▼», formulario y opciones son controles reales) y
 * prefers-reduced-motion salta la máquina de escribir y las animaciones del
 * trance.
 */
import { LitElement, html, css } from 'lit';
import {
  createDialog,
  currentStep,
  isDone,
  advance,
  continueDialog,
  validateSubmission,
  assertChoice,
} from './dialogScript.js';

/** Lado (px) del canvas del retrato (se escala por CSS, nítido en @2x). */
const PORTRAIT_SIZE = 240;

/** Milisegundos por carácter de la máquina de escribir. */
const TYPE_MS = 22;

/** Duración del trance (ms) antes de avanzar solo al siguiente paso. */
const TRANCE_MS = 2400;

/** Trance con reduced-motion: sin animación, solo una pausa corta legible. */
const TRANCE_REDUCED_MS = 900;

/**
 * Retrato del BRUJO, procedural y DETERMINISTA (canvas 2D, sin assets):
 * cara en sombra bajo una capucha púrpura, ojos brillantes, collar de huesos
 * y plumas — low-fi con encanto, a lo Monkey Island. Todas las coordenadas
 * son fracciones del lado para que escale con PORTRAIT_SIZE.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} s Lado del canvas (px).
 */
export function drawBrujoPortrait(ctx, s) {
  const u = s / 100; // unidad: 1% del lado
  // Fondo: interior de la cabaña, penumbra violácea con viñeta.
  const bg = ctx.createRadialGradient(50 * u, 42 * u, 6 * u, 50 * u, 50 * u, 70 * u);
  bg.addColorStop(0, '#241a3d');
  bg.addColorStop(0.65, '#161028');
  bg.addColorStop(1, '#0a0714');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, s, s);
  // Estrellitas fijas de atrezzo (deterministas, nada de aleatorio).
  ctx.fillStyle = 'rgba(244, 201, 107, 0.55)';
  for (const [x, y, r] of [[14, 16, 1.1], [86, 12, 0.9], [78, 30, 0.7], [10, 44, 0.8], [90, 52, 0.7]]) {
    ctx.beginPath();
    ctx.arc(x * u, y * u, r * u, 0, Math.PI * 2);
    ctx.fill();
  }
  // Hombros/túnica: masa oscura en la base.
  ctx.fillStyle = '#2c1e4a';
  ctx.beginPath();
  ctx.moveTo(8 * u, 100 * u);
  ctx.quadraticCurveTo(18 * u, 66 * u, 50 * u, 64 * u);
  ctx.quadraticCurveTo(82 * u, 66 * u, 92 * u, 100 * u);
  ctx.closePath();
  ctx.fill();
  // Capucha púrpura: campana con pico ladeado (el toque «retorcido»).
  ctx.fillStyle = '#4a2e73';
  ctx.beginPath();
  ctx.moveTo(22 * u, 62 * u);
  ctx.quadraticCurveTo(16 * u, 26 * u, 44 * u, 12 * u);
  ctx.quadraticCurveTo(52 * u, 4 * u, 60 * u, 10 * u); // pico caído
  ctx.quadraticCurveTo(56 * u, 14 * u, 58 * u, 18 * u);
  ctx.quadraticCurveTo(82 * u, 30 * u, 78 * u, 62 * u);
  ctx.quadraticCurveTo(50 * u, 70 * u, 22 * u, 62 * u);
  ctx.closePath();
  ctx.fill();
  // Sombreado lateral de la capucha (luz desde la izquierda).
  ctx.fillStyle = 'rgba(20, 12, 40, 0.45)';
  ctx.beginPath();
  ctx.moveTo(60 * u, 12 * u);
  ctx.quadraticCurveTo(82 * u, 30 * u, 78 * u, 62 * u);
  ctx.quadraticCurveTo(66 * u, 66 * u, 56 * u, 66 * u);
  ctx.quadraticCurveTo(68 * u, 40 * u, 60 * u, 12 * u);
  ctx.closePath();
  ctx.fill();
  // Hueco de la capucha: casi negro — la cara vive en la sombra.
  ctx.fillStyle = '#0c081a';
  ctx.beginPath();
  ctx.ellipse(50 * u, 44 * u, 19 * u, 22 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  // Media cara visible abajo: piel verdosa apagada (mentón y nariz).
  ctx.fillStyle = '#3d5747';
  ctx.beginPath();
  ctx.ellipse(50 * u, 54 * u, 12 * u, 9 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(12, 8, 26, 0.55)'; // la sombra recorta la frente
  ctx.beginPath();
  ctx.ellipse(50 * u, 47 * u, 14 * u, 8 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  // Sonrisa fina de quien sabe cosas.
  ctx.strokeStyle = '#1c2a20';
  ctx.lineWidth = 0.9 * u;
  ctx.beginPath();
  ctx.moveTo(44 * u, 57 * u);
  ctx.quadraticCurveTo(50 * u, 60 * u, 56 * u, 57 * u);
  ctx.stroke();
  // Ojos BRILLANTES en la sombra (halo + pupila).
  for (const ex of [43, 57]) {
    const glow = ctx.createRadialGradient(ex * u, 41 * u, 0.4 * u, ex * u, 41 * u, 5 * u);
    glow.addColorStop(0, 'rgba(255, 240, 170, 0.95)');
    glow.addColorStop(0.45, 'rgba(244, 201, 107, 0.55)');
    glow.addColorStop(1, 'rgba(244, 201, 107, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(ex * u, 41 * u, 5 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(ex * u, 41 * u, 1.6 * u, 0, Math.PI * 2);
    ctx.fill();
  }
  // Collar: cuerda y piezas colgando (huesos, plumas y una cuenta).
  ctx.strokeStyle = '#8a6b3f';
  ctx.lineWidth = 1.2 * u;
  ctx.beginPath();
  ctx.moveTo(32 * u, 70 * u);
  ctx.quadraticCurveTo(50 * u, 84 * u, 68 * u, 70 * u);
  ctx.stroke();
  /** Un huesecillo vertical del collar. @param {number} x @param {number} y */
  const bone = (x, y) => {
    ctx.fillStyle = '#e8e0cc';
    ctx.fillRect((x - 1.1) * u, y * u, 2.2 * u, 7 * u);
    for (const dy of [0, 7]) {
      ctx.beginPath();
      ctx.arc((x - 1.1) * u, (y + dy) * u, 1.3 * u, 0, Math.PI * 2);
      ctx.arc((x + 1.1) * u, (y + dy) * u, 1.3 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  bone(40, 74);
  bone(60, 74);
  bone(50, 79);
  /** Una pluma caída del collar. @param {number} x @param {number} y @param {string} color */
  const feather = (x, y, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x * u, (y + 4) * u, 1.7 * u, 4.4 * u, 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(12, 8, 26, 0.5)';
    ctx.lineWidth = 0.5 * u;
    ctx.beginPath();
    ctx.moveTo(x * u, y * u);
    ctx.lineTo(x * u, (y + 8) * u);
    ctx.stroke();
  };
  feather(34.5, 71, '#e26d5e'); // coral GREBLA
  feather(65.5, 71, '#2a9d8f'); // teal GREBLA
  // Cuenta violeta central: el guiño a la luz de respuesta.
  ctx.fillStyle = '#9d4edd';
  ctx.beginPath();
  ctx.arc(50 * u, 87 * u, 2.2 * u, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Registro de retratos procedurales por clave (para pasar `portrait` como
 * string desde el host). Los personajes futuros añaden aquí su función.
 * @type {Readonly<Record<string, (ctx: CanvasRenderingContext2D, size: number) => void>>}
 */
export const GAME_PORTRAITS = Object.freeze({ brujo: drawBrujoPortrait });

export class GameDialog extends LitElement {
  static properties = {
    character: { attribute: false },
    script: { attribute: false },
    busy: { attribute: false, type: Boolean },
    error: { attribute: false },
    _dialog: { state: true },
    _typed: { state: true },
    _hint: { state: true },
  };

  static styles = css`
    :host {
      display: block;
      /* Tokens con defaults propios: el host puede teñir la escena. */
      --gd-ink: #f3ecd8;
      --gd-accent: #9d4edd;
    }
    .scene {
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      padding: 1rem;
      min-height: 15rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      cursor: pointer;
      /* Interior de la cabaña: penumbra con viñeta. */
      background:
        radial-gradient(circle at 30% 20%, rgba(157, 78, 221, 0.16), transparent 45%),
        radial-gradient(circle at 50% 45%, rgba(36, 26, 61, 0.9), rgba(10, 7, 20, 0.98) 78%),
        #0a0714;
      box-shadow: inset 0 0 60px rgba(0, 0, 0, 0.8);
    }
    .stage {
      display: flex;
      align-items: flex-end;
      gap: 0.9rem;
    }
    .actor {
      margin: 0;
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.3rem;
    }
    .actor canvas {
      width: clamp(96px, 26vw, 130px);
      height: auto;
      border-radius: 10px;
      border: 1px solid rgba(157, 78, 221, 0.35);
      display: block;
    }
    .actor figcaption {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: var(--gd-ink);
      opacity: 0.85;
    }
    /* TRANCE: el retrato tiembla y brilla púrpura; chispas ✨ suben. */
    .scene.trance .actor canvas {
      animation:
        gd-shake 0.22s linear infinite,
        gd-glow 1.1s ease-in-out infinite alternate;
    }
    @keyframes gd-shake {
      0% { transform: translate(0, 0) rotate(0deg); }
      25% { transform: translate(1.5px, -1px) rotate(0.6deg); }
      50% { transform: translate(-1.5px, 1px) rotate(-0.6deg); }
      75% { transform: translate(1px, 1.5px) rotate(0.4deg); }
      100% { transform: translate(0, 0) rotate(0deg); }
    }
    @keyframes gd-glow {
      from { filter: drop-shadow(0 0 4px rgba(157, 78, 221, 0.5)) saturate(1); }
      to { filter: drop-shadow(0 0 16px rgba(190, 120, 255, 0.95)) saturate(1.5); }
    }
    .spark {
      position: absolute;
      font-size: 0.9rem;
      pointer-events: none;
      animation: gd-spark 1.3s ease-out infinite;
      opacity: 0;
    }
    @keyframes gd-spark {
      0% { transform: translateY(0) scale(0.7); opacity: 0; }
      25% { opacity: 1; }
      100% { transform: translateY(-3.2rem) scale(1.15); opacity: 0; }
    }
    /* Bocadillo tipo Monkey Island: papel claro con cola hacia el personaje. */
    .bubble {
      position: relative;
      align-self: flex-start;
      max-width: 34rem;
      background: #f6eed6;
      color: #241a3d;
      border: 2px solid #241a3d;
      border-radius: 14px;
      padding: 0.7rem 0.9rem;
      margin-bottom: 1.4rem;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
    }
    .bubble::after {
      /* Cola apuntando al retrato (abajo-izquierda del bocadillo). */
      content: '';
      position: absolute;
      left: 1.4rem;
      bottom: -0.95rem;
      width: 1.1rem;
      height: 1.1rem;
      background: #f6eed6;
      border-right: 2px solid #241a3d;
      border-bottom: 2px solid #241a3d;
      transform: skewX(24deg) rotate(58deg);
    }
    .bubble p {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.45;
      white-space: pre-wrap;
      min-height: 1.45em;
    }
    .bubble .next {
      position: absolute;
      right: 0.45rem;
      bottom: 0.2rem;
      border: none;
      background: transparent;
      color: #241a3d;
      font-size: 0.8rem;
      cursor: pointer;
      padding: 0.1rem 0.3rem;
      animation: gd-blink 1s steps(2, start) infinite;
    }
    .bubble .next:focus-visible {
      outline: 2px solid var(--gd-accent);
      border-radius: 4px;
      animation: none;
    }
    @keyframes gd-blink {
      50% { opacity: 0.15; }
    }
    .bubble.trance-bubble {
      background: #2c1e4a;
      color: #e6d6ff;
      border-color: #9d4edd;
      font-style: italic;
    }
    .bubble.trance-bubble::after {
      background: #2c1e4a;
      border-color: #9d4edd;
    }
    /* Opciones del bocadillo (choices v1). */
    .choices {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      margin-top: 0.55rem;
    }
    .choices button,
    .form button {
      border: 1px solid #241a3d;
      border-radius: 8px;
      background: #2a9d8f;
      color: #fff;
      font: inherit;
      font-size: 0.85rem;
      font-weight: 700;
      padding: 0.35rem 0.8rem;
      cursor: pointer;
    }
    .choices button:disabled,
    .form button:disabled {
      opacity: 0.55;
      cursor: default;
    }
    /* Formulario del paso 'ask': el jugador escribe su consulta. */
    .form {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      cursor: auto;
    }
    .form label {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--gd-ink);
    }
    .form textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 0.5rem 0.6rem;
      border-radius: 8px;
      border: 1px solid rgba(157, 78, 221, 0.5);
      background: rgba(246, 238, 214, 0.96);
      color: #241a3d;
      font: inherit;
      font-size: 0.88rem;
      resize: vertical;
    }
    .form button {
      align-self: flex-start;
    }
    .formerror {
      margin: 0;
      font-size: 0.8rem;
      font-weight: 700;
      color: #ffb4a8;
    }
    .sr-live {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    @media (prefers-reduced-motion: reduce) {
      .scene.trance .actor canvas,
      .spark,
      .bubble .next {
        animation: none;
      }
      .scene.trance .actor canvas {
        filter: drop-shadow(0 0 12px rgba(190, 120, 255, 0.9));
      }
    }
  `;

  constructor() {
    super();
    /** @type {{ name: string, portrait: string|((ctx: CanvasRenderingContext2D, size: number) => void) }|null} */
    this.character = null;
    /** @type {ReadonlyArray<import('./dialogScript.js').DialogStep>|null} */
    this.script = null;
    this.busy = false;
    this.error = '';
    /** Estado de la máquina pura del guion, o null sin guion. @type {import('./dialogScript.js').DialogState|null} */
    this._dialog = null;
    /** Caracteres ya «tecleados» del texto del paso actual. */
    this._typed = 0;
    /** Error LOCAL del formulario (texto vacío), distinto del error del host. */
    this._hint = '';
    /** Timer de la máquina de escribir (interval) y del trance (timeout). */
    this._typeTimer = 0;
    this._tranceTimer = 0;
    /** true cuando el textarea del paso 'ask' actual ya recibió el foco. */
    this._askFocused = false;
    /** true si el usuario prefiere reducir el movimiento (sin typewriter). */
    this._reducedMotion =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._clearTimers();
  }

  /** @param {Map<string, unknown>} changed */
  willUpdate(changed) {
    // Cambiar el guion reinicia la escena (nueva conversación).
    if (changed.has('script')) {
      this._clearTimers();
      this._hint = '';
      this._dialog = this.script?.length ? createDialog(this.script) : null;
      if (this._dialog) this._beginStep();
    }
  }

  /** @param {Map<string, unknown>} changed */
  updated(changed) {
    if (changed.has('character')) this._paintPortrait();
    // El textarea del paso 'ask' recibe el foco al APARECER (una vez por
    // paso: el flag evita robar el foco en re-renders posteriores).
    if (this._step()?.kind === 'ask' && this._typingDone && !this._askFocused) {
      const textarea = this.renderRoot.querySelector('textarea');
      if (textarea) {
        textarea.focus();
        this._askFocused = true;
      }
    }
  }

  firstUpdated() {
    this._paintPortrait();
  }

  /** Paso actual del guion (o null). */
  _step() {
    return this._dialog ? currentStep(this._dialog) : null;
  }

  /** Texto del bocadillo del paso actual ('' si el paso no habla). */
  _stepText() {
    return this._step()?.text ?? '';
  }

  /** true si la máquina de escribir terminó el texto del paso actual. */
  get _typingDone() {
    return this._typed >= this._stepText().length;
  }

  /** Limpia los timers de typewriter y trance. */
  _clearTimers() {
    clearInterval(this._typeTimer);
    this._typeTimer = 0;
    clearTimeout(this._tranceTimer);
    this._tranceTimer = 0;
  }

  /** Arranca la presentación del paso actual: typewriter y, si toca, trance. */
  _beginStep() {
    this._clearTimers();
    this._askFocused = false;
    const step = this._step();
    if (!step) return;
    const text = this._stepText();
    // Reduced-motion (o pasos sin texto): el texto aparece completo.
    this._typed = this._reducedMotion ? text.length : 0;
    if (!this._typingDone) {
      this._typeTimer = setInterval(() => {
        this._typed += 1;
        if (this._typingDone) {
          clearInterval(this._typeTimer);
          this._typeTimer = 0;
        }
      }, TYPE_MS);
    }
    // El trance avanza SOLO al terminar su animación (clic lo salta).
    if (step.kind === 'effect' && step.effect === 'trance') {
      this._tranceTimer = setTimeout(
        () => this._advance(),
        this._reducedMotion ? TRANCE_REDUCED_MS : TRANCE_MS,
      );
    }
  }

  /** Completa el typewriter de golpe (clic/Enter durante el tecleo). */
  _completeTyping() {
    clearInterval(this._typeTimer);
    this._typeTimer = 0;
    this._typed = this._stepText().length;
  }

  /** Avanza un paso narrativo y anuncia el final del guion si toca. */
  _advance() {
    if (!this._dialog || isDone(this._dialog)) return;
    this._clearTimers();
    this._dialog = advance(this._dialog);
    if (isDone(this._dialog)) {
      this.dispatchEvent(new CustomEvent('dialog-end', { bubbles: true, composed: true }));
    } else {
      this._beginStep();
    }
  }

  /**
   * Continúa el guion tras resolver el host un 'ask'/'choices' (o para
   * encadenar pasos nuevos): encola `steps` y pasa al siguiente.
   * @param {ReadonlyArray<unknown>} [steps]
   */
  continueWith(steps = []) {
    if (!this._dialog || isDone(this._dialog)) return;
    this._clearTimers();
    this._hint = '';
    this._dialog = continueDialog(this._dialog, steps);
    if (isDone(this._dialog)) {
      this.dispatchEvent(new CustomEvent('dialog-end', { bubbles: true, composed: true }));
    } else {
      this._beginStep();
    }
  }

  /**
   * Clic en la escena (conveniencia de puntero): completa el tecleo o avanza
   * un paso narrativo. Los controles interactivos paran la propagación.
   */
  _onSceneClick() {
    const step = this._step();
    if (!step) return;
    if (!this._typingDone) {
      this._completeTyping();
      return;
    }
    if (step.kind === 'say') this._advance();
    if (step.kind === 'effect') this._advance(); // saltar el trance
  }

  /** Botón «▼»: mismo gesto que el clic en escena, accesible por teclado. */
  _onNextClick(event) {
    event.stopPropagation();
    this._onSceneClick();
  }

  /** Envío del formulario del paso 'ask' (botón o Ctrl+Enter). */
  _submitAsk(event) {
    event.stopPropagation();
    if (this.busy || !this._dialog) return;
    const textarea = /** @type {HTMLTextAreaElement|null} */ (
      this.renderRoot.querySelector('textarea')
    );
    let text = '';
    try {
      text = validateSubmission(this._dialog, textarea?.value);
    } catch (err) {
      this._hint = err instanceof Error ? err.message : 'Escribe algo antes de enviarlo.';
      return;
    }
    this._hint = '';
    this.dispatchEvent(
      new CustomEvent('dialog-submit', { detail: { text }, bubbles: true, composed: true }),
    );
  }

  /** Ctrl/Cmd+Enter en el textarea envía (Enter solo hace salto de línea). */
  _onAskKeydown(event) {
    event.stopPropagation(); // que Enter/Espacio no avancen la escena
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) this._submitAsk(event);
  }

  /** El jugador pulsó una opción del paso 'choices'. @param {string} id */
  _choose(event, id) {
    event.stopPropagation();
    if (this.busy || !this._dialog) return;
    assertChoice(this._dialog, id); // guarda: la opción es del paso actual
    this.dispatchEvent(
      new CustomEvent('dialog-choice', { detail: { id }, bubbles: true, composed: true }),
    );
  }

  /** Dibuja el retrato del personaje en su canvas (procedural, determinista). */
  _paintPortrait() {
    const canvas = /** @type {HTMLCanvasElement|null} */ (
      this.renderRoot.querySelector('canvas')
    );
    if (!canvas || !this.character) return;
    const portrait = this.character.portrait;
    const draw = typeof portrait === 'function' ? portrait : GAME_PORTRAITS[portrait];
    if (!draw) {
      throw new Error(`<game-dialog>: retrato desconocido "${String(portrait)}".`);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // sin 2D no hay retrato (canvas queda vacío, la escena sigue)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    draw(ctx, PORTRAIT_SIZE);
  }

  /** Chispas ✨ del trance (posiciones fijas, fases repartidas por CSS delay). */
  _renderSparks() {
    return [
      { left: '18%', bottom: '52%', delay: '0s' },
      { left: '8%', bottom: '38%', delay: '0.45s' },
      { left: '26%', bottom: '34%', delay: '0.85s' },
    ].map(
      (spark) =>
        html`<span
          class="spark"
          style=${`left:${spark.left}; bottom:${spark.bottom}; animation-delay:${spark.delay}`}
          aria-hidden="true"
        >✨</span>`,
    );
  }

  render() {
    const step = this._step();
    const text = this._stepText();
    const typedText = text.slice(0, this._typed);
    const trance = step?.kind === 'effect' && step.effect === 'trance';
    const showNext = step?.kind === 'say';
    return html`
      <div class="scene ${trance ? 'trance' : ''}" @click=${this._onSceneClick}>
        <div class="stage">
          <figure class="actor">
            <canvas width=${PORTRAIT_SIZE} height=${PORTRAIT_SIZE} aria-hidden="true"></canvas>
            <figcaption>${this.character?.name ?? ''}</figcaption>
          </figure>
          ${step && text
            ? html`<div class="bubble ${trance ? 'trance-bubble' : ''}">
                <p aria-hidden="true">${typedText}</p>
                ${showNext
                  ? html`<button
                      class="next"
                      aria-label=${this._typingDone ? 'Continuar' : 'Mostrar todo el texto'}
                      title=${this._typingDone ? 'Continuar (clic o Enter)' : 'Mostrar todo el texto'}
                      @click=${this._onNextClick}
                    >▼</button>`
                  : null}
                ${step.kind === 'choices' && this._typingDone
                  ? html`<div class="choices">
                      ${step.options.map(
                        (option) =>
                          html`<button
                            ?disabled=${this.busy}
                            @click=${(e) => this._choose(e, option.id)}
                          >${option.label}</button>`,
                      )}
                    </div>`
                  : null}
              </div>`
            : step?.kind === 'choices'
              ? html`<div class="bubble">
                  <div class="choices">
                    ${step.options.map(
                      (option) =>
                        html`<button
                          ?disabled=${this.busy}
                          @click=${(e) => this._choose(e, option.id)}
                        >${option.label}</button>`,
                    )}
                  </div>
                </div>`
              : null}
        </div>
        ${trance ? this._renderSparks() : null}
        ${step?.kind === 'ask' && this._typingDone
          ? html`<div class="form" @click=${(e) => e.stopPropagation()}>
              <label for="gd-ask">${step.placeholder}</label>
              <textarea
                id="gd-ask"
                rows="3"
                placeholder=${step.placeholder}
                ?disabled=${this.busy}
                @keydown=${this._onAskKeydown}
              ></textarea>
              ${this._hint ? html`<p class="formerror" role="alert">${this._hint}</p>` : null}
              ${this.error ? html`<p class="formerror" role="alert">${this.error}</p>` : null}
              <button ?disabled=${this.busy} @click=${this._submitAsk}>
                ${step.submitLabel}
              </button>
            </div>`
          : null}
      </div>
      <p class="sr-live" aria-live="polite">${text}</p>
    `;
  }
}

if (!customElements.get('game-dialog')) {
  customElements.define('game-dialog', GameDialog);
}
