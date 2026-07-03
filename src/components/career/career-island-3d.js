/**
 * <career-island-3d>
 * Render 3D REAL de la isla de carrera con Three.js (MC-5: fundación;
 * MC-6: zoom animado a ciudad/comarca; MC-7: primera persona; MC-8: pulido).
 *
 * Es intercambiable con <career-map> (vista plana): mismas propiedades y el
 * mismo evento `select-city`. La escena se GENERA del modelo (/careerMap/island)
 * con geometrías low-poly de código, sin assets externos:
 *  - isla (playa + hierba), agua y cielo/niebla
 *  - una plataforma sutil por comarca con su etiqueta flotante
 *  - una casa por ciudad, coloreada por estado, con puerta, placa con el
 *    nombre sobre la puerta, ventanas emisivas y variación determinista por id
 *    (altura/rotación/tono vía cityVariant: nada de Math.random())
 *  - senda del camino recorrido (cinta) y ruta planificada (línea discontinua)
 *  - puerto de inicio (muelle + faro)
 *
 * Three.js se carga por IMPORT DINÁMICO al montar el componente: el resto de la
 * app no paga el bundle. Si WebGL no está disponible se emite `webgl-unavailable`
 * para que <career-app> caiga a la vista plana.
 *
 * Cámara aérea orbital (OrbitControls): orbitar, panear y zoom con límites sanos
 * (nunca por debajo del horizonte, distancia acotada por el radio de la isla).
 *
 * Reconstrucción: al cambiar `journey`/`reachable`/`selected` se reconstruye
 * SOLO el grupo de ciudades (decenas de meshes, coste trivial); la parte
 * estática (isla/agua/comarcas/puerto) solo se reconstruye si cambia el mapa.
 * Se eligió rebuild simple del grupo frente a mutar materiales in situ por
 * claridad: el estado visual siempre es función pura del modelo.
 *
 * Picking (MC-6): clic (sin arrastre) sobre una ciudad → emite `select-city` Y
 * anima la cámara hasta ella (el zoom lo hace ESTE componente, no el contenedor,
 * para evitar dobles animaciones); clic sobre la plataforma de una comarca →
 * zoom a la comarca (sin evento); clic en agua/vacío → nada (no se deselecciona).
 *
 * Zoom animado: `focusCity(id)`, `focusArea(id)` y `focusOverview()` interpolan
 * posición de cámara y `controls.target` (easeInOutCubic, FOCUS_ANIM_MS) dentro
 * del loop rAF existente. Cualquier input del usuario sobre los OrbitControls
 * (evento 'start': arrastre, rueda, touch) cancela la animación en curso.
 *
 * Primera persona (MC-7): `enterFirstPerson()` baja la cámara con transición
 * hasta la altura de ojos (puerto o ciudad actual del journey) y cambia
 * OrbitControls por PointerLockControls (ratón) + controles tipo DOOM (MC-8):
 * ←/→ GIRAN sobre uno mismo (turnYaw, puro), ↑/↓ y W/S avanzan/retroceden,
 * A/D hacen strafe y con Shift se corre. A pie las etiquetas flotantes se
 * ocultan (el nombre se lee en la placa de la puerta y en el prompt de
 * proximidad). La lógica de marcha es pura y compartida con el terreno (walk.js):
 * groundHeightAt pega la cámara al MISMO suelo que pintan las mallas y
 * stepPosition acota el paso a la isla deslizando por la costa. Cada ~100 ms
 * se muestrea la ciudad cercana: se resalta (emisivo, como selected) y un
 * prompt ofrece [E]/clic → `select-city` soltando el lock a propósito para
 * poder usar el panel; al cerrarse, un clic en el canvas re-engancha el lock.
 * Escape (nativo del lock) o `exitFirstPerson()` vuelven, con transición, a la
 * vista aérea. `mode-change {mode:'fps'|'aerial'}` avisa a <career-app>.
 * Pensado para escritorio: en táctil el HUD no ofrece el botón de entrada.
 *
 * Es un componente presentacional: no escribe en Firestore.
 */
import { LitElement, html, css } from 'lit';
import { cityStatus } from '../../tools/career/domain/progress.js';
import {
  worldFromMap,
  cityStatusColor,
  areaLayout,
  islandRadius,
  cityFocusFrame,
  areaFocusFrame,
  cityVariant,
  journeyPathPoints,
  ribbonStrip,
  ACCENT_COLORS,
  STATUS_COLORS,
} from '../../tools/career/domain/islandLayout.js';
import {
  TERRAIN,
  coastFactor,
  groundHeightAt,
  walkableRadius,
  stepPosition,
  turnYaw,
  nearestCityWithin,
  WALK_SPEED,
  RUN_MULTIPLIER,
  TURN_SPEED,
  EYE_HEIGHT,
  PROXIMITY_RADIUS,
} from '../../tools/career/domain/walk.js';

/**
 * Altura (y de mundo) de la superficie de hierba donde se asientan las
 * ciudades. Derivada del perfil compartido del terreno (walk.js).
 */
const GROUND_Y = TERRAIN.baseY + TERRAIN.grass.height / 2;
/** Dimensiones del hito de ciudad (casa low-poly). */
const CITY_BODY = { w: 2.6, h: 3.2 };
const CITY_ROOF = { r: 2.3, h: 2.2 };
/** Puerta de madera de la fachada y placa con el nombre sobre ella (MC-8). */
const CITY_DOOR = { w: 0.95, h: 1.5, d: 0.12 };
const CITY_PLATE = { w: 1.5, h: 0.5 };
/** Ventanas: planos emisivos suaves en fachada y costados. */
const CITY_WINDOW = { w: 0.55, h: 0.62 };
/** Elevación de los overlays del suelo (plataformas, senda, ruta) contra el z-fighting. */
const PATCH_LIFT = 0.1;
const PATH_LIFT = 0.18;
const ROUTE_LIFT = 0.24;
/** Anchura de la cinta del camino recorrido. */
const PATH_WIDTH = 1.2;
/** Fundido por distancia de las etiquetas de ciudad en vista aérea (× radio de isla). */
const LABEL_FADE = { near: 1.1, far: 2.0 };
/** Cadencia (ms) del fundido de etiquetas (no hace falta por-frame). */
const LABEL_FADE_MS = 150;
/** Umbral (px de cliente) para distinguir un arrastre de órbita de un clic. */
const DRAG_THRESHOLD = 5;
/** Límite del paneo del target respecto al radio de la isla. */
const PAN_LIMIT_FACTOR = 1.2;
/** Duración (ms) de las animaciones de foco de cámara (zoom a ciudad/comarca/vista general). */
const FOCUS_ANIM_MS = 700;
/** Duración (ms) de las transiciones de entrada/salida del modo primera persona. */
const FPS_ANIM_MS = 1200;
/** Cadencia (ms) del muestreo de proximidad a ciudades al caminar. */
const PROXIMITY_CHECK_MS = 100;
/** Distancia (unidades) a la que se aparece frente a la ciudad actual del journey. */
const CITY_SPAWN_OFFSET = 12;
/** Distancia del punto de mira usado como origen del giro de cámara al salir del modo fps. */
const EXIT_LOOK_AHEAD = 30;
/** Colores del entorno (cielo, agua, arena, hierba, madera, faro, puertas y ventanas). */
const ENV_COLORS = {
  sky: 0xdceff5,
  water: 0x4d90c4,
  sand: 0xe9dcae,
  grass: 0x9fce8f,
  wood: 0x9a7b4f,
  lighthouse: 0xf5f2ea,
  door: 0x6b4a26,
  window: 0xfff2c0,
  windowGlow: 0xf4c96b,
};

export class CareerIsland3D extends LitElement {
  static properties = {
    map: { attribute: false },
    journey: { attribute: false },
    reachable: { attribute: false },
    selected: { attribute: false },
    _phase: { state: true },
    _mode: { state: true },
    _fpsLocked: { state: true },
    _nearCityId: { state: true },
  };

