/**
 * <role-questionnaire>
 * Cuestionario adaptativo. Muestra los ítems visibles según las condiciones de
 * ramificación, recalcula el perfil en cada cambio y persiste en Firestore con
 * debounce de 1s. Incluye el <role-result> con el perfil calculado.
 *
 * Propiedades (asignadas como propiedades JS desde la página Astro):
 *  - items:  import('../data/items.js').Item[]
 *  - roles:  import('../data/roles.js').Role[]
 *  - dimensions: { key: string, label: string }[]
 *  - orgConfig: import('../lib/scoring.js').OrgConfig|null
 *  - personId/leaderUid: string|null   (si null, modo local sin persistencia; el líder evalúa a la persona)
 *  - sessionId: string|null   (si null y hay uid, se crea una sesión)
 */
import { LitElement, html, css } from 'lit';
import './role-result.js';
import {
  computeProfile,
  computeRoleIdeal,
  computeGap,
  getVisibleItems,
} from '../lib/scoring.js';
import {
  debounce,
  saveSession,
  createSession,
  getSession,
  listSessions,
  upsertUserSummary,
} from '../lib/firestore.js';
import { isMeasurementStale, tsToMs, pickActiveMeasurement } from '../lib/measurement.js';
import { fillAnswersFromRole } from '../lib/roleTemplate.js';

export class RoleQuestionnaire extends LitElement {
  static properties = {
    items: { attribute: false },
    roles: { attribute: false },
    dimensions: { attribute: false },
    orgConfig: { attribute: false },
    tenantId: { attribute: false },
    personId: { attribute: false },
    leaderUid: { attribute: false },
    sessionId: { attribute: false },
    answers: { state: true },
    targetRole: { state: true },
    status: { state: true },
    error: { state: true },
  };

  static styles = css`
    :host {
      display: block;
      font-family: var(--rm-font, system-ui, sans-serif);
      color: var(--rm-text, #111827);
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 2rem;
      align-items: start;
    }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
    }
    .result { position: sticky; top: 1rem; }
    .progress {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
      font-size: 0.85rem;
      color: var(--rm-muted, #6b7280);
    }
    .progress-track {
      flex: 1;
      height: 8px;
      background: var(--rm-track, #f3f4f6);
      border-radius: 999px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: var(--rm-accent, #3b82f6);
      transition: width 0.3s ease;
    }
    .dim-group { margin-bottom: 1.5rem; }
    .dim-title {
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--rm-muted, #6b7280);
      margin: 0 0 0.5rem;
      padding-bottom: 0.25rem;
      border-bottom: 1px solid var(--rm-border, #eef0f2);
    }
    .item {
      padding: 0.85rem 0;
      border-bottom: 1px solid var(--rm-border, #f3f4f6);
    }
    .item-text { font-size: 0.95rem; margin-bottom: 0.5rem; display: block; }
    .checkbox { display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; }
    .yesno { display: inline-flex; gap: 0.4rem; }
    .yesno-btn {
      border: 1px solid var(--rm-border, #d1d5db);
      background: var(--rm-surface, #fff);
      color: var(--rm-muted, #6b7280);
      border-radius: 999px;
      padding: 0.35rem 1.25rem;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .yesno-btn:hover { border-color: var(--rm-accent, #4f46e5); color: var(--rm-text, #111827); }
    .yesno-btn.active {
      background: var(--rm-accent, #4f46e5);
      border-color: var(--rm-accent, #4f46e5);
      color: #fff;
    }
    .yesno-btn:focus-visible { outline: 2px solid var(--rm-accent, #4f46e5); outline-offset: 2px; }
    .scale { display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap; }
    .scale-ends { font-size: 0.75rem; color: var(--rm-muted, #9ca3af); }
    .scale fieldset { border: 0; padding: 0; margin: 0; display: inline-flex; gap: 0.25rem; }
    .scale label {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      font-size: 0.7rem;
      color: var(--rm-muted, #6b7280);
    }
    .scale .dot {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid var(--rm-border, #d1d5db);
      display: grid;
      place-items: center;
      font-size: 0.8rem;
      transition: all 0.15s ease;
    }
    .scale input { position: absolute; opacity: 0; width: 0; height: 0; }
    .scale input:checked + .dot {
      background: var(--rm-accent, #3b82f6);
      border-color: var(--rm-accent, #3b82f6);
      color: #fff;
    }
    .scale input:focus-visible + .dot { outline: 2px solid var(--rm-accent, #3b82f6); outline-offset: 2px; }
    .multi { display: grid; gap: 0.35rem; }
    .multi label { display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem; }
    .save-state { font-size: 0.78rem; color: var(--rm-muted, #9ca3af); }
    .template {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-bottom: 0.75rem;
      font-size: 0.85rem;
      color: var(--rm-muted, #6b7280);
    }
    .template select {
      padding: 0.35rem 0.6rem;
      border-radius: 8px;
      border: 1px solid var(--rm-border, #d1d5db);
      background: var(--rm-surface, #fff);
      color: var(--rm-text, #111827);
      font-size: 0.85rem;
    }
    .template-hint { font-size: 0.75rem; color: var(--rm-muted, #9ca3af); }
    .measurement {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-bottom: 1rem;
      font-size: 0.8rem;
      color: var(--rm-muted, #6b7280);
    }
    .measurement-new {
      border: 1px solid var(--rm-border, #d1d5db);
      background: var(--rm-surface, #fff);
      color: var(--rm-accent, #4f46e5);
      border-radius: 999px;
      padding: 0.3rem 0.9rem;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
    }
    .measurement-new:hover { border-color: var(--rm-accent, #4f46e5); }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; margin: 0.5rem 0; }
    .notice {
      background: var(--rm-surface-hover, #f3f4f6);
      border-radius: 8px;
      padding: 0.6rem 0.9rem;
      font-size: 0.85rem;
      color: var(--rm-muted, #4b5563);
      margin-bottom: 1rem;
    }
  `;

