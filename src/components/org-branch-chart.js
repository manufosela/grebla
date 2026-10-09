/**
 * <org-branch-chart> — el organigrama (RMR-TSK-0672): el árbol invertido de una
 * rama (orgBranchTree.js), cada rama con su color. Se elige la rama o toda la
 * casa para no verlo todo a la vez, y se mueve y amplía con <zoom-port>. Datos:
 * la callable `orgDirectory` (proyección cerrada del censo), ramas y roles.
 */
import { LitElement, html, svg, css } from 'lit';
import { onUserChanged } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';
import { fetchOrgDirectory } from '../lib/orgDirectory.js';
import { listOrgRoles } from '../lib/orgRoles.js';
import { listOrgBranches } from '../lib/orgBranches.js';
import { branchColor } from '../tools/team/domain/orgRoles.js';
import { branchTree, branchTreeLayout } from '../tools/team/domain/orgBranchTree.js';
import { skeletonLines } from './app-skeleton.js';
import './zoom-port.js';
import './app-modal.js';

const SIZE = { nodeWidth: 200, nodeHeight: 64, gapX: 20, rowHeight: 120 };
const LABEL_W = 110; // margen izquierdo para el rótulo de cada banda
const ALL = '';
const colorVar = (color) => `--b: ${color}`;
const peopleCount = (n) => (n === 1 ? '1 persona' : `${n} personas`);