  static styles = css`
    :host { display: block; height: 100%; min-height: 320px; }
    .wrap {
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: var(--rm-radius, 12px);
      overflow: hidden;
      background: #dceff5;
      border: 1px solid var(--rm-border, #e5e7eb);
    }
    canvas { width: 100%; height: 100%; display: block; touch-action: none; }
    .overlay {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      text-align: center;
      padding: 1rem;
      color: var(--rm-muted, #6b7280);
      font-weight: 600;
      background: rgba(220, 239, 245, 0.75);
    }
    .overlay.error { color: var(--rm-danger, #dc2626); }
    /* --- Modo primera persona (MC-7) --- */
    .crosshair {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 16px;
      height: 16px;
      transform: translate(-50%, -50%);
      pointer-events: none;
      opacity: 0.75;
    }
    .crosshair::before,
    .crosshair::after {
      content: '';
      position: absolute;
      background: #fff;
      box-shadow: 0 0 3px rgba(17, 24, 39, 0.65);
    }
    .crosshair::before { left: 50%; top: 0; width: 2px; height: 100%; transform: translateX(-50%); }
    .crosshair::after { top: 50%; left: 0; height: 2px; width: 100%; transform: translateY(-50%); }
    .fps-hint {
      position: absolute;
      left: 50%;
      bottom: 1.1rem;
      transform: translateX(-50%);
      max-width: calc(100% - 2rem);
      padding: 0.45rem 0.9rem;
      border-radius: 999px;
      background: rgba(30, 58, 95, 0.82);
      color: #fff;
      font-family: var(--rm-font, system-ui, sans-serif);
      font-size: 0.85rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }
    .fps-hint kbd {
      display: inline-block;
      padding: 0 0.4rem;
      margin-right: 0.15rem;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.65);
      background: rgba(255, 255, 255, 0.14);
      font-family: inherit;
    }
    /* El prompt de ciudad cercana sube para dejar sitio a la ayuda de controles. */
    .fps-hint.near { bottom: 3.1rem; }
    .fps-help {
      position: absolute;
      left: 50%;
      bottom: 1.1rem;
      transform: translateX(-50%);
      max-width: calc(100% - 2rem);
      padding: 0.3rem 0.8rem;
      border-radius: 999px;
      background: rgba(17, 24, 39, 0.55);
      color: rgba(255, 255, 255, 0.92);
      font-family: var(--rm-font, system-ui, sans-serif);
      font-size: 0.72rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }
  `;

  constructor() {
    super();
    /** @type {import('../../tools/career/domain/types.js').CareerMap|null} */
    this.map = null;
    this.journey = { visitedCities: [], currentCity: null, plannedRoute: [], evidences: {} };
    this.reachable = [];
    this.selected = null;
    /** Fase del canvas: 'loading' | 'ready' | 'unsupported' | 'error'. */
    this._phase = 'loading';
    /** Módulo three (cargado dinámicamente). */
    this._THREE = null;
    this._renderer = null;
    this._scene = null;
    this._camera = null;
    this._controls = null;
    /** Grupo estático (isla, agua, comarcas, puerto): se rehace al cambiar el mapa. */
    this._staticGroup = null;
    /** Grupo de ciudades: se rehace al cambiar mapa/journey/reachable/selected. */
    this._citiesGroup = null;
    this._raf = 0;
    this._resizeObserver = null;
    this._lastMapId = null;
    this._islandR = 0;
    this._pointerDownAt = null;
    /**
     * Animación de foco de cámara en curso (o null). Se interpola en el loop
     * rAF y se cancela con cualquier input del usuario sobre los controles.
     * @type {{fromPos: object, toPos: object, fromTarget: object, toTarget: object, start: number}|null}
     */
    this._camAnim = null;
    /** Plataformas de comarca raycasteables (userData.areaId); se rehacen con el grupo estático. */
    this._areaPatches = [];
    /** Modo de cámara (MC-7): 'aerial' | 'to-fps' | 'fps' | 'to-aerial'. */
    this._mode = 'aerial';
    /** Clase PointerLockControls (import dinámico) e instancia perezosa. */
    this._PointerLockControls = null;
    this._plc = null;
    /** true mientras el puntero está capturado por el canvas (modo fps). */
    this._fpsLocked = false;
    /** Liberación de lock ESPERADA (se abre el panel de ciudadanía): no salir del modo. */
    this._expectUnlock = false;
    /** Teclas de marcha actualmente pulsadas (por event.code). */
    this._keys = new Set();
    /** Ciudad dentro del radio de proximidad al caminar (o null). */
    this._nearCityId = null;
    /** Radio caminable (walkableRadius) de la isla actual. */
    this._walkRadius = 0;
    this._lastWalkTs = 0;
    this._lastProxTs = 0;
    this._lastLabelTs = 0;
    /** Vectores scratch para la marcha (se crean al cargar three). */
    this._walkDirScratch = null;
    this._lookScratch = null;
    /** Euler scratch (orden YXZ, el del pointer lock) para el giro con ←/→. */
    this._eulerScratch = null;
    /** Etiquetas flotantes de ciudad (fundido por distancia; ocultas a pie). */
    this._cityLabels = [];
    /** Etiquetas flotantes de comarca y puerto (ocultas a pie). */
    this._areaLabels = [];
    /**
     * Caché de texturas de placa de puerta por nombre de ciudad: el grupo de
     * ciudades se rehace a menudo (journey/selección/proximidad) y pintar el
     * canvas de cada placa cada vez sería un despilfarro. Marcadas con
     * userData.shared para que _disposeSubtree NO las libere; se liberan en
     * _clearPlateCache (cambio de mapa) y en el teardown.
     * @type {Map<string, object>}
     */
    this._plateTextures = new Map();
    /** Aborta de golpe todos los listeners (documento y canvas) en el teardown. */
    this._abort = null;
    this._onVisibility = () => {
      if (document.hidden) this._stopLoop();
      else if (this._renderer) this._startLoop();
    };
  }

  /** true si WebGL no está disponible (career-app puede leerlo además del evento). */
  get webglUnavailable() {
    return this._phase === 'unsupported';
  }

  firstUpdated() {
    this._init();
  }

