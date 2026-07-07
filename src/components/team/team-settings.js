/**
 * <team-settings>
 * Sección Ajustes: catálogo de áreas de conocimiento (CRUD por owner) y
 * configuración de la organización (cadencia de los avisos de silencio y umbral
 * de bus factor). El estado de almacenamiento de ficheros se muestra de forma
 * informativa (OFF por defecto en el MVP).
 *
 * Propiedades:
 *  - persistence: PersistencePort (inyectado por <team-app>)
 */
import { LitElement, html, css } from 'lit';
import {
  listAreas,
  addArea,
  removeArea,
  renameArea,
  getSettings,
  updateSettings,
  listGuilds,
  addGuild,
  removeGuild,
  renameGuild,
  listLabels,
  addLabel,
  removeLabel,
  renameLabel,
} from '../../tools/team/application/usecases/index.js';
import { LEVELS } from '../../tools/team/domain/levels.js';

/**
 * Sub-pestañas de la sección Ajustes. El orden define el recorrido con las
 * flechas del teclado y el primer elemento (`areas`) es el activo por defecto.
 * @type {ReadonlyArray<{ id: string, label: string }>}
 */
const SUBTABS = [
  { id: 'areas', label: 'Áreas de conocimiento' },
  { id: 'gremios', label: 'Gremios' },
  { id: 'labels', label: 'Labels' },
  { id: 'cadencia', label: 'Cadencia y riesgo' },
  { id: 'ficheros', label: 'Ficheros' },
];

export class TeamSettings extends LitElement {
  static properties = {
    persistence: { attribute: false },
    currentUid: { attribute: false },
    isAdmin: { attribute: false },
    areas: { state: true },
    guilds: { state: true },
    labels: { state: true },
    settings: { state: true },
    loading: { state: true },
    error: { state: true },
    _newArea: { state: true },
    _confirmArea: { state: true },
    _newGuild: { state: true },
    _confirmGuild: { state: true },
    _newLabel: { state: true },
    _confirmLabel: { state: true },
    _editingId: { state: true },
    _editName: { state: true },
    _subtab: { state: true },
  };

  static styles = css`
    :host { display: block; }
    section {
      background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px); padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;
    }
    h2 { font-size: 1.05rem; margin: 0 0 1rem; }
    .row { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    input, select {
      border: 1px solid var(--rm-border, #d1d5db); border-radius: 8px; padding: 0.5rem 0.6rem;
      font: inherit; font-size: 0.9rem; background: var(--rm-surface, #fff); color: var(--rm-text, #111827);
    }
    label.fld { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.78rem; color: var(--rm-muted, #6b7280); font-weight: 600; }
    button { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); border-radius: 8px; padding: 0.45rem 0.9rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
    button.primary { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    ul.areas { list-style: none; margin: 0 0 1rem; padding: 0; }
    ul.areas li { display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    ul.areas .name { flex: 1; }
    ul.areas .edit-inline { flex: 1; }
    .link { border: 0; background: none; cursor: pointer; font-weight: 700; font-size: 0.8rem; color: var(--rm-muted, #6b7280); padding: 0 0.2rem; }
    .link.yes { color: var(--rm-danger, #dc2626); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
    .hint { font-size: 0.78rem; color: var(--rm-muted, #9ca3af); margin: 0.5rem 0 0; }
    .empty { color: var(--rm-muted, #9ca3af); font-size: 0.85rem; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    .feat { font-size: 0.85rem; color: var(--rm-muted, #6b7280); }
    .badge { display: inline-block; padding: 0.1rem 0.55rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700; background: var(--rm-track, #e9f0f2); }

    /* ── Barra de sub-pestañas (patrón ARIA tablist, coherente con otros tools) ── */
    .tabs { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .tab {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-muted, #6b7280);
      border-radius: 999px; padding: 0.4rem 1rem; font: inherit; font-size: 0.88rem; font-weight: 600; cursor: pointer;
    }
    .tab.active { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    .tab:hover:not(.active) { color: var(--rm-text, #111827); }
    .tab:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .subpanel:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; border-radius: var(--rm-radius, 12px); }

    /* ── Interruptor accesible (checkbox nativo oculto + pista visual) ── */
    .switch { display: inline-flex; align-items: center; gap: 0.6rem; cursor: pointer; font-size: 0.9rem; color: var(--rm-text, #111827); }
    .switch input { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .switch-track { position: relative; flex: none; width: 42px; height: 24px; border-radius: 999px; background: var(--rm-border, #d1d5db); transition: background 0.15s ease; }
    .switch-thumb { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); transition: transform 0.15s ease; }
    .switch input:checked + .switch-track { background: var(--rm-accent, #2a9d8f); }
    .switch input:checked + .switch-track .switch-thumb { transform: translateX(18px); }
    .switch input:focus-visible + .switch-track { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) {
      .switch-track, .switch-thumb { transition: none; }
    }
    .warn { font-size: 0.8rem; color: var(--rm-coral, #c2410c); background: var(--rm-track, #fdf2f0); border: 1px solid var(--rm-coral, #f2887a); border-radius: 8px; padding: 0.55rem 0.7rem; margin: 0.7rem 0 0; }
    .warn strong { color: inherit; }
  `;

