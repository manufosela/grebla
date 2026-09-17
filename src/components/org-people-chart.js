/**
 * <org-people-chart> — organigrama ESTÁNDAR de personas (RMR-PCS-0042 · F1):
 * quién reporta a quién, hacia abajo, como el organigrama clásico que pide el
 * plan de igualdad. Solo lectura. Es la otra vista de <org-chart>, que pinta la
 * pirámide invertida de ROLES.
 *
 * Datos: la callable `orgDirectory` (proyección cerrada del censo) y el
 * catálogo /orgRoles para el rótulo del puesto cuando no hay dato de Notion.
 */
import { LitElement, html, svg, css } from 'lit';
import { onUserChanged } from '../lib/auth.js';
import { fetchOrgDirectory } from '../lib/orgDirectory.js';
import { listOrgRoles } from '../lib/orgRoles.js';
import { branchColor } from '../tools/team/domain/orgRoles.js';
import { buildPeopleTree, peopleTreeLayout, personTitle } from '../tools/team/domain/orgPeopleTree.js';

const NODE = { nodeWidth: 208, nodeHeight: 78, gapX: 22, rowHeight: 124 };

export class OrgPeopleChart extends LitElement {
  static properties = {
    _people: { state: true },
    _roleLabels: { state: true },
    _ready: { state: true },
    _error: { state: true },
    _fit: { state: true },
  };

  static styles = css`
    :host { display: block; color: var(--rm-text, #111827); }
    .lead { color: var(--rm-muted, #5b6b7d); font-size: 0.95rem; margin: 0 0 0.9rem; }
    .empty, .error { color: var(--rm-muted, #5b6b7d); }
    .error { color: var(--rm-danger, #dc2626); }
    .bar { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.5rem; font-size: 0.82rem; color: var(--rm-muted, #5b6b7d); }
    .bar button { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); border-radius: 8px; padding: 0.3rem 0.7rem; font: inherit; font-size: 0.82rem; font-weight: 700; cursor: pointer; }
    .bar button:hover { border-color: var(--rm-accent, #2a9d8f); color: var(--rm-accent, #2a9d8f); }
    .port { position: relative; overflow: auto; max-height: min(72vh, 680px); border: 1px solid var(--rm-border, #e5e7eb); border-radius: 12px; background: color-mix(in srgb, var(--rm-text, #111827) 3%, transparent); padding: 1.2rem; box-sizing: border-box; }
    .canvas { position: relative; transform-origin: 0 0; }
    .links { position: absolute; inset: 0; overflow: visible; pointer-events: none; }
    .links path { fill: none; stroke: color-mix(in srgb, var(--rm-text, #111827) 35%, transparent); stroke-width: 1.6; }
    .node { position: absolute; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; gap: 0.15rem; padding: 0.5rem 0.7rem 0.5rem 0.95rem; border: 1.5px solid var(--rm-border, #d1d5db); border-left: 5px solid var(--b, var(--rm-accent, #2a9d8f)); border-radius: 10px; background: var(--rm-surface, #fff); box-shadow: 0 1px 3px rgba(17, 24, 39, 0.08); overflow: hidden; }
    .node.orphan { border-style: dashed; }
    .name, .title, .meta { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .name { font-weight: 800; font-size: 0.88rem; }
    .title { font-size: 0.78rem; color: var(--rm-text, #111827); }
    .meta { font-size: 0.7rem; color: var(--rm-muted, #5b6b7d); text-transform: uppercase; letter-spacing: 0.03em; }
    .count { position: absolute; top: 0.35rem; right: 0.45rem; font-size: 0.66rem; font-weight: 800; color: var(--rm-muted, #5b6b7d); border: 1px solid var(--rm-border, #d1d5db); border-radius: 999px; padding: 0.05rem 0.4rem; background: var(--rm-surface, #fff); }
    .orphan-tag { font-size: 0.66rem; color: var(--rm-danger, #dc2626); }
  `;

