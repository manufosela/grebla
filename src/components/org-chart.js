/**
 * <org-chart> — vista de SOLO LECTURA del organigrama en PIRÁMIDE INVERTIDA
 * (liderazgo afectivo, RMR-PRP-0002). Consultable por cualquier empleado: lee
 * /orgRoles y /orgBranches y dibuja los roles como pirámide invertida (el rol
 * «sin inferior» —al que nadie sostiene porque sostiene a todos— en la punta de
 * abajo; hacia arriba, ensanchando, los sostenidos). No edita nada.
 */
import { LitElement, html, svg, css } from 'lit';
import { onUserChanged } from '../lib/auth.js';
import { watchOrgRoles } from '../lib/orgRoles.js';
import { watchOrgBranches } from '../lib/orgBranches.js';
import { getUsersCrownLabel } from '../lib/orgConfig.js';
import { areaOf, branchColor, isAreaHeadIn, rolesOfArea } from '../tools/team/domain/orgRoles.js';
import { treeLayout, linkPath } from '../tools/team/domain/orgTreeLayout.js';

export class OrgChart extends LitElement {
  static properties = {
    _roles: { state: true },
    _branches: { state: true },
    _crown: { state: true },
    _error: { state: true },
    _ready: { state: true },
    _mode: { state: true },
    _area: { state: true },
    _zoom: { state: true },
    _pan: { state: true },
    _folded: { state: true },
  };