  /** @param {Map<string, unknown>} changed */
  updated(changed) {
    if (this._phase !== 'ready') return;
    if (changed.has('map')) {
      this._rebuildAll();
    } else if (changed.has('journey') || changed.has('reachable') || changed.has('selected')) {
      this._rebuildCities();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._teardown();
  }

  connectedCallback() {
    super.connectedCallback();
    // Si el elemento se re-conecta tras un teardown (cambio de vista y vuelta),
    // se vuelve a inicializar desde cero.
    if (this.hasUpdated && !this._renderer && this._phase !== 'unsupported') this._init();
  }

  // ---- Inicialización --------------------------------------------------------

  /** Carga three por import dinámico, comprueba WebGL y levanta la escena. */
  async _init() {
    this._phase = 'loading';
    let THREE;
    let OrbitControls;
    let PointerLockControls;
    try {
      // Import dinámico: three solo se descarga al montar la vista 3D.
      [THREE, { OrbitControls }, { PointerLockControls }] = await Promise.all([
        import('three'),
        import('three/addons/controls/OrbitControls.js'),
        import('three/addons/controls/PointerLockControls.js'),
      ]);
    } catch (err) {
      this._phase = 'error';
      throw err instanceof Error ? err : new Error('No se pudo cargar el motor 3D.');
    }
    if (!this.isConnected || this._renderer) return;
    this._THREE = THREE;
    this._PointerLockControls = PointerLockControls;
    this._walkDirScratch = new THREE.Vector3();
    this._lookScratch = new THREE.Vector3();
    this._eulerScratch = new THREE.Euler(0, 0, 0, 'YXZ');

    // Detección de WebGL en un canvas desechable (no bloquea el canvas real).
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
    if (!gl) {
      this._markUnsupported();
      return;
    }

    const canvas = this.renderRoot.querySelector('canvas');
    try {
      this._renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch {
      this._markUnsupported();
      return;
    }
    this._renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2));

    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(ENV_COLORS.sky);

    this._camera = new THREE.PerspectiveCamera(45, 1, 0.5, 4000);

    // Cámara aérea orbital con límites sanos (se acota por isla en _frameIsland).
    this._controls = new OrbitControls(this._camera, canvas);
    this._controls.enableDamping = true;
    this._controls.dampingFactor = 0.08;
    this._controls.screenSpacePanning = false; // panear sobre el plano del suelo
    this._controls.maxPolarAngle = Math.PI * 0.46; // nunca bajo el horizonte/agua
    this._controls.target.set(0, GROUND_Y, 0);
    // Cualquier input del usuario (arrastre, rueda, touch) cancela el zoom animado.
    this._controls.addEventListener('start', () => {
      this._camAnim = null;
    });

    // Luz (MC-8): sol direccional CÁLIDO + contraluz frío muy suave (las caras
    // en sombra no quedan planas) + hemisférica cielo/hierba. Sin sombras
    // proyectadas (fluidez); el volumen lo dan el flatShading y las dos luces.
    const sun = new THREE.DirectionalLight(0xffe9c4, 1.5);
    sun.position.set(60, 120, 40);
    this._scene.add(sun);
    const fill = new THREE.DirectionalLight(0xbcd7e8, 0.35);
    fill.position.set(-70, 60, -50);
    this._scene.add(fill);
    this._scene.add(new THREE.HemisphereLight(0xeaf7fc, 0xc7dcc2, 0.85));

    // Tamaño real del contenedor (dispara una primera medición al observar).
    this._resizeObserver = new ResizeObserver((entries) => this._onResize(entries));
    this._resizeObserver.observe(this.renderRoot.querySelector('.wrap'));

    this._abort = new AbortController();
    const { signal } = this._abort;
    document.addEventListener('visibilitychange', this._onVisibility, { signal });

    // Picking básico (hook para MC-6): clic sin arrastre → select-city.
    canvas.addEventListener(
      'pointerdown',
      (e) => {
        this._pointerDownAt = { x: e.clientX, y: e.clientY };
      },
      { signal },
    );
    canvas.addEventListener('pointerup', (e) => this._onPick(e), { signal });

    // Marcha en primera persona (MC-7): las teclas se escuchan en el documento
    // (con el pointer lock el foco es global) y solo actúan en modo fps.
    document.addEventListener('keydown', (e) => this._onKeyDown(e), { signal });
    document.addEventListener('keyup', (e) => this._onKeyUp(e), { signal });

    this._phase = 'ready';
    this._rebuildAll();
    if (!document.hidden) this._startLoop();
  }

  /** Marca WebGL como no disponible y avisa al contenedor para su fallback. */
  _markUnsupported() {
    this._phase = 'unsupported';
    this.dispatchEvent(
      new CustomEvent('webgl-unavailable', { bubbles: true, composed: true }),
    );
  }

  // ---- Bucle de render / tamaño ---------------------------------------------

  /**
   * Bucle rAF por modo. En vista aérea: damping de los controles + animación
   * de foco + render; la animación se aplica DESPUÉS de controls.update() para
   * que tenga la última palabra sobre cámara y target mientras dura (el
   * damping residual no la pelea; el input del usuario la cancela vía el
   * evento 'start'). En fps: un paso de marcha por frame. En las transiciones
   * de entrada/salida del fps (OrbitControls apagado) solo manda la animación.
   * Se pausa con document.hidden.
   */
  _startLoop() {
    if (this._raf || !this._renderer) return;
    /** @param {DOMHighResTimeStamp} now */
    const step = (now) => {
      this._raf = requestAnimationFrame(step);
      if (this._mode === 'aerial') {
        this._controls.update();
        this._tickCameraAnim(now);
        this._clampTarget();
        // Etiquetas de ciudad: fundido por distancia (menos solape alejado).
        if (now - this._lastLabelTs >= LABEL_FADE_MS) {
          this._lastLabelTs = now;
          this._fadeCityLabels();
        }
      } else if (this._mode === 'fps') {
        this._tickWalk(now);
      } else {
        this._tickCameraAnim(now);
      }
      this._renderer.render(this._scene, this._camera);
    };
    this._raf = requestAnimationFrame(step);
  }

  _stopLoop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  /** Acota el paneo: el target no puede alejarse de la isla ni cambiar de altura. */
  _clampTarget() {
    const limit = (this._islandR || 50) * PAN_LIMIT_FACTOR;
    const t = this._controls.target;
    t.x = Math.min(Math.max(t.x, -limit), limit);
    t.z = Math.min(Math.max(t.z, -limit), limit);
    t.y = GROUND_Y;
  }

  // ---- Etiquetas flotantes (MC-8) ----------------------------------------------

  /**
   * Fundido por distancia de las etiquetas de ciudad en vista aérea: a menos
   * de LABEL_FADE.near×R son totalmente opacas y a partir de LABEL_FADE.far×R
   * desaparecen. Así en el encuadre general (zonas densas) no se solapan unas
   * con otras; las de comarca sí permanecen. Barato: decenas de sprites cada
   * LABEL_FADE_MS.
   */
  _fadeCityLabels() {
    if (this._cityLabels.length === 0) return;
    const R = this._islandR || 50;
    const near = R * LABEL_FADE.near;
    const far = R * LABEL_FADE.far;
    const cam = this._camera.position;
    for (const sprite of this._cityLabels) {
      const d = sprite.getWorldPosition(this._lookScratch).distanceTo(cam);
      const k = 1 - Math.min(Math.max((d - near) / (far - near), 0), 1);
      sprite.material.opacity = k;
      sprite.visible = k > 0.02;
    }
  }

  /**
   * Muestra/oculta TODAS las etiquetas flotantes (ciudades, comarcas y puerto).
   * A pie ensucian (nombres gigantes sobre la cabeza): el nombre se lee en la
   * placa de la puerta y en el prompt de proximidad.
   * @param {boolean} visible
   */
  _setLabelsVisible(visible) {
    for (const sprite of [...this._cityLabels, ...this._areaLabels]) {
      sprite.visible = visible;
      if (visible) sprite.material.opacity = 1;
    }
  }

  // ---- Zoom animado de cámara (MC-6) ------------------------------------------

  /**
   * Enfoca una ciudad con zoom animado: la cámara llega cerca de su casa, con
   * un ángulo agradable (~38°) y conservando el azimut actual (llega "desde
   * donde está", sin giros bruscos). API pública para <career-app>.
   * @param {string} cityId
   */
  focusCity(cityId) {
    if (this._phase !== 'ready' || this._mode !== 'aerial') return;
    const frame = cityFocusFrame(this.map, cityId);
    if (frame) this._animateTo(this._poseFromFrame(frame));
  }

  /**
   * Enfoca una comarca completa: encuadra su plataforma (distancia proporcional
   * a su radio) con vista más aérea. API pública para <career-app>.
   * @param {string} areaId
   */
  focusArea(areaId) {
    if (this._phase !== 'ready' || this._mode !== 'aerial') return;
    const frame = areaFocusFrame(this.map, areaId);
    if (frame) this._animateTo(this._poseFromFrame(frame));
  }

  /** Vuelve, con animación, al encuadre aéreo inicial de toda la isla. */
  focusOverview() {
    if (this._phase !== 'ready' || this._mode !== 'aerial') return;
    this._animateTo(this._overviewPose());
  }

  /**
   * Pose de cámara (posición + target) para un encuadre de foco del dominio.
   * Conserva el azimut actual de la cámara respecto al NUEVO target y respeta
   * la distancia mínima de los controles.
   * @param {import('../../tools/career/domain/islandLayout.js').FocusFrame} frame
   */
  _poseFromFrame(frame) {
    const THREE = this._THREE;
    const target = new THREE.Vector3(frame.wx, GROUND_Y, frame.wz);
    const distance = Math.max(frame.distance, this._controls.minDistance);
    const cam = this._camera.position;
    const azimuth = Math.atan2(cam.x - target.x, cam.z - target.z);
    const horizontal = distance * Math.cos(frame.elevation);
    const position = new THREE.Vector3(
      target.x + Math.sin(azimuth) * horizontal,
      GROUND_Y + distance * Math.sin(frame.elevation),
      target.z + Math.cos(azimuth) * horizontal,
    );
    return { position, target };
  }

