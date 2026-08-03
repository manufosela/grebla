/**
 * <org-chart> — vista de SOLO LECTURA del organigrama en PIRÁMIDE INVERTIDA
 * (liderazgo afectivo, RMR-PRP-0002). Consultable por cualquier empleado: lee
 * /orgRoles y /orgBranches y dibuja los roles como pirámide invertida (el rol
 * «sin inferior» —al que nadie sostiene porque sostiene a todos— en la punta de
 * abajo; hacia arriba, ensanchando, los sostenidos). No edita nada.
 */
import { LitElement, html, css } from 'lit';
import { onUserChanged } from '../lib/auth.js';
import { listOrgRoles } from '../lib/orgRoles.js';
import { listOrgBranches } from '../lib/orgBranches.js';
import { getUsersCrownLabel } from '../lib/orgConfig.js';
import { roleChain, branchColor } from '../tools/team/domain/orgRoles.js';

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
    .pyr-level { display: flex; flex-wrap: wrap; gap: 1.5rem; justify-content: center; align-items: center; position: relative; max-width: 100%; }
    .pyr-group { display: inline-flex; flex-wrap: wrap; gap: 0.5rem; padding: 0.4rem 0.55rem; border-radius: 12px; border: 1.5px solid color-mix(in srgb, var(--g, var(--rm-accent, #2a9d8f)) 45%, transparent); background: color-mix(in srgb, var(--g, var(--rm-accent, #2a9d8f)) 7%, transparent); }
    .pyr-level:not(:last-child)::after { content: '↑'; position: absolute; bottom: -1.05rem; left: 50%; transform: translateX(-50%); color: var(--rm-muted, #9ca3af); font-size: 1rem; font-weight: 700; }
    .pyr-role { display: inline-flex; align-items: center; gap: 0.45rem; border: 2px solid; border-radius: 10px; padding: 0.45rem 0.75rem; font-size: 0.85rem; font-weight: 700; background: var(--rm-surface, #fff); }
    .pyr-dot { width: 0.6rem; height: 0.6rem; border-radius: 50%; flex: none; }
    .pyr-branch { font-style: normal; font-size: 0.68rem; color: var(--rm-muted, #9ca3af); text-transform: uppercase; letter-spacing: 0.03em; }
    .pyr-lvl { flex: 100%; text-align: center; font-size: 0.66rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--rm-muted, #9ca3af); }
    .pyr-lvl.base { color: var(--rm-accent, #2a9d8f); }
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
      if (!user) { this._ready = true; this._error = 'Inicia sesión para consultar el organigrama.'; return; }
      if (this._loadedForUser === user.uid) return;
      this._loadedForUser = user.uid;
      this._load();
    });
  }

  disconnectedCallback() {
    this._off?.();
    super.disconnectedCallback();
  }

  async _load() {
    this._error = '';
    try {
      const [roles, branches, crown] = await Promise.all([listOrgRoles(), listOrgBranches(), getUsersCrownLabel()]);
      this._roles = roles;
      this._branches = branches;
      this._crown = crown;
    } catch (err) {
      this._error = 'No se pudo cargar el organigrama.';
    } finally {
      this._ready = true;
    }
  }

  _branchLabel(id) {
    return this._branches.find((b) => b.id === id)?.label ?? id;
  }

  _branchColor(b) { return branchColor(b); }

  /** Niveles (por profundidad) de un conjunto de roles, de la base (abajo) a las
   *  hojas (arriba): array de [rolesEnEseNivel], en orden invertido para pintar. */
  _levelsOf(roles) {
    const depthOf = (id) => Math.max(0, roleChain(roles, id).length - 1);
    const maxDepth = Math.max(0, ...roles.map((r) => depthOf(r.id)));
    const levels = [];
    for (let d = maxDepth; d >= 0; d -= 1) levels.push(roles.filter((r) => depthOf(r.id) === d));
    return levels;
  }

  _role(r, color) {
    return html`<span class="pyr-role" style="border-color:${color}">
      <span class="pyr-dot" style="background:${color}"></span>${r.label}
      <em class="pyr-branch">${this._branchLabel(r.branch)}</em>
    </span>`;
  }

  render() {
    if (!this._ready) return html`<p class="lead">Cargando organigrama…</p>`;
    if (this._error) return html`<p class="error">${this._error}</p>`;
    if (this._roles.length === 0) return html`<p class="empty">El organigrama aún no está configurado.</p>`;
    return html`
      <p class="lead">Pirámide invertida: quien tiene <strong>más responsabilidad</strong> (a quien nadie sostiene) está <strong>abajo</strong>, sosteniendo a todos. Las flechas suben: cada nivel sostiene al de encima.</p>
      <div class="modes">
        <button type="button" class="mode ${this._mode === 'global' ? 'on' : ''}" @click=${() => { this._mode = 'global'; }}>Toda la organización</button>
        <button type="button" class="mode ${this._mode === 'ramas' ? 'on' : ''}" @click=${() => { this._mode = 'ramas'; }}>Por ramas</button>
      </div>
      ${this._mode === 'ramas' ? this._renderByBranch() : this._renderGlobal()}`;
  }

  _renderGlobal() {
    const levels = this._levelsOf(this._roles);
    const maxDepth = levels.length - 1;
    return html`
      <div class="pyramid">
        ${this._crown ? html`<div class="pyr-crown">👥 ${this._crown}<em>a quienes todo el equipo sostiene</em></div>` : null}
        ${levels.map((level, i) => {
          const width = 100 - i * (60 / Math.max(1, levels.length));
          // Etiqueta de NIVEL por banda (RMR-BUG-0071): la base (C-Level) abajo,
          // los estratos numerados hacia arriba.
          const depth = maxDepth - i;
          // Dentro de cada franja, los roles se AGRUPAN por rama (cada grupo con
          // el color de su rama, separados) para ver qué va con qué.
          const groups = Object.groupBy(level, (r) => r.branch);
          return html`<div class="pyr-level" style="width:${Math.max(28, width)}%">
            ${depth === 0
              ? html`<span class="pyr-lvl base">Base · sostiene a todos</span>`
              : html`<span class="pyr-lvl">Nivel ${depth}</span>`}
            ${Object.entries(groups).map(([branch, roles]) => html`
              <div class="pyr-group" style="--g:${this._branchColor(branch)}">
                ${roles.map((r) => this._role(r, this._branchColor(branch)))}
              </div>`)}
          </div>`;
        })}
      </div>`;
  }

  /** Una mini-pirámide invertida POR RAMA: cada rama con su cabeza (sin inferior)
   *  en la punta de abajo y sus roles hacia arriba, en columnas lado a lado. */
  _renderByBranch() {
    // Ramas a mostrar: TODAS las presentes en los roles (aunque falte su metadato
    // en /orgBranches), para no perder ningún rol en esta vista. Primero las
    // catalogadas (en su orden), luego las huérfanas; _branchLabel cae al id.
    const roleBranchIds = new Set(this._roles.map((r) => r.branch));
    const branchIds = [
      ...this._branches.filter((b) => roleBranchIds.has(b.id)).map((b) => b.id),
      ...[...roleBranchIds].filter((id) => !this._branches.some((b) => b.id === id)),
    ];
    if (branchIds.length === 0) return html`<p class="empty">No hay roles.</p>`;
    return html`
      <div class="branch-grid">
        ${branchIds.map((bid) => {
          const color = this._branchColor(bid);
          const levels = this._levelsOf(this._roles.filter((r) => r.branch === bid));
          return html`<div class="branch-col">
            <div class="branch-title" style="color:${color}"><span class="pyr-dot" style="background:${color}"></span> ${this._branchLabel(bid)}</div>
            <div class="pyramid mini">
              ${levels.map((level, i) => {
                const width = 100 - i * (50 / Math.max(1, levels.length));
                return html`<div class="pyr-level" style="width:${Math.max(45, width)}%">
                  ${level.map((r) => this._role(r, color))}
                </div>`;
              })}
            </div>
          </div>`;
        })}
      </div>`;
  }
}

customElements.define('org-chart', OrgChart);
