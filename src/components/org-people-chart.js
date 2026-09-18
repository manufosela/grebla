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
import { buildPeopleTree, peopleTreeLayout, personTitle, splitLoose } from '../tools/team/domain/orgPeopleTree.js';
import './zoom-port.js';

const NODE = { nodeWidth: 208, nodeHeight: 78, gapX: 22, rowHeight: 124 };

export class OrgPeopleChart extends LitElement {
  static properties = {
    _people: { state: true },
    _roleLabels: { state: true },
    _ready: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; color: var(--rm-text, #111827); }
    .lead { color: var(--rm-muted, #5b6b7d); font-size: 0.95rem; margin: 0 0 0.9rem; }
    .empty, .error { color: var(--rm-muted, #5b6b7d); }
    .error { color: var(--rm-danger, #dc2626); }
    .bar { font-size: 0.82rem; color: var(--rm-muted, #5b6b7d); margin-bottom: 0.4rem; }
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
    /* Personas sueltas: sin manager y sin equipo. Fuera del árbol, en rejilla. */
    .loose { margin-top: 1.1rem; }
    .loose h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--rm-muted, #5b6b7d); margin: 0 0 0.5rem; }
    .loose-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); gap: 0.6rem; }
    .loose .node { position: static; height: auto; min-height: 3.6rem; }
  `;

  constructor() {
    super();
    this._people = [];
    this._roleLabels = new Map();
    this._ready = false;
    this._error = '';
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
    const { tree: roots, loose } = splitLoose(tree.roots);
    const layout = peopleTreeLayout(roots, NODE);
    return html`
      <p class="lead">Organigrama estándar: cada persona debajo de quien le dirige.</p>
      <div class="bar">${tree.total} personas · ${roots.length} ${roots.length === 1 ? 'raíz' : 'raíces'}${loose.length ? ` · ${loose.length} sin asignar` : ''}</div>
      ${roots.length ? html`<zoom-port .width=${layout.width} .height=${layout.height}>
        <svg class="links" width=${layout.width} height=${layout.height} aria-hidden="true">
          ${layout.links.map((l) => svg`<path d=${l.d} />`)}
        </svg>
        ${layout.nodes.map((n) => this._renderNode(n))}
      </zoom-port>` : null}
      ${this._renderLoose(loose)}`;
  }

  /** Sin manager y sin equipo: no cuelgan de nadie, así que no entran en el árbol. */
  _renderLoose(loose) {
    if (loose.length === 0) return null;
    return html`<section class="loose">
      <h2>Sin manager asignado (${loose.length})</h2>
      <div class="loose-grid">${loose.map((node) => this._renderNode({ node, x: 0, y: 0 }, false))}</div>
    </section>`;
  }

  _renderNode({ node, x, y }, positioned = true) {
    const p = node.person;
    const title = personTitle(p, this._roleLabels);
    const meta = [p.notion?.department, p.notion?.team].filter(Boolean).join(' · ') || p.orgBranch || '';
    const box = positioned
      ? `left:${x - NODE.nodeWidth / 2}px;top:${y - NODE.nodeHeight / 2}px;width:${NODE.nodeWidth}px;height:${NODE.nodeHeight}px;`
      : '';
    return html`<div class="node ${node.orphan ? 'orphan' : ''}" data-person-id=${p.personId}
      style="${box}--b:${branchColor(p.orgBranch)}">
      ${node.reports > 0 ? html`<span class="count" title="Personas a su cargo, directas e indirectas">${node.reports}</span>` : null}
      <span class="name">${p.name}</span>
      ${title ? html`<span class="title">${title}</span>` : null}
      ${this._renderFoot(node, meta)}
    </div>`;
  }

  /** Pie de la tarjeta: el aviso de huérfano manda sobre el departamento · equipo. */
  _renderFoot(node, meta) {
    if (node.orphan) return html`<span class="orphan-tag">Sin manager en el censo</span>`;
    if (meta) return html`<span class="meta">${meta}</span>`;
    return null;
  }
}

if (!customElements.get('org-people-chart')) customElements.define('org-people-chart', OrgPeopleChart);