  static styles = css`
    :host { display: block; color: var(--rm-text, #111827); }
    .lead { color: var(--rm-muted, #6b7280); font-size: 0.95rem; margin: 0 0 1.25rem; }
    .empty, .error { color: var(--rm-muted, #9ca3af); }
    .error { color: var(--rm-danger, #dc2626); }
    .pyramid {
      display: flex; flex-direction: column; align-items: center; gap: 1.3rem; padding: 1rem 0 0.5rem;
      --rm-branch-engineering: #2a9d8f; --rm-branch-product: #e76f51; --rm-branch-people: #9d4edd;
      --rm-branch-data: #457b9d; --rm-branch-generico: #6b7280;
    }
    .pyr-level { display: flex; flex-wrap: wrap; gap: 1rem 1.5rem; justify-content: center; align-items: center; position: relative; max-width: 100%; box-sizing: border-box; }
    /* Apilado intra-capa (RMR-TSK-0434): la banda es columna de subfilas; quien
       depende de alguien de su misma capa se pinta encima, con su flechita. */
    .pyr-level.stacked { flex-direction: column; gap: 0.35rem; }
    .pyr-subrow { display: flex; flex-wrap: wrap; gap: 0.6rem 1.2rem; justify-content: center; align-items: center; max-width: 100%; }
    .pyr-suparrow { color: var(--rm-muted, #9ca3af); font-size: 0.85rem; font-weight: 700; line-height: 1; cursor: help; }
    .pyramid:not(.mini) .pyr-level { padding: 1.5rem 1rem 0.9rem; border: 1.5px solid color-mix(in srgb, var(--lv, #6b7280) 55%, transparent); background: color-mix(in srgb, var(--lv, #6b7280) 9%, transparent); border-radius: 14px; }
    .pyr-level.base-level { border-width: 3px; background: color-mix(in srgb, var(--lv, #2a9d8f) 15%, transparent); }
    .pyr-group { display: inline-flex; flex-wrap: wrap; gap: 0.5rem; padding: 0.4rem 0.55rem; border-radius: 12px; border: 1.5px solid color-mix(in srgb, var(--g, var(--rm-accent, #2a9d8f)) 45%, transparent); background: color-mix(in srgb, var(--g, var(--rm-accent, #2a9d8f)) 7%, transparent); }
    .pyr-level:not(:last-child)::after { content: '↑'; position: absolute; bottom: -1.05rem; left: 50%; transform: translateX(-50%); color: var(--rm-muted, #9ca3af); font-size: 1rem; font-weight: 700; }
    .pyr-role { display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.3rem 0.45rem; border: 2px solid; border-radius: 10px; padding: 0.45rem 0.75rem; font-size: 0.85rem; font-weight: 700; background: var(--rm-surface, #fff); max-width: 100%; }
    .pyr-dot { width: 0.6rem; height: 0.6rem; border-radius: 50%; flex: none; }
    .pyr-branch { font-style: normal; font-size: 0.68rem; color: var(--rm-muted, #9ca3af); text-transform: uppercase; letter-spacing: 0.03em; }
    /* Cabeza de otra área que cuelga de esta (RMR-TSK-0438): borde discontinuo
       y etiqueta con el color de SU área — es un dato del árbol, no una
       inferencia: «este rol es la cabeza de X y reporta aquí». */
    .pyr-role.frontier { border-style: dashed; }
    .pyr-head { font-style: normal; font-size: 0.66rem; font-weight: 700; color: var(--h, var(--rm-accent, #2a9d8f)); border: 1px solid var(--h, var(--rm-accent, #2a9d8f)); border-radius: 8px; padding: 0.05rem 0.45rem; }
    /* Etiqueta de capa: solo la pirámide GLOBAL la renderiza; en mini (por ramas),
       si apareciera, fluye en normal-flow (sin solaparse con las fichas). */
    .pyr-lvl { flex: 100%; text-align: center; font-size: 0.66rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--lv, #9ca3af); }
    .pyramid:not(.mini) .pyr-lvl { position: absolute; top: 0.35rem; left: 0.85rem; flex: none; text-align: left; }
    /* Nivel SIMBÓLICO en la cima: los usuarios del producto (no son fichas). */
    .pyr-crown {
      width: 100%; max-width: 100%; box-sizing: border-box; text-align: center; padding: 0.7rem 1rem; border-radius: 12px;
      border: 2px dashed var(--rm-accent, #2a9d8f); background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 10%, transparent);
      font-weight: 800; font-size: 1rem; color: var(--rm-text, #111827);
      display: flex; flex-direction: column; gap: 0.15rem;
    }
    .pyr-crown em { font-style: normal; font-weight: 500; font-size: 0.75rem; color: var(--rm-muted, #6b7280); }
    /* Árbol invertido (RMR-TSK-0440): lienzo con scroll propio; el SVG pinta las
       aristas y las tarjetas van encima en posición absoluta. */
    /* Visor del árbol: zoom con rueda y arrastre con el ratón, sin scrollbars. */
    .tree-view { display: flex; flex-direction: column; gap: 0.4rem; }
    .tree-tools { display: flex; align-items: center; gap: 0.35rem; }
    .tree-tools button { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); border-radius: 8px; width: 2rem; height: 2rem; font: inherit; font-weight: 700; cursor: pointer; }
    .tree-tools button.fit { width: auto; padding: 0 0.7rem; font-size: 0.82rem; }
    .tree-tools button:hover { border-color: var(--rm-accent, #2a9d8f); color: var(--rm-accent, #2a9d8f); }
    .tree-tools .hint { color: var(--rm-muted, #9ca3af); font-size: 0.75rem; margin-left: 0.35rem; }
    .tree-port { position: relative; overflow: hidden; height: min(68vh, 620px); border: 1px solid var(--rm-border, #e5e7eb); border-radius: 12px; background: color-mix(in srgb, var(--rm-text, #111827) 3%, transparent); cursor: grab; touch-action: none; }
    .tree-port.grabbing { cursor: grabbing; }
    .tree-canvas { position: absolute; top: 0; left: 0; transform-origin: 0 0; }
    .tree-links { position: absolute; inset: 0; overflow: visible; }
    .tree-links path { fill: none; stroke-width: 1.6; opacity: 0.75; }
    .tree-node { position: absolute; display: flex; justify-content: center; align-items: center; }
    /* Tarjeta de altura UNIFORME dentro del árbol: el texto se recorta antes que
       romper la rejilla (el layout coloca por posiciones fijas). */
    .tree-node .pyr-role { width: 100%; height: 100%; box-sizing: border-box; overflow: hidden; align-content: center; }
    .tree-node .pyr-role { flex-wrap: nowrap; flex-direction: column; gap: 0.15rem; padding: 0.4rem 0.6rem; }
    /* Dentro del árbol la tarjeta mide lo mismo para todos: nombre y rama en una
       línea cada uno, recortados con elipsis si no caben (RMR-BUG-0093). */
    .tree-node .pyr-name, .tree-node .pyr-branch { display: block; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; }
    .tree-node .pyr-dot { position: absolute; top: 0.5rem; left: 0.5rem; }
    .tree-node .pyr-role { position: relative; }
    .tree-node .pyr-head { display: none; }
    /* Botón de plegar/desplegar la rama: cuelga del borde inferior de la tarjeta
       (por donde salen sus hijos, que en invertido están ARRIBA… así que va
       arriba: el subárbol sube). */
    .tree-node .fold {
      position: absolute; top: -0.6rem; right: -0.5rem; z-index: 2;
      min-width: 1.35rem; height: 1.35rem; padding: 0 0.3rem; border-radius: 999px;
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff);
      color: var(--rm-muted, #6b7280); font: inherit; font-size: 0.68rem; font-weight: 800;
      line-height: 1; cursor: pointer;
    }
    .tree-node .fold:hover { border-color: var(--rm-accent, #2a9d8f); color: var(--rm-accent, #2a9d8f); }
    .tree-node .fold.on { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    .tree-node.frontier-node .pyr-role { border-style: dashed; }
    /* Toggle Global / Por ramas (mismo lenguaje de pestaña subrayada). */
    .modes { display: flex; gap: 0.1rem; border-bottom: 2px solid var(--rm-border, #e5e7eb); margin-bottom: 0.5rem; }
    .mode { border: 0; background: none; color: var(--rm-muted, #6b7280); padding: 0.5rem 0.9rem; font: inherit; font-size: 0.88rem; font-weight: 600; cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -2px; }
    .mode.on { color: var(--rm-accent, #2a9d8f); border-bottom-color: var(--rm-accent, #2a9d8f); }
    .mode:hover:not(.on) { color: var(--rm-text, #111827); }
    /* Mini-pirámides por rama, en rejilla. */
    /* Sub-pestañas por ÁREA (RMR-TSK-0437): mismo lenguaje de pestaña subrayada,
       un escalón más fino; cada área lleva su punto de color. */
    .areas { display: flex; gap: 0.1rem; flex-wrap: wrap; border-bottom: 1px solid var(--rm-border, #e5e7eb); margin: 0.25rem 0 0.75rem; }
    .area { display: inline-flex; align-items: center; gap: 0.4rem; border: 0; background: none; color: var(--rm-muted, #6b7280); padding: 0.45rem 0.8rem; font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -1px; }
    .area.on { color: var(--rm-text, #111827); border-bottom-color: var(--a, var(--rm-accent, #2a9d8f)); }
    .area:hover:not(.on) { color: var(--rm-text, #111827); }
    .area:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; border-radius: 6px; }
    .branch-col { display: flex; flex-direction: column; align-items: center; gap: 0.6rem; }
    .pyramid.area-pyr .pyr-level { width: min(100%, 60rem); }
    .pyramid.mini { gap: 1.1rem; padding: 0.25rem 0; }
    .pyramid.mini .pyr-level { gap: 0.4rem; }
  `;