  constructor() {
    super();
    /** @type {import('../data/items.js').Item[]} */
    this.items = [];
    /** @type {import('../data/roles.js').Role[]} */
    this.roles = [];
    /** @type {{ key: string, label: string }[]} */
    this.dimensions = [];
    /** @type {import('../lib/scoring.js').OrgConfig|null} */
    this.orgConfig = null;
    /** @type {string|null} */
    this.tenantId = null;
    /** @type {string|null} persona evaluada (el líder rellena su perfil) */
    this.personId = null;
    /** @type {string|null} uid del líder dueño de la persona */
    this.leaderUid = null;
    /** @type {string|null} */
    this.sessionId = null;
    /** @type {import('../data/items.js').Answers} */
    this.answers = {};
    /** @type {string|null} */
    this.targetRole = null;
    /** @type {'idle'|'saving'|'saved'|'loading'} */
    this.status = 'idle';
    this.error = '';
    this._sessionInit = false;
    /** @type {number|null} Fecha (ms) de creación de la medición actual; para la cadencia. */
    this._measuredAtMs = null;
    this._save = debounce(() => this._persist(), 1000);
  }

  /** @param {Map<string, unknown>} changed */
  updated(changed) {
    // uid y tenantId pueden llegar de forma asíncrona tras resolverse auth+tenant.
    if (this.personId && this.leaderUid && this.tenantId && !this._sessionInit) {
      this._sessionInit = true;
      this._initSession();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._save.flush();
  }

  async _initSession() {
    this.status = 'loading';
    this.error = '';
    try {
      /** @type {object|null} */
      let session = null;
      if (this.sessionId) {
        session = await getSession(this.tenantId, this.leaderUid, this.personId, this.sessionId);
      } else {
        // Sin sesión en la URL: cargar la última medición CON contenido (RMR-BUG-0003).
        // Se ignoran las sesiones vacías (heredadas de versiones que creaban una
        // por cada entrada). NO se crea ninguna sesión aquí: la medición se crea
        // en el primer guardado real (ver _persist), para no generar vacías.
        const sessions = await listSessions(this.tenantId, this.leaderUid, this.personId);
        session = pickActiveMeasurement(sessions);
        if (session) {
          this.sessionId = session.id;
          this._emitSession(session.id);
        }
      }

      if (session) {
        this.answers = session.answers ?? {};
        this.targetRole = session.targetRole ?? null;
        this._measuredAtMs = tsToMs(session.createdAt);
      }
      // Si no hay medición con contenido, quedamos sin sesión: se creará al
      // primer cambio. Así nunca se persisten cuestionarios vacíos.
      this.status = 'idle';
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo cargar la sesión.';
      this.status = 'idle';
    }
  }

  /** Notifica el id de sesión activo para que la página lo refleje en la URL. */
  _emitSession(sessionId) {
    this.dispatchEvent(
      new CustomEvent('session-created', { detail: { sessionId }, bubbles: true, composed: true }),
    );
  }

  /** @returns {import('../lib/scoring.js').Profile} */
  get _profile() {
    return computeProfile({
      items: this.items,
      roles: this.roles,
      answers: this.answers,
      orgConfig: this.orgConfig ?? undefined,
    });
  }

  /** @param {import('../lib/scoring.js').Profile} profile */
  _gapFor(profile) {
    if (!this.targetRole) return null;
    const ideal = computeRoleIdeal(this.items, this.targetRole, this.orgConfig ?? undefined);
    return computeGap(profile.byDimension, ideal);
  }

  /**
   * @param {string} id
   * @param {boolean|number|string[]} value
   */
  _setAnswer(id, value) {
    this.answers = { ...this.answers, [id]: value };
    // Guarda aunque aún no exista sesión: _persist la crea en el primer cambio
    // real (evita sesiones vacías).
    if (this.personId) {
      this.status = 'saving';
      this._save();
    }
  }

  async _persist() {
    if (!this.personId || !this.leaderUid || !this.tenantId) return;
    try {
      // La medición se crea en el PRIMER guardado real (no al entrar) para no
      // generar sesiones vacías. Y si la medición actual superó la ventana
      // (90 días), el guardado crea un NUEVO punto del histórico en vez de
      // sobrescribir, preservando la evolución (cadencia trimestral).
      if (!this.sessionId || isMeasurementStale(this._measuredAtMs, Date.now())) {
        const id = await createSession(this.tenantId, this.leaderUid, this.personId, { answers: this.answers, targetRole: this.targetRole });
        this.sessionId = id;
        this._measuredAtMs = Date.now();
        this._emitSession(id);
      }

      const profile = this._profile;
      const affinities = Object.fromEntries(
        profile.affinities.map((a) => [a.key, Math.round(a.affinity)]),
      );
      await saveSession(this.tenantId, this.leaderUid, this.personId, this.sessionId, {
        answers: this.answers,
        targetRole: this.targetRole,
        dominantRole: profile.dominant?.key ?? null,
        completion: Math.round(profile.completion),
        orgPhase: this.orgConfig?.phase ?? null,
      });
      await upsertUserSummary(
        this.tenantId,
        this.leaderUid,
        this.personId,
        {
          dominantRole: profile.dominant?.key ?? null,
          completion: Math.round(profile.completion),
          affinities,
          lastSessionId: this.sessionId,
        },
      );
      this.status = 'saved';
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo guardar.';
      this.status = 'idle';
    }
  }

  _onTargetChanged(event) {
    this.targetRole = event.detail.targetRole;
    if (this.personId) {
      this.status = 'saving';
      this._save();
    }
  }

  render() {
    const visible = getVisibleItems(this.items, this.answers);
    const profile = this._profile;
    const gap = this._gapFor(profile);

    return html`
      <div class="layout">
        <div class="questions">
          ${this.personId
            ? null
            : html`<div class="notice">Estás en modo local: inicia sesión con Google para guardar tu progreso.</div>`}
          <div class="template">
            <label for="role-template">Empezar desde un rol:</label>
            <select id="role-template" @change=${this._applyRoleTemplate}>
              <option value="">— Autorrellenar según un rol —</option>
              ${this.roles.map((r) => html`<option value=${r.key}>${r.label}</option>`)}
            </select>
            <span class="template-hint">Rellena el cuestionario con el perfil tipo de ese rol; luego ajústalo.</span>
          </div>
          <div class="progress">
            <span class="progress-track">
              <span class="progress-fill" style=${`width:${profile.completion}%`}></span>
            </span>
            <span>${Math.round(profile.completion)}%</span>
            ${this._renderSaveState()}
          </div>
          ${this._renderMeasurementBar()}
          ${this.error ? html`<p class="error">${this.error}</p>` : null}
          ${this._renderGroups(visible)}
        </div>
        <div class="result">
          <role-result
            .profile=${profile}
            .roles=${this.roles}
            .targetRole=${this.targetRole}
            .gap=${gap}
            @target-changed=${this._onTargetChanged}
          ></role-result>
        </div>
      </div>
    `;
  }

  _renderSaveState() {
    if (!this.personId) return null;
    const label =
      this.status === 'saving'
        ? 'Guardando…'
        : this.status === 'saved'
          ? 'Guardado'
          : this.status === 'loading'
            ? 'Cargando…'
            : '';
    return label ? html`<span class="save-state">${label}</span>` : null;
  }

  _renderMeasurementBar() {
    if (!this.personId) return null;
    let when = '';
    if (this._measuredAtMs) {
      when = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(this._measuredAtMs));
    }
    return html`
      <div class="measurement">
        <span class="measurement-when">${when ? `Medición del ${when}` : 'Nueva medición'}</span>
        <button type="button" class="measurement-new" @click=${this._startNewMeasurement}>
          Guardar como nueva medición
        </button>
      </div>
    `;
  }

