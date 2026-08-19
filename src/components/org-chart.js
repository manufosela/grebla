/**
 * <org-chart> — vista de SOLO LECTURA del organigrama en PIRÁMIDE INVERTIDA
 * (liderazgo afectivo, RMR-PRP-0002). Consultable por cualquier empleado: lee
 * /orgRoles y /orgBranches y dibuja los roles como pirámide invertida (el rol
 * «sin inferior» —al que nadie sostiene porque sostiene a todos— en la punta de
 * abajo; hacia arriba, ensanchando, los sostenidos). No edita nada.
 */
import { LitElement, html, css } from 'lit';
import { onUserChanged } from '../lib/auth.js';
import { watchOrgRoles } from '../lib/orgRoles.js';
import { watchOrgBranches } from '../lib/orgBranches.js';
import { getUsersCrownLabel } from '../lib/orgConfig.js';
import { branchColor, coveredRoleLabels, layerColor, pyramidLayers } from '../tools/team/domain/orgRoles.js';

export class OrgChart extends LitElement {
  static properties = {
    _roles: { state: true },
    _branches: { state: true },
    _crown: { state: true },
    _error: { state: true },
    _ready: { state: true },
    _mode: { state: true },
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
    .pyr-role { display: inline-flex; align-items: center; gap: 0.45rem; border: 2px solid; border-radius: 10px; padding: 0.45rem 0.75rem; font-size: 0.85rem; font-weight: 700; background: var(--rm-surface, #fff); }
    .pyr-dot { width: 0.6rem; height: 0.6rem; border-radius: 50%; flex: none; }
    .pyr-branch { font-style: normal; font-size: 0.68rem; color: var(--rm-muted, #9ca3af); text-transform: uppercase; letter-spacing: 0.03em; }
    /* Badge «ejerce también de X» (RMR-TSK-0434): mando que cubre una capa vacía. */
    .pyr-acts { font-style: normal; font-size: 0.66rem; font-weight: 700; color: #7a5c00; background: color-mix(in srgb, #e9c46a 35%, transparent); border: 1px solid #b8860b; border-radius: 999px; padding: 0.05rem 0.45rem; cursor: help; }
    /* Etiqueta de capa: solo la pirámide GLOBAL la renderiza; en mini (por ramas),
       si apareciera, fluye en normal-flow (sin solaparse con las fichas). */
    .pyr-lvl { flex: 100%; text-align: center; font-size: 0.66rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--lv, #9ca3af); }
    .pyramid:not(.mini) .pyr-lvl { position: absolute; top: 0.35rem; left: 0.85rem; flex: none; text-align: left; }
    /* Nivel SIMBÓLICO en la cima: los usuarios del producto (no son fichas). */
    .pyr-crown {
      width: 100%; text-align: center; padding: 0.7rem 1rem; border-radius: 12px;
      border: 2px dashed var(--rm-accent, #2a9d8f); background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 10%, transparent);
      font-weight: 800; font-size: 1rem; color: var(--rm-text, #111827);
      display: flex; flex-direction: column; gap: 0.15rem;
    }
    .pyr-crown em { font-style: normal; font-weight: 500; font-size: 0.75rem; color: var(--rm-muted, #6b7280); }
    /* Toggle Global / Por ramas (mismo lenguaje de pestaña subrayada). */
    .modes { display: flex; gap: 0.1rem; border-bottom: 2px solid var(--rm-border, #e5e7eb); margin-bottom: 0.5rem; }
    .mode { border: 0; background: none; color: var(--rm-muted, #6b7280); padding: 0.5rem 0.9rem; font: inherit; font-size: 0.88rem; font-weight: 600; cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -2px; }
    .mode.on { color: var(--rm-accent, #2a9d8f); border-bottom-color: var(--rm-accent, #2a9d8f); }
    .mode:hover:not(.on) { color: var(--rm-text, #111827); }
    /* Mini-pirámides por rama, en rejilla. */
    .branch-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); gap: 1.5rem 1rem; padding: 0.5rem 0; align-items: end; }
    .branch-col { display: flex; flex-direction: column; align-items: center; gap: 0.6rem; }
    .branch-title { display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 800; font-size: 0.95rem; }
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
    // Badge derivado (RMR-TSK-0434): un mando cuyos hijos saltan capa «ejerce
    // también de» los roles de la capa saltada (Head of Data → EM). Se calcula
    // contra TODOS los roles visibles para que la capa tenga nombre aunque sea
    // de otra rama.
    const covers = coveredRoleLabels(this._visibleRoles, r);
    return html`<span class="pyr-role" style="border-color:${color}">
      <span class="pyr-dot" style="background:${color}"></span>${r.label}
      <em class="pyr-branch">${this._branchLabel(r.branch)}</em>
      ${covers.length ? html`<em class="pyr-acts" title="Sus reportes directos saltan una capa: cubre ese rol mientras la rama crece">ejerce también de ${covers.join(' / ')}</em>` : null}
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
    const levels = this._levelsOf(this._visibleRoles);
    return html`
      <div class="pyramid">
        ${this._crown ? html`<div class="pyr-crown">👥 ${this._crown}<em>a quienes todo el equipo sostiene</em></div>` : null}
        ${levels.map((level, i) => this._globalLevel(level, i, levels.length))}
      </div>`;
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
  _miniLevel({ subrows }, i, total, color) {
    const width = 100 - i * (50 / Math.max(1, total));
    return html`<div class="pyr-level stacked" style="width:${Math.max(45, width)}%">
      ${subrows.map((subrow, j) => this._miniSubrow(subrow, j, color))}
    </div>`;
  }

  /** Subfila de una banda mini: flechita intra-capa + tarjetas de la subfila. */
  _miniSubrow(subrow, j, color) {
    return html`
      ${j > 0 ? html`<span class="pyr-suparrow" title="Depende de alguien de su misma capa">↑</span>` : null}
      <div class="pyr-subrow">${subrow.map((r) => this._role(r, color))}</div>`;
  }

  /** Una mini-pirámide invertida POR RAMA: cada rama con su cabeza (sin inferior)
   *  en la punta de abajo y sus roles hacia arriba, en columnas lado a lado. */
  _renderByBranch() {
    // Ramas a mostrar: TODAS las presentes en los roles VISIBLES (aunque falte su
    // metadato en /orgBranches), para no perder ningún rol en esta vista. Primero
    // las catalogadas (en su orden), luego las huérfanas; _branchLabel cae al id.
    const visible = this._visibleRoles;
    const roleBranchIds = new Set(visible.map((r) => r.branch));
    const branchIds = [
      ...this._branches.filter((b) => roleBranchIds.has(b.id)).map((b) => b.id),
      ...[...roleBranchIds].filter((id) => !this._branches.some((b) => b.id === id)),
    ];
    if (branchIds.length === 0) return html`<p class="empty">No hay roles.</p>`;
    return html`
      <div class="branch-grid">
        ${branchIds.map((bid) => {
          const color = this._branchColor(bid);
          const levels = this._levelsOf(visible.filter((r) => r.branch === bid));
          return html`<div class="branch-col">
            <div class="branch-title" style="color:${color}"><span class="pyr-dot" style="background:${color}"></span> ${this._branchLabel(bid)}</div>
            <div class="pyramid mini">
              ${levels.map((level, i) => this._miniLevel(level, i, levels.length, color))}
            </div>
          </div>`;
        })}
      </div>`;
  }
}

customElements.define('org-chart', OrgChart);