  /** Pose del encuadre aéreo de toda la isla (la misma del arranque). */
  _overviewPose() {
    const THREE = this._THREE;
    const R = this._islandR;
    return {
      position: new THREE.Vector3(R * 1.1, R * 1.5, R * 1.1),
      target: new THREE.Vector3(0, GROUND_Y, 0),
    };
  }

  /**
   * Arranca una animación de cámara desde la pose actual hacia la indicada.
   * @param {{ position: object, target: object }} pose
   * @param {{ duration?: number, onDone?: () => void, fromTarget?: object }} [opts]
   *   duration: ms (por defecto FOCUS_ANIM_MS); onDone: callback al completar;
   *   fromTarget: punto de mira inicial (por defecto el target de los controles).
   */
  _animateTo({ position, target }, opts = {}) {
    this._camAnim = {
      fromPos: this._camera.position.clone(),
      toPos: position,
      fromTarget: (opts.fromTarget ?? this._controls.target).clone(),
      toTarget: target,
      start: performance.now(),
      duration: opts.duration ?? FOCUS_ANIM_MS,
      onDone: opts.onDone ?? null,
    };
  }

  /**
   * Avanza la animación de cámara en curso (easeInOutCubic). En vista aérea
   * interpola el target de los OrbitControls; en las transiciones del modo fps
   * (controles apagados) orienta la cámara directamente con lookAt. Al
   * completarse se limpia sola y dispara su onDone; el input del usuario la
   * cancela antes (evento 'start' de los controles, solo en vista aérea).
   * @param {DOMHighResTimeStamp} now
   */
  _tickCameraAnim(now) {
    const anim = this._camAnim;
    if (!anim) return;
    const t = Math.min((now - anim.start) / anim.duration, 1);
    const k = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    this._camera.position.lerpVectors(anim.fromPos, anim.toPos, k);
    if (this._mode === 'aerial') {
      this._controls.target.lerpVectors(anim.fromTarget, anim.toTarget, k);
    } else {
      this._lookScratch.lerpVectors(anim.fromTarget, anim.toTarget, k);
      this._camera.lookAt(this._lookScratch);
    }
    if (t >= 1) {
      this._camAnim = null;
      anim.onDone?.();
    }
  }

  // ---- Modo primera persona (MC-7) --------------------------------------------

  /** Modo de cámara público: las transiciones cuentan como su modo de destino. */
  get mode() {
    return this._mode === 'fps' || this._mode === 'to-fps' ? 'fps' : 'aerial';
  }

  /**
   * Entra en primera persona: transición animada desde la vista aérea hasta la
   * altura de ojos frente a la ciudad actual del journey (o junto al puerto), y
   * al llegar activa PointerLockControls (ratón) y la marcha WASD/flechas.
   * API pública para <career-app>. Pensado para escritorio (puntero fino): en
   * táctil el HUD ni siquiera ofrece el botón de entrada.
   */
  enterFirstPerson() {
    if (this._phase !== 'ready' || this._mode !== 'aerial' || !this.map) return;
    const THREE = this._THREE;
    const spawn = this._fpsSpawn();
    const eyeY = groundHeightAt(spawn.x, spawn.z, { radius: this._islandR }) + EYE_HEIGHT;
    this._mode = 'to-fps';
    this._controls.enabled = false; // el damping no pelea con la transición
    this._setLabelsVisible(false); // a pie los nombres gigantes ensucian
    this._animateTo(
      {
        position: new THREE.Vector3(spawn.x, eyeY, spawn.z),
        target: new THREE.Vector3(spawn.lookX, eyeY, spawn.lookZ),
      },
      { duration: FPS_ANIM_MS, onDone: () => this._activateFps() },
    );
    this._emitMode('fps');
  }

  /**
   * Sale de primera persona: suelta el pointer lock si sigue activo y vuelve,
   * con transición, al encuadre aéreo con OrbitControls. También cubre la
   * salida a mitad de la transición de entrada.
   */
  exitFirstPerson() {
    if (this._phase !== 'ready') return;
    if (this._mode !== 'fps' && this._mode !== 'to-fps') return;
    // El cambio de modo va ANTES de soltar el lock: así el pointerlockchange
    // resultante no re-entra aquí (sin estados colgados).
    this._mode = 'to-aerial';
    this._keys.clear();
    this._expectUnlock = false;
    this._setLabelsVisible(true); // de vuelta a la vista aérea, con sus nombres
    if (this.renderRoot.pointerLockElement) document.exitPointerLock();
    if (this._plc) this._plc.enabled = false;
    if (this._nearCityId) {
      this._nearCityId = null;
      this._rebuildCities(); // apaga el resalte de proximidad
    }
    const THREE = this._THREE;
    // El giro parte del punto que se está mirando ahora mismo (continuidad).
    const lookNow = new THREE.Vector3();
    this._camera.getWorldDirection(lookNow);
    lookNow.multiplyScalar(EXIT_LOOK_AHEAD).add(this._camera.position);
    const pose = this._overviewPose();
    this._animateTo(pose, {
      duration: FPS_ANIM_MS,
      fromTarget: lookNow,
      onDone: () => {
        this._mode = 'aerial';
        this._controls.target.copy(pose.target);
        this._controls.enabled = true;
        this._controls.update();
      },
    });
    this._emitMode('aerial');
  }

  /**
   * Punto de aparición del caminante: unos pasos por delante de la ciudad
   * actual del journey mirándola (si existe); si no, junto al puerto mirando
   * al interior de la isla; y en un mapa sin puerto, el centro mirando al norte.
   * @returns {{ x: number, z: number, lookX: number, lookZ: number }}
   */
  _fpsSpawn() {
    const currentId = this.journey?.currentCity ?? null;
    const city = currentId ? (this.map.cities ?? []).find((c) => c.id === currentId) : null;
    if (city) {
      const { wx, wz } = worldFromMap(city.x, city.y);
      const d = Math.hypot(wx, wz);
      // Desplazado hacia el centro de la isla (o hacia +z si la ciudad está en el origen).
      const ux = d > 0.001 ? wx / d : 0;
      const uz = d > 0.001 ? wz / d : 1;
      return {
        x: wx - ux * CITY_SPAWN_OFFSET,
        z: wz - uz * CITY_SPAWN_OFFSET,
        lookX: wx,
        lookZ: wz,
      };
    }
    if (this.map.startPort) {
      const { wx, wz } = worldFromMap(this.map.startPort.x, this.map.startPort.y);
      if (Math.hypot(wx, wz) < 0.5) return { x: wx, z: wz, lookX: 0, lookZ: -10 };
      return { x: wx, z: wz, lookX: 0, lookZ: 0 };
    }
    return { x: 0, z: 0, lookX: 0, lookZ: -10 };
  }

  /**
   * La transición de entrada llegó a la altura de ojos: cambio de controles.
   * OrbitControls queda apagado y PointerLockControls (creado perezosamente la
   * primera vez) toma el ratón. El lock se pide aquí mismo: si el navegador lo
   * rechaza (el gesto del clic ya caducó), el overlay «haz clic en la isla»
   * queda como vía manual.
   */
  _activateFps() {
    this._mode = 'fps';
    this._lastWalkTs = 0;
    if (!this._plc) {
      const canvas = this.renderRoot.querySelector('canvas');
      this._plc = new this._PointerLockControls(this._camera, canvas);
      // Sin mirar al cénit/nadir puro: el forward proyectado al suelo nunca degenera.
      this._plc.minPolarAngle = 0.15;
      this._plc.maxPolarAngle = Math.PI - 0.15;
      // IMPORTANTE (shadow DOM): document.pointerLockElement retargetea al HOST,
      // así que el detector interno de PointerLockControls nunca ve el canvas y
      // dejaría isLocked=false (sin ratón). Este listener se registra DESPUÉS
      // del connect() del control (orden de registro = orden de ejecución) y
      // corrige isLocked con la verdad del shadow root en cada cambio.
      document.addEventListener('pointerlockchange', () => this._onPointerLockChange(), {
        signal: this._abort.signal,
      });
    }
    this._plc.enabled = true;
    this._requestLock();
  }