  constructor() {
    super();
    this.persistence = null;
    /** @type {string|null} uid del líder en sesión (para distinguir sus roles personales) */
    this.currentUid = null;
    /** @type {boolean} el superadmin puede editar/borrar los catálogos GLOBALES */
    this.isAdmin = false;
    /** @type {import('../../tools/team/domain/types.js').Area[]} */
    this.areas = [];
    /** @type {import('../../tools/team/domain/types.js').Guild[]} */
    this.guilds = [];
    /** @type {import('../../tools/team/domain/types.js').Label[]} */
    this.labels = [];
    /** @type {import('../../tools/team/domain/types.js').OrgSettings|null} */
    this.settings = null;
    this.loading = true;
    this.error = '';
    this._newArea = '';
    /** @type {string|null} */
    this._confirmArea = null;
    this._newGuild = '';
    /** @type {string|null} */
    this._confirmGuild = null;
    this._newLabel = '';
    /** @type {string|null} */
    this._confirmLabel = null;
    /** @type {string|null} id del ítem de catálogo en edición inline (renombrar) */
    this._editingId = null;
    /** @type {string} nombre en edición */
    this._editName = '';
    /** @type {string} sub-pestaña activa (estado local, no usa el hash de la URL) */
    this._subtab = 'areas';
    this._loaded = false;
  }

  updated() {
    if (this.persistence && !this._loaded) {
      this._loaded = true;
      this._load();
    }
  }

  async _load() {
    this.loading = true;
    this.error = '';
    try {
      const [areas, guilds, labels, settings] = await Promise.all([
        listAreas(this.persistence),
        listGuilds(this.persistence),
        listLabels(this.persistence),
        getSettings(this.persistence),
      ]);
      this.areas = areas;
      this.guilds = guilds;
      this.labels = labels;
      this.settings = settings;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo cargar la configuración.';
    } finally {
      this.loading = false;
    }
  }

  async _addArea() {
    const name = this._newArea.trim();
    if (!name) return;
    this.error = '';
    try {
      await addArea(this.persistence, name);
      this._newArea = '';
      this.areas = await listAreas(this.persistence);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo añadir el área.';
    }
  }

  async _removeArea(id) {
    this._confirmArea = null;
    this.error = '';
    try {
      await removeArea(this.persistence, id);
      this.areas = await listAreas(this.persistence);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo eliminar el área.';
    }
  }

  async _addGuild() {
    const name = this._newGuild.trim();
    if (!name) return;
    this.error = '';
    try {
      await addGuild(this.persistence, name);
      this._newGuild = '';
      this.guilds = await listGuilds(this.persistence);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo añadir el gremio.';
    }
  }

  /** @param {string} id */
  async _removeGuild(id) {
    this._confirmGuild = null;
    this.error = '';
    try {
      await removeGuild(this.persistence, id);
      this.guilds = await listGuilds(this.persistence);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo eliminar el gremio.';
    }
  }

  async _addLabel() {
    const name = this._newLabel.trim();
    if (!name) return;
    this.error = '';
    try {
      await addLabel(this.persistence, name);
      this._newLabel = '';
      this.labels = await listLabels(this.persistence);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo añadir el label.';
    }
  }

  /** @param {string} id */
  async _removeLabel(id) {
    this._confirmLabel = null;
    this.error = '';
    try {
      await removeLabel(this.persistence, id);
      this.labels = await listLabels(this.persistence);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo eliminar el label.';
    }
  }

