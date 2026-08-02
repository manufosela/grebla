/**
 * <seabed-view> — el lecho como JUEGO 3D en PRIMERA PERSONA (RMR-PCS-0028 · B2).
 *
 * Motor propio (no reutiliza el 3D de la isla). Buceas en primera persona
 * (WASD/flechas para avanzar/desplazarte, ratón arrastrando para mirar) por un
 * fondo submarino con CASAS-CORAL grandes y vistosas: cada arrecife es una casa
 * con una PUERTA; al acercarte a su puerta puedes ENTRAR ([E]) y ver su info
 * (resumen, claves, era-IA, recursos, encender) — igual que en la isla. En el
 * centro, por donde bajaste, hay una CORRIENTE ASCENDENTE (agua más clara,
 * animada) por la que subir a la superficie ([E]).
 *
 * Mismos props/eventos que antes (map/journey/canPlay/onToggle · `surface`), así
 * que <career-app> no cambia. Fallback legible si WebGL no está disponible.
 */
import { LitElement, html, css, nothing } from 'lit';
import { seabedScene, seabedProgress, arrecifeOrder } from '../../tools/career/domain/seabed.js';

const STATUS_LABEL = { visited: 'encendido', available: 'disponible', blocked: 'bloqueado' };
const KIND_LABEL = { milestone: 'Hito', tech: 'Tecnología', skill: 'Competencia' };
const STATUS_COLOR = { visited: 0x8bf0be, available: 0x4dd0e1, blocked: 0x4a6675 };
const MILESTONE_COLOR = 0xffcf6b;
/** Mapa 0..100 → mundo. Más grande = más ESPACIO entre casas-coral. */
const WORLD_SCALE = 2.6;
const EYE_Y = 8;            // altura de buceo
const SWIM_SPEED = 0.9;     // avance por frame
const SCENE_R = 150;        // radio nadable
const ENTER_RADIUS = 17;    // proximidad a la PUERTA de una casa-coral
const EXIT_RADIUS = 13;     // proximidad a la corriente ascendente
const MOVE_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class SeabedView extends LitElement {
  static properties = {
    map: { attribute: false },
    journey: { attribute: false },
    canPlay: { attribute: false },
    onToggle: { attribute: false },
    _selected: { state: true },
    _pending: { state: true },
    _error: { state: true },
    _near: { state: true },      // cityId de la casa-coral cercana (o null)
    _nearExit: { state: true },  // ¿junto a la corriente ascendente?
  };

  static styles = css`
    :host { display: block; position: relative; color: #e8f4f8; background: #04141f; overflow: hidden; min-height: 30rem; border-radius: 14px; }
    header.deep { position: absolute; top: 0; left: 0; right: 0; z-index: 3; display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1.1rem 1.3rem 0.4rem; pointer-events: none; }
    .titles h3 { margin: 0; font-size: 1.25rem; text-shadow: 0 0 14px rgba(77, 208, 225, 0.55), 0 2px 8px #000; }
    .titles p { margin: 0.2rem 0 0; font-size: 0.85rem; color: #bfe0ee; max-width: 42ch; text-shadow: 0 1px 6px #000; }
    .count { margin: 0.4rem 0 0; font-size: 0.8rem; color: #9beccb; display: inline-flex; align-items: center; gap: 0.4rem; text-shadow: 0 1px 6px #000; }
    .lit-dot { width: 0.6rem; height: 0.6rem; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fffef0, #a9f5cf 45%, #2aa578); box-shadow: 0 0 8px rgba(126, 255, 196, 0.7); }
    .surface { flex: none; pointer-events: auto; border: 1.5px solid rgba(120, 210, 255, 0.6); background: rgba(6, 26, 38, 0.75); color: #cdeefb; border-radius: 999px; padding: 0.45rem 0.95rem; font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; backdrop-filter: blur(2px); }
    .surface:hover, .surface:focus-visible { border-color: #7fdfff; color: #fff; outline: none; box-shadow: 0 0 0 3px rgba(77, 208, 225, 0.3); }
    .stage { position: absolute; inset: 0; z-index: 1; }
    .stage canvas { display: block; width: 100% !important; height: 100% !important; cursor: grab; }
    .stage canvas:active { cursor: grabbing; }
    .prompt { position: absolute; left: 50%; bottom: 3.2rem; transform: translateX(-50%); z-index: 2; background: rgba(6, 26, 38, 0.85); border: 1.5px solid #4dd0e1; color: #eaf7fc; border-radius: 999px; padding: 0.5rem 1rem; font-size: 0.92rem; font-weight: 600; box-shadow: 0 0 18px rgba(77, 208, 225, 0.4); }
    .prompt kbd { background: #0a2a3c; border: 1px solid #4dd0e1; border-radius: 5px; padding: 0 0.35rem; font-weight: 800; }
    .hint { position: absolute; left: 50%; bottom: 0.8rem; transform: translateX(-50%); z-index: 2; font-size: 0.76rem; color: #8fb8c8; text-shadow: 0 1px 6px #000; pointer-events: none; text-align: center; }
    .error { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 1rem; align-items: center; justify-content: center; z-index: 2; padding: 2rem; text-align: center; color: #9fc6d6; }
    .sheet-backdrop { position: absolute; inset: 0; z-index: 4; background: rgba(2, 10, 18, 0.55); backdrop-filter: blur(2px); }
    .sheet { position: absolute; z-index: 5; left: 50%; bottom: 0; transform: translateX(-50%); width: min(92%, 40rem); max-height: 88%; overflow-y: auto; background: linear-gradient(180deg, #0c2c40, #071a28); color: #e8f4f8; border: 1px solid rgba(120, 210, 255, 0.35); border-bottom: 0; border-radius: 16px 16px 0 0; box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5); padding: 1.1rem 1.3rem 1.5rem; animation: surface-up 0.28s ease-out; }
    @keyframes surface-up { from { transform: translate(-50%, 30%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
    .sheet .close { float: right; border: 0; background: none; color: #9fc6d6; font-size: 1.4rem; line-height: 1; cursor: pointer; }
    .sheet .close:hover, .sheet .close:focus-visible { color: #fff; outline: none; }
    .sheet .kind { display: inline-block; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; color: #7fdfff; margin-bottom: 0.2rem; }
    .sheet .st { text-transform: none; letter-spacing: 0; color: #8fd3e6; } .sheet .st.visited { color: #8fe0b8; } .sheet .st.blocked { color: #9fb4c0; }
    .sheet h4 { margin: 0 0 0.5rem; font-size: 1.3rem; text-shadow: 0 0 12px rgba(77, 208, 225, 0.4); }
    .sheet .summary { margin: 0 0 0.9rem; color: #d6ecf5; line-height: 1.5; }
    .sheet h5 { margin: 1rem 0 0.4rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #8fd3e6; }
    .sheet ul { margin: 0; padding-left: 1.1rem; } .sheet li { margin: 0.2rem 0; line-height: 1.4; }
    .sheet .aifocus { background: rgba(77, 208, 225, 0.1); border-left: 3px solid #4dd0e1; padding: 0.55rem 0.8rem; border-radius: 0 8px 8px 0; color: #dff3fa; line-height: 1.5; }
    .sheet .res { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .sheet .res a, .sheet .res span { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.82rem; border: 1px solid rgba(120, 210, 255, 0.35); border-radius: 999px; padding: 0.3rem 0.7rem; color: #cdeefb; text-decoration: none; }
    .sheet .res a:hover, .sheet .res a:focus-visible { border-color: #7fdfff; color: #fff; outline: none; }
    .sheet .res .rk { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.04em; color: #7fbdd2; }
    .sheet .act { margin-top: 1.2rem; }
    .sheet .certify { border: 1.5px solid #4dd0e1; background: rgba(77, 208, 225, 0.14); color: #eaf7fc; border-radius: 999px; padding: 0.5rem 1.05rem; font: inherit; font-weight: 700; cursor: pointer; }
    .sheet .certify:hover:not(:disabled), .sheet .certify:focus-visible { background: rgba(77, 208, 225, 0.26); outline: none; box-shadow: 0 0 0 3px rgba(77, 208, 225, 0.3); }
    .sheet .certify.on { border-color: #7fe0b8; color: #cdfbe6; background: rgba(126, 224, 184, 0.16); }
    .sheet .certify:disabled { opacity: 0.5; cursor: not-allowed; }
  `;

  constructor() {
    super();
    this.map = null;
    this.journey = null;
    this.canPlay = false;
    this.onToggle = null;
    this._selected = null;
    this._pending = false;
    this._error = '';
    this._near = null;
    this._nearExit = false;
    this._t = null;
    this._raf = 0;
    this._reefs = [];         // { group, spot:{x,z}, cityId }
    this._keys = new Set();
    this._yaw = 0;
    this._pitch = -0.12;
    this._drag = null;        // {x,y} durante el arrastre de mirada
    this._exitParts = [];
  }

  connectedCallback() {
    super.connectedCallback();
    this._onKeyDown = (e) => {
      if (e.code === 'Escape') {
        if (this._selected) {
          this._selected = null;
        } else {
          this._surface();
        }
        return;
      }
      if (this._selected) return; // con la ficha abierta no se bucea
      if (e.code === 'KeyE') { this._interact(); return; }
      if (MOVE_CODES.has(e.code)) { this._keys.add(e.code); e.preventDefault(); }
    };
    this._onKeyUp = (e) => { this._keys.delete(e.code); };
    globalThis.addEventListener('keydown', this._onKeyDown);
    globalThis.addEventListener('keyup', this._onKeyUp);
  }

  disconnectedCallback() {
    globalThis.removeEventListener('keydown', this._onKeyDown);
    globalThis.removeEventListener('keyup', this._onKeyUp);
    this._teardown();
    super.disconnectedCallback();
  }

  firstUpdated() { this._init(); }

  updated(changed) {
    if (this._t && (changed.has('map') || changed.has('journey'))) this._buildReefs();
  }

  _surface() { this.dispatchEvent(new CustomEvent('surface', { bubbles: true, composed: true })); }
  _city(id) { return (this.map?.cities ?? []).find((c) => c.id === id) ?? null; }

  /** [E]: entrar en la casa-coral cercana, o subir por la corriente. */
  _interact() {
    if (this._near) this._selected = this._near;
    else if (this._nearExit) this._surface();
  }

  async _init() {
    const host = this.renderRoot.querySelector('.stage');
    if (!host) return;
    try {
      const THREE = await import('three');
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
      const w = host.clientWidth || 800; const h = host.clientHeight || 600;
      renderer.setSize(w, h, false);
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x04141f);
      scene.fog = new THREE.FogExp2(0x062032, 0.006);

      const camera = new THREE.PerspectiveCamera(62, w / h, 0.1, 2000);
      camera.rotation.order = 'YXZ';
      camera.position.set(0, EYE_Y, 24); // apareces junto a la corriente (centro), mirando fuera

      scene.add(new THREE.HemisphereLight(0x9fe6ff, 0x03202e, 0.6));
      const key = new THREE.DirectionalLight(0xbfeeff, 0.8); key.position.set(30, 80, 20); scene.add(key);

      const floor = new THREE.Mesh(new THREE.CircleGeometry(SCENE_R + 40, 56), new THREE.MeshStandardMaterial({ color: 0x06202e, roughness: 1 }));
      floor.rotation.x = -Math.PI / 2; scene.add(floor);

      this._t = { THREE, renderer, scene, camera, host };
      renderer.domElement.addEventListener('pointerdown', this._onDown);
      globalThis.addEventListener('pointermove', this._onMove);
      globalThis.addEventListener('pointerup', this._onUp);
      this._ro = new ResizeObserver(() => this._resize()); this._ro.observe(host);
      this._buildExit();
      this._buildReefs();
      this._loop();
    } catch (err) {
      this._error = 'No se pudo cargar la vista 3D del lecho (WebGL no disponible).';
      console.error('[seabed-view] init 3D falló:', err);
    }
  }

  _world(n) { return [(n.x - 50) * WORLD_SCALE, (n.y - 50) * WORLD_SCALE]; }

  _buildReefs() {
    if (!this._t) return;
    const { scene } = this._t;
    for (const r of this._reefs) { scene.remove(r.group); this._dispose(r.group); }
    this._reefs = [];
    const { nodes } = seabedScene(this.map);
    const { statusById } = seabedProgress(this.map, this.journey);
    const order = arrecifeOrder(this.map);
    for (const n of nodes) {
      const status = statusById.get(n.id) ?? 'available';
      const milestone = n.kind === 'milestone';
      const color = milestone ? MILESTONE_COLOR : (STATUS_COLOR[status] ?? STATUS_COLOR.available);
      const [wx, wz] = this._world(n);
      const { group, height } = this._coralHouse(color, status, milestone);
      group.position.set(wx, 0, wz);
      group.rotation.y = Math.atan2(-wx, -wz); // la puerta (local +z) mira al centro
      group.add(this._numberSprite(order.get(n.id) ?? 1, color, height));
      scene.add(group);
      this._reefs.push({ group, spot: { x: wx, z: wz }, cityId: n.id });
    }
  }

  /** Casa-coral GRANDE y vistosa con una PUERTA (hueco) en su cara +z (al centro). */
  _coralHouse(color, status, milestone) {
    const { THREE } = this._t;
    const g = new THREE.Group();
    const ei = status === 'blocked' ? 0.12 : 0.8;
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: ei, roughness: 0.5, metalness: 0.1 });
    const H = 16 + (milestone ? 5 : 0);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 7, H, 12), mat);
    body.position.y = H / 2; g.add(body);
    // lóbulos vistosos alrededor
    for (let i = 0; i < 7; i += 1) {
      const a = (i / 7) * Math.PI * 2;
      const s = new THREE.Mesh(new THREE.SphereGeometry(2.4 + (i % 3) * 0.7, 14, 12), mat);
      s.position.set(Math.cos(a) * (4.5 + (i % 2) * 1.5), H * 0.5 + (i % 3) * 2.5, Math.sin(a) * (4.5 + (i % 2) * 1.5));
      g.add(s);
    }
    // ramas de coral en lo alto
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.ConeGeometry(1.2, H * 0.45, 6), mat);
      b.position.set(Math.cos(a) * 3, H * 0.98, Math.sin(a) * 3);
      b.rotation.z = -Math.cos(a) * 0.35; b.rotation.x = Math.sin(a) * 0.35;
      g.add(b);
    }
    if (status !== 'blocked') { const l = new THREE.PointLight(color, milestone ? 1.8 : 1.3, 34, 2); l.position.y = H * 0.6; g.add(l); }
    // PUERTA en +z: dos pilares, dintel y un hueco oscuro (por donde entrar).
    const doorMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: ei * 0.7, roughness: 0.5 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x01070c });
    const dh = 8, dw = 5, dz = 6.9;
    const pillar = new THREE.CylinderGeometry(0.7, 0.85, dh, 8);
    const pL = new THREE.Mesh(pillar, doorMat); pL.position.set(-dw / 2, dh / 2, dz); g.add(pL);
    const pR = new THREE.Mesh(pillar, doorMat); pR.position.set(dw / 2, dh / 2, dz); g.add(pR);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(dw + 2, 1.3, 1.7), doorMat); lintel.position.set(0, dh, dz); g.add(lintel);
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), dark); hole.position.set(0, dh / 2, dz - 0.1); g.add(hole);
    return { group: g, height: H };
  }

  _numberSprite(num, color, height) {
    const { THREE } = this._t;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.beginPath(); ctx.arc(64, 64, 52, 0, Math.PI * 2); ctx.fillStyle = 'rgba(4,18,28,0.9)'; ctx.fill();
    ctx.lineWidth = 7; ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`; ctx.stroke();
    ctx.fillStyle = '#eaf7fc'; ctx.font = 'bold 68px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(num), 64, 70);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    spr.scale.set(7, 7, 1); spr.position.y = height + 5;
    return spr;
  }

  /** Corriente ASCENDENTE en el centro (por donde bajaste): columna de agua más
   *  clara con partículas que suben. Al acercarte, [E] sube a la superficie. */
  _buildExit() {
    const { THREE, scene } = this._t;
    const g = new THREE.Group();
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 6, 90, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xaef0ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
    );
    col.position.y = 45; g.add(col);
    const ring = new THREE.Mesh(new THREE.RingGeometry(6, 7.4, 32), new THREE.MeshBasicMaterial({ color: 0xaef0ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; g.add(ring);
    this._exitParts = [];
    for (let i = 0; i < 30; i += 1) {
      const a = (i / 30) * Math.PI * 2; const r = 1 + (i % 5);
      const p = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xd6f4ff, transparent: true, opacity: 0.55, depthTest: false }));
      p.position.set(Math.cos(a) * r, (i / 30) * 80, Math.sin(a) * r); p.scale.set(1.4, 1.4, 1);
      g.add(p); this._exitParts.push(p);
    }
    scene.add(g); this._exitGroup = g; this._exitSpot = { x: 0, z: 0 };
  }

  _onDown = (e) => { this._drag = { x: e.clientX, y: e.clientY }; };
  _onMove = (e) => {
    if (!this._drag) return;
    this._yaw -= (e.clientX - this._drag.x) * 0.004;
    this._pitch = Math.max(-1.2, Math.min(1.2, this._pitch - (e.clientY - this._drag.y) * 0.004));
    this._drag = { x: e.clientX, y: e.clientY };
  };
  _onUp = () => { this._drag = null; };

  _resize() {
    if (!this._t) return;
    const { renderer, camera, host } = this._t;
    const w = host.clientWidth || 800; const h = host.clientHeight || 600;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  _loop = () => {
    if (!this._t) return;
    this._raf = requestAnimationFrame(this._loop);
    const { renderer, scene, camera } = this._t;
    camera.rotation.y = this._yaw; camera.rotation.x = this._pitch;
    // Buceo (WASD/flechas), pausado con la ficha abierta.
    if (!this._selected) {
      let f = 0; let s = 0;
      const k = this._keys;
      if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) s += 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) s -= 1;
      if (f || s) {
        const fx = -Math.sin(this._yaw); const fz = -Math.cos(this._yaw);
        const rx = Math.cos(this._yaw); const rz = -Math.sin(this._yaw);
        camera.position.x += (f * fx + s * rx) * SWIM_SPEED;
        camera.position.z += (f * fz + s * rz) * SWIM_SPEED;
        const d = Math.hypot(camera.position.x, camera.position.z);
        if (d > SCENE_R) { camera.position.x *= SCENE_R / d; camera.position.z *= SCENE_R / d; }
      }
    }
    camera.position.y = EYE_Y;
    // Partículas de la corriente: suben y reaparecen abajo.
    for (const p of this._exitParts) { p.position.y += 0.35; if (p.position.y > 82) p.position.y -= 82; }
    // Proximidad: casa-coral más cercana y corriente.
    this._updateProximity();
    renderer.render(scene, camera);
  };

  _updateProximity() {
    const { x, z } = this._t.camera.position;
    let near = null; let best = ENTER_RADIUS;
    for (const r of this._reefs) {
      const d = Math.hypot(x - r.spot.x, z - r.spot.z);
      if (d < best) { best = d; near = r.cityId; }
    }
    if (near !== this._near) this._near = near;
    const atExit = this._exitSpot ? Math.hypot(x - this._exitSpot.x, z - this._exitSpot.z) < EXIT_RADIUS : false;
    if (atExit !== this._nearExit) this._nearExit = atExit;
  }

  _dispose(obj) {
    obj.traverse?.((o) => {
      o.geometry?.dispose?.();
      if (Array.isArray(o.material)) o.material.forEach((m) => { m.map?.dispose?.(); m.dispose?.(); });
      else { o.material?.map?.dispose?.(); o.material?.dispose?.(); }
    });
  }

  _teardown() {
    cancelAnimationFrame(this._raf);
    this._ro?.disconnect();
    globalThis.removeEventListener('pointermove', this._onMove);
    globalThis.removeEventListener('pointerup', this._onUp);
    if (this._t) {
      this._t.renderer.domElement.removeEventListener('pointerdown', this._onDown);
      for (const r of this._reefs) this._dispose(r.group);
      if (this._exitGroup) this._dispose(this._exitGroup);
      this._t.renderer.dispose?.();
      this._t.renderer.domElement.remove();
    }
    this._t = null; this._reefs = []; this._exitParts = [];
  }

  render() {
    const { lit, total } = seabedProgress(this.map, this.journey);
    const nearName = this._near ? (this._city(this._near)?.name ?? '') : '';
    return html`
      <header class="deep">
        <div class="titles">
          <h3>${this.map?.name ?? 'El lecho que sostiene'}</h3>
          <p>Bucea por el lecho: entra a las casas-coral por su puerta para descubrir qué te espera dentro.</p>
          ${total > 0 ? html`<p class="count"><span class="lit-dot" aria-hidden="true"></span> ${lit}/${total} arrecifes encendidos</p>` : nothing}
        </div>
        <button type="button" class="surface" @click=${this._surface}>🌊 Volver a la superficie</button>
      </header>
      <div class="stage"></div>
      ${this._error
        ? html`<div class="error"><p>${this._error}</p><button type="button" class="surface" @click=${this._surface}>Volver a la superficie</button></div>`
        : html`
            ${this._near ? html`<div class="prompt"><kbd>E</kbd> Entrar en ${nearName}</div>` : nothing}
            ${!this._near && this._nearExit ? html`<div class="prompt"><kbd>E</kbd> Subir a la superficie</div>` : nothing}
            <p class="hint">WASD / flechas para bucear · arrastra el ratón para mirar · <kbd>E</kbd> para entrar</p>`}
      ${this._renderSheet()}
    `;
  }

  _renderSheet() {
    const city = this._selected ? this._city(this._selected) : null;
    if (!city) return html``;
    const { statusById } = seabedProgress(this.map, this.journey);
    const status = statusById.get(city.id) ?? 'available';
    const visited = status === 'visited';
    const blocked = status === 'blocked';
    let certifyLabel = '✦ Encender el arrecife';
    if (visited) certifyLabel = 'Apagar el arrecife (retirar)';
    else if (blocked) certifyLabel = 'Alcanza antes los arrecifes previos';
    return html`
      <div class="sheet-backdrop" @click=${() => { this._selected = null; }}></div>
      <div class="sheet" role="dialog" aria-label="${city.name}">
        <button type="button" class="close" aria-label="Cerrar" @click=${() => { this._selected = null; }}>×</button>
        <span class="kind">${KIND_LABEL[city.kind] ?? 'Competencia'} · <span class="st ${status}">${STATUS_LABEL[status] ?? ''}</span></span>
        <h4>${city.name}</h4>
        ${city.summary ? html`<p class="summary">${city.summary}</p>` : nothing}
        ${city.keyPoints?.length ? html`<h5>Claves</h5><ul>${city.keyPoints.map((p) => html`<li>${p}</li>`)}</ul>` : nothing}
        ${city.aiFocus ? html`<h5>En la era de la IA</h5><p class="aifocus">${city.aiFocus}</p>` : nothing}
        ${city.resources?.length ? html`<h5>Recursos</h5><div class="res">${city.resources.map((r) => this._resource(r))}</div>` : nothing}
        ${this.canPlay
          ? html`<div class="act"><button type="button" class="certify ${visited ? 'on' : ''}" ?disabled=${(blocked && !visited) || this._pending} @click=${() => this._toggle(city.id)}>${certifyLabel}</button></div>`
          : nothing}
      </div>
    `;
  }

  async _toggle(cityId) {
    if (this._pending || typeof this.onToggle !== 'function') return;
    this._pending = true;
    try { await this.onToggle(cityId); } finally { this._pending = false; }
  }

  _resource(r) {
    const inner = html`<span class="rk">${r.kind}</span>${r.label}`;
    return r.url ? html`<a href=${r.url} target="_blank" rel="noopener noreferrer">${inner}</a>` : html`<span>${inner}</span>`;
  }
}

customElements.define('seabed-view', SeabedView);
