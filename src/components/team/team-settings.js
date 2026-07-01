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
  getSettings,
  updateSettings,
  listGuilds,
  addGuild,
  removeGuild,
  listLabels,
  addLabel,
  removeLabel,
} from '../../tools/team/application/usecases/index.js';
import { LEVELS } from '../../tools/team/domain/levels.js';

export class TeamSettings extends LitElement {
  static properties = {
    persistence: { attribute: false },
    currentUid: { attribute: false },
    areas: { state: true },
    guilds: { state: true },
    settings: { state: true },
    loading: { state: true },
    error: { state: true },
    _newArea: { state: true },
    _confirmArea: { state: true },
    _newGuild: { state: true },
    _confirmGuild: { state: true },
    _newLabel: { state: true },
    _confirmLabel: { state: true },
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
    button.primary { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: #fff; }
    ul.areas { list-style: none; margin: 0 0 1rem; padding: 0; }
    ul.areas li { display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    ul.areas .name { flex: 1; }
    .link { border: 0; background: none; cursor: pointer; font-weight: 700; font-size: 0.8rem; color: var(--rm-muted, #6b7280); padding: 0 0.2rem; }
    .link.yes { color: var(--rm-danger, #dc2626); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
    .hint { font-size: 0.78rem; color: var(--rm-muted, #9ca3af); margin: 0.5rem 0 0; }
    .empty { color: var(--rm-muted, #9ca3af); font-size: 0.85rem; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    .feat { font-size: 0.85rem; color: var(--rm-muted, #6b7280); }
    .badge { display: inline-block; padding: 0.1rem 0.55rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700; background: var(--rm-track, #e9f0f2); }
  `;

  constructor() {
    super();
    this.persistence = null;
    /** @type {string|null} uid del líder en sesión (para distinguir sus roles personales) */
    this.currentUid = null;
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

  render() {
    if (this.loading) return html`<p class="empty">Cargando…</p>`;
    const s = this.settings ?? {};
    return html`
      ${this.error ? html`<p class="error">${this.error}</p>` : null}

      <section>
        <h2>Áreas de conocimiento</h2>
        ${this.areas.length === 0
          ? html`<p class="empty">Aún no hay áreas. Crea las áreas técnicas de tu equipo.</p>`
          : html`
              <ul class="areas">
                ${this.areas.map(
                  (a) => html`
                    <li>
                      <span class="name">${a.name}</span>
                      ${this._confirmArea === a.id
                        ? html`<span>¿Eliminar?
                            <button class="link yes" @click=${() => this._removeArea(a.id)}>Sí</button>
                            <button class="link" @click=${() => { this._confirmArea = null; }}>No</button>
                          </span>`
                        : html`<button class="link" @click=${() => { this._confirmArea = a.id; }}>Eliminar</button>`}
                    </li>
                  `,
                )}
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

      <section>
        <h2>Gremios</h2>
        <p class="hint">Gremios (tecnologías/stack, transversales a la disciplina). Los <strong>globales</strong> los define la organización y los ve todo el mundo; los que crees aquí son <strong>tuyos</strong>.</p>
        ${this.guilds.length === 0
          ? html`<p class="empty">Aún no hay gremios. Crea los gremios (PHP, Python, Android, iOS…) de tu equipo.</p>`
          : html`
              <ul class="areas">
                ${this.guilds.map((r) => {
                  const isGlobal = !r.ownerLeaderUid;
                  return html`
                    <li>
                      <span class="name">${r.name}</span>
                      ${isGlobal
                        ? html`<span class="badge">Global</span>`
                        : this._confirmGuild === r.id
                          ? html`<span>¿Eliminar?
                              <button class="link yes" @click=${() => this._removeGuild(r.id)}>Sí</button>
                              <button class="link" @click=${() => { this._confirmGuild = null; }}>No</button>
                            </span>`
                          : html`<button class="link" @click=${() => { this._confirmGuild = r.id; }}>Eliminar</button>`}
                    </li>
                  `;
                })}
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

      <section>
        <h2>Labels</h2>
        <p class="hint">Etiquetas libres para agrupar personas. Las <strong>globales</strong> las define la organización; las que crees aquí son <strong>tuyas</strong>.</p>
        ${this.labels.length === 0
          ? html`<p class="empty">Aún no hay labels. Crea los que necesites para agrupar a tu equipo.</p>`
          : html`
              <ul class="areas">
                ${this.labels.map((l) => {
                  const isGlobal = !l.ownerLeaderUid;
                  return html`
                    <li>
                      <span class="name">${l.name}</span>
                      ${isGlobal
                        ? html`<span class="badge">Global</span>`
                        : this._confirmLabel === l.id
                          ? html`<span>¿Eliminar?
                              <button class="link yes" @click=${() => this._removeLabel(l.id)}>Sí</button>
                              <button class="link" @click=${() => { this._confirmLabel = null; }}>No</button>
                            </span>`
                          : html`<button class="link" @click=${() => { this._confirmLabel = l.id; }}>Eliminar</button>`}
                    </li>
                  `;
                })}
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

      <section>
        <h2>Almacenamiento de ficheros</h2>
        <p class="feat">
          Estado: <span class="badge">${s.features?.fileStorage ? 'Activado' : 'Desactivado'}</span>
        </p>
        <p class="hint">En el MVP el almacenamiento de audio está desactivado por defecto. Se activará por configuración cuando esté disponible.</p>
      </section>
    `;
  }
}

if (!customElements.get('team-settings')) {
  customElements.define('team-settings', TeamSettings);
}