  async _saveSetting(patch) {
    this.error = '';
    try {
      await updateSettings(this.persistence, patch);
      this.settings = await getSettings(this.persistence);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo guardar la configuración.';
    }
  }

  /**
   * Activa/desactiva el almacenamiento de ficheros propagando el mapa `features`
   * completo, para no pisar otras claves que pudieran existir en él.
   * @param {boolean} enabled  nuevo valor del flag `features.fileStorage`
   * @returns {Promise<void>}
   */
  async _toggleFileStorage(enabled) {
    const s = this.settings ?? {};
    await this._saveSetting({ features: { ...(s.features ?? {}), fileStorage: enabled } });
  }

  /**
   * Navegación por teclado de la barra de sub-pestañas (patrón ARIA tablist con
   * activación automática): ←/→ recorren las pestañas de forma circular y
   * Home/End saltan a la primera/última, moviendo el foco a la nueva pestaña.
   * @param {KeyboardEvent} e
   * @returns {void}
   */
  _onSubtabsKeydown(e) {
    const ids = SUBTABS.map((t) => t.id);
    const i = ids.indexOf(this._subtab);
    let next = i;
    if (e.key === 'ArrowLeft') next = (i - 1 + ids.length) % ids.length;
    else if (e.key === 'ArrowRight') next = (i + 1) % ids.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ids.length - 1;
    else return;
    e.preventDefault();
    this._subtab = ids[next];
    // Tras el re-render, mueve el foco a la sub-pestaña recién activada.
    this.updateComplete.then(() => {
      /** @type {HTMLElement|null} */ (this.renderRoot.querySelector(`#subtab-${this._subtab}`))?.focus();
    });
  }

  /**
   * Barra de sub-pestañas accesible (tablist con roving tabindex): solo la
   * pestaña activa es tabulable; las flechas mueven el foco y la selección.
   * @returns {import('lit').TemplateResult}
   */
  _renderSubtabs() {
    return html`
      <div class="tabs" role="tablist" aria-label="Secciones de ajustes" @keydown=${this._onSubtabsKeydown}>
        ${SUBTABS.map((t) => {
          const selected = this._subtab === t.id;
          return html`
            <button
              id="subtab-${t.id}"
              class="tab ${selected ? 'active' : ''}"
              type="button"
              role="tab"
              aria-selected=${selected ? 'true' : 'false'}
              aria-controls="subpanel-${t.id}"
              tabindex=${selected ? '0' : '-1'}
              @click=${() => { this._subtab = t.id; }}
            >${t.label}</button>
          `;
        })}
      </div>
    `;
  }

  render() {
    if (this.loading) return html`<p class="empty">Cargando…</p>`;
    const active = this._subtab;
    const panel = {
      areas: () => this._renderAreas(),
      gremios: () => this._renderGuilds(),
      labels: () => this._renderLabels(),
      cadencia: () => this._renderCadencia(),
      ficheros: () => this._renderFicheros(),
    }[active] ?? (() => this._renderAreas());
    return html`
      ${this.error ? html`<p class="error">${this.error}</p>` : null}
      ${this._renderSubtabs()}
      <div
        id="subpanel-${active}"
        class="subpanel"
        role="tabpanel"
        aria-labelledby="subtab-${active}"
        tabindex="0"
      >
        ${panel()}
      </div>
    `;
  }

  /** Fija la confirmación de borrado del catálogo `kind`. @param {'area'|'guild'|'label'} kind @param {string|null} id */
  _setConfirm(kind, id) {
    if (kind === 'area') this._confirmArea = id;
    else if (kind === 'guild') this._confirmGuild = id;
    else this._confirmLabel = id;
  }

  /** Borra el ítem del catálogo `kind`. @param {'area'|'guild'|'label'} kind @param {string} id */
  _confirmRemove(kind, id) {
    if (kind === 'area') return this._removeArea(id);
    if (kind === 'guild') return this._removeGuild(id);
    return this._removeLabel(id);
  }

  /** Guarda el renombrado del ítem en edición (con cascada a personas en gremios/labels).
   * @param {'area'|'guild'|'label'} kind @param {string} id */
  async _saveRename(kind, id) {
    const name = this._editName.trim();
    if (!name) return;
    this.error = '';
    try {
      if (kind === 'area') await renameArea(this.persistence, id, name);
      else if (kind === 'guild') await renameGuild(this.persistence, id, name);
      else await renameLabel(this.persistence, id, name);
      this._editingId = null;
      await this._load();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo renombrar.';
    }
  }