  /** Pide el pointer lock sobre el canvas absorbiendo el rechazo del navegador. */
  _requestLock() {
    const canvas = this.renderRoot.querySelector('canvas');
    try {
      // requestPointerLock devuelve una promesa en navegadores modernos: el
      // rechazo (sin gesto de usuario reciente) NO es un error de la app — el
      // overlay «haz clic en la isla para tomar el control» es la vía manual.
      canvas.requestPointerLock()?.catch?.(() => {});
    } catch {
      // Navegadores antiguos pueden lanzar de forma síncrona: mismo tratamiento.
    }
  }

  /**
   * Única fuente de verdad del estado del lock (ver nota de shadow DOM en
   * _activateFps). Distingue tres despegues del lock:
   *  - esperado (se abrió el panel de ciudadanía): sigue en fps, sin ratón;
   *  - Escape del usuario en fps: salida completa a la vista aérea;
   *  - cualquier otro modo (salida ya en curso, teardown): nada que hacer.
   */
  _onPointerLockChange() {
    const canvas = this.renderRoot.querySelector('canvas');
    const locked = this.renderRoot.pointerLockElement === canvas;
    if (this._plc) this._plc.isLocked = locked; // corrige el retargeting del shadow DOM
    this._fpsLocked = locked;
    if (locked) {
      this._expectUnlock = false;
      return;
    }
    this._keys.clear(); // sin lock no hay keyups garantizados: nada de teclas pegadas
    if (this._mode !== 'fps') return;
    if (this._expectUnlock) {
      this._expectUnlock = false; // liberado a propósito para usar el panel
      return;
    }
    this.exitFirstPerson(); // Escape nativo del pointer lock
  }

  /** Teclas de marcha (mantenidas), por event.code: WASD (independiente del layout), flechas y Shift. */
  static MOVE_CODES = Object.freeze(
    new Set([
      'KeyW', 'KeyA', 'KeyS', 'KeyD',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'ShiftLeft', 'ShiftRight',
    ]),
  );

  /** @param {KeyboardEvent} event */
  _onKeyDown(event) {
    if (this._mode !== 'fps') return;
    if (!this._fpsLocked) {
      // Con el lock suelto (overlay «haz clic» o panel abierto) solo se
      // atiende Escape → salir. El Escape DENTRO del panel no llega aquí:
      // el panel lo consume (stopPropagation) para cerrarse.
      if (event.code === 'Escape') this.exitFirstPerson();
      return;
    }
    if (CareerIsland3D.MOVE_CODES.has(event.code)) {
      this._keys.add(event.code);
      event.preventDefault(); // las flechas no deben hacer scroll de la página
      return;
    }
    if (event.code === 'KeyE' && this._nearCityId) {
      event.preventDefault();
      this._openNearCity();
    }
  }

  /** @param {KeyboardEvent} event */
  _onKeyUp(event) {
    this._keys.delete(event.code);
  }

  /**
   * Un frame de marcha con controles tipo DOOM (MC-8): ←/→ GIRAN sobre uno
   * mismo (yaw suave con turnYaw, compatible con el ratón del pointer lock),
   * ↑/↓ y W/S avanzan/retroceden, A/D hacen strafe. La dirección se proyecta
   * al plano del suelo relativa a la cámara, el paso se acota a la isla
   * (stepPosition de walk.js, desliza por la costa) y la cámara va pegada al
   * suelo a altura de ojos con groundHeightAt (el MISMO perfil que pintan las
   * mallas: ni se atraviesa el suelo ni se pisa el agua). Cada
   * PROXIMITY_CHECK_MS se refresca la ciudad cercana.
   * @param {DOMHighResTimeStamp} now
   */
  _tickWalk(now) {
    const dt = Math.min((now - (this._lastWalkTs || now)) / 1000, 0.05);
    this._lastWalkTs = now;
    const cam = this._camera.position;
    if (this._fpsLocked) {
      const key = (code) => (this._keys.has(code) ? 1 : 0);
      // Giro sobre uno mismo: se edita SOLO el yaw del euler YXZ de la cámara
      // (mismo orden que usa PointerLockControls, que relee el quaternion en
      // cada movimiento de ratón: ambos giros conviven sin pelearse).
      const turn = key('ArrowLeft') - key('ArrowRight');
      if (turn !== 0) {
        this._eulerScratch.setFromQuaternion(this._camera.quaternion);
        this._eulerScratch.y = turnYaw(this._eulerScratch.y, turn, dt, TURN_SPEED);
        this._camera.quaternion.setFromEuler(this._eulerScratch);
      }
      const fwd = key('KeyW') + key('ArrowUp') - key('KeyS') - key('ArrowDown');
      const strafe = key('KeyD') - key('KeyA');
      if (fwd !== 0 || strafe !== 0) {
        // Forward de la cámara proyectado al plano XZ (los límites polares del
        // PointerLockControls garantizan que nunca degenera).
        const look = this._camera.getWorldDirection(this._walkDirScratch);
        const flen = Math.hypot(look.x, look.z);
        const fx = look.x / flen;
        const fz = look.z / flen;
        // right = forward × up (mundo y-arriba) = (-fz, fx).
        const dir = { x: fx * fwd - fz * strafe, z: fz * fwd + fx * strafe };
        const running = this._keys.has('ShiftLeft') || this._keys.has('ShiftRight');
        const next = stepPosition(
          { x: cam.x, z: cam.z },
          dir,
          dt,
          WALK_SPEED * (running ? RUN_MULTIPLIER : 1),
          { radius: this._walkRadius },
        );
        cam.x = next.x;
        cam.z = next.z;
      }
    }
    cam.y = groundHeightAt(cam.x, cam.z, { radius: this._islandR }) + EYE_HEIGHT;
    if (now - this._lastProxTs >= PROXIMITY_CHECK_MS) {
      this._lastProxTs = now;
      this._updateProximity();
    }
  }

  /** Ciudad cercana al caminante, para el resalte emisivo y el prompt «[E] Ver ciudadanía». */
  _updateProximity() {
    const cam = this._camera.position;
    const cities = (this.map?.cities ?? []).map((c) => ({ id: c.id, ...worldFromMap(c.x, c.y) }));
    const near = nearestCityWithin({ x: cam.x, z: cam.z }, cities, PROXIMITY_RADIUS);
    const id = near?.id ?? null;
    if (id === this._nearCityId) return;
    this._nearCityId = id;
    this._rebuildCities(); // aplica/retira el resalte emisivo de proximidad
  }

  /**
   * Abre el panel de ciudadanía de la ciudad cercana ([E] o clic): suelta el
   * pointer lock A PROPÓSITO (marcándolo con _expectUnlock) para que el ratón
   * pueda usar el panel, SIN salir del modo primera persona. Tras cerrar el
   * panel, un clic en el canvas re-engancha el lock (_onPick).
   */
  _openNearCity() {
    const cityId = this._nearCityId;
    if (!cityId) return;
    if (this._fpsLocked) {
      this._expectUnlock = true;
      document.exitPointerLock();
    }
    this.dispatchEvent(
      new CustomEvent('select-city', { detail: { cityId }, bubbles: true, composed: true }),
    );
  }

  /** Notifica el cambio de modo de cámara a <career-app> (adapta su HUD). @param {'aerial'|'fps'} mode */
  _emitMode(mode) {
    this.dispatchEvent(
      new CustomEvent('mode-change', { detail: { mode }, bubbles: true, composed: true }),
    );
  }

  /**
   * Corte duro a vista aérea (cambio de isla bajo los pies): sin animación.
   * El encuadre lo repone _frameIsland justo después.
   */
  _resetToAerial() {
    this._camAnim = null;
    this._keys.clear();
    this._expectUnlock = false;
    this._nearCityId = null;
    if (this.renderRoot.pointerLockElement) document.exitPointerLock();
    if (this._plc) this._plc.enabled = false;
    this._controls.enabled = true;
    this._setLabelsVisible(true);
    if (this._mode !== 'aerial') {
      this._mode = 'aerial';
      this._emitMode('aerial');
    }
  }