  /**
   * Modo inverso: autorrellena el cuestionario con la plantilla de un rol como
   * punto de partida editable. El usuario puede ajustar después.
   */
  _applyRoleTemplate(event) {
    const roleKey = event.target.value;
    event.target.value = '';
    if (!roleKey) return;
    this.answers = fillAnswersFromRole(roleKey, this.items);
    if (this.personId) {
      this.status = 'saving';
      this._save();
    }
  }

  /**
   * Crea un nuevo punto del histórico a partir de las respuestas actuales y
   * pasa a editarlo (acción manual; complementa la cadencia automática de 90 días).
   */
  async _startNewMeasurement() {
    if (!this.personId || !this.leaderUid || !this.tenantId) return;
    this.status = 'saving';
    try {
      const id = await createSession(this.tenantId, this.personId, { answers: this.answers, targetRole: this.targetRole });
      this.sessionId = id;
      this._measuredAtMs = Date.now();
      this._emitSession(id);
      await this._persist();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo crear la medición.';
      this.status = 'idle';
    }
  }

  /** @param {import('../data/items.js').Item[]} visible */
  _renderGroups(visible) {
    // Agrupa por dimensión respetando el orden de `dimensions`.
    return this.dimensions.map((dim) => {
      const dimItems = visible.filter((item) => item.dimension === dim.key);
      if (dimItems.length === 0) return null;
      return html`
        <div class="dim-group">
          <h4 class="dim-title">${dim.label}</h4>
          ${dimItems.map((item) => this._renderItem(item))}
        </div>
      `;
    });
  }