  constructor() {
    super();
    this._roles = [];
    this._branches = [];
    this._crown = '';
    this._error = '';
    this._ready = false;
    /** @type {'global'|'ramas'} vista global (toda la organización) o una mini-pirámide por rama. */
    this._mode = 'global';
    /** @type {string|null} área elegida en «Por ramas» (null = la primera). */
    this._area = null;
    /** Área que se está pintando (para marcar las cabezas frontera). */
    this._areaShown = null;
    /** Zoom y desplazamiento del lienzo del árbol (RMR-BUG-0093). */
    this._zoom = 1;
    this._pan = { x: 0, y: 0 };
    this._drag = null;
    /** Ramas plegadas por el usuario (ids de rol). */
    this._folded = new Set();
    this._loadedForUser = null;
  }

  connectedCallback() {
    super.connectedCallback();
    // Espera a la sesión: las reglas exigen estar autenticado para leer el catálogo.
    this._off = onUserChanged((user) => {
      this._stopWatching();
      if (!user) { this._ready = true; this._error = 'Inicia sesión para consultar el organigrama.'; return; }
      this._loadedForUser = user.uid;
      this._load();
    });
  }

  /** Libera las suscripciones en vivo (RMR-TSK-0435). */
  _stopWatching() {
    this._unsubRoles?.();
    this._unsubBranches?.();
    this._unsubRoles = null;
    this._unsubBranches = null;
  }

