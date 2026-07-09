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
import { getSettings, updateSettings } from '../../tools/team/application/usecases/index.js';
import { LEVELS } from '../../tools/team/domain/levels.js';
import '../catalog-manager.js';

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
    settings: { state: true },
    loading: { state: true },
    error: { state: true },
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
    /** @type {import('../../tools/team/domain/types.js').OrgSettings|null} */
    this.settings = null;
    this.loading = true;
    this.error = '';
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
      // Los catálogos (áreas/gremios/labels) los carga y gestiona <catalog-manager>;
      // aquí solo se cargan los ajustes de la organización.
      this.settings = await getSettings(this.persistence);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo cargar la configuración.';
    } finally {
      this.loading = false;
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

  /** Sección de un catálogo (áreas/gremios/labels): hint + el componente único. */
  _renderCatalogSection(kind, heading, hint, placeholder) {
    return html`
      <section>
        <h2>${heading}</h2>
        <p class="hint">${hint}</p>
        <catalog-manager
          .kind=${kind}
          .placeholder=${placeholder}
          .persistence=${this.persistence}
          .isAdmin=${this.isAdmin}
          .currentUid=${this.currentUid}
          .withMeta=${kind === 'labels'}
        ></catalog-manager>
      </section>
    `;
  }

  _renderAreas() {
    return this._renderCatalogSection(
      'areas',
      'Áreas de conocimiento',
      html`Unidad de dominio sobre la que mides el nivel (1–7) de cada persona y calculas el
        <em>bus factor</em> (el riesgo si el experto se va). Ejemplos: Arquitectura, Frontend,
        Infra/Cloud, Backend de pagos, Base de datos. Las <strong>globales</strong> las define
        la organización; las que crees aquí son <strong>tuyas</strong>.`,
      'Nueva área (p. ej. Pagos)',
    );
  }

  _renderGuilds() {
    return this._renderCatalogSection(
      'guilds',
      'Gremios',
      html`Tecnología o stack como etiqueta transversal: no se mide nivel, solo se asigna a la
        persona. Ejemplos: JavaScript, PHP, Python, Kubernetes, React. Los <strong>globales</strong>
        los define la organización; los que crees aquí son <strong>tuyos</strong>.`,
      'Nuevo gremio (p. ej. Python)',
    );
  }

  _renderLabels() {
    return this._renderCatalogSection(
      'labels',
      'Labels',
      html`Etiqueta libre para agrupar personas, por ejemplo por equipo o squad. Ejemplos:
        Equipo Web, Squad Pagos, Guardia. Las <strong>globales</strong> las define la
        organización; las que crees aquí son <strong>tuyas</strong>.`,
      'Nuevo label (p. ej. Squad Pagos)',
    );
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
