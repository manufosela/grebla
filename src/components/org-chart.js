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
import { roleChain } from '../tools/team/domain/orgRoles.js';

export class OrgChart extends LitElement {
  static properties = {
    _roles: { state: true },
    _branches: { state: true },
    _crown: { state: true },
    _error: { state: true },
    _ready: { state: true },
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
    .pyr-level { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; align-items: center; position: relative; max-width: 100%; }
    .pyr-level:not(:last-child)::after { content: '↑'; position: absolute; bottom: -1.05rem; left: 50%; transform: translateX(-50%); color: var(--rm-muted, #9ca3af); font-size: 1rem; font-weight: 700; }
    .pyr-role { display: inline-flex; align-items: center; gap: 0.45rem; border: 2px solid; border-radius: 10px; padding: 0.45rem 0.75rem; font-size: 0.85rem; font-weight: 700; background: var(--rm-surface, #fff); }
    .pyr-dot { width: 0.6rem; height: 0.6rem; border-radius: 50%; flex: none; }
    .pyr-branch { font-style: normal; font-size: 0.68rem; color: var(--rm-muted, #9ca3af); text-transform: uppercase; letter-spacing: 0.03em; }
    /* Nivel SIMBÓLICO en la cima: los usuarios del producto (no son fichas). */
    .pyr-crown {
      width: 100%; text-align: center; padding: 0.7rem 1rem; border-radius: 12px;
      border: 2px dashed var(--rm-accent, #2a9d8f); background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 10%, transparent);
      font-weight: 800; font-size: 1rem; color: var(--rm-text, #111827);
      display: flex; flex-direction: column; gap: 0.15rem;
    }
    .pyr-crown em { font-style: normal; font-weight: 500; font-size: 0.75rem; color: var(--rm-muted, #6b7280); }
  `;

  constructor() {
    super();
    this._roles = [];
    this._branches = [];
    this._crown = '';
    this._error = '';
    this._ready = false;
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

  render() {
    if (!this._ready) return html`<p class="lead">Cargando organigrama…</p>`;
    if (this._error) return html`<p class="error">${this._error}</p>`;
    const roles = this._roles;
    if (roles.length === 0) return html`<p class="empty">El organigrama aún no está configurado.</p>`;
    const depthOf = (id) => Math.max(0, roleChain(roles, id).length - 1);
    const maxDepth = Math.max(...roles.map((r) => depthOf(r.id)));
    const levels = [];
    for (let d = maxDepth; d >= 0; d -= 1) levels.push(roles.filter((r) => depthOf(r.id) === d));
    const branchColor = (b) => `var(--rm-branch-${b}, var(--rm-accent, #2a9d8f))`;
    return html`
      <p class="lead">Pirámide invertida: quien tiene <strong>más responsabilidad</strong> (a quien nadie sostiene) está <strong>abajo</strong>, sosteniendo a todos. Las flechas suben: cada nivel sostiene al de encima.</p>
      <div class="pyramid">
        ${this._crown ? html`<div class="pyr-crown">👥 ${this._crown}<em>a quienes todo el equipo sostiene</em></div>` : null}
        ${levels.map((level, i) => {
          const width = 100 - i * (60 / Math.max(1, levels.length));
          return html`<div class="pyr-level" style="width:${Math.max(28, width)}%">
            ${level.map((r) => html`<span class="pyr-role" style="border-color:${branchColor(r.branch)}">
              <span class="pyr-dot" style="background:${branchColor(r.branch)}"></span>${r.label}
              <em class="pyr-branch">${this._branchLabel(r.branch)}</em>
            </span>`)}
          </div>`;
        })}
      </div>`;
  }
}

customElements.define('org-chart', OrgChart);
