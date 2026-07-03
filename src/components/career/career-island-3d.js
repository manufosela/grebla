/**
 * <career-island-3d>
 * Render 3D REAL de la isla de carrera con Three.js (MC-5: fundación;
 * MC-6: zoom animado a ciudad/comarca).
 *
 * Es intercambiable con <career-map> y <career-island>: mismas propiedades y el
 * mismo evento `select-city`. La escena se GENERA del modelo (/careerMap/island)
 * con geometrías low-poly de código, sin assets externos:
 *  - isla (playa + hierba), agua y cielo/niebla
 *  - una plataforma sutil por comarca con su etiqueta flotante
 *  - un hito (casa: caja + tejado piramidal) por ciudad, coloreado por estado
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
  ACCENT_COLORS,
} from '../../tools/career/domain/islandLayout.js';

/** Altura (y de mundo) de la superficie de hierba donde se asientan las ciudades. */
const GROUND_Y = 2.2;
/** Dimensiones del hito de ciudad (casa low-poly). */
const CITY_BODY = { w: 2.6, h: 3.2 };
const CITY_ROOF = { r: 2.3, h: 2.2 };
/** Umbral (px de cliente) para distinguir un arrastre de órbita de un clic. */
const DRAG_THRESHOLD = 5;
/** Límite del paneo del target respecto al radio de la isla. */
const PAN_LIMIT_FACTOR = 1.2;
/** Duración (ms) de las animaciones de foco de cámara (zoom a ciudad/comarca/vista general). */
const FOCUS_ANIM_MS = 700;
/** Colores del entorno (cielo, agua, arena, hierba, madera, faro). */
const ENV_COLORS = {
  sky: 0xdceff5,
  water: 0x4d90c4,
  sand: 0xe9dcae,
  grass: 0x9fce8f,
  wood: 0x9a7b4f,
  lighthouse: 0xf5f2ea,
};

