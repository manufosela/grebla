/**
 * <retro-manager> — gestión de retrospectivas del manager (RMR-TSK-0243). Crea una
 * retro (formato, nombre/sprint, ámbito equipo o squad) y lista las suyas con su
 * estado, pudiendo cerrarlas. Abrir una retro para facilitar/ver el tablero es del
 * componente <retro-board> (card 3); aquí solo se gestiona.
 *
 * Props: uid (del manager, lo inyecta el glue de cliente).
 */
import { LitElement, html, css } from 'lit';
import '../common/busy-overlay.js';
import { skeletonLines } from '../app-skeleton.js';
import { RETRO_FORMATS, RETRO_FORMAT_IDS } from '../../tools/retro/domain/formats.js';
import { createRetro, leaveRetro, listRetros, closeRetro, deleteRetro } from '../../lib/retros.js';
import { listSquadsCatalog } from '../../lib/squads.js';

export class RetroManager extends LitElement {
  static properties = {
    uid: { attribute: false },
    chain: { attribute: false },
    scopeUids: { attribute: false },
    _retros: { state: true },
    _squads: { state: true },
    _copiedId: { state: true },
    _tab: { state: true },
    _confirmLeaveId: { state: true },
    _confirmDeleteId: { state: true },
    _new: { state: true },
    _loading: { state: true },
    _saving: { state: true },
    _error: { state: true },
  };

  static styles = css`
    .seg { display: inline-flex; background: var(--rm-surface-hover, #eef3f5); border: 1px solid var(--rm-border, #dde7ec); border-radius: 999px; padding: 0.25rem; gap: 0.2rem; margin-bottom: 1.3rem; }
    .seg button { border: 0; background: transparent; font: inherit; font-size: 0.85rem; font-weight: 600; color: var(--rm-muted, #5b6b7d); padding: 0.45rem 1.05rem; border-radius: 999px; cursor: pointer; }
    .seg button[aria-selected="true"] { background: var(--gr-teal, #2a9d8f); color: #0c1420; }
    .seg button:focus-visible { outline: 2px solid var(--gr-navy, #1e3a5f); outline-offset: 2px; }
    [hidden] { display: none; }
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
    .act.danger { color: var(--rm-danger, #dc2626); border-color: var(--rm-danger, #dc2626); }
    /* Confirmación en línea del borrado (RMR-TSK-0280): mismo patrón que en
       los catálogos, sin modal para una acción de una fila. */
    .confirm { font-size: 0.78rem; color: var(--rm-muted, #5b6b7d); white-space: nowrap; }
    .confirm button { border: 0; background: none; cursor: pointer; font: inherit; font-weight: 700; font-size: 0.78rem; padding: 0 0.25rem; color: var(--rm-text, #1e3a5f); }
    .confirm .yes { color: var(--rm-danger, #dc2626); }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.88rem; padding: 0.5rem 0; }
  `;

  constructor() {
    super();
    this.uid = null;
    /** @type {string[]} cadena de managers de quien convoca, del espejo /leaders */
    this.chain = [];
    /**
     * Rama de un supermanager (RMR-TSK-0294): uids cuyos retros LISTA además de
     * los suyos. null = solo los suyos. Crear sigue siendo a nombre de `uid`.
     * @type {string[]|null}
     */
    this.scopeUids = null;
    this._retros = [];
    this._new = { format: 'ssc', name: '', sprint: '', scopeType: 'team', squadId: '' };
    /** @type {Array<{id:string,name:string}>} catálogo de squads (RMR-TSK-0278) */
    this._squads = [];
    /** id de la retro cuyo enlace se acaba de copiar (feedback efímero) */
    this._copiedId = null;
    /** Sub-pestaña activa: se entra por la lista, no por el formulario. */
    this._tab = 'list';
    /** @type {string|null} retro cuya salida se está confirmando */
    this._confirmLeaveId = null;
    /** id de la retro pendiente de confirmar borrado */
    this._confirmDeleteId = null;
    this._loading = false;
    this._saving = false;
    this._error = '';
    this._loadedFor = null;
  }

  /** Fuente de la lista: la rama del supermanager si la hay, o su propio uid. */
  get _scopeKey() {
    return this.scopeUids?.length ? this.scopeUids.join(',') : (this.uid ?? '');
  }

  updated(changed) {
    // La rama puede llegar DESPUÉS que el uid (hay que leer /leaders para
    // resolverla), así que también se recarga cuando cambia.
    if (!changed.has('uid') && !changed.has('scopeUids')) return;
    const key = this._scopeKey;
    if (!key || key === this._loadedFor) return;
    this._loadedFor = key;
    this._load();
  }