  /**
   * HUD inferior del modo fps: ayuda compacta de controles siempre visible con
   * el lock tomado, y encima el prompt de ciudad cercana cuando la hay. Sin
   * lock, cómo retomar el control.
   */
  _renderFpsHint() {
    if (this._mode !== 'fps') return null;
    if (!this._fpsLocked) {
      return html`<div class="fps-hint">Haz clic en la isla para tomar el control · Esc para salir</div>`;
    }
    const city = this._nearCityId
      ? (this.map?.cities ?? []).find((c) => c.id === this._nearCityId)
      : null;
    return html`
      ${city ? html`<div class="fps-hint near"><kbd>E</kbd> Ver ciudadanía de ${city.name}</div>` : null}
      <div class="fps-help">←→ girar · ↑↓ avanzar · A/D lateral · Shift correr · E ciudadanía · Esc salir</div>
    `;
  }

  /** @param {ResizeObserverEntry[]} entries */
  _onResize(entries) {
    const { width, height } = entries[0].contentRect;
    if (!this._renderer || width === 0 || height === 0) return;
    this._renderer.setSize(width, height, false);
    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();
  }

  // ---- Construcción de la escena ---------------------------------------------

  /** Rehace toda la escena; re-encuadra la cámara solo si cambió la isla (map.id). */
  _rebuildAll() {
    if (!this.map) return;
    this._islandR = islandRadius(this.map);
    this._walkRadius = walkableRadius(this._islandR);
    if (this.map.id !== this._lastMapId) this._clearPlateCache(); // otra isla, otras placas
    this._replaceGroup('_staticGroup', this._buildStatic());
    this._rebuildCities();
    if (this.map.id !== this._lastMapId) {
      this._lastMapId = this.map.id;
      // Si cambia la ISLA con el caminante dentro, el modo a pie no sobrevive.
      if (this._mode !== 'aerial') this._resetToAerial();
      this._frameIsland();
    }
  }

  _rebuildCities() {
    if (!this.map) return;
    this._replaceGroup('_citiesGroup', this._buildCities());
  }

  /** Sustituye un grupo de la escena liberando los recursos GPU del anterior. */
  _replaceGroup(field, nextGroup) {
    const prev = this[field];
    if (prev) {
      this._scene.remove(prev);
      CareerIsland3D._disposeSubtree(prev);
    }
    this[field] = nextGroup;
    this._scene.add(nextGroup);
  }

  /** Encuadre aéreo inicial + límites de zoom proporcionales al radio de la isla. */
  _frameIsland() {
    const R = this._islandR;
    const { position, target } = this._overviewPose();
    this._camera.far = R * 20;
    this._camera.position.copy(position);
    this._camera.updateProjectionMatrix();
    this._controls.target.copy(target);
    this._controls.minDistance = R * 0.3;
    this._controls.maxDistance = R * 4;
    this._controls.update();
    // Niebla suave para fundir el horizonte con el cielo.
    this._scene.fog = new this._THREE.Fog(ENV_COLORS.sky, R * 4, R * 10);
  }

  /** Grupo estático: agua, isla (playa + hierba), plataformas de comarca y puerto. */
  _buildStatic() {
    const THREE = this._THREE;
    const R = this._islandR;
    const group = new THREE.Group();

    // Agua: gran disco semitransparente alrededor de la isla.
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(R * 8, 48),
      new THREE.MeshLambertMaterial({ color: ENV_COLORS.water, transparent: true, opacity: 0.88 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.6;
    group.add(water);

    // Playa: anillo de arena en pendiente con costa irregular (low-poly).
    // El perfil (radios, alto, irregularidad) viene de walk.js: es el MISMO
    // suelo que pisa el modo primera persona (groundHeightAt).
    const beach = new THREE.Mesh(
      this._coastGeometry(
        R + TERRAIN.beach.topPad,
        R + TERRAIN.beach.bottomPad,
        TERRAIN.beach.height,
        TERRAIN.beach.amount,
      ),
      new THREE.MeshLambertMaterial({ color: ENV_COLORS.sand, flatShading: true }),
    );
    beach.position.y = TERRAIN.baseY;
    group.add(beach);

    // Interior: meseta de hierba donde viven comarcas y ciudades.
    const grass = new THREE.Mesh(
      this._coastGeometry(
        R + TERRAIN.grass.topPad,
        R + TERRAIN.grass.bottomPad,
        TERRAIN.grass.height,
        TERRAIN.grass.amount,
      ),
      new THREE.MeshLambertMaterial({ color: ENV_COLORS.grass, flatShading: true }),
    );
    grass.position.y = TERRAIN.baseY;
    group.add(grass);

    // Comarcas: parche circular sutil + etiqueta flotante con el nombre.
    // Los parches son raycasteables (MC-6): clic en la plataforma → zoom a la
    // comarca. Contra el z-fighting con la hierba (parpadeo al caminar, MC-8):
    // elevados PATCH_LIFT y con polygonOffset que sesga su profundidad.
    this._areaPatches = [];
    this._areaLabels = [];
    const labelsVisible = this._mode === 'aerial' || this._mode === 'to-aerial';
    for (const { area, center, radius, color } of areaLayout(this.map)) {
      const patch = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 24),
        new THREE.MeshLambertMaterial({
          color,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }),
      );
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(center.wx, GROUND_Y + PATCH_LIFT, center.wz);
      patch.userData.areaId = area.id;
      this._areaPatches.push(patch);
      group.add(patch);
      const label = this._makeLabel(area.name, {
        x: center.wx,
        y: GROUND_Y + 10.5,
        z: center.wz,
        scale: 6.5,
        color: '#5b6b7d',
      });
      label.visible = labelsVisible;
      this._areaLabels.push(label);
      group.add(label);
    }

    if (this.map.startPort) group.add(this._buildPort(this.map.startPort, labelsVisible));
    return group;
  }

