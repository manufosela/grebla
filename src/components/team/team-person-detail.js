/**
 * <team-person-detail>
 * Ficha de una persona. En esta fase cubre las dos dimensiones de nivel 1-7
 * independientes (R1): Seniority y Emocional. Para cada una: estado actual
 * (última lectura), formulario de registro (selector de nivel + nota) e
 * histórico ascendente (R2). Conocimiento, contribución, conversaciones y notas
 * llegan en fases posteriores.
 *
 * Propiedades:
 *  - persistence: PersistencePort (inyectado por <team-app>)
 *  - person: Person
 */
import { LitElement, html, css } from 'lit';
import './team-level-input.js';
import {
  addReading,
  getPersonTimeline,
  listAreas,
  registerConversation,
  listConversations,
  addSupportNote,
  listSupportNotes,
  removeSupportNote,
  updatePerson,
} from '../../tools/team/application/usecases/index.js';
import { levelLabel } from '../../tools/team/domain/levels.js';
import { BELBIN_ROLES } from '../../tools/team/domain/belbin.js';
import {
  composeTitle,
  getLevel,
  expectationsForLevel,
  addendumsForDisciplines,
  aspirationalLevels,
} from '../../tools/career/data/framework.js';

const CONTRIB_STATES = [
  { value: '', label: '—' },
  { value: 'secondary', label: 'Secundario' },
  { value: 'primary', label: 'Primario' },
];

const CONVERSATION_TYPES = [
  { value: 'o2o', label: '1:1 (O2O)' },
  { value: 'catchup', label: 'Catch-up' },
];

const dateFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' });

/** @param {string} iso */
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

const DIMENSIONS = [
  {
    key: 'seniority',
    label: 'Seniority',
    bias: 'Sesgo de observabilidad: lo visible no es toda la capacidad. Provoca que emerja lo que no se manifiesta solo; no confundas volumen con madurez.',
  },
  {
    key: 'emotional',
    label: 'Emocional',
    bias: 'Sesgo jerárquico y relacional: la persona filtra lo que muestra a quien tiene autoridad. Contrasta con otros observadores y cuida a quien tratas menos. Marca como provisional si aún hay poca historia.',
  },
];

/**
 * Sub-pestañas de la ficha de persona. El orden define el recorrido con las
 * flechas del teclado y el primer elemento (`carrera`) es el activo por defecto.
 * @type {ReadonlyArray<{ id: string, label: string }>}
 */
const SUBTABS = [
  { id: 'carrera', label: 'Carrera' },
  { id: 'seniority', label: 'Seniority' },
  { id: 'emotional', label: 'Emocional' },
  { id: 'knowledge', label: 'Conocimiento' },
  { id: 'contribution', label: 'Contribución' },
  { id: 'conversations', label: 'Conversaciones' },
  { id: 'notes', label: 'Notas' },
];

