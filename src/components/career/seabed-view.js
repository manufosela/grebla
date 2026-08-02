/**
 * <seabed-view> — la vista SUBMARINA del lecho (RMR-PCS-0028 · rework B).
 *
 * El lecho es el fondo transversal que sostiene el archipiélago. MOTOR PROPIO
 * (no reutiliza el 3D de la isla): una escena Three.js submarina por la que se
 * NAVEGA (orbitar/zoom) hacia las CASAS-CORAL — un coral por arrecife, con su
 * NÚMERO de orden y color por estado (encendido/latente/apagado). Al activar un
 * coral se abre su detalle (resumen, claves, lente era-IA, recursos y certificar).
 *
 * Look COMPROMETIDO de un solo tema (submarino). Mismos props/eventos que la
 * versión anterior (map/journey/canPlay/onToggle · `surface`), así que
 * <career-app> no cambia. Si WebGL no está disponible, cae a un aviso legible.
 */
import { LitElement, html, css, nothing } from 'lit';
import { seabedScene, seabedProgress, arrecifeOrder } from '../../tools/career/domain/seabed.js';

const STATUS_LABEL = { visited: 'encendido', available: 'disponible', blocked: 'bloqueado' };
const KIND_LABEL = { milestone: 'Hito', tech: 'Tecnología', skill: 'Competencia' };
/** Color del coral por estado (encendido verde, disponible cian, bloqueado apagado). */
const STATUS_COLOR = { visited: 0x8bf0be, available: 0x4dd0e1, blocked: 0x4a6675 };
const MILESTONE_COLOR = 0xffcf6b;
/** Mapa 0..100 → mundo (la escena abarca ~±65). */
const WORLD_SCALE = 1.3;