export class CareerIsland3D extends LitElement {
  static properties = {
    map: { attribute: false },
    journey: { attribute: false },
    reachable: { attribute: false },
    selected: { attribute: false },
    _phase: { state: true },
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
    try {
      // Import dinámico: three solo se descarga al montar la vista 3D.
      [THREE, { OrbitControls }] = await Promise.all([
        import('three'),
        import('three/addons/controls/OrbitControls.js'),
      ]);
    } catch (err) {
      this._phase = 'error';
      throw err instanceof Error ? err : new Error('No se pudo cargar el motor 3D.');
    }
    if (!this.isConnected || this._renderer) return;
    this._THREE = THREE;

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

    // Luz: sol direccional + hemisférica suave. Sin sombras en MC-5 (fluidez).
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(60, 120, 40);
    this._scene.add(sun);
    this._scene.add(new THREE.HemisphereLight(0xf1f8fb, 0xcfe3d4, 0.9));

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
   * Bucle rAF: damping de los controles + animación de foco + render. La
   * animación se aplica DESPUÉS de controls.update() para que tenga la última
   * palabra sobre cámara y target mientras dura (el damping residual no la
   * pelea; el input del usuario la cancela vía el evento 'start').
   * Se pausa con document.hidden.
   */
  _startLoop() {
    if (this._raf || !this._renderer) return;
    /** @param {DOMHighResTimeStamp} now */
    const step = (now) => {
      this._raf = requestAnimationFrame(step);
      this._controls.update();
      this._tickCameraAnim(now);
      this._clampTarget();
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

  // ---- Zoom animado de cámara (MC-6) ------------------------------------------

  /**
   * Enfoca una ciudad con zoom animado: la cámara llega cerca de su casa, con
   * un ángulo agradable (~38°) y conservando el azimut actual (llega "desde
   * donde está", sin giros bruscos). API pública para <career-app>.
   * @param {string} cityId
   */
  focusCity(cityId) {
    if (this._phase !== 'ready') return;
    const frame = cityFocusFrame(this.map, cityId);
    if (frame) this._animateTo(this._poseFromFrame(frame));
  }

  /**
   * Enfoca una comarca completa: encuadra su plataforma (distancia proporcional
   * a su radio) con vista más aérea. API pública para <career-app>.
   * @param {string} areaId
   */
  focusArea(areaId) {
    if (this._phase !== 'ready') return;
    const frame = areaFocusFrame(this.map, areaId);
    if (frame) this._animateTo(this._poseFromFrame(frame));
  }

  /** Vuelve, con animación, al encuadre aéreo inicial de toda la isla. */
  focusOverview() {
    if (this._phase !== 'ready') return;
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

  /** Arranca una animación de foco desde la pose actual hacia la indicada. */
  _animateTo({ position, target }) {
    this._camAnim = {
      fromPos: this._camera.position.clone(),
      toPos: position,
      fromTarget: this._controls.target.clone(),
      toTarget: target,
      start: performance.now(),
    };
  }

  /**
   * Avanza la animación de foco en curso (easeInOutCubic). Al completarse se
   * limpia sola; el input del usuario la cancela antes (evento 'start').
   * @param {DOMHighResTimeStamp} now
   */
  _tickCameraAnim(now) {
    const anim = this._camAnim;
    if (!anim) return;
    const t = Math.min((now - anim.start) / FOCUS_ANIM_MS, 1);
    const k = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    this._camera.position.lerpVectors(anim.fromPos, anim.toPos, k);
    this._controls.target.lerpVectors(anim.fromTarget, anim.toTarget, k);
    if (t >= 1) this._camAnim = null;
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
    this._replaceGroup('_staticGroup', this._buildStatic());
    this._rebuildCities();
    if (this.map.id !== this._lastMapId) {
      this._lastMapId = this.map.id;
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
    const beach = new THREE.Mesh(
      this._coastGeometry(R + 4, R + 8, 2, 0.05),
      new THREE.MeshLambertMaterial({ color: ENV_COLORS.sand, flatShading: true }),
    );
    beach.position.y = 1;
    group.add(beach);

    // Interior: meseta de hierba donde viven comarcas y ciudades.
    const grass = new THREE.Mesh(
      this._coastGeometry(R, R + 3, 2.4, 0.04),
      new THREE.MeshLambertMaterial({ color: ENV_COLORS.grass, flatShading: true }),
    );
    grass.position.y = 1;
    group.add(grass);

    // Comarcas: parche circular sutil + etiqueta flotante con el nombre.
    // Los parches son raycasteables (MC-6): clic en la plataforma → zoom a la comarca.
    this._areaPatches = [];
    for (const { area, center, radius, color } of areaLayout(this.map)) {
      const patch = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 24),
        new THREE.MeshLambertMaterial({ color }),
      );
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(center.wx, GROUND_Y + 0.06, center.wz);
      patch.userData.areaId = area.id;
      this._areaPatches.push(patch);
      group.add(patch);
      group.add(this._makeLabel(area.name, {
        x: center.wx,
        y: GROUND_Y + 10.5,
        z: center.wz,
        scale: 6.5,
        color: '#5b6b7d',
      }));
    }

    if (this.map.startPort) group.add(this._buildPort(this.map.startPort));
    return group;
  }

  /**
   * Cilindro low-poly con la costa irregular: los vértices del perímetro se
   * desplazan radialmente con una función determinista del ángulo (sin RNG),
   * para que la isla no sea un círculo perfecto pero sí estable entre renders.
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
      const angle = Math.atan2(z, x);
      const k = 1 + amount * Math.sin(angle * 4.7) + amount * 0.6 * Math.cos(angle * 7.3);
      pos.setX(i, x * k);
      pos.setZ(i, z * k);
    }
    geo.computeVertexNormals();
    return geo;
  }

  /** Puerto de inicio: muelle de madera + faro (torre blanca con techo navy). */
  _buildPort(port) {
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

    group.add(this._makeLabel('Puerto', { x: 0, y: 11, z: 0, scale: 6, color: '#5b6b7d' }));
    return group;
  }

  /**
   * Grupo de ciudades: una casa low-poly por ciudad coloreada por estado
   * (cityStatus del dominio), acento navy en la ruta planificada, haz de luz
   * en la ciudad actual y etiqueta con el nombre. Geometrías y materiales se
   * comparten dentro de cada build (mismo estado → mismo material).
   */
  _buildCities() {
    const THREE = this._THREE;
    const group = new THREE.Group();
    const route = new Set(this.journey?.plannedRoute ?? []);
    const current = this.journey?.currentCity ?? null;

    // Geometrías compartidas por todas las ciudades de este build.
    const bodyGeo = new THREE.BoxGeometry(CITY_BODY.w, CITY_BODY.h, CITY_BODY.w);
    const roofGeo = new THREE.ConeGeometry(CITY_ROOF.r, CITY_ROOF.h, 4);
    roofGeo.rotateY(Math.PI / 4); // tejado alineado con la caja
    const ringGeo = new THREE.TorusGeometry(2.9, 0.28, 8, 28);
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

    for (const city of this.map.cities ?? []) {
      const st = cityStatus(this.map, city.id, this.journey);
      const status = st === 'unknown' ? 'blocked' : st;
      const color = cityStatusColor(status);
      const { wx, wz } = worldFromMap(city.x, city.y);

      const node = new THREE.Group();
      node.position.set(wx, GROUND_Y, wz);
      node.userData.cityId = city.id;

      const body = new THREE.Mesh(bodyGeo, materialFor(color));
      body.position.y = CITY_BODY.h / 2;
      node.add(body);

      // Tejado: mismo tono oscurecido (determinista) para dar volumen.
      const roofColor = new THREE.Color(color).multiplyScalar(0.72).getHex();
      const roof = new THREE.Mesh(roofGeo, materialFor(roofColor));
      roof.position.y = CITY_BODY.h + CITY_ROOF.h / 2;
      node.add(roof);

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

      // Selección (hook MC-6): resalte emisivo sutil, sin panel todavía.
      if (this.selected === city.id) {
        const selMat = new THREE.MeshLambertMaterial({
          color,
          emissive: ACCENT_COLORS.route,
          emissiveIntensity: 0.35,
        });
        body.material = selMat;
        materials.set(`sel:${city.id}`, selMat);
      }

      const strike = status === 'deprecated';
      node.add(this._makeLabel(city.name, {
        x: 0,
        y: CITY_BODY.h + CITY_ROOF.h + 2.2,
        z: 0,
        scale: 4,
        color: strike ? '#9ca3af' : '#1e3a5f',
        strike,
      }));

      group.add(node);
    }
    return group;
  }

  /**
   * Etiqueta flotante: sprite con el texto pintado en un CanvasTexture (siempre
   * de cara a la cámara). El halo blanco imita el paint-order de la vista 2.5D.
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
   */
  _onPick(event) {
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

  /** Libera geometrías, materiales y texturas de un subárbol de la escena. */
  static _disposeSubtree(root) {
    root.traverse((obj) => {
      obj.geometry?.dispose?.();
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      for (const m of mats) {
        m.map?.dispose?.();
        m.dispose();
      }
    });
  }

  /** Detiene el bucle, desconecta observers y libera todos los recursos GPU. */
  _teardown() {
    this._stopLoop();
    this._abort?.abort();
    this._abort = null;
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    if (this._scene) CareerIsland3D._disposeSubtree(this._scene);
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
        <canvas aria-label="Isla de carrera en 3D. Arrastra para orbitar, rueda para hacer zoom y haz clic en una ciudad para abrir su panel de ciudadanía."></canvas>
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
