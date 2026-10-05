/**
 * <org-people-pyramid> — el organigrama de GREBLA (RMR-TSK-0617): una pirámide
 * invertida de PERSONAS. Quien más responsabilidad tiene está en la BASE,
 * sosteniendo al resto. Con Notion, la capa es su Level; sin Notion, la de su
 * rol (peoplePyramid.js). Cada capa es un recuadro con su color y su etiqueta
 * (RMR-BUG-0071/0072) y cada persona lleva su rol y su departamento.
 *
 * Datos: la callable `orgDirectory` (proyección cerrada del censo) y los
 * catálogos de roles y departamentos.
 */
import { LitElement, html, css } from 'lit';
import { onUserChanged } from '../lib/auth.js';
import { fetchOrgDirectory } from '../lib/orgDirectory.js';
import { listOrgRoles } from '../lib/orgRoles.js';
import { listOrgBranches } from '../lib/orgBranches.js';
import { peoplePyramid } from '../tools/team/domain/peoplePyramid.js';
import { branchColor, layerColor } from '../tools/team/domain/orgRoles.js';
import { skeletonLines } from './app-skeleton.js';

export class OrgPeoplePyramid extends LitElement {
  static properties = {
    _pyramid: { state: true },
    _branches: { state: true },
    _ready: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; color: var(--rm-text, #111827); }
    .pyramid { display: flex; flex-direction: column; gap: 0.7rem; }
    .band {
      border: 2px solid var(--band); border-radius: 12px; padding: 0.6rem 0.8rem 0.8rem;
      background: color-mix(in srgb, var(--band) 8%, var(--rm-surface, #fff));
    }
    .band-head { display: flex; align-items: baseline; gap: 0.6rem; margin: 0 0 0.5rem; }
    .band-label { font-weight: 800; font-size: 0.85rem; letter-spacing: 0.02em; }
    .band-count { font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); }
    .people { display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: center; }
    .person {
      display: flex; flex-direction: column; min-width: 9rem; max-width: 13rem; padding: 0.35rem 0.6rem;
      border-radius: 9px; border: 1px solid var(--rm-border, #dde7ec); border-left: 5px solid var(--dept);
      background: var(--rm-surface, #fff);
    }
    .name { font-weight: 700; font-size: 0.88rem; }
    .meta { font-size: 0.76rem; color: var(--rm-muted, #5b6b7d); }
    .empty, .error { color: var(--rm-muted, #5b6b7d); }
    .error { color: var(--rm-danger, #b91c1c); }
  `;

  constructor() {
    super();
    this._pyramid = null;
    this._branches = new Map();
    this._ready = false;
    this._error = '';
    this._off = null;
  }

  connectedCallback() {
    super.connectedCallback();
    // La callable exige sesión: se espera a tenerla.
    this._off = onUserChanged((user) => {
      if (user) this._load();
      else { this._ready = true; this._error = 'Inicia sesión para consultar el organigrama.'; }
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
      const [people, roles, branches] = await Promise.all([fetchOrgDirectory(), listOrgRoles(), listOrgBranches()]);
      this._branches = new Map(branches.map((b) => [b.id, b]));
      this._pyramid = peoplePyramid(people, roles);
    } catch (err) {
      this._error = `No se ha podido cargar el organigrama: ${err.message}`;
    } finally {
      this._ready = true;
    }
  }

  render() {
    if (!this._ready) return html`<div style="min-height: 20rem">${skeletonLines(8)}</div>`;
    if (this._error) return html`<p class="error">${this._error}</p>`;
    const bands = this._pyramid?.bands ?? [];
    if (!bands.length) return html`<p class="empty">Todavía no hay personas en el censo.</p>`;
    // Invertida: la cima arriba, la BASE abajo sosteniendo al resto.
    const fromTop = bands.toReversed();
    return html`<div class="pyramid">${fromTop.map((band, i) => this._renderBand(band, bands.length - 1 - i, bands.length))}</div>`;
  }

  /** @param {{ label: string, people: object[] }} band @param {number} depth 0 = base */
  _renderBand(band, depth, total) {
    const label = depth === 0 ? `Base · ${band.label}` : band.label;
    const count = band.people.length === 1 ? '1 persona' : `${band.people.length} personas`;
    return html`<section class="band" style=${`--band: ${layerColor(depth)}`} aria-label=${label} data-total=${total}>
      <div class="band-head"><span class="band-label">${label}</span><span class="band-count">${count}</span></div>
      <div class="people">${band.people.map((p) => this._renderPerson(p))}</div>
    </section>`;
  }

  /** @param {{ personId: string, name: string, title: string, branch: string|null }} person */
  _renderPerson(person) {
    const dept = this._branches.get(person.branch);
    const color = branchColor(person.branch, dept?.color);
    const meta = [person.title, dept?.label].filter(Boolean).join(' · ');
    return html`<div class="person" style=${`--dept: ${color}`} data-person-id=${person.personId}>
      <span class="name">${person.name}</span>
      <span class="meta">${meta}</span>
    </div>`;
  }
}

customElements.define('org-people-pyramid', OrgPeoplePyramid);