  constructor() {
    super();
    this._people = [];
    this._roleLabels = new Map();
    this._ready = false;
    this._error = '';
    this._fit = true;
    this._off = null;
  }

  connectedCallback() {
    super.connectedCallback();
    // Espera a la sesión: la callable exige estar autenticado.
    this._off = onUserChanged((user) => {
      if (!user) { this._ready = true; this._error = 'Inicia sesión para consultar el organigrama.'; return; }
      this._load();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._off?.();
  }

  async _load() {
    this._ready = false;
    this._error = '';
    try {
      const [people, roles] = await Promise.all([fetchOrgDirectory(), listOrgRoles()]);
      this._people = people;
      this._roleLabels = new Map(roles.map((r) => [r.id, r.label]));
    } catch (err) {
      this._error = `No se ha podido cargar el organigrama: ${err.message}`;
    } finally {
      this._ready = true;
    }
  }

  render() {
    if (!this._ready) return html`<p class="lead">Cargando organigrama…</p>`;
    if (this._error) return html`<p class="error">${this._error}</p>`;
    const tree = buildPeopleTree(this._people);
    if (tree.total === 0) return html`<p class="empty">Todavía no hay personas dadas de alta.</p>`;
    const layout = peopleTreeLayout(tree.roots, NODE);
    return html`
      <p class="lead">Organigrama estándar: cada persona debajo de quien le dirige.</p>
      <div class="bar">
        <span>${tree.total} personas · ${tree.roots.length} ${tree.roots.length === 1 ? 'raíz' : 'raíces'}</span>
        <button type="button" @click=${() => { this._fit = !this._fit; }}>${this._fit ? 'Tamaño real' : 'Ajustar al ancho'}</button>
      </div>
      <div class="port">${this._renderCanvas(layout)}</div>`;
  }

  _renderCanvas(layout) {
    const scale = this._fit ? Math.min(1, (this.clientWidth - 48) / Math.max(1, layout.width)) : 1;
    return html`<div class="canvas" style="width:${layout.width}px;height:${layout.height}px;transform:scale(${scale});margin-bottom:${(scale - 1) * layout.height}px">
      <svg class="links" width=${layout.width} height=${layout.height} aria-hidden="true">
        ${layout.links.map((l) => svg`<path d=${elbow(l)} />`)}
      </svg>
      ${layout.nodes.map((n) => this._renderNode(n))}
    </div>`;
  }

  _renderNode({ node, x, y }) {
    const p = node.person;
    const title = personTitle(p, this._roleLabels);
    const meta = [p.notion?.department, p.notion?.team].filter(Boolean).join(' · ') || p.orgBranch || '';
    const left = x - NODE.nodeWidth / 2;
    const top = y - NODE.nodeHeight / 2;
    return html`<div class="node ${node.orphan ? 'orphan' : ''}" data-person-id=${p.personId}
      style="left:${left}px;top:${top}px;width:${NODE.nodeWidth}px;height:${NODE.nodeHeight}px;--b:${branchColor(p.orgBranch)}">
      ${node.reports > 0 ? html`<span class="count" title="Personas a su cargo, directas e indirectas">${node.reports}</span>` : null}
      <span class="name">${p.name}</span>
      ${title ? html`<span class="title">${title}</span>` : null}
      ${node.orphan ? html`<span class="orphan-tag">Sin manager en el censo</span>` : (meta ? html`<span class="meta">${meta}</span>` : null)}
    </div>`;
  }
}

/** Arista en codo: baja del padre, cruza y baja al hijo. */
function elbow({ x1, y1, x2, y2 }) {
  const midY = (y1 + y2) / 2;
  return `M${x1},${y1} V${midY} H${x2} V${y2}`;
}

if (!customElements.get('org-people-chart')) customElements.define('org-people-chart', OrgPeopleChart);