  disconnectedCallback() {
    this._stopWatching();
    this._off?.();
    super.disconnectedCallback();
  }

  /**
   * Carga EN VIVO (RMR-TSK-0435): roles y ramas por onSnapshot — cualquier
   * cambio del panel (capa, depende-de, renombrar) repinta esta vista al
   * instante, sin recargar; era lectura única y las pestañas abiertas se
   * quedaban con la foto vieja. La corona (config) apenas cambia: lectura única.
   */
  async _load() {
    this._error = '';
    this._unsubRoles = watchOrgRoles(
      (roles) => { this._roles = roles; this._ready = true; },
      () => { this._error = 'No se pudo cargar el organigrama.'; this._ready = true; },
    );
    this._unsubBranches = watchOrgBranches(
      (branches) => { this._branches = branches; },
      () => { /* sin ramas se pintan los ids; el error de roles ya avisa */ },
    );
    // Sin corona configurada (o lectura fallida) la cima simplemente no se pinta.
    this._crown = await getUsersCrownLabel().catch(() => '');
  }

  _branchLabel(id) {
    return this._branches.find((b) => b.id === id)?.label ?? id;
  }

  _branchColor(b) { return branchColor(b); }

  /** Filas de la pirámide por CAPA CANÓNICA (RMR-TSK-0434), de las hojas
   *  (arriba) a la base (abajo): la capa declarada del rol manda y, sin declarar,
   *  cae a la profundidad de su cadena. Así una rama joven (Head con ICs
   *  directos) mantiene a sus ingenieros en la capa de ICs. Capas vacías no
   *  generan fila. */
  _levelsOf(roles) {
    return pyramidLayers(roles).toReversed();
  }

  _role(r, color) {
    // La tarjeta dice SOLO lo que dicen los datos: rol, rama y «↑ superior»
    // (la dependencia se lee en la propia tarjeta). El antiguo badge derivado
    // «ejerce también de X» se retiró (RMR-BUG-0092): era una heurística
    // inventada que afirmaba cosas falsas en catálogos reales.
    const boss = r.reportsToRoleId ? this._roles.find((x) => x.id === r.reportsToRoleId)?.label : null;
    // Cabeza FRONTERA (RMR-TSK-0438): en la pestaña de su superior se marca con
    // borde discontinuo y la etiqueta de su área — se ve que pertenece a otra
    // área y que cuelga de aquí. En su propia pestaña es una tarjeta normal.
    const frontier = this._mode === 'ramas' && this._areaShown
      && isAreaHeadIn(this._visibleRoles, r, this._areaShown);
    const area = frontier ? areaOf(this._visibleRoles, r) : null;
    return html`<span class="pyr-role ${frontier ? 'frontier' : ''}" style="border-color:${color}">
      <span class="pyr-dot" style="background:${color}"></span><span class="pyr-name">${r.label}</span>
      <em class="pyr-branch">${this._branchLabel(r.branch)}${boss ? html` · ↑ ${boss}` : ''}</em>
      ${frontier ? html`<em class="pyr-head" style="--h:${this._branchColor(area)}">cabeza de ${this._branchLabel(area)}</em>` : null}
    </span>`;
  }

  /** Roles VISIBLES del organigrama: «Genérico» es el cajón de lo no identificado,
   *  no un estrato de la organización — fuera de las vistas (RMR-BUG-0073). */
  get _visibleRoles() {
    return this._roles.filter((r) => r.branch !== 'generico');
  }