  /**
   * Cilindro low-poly con la costa irregular: los vértices del perímetro se
   * desplazan radialmente con coastFactor (walk.js), determinista y compartido
   * con groundHeightAt — el suelo pintado y el suelo pisado son la misma
   * función, para que la isla no sea un círculo perfecto pero sí estable.
   * @param {number} topR @param {number} bottomR @param {number} height
   * @param {number} amount Amplitud relativa del desplazamiento (0.05 → ±5%).
   */
  _coastGeometry(topR, bottomR, height, amount) {
    const THREE = this._THREE;
    const geo = new THREE.CylinderGeometry(topR, bottomR, height, 40, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 0.001) continue; // vértices centrales de las tapas
      const k = coastFactor(Math.atan2(z, x), amount);
      pos.setX(i, x * k);
      pos.setZ(i, z * k);
    }
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Puerto de inicio: muelle de madera + faro (torre blanca con techo navy).
   * @param {{x: number, y: number}} port
   * @param {boolean} labelVisible La etiqueta flotante se oculta a pie.
   */
  _buildPort(port, labelVisible) {
    const THREE = this._THREE;
    const { wx, wz } = worldFromMap(port.x, port.y);
    const group = new THREE.Group();
    group.position.set(wx, GROUND_Y, wz);

    // Muelle: tablón alargado apuntando hacia el mar (radialmente hacia fuera).
    const dock = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.7, 12),
      new THREE.MeshLambertMaterial({ color: ENV_COLORS.wood }),
    );
    dock.position.set(0, -0.6, 6);
    dock.rotation.y = Math.atan2(wx, wz); // orientado desde el centro de la isla
    group.add(dock);

    // Faro: torre troncocónica + techo cónico navy.
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.6, 7, 10),
      new THREE.MeshLambertMaterial({ color: ENV_COLORS.lighthouse, flatShading: true }),
    );
    tower.position.y = 3.5;
    group.add(tower);
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(1.5, 2, 10),
      new THREE.MeshLambertMaterial({ color: ACCENT_COLORS.route, flatShading: true }),
    );
    cap.position.y = 8;
    group.add(cap);

    const label = this._makeLabel('Puerto', { x: 0, y: 11, z: 0, scale: 6, color: '#5b6b7d' });
    label.visible = labelVisible;
    this._areaLabels.push(label);
    group.add(label);
    return group;
  }

  /**
   * Grupo de ciudades: una casa low-poly por ciudad coloreada por estado
   * (cityStatus del dominio) y enriquecida (MC-8) con puerta de madera, placa
   * con el nombre sobre la puerta (legible de cerca), ventanas emisivas y
   * variación determinista por id (altura/rotación/tono, cityVariant — sin
   * Math.random()). La fachada mira hacia el interior de la isla. Además:
   * acento navy en la ruta planificada, haz de luz en la ciudad actual,
   * etiqueta flotante con el nombre (oculta a pie), la senda del camino
   * recorrido y la ruta planificada discontinua. Geometrías y materiales se
   * comparten dentro de cada build (mismo color → mismo material) y las
   * texturas de placa se cachean entre builds.
   */
  _buildCities() {
    const THREE = this._THREE;
    const group = new THREE.Group();
    const route = new Set(this.journey?.plannedRoute ?? []);
    const current = this.journey?.currentCity ?? null;
    this._cityLabels = [];
    const labelsVisible = this._mode === 'aerial' || this._mode === 'to-aerial';

    // Geometrías compartidas por todas las ciudades de este build.
    const bodyGeo = new THREE.BoxGeometry(CITY_BODY.w, CITY_BODY.h, CITY_BODY.w);
    const roofGeo = new THREE.ConeGeometry(CITY_ROOF.r, CITY_ROOF.h, 4);
    roofGeo.rotateY(Math.PI / 4); // tejado alineado con la caja
    const ringGeo = new THREE.TorusGeometry(2.9, 0.28, 8, 28);
    const doorGeo = new THREE.BoxGeometry(CITY_DOOR.w, CITY_DOOR.h, CITY_DOOR.d);
    const plateGeo = new THREE.PlaneGeometry(CITY_PLATE.w, CITY_PLATE.h);
    const windowGeo = new THREE.PlaneGeometry(CITY_WINDOW.w, CITY_WINDOW.h);
    /** Cache de materiales por color: mismas ciudades → mismo material. */
    const materials = new Map();
    const materialFor = (color) => {
      let m = materials.get(color);
      if (!m) {
        m = new THREE.MeshLambertMaterial({ color });
        materials.set(color, m);
      }
      return m;
    };
    // Ventanas: un ÚNICO material emisivo suave compartido por todas las casas.
    const windowMat = new THREE.MeshLambertMaterial({
      color: ENV_COLORS.window,
      emissive: ENV_COLORS.windowGlow,
      emissiveIntensity: 0.75,
    });
    const half = CITY_BODY.w / 2;

    for (const city of this.map.cities ?? []) {
      const st = cityStatus(this.map, city.id, this.journey);
      const status = st === 'unknown' ? 'blocked' : st;
      const v = cityVariant(city.id);
      // Tono determinista por ciudad sobre el color de estado (cuantizado en
      // cityVariant: la caché de materiales sigue siendo pequeña).
      const color = new THREE.Color(cityStatusColor(status)).multiplyScalar(v.tone).getHex();
      const { wx, wz } = worldFromMap(city.x, city.y);
      const bodyH = CITY_BODY.h * v.height;

      const node = new THREE.Group();
      node.position.set(wx, GROUND_Y, wz);
      // La fachada (+z local) mira al interior de la isla, con un yaw extra
      // determinista por ciudad para que el pueblo no parezca un cuartel.
      const d = Math.hypot(wx, wz);
      const baseYaw = d > 0.001 ? Math.atan2(-wx, -wz) : 0;
      node.rotation.y = baseYaw + v.rotation;
      node.userData.cityId = city.id;

      const body = new THREE.Mesh(bodyGeo, materialFor(color));
      body.scale.y = v.height;
      body.position.y = bodyH / 2;
      node.add(body);

      // Tejado: mismo tono oscurecido (determinista) para dar volumen.
      const roofColor = new THREE.Color(color).multiplyScalar(0.72).getHex();
      const roof = new THREE.Mesh(roofGeo, materialFor(roofColor));
      roof.position.y = bodyH + CITY_ROOF.h / 2;
      node.add(roof);

      // Puerta de madera en la fachada, ligeramente saliente.
      const door = new THREE.Mesh(doorGeo, materialFor(ENV_COLORS.door));
      door.position.set(0, CITY_DOOR.h / 2, half + CITY_DOOR.d / 2 - 0.02);
      node.add(door);

      // Placa con el nombre de la ciudad sobre la puerta (textura cacheada).
      const plate = new THREE.Mesh(
        plateGeo,
        new THREE.MeshBasicMaterial({ map: this._plateTexture(city.name) }),
      );
      plate.position.set(0, CITY_DOOR.h + 0.42, half + 0.03);
      node.add(plate);

      // Ventanas emisivas: dos en la fachada y una por costado.
      for (const [x, y, z, ry] of [
        [-0.9, 2.5, half + 0.02, 0],
        [0.9, 2.5, half + 0.02, 0],
        [half + 0.02, 1.95, 0, Math.PI / 2],
        [-(half + 0.02), 1.95, 0, -Math.PI / 2],
      ]) {
        const win = new THREE.Mesh(windowGeo, windowMat);
        win.position.set(x, y, z);
        win.rotation.y = ry;
        node.add(win);
      }

      // Acento de ruta planificada: anillo navy en la base.
      if (route.has(city.id)) {
        const ring = new THREE.Mesh(ringGeo, materialFor(ACCENT_COLORS.route));
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.25;
        node.add(ring);
      }

      // Ciudad actual: haz de luz vertical coral (marcador distintivo).
      if (current === city.id) {
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.9, 0.9, 30, 12, 1, true),
          new THREE.MeshBasicMaterial({
            color: ACCENT_COLORS.current,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        beam.position.y = 15;
        node.add(beam);
      }

      // Selección (MC-6) o proximidad a pie (MC-7): resalte emisivo sutil.
      if (this.selected === city.id || (this._mode === 'fps' && this._nearCityId === city.id)) {
        const selMat = new THREE.MeshLambertMaterial({
          color,
          emissive: ACCENT_COLORS.route,
          emissiveIntensity: 0.35,
        });
        body.material = selMat;
        materials.set(`sel:${city.id}`, selMat);
      }

      const strike = status === 'deprecated';
      const label = this._makeLabel(city.name, {
        x: 0,
        y: bodyH + CITY_ROOF.h + 2.2,
        z: 0,
        scale: 4,
        color: strike ? '#9ca3af' : '#1e3a5f',
        strike,
      });
      label.visible = labelsVisible;
      this._cityLabels.push(label);
      node.add(label);

      group.add(node);
    }

    // Camino recorrido (MC-8): senda teal sobre la hierba uniendo las ciudades
    // visitadas EN ORDEN; y la ruta planificada como línea discontinua
    // atenuada desde la ciudad actual (o la última visitada).
    const visited = this.journey?.visitedCities ?? [];
    const visitedPts = journeyPathPoints(this.map, visited);
    if (visitedPts.length >= 2) group.add(this._buildVisitedPath(visitedPts));
    const routeStart = current ?? visited.at(-1) ?? null;
    const routePts = journeyPathPoints(this.map, [
      ...(routeStart === null ? [] : [routeStart]),
      ...(this.journey?.plannedRoute ?? []),
    ]);
    if (routePts.length >= 2) group.add(this._buildPlannedRoute(routePts));

    return group;
  }

  /**
   * Senda del camino recorrido: cinta plana (ribbonStrip, puro) apoyada sobre
   * la hierba con elevación + polygonOffset anti z-fighting. Color teal de
   * «visitada»; sin escribir profundidad (es un decal del suelo).
   * @param {{wx: number, wz: number}[]} points Ciudades visitadas, en orden.
   */
  _buildVisitedPath(points) {
    const THREE = this._THREE;
    const strip = ribbonStrip(points, PATH_WIDTH);
    const y = GROUND_Y + PATH_LIFT;
    const positions = new Float32Array(strip.length * 2 * 3);
    for (const [i, p] of strip.entries()) {
      positions.set([p.lx, y, p.lz, p.rx, y, p.rz], i * 6);
    }
    const indices = [];
    for (let i = 0; i < strip.length - 1; i += 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: STATUS_COLORS.visited,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    return mesh;
  }

  /**
   * Ruta planificada: línea discontinua navy atenuada, un poco por encima de
   * la senda para que ambas convivan sin pelearse.
   * @param {{wx: number, wz: number}[]} points Ciudad de partida + ruta, en orden.
   */
  _buildPlannedRoute(points) {
    const THREE = this._THREE;
    const y = GROUND_Y + ROUTE_LIFT;
    const geo = new THREE.BufferGeometry().setFromPoints(
      points.map((p) => new THREE.Vector3(p.wx, y, p.wz)),
    );
    const line = new THREE.Line(
      geo,
      new THREE.LineDashedMaterial({
        color: ACCENT_COLORS.route,
        transparent: true,
        opacity: 0.55,
        dashSize: 1.6,
        gapSize: 1.1,
      }),
    );
    line.computeLineDistances(); // sin esto el dash no se pinta
    return line;
  }

  /**
   * Textura de la placa de puerta con el nombre de la ciudad, cacheada por
   * nombre (userData.shared: _disposeSubtree no la libera; ver constructor).
   * Placa clara con borde de madera y texto navy, con la fuente adaptada para
   * que quepan también los nombres largos.
   * @param {string} name
   */
  _plateTexture(name) {
    let texture = this._plateTextures.get(name);
    if (texture) return texture;
    const THREE = this._THREE;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f6ead2';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = '#7a5a33';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 250, 58);
    let fontSize = 34;
    ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
    while (fontSize > 14 && ctx.measureText(name).width > 228) {
      fontSize -= 2;
      ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1e3a5f';
    ctx.fillText(name, 128, 34);
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.userData.shared = true;
    this._plateTextures.set(name, texture);
    return texture;
  }

  /** Libera y vacía la caché de texturas de placa (cambio de isla, teardown). */
  _clearPlateCache() {
    for (const texture of this._plateTextures.values()) texture.dispose();
    this._plateTextures.clear();
  }

  /**
   * Etiqueta flotante: sprite con el texto pintado en un CanvasTexture (siempre
   * de cara a la cámara). El halo blanco garantiza el contraste sobre la escena.
   * @param {string} text
   * @param {{x:number,y:number,z:number,scale:number,color:string,strike?:boolean}} opts
   */
  _makeLabel(text, { x, y, z, scale, color, strike = false }) {
    const THREE = this._THREE;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const fs = 44;
    ctx.font = `700 ${fs}px system-ui, sans-serif`;
    const w = Math.ceil(ctx.measureText(text).width) + 24;
    canvas.width = w;
    canvas.height = fs + 24;
    // Cambiar el tamaño del canvas resetea el contexto: se reconfigura la fuente.
    ctx.font = `700 ${fs}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 8;
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = color;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    if (strike) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(12, canvas.height / 2);
      ctx.lineTo(canvas.width - 12, canvas.height / 2);
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true }),
    );
    sprite.position.set(x, y, z);
    sprite.scale.set((scale * canvas.width) / canvas.height, scale, 1);
    return sprite;
  }

  // ---- Picking (MC-6) ---------------------------------------------------------

  /**
   * Clic (no arrastre de órbita) → raycast en dos pasadas:
   *  1. Ciudades: emite `select-city` Y anima el zoom hasta la ciudad (el zoom
   *     lo hace este componente; el contenedor NO debe volver a animar).
   *  2. Plataformas de comarca: zoom a la comarca (sin evento de selección).
   * Agua/vacío: nada — no se deselecciona de forma agresiva.
   *
   * En modo primera persona (MC-7) el clic cambia de papel: sin lock lo
   * re-engancha; con lock abre la ciudad cercana (equivalente a la tecla E).
   * Durante las transiciones de modo no hace nada.
   */
  _onPick(event) {
    if (this._mode !== 'aerial') {
      this._pointerDownAt = null;
      if (this._mode === 'fps') {
        if (!this._fpsLocked) this._requestLock();
        else if (this._nearCityId) this._openNearCity();
      }
      return;
    }
    if (!this._pointerDownAt || !this._citiesGroup) return;
    const moved = Math.hypot(
      event.clientX - this._pointerDownAt.x,
      event.clientY - this._pointerDownAt.y,
    );
    this._pointerDownAt = null;
    if (moved > DRAG_THRESHOLD) return;

    const THREE = this._THREE;
    const rect = event.currentTarget.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this._camera);
    const hits = raycaster.intersectObjects(this._citiesGroup.children, true);
    for (const hit of hits) {
      let obj = hit.object;
      while (obj && !obj.userData.cityId) obj = obj.parent;
      if (obj?.userData.cityId) {
        this.focusCity(obj.userData.cityId);
        this.dispatchEvent(
          new CustomEvent('select-city', {
            detail: { cityId: obj.userData.cityId },
            bubbles: true,
            composed: true,
          }),
        );
        return;
      }
    }

    // Sin ciudad bajo el cursor: ¿plataforma de comarca? (raycast barato: solo
    // los parches circulares, sin descender por el grupo estático completo).
    const areaHit = raycaster.intersectObjects(this._areaPatches, false)[0];
    if (areaHit) this.focusArea(areaHit.object.userData.areaId);
  }

  // ---- Limpieza ---------------------------------------------------------------

  /**
   * Libera geometrías, materiales y texturas de un subárbol de la escena.
   * Las texturas marcadas como compartidas (userData.shared: las placas de
   * puerta cacheadas) NO se liberan aquí: su ciclo de vida lo lleva la caché.
   */
  static _disposeSubtree(root) {
    root.traverse((obj) => {
      obj.geometry?.dispose?.();
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      for (const m of mats) {
        if (m.map && m.map.userData?.shared !== true) m.map.dispose?.();
        m.dispose();
      }
    });
  }

  /** Detiene el bucle, desconecta observers y libera todos los recursos GPU. */
  _teardown() {
    this._stopLoop();
    // El modo primera persona no sobrevive al teardown: se suelta el lock y se
    // desconectan los PointerLockControls (sus listeners de documento incluidos).
    if (this.renderRoot.pointerLockElement) document.exitPointerLock();
    this._plc?.dispose();
    this._plc = null;
    this._mode = 'aerial';
    this._fpsLocked = false;
    this._expectUnlock = false;
    this._keys.clear();
    this._nearCityId = null;
    this._abort?.abort();
    this._abort = null;
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    if (this._scene) CareerIsland3D._disposeSubtree(this._scene);
    this._clearPlateCache();
    this._cityLabels = [];
    this._areaLabels = [];
    this._controls?.dispose();
    this._renderer?.dispose();
    this._scene = null;
    this._camera = null;
    this._controls = null;
    this._renderer = null;
    this._staticGroup = null;
    this._citiesGroup = null;
    this._lastMapId = null;
    this._camAnim = null;
    this._areaPatches = [];
  }

  render() {
    return html`
      <div class="wrap">
        <canvas aria-label="Isla de carrera en 3D. Arrastra para orbitar, rueda para hacer zoom y haz clic en una ciudad para abrir su panel de ciudadanía. En modo a pie: flechas arriba/abajo o W/S para avanzar y retroceder, flechas izquierda/derecha para girar, A/D para desplazarte en lateral, Shift para correr, ratón para mirar y E para la ciudad cercana."></canvas>
        ${this._mode === 'fps' && this._fpsLocked
          ? html`<div class="crosshair" aria-hidden="true"></div>`
          : null}
        ${this._renderFpsHint()}
        ${this._phase === 'loading' ? html`<div class="overlay">Cargando isla 3D…</div>` : null}
        ${this._phase === 'unsupported'
          ? html`<div class="overlay">Tu navegador no soporta WebGL. Usa la vista plana.</div>`
          : null}
        ${this._phase === 'error'
          ? html`<div class="overlay error">No se pudo cargar el motor 3D. Recarga la página o usa la vista plana.</div>`
          : null}
      </div>
    `;
  }
}

if (!customElements.get('career-island-3d')) {
  customElements.define('career-island-3d', CareerIsland3D);
}