export class SeabedView extends LitElement {
  static properties = {
    map: { attribute: false },
    journey: { attribute: false },
    canPlay: { attribute: false },
    onToggle: { attribute: false },
    _selected: { state: true },
    _pending: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host {
      display: block; position: relative; color: #e8f4f8;
      background: radial-gradient(120% 80% at 50% -10%, #123c56 0%, #0a2536 35%, #061826 65%, #030d16 100%);
      overflow: hidden; min-height: 30rem; border-radius: 14px;
    }
    header.deep {
      position: absolute; top: 0; left: 0; right: 0; z-index: 3;
      display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
      padding: 1.1rem 1.3rem 0.4rem; pointer-events: none;
    }
    header.deep .titles { pointer-events: none; }
    .titles h3 { margin: 0; font-size: 1.25rem; letter-spacing: 0.01em; text-shadow: 0 0 14px rgba(77, 208, 225, 0.55), 0 2px 8px #000; }
    .titles p { margin: 0.2rem 0 0; font-size: 0.85rem; color: #bfe0ee; max-width: 42ch; text-shadow: 0 1px 6px #000; }
    .count { margin: 0.4rem 0 0; font-size: 0.8rem; color: #9beccb; display: inline-flex; align-items: center; gap: 0.4rem; text-shadow: 0 1px 6px #000; }
    .lit-dot { width: 0.6rem; height: 0.6rem; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fffef0, #a9f5cf 45%, #2aa578); box-shadow: 0 0 8px rgba(126, 255, 196, 0.7); }
    .surface {
      flex: none; pointer-events: auto; border: 1.5px solid rgba(120, 210, 255, 0.6); background: rgba(6, 26, 38, 0.75);
      color: #cdeefb; border-radius: 999px; padding: 0.45rem 0.95rem; font: inherit; font-size: 0.85rem;
      font-weight: 600; cursor: pointer; backdrop-filter: blur(2px);
    }
    .surface:hover, .surface:focus-visible { border-color: #7fdfff; color: #fff; outline: none; box-shadow: 0 0 0 3px rgba(77, 208, 225, 0.3); }
    .stage { position: absolute; inset: 0; z-index: 1; }
    .stage canvas { display: block; width: 100% !important; height: 100% !important; cursor: grab; }
    .stage canvas:active { cursor: grabbing; }
    .hint { position: absolute; left: 50%; bottom: 0.7rem; transform: translateX(-50%); z-index: 2; font-size: 0.76rem; color: #8fb8c8; text-shadow: 0 1px 6px #000; pointer-events: none; }
    .empty, .error { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 2; padding: 2rem; text-align: center; color: #9fc6d6; }
    /* Panel de detalle del arrecife (hoja que sube desde el fondo). */
    .sheet-backdrop { position: absolute; inset: 0; z-index: 4; background: rgba(2, 10, 18, 0.55); backdrop-filter: blur(2px); }
    .sheet {
      position: absolute; z-index: 5; left: 50%; bottom: 0; transform: translateX(-50%);
      width: min(92%, 40rem); max-height: 88%; overflow-y: auto;
      background: linear-gradient(180deg, #0c2c40, #071a28); color: #e8f4f8;
      border: 1px solid rgba(120, 210, 255, 0.35); border-bottom: 0;
      border-radius: 16px 16px 0 0; box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5);
      padding: 1.1rem 1.3rem 1.5rem; animation: surface-up 0.28s ease-out;
    }
    @keyframes surface-up { from { transform: translate(-50%, 30%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
    .sheet .close { float: right; border: 0; background: none; color: #9fc6d6; font-size: 1.4rem; line-height: 1; cursor: pointer; }
    .sheet .close:hover, .sheet .close:focus-visible { color: #fff; outline: none; }
    .sheet .kind { display: inline-block; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; color: #7fdfff; margin-bottom: 0.2rem; }
    .sheet .st { text-transform: none; letter-spacing: 0; color: #8fd3e6; }
    .sheet .st.visited { color: #8fe0b8; } .sheet .st.blocked { color: #9fb4c0; }
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
    /** @type {import('../../tools/career/domain/types.js').CareerMap|null} */
    this.map = null;
    /** @type {import('../../tools/career/domain/types.js').Journey|null} */
    this.journey = null;
    this.canPlay = false;
    /** @type {((cityId: string) => Promise<unknown>)|null} */
    this.onToggle = null;
    /** @type {string|null} */
    this._selected = null;
    this._pending = false;
    this._error = '';
    /** @type {any} recursos Three.js (null hasta montar). */
    this._t = null;
    this._raf = 0;
    this._reefGroups = []; // grupos de coral, para raycast y limpieza
  }

  connectedCallback() {
    super.connectedCallback();
    this._onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (this._selected) this._selected = null;
      else this._surface();
    };
    globalThis.addEventListener('keydown', this._onKey);
  }

  disconnectedCallback() {
    globalThis.removeEventListener('keydown', this._onKey);
    this._teardown();
    super.disconnectedCallback();
  }

  firstUpdated() {
    this._init();
  }

  updated(changed) {
    if (this._t && (changed.has('map') || changed.has('journey'))) this._buildReefs();
  }

  _surface() {
    this.dispatchEvent(new CustomEvent('surface', { bubbles: true, composed: true }));
  }

  _city(id) {
    return (this.map?.cities ?? []).find((c) => c.id === id) ?? null;
  }

  // ─── Escena 3D ───────────────────────────────────────────────────────────
  async _init() {
    const host = this.renderRoot.querySelector('.stage');
    if (!host) return;
    try {
      const [THREE, { OrbitControls }] = await Promise.all([
        import('three'),
        import('three/addons/controls/OrbitControls.js'),
      ]);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
      const w = host.clientWidth || 800;
      const h = host.clientHeight || 600;
      renderer.setSize(w, h, false);
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x04141f);
      scene.fog = new THREE.FogExp2(0x061c2a, 0.011);

      const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 1000);
      camera.position.set(0, 52, 78);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 4, 0);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 22;
      controls.maxDistance = 170;
      controls.maxPolarAngle = 1.45; // no bajar del lecho
      controls.enablePan = false;

      scene.add(new THREE.HemisphereLight(0x9fe6ff, 0x03202e, 0.55));
      const key = new THREE.DirectionalLight(0xbfeeff, 0.8);
      key.position.set(20, 60, 30);
      scene.add(key);

      // Lecho (suelo) y luz de superficie difusa.
      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(140, 48),
        new THREE.MeshStandardMaterial({ color: 0x06202e, roughness: 1, metalness: 0 }),
      );
      floor.rotation.x = -Math.PI / 2;
      scene.add(floor);

      this._t = { THREE, renderer, scene, camera, controls, host, raycaster: new THREE.Raycaster(), pointer: new THREE.Vector2() };
      renderer.domElement.addEventListener('pointerdown', this._onPointerDown);
      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(host);
      this._buildReefs();
      this._loop();
    } catch (err) {
      this._error = 'No se pudo cargar la vista 3D del lecho (WebGL no disponible).';
    }
  }

  /** Posición de mundo de un arrecife desde su x/y (0..100). */
  _world(n) {
    return [(n.x - 50) * WORLD_SCALE, (n.y - 50) * WORLD_SCALE];
  }

  _buildReefs() {
    if (!this._t) return;
    const { scene } = this._t;
    for (const g of this._reefGroups) { scene.remove(g); this._dispose(g); }
    this._reefGroups = [];
    const { nodes } = seabedScene(this.map);
    const { statusById } = seabedProgress(this.map, this.journey);
    const order = arrecifeOrder(this.map);
    for (const n of nodes) {
      const status = statusById.get(n.id) ?? 'available';
      const milestone = n.kind === 'milestone';
      const color = milestone ? MILESTONE_COLOR : (STATUS_COLOR[status] ?? STATUS_COLOR.available);
      const height = 4 + (n.weight ?? 2) * 1.6 + (milestone ? 2 : 0);
      const g = this._coral(color, height, milestone, status);
      const [wx, wz] = this._world(n);
      g.position.set(wx, 0, wz);
      g.userData.cityId = n.id;
      g.add(this._numberSprite(order.get(n.id) ?? 1, color, height));
      scene.add(g);
      this._reefGroups.push(g);
    }
  }

  _coral(color, height, milestone, status) {
    const { THREE } = this._t;
    const g = new THREE.Group();
    const emissiveIntensity = status === 'blocked' ? 0.15 : 0.7;
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity, roughness: 0.55, metalness: 0.1 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.2, height, 8), mat);
    trunk.position.y = height / 2;
    g.add(trunk);
    const branches = milestone ? 5 : 3;
    for (let i = 0; i < branches; i += 1) {
      const a = (i / branches) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.55, height * 0.7, 6), mat);
      b.position.set(Math.cos(a) * 1.2, height * 0.72, Math.sin(a) * 1.2);
      b.rotation.z = -Math.cos(a) * 0.5;
      b.rotation.x = Math.sin(a) * 0.5;
      g.add(b);
    }
    if (status !== 'blocked') {
      const light = new THREE.PointLight(color, milestone ? 1.6 : 1.1, 20, 2);
      light.position.y = height * 0.7;
      g.add(light);
    }
    return g;
  }

  _numberSprite(num, color, height) {
    const { THREE } = this._t;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.beginPath();
    ctx.arc(64, 64, 52, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(4,18,28,0.9)';
    ctx.fill();
    ctx.lineWidth = 7;
    ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.stroke();
    ctx.fillStyle = '#eaf7fc';
    ctx.font = 'bold 68px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(num), 64, 70);
    const tex = new THREE.CanvasTexture(c);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    spr.scale.set(5, 5, 1);
    spr.position.y = height + 3;
    return spr;
  }

  _onPointerDown = (e) => {
    // Solo un clic limpio selecciona; un arrastre orbita (lo gestiona OrbitControls).
    const startX = e.clientX;
    const startY = e.clientY;
    const up = (ev) => {
      globalThis.removeEventListener('pointerup', up);
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 6) return; // arrastre
      this._pick(ev);
    };
    globalThis.addEventListener('pointerup', up);
  };

  _pick(e) {
    if (!this._t) return;
    const { renderer, raycaster, pointer, camera } = this._t;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(this._reefGroups, true);
    if (hits.length === 0) return;
    let o = hits[0].object;
    while (o && o.userData.cityId === undefined) o = o.parent;
    if (o?.userData.cityId) this._selected = o.userData.cityId;
  }

  _resize() {
    if (!this._t) return;
    const { renderer, camera, host } = this._t;
    const w = host.clientWidth || 800;
    const h = host.clientHeight || 600;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  _loop = () => {
    if (!this._t) return;
    this._raf = requestAnimationFrame(this._loop);
    this._t.controls.update();
    this._t.renderer.render(this._t.scene, this._t.camera);
  };

  _dispose(obj) {
    obj.traverse?.((o) => {
      o.geometry?.dispose?.();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
      else o.material?.dispose?.();
      o.material?.map?.dispose?.();
    });
  }

  _teardown() {
    cancelAnimationFrame(this._raf);
    this._ro?.disconnect();
    if (this._t) {
      this._t.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown);
      for (const g of this._reefGroups) this._dispose(g);
      this._t.controls.dispose?.();
      this._t.renderer.dispose?.();
      this._t.renderer.domElement.remove();
    }
    this._t = null;
    this._reefGroups = [];
  }

  // ─── Overlay HTML ────────────────────────────────────────────────────────
  render() {
    const { lit, total } = seabedProgress(this.map, this.journey);
    return html`
      <header class="deep">
        <div class="titles">
          <h3>${this.map?.name ?? 'El lecho que sostiene'}</h3>
          <p>El fondo que sostiene el archipiélago: los arrecifes del juicio y la orquestación. Orbita y acércate a un coral para explorarlo.</p>
          ${total > 0 ? html`<p class="count"><span class="lit-dot" aria-hidden="true"></span> ${lit}/${total} arrecifes encendidos</p>` : nothing}
        </div>
        <button type="button" class="surface" @click=${this._surface}>🌊 Volver a la superficie</button>
      </header>
      <div class="stage"></div>
      ${this._error
        ? html`<p class="error">${this._error} <button type="button" class="surface" @click=${this._surface}>Volver a la superficie</button></p>`
        : html`<p class="hint">Arrastra para orbitar · rueda para acercarte · clic en un coral para abrirlo</p>`}
      ${this._renderSheet()}
    `;
  }

  _renderSheet() {
    const city = this._selected ? this._city(this._selected) : null;
    if (!city) return html``; // sin selección: template vacío (tipo de retorno consistente)
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
          ? html`<div class="act">
              <button type="button" class="certify ${visited ? 'on' : ''}" ?disabled=${(blocked && !visited) || this._pending} @click=${() => this._toggle(city.id)}>${certifyLabel}</button>
            </div>`
          : nothing}
      </div>
    `;
  }

  async _toggle(cityId) {
    if (this._pending || typeof this.onToggle !== 'function') return;
    this._pending = true;
    try {
      await this.onToggle(cityId);
    } finally {
      this._pending = false;
    }
  }

  _resource(r) {
    const inner = html`<span class="rk">${r.kind}</span>${r.label}`;
    return r.url
      ? html`<a href=${r.url} target="_blank" rel="noopener noreferrer">${inner}</a>`
      : html`<span>${inner}</span>`;
  }
}

customElements.define('seabed-view', SeabedView);