  /** @param {import('../data/items.js').Item} item */
  _renderItem(item) {
    return html`
      <div class="item">
        <span class="item-text">${item.text}</span>
        ${item.type === 'checkbox'
          ? this._renderCheckbox(item)
          : item.type === 'scale'
            ? this._renderScale(item)
            : this._renderMulti(item)}
      </div>
    `;
  }

  _renderCheckbox(item) {
    const value = this.answers[item.id];
    return html`
      <div class="yesno" role="group" aria-label=${item.text}>
        <button
          type="button"
          class="yesno-btn ${value === true ? 'active' : ''}"
          aria-pressed=${value === true}
          @click=${() => this._setAnswer(item.id, true)}
        >
          Sí
        </button>
        <button
          type="button"
          class="yesno-btn ${value === false ? 'active' : ''}"
          aria-pressed=${value === false}
          @click=${() => this._setAnswer(item.id, false)}
        >
          No
        </button>
      </div>
    `;
  }

  _renderScale(item) {
    const current = typeof this.answers[item.id] === 'number' ? this.answers[item.id] : 0;
    const name = `scale-${item.id}`;
    return html`
      <div class="scale">
        <span class="scale-ends">Nunca</span>
        <fieldset>
          ${[1, 2, 3, 4, 5].map(
            (n) => html`
              <label>
                <input
                  type="radio"
                  name=${name}
                  value=${n}
                  .checked=${current === n}
                  @change=${() => this._setAnswer(item.id, n)}
                />
                <span class="dot">${n}</span>
              </label>
            `,
          )}
        </fieldset>
        <span class="scale-ends">Siempre</span>
      </div>
    `;
  }

  _renderMulti(item) {
    const selected = Array.isArray(this.answers[item.id]) ? this.answers[item.id] : [];
    return html`
      <div class="multi">
        ${(item.options ?? []).map(
          (opt) => html`
            <label>
              <input
                type="checkbox"
                .checked=${selected.includes(opt.value)}
                @change=${(e) => this._toggleMulti(item, opt.value, e.target.checked)}
              />
              <span>${opt.label}</span>
            </label>
          `,
        )}
      </div>
    `;
  }

  /**
   * @param {import('../data/items.js').Item} item
   * @param {string} value
   * @param {boolean} checked
   */
  _toggleMulti(item, value, checked) {
    const current = Array.isArray(this.answers[item.id]) ? this.answers[item.id] : [];
    const next = checked ? [...current, value] : current.filter((v) => v !== value);
    this._setAnswer(item.id, next);
  }
}

if (!customElements.get('role-questionnaire')) {
  customElements.define('role-questionnaire', RoleQuestionnaire);
}