  render() {
    if (!this._ready) return html`<p class="lead">Cargando organigrama…</p>`;
    if (this._error) return html`<p class="error">${this._error}</p>`;
    if (this._visibleRoles.length === 0) return html`<p class="empty">El organigrama aún no está configurado.</p>`;
    return html`
      <p class="lead">Pirámide invertida: quien tiene <strong>más responsabilidad</strong> (a quien nadie sostiene) está <strong>abajo</strong>, sosteniendo a todos. Las flechas suben: cada nivel sostiene al de encima.</p>
      <div class="modes">
        <button type="button" class="mode ${this._mode === 'global' ? 'on' : ''}" @click=${() => { this._mode = 'global'; }}>Toda la organización</button>
        <button type="button" class="mode ${this._mode === 'ramas' ? 'on' : ''}" @click=${() => { this._mode = 'ramas'; }}>Por ramas</button>
      </div>
      ${this._mode === 'ramas' ? this._renderByBranch() : this._renderGlobal()}`;
  }

  _renderGlobal() {
    return html`
      ${this._crown ? html`<div class="pyr-crown">👥 ${this._crown}<em>a quienes todo el equipo sostiene</em></div>` : null}
      ${this._renderTree(this._visibleRoles)}`;
  }

  /**
   * ÁRBOL INVERTIDO (RMR-TSK-0440): la base abajo, los sostenidos arriba, cada
   * rol unido a su superior por una línea real. Las posiciones las calcula el
   * dominio (d3-hierarchy para el eje X, capa canónica para el Y); aquí solo se
   * pinta: un SVG de fondo con las aristas y las tarjetas HTML encima, en
   * posición absoluta — así se reutiliza el estilo de las tarjetas (color de
   * rama, «↑ superior», cabeza frontera) sin pelearse con el texto en SVG.
   * @param {import('../tools/team/domain/orgRoles.js').OrgRole[]} roles
   */
  _renderTree(roles) {
    const NODE_W = 200;
    // Altura UNIFORME de tarjeta: el layout coloca por rejilla, así que las
    // tarjetas deben medir lo mismo pase lo que pase con su texto (una cabeza
    // frontera lleva chip y crecía, y acababa solapando — RMR-BUG-0093).
    // Métrica de la rejilla: el salto entre bandas (rowHeight) y el de subfila
    // intra-capa (subRowHeight) han de ser MAYORES que la tarjeta, o el rol
    // desplazado invade la banda de al lado (solape visto en RMR-BUG-0093).
    const NODE_H = 58;
    const layout = treeLayout(roles, { nodeWidth: NODE_W, gapX: 24, rowHeight: 136, subRowHeight: 68, collapsed: this._folded });
    if (layout.nodes.length === 0) return html`<p class="empty">No hay roles.</p>`;
    const w = layout.width;
    const h = layout.height + NODE_H;
    const cx = (n) => n.x + NODE_W / 2;
    const byId = new Map(layout.nodes.map((n) => [n.role.id, n]));
    return html`
      <div class="tree-view">
        <div class="tree-tools">
          <button type="button" title="Alejar" @click=${() => this._zoomBy(1 / 1.2)}>−</button>
          <button type="button" title="Acercar" @click=${() => this._zoomBy(1.2)}>+</button>
          <button type="button" class="fit" title="Ver todo" @click=${() => this._zoomFit()}>Ver todo</button>
          <span class="hint">arrastra para mover · rueda para zoom</span>
        </div>
        <div class="tree-port"
          @wheel=${this._onWheel} @pointerdown=${this._onPanStart}
          @pointermove=${this._onPanMove} @pointerup=${this._onPanEnd} @pointercancel=${this._onPanEnd}>
          <div class="tree-canvas" style="width:${w}px;height:${h}px;transform:translate(${this._pan.x}px,${this._pan.y}px) scale(${this._zoom})">
            <svg class="tree-links" viewBox="0 0 ${w} ${h}" width=${w} height=${h} aria-hidden="true">
              ${layout.links.map((l) => {
                const from = byId.get(l.from);
                const to = byId.get(l.to);
                // Enrutado en «peine» (ver `linkPath`): el hijo baja por su
                // columna y gira pegado a su base, donde convergen todos sus
                // hijos. Así se lee de un vistazo quién depende de quién.
                return svg`<path style="stroke:${this._branchColor(to.role.branch)}"
                  d=${linkPath(from, to, { nodeWidth: NODE_W, nodeHeight: NODE_H })}></path>`;
              })}
            </svg>
            ${layout.nodes.map((n) => html`
              <div class="tree-node" style="left:${n.x}px;top:${n.y}px;width:${NODE_W}px;height:${NODE_H}px">
                ${this._role(n.role, this._branchColor(n.role.branch))}
                ${n.childCount > 0 ? this._foldButton(n) : null}
              </div>`)}
          </div>
        </div>
      </div>`;
  }