  /**
   * Un ítem de catálogo (área/gremio/label) con Editar + Eliminar. Los GLOBALES
   * (sin ownerLeaderUid) solo los gestiona el superadmin; los personales, su
   * líder dueño. @param {{id:string,name:string,ownerLeaderUid?:string}} item
   * @param {'area'|'guild'|'label'} kind @param {string|null} confirmId
   */
  _renderCatalogItem(item, kind, confirmId) {
    const isGlobal = !item.ownerLeaderUid;
    const canManage = isGlobal ? this.isAdmin : true;
    if (this._editingId === item.id) {
      return html`<li>
        <input
          class="edit-inline"
          type="text"
          .value=${this._editName}
          @input=${(e) => { this._editName = e.target.value; }}
          @keydown=${(e) => {
            if (e.key === 'Enter') { e.preventDefault(); this._saveRename(kind, item.id); }
            else if (e.key === 'Escape') { this._editingId = null; }
          }}
        />
        <button class="link yes" @click=${() => this._saveRename(kind, item.id)}>Guardar</button>
        <button class="link" @click=${() => { this._editingId = null; }}>Cancelar</button>
      </li>`;
    }
    return html`<li>
      <span class="name">${item.name}</span>
      ${isGlobal ? html`<span class="badge">Global</span>` : null}
      ${canManage ? this._renderItemActions(kind, item, confirmId) : null}
    </li>`;
  }

  /** Acciones Editar + Eliminar de un ítem de catálogo. */
  _renderItemActions(kind, item, confirmId) {
    return html`
      <button class="link" @click=${() => { this._editingId = item.id; this._editName = item.name; }}>Editar</button>
      ${this._renderDeleteControl(kind, item.id, confirmId)}
    `;
  }

  /** Botón Eliminar o su confirmación en línea (early-return, sin anidar). */
  _renderDeleteControl(kind, id, confirmId) {
    if (confirmId === id) {
      return html`<span>¿Eliminar?
        <button class="link yes" @click=${() => this._confirmRemove(kind, id)}>Sí</button>
        <button class="link" @click=${() => this._setConfirm(kind, null)}>No</button>
      </span>`;
    }
    return html`<button class="link" @click=${() => this._setConfirm(kind, id)}>Eliminar</button>`;
  }

  /**
   * Sub-pestaña «Áreas de conocimiento»: catálogo de áreas técnicas (CRUD).
   * @returns {import('lit').TemplateResult}
   */
  _renderAreas() {
    return html`
      <section>
        <h2>Áreas de conocimiento</h2>
        <p class="hint">
          Unidad de dominio sobre la que mides el nivel (1–7) de cada persona y calculas el
          <em>bus factor</em> (el riesgo si el experto se va). Ejemplos: Arquitectura, Frontend,
          Infra/Cloud, Backend de pagos, Base de datos. Las <strong>globales</strong> las define
          la organización y las ve todo el mundo; las que crees aquí son <strong>tuyas</strong>.
        </p>
        ${this.areas.length === 0
          ? html`<p class="empty">Aún no hay áreas. Crea las áreas técnicas de tu equipo.</p>`
          : html`
              <ul class="areas">
                ${this.areas.map((a) => this._renderCatalogItem(a, 'area', this._confirmArea))}
              </ul>
            `}
        <div class="row">
          <input
            type="text"
            placeholder="Nueva área (p. ej. Pagos)"
            .value=${this._newArea}
            @input=${(e) => { this._newArea = e.target.value; }}
            @keydown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); this._addArea(); } }}
          />
          <button class="primary" @click=${this._addArea}>Añadir área</button>
        </div>
      </section>
    `;
  }

