/**
 * <retro-manager> — gestión de retrospectivas del manager (RMR-TSK-0243). Crea una
 * retro (formato, nombre/sprint, ámbito equipo o squad) y lista las suyas con su
 * estado, pudiendo cerrarlas. Abrir una retro para facilitar/ver el tablero es del
 * componente <retro-board> (card 3); aquí solo se gestiona.
 *
 * Props: uid (del manager, lo inyecta el glue de cliente).
 */
import { LitElement, html, css } from 'lit';
import { skeletonLines } from '../app-skeleton.js';
import { RETRO_FORMATS, RETRO_FORMAT_IDS } from '../../tools/retro/domain/formats.js';
import { createRetro, listRetros, closeRetro } from '../../lib/retros.js';
import { listSquadsCatalog } from '../../lib/squads.js';

export class RetroManager extends LitElement {
  static properties = {
    uid: { attribute: false },
    _retros: { state: true },
    _squads: { state: true },
    _new: { state: true },
    _loading: { state: true },
    _saving: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; --teal: var(--rm-accent, #2a9d8f); --navy: var(--gr-navy, #1e3a5f); }
    .lead { margin: 0 0 1rem; color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; }
    .create { border: 1px solid var(--rm-border, #dde7ec); border-radius: 14px; padding: 1rem 1.1rem; margin-bottom: 1.5rem; background: var(--rm-surface, #fff); }
    .create h3 { margin: 0 0 0.8rem; font-size: 1rem; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; }
    @media (max-width: 560px) { .grid { grid-template-columns: 1fr; } }
    label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.75rem; font-weight: 600; color: var(--rm-muted, #5b6b7d); }
    input, select { font: inherit; font-size: 0.9rem; padding: 0.5rem 0.6rem; border: 1px solid var(--rm-border, #dde7ec); border-radius: 9px; background: var(--rm-field, #eef2f6); color: var(--rm-text, #1e3a5f); }
    input:focus-visible, select:focus-visible { outline: 2px solid var(--teal); outline-offset: 1px; }
    .scope { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; font-size: 0.85rem; color: var(--rm-text, #1e3a5f); font-weight: 600; }
    .scope label { flex-direction: row; align-items: center; gap: 0.35rem; font-weight: 600; color: var(--rm-text, #1e3a5f); }
    .bar { display: flex; gap: 0.8rem; align-items: center; margin-top: 0.9rem; flex-wrap: wrap; }
    .btn { border: 0; background: var(--navy); color: var(--rm-on-accent, #fff); font: inherit; font-weight: 700; font-size: 0.88rem; padding: 0.6rem 1.1rem; border-radius: 10px; cursor: pointer; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn:hover:not(:disabled) { filter: brightness(1.08); }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }

    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { text-align: left; padding: 0.55rem 0.5rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #5b6b7d); font-weight: 600; font-size: 0.78rem; }
    .chip { display: inline-block; font-size: 0.7rem; font-weight: 700; padding: 0.1rem 0.5rem; border-radius: 999px; }
    .chip.open { background: color-mix(in srgb, var(--teal) 16%, transparent); color: var(--rm-accent-700, var(--teal)); }
    .chip.closed { background: var(--rm-surface-hover, #eef3f5); color: var(--rm-muted, #5b6b7d); }
    .scope-chip { background: color-mix(in srgb, var(--gr-coral, #f2887a) 16%, transparent); color: var(--gr-coral, #f2887a); }
    .act { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-text, #1e3a5f); border-radius: 8px; padding: 0.25rem 0.6rem; font: inherit; font-size: 0.78rem; font-weight: 600; cursor: pointer; }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.88rem; padding: 0.5rem 0; }
  `;

  constructor() {
    super();
    this.uid = null;
    this._retros = [];
    this._new = { format: 'ssc', name: '', sprint: '', scopeType: 'team', squadId: '' };
    /** @type {Array<{id:string,name:string}>} catálogo de squads (RMR-TSK-0278) */
    this._squads = [];
    this._loading = false;
    this._saving = false;
    this._error = '';
    this._loadedFor = null;
  }

  updated(changed) {
    if (changed.has('uid') && this.uid && this.uid !== this._loadedFor) {
      this._loadedFor = this.uid;
      this._load();
    }
  }

  async _load() {
    this._loading = true;
    this._error = '';
    try {
      const [retros, squads] = await Promise.all([
        listRetros(this.uid),
        listSquadsCatalog().catch(() => []),
      ]);
      this._retros = retros;
      this._squads = squads;
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar las retros.';
    } finally {
      this._loading = false;
    }
  }

  async _create() {
    const n = this._new;
    if (!n.name.trim() || !this.uid) return;
    this._saving = true;
    this._error = '';
    try {
      await createRetro({
        format: n.format,
        name: n.name.trim(),
        sprint: n.sprint.trim() || null,
        ownerLeaderUid: this.uid,
        scope: {
          type: n.scopeType,
          squadId: n.scopeType === 'squad' ? (n.squadId || null) : null,
          label: null,
        },
      });
      this._new = { format: n.format, name: '', sprint: '', scopeType: n.scopeType, squadId: n.squadId };
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo crear la retro.';
    } finally {
      this._saving = false;
    }
  }

  async _close(retroId) {
    this._error = '';
    try {
      await closeRetro(retroId);
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cerrar la retro.';
    }
  }

  _patch(key, value) { this._new = { ...this._new, [key]: value }; }

  /** Selector de squad del catálogo (RMR-TSK-0278): antes era texto libre, lo
   *  que hacía imposible cruzar la retro con el squad de las personas. */
  _renderSquadPicker() {
    if (this._squads.length === 0) {
      return html`<p class="hint">Aún no hay squads en el catálogo: los crea el superadmin en el panel.</p>`;
    }
    return html`<label>Squad
      <select .value=${this._new.squadId} @change=${(e) => this._patch('squadId', e.target.value)}>
        <option value="">— elige un squad —</option>
        ${this._squads.map((sq) => html`<option value=${sq.id} ?selected=${sq.id === this._new.squadId}>${sq.name}</option>`)}
      </select>
    </label>`;
  }

  _scopeText(retro) {
    if (retro.scope?.type !== 'squad') return 'Equipo';
    // Retros nuevas guardan squadId; las antiguas, el nombre como texto libre.
    const byId = this._squads.find((sq) => sq.id === retro.scope?.squadId)?.name;
    return `Squad · ${byId ?? retro.scope?.label ?? '—'}`;
  }

  _open(retro) {
    this.dispatchEvent(new CustomEvent('retro-select', { detail: { retro }, bubbles: true, composed: true }));
  }

  _renderRow(retro) {
    const open = retro.status === 'open';
    return html`
      <tr>
        <td>${retro.name}</td>
        <td>${RETRO_FORMATS[retro.format]?.name ?? retro.format}</td>
        <td><span class="chip scope-chip">${this._scopeText(retro)}</span></td>
        <td><span class="chip ${open ? 'open' : 'closed'}">${open ? 'Abierta' : 'Cerrada'}</span></td>
        <td>
          <button class="act" @click=${() => this._open(retro)}>Abrir</button>
          ${open ? html`<button class="act" @click=${() => this._close(retro.id)}>Cerrar</button>` : null}
        </td>
      </tr>
    `;
  }

  render() {
    return html`
      <p class="lead">Crea una retrospectiva y gestiónala. El equipo aporta en anónimo desde su espacio; de la retro salen acciones con owner que se arrastran a la siguiente.</p>

      <div class="create">
        <h3>Nueva retro</h3>
        <div class="grid">
          <label>Formato
            <select .value=${this._new.format} @change=${(e) => this._patch('format', e.target.value)}>
              ${RETRO_FORMAT_IDS.map((id) => html`<option value=${id} ?selected=${id === this._new.format}>${RETRO_FORMATS[id].name}</option>`)}
            </select>
          </label>
          <label>Nombre
            <input type="text" placeholder="p. ej. Retro Sprint 29" .value=${this._new.name} @input=${(e) => this._patch('name', e.target.value)} />
          </label>
          <label>Sprint (opcional)
            <input type="text" placeholder="Sprint 29" .value=${this._new.sprint} @input=${(e) => this._patch('sprint', e.target.value)} />
          </label>
          <label>Ámbito
            <span class="scope">
              <label><input type="radio" name="scope" ?checked=${this._new.scopeType === 'team'} @change=${() => this._patch('scopeType', 'team')} /> Equipo</label>
              <label><input type="radio" name="scope" ?checked=${this._new.scopeType === 'squad'} @change=${() => this._patch('scopeType', 'squad')} /> Squad</label>
            </span>
          </label>
          ${this._new.scopeType === 'squad' ? this._renderSquadPicker() : null}
        </div>
        <div class="bar">
          <button class="btn" ?disabled=${this._saving || !this._new.name.trim() || !this.uid || (this._new.scopeType === 'squad' && !this._new.squadId)} @click=${() => this._create()}>
            ${this._saving ? 'Creando…' : 'Crear retro'}
          </button>
          ${this._error ? html`<span class="error">${this._error}</span>` : null}
        </div>
      </div>

      <h3 style="font-size:1rem;margin:0 0 0.6rem">Mis retros (${this._retros.length})</h3>
      ${this._renderList()}
    `;
  }

  _renderList() {
    if (this._loading) return skeletonLines(4);
    if (this._retros.length === 0) return html`<p class="empty">Aún no has creado ninguna retro.</p>`;
    return html`<table>
        <thead><tr><th>Nombre</th><th>Formato</th><th>Ámbito</th><th>Estado</th><th></th></tr></thead>
        <tbody>${this._retros.map((r) => this._renderRow(r))}</tbody>
      </table>`;
  }
}

if (!customElements.get('retro-manager')) {
  customElements.define('retro-manager', RetroManager);
}
