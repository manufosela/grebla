/**
 * <retro-app> — orquesta la herramienta de Retros (RMR-TSK-0247). El manager crea y
 * gestiona (retro-manager); al abrir una retro se muestra su detalle: el bucle de
 * acciones anteriores + el tablero colaborativo + las acciones de esta retro. El
 * ingeniero ve la lista de retros de su equipo y participa igual (sin crear).
 *
 * Props: uid, leaderUid (manager cuyas retros se ven), members ([{uid,name}]),
 * canManage (true para el manager dueño).
 */
import { LitElement, html, css } from 'lit';
import { skeletonLines } from '../app-skeleton.js';
import './retro-manager.js';
import './retro-carryover.js';
import './retro-board.js';
import './retro-actions.js';
import { RETRO_FORMATS } from '../../tools/retro/domain/formats.js';
import { listRetros, listRetrosBySquads } from '../../lib/retros.js';

export class RetroApp extends LitElement {
  static properties = {
    uid: { attribute: false },
    leaderUid: { attribute: false },
    squadIds: { attribute: false },
    members: { attribute: false },
    canManage: { attribute: false },
    _selected: { state: true },
    _retros: { state: true },
    _loading: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; --teal: var(--rm-accent, #2a9d8f); --navy: var(--gr-navy, #1e3a5f); }
    .detail { display: flex; flex-direction: column; gap: 1.4rem; }
    .back { align-self: flex-start; border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-text, #1e3a5f); border-radius: 8px; padding: 0.4rem 0.8rem; font: inherit; font-size: 0.82rem; font-weight: 600; cursor: pointer; }
    .back:hover { border-color: var(--teal); color: var(--rm-accent-700, var(--teal)); }
    .lead { margin: 0 0 1rem; color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { text-align: left; padding: 0.55rem 0.5rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #5b6b7d); font-weight: 600; font-size: 0.78rem; }
    .chip { display: inline-block; font-size: 0.7rem; font-weight: 700; padding: 0.1rem 0.5rem; border-radius: 999px; }
    .chip.open { background: color-mix(in srgb, var(--teal) 16%, transparent); color: var(--rm-accent-700, var(--teal)); }
    .chip.closed { background: var(--rm-surface-hover, #eef3f5); color: var(--rm-muted, #5b6b7d); }
    .act { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-text, #1e3a5f); border-radius: 8px; padding: 0.25rem 0.7rem; font: inherit; font-size: 0.78rem; font-weight: 600; cursor: pointer; }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.88rem; padding: 0.5rem 0; }
  `;

  constructor() {
    super();
    this.uid = null;
    this.leaderUid = null;
    /** @type {string[]} squads a los que pertenece (una persona puede estar en varios) */
    this.squadIds = [];
    this.members = [];
    this.canManage = false;
    this._selected = null;
    this._retros = [];
    this._loading = false;
    this._error = '';
    this._loadedFor = null;
  }

  /**
   * De dónde salen las retros de esta persona: su manager y sus squads. Cadena
   * vacía = no hay ninguna fuente, así que no hay nada que pedir.
   *
   * Se mira TAMBIÉN el squad (RMR-BUG-0049): antes solo se cargaba si había
   * manager, así que quien tenía squad pero no `ownerLeaderUid` se quedaba sin
   * ver ni una retro. Y como la clave incluye los squads, si estos llegan
   * después que el manager la lista se recalcula en vez de quedarse corta.
   */
  get _sourcesKey() {
    // Ordenados para que reordenar los mismos squads no cuente como cambio.
    const squads = [...(this.squadIds ?? [])].toSorted((a, b) => String(a).localeCompare(String(b))).join(',');
    if (!this.leaderUid && !squads) return '';
    return `${this.leaderUid ?? ''}|${squads}`;
  }

  updated(changed) {
    // El ingeniero necesita la lista (el manager la trae dentro de retro-manager).
    if (this.canManage) return;
    if (!changed.has('leaderUid') && !changed.has('squadIds') && !changed.has('canManage')) return;
    const key = this._sourcesKey;
    if (!key || key === this._loadedFor) return;
    this._loadedFor = key;
    this._loadList();
  }

  async _loadList() {
    this._loading = true;
    this._error = '';
    try {
      // Las retros de un squad puede haberlas creado OTRO manager, así que no
      // salen por ownerLeaderUid: se unen ambas fuentes y se deduplica por id
      // (una retro de mi squad creada por mi manager saldría dos veces).
      const [mine, ofSquads] = await Promise.all([
        this.leaderUid ? listRetros(this.leaderUid) : Promise.resolve([]),
        listRetrosBySquads(this.squadIds ?? []).catch(() => []),
      ]);
      const byId = new Map([...mine, ...ofSquads].map((r) => [r.id, r]));
      this._retros = [...byId.values()].toSorted(
        (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0),
      );
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar las retros.';
    } finally {
      this._loading = false;
    }
  }

  _select(retro) { this._selected = retro; }
  _backToList() { this._selected = null; }

  _renderDetail() {
    const r = this._selected;
    return html`
      <div class="detail">
        <button class="back" @click=${() => this._backToList()}>← Volver a las retros</button>
        <retro-carryover .retroId=${r.id} .uid=${this.uid} .leaderUid=${r.ownerLeaderUid} .scope=${r.scope} .members=${this.members}></retro-carryover>
        <retro-board .retroId=${r.id} .uid=${this.uid} .members=${this.members ?? []}></retro-board>
      </div>`;
  }

  _renderEngineerList() {
    if (this._loading) return skeletonLines(4);
    if (this._error) return html`<p class="empty">${this._error}</p>`;
    if (!this._retros.length) return html`<p class="empty">Tu equipo aún no tiene retros.</p>`;
    return html`
      <p class="lead">Retros de tu equipo. Ábrela para aportar tus notas, votar y ver las acciones.</p>
      <table>
        <thead><tr><th>Nombre</th><th>Formato</th><th>Estado</th><th></th></tr></thead>
        <tbody>${this._retros.map((r) => html`<tr>
          <td>${r.name}</td>
          <td>${RETRO_FORMATS[r.format]?.name ?? r.format}</td>
          <td><span class="chip ${r.status === 'open' ? 'open' : 'closed'}">${r.status === 'open' ? 'Abierta' : 'Cerrada'}</span></td>
          <td><button class="act" @click=${() => this._select(r)}>Abrir</button></td>
        </tr>`)}</tbody>
      </table>`;
  }

  render() {
    if (this._selected) return this._renderDetail();
    if (this.canManage) {
      return html`<retro-manager .uid=${this.leaderUid} @retro-select=${(e) => this._select(e.detail.retro)}></retro-manager>`;
    }
    return this._renderEngineerList();
  }
}

if (!customElements.get('retro-app')) {
  customElements.define('retro-app', RetroApp);
}