  /**
   * Sub-pestaña «Gremios»: gremios de la organización y los propios del líder.
   * @returns {import('lit').TemplateResult}
   */
  _renderGuilds() {
    return html`
      <section>
        <h2>Gremios</h2>
        <p class="hint">
          Tecnología o stack como etiqueta transversal: no se mide nivel, solo se asigna a la
          persona. Ejemplos: JavaScript, PHP, Python, Kubernetes, React. Los <strong>globales</strong>
          los define la organización y los ve todo el mundo; los que crees aquí son <strong>tuyos</strong>.
        </p>
        ${this.guilds.length === 0
          ? html`<p class="empty">Aún no hay gremios. Crea los gremios (PHP, Python, Android, iOS…) de tu equipo.</p>`
          : html`
              <ul class="areas">
                ${this.guilds.map((r) => this._renderCatalogItem(r, 'guild', this._confirmGuild))}
              </ul>
            `}
        <div class="row">
          <input
            type="text"
            placeholder="Nuevo gremio (p. ej. Python)"
            .value=${this._newGuild}
            @input=${(e) => { this._newGuild = e.target.value; }}
            @keydown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); this._addGuild(); } }}
          />
          <button class="primary" @click=${this._addGuild}>Añadir gremio</button>
        </div>
      </section>
    `;
  }

  /**
   * Sub-pestaña «Labels»: etiquetas libres (globales y propias del líder).
   * @returns {import('lit').TemplateResult}
   */
  _renderLabels() {
    return html`
      <section>
        <h2>Labels</h2>
        <p class="hint">
          Etiqueta libre para agrupar personas, por ejemplo por equipo o squad. Ejemplos:
          Equipo Web, Squad Pagos, Guardia. Las <strong>globales</strong> las define la
          organización; las que crees aquí son <strong>tuyas</strong>.
        </p>
        ${this.labels.length === 0
          ? html`<p class="empty">Aún no hay labels. Crea los que necesites para agrupar a tu equipo.</p>`
          : html`
              <ul class="areas">
                ${this.labels.map((l) => this._renderCatalogItem(l, 'label', this._confirmLabel))}
              </ul>
            `}
        <div class="row">
          <input
            type="text"
            placeholder="Nuevo label (p. ej. Gremio Frontend)"
            .value=${this._newLabel}
            @input=${(e) => { this._newLabel = e.target.value; }}
            @keydown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); this._addLabel(); } }}
          />
          <button class="primary" @click=${this._addLabel}>Añadir label</button>
        </div>
      </section>
    `;
  }

  /**
   * Sub-pestaña «Cadencia y riesgo»: cadencia de avisos y umbral de bus factor.
   * @returns {import('lit').TemplateResult}
   */
  _renderCadencia() {
    const s = this.settings ?? {};
    return html`
      <section>
        <h2>Cadencia y riesgo</h2>
        <div class="grid">
          <label class="fld">Cadencia de seguimiento (días)
            <input
              type="number"
              min="1"
              .value=${String(s.cadenceDays ?? '')}
              @change=${(e) => this._saveSetting({ cadenceDays: Number(e.target.value) })}
            />
          </label>
          <label class="fld">Umbral de dominio para bus factor
            <select @change=${(e) => this._saveSetting({ busFactorMinLevel: Number(e.target.value) })}>
              ${LEVELS.map(
                (l) => html`<option value=${l.order} ?selected=${l.order === s.busFactorMinLevel}>${l.order}. ${l.name}</option>`,
              )}
            </select>
          </label>
        </div>
        <p class="hint">
          La cadencia define cuándo una persona aparece en avisos de silencio. El umbral es el nivel
          mínimo para considerar que alguien “cubre” un área en el cálculo de bus factor.
        </p>
      </section>
    `;
  }

  /**
   * Sub-pestaña «Ficheros»: interruptor real del flag `features.fileStorage`.
   * @returns {import('lit').TemplateResult}
   */
  _renderFicheros() {
    const s = this.settings ?? {};
    const enabled = !!s.features?.fileStorage;
    return html`
      <section>
        <h2>Almacenamiento de ficheros</h2>
        <label class="switch">
          <input
            type="checkbox"
            role="switch"
            .checked=${enabled}
            aria-describedby="fs-warn"
            @change=${(e) => this._toggleFileStorage(e.target.checked)}
          />
          <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
          <span>Almacenamiento de audio: <strong>${enabled ? 'Activado' : 'Desactivado'}</strong></span>
        </label>
        <p class="hint">Permite adjuntar audios a las notas de seguimiento. Puedes activarlo o desactivarlo en cualquier momento.</p>
        <p id="fs-warn" class="warn">
          <strong>Aviso:</strong> activar esta opción requiere tener <strong>Firebase Storage configurado</strong>
          (bucket creado y reglas de seguridad publicadas). Si no lo está, las subidas de audio fallarán.
        </p>
      </section>
    `;
  }
}

if (!customElements.get('team-settings')) {
  customElements.define('team-settings', TeamSettings);
}