  /**
   * Botón de plegar/desplegar de un nodo con descendencia (RMR-TSK-0441):
   * «−» pliega su rama y «+N» dice cuántos roles esconde. El pointerdown se
   * detiene para que pulsarlo no arrastre el lienzo.
   */
  _foldButton(node) {
    const folded = node.hiddenCount > 0;
    const label = folded ? `+${node.hiddenCount}` : '−';
    const title = folded ? `Desplegar ${node.hiddenCount} rol(es)` : 'Plegar esta rama';
    return html`<button type="button" class="fold ${folded ? 'on' : ''}" title=${title}
      aria-expanded=${folded ? 'false' : 'true'}
      @pointerdown=${(e) => e.stopPropagation()}
      @click=${() => this._toggleFold(node.role.id)}>${label}</button>`;
  }

  /** Pliega o despliega la rama de un rol (RMR-TSK-0441). */
  _toggleFold(id) {
    const next = new Set(this._folded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this._folded = next;
  }

  /** Zoom relativo, acotado para no perder el dibujo de vista. */
  _zoomBy(factor) {
    this._zoom = Math.min(2, Math.max(0.25, this._zoom * factor));
  }

  /** «Ver todo»: encaja el lienzo en el visor y lo centra. */
  _zoomFit() {
    const port = this.renderRoot.querySelector('.tree-port');
    const canvas = this.renderRoot.querySelector('.tree-canvas');
    if (!port || !canvas) return;
    const w = parseFloat(canvas.style.width);
    const h = parseFloat(canvas.style.height);
    const scale = Math.min(1, (port.clientWidth - 24) / w, (port.clientHeight - 24) / h);
    this._zoom = Math.max(0.25, scale);
    this._pan = { x: (port.clientWidth - w * this._zoom) / 2, y: (port.clientHeight - h * this._zoom) / 2 };
  }

  /** Rueda = zoom (sin scroll de página). */
  _onWheel(e) {
    e.preventDefault();
    this._zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }

  _onPanStart(e) {
    if (e.button !== 0) return;
    this._drag = { x: e.clientX - this._pan.x, y: e.clientY - this._pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.classList.add('grabbing');
  }

  _onPanMove(e) {
    if (!this._drag) return;
    this._pan = { x: e.clientX - this._drag.x, y: e.clientY - this._drag.y };
  }

  _onPanEnd(e) {
    this._drag = null;
    e.currentTarget.classList.remove('grabbing');
  }

  /**
   * Banda de la pirámide GLOBAL: etiqueta de capa + subfilas por dependencia
   * intra-capa (RMR-TSK-0434, el coCEO depende del CEO y ambos viven en la 0:
   * se apilan, no se aplanan; la subfila de abajo sostiene a la de arriba).
   * Extraído para no anidar funciones (Sonar S2004).
   */
  _globalLevel({ layer, subrows }, i, total) {
    const width = 100 - i * (60 / Math.max(1, total));
    return html`<div class="pyr-level stacked ${layer === 0 ? 'base-level' : ''}" style="width:${Math.max(28, width)}%;--lv:${layerColor(layer)}">
      ${layer === 0
        ? html`<span class="pyr-lvl">Base · sostiene a todos</span>`
        : html`<span class="pyr-lvl">Nivel ${layer}</span>`}
      ${subrows.map((subrow, j) => this._globalSubrow(subrow, j))}
    </div>`;
  }

  /** Subfila de una banda global: flechita intra-capa + grupos por rama. */
  _globalSubrow(subrow, j) {
    const groups = Object.entries(Object.groupBy(subrow, (r) => r.branch));
    return html`
      ${j > 0 ? html`<span class="pyr-suparrow" title="Depende de alguien de su misma capa">↑</span>` : null}
      <div class="pyr-subrow">
        ${groups.map(([branch, roles]) => html`
          <div class="pyr-group" style="--g:${this._branchColor(branch)}">
            ${roles.map((r) => this._role(r, this._branchColor(branch)))}
          </div>`)}
      </div>`;
  }

  /** Banda de una mini-pirámide por rama, con sus subfilas intra-capa apiladas
   *  (extraído para no anidar funciones — Sonar S2004). */
  _miniLevel({ subrows }, i, total) {
    const width = 100 - i * (50 / Math.max(1, total));
    return html`<div class="pyr-level stacked" style="width:${Math.max(45, width)}%">
      ${subrows.map((subrow, j) => this._miniSubrow(subrow, j))}
    </div>`;
  }

  /** Subfila de una banda mini: flechita intra-capa + tarjetas de la subfila.
   *  Cada tarjeta lleva el color de SU rama (su categoría: un EM sigue siendo
   *  «Engineering Manager» aunque se dibuje dentro del área Engineering). */
  _miniSubrow(subrow, j) {
    return html`
      ${j > 0 ? html`<span class="pyr-suparrow" title="Depende de alguien de su misma capa">↑</span>` : null}
      <div class="pyr-subrow">${subrow.map((r) => this._role(r, this._branchColor(r.branch)))}</div>`;
  }

  /** Una mini-pirámide invertida POR ÁREA: cada área con su cabeza en la punta
   *  de abajo y su ÁRBOL hacia arriba. El área de un rol es su rama, salvo que
   *  esa rama sea de mandos intermedios (p. ej. «Engineering Manager»): entonces
   *  se dibuja dentro del área que sostiene (la de su superior), porque la
   *  jerarquía manda sobre la categoría — los EMs van con Engineering, donde
   *  cuelgan y a quienes sostienen. La rama del rol no cambia (su tarjeta sigue
   *  con su etiqueta y color). */
  _renderByBranch() {
    // Áreas a mostrar: las presentes entre los roles VISIBLES (aunque falte su
    // metadato en /orgBranches), para no perder ningún rol. Primero las
    // catalogadas (en su orden), luego las huérfanas; _branchLabel cae al id.
    const visible = this._visibleRoles;
    const areaById = new Map(visible.map((r) => [r.id, areaOf(visible, r)]));
    const areaIds = new Set(areaById.values());
    const branchIds = [
      ...this._branches.filter((b) => areaIds.has(b.id)).map((b) => b.id),
      ...[...areaIds].filter((id) => !this._branches.some((b) => b.id === id)),
    ];
    if (branchIds.length === 0) return html`<p class="empty">No hay roles.</p>`;
    // Sub-pestañas por área (RMR-TSK-0437): se pinta SOLO el área elegida, a
    // ancho completo. Si el área elegida ya no existe (cambio en vivo del
    // catálogo), cae a la primera sin romper la vista.
    const current = branchIds.includes(this._area) ? this._area : branchIds[0];
    // El área muestra su gente MÁS las cabezas de las áreas que cuelgan de ella
    // (RMR-TSK-0438): Executive ve al CPO y al CPeopleO; Product ve a los Heads.
    this._areaShown = current;
    return html`
      <div class="areas" role="tablist" aria-label="Áreas de la organización">
        ${branchIds.map((bid) => html`
          <button type="button" role="tab" id="area-${bid}" class="area ${bid === current ? 'on' : ''}"
            aria-selected=${bid === current ? 'true' : 'false'} style="--a:${this._branchColor(bid)}"
            @click=${() => { this._area = bid; }}>
            <span class="pyr-dot" style="background:${this._branchColor(bid)}"></span>${this._branchLabel(bid)}
          </button>`)}
      </div>
      <div role="tabpanel" aria-labelledby="area-${current}">
        ${this._renderTree(rolesOfArea(visible, current))}
      </div>`;
  }
}

customElements.define('org-chart', OrgChart);