export class OrgBranchChart extends LitElement {
  static properties = {
    _people: { state: true },
    _branches: { state: true },
    _branch: { state: true },
    _team: { state: true },
    _ready: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; color: var(--rm-text, #111827); }
    .picker { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0 0 0.8rem; }
    .picker button { display: inline-flex; align-items: center; gap: 0.4rem; font: inherit; font-size: 0.85rem; cursor: pointer; padding: 0.3rem 0.75rem; border-radius: 999px; border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); }
    .picker button[aria-pressed='true'] { border-color: var(--rm-text, #111827); font-weight: 700; }
    .dot { width: 0.7rem; height: 0.7rem; border-radius: 50%; background: var(--b); }
    .links { position: absolute; inset: 0; overflow: visible; pointer-events: none; }
    .links path { fill: none; stroke-width: 2; }
    .band { position: absolute; left: 0; right: 0; border-top: 1px dashed var(--rm-border, #d1d5db); }
    .band-label { position: absolute; left: 8px; top: 6px; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: var(--rm-muted, #5b6b7d); }
    .node { position: absolute; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; gap: 0.1rem; padding: 0.4rem 0.7rem; border: 2px solid var(--b); border-radius: 10px; overflow: hidden; background: color-mix(in srgb, var(--b) 14%, var(--rm-surface, #fff)); }
    .node.team { border-style: dashed; text-align: center; font: inherit; color: inherit; cursor: pointer; }
    .node.team:hover, .node.team:focus-visible { border-style: solid; }
    .members { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
    .members li { display: flex; flex-direction: column; padding: 0.4rem 0.6rem; border-radius: 8px; border: 1px solid var(--rm-border, #e5e7eb); }
    .name, .title { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .name { font-weight: 800; font-size: 0.88rem; }
    .title { font-size: 0.76rem; }
    .empty { color: var(--rm-muted, #5b6b7d); }
    .error { color: var(--rm-danger, #b91c1c); }
  `;

  constructor() {
    super();
    this._people = [];
    this._branches = [];
    this._roleLabels = new Map();
    this._branch = ALL;
    this._team = null;
    this._ready = false;
    this._error = '';
    this._off = null;
  }

  connectedCallback() {
    super.connectedCallback();
    // La callable exige sesión, y cada cambio de sesión invalida la carga en curso.
    this._off = onUserChanged((user) => {
      this._session = (this._session ?? 0) + 1;
      if (user) { this._load(user, this._session); return; }
      this._people = [];
      this._ready = true;
      this._error = 'Inicia sesión para consultar el organigrama.';
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._off?.();
  }

  async _load(user, session) {
    this._ready = false;
    this._error = '';
    let loaded;
    try {
      loaded = await Promise.all([fetchOrgDirectory(), listOrgRoles(), listOrgBranches(), resolveAccess(user)]);
    } catch (err) {
      if (session === this._session) [this._error, this._ready] = [`No se ha podido cargar el organigrama: ${err.message}`, true];
      return;
    }
    if (session !== this._session) return;
    const [people, roles, branches, access] = loaded;
    this._people = people;
    this._roleLabels = new Map(roles.map((r) => [r.id, r.label]));
    this._branches = branches.filter((b) => people.some((p) => p.orgBranch === b.id));
    // Se abre en tu rama; quien no tiene ficha empieza por la primera.
    const mine = people.find((p) => p.personId === access.personId)?.orgBranch;
    this._branch = this._branches.some((b) => b.id === mine) ? mine : (this._branches[0]?.id ?? ALL);
    this._ready = true;
  }

  _color(branchId) {
    return branchColor(branchId, this._branches.find((b) => b.id === branchId)?.color);
  }

  render() {
    if (!this._ready) return html`<div style="min-height: 20rem">${skeletonLines(8)}</div>`;
    if (this._error) return html`<p class="error">${this._error}</p>`;
    if (!this._people.length) return html`<p class="empty">Todavía no hay personas en el censo.</p>`;
    const tree = branchTree(this._people, this._branch === ALL ? null : this._branch);
    const layout = branchTreeLayout(tree, SIZE);
    return html`
      ${this._renderPicker()}
      <zoom-port .width=${layout.width + LABEL_W} .height=${layout.height}>
        ${tree.bands.map((b) => this._renderBand(b, layout.height))}
        <svg class="links" width=${layout.width + LABEL_W} height=${layout.height} aria-hidden="true">
          ${layout.links.map((l) => this._renderLink(l, layout.nodes))}
        </svg>
        ${layout.nodes.map((n) => this._renderNode(n))}
        ${this._renderTeamModal()}
      </zoom-port>`;
  }

  /** La línea toma el color de la rama de quien depende. */
  _renderLink(link, nodes) {
    const stroke = `stroke: ${this._color(nodes.find((n) => n.id === link.from).branch)}`;
    return svg`<path d=${link.d} transform="translate(${LABEL_W} 0)" style=${stroke} />`;
  }

  _renderPicker() {
    return html`<div class="picker" role="group" aria-label="Rama">
      ${this._branches.map((b) => this._renderOption(b.id, b.label, this._color(b.id)))}
      ${this._renderOption(ALL, 'Toda la casa', null)}
    </div>`;
  }

  _renderOption(id, label, color) {
    const dot = color ? html`<span class="dot" style=${colorVar(color)}></span>` : null;
    return html`<button type="button" aria-pressed=${this._branch === id}
      @click=${() => { this._branch = id; }}>${dot}${label}</button>`;
  }

  /** Banda de un nivel: una raya en su borde de arriba, con su rótulo. */
  _renderBand(band, height) {
    // La fila 0 está abajo: su centro, a `pad` (16) y media tarjeta del borde.
    const top = height - 16 - SIZE.nodeHeight / 2 - band.toRow * SIZE.rowHeight - SIZE.rowHeight / 2;
    const style = `top:${Math.max(top, 0)}px`;
    return html`<div class="band" style=${style}>
      <span class="band-label">${band.label ?? ''}</span>
    </div>`;
  }

  _titleOf(person) {
    return person.notion?.role ?? this._roleLabels.get(person.orgRole) ?? '';
  }

  _renderNode(n) {
    const box = `left:${LABEL_W + n.x - SIZE.nodeWidth / 2}px;top:${n.y - SIZE.nodeHeight / 2}px;width:${SIZE.nodeWidth}px;height:${SIZE.nodeHeight}px;--b:${this._color(n.branch)}`;
    if (n.kind === 'team') {
      // Quién hay dentro se ve en un modal, para no cargar el árbol (RMR-TSK-0673).
      return html`<button type="button" class="node team" style=${box} data-team=${n.label}
        title="Ver quién hay" @click=${() => { this._team = n; }}>
        <span class="name">${n.label}</span><span class="title">${peopleCount(n.count)}</span>
      </button>`;
    }
    return html`<div class="node" style=${box} data-person-id=${n.id}>
      <span class="name">${n.person.name}</span><span class="title">${this._titleOf(n.person)}</span>
    </div>`;
  }

  _renderTeamModal() {
    const team = this._team;
    const heading = team ? `${team.label} · ${peopleCount(team.count)}` : '';
    return html`<app-modal slot="overlay" .open=${!!team} heading=${heading} @close=${() => { this._team = null; }}>
      <ul class="members">${(team?.members ?? []).map((p) => this._renderMember(p))}</ul>
    </app-modal>`;
  }

  _renderMember(person) {
    return html`<li><span class="name">${person.name}</span><span class="title">${this._titleOf(person)}</span></li>`;
  }
}

if (!customElements.get('org-branch-chart')) customElements.define('org-branch-chart', OrgBranchChart);