export class TeamPersonDetail extends LitElement {
  static properties = {
    persistence: { attribute: false },
    person: { attribute: false },
    framework: { attribute: false },
    isAdmin: { attribute: false },
    timeline: { state: true },
    areas: { state: true },
    conversations: { state: true },
    notes: { state: true },
    loading: { state: true },
    error: { state: true },
    _subtab: { state: true },
    _form: { state: true },
    _know: { state: true },
    _contrib: { state: true },
    _conv: { state: true },
    _noteText: { state: true },
    _confirmNote: { state: true },
    _career: { state: true },
    _careerSaving: { state: true },
    _careerError: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .head { margin-bottom: 1rem; }
    .head h2 { margin: 0; font-size: 1.3rem; }
    .head .title { margin: 0.3rem 0 0; font-size: 0.95rem; font-weight: 600; color: var(--rm-text, #111827); }
    .head .chips { display: inline-flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.4rem; }
    .chip { background: var(--rm-track, #e9f0f2); border-radius: 999px; padding: 0.1rem 0.6rem; font-size: 0.78rem; font-weight: 600; }
    section {
      background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px); padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;
    }
    .dim-head { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; margin-bottom: 0.75rem; }
    h3 { font-size: 1rem; margin: 0; }
    .current { font-size: 0.85rem; color: var(--rm-muted, #6b7280); }
    .current strong { color: var(--rm-text, #111827); }
    .form { display: grid; gap: 0.6rem; margin: 0.5rem 0 1rem; }
    textarea, input[type='date'] {
      border: 1px solid var(--rm-border, #d1d5db); border-radius: 8px; padding: 0.5rem 0.6rem;
      font: inherit; font-size: 0.9rem; color: var(--rm-text, #111827); background: var(--rm-surface, #fff);
    }
    textarea { resize: vertical; min-height: 2.4rem; }
    .row { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    button.primary {
      border: 1px solid var(--rm-accent, #2a9d8f); background: var(--rm-accent, #2a9d8f); color: #fff;
      border-radius: 8px; padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600; cursor: pointer;
    }
    button.primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .hist { list-style: none; margin: 0; padding: 0; font-size: 0.85rem; }
    .hist li { display: flex; gap: 0.6rem; padding: 0.35rem 0; border-top: 1px solid var(--rm-border, #eef0f2); }
    .hist .when { color: var(--rm-muted, #9ca3af); white-space: nowrap; min-width: 7.5rem; }
    .hist .lvl { font-weight: 600; }
    .hist .note { color: var(--rm-muted, #6b7280); }
    .empty { color: var(--rm-muted, #9ca3af); font-size: 0.85rem; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    label.fld { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.78rem; color: var(--rm-muted, #6b7280); font-weight: 600; }
    select { border: 1px solid var(--rm-border, #d1d5db); border-radius: 8px; padding: 0.5rem 0.6rem; font: inherit; font-size: 0.9rem; background: var(--rm-surface, #fff); color: var(--rm-text, #111827); }
    section.support { border-left: 4px solid var(--rm-warning, #f2887a); }
    .disclaimer { font-size: 0.8rem; color: var(--rm-muted, #6b7280); background: var(--rm-coral-soft, #fdecea); border-radius: 8px; padding: 0.5rem 0.75rem; margin: 0 0 0.75rem; }
    .hist .del { margin-left: auto; white-space: nowrap; }
    .link { border: 0; background: none; cursor: pointer; font-weight: 700; font-size: 0.8rem; color: var(--rm-muted, #6b7280); padding: 0 0.2rem; }
    .link.yes { color: var(--rm-danger, #dc2626); }
    .chips { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.75rem; }
    .belbin { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.4rem 1rem; }
    .belbin-row { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; }
    .belbin-row .b-name { font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bias { font-size: 0.78rem; color: var(--rm-muted, #6b7280); background: var(--rm-coral-soft, #fdecea); border-radius: 8px; padding: 0.45rem 0.7rem; margin: 0 0 0.75rem; }
    section.career { border-left: 4px solid var(--rm-accent, #2a9d8f); }
    .career .sub { font-size: 0.85rem; font-weight: 700; color: var(--rm-text, #111827); margin: 1.1rem 0 0.35rem; }
    .career .now .code { font-weight: 700; }
    .career .now .desc { font-size: 0.85rem; color: var(--rm-text, #111827); margin: 0.2rem 0 0; }
    .career .now .profile { font-size: 0.8rem; color: var(--rm-muted, #6b7280); margin: 0.2rem 0 0; }
    .career .expect { list-style: none; margin: 0; padding: 0; font-size: 0.85rem; }
    .career .expect li { padding: 0.4rem 0; border-top: 1px solid var(--rm-border, #eef0f2); }
    .career .expect .dim { font-weight: 700; }
    .career .expect .txt { color: var(--rm-text, #111827); }
    .career .expect .todo { color: var(--rm-muted, #9ca3af); font-style: italic; }
    .career .addn { margin: 0.3rem 0 0; }
    .career .addn .disc { font-weight: 700; font-size: 0.85rem; margin: 0.6rem 0 0.2rem; }
    .career .addn ul { list-style: none; margin: 0; padding: 0; font-size: 0.83rem; }
    .career .addn li { padding: 0.25rem 0; }
    .career .addn .dim { font-weight: 600; }
    .career .aspire { list-style: none; margin: 0; padding: 0; }
    .career .aspire > li { border-top: 1px solid var(--rm-border, #eef0f2); }
    .career .aspire summary { cursor: pointer; padding: 0.45rem 0; font-size: 0.88rem; display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; }
    .career .aspire summary::-webkit-details-marker { color: var(--rm-muted, #9ca3af); }
    .career .aspire .code { font-weight: 700; }
    .career .aspire .track { color: var(--rm-muted, #6b7280); font-size: 0.78rem; }
    .career .aspire .desc { font-size: 0.82rem; color: var(--rm-muted, #4b5563); margin: 0 0 0.5rem; padding-left: 1.1rem; }
    .career .target-declared { margin: 0.2rem 0 0; font-size: 0.9rem; font-weight: 700; color: var(--rm-accent, #2a9d8f); }
    .career .target-declared .code { font-weight: 800; }
    .career .target-none { margin: 0.2rem 0 0; font-size: 0.83rem; color: var(--rm-muted, #9ca3af); font-style: italic; }

    /* ── Barra de sub-pestañas (patrón ARIA tablist, coherente con Ajustes) ── */
    .tabs { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .tab {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-muted, #6b7280);
      border-radius: 999px; padding: 0.4rem 1rem; font: inherit; font-size: 0.88rem; font-weight: 600; cursor: pointer;
    }
    .tab.active { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: #fff; }
    .tab:hover:not(.active) { color: var(--rm-text, #111827); }
    .tab:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .subpanel:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; border-radius: var(--rm-radius, 12px); }

    /* ── Editor inline de carrera (nivel + disciplinas) ── */
    .career-editor { display: grid; gap: 0.75rem; margin: 0.25rem 0 1.25rem; }
    .career-editor .edit-hint { margin: 0; font-size: 0.83rem; color: var(--rm-muted, #6b7280); }
    .career-editor .fld { max-width: 28rem; }
    fieldset.disc { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 8px; padding: 0.6rem 0.9rem; margin: 0; }
    fieldset.disc legend { font-size: 0.78rem; color: var(--rm-muted, #6b7280); font-weight: 600; padding: 0 0.35rem; }
    .disc-checks { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.35rem 1rem; }
    .disc-check { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; cursor: pointer; }
    .fw-admin { margin: 1rem 0 0; font-size: 0.8rem; color: var(--rm-muted, #6b7280); }
    .fw-admin a { color: var(--rm-accent, #2a9d8f); font-weight: 600; }
    .link-inline {
      border: 0; background: none; padding: 0; margin: 0; cursor: pointer;
      font: inherit; font-weight: 700; color: var(--rm-accent, #2a9d8f); text-decoration: underline;
    }
    .link-inline:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; border-radius: 4px; }
  `;

  constructor() {
    super();
    this.persistence = null;
    /** @type {import('../../tools/team/domain/types.js').Person|null} */
    this.person = null;
    /** @type {import('../../tools/career/data/framework.js').CareerFramework|null} framework de carrera (para el título compuesto) */
    this.framework = null;
    /** @type {boolean} el enlace al panel de admin del framework solo se muestra al superadmin */
    this.isAdmin = false;
    /** @type {string} sub-pestaña activa de la ficha */
    this._subtab = 'carrera';
    /** @type {{ levelId: string, disciplines: string[] }} edición inline de carrera (nivel + disciplinas) */
    this._career = { levelId: '', disciplines: [] };
    /** @type {boolean} guardado de carrera en curso */
    this._careerSaving = false;
    /** @type {string} error in-place del formulario de carrera */
    this._careerError = '';
    this.timeline = { seniority: [], emotional: [], knowledge: [], contribution: [] };
    /** @type {import('../../tools/team/domain/types.js').Area[]} */
    this.areas = [];
    /** @type {import('../../tools/team/domain/types.js').Conversation[]} */
    this.conversations = [];
    /** @type {import('../../tools/team/domain/types.js').SupportNote[]} */
    this.notes = [];
    this.loading = true;
    this.error = '';
    this._form = {
      seniority: { level: 0, toNext: false, note: '', date: '' },
      emotional: { level: 0, toNext: false, note: '', date: '' },
    };
    this._know = { areaId: '', level: 0, toNext: false, note: '', date: '' };
    this._contrib = { roles: {}, note: '', date: '' };
    this._conv = { type: 'o2o', date: '', notes: '' };
    this._noteText = '';
    /** @type {string|null} */
    this._confirmNote = null;
    this._loadedFor = null;
  }

  updated() {
    if (this.persistence && this.person && this._loadedFor !== this.person.id) {
      this._loadedFor = this.person.id;
      this._seedCareer();
      this._load();
    }
  }

  /**
   * Precarga el formulario inline de carrera con el nivel y disciplinas actuales
   * de la persona. Se llama al cambiar de persona (no en cada render).
   * @returns {void}
   */
  _seedCareer() {
    this._career = {
      levelId: this.person.levelId ?? '',
      disciplines: [...(this.person.disciplines ?? [])],
    };
    this._careerError = '';
  }

  /**
   * Navegación por teclado de la barra de sub-pestañas (patrón ARIA tablist con
   * activación automática): ←/→ recorren de forma circular y Home/End saltan a la
   * primera/última, moviendo el foco a la nueva pestaña.
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
      /** @type {HTMLElement|null} */ (this.renderRoot.querySelector(`#psub-${this._subtab}`))?.focus();
    });
  }

  /**
   * Marca/desmarca una disciplina en el formulario inline de carrera.
   * @param {string} id  id de la disciplina
   * @param {boolean} checked
   * @returns {void}
   */
  _toggleCareerDiscipline(id, checked) {
    const disciplines = checked
      ? [...this._career.disciplines, id]
      : this._career.disciplines.filter((d) => d !== id);
    this._career = { ...this._career, disciplines };
  }

  /**
   * Guarda el nivel y las disciplinas de la persona (la asignación que hace el
   * líder). Reutiliza `updatePerson`, el mismo caso de uso que la sección Personas,
   * y refresca `this.person` reasignando un objeto nuevo para re-renderizar.
   * @returns {Promise<void>}
   */
  async _saveCareer() {
    this._careerError = '';
    this._careerSaving = true;
    const levelId = this._career.levelId || null;
    const disciplines = [...this._career.disciplines];
    try {
      await updatePerson(this.persistence, this.person.id, { levelId, disciplines });
      this.person = { ...this.person, levelId, disciplines };
    } catch (err) {
      this._careerError = err instanceof Error ? err.message : 'No se pudo guardar la carrera.';
    } finally {
      this._careerSaving = false;
    }
  }

  /**
   * Pide a `<team-app>` que abra la sección Ajustes (sub-pestaña «Áreas» por
   * defecto) mediante un evento; no navega con `location` dentro de la SPA.
   * @returns {void}
   */
  _gotoAreas() {
    this.dispatchEvent(new CustomEvent('goto-tab', {
      detail: { tab: 'settings' },
      bubbles: true,
      composed: true,
    }));
  }

  /**
   * Barra de sub-pestañas accesible (tablist con roving tabindex): solo la
   * pestaña activa es tabulable; las flechas mueven el foco y la selección.
   * @returns {import('lit').TemplateResult}
   */
  _renderSubtabs() {
    return html`
      <div class="tabs" role="tablist" aria-label="Secciones de la ficha" @keydown=${this._onSubtabsKeydown}>
        ${SUBTABS.map((t) => {
          const selected = this._subtab === t.id;
          return html`
            <button
              id="psub-${t.id}"
              class="tab ${selected ? 'active' : ''}"
              type="button"
              role="tab"
              aria-selected=${selected ? 'true' : 'false'}
              aria-controls="ppanel-${t.id}"
              tabindex=${selected ? '0' : '-1'}
              @click=${() => { this._subtab = t.id; }}
            >${t.label}</button>
          `;
        })}
      </div>
    `;
  }

  async _load() {
    this.loading = true;
    this.error = '';
    try {
      const [timeline, areas, conversations, notes] = await Promise.all([
        getPersonTimeline(this.persistence, this.person.id),
        listAreas(this.persistence),
        listConversations(this.persistence, this.person.id),
        listSupportNotes(this.persistence, this.person.id),
      ]);
      this.timeline = timeline;
      this.areas = areas;
      this.conversations = conversations;
      this.notes = notes;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo cargar la ficha.';
    } finally {
      this.loading = false;
    }
  }

  async _reload() {
    this._loadedFor = null;
    await this._load();
    this._loadedFor = this.person.id;
  }

  async _saveKnowledge() {
    const k = this._know;
    if (!k.areaId) { this.error = 'Elige un área.'; return; }
    if (!k.level) { this.error = 'Selecciona un nivel.'; return; }
    this.error = '';
    try {
      await addReading(this.persistence, 'knowledge', this.person.id, {
        areaId: k.areaId,
        level: k.level,
        toNext: k.toNext,
        note: k.note.trim() || undefined,
        date: k.date || new Date().toISOString(),
      });
      this._know = { areaId: '', level: 0, toNext: false, note: '', date: '' };
      await this._reload();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo guardar el conocimiento.';
    }
  }

  _setContribRole(sigla, value) {
    const roles = { ...this._contrib.roles };
    if (value) roles[sigla] = value;
    else delete roles[sigla];
    this._contrib = { ...this._contrib, roles };
  }

  async _saveContribution() {
    const c = this._contrib;
    if (Object.keys(c.roles).length === 0) { this.error = 'Marca al menos un rol.'; return; }
    this.error = '';
    try {
      await addReading(this.persistence, 'contribution', this.person.id, {
        roles: c.roles,
        note: c.note.trim() || undefined,
        date: c.date || new Date().toISOString(),
      });
      this._contrib = { roles: {}, note: '', date: '' };
      await this._reload();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo guardar la contribución.';
    }
  }

  async _saveConversation() {
    const c = this._conv;
    if (!c.notes.trim()) {
      this.error = 'Escribe las notas de la conversación.';
      return;
    }
    this.error = '';
    try {
      await registerConversation(this.persistence, this.person.id, {
        type: c.type,
        date: c.date || new Date().toISOString(),
        notes: c.notes.trim(),
      });
      this._conv = { type: 'o2o', date: '', notes: '' };
      await this._reload();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo guardar la conversación.';
    }
  }

  async _saveNote() {
    if (!this._noteText.trim()) return;
    this.error = '';
    try {
      await addSupportNote(this.persistence, this.person.id, this._noteText.trim());
      this._noteText = '';
      await this._reload();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo guardar la nota.';
    }
  }

  async _deleteNote(id) {
    this._confirmNote = null;
    try {
      await removeSupportNote(this.persistence, this.person.id, id);
      await this._reload();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo borrar la nota.';
    }
  }

  _patchForm(dim, patch) {
    this._form = { ...this._form, [dim]: { ...this._form[dim], ...patch } };
  }

  async _save(dim) {
    const f = this._form[dim];
    if (!f.level) {
      this.error = 'Selecciona un nivel.';
      return;
    }
    this.error = '';
    try {
      await addReading(this.persistence, dim, this.person.id, {
        level: f.level,
        toNext: f.toNext,
        note: f.note.trim() || undefined,
        date: f.date || new Date().toISOString(),
      });
      this._patchForm(dim, { level: 0, toNext: false, note: '', date: '' });
      await this._reload();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo guardar la lectura.';
    }
  }

  _renderDimension({ key, label, bias }) {
    const history = this.timeline[key] ?? [];
    const current = history.at(-1);
    const f = this._form[key];
    return html`
      <section>
        <div class="dim-head">
          <h3>${label}</h3>
          <span class="current">
            ${current
              ? html`Actual: <strong>${levelLabel(current.level, current.toNext)}</strong> · ${formatDate(current.date)}`
              : 'Sin lecturas todavía'}
          </span>
        </div>
        ${bias ? html`<p class="bias">⚠ ${bias}</p>` : null}

        <div class="form">
          <team-level-input
            .level=${f.level}
            .toNext=${f.toNext}
            @level-change=${(e) => this._patchForm(key, { level: e.detail.level, toNext: e.detail.toNext })}
          ></team-level-input>
          <label class="fld">Nota (opcional)
            <textarea
              .value=${f.note}
              @input=${(e) => this._patchForm(key, { note: e.target.value })}
              placeholder="Contexto de esta lectura…"
            ></textarea>
          </label>
          <div class="row">
            <label class="fld">Fecha
              <input type="date" .value=${f.date} @input=${(e) => this._patchForm(key, { date: e.target.value })} />
            </label>
            <button class="primary" ?disabled=${!f.level} @click=${() => this._save(key)}>Registrar lectura</button>
          </div>
        </div>

        ${history.length === 0
          ? html`<p class="empty">Aún no hay histórico.</p>`
          : html`
              <ul class="hist">
                ${history.map(
                  (r) => html`
                    <li>
                      <span class="when">${formatDate(r.date)}</span>
                      <span class="lvl">${levelLabel(r.level, r.toNext)}</span>
                      ${r.note ? html`<span class="note">${r.note}</span>` : null}
                    </li>
                  `,
                )}
              </ul>
            `}
      </section>
    `;
  }

  _renderKnowledge() {
    const history = this.timeline.knowledge ?? [];
    const currentByArea = new Map();
    for (const r of history) currentByArea.set(r.areaId, r); // asc → última gana
    const areaName = (id) => this.areas.find((a) => a.id === id)?.name ?? '—';
    const k = this._know;
    return html`
      <section>
        <h3>Conocimiento por área</h3>
        ${this.areas.length === 0
          ? html`<p class="empty">No hay áreas.
              <button type="button" class="link-inline" @click=${this._gotoAreas}>Créalas en Ajustes</button>
              para registrar conocimiento.</p>`
          : html`
              ${currentByArea.size > 0
                ? html`<div class="chips">
                    ${[...currentByArea.entries()].map(
                      ([id, r]) => html`<span class="chip">${areaName(id)}: ${levelLabel(r.level, r.toNext)}</span>`,
                    )}
                  </div>`
                : null}
              <div class="form">
                <label class="fld">Área
                  <select .value=${k.areaId} @change=${(e) => { this._know = { ...this._know, areaId: e.target.value }; }}>
                    <option value="">— Elige un área —</option>
                    ${this.areas.map((a) => html`<option value=${a.id} ?selected=${a.id === k.areaId}>${a.name}</option>`)}
                  </select>
                </label>
                <team-level-input
                  .level=${k.level}
                  .toNext=${k.toNext}
                  @level-change=${(e) => { this._know = { ...this._know, level: e.detail.level, toNext: e.detail.toNext }; }}
                ></team-level-input>
                <label class="fld">Nota (opcional)
                  <textarea .value=${k.note} @input=${(e) => { this._know = { ...this._know, note: e.target.value }; }}></textarea>
                </label>
                <div class="row">
                  <label class="fld">Fecha
                    <input type="date" .value=${k.date} @input=${(e) => { this._know = { ...this._know, date: e.target.value }; }} />
                  </label>
                  <button class="primary" ?disabled=${!k.areaId || !k.level} @click=${this._saveKnowledge}>Registrar conocimiento</button>
                </div>
              </div>
              ${history.length === 0
                ? html`<p class="empty">Sin histórico.</p>`
                : html`<ul class="hist">
                    ${history.map(
                      (r) => html`<li>
                        <span class="when">${formatDate(r.date)}</span>
                        <span class="lvl">${areaName(r.areaId)}: ${levelLabel(r.level, r.toNext)}</span>
                        ${r.note ? html`<span class="note">${r.note}</span>` : null}
                      </li>`,
                    )}
                  </ul>`}
            `}
      </section>
    `;
  }

  _renderContribution() {
    const history = this.timeline.contribution ?? [];
    const current = history.at(-1);
    const c = this._contrib;
    const summary = (roles) =>
      Object.entries(roles || {})
        .map(([s, kind]) => `${s} ${kind === 'primary' ? '(P)' : '(S)'}`)
        .join(' · ') || '—';
    return html`
      <section>
        <h3>Contribución (Belbin)</h3>
        <p class="current">
          ${current
            ? html`Actual: <strong>${summary(current.roles)}</strong> · ${formatDate(current.date)}`
            : 'Sin perfil todavía'}
        </p>
        <div class="form">
          <div class="belbin">
            ${BELBIN_ROLES.map(
              (role) => html`
                <div class="belbin-row">
                  <span class="b-name" title=${role.name}>${role.sigla} · ${role.name}</span>
                  <select @change=${(e) => this._setContribRole(role.sigla, e.target.value)}>
                    ${CONTRIB_STATES.map(
                      (st) => html`<option value=${st.value} ?selected=${(c.roles[role.sigla] ?? '') === st.value}>${st.label}</option>`,
                    )}
                  </select>
                </div>
              `,
            )}
          </div>
          <label class="fld">Nota (opcional)
            <textarea .value=${c.note} @input=${(e) => { this._contrib = { ...this._contrib, note: e.target.value }; }}></textarea>
          </label>
          <div class="row">
            <label class="fld">Fecha
              <input type="date" .value=${c.date} @input=${(e) => { this._contrib = { ...this._contrib, date: e.target.value }; }} />
            </label>
            <button class="primary" ?disabled=${Object.keys(c.roles).length === 0} @click=${this._saveContribution}>Registrar contribución</button>
          </div>
        </div>
        ${history.length === 0
          ? null
          : html`<ul class="hist">
              ${history.map(
                (r) => html`<li>
                  <span class="when">${formatDate(r.date)}</span>
                  <span class="lvl">${summary(r.roles)}</span>
                  ${r.note ? html`<span class="note">${r.note}</span>` : null}
                </li>`,
              )}
            </ul>`}
      </section>
    `;
  }

  _renderConversations() {
    const c = this._conv;
    const typeLabel = (t) => CONVERSATION_TYPES.find((x) => x.value === t)?.label ?? t;
    return html`
      <section>
        <h3>Conversaciones</h3>
        <div class="form">
          <div class="row">
            <label class="fld">Tipo
              <select .value=${c.type} @change=${(e) => { this._conv = { ...this._conv, type: e.target.value }; }}>
                ${CONVERSATION_TYPES.map((t) => html`<option value=${t.value} ?selected=${t.value === c.type}>${t.label}</option>`)}
              </select>
            </label>
            <label class="fld">Fecha
              <input type="date" .value=${c.date} @input=${(e) => { this._conv = { ...this._conv, date: e.target.value }; }} />
            </label>
          </div>
          <label class="fld">Notas
            <textarea
              .value=${c.notes}
              @input=${(e) => { this._conv = { ...this._conv, notes: e.target.value }; }}
              placeholder="Qué se habló, acuerdos, comportamientos observados…"
            ></textarea>
          </label>
          <div class="row">
            <button class="primary" ?disabled=${!c.notes.trim()} @click=${this._saveConversation}>Registrar conversación</button>
          </div>
        </div>
        ${this.conversations.length === 0
          ? html`<p class="empty">Sin conversaciones registradas.</p>`
          : html`
              <ul class="hist">
                ${this.conversations.map(
                  (cv) => html`
                    <li>
                      <span class="when">${formatDate(cv.date)}</span>
                      <span class="lvl">${typeLabel(cv.type)}</span>
                      <span class="note">${cv.notes}</span>
                    </li>
                  `,
                )}
              </ul>
            `}
      </section>
    `;
  }

  _renderNotes() {
    return html`
      <section class="support">
        <h3>Notas de acompañamiento</h3>
        <p class="disclaimer">
          Espacio sensible y <strong>no diagnóstico</strong>, separado de la dimensión Emocional.
          No tiene nivel y nunca se incluye en exports ni en agregados.
        </p>
        <div class="form">
          <label class="fld">Nueva nota
            <textarea
              .value=${this._noteText}
              @input=${(e) => { this._noteText = e.target.value; }}
              placeholder="Acompañamiento, contexto personal relevante para tu apoyo…"
            ></textarea>
          </label>
          <div class="row">
            <button class="primary" ?disabled=${!this._noteText.trim()} @click=${this._saveNote}>Guardar nota</button>
          </div>
        </div>
        ${this.notes.length === 0
          ? html`<p class="empty">Sin notas.</p>`
          : html`
              <ul class="hist">
                ${this.notes.map(
                  (n) => html`
                    <li>
                      <span class="when">${formatDate(n.date)}</span>
                      <span class="note">${n.text}</span>
                      <span class="del">
                        ${this._confirmNote === n.id
                          ? html`¿Borrar?
                              <button class="link yes" @click=${() => this._deleteNote(n.id)}>Sí</button>
                              <button class="link" @click=${() => { this._confirmNote = null; }}>No</button>`
                          : html`<button class="link" @click=${() => { this._confirmNote = n.id; }}>Borrar</button>`}
                      </span>
                    </li>
                  `,
                )}
              </ul>
            `}
      </section>
    `;
  }

  /**
   * Sección «Carrera» (F4): solo lectura. Muestra el nivel actual y sus
   * expectativas, el foco por disciplina (addendums) y los niveles a los que
   * aspirar. Se omite si la persona no tiene ni nivel ni disciplinas.
   */
  _renderCareer() {
    const fw = this.framework;
    const disciplineIds = this.person.disciplines ?? [];
    const level = getLevel(fw, this.person.levelId);

    const trackName = (trackId) => (fw?.tracks ?? []).find((t) => t.id === trackId)?.name ?? '';
    const expectations = level ? expectationsForLevel(fw, this.person.levelId) : [];
    const addendums = addendumsForDisciplines(fw, disciplineIds);
    const addendumsByDiscipline = Object.groupBy(addendums, (a) => a.discipline.id);
    const aspirations = level ? aspirationalLevels(fw, this.person.levelId) : [];

    return html`
      <section class="career">
        <h3>Carrera</h3>

        ${this._renderCareerEditor()}

        ${level
          ? html`
              <p class="sub">Nivel actual</p>
              <div class="now">
                <p><span class="code">${level.code}</span> · ${level.title}</p>
                ${level.description ? html`<p class="desc">${level.description}</p>` : null}
                ${level.typicalProfile ? html`<p class="profile">Perfil típico: ${level.typicalProfile}</p>` : null}
              </div>
            `
          : null}

        ${level
          ? html`
              <p class="sub">Lo que se te reconoce</p>
              <ul class="expect">
                ${expectations.map(
                  (row) => html`
                    <li>
                      <span class="dim">${row.dimension.name}</span>:
                      ${row.text
                        ? html`<span class="txt">${row.text}</span>`
                        : html`<span class="todo">pendiente de definir</span>`}
                    </li>
                  `,
                )}
              </ul>
            `
          : null}

        ${addendums.length > 0
          ? html`
              <p class="sub">Enfoque por disciplina</p>
              <div class="addn">
                ${Object.values(addendumsByDiscipline).map(
                  (rows) => html`
                    <p class="disc">${rows[0].discipline.name}</p>
                    <ul>
                      ${rows.map(
                        (a) => html`<li><span class="dim">${a.dimension.name}:</span> ${a.text}</li>`,
                      )}
                    </ul>
                  `,
                )}
              </div>
            `
          : null}

        ${level
          ? html`
              <p class="sub">A qué aspirar</p>
              ${aspirations.length === 0
                ? html`<p class="empty">No hay siguientes niveles definidos desde aquí.</p>`
                : html`
                    <ul class="aspire">
                      ${aspirations.map(
                        (l) => html`
                          <li>
                            <details>
                              <summary>
                                <span><span class="code">${l.code}</span> · ${l.title}</span>
                                ${trackName(l.trackId) ? html`<span class="track">${trackName(l.trackId)}</span>` : null}
                              </summary>
                              ${l.description ? html`<p class="desc">${l.description}</p>` : null}
                            </details>
                          </li>
                        `,
                      )}
                    </ul>
                  `}
            `
          : null}

        ${this._renderDeclaredTarget(fw)}

        ${this.isAdmin
          ? html`<p class="fw-admin">
              El framework de carrera (niveles, expectativas…) se edita en el
              <a href="/admin#careerFramework">panel de administración</a>.
            </p>`
          : null}
      </section>
    `;
  }

  /**
   * Editor inline de carrera: nivel (agrupado por track) y disciplinas (checkboxes)
   * de la persona. Es la asignación que hace el líder; la escala y expectativas del
   * framework siguen siendo de solo lectura. Precargado con `person.levelId` y
   * `person.disciplines` y guardado con `updatePerson`.
   * @returns {import('lit').TemplateResult}
   */
  _renderCareerEditor() {
    const fw = this.framework;
    const tracks = fw?.tracks ?? [];
    const levels = fw?.levels ?? [];
    const disciplines = fw?.disciplines ?? [];
    const groups = tracks
      .map((t) => ({ track: t, levels: levels.filter((l) => l.trackId === t.id) }))
      .filter((g) => g.levels.length > 0);
    const selected = this._career;
    return html`
      <div class="career-editor">
        <p class="edit-hint">Asigna el nivel y las disciplinas de esta persona.</p>
        <label class="fld">Nivel
          <select
            .value=${selected.levelId}
            @change=${(e) => { this._career = { ...this._career, levelId: e.target.value }; }}
          >
            <option value="">— sin nivel —</option>
            ${groups.map(
              (g) => html`
                <optgroup label=${g.track.name}>
                  ${g.levels.map(
                    (l) => html`<option value=${l.id} ?selected=${l.id === selected.levelId}>${l.code} · ${l.title}</option>`,
                  )}
                </optgroup>
              `,
            )}
          </select>
        </label>
        <fieldset class="disc">
          <legend>Disciplinas</legend>
          ${disciplines.length === 0
            ? html`<span class="empty">No hay disciplinas en el framework de carrera.</span>`
            : html`<div class="disc-checks">
                ${disciplines.map(
                  (d) => html`
                    <label class="disc-check">
                      <input
                        type="checkbox"
                        .checked=${selected.disciplines.includes(d.id)}
                        @change=${(e) => this._toggleCareerDiscipline(d.id, e.target.checked)}
                      />
                      <span>${d.name}</span>
                    </label>
                  `,
                )}
              </div>`}
        </fieldset>
        ${this._careerError ? html`<p class="error">${this._careerError}</p>` : null}
        <div class="row">
          <button class="primary" ?disabled=${this._careerSaving} @click=${this._saveCareer}>
            ${this._careerSaving ? 'Guardando…' : 'Guardar carrera'}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Objetivo de carrera declarado por la propia persona (`careerTargetLevelId`),
   * en SOLO LECTURA para el líder (informativo). Si no hay objetivo, muestra un
   * texto discreto.
   * @param {import('../../tools/career/data/framework.js').CareerFramework|null} fw
   * @returns {import('lit').TemplateResult}
   */
  _renderDeclaredTarget(fw) {
    const target = getLevel(fw, this.person.careerTargetLevelId);
    return html`
      <p class="sub">Objetivo de carrera</p>
      ${target
        ? html`<p class="target-declared">Declarado por la persona: <span class="code">${target.code}</span> · ${target.title}</p>`
        : html`<p class="target-none">Sin objetivo de carrera declarado.</p>`}
    `;
  }

  render() {
    if (!this.person) return null;
    const title = composeTitle(this.framework, this.person.levelId, this.person.disciplines);
    const disciplineNames = (this.framework?.disciplines ?? [])
      .filter((d) => (this.person.disciplines ?? []).includes(d.id))
      .map((d) => d.name);
    const guilds = this.person.guilds ?? [];
    return html`
      <div class="head">
        <h2>${this.person.name}</h2>
        ${title ? html`<p class="title">${title}</p>` : null}
        ${disciplineNames.length > 0
          ? html`<span class="chips">${disciplineNames.map((n) => html`<span class="chip">${n}</span>`)}</span>`
          : null}
        ${guilds.length > 0
          ? html`<span class="chips">${guilds.map((g) => html`<span class="chip">${g}</span>`)}</span>`
          : null}
      </div>
      ${this.error ? html`<p class="error">${this.error}</p>` : null}
      ${this.loading
        ? html`<p class="empty">Cargando…</p>`
        : html`
            ${this._renderSubtabs()}
            <div
              id="ppanel-${this._subtab}"
              class="subpanel"
              role="tabpanel"
              aria-labelledby="psub-${this._subtab}"
              tabindex="0"
            >
              ${this._renderActivePanel()}
            </div>
          `}
    `;
  }

  /**
   * Renderiza solo la sección de la sub-pestaña activa, reutilizando los
   * `_render*` existentes sin alterar su lógica.
   * @returns {import('lit').TemplateResult}
   */
  _renderActivePanel() {
    const panel = {
      carrera: () => this._renderCareer(),
      seniority: () => this._renderDimension(DIMENSIONS[0]),
      emotional: () => this._renderDimension(DIMENSIONS[1]),
      knowledge: () => this._renderKnowledge(),
      contribution: () => this._renderContribution(),
      conversations: () => this._renderConversations(),
      notes: () => this._renderNotes(),
    }[this._subtab] ?? (() => this._renderCareer());
    return panel();
  }
}

if (!customElements.get('team-person-detail')) {
  customElements.define('team-person-detail', TeamPersonDetail);
}