  async _load() {
    this._loading = true;
    this._error = '';
    try {
      const [retros, squads] = await Promise.all([
        // Por quien mira: las suyas y las de su rama (ADR «Retros por membresía»).
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
    // Antes el botón se quedaba deshabilitado sin decir por qué, y eso se lee
    // como «no tienes permiso» cuando lo único que falta es el nombre. Mejor
    // botón vivo y un aviso que diga qué falta.
    if (!n.name.trim()) {
      this._error = 'Ponle un nombre a la retro para poder crearla.';
      this.renderRoot?.querySelector('input[type="text"]')?.focus();
      return;
    }
    if (n.scopeType === 'squad' && !n.squadId) {
      this._error = 'Elige el squad de la retro.';
      return;
    }
    if (!this.uid) return;
    this._saving = true;
    this._error = '';
    try {
      await createRetro({
        format: n.format,
        name: n.name.trim(),
        sprint: n.sprint.trim() || null,
        ownerLeaderUid: this.uid,
        // Cadena de managers de quien convoca (ADR «Retros por membresía»): es
        // lo que hace que su rama vea la retro sin necesidad de invitación. Se
        // copia AL CREAR: si luego cambia de manager, la retro conserva la que
        // tenía, porque una retro es de su momento.
        chain: this.chain ?? [],
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

  /** Copia el enlace público de la retro (RMR-TSK-0279): quien lo abra y se
   *  logue con correo de tribbu puede participar aunque no sea de este equipo. */
  /** Borra la retro y sus notas. Las acciones se conservan (persisten entre
   *  retros por diseño), y así se le dice al usuario. */
  async _delete(retroId) {
    this._error = '';
    try {
      await deleteRetro(retroId);
      this._confirmDeleteId = null;
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo borrar la retro.';
    }
  }

  /** Salir de una retro: deja de estar dentro y desaparece de su listado. */
  async _leave(retroId) {
    this._error = '';
    try {
      await leaveRetro(retroId, this.uid);
      this._confirmLeaveId = null;
      await this._load();
    } catch {
      this._error = 'No se pudo salir de la retro.';
    }
  }

  async _copyLink(retroId) {
    // El enlace lleva el token: conocer el id no basta para entrar (ADR).
    const retro = this._retros?.find((r) => r.id === retroId);
    const token = retro?.joinToken ?? '';
    const url = `${location.origin}/retro?id=${encodeURIComponent(retroId)}`
      + (token ? `&join=${encodeURIComponent(token)}` : '');
    try {
      await navigator.clipboard.writeText(url);
      this._copiedId = retroId;
      setTimeout(() => { if (this._copiedId === retroId) this._copiedId = null; }, 2000);
    } catch {
      this._error = `No se pudo copiar. El enlace es: ${url}`;
    }
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
    // Gestionar la retro (cerrarla, borrarla) es de quien la convocó: las reglas
    // lo imponen, así que ofrecer el botón a los demás solo sirve para que les
    // falle al pulsarlo. Quien entra por el enlace participa, no gestiona.
    const esMia = retro.ownerLeaderUid === this.uid;
    return html`
      <tr>
        <td>${retro.name}</td>
        <td>${RETRO_FORMATS[retro.format]?.name ?? retro.format}</td>
        <td><span class="chip scope-chip">${this._scopeText(retro)}</span></td>
        <td><span class="chip ${open ? 'open' : 'closed'}">${open ? 'Abierta' : 'Cerrada'}</span></td>
        <td>
          <button class="act" @click=${() => this._open(retro)}>Abrir</button>
          <button class="act" title="Copiar el enlace para compartir la retro"
            @click=${() => this._copyLink(retro.id)}>${this._copiedId === retro.id ? '✓ Copiado' : 'Copiar enlace'}</button>
          ${open && esMia ? html`<button class="act" @click=${() => this._close(retro.id)}>Cerrar</button>` : null}
          ${esMia ? null : (this._confirmLeaveId === retro.id
            ? html`<span class="confirm">¿Salir? Dejarás de verla.
                <button class="yes" @click=${() => this._leave(retro.id)}>Sí</button>
                <button @click=${() => { this._confirmLeaveId = null; }}>No</button>
              </span>`
            : html`<button class="act" title="Salir de esta retro"
                @click=${() => { this._confirmLeaveId = retro.id; this._error = ''; }}>Salir</button>`)}
          ${!esMia ? null : (this._confirmDeleteId === retro.id
            ? html`<span class="confirm">¿Borrar la retro y sus notas?
                <button class="yes" @click=${() => this._delete(retro.id)}>Sí</button>
                <button @click=${() => { this._confirmDeleteId = null; }}>No</button>
              </span>`
            : html`<button class="act danger" @click=${() => { this._confirmDeleteId = retro.id; this._error = ''; }}>Borrar</button>`)}
        </td>
      </tr>
    `;
  }

  render() {
    return html`
      ${this._saving ? html`<busy-overlay message="Guardando la retro…"></busy-overlay>` : null}
      <p class="lead">Crea una retrospectiva y gestiónala. El equipo aporta desde su espacio (en anónimo hasta que reveles cada zona); de la retro salen acciones con owner que se arrastran a la siguiente.</p>

      <div class="seg" role="tablist" aria-label="Retros">
        <button role="tab" aria-selected=${this._tab === 'list'}
          @click=${() => { this._tab = 'list'; }}>Mis retros (${this._retros.length})</button>
        <button role="tab" aria-selected=${this._tab === 'new'}
          @click=${() => { this._tab = 'new'; }}>Nueva retro</button>
      </div>

      <div class="create" ?hidden=${this._tab !== 'new'}>
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
          <button class="btn" ?disabled=${this._saving} @click=${() => this._create()}>
            ${this._saving ? 'Creando…' : 'Crear retro'}
          </button>
          ${this._error ? html`<span class="error">${this._error}</span>` : null}
        </div>
      </div>

      <div ?hidden=${this._tab !== 'list'}>${this._renderList()}</div>
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
