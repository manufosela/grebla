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
  sharePerson,
  unsharePerson,
} from '../../tools/team/application/usecases/index.js';
import { levelLabel } from '../../tools/team/domain/levels.js';
import { BELBIN_ROLES } from '../../tools/team/domain/belbin.js';

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

export class TeamPersonDetail extends LitElement {
  static properties = {
    persistence: { attribute: false },
    person: { attribute: false },
    members: { attribute: false },
    currentUid: { attribute: false },
    timeline: { state: true },
    areas: { state: true },
    conversations: { state: true },
    notes: { state: true },
    loading: { state: true },
    error: { state: true },
    _form: { state: true },
    _know: { state: true },
    _contrib: { state: true },
    _conv: { state: true },
    _noteText: { state: true },
    _confirmNote: { state: true },
    _shareSel: { state: true },
    _sharePerm: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .head { margin-bottom: 1rem; }
    .head h2 { margin: 0; font-size: 1.3rem; }
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
    section.share { border-left: 4px solid var(--rm-accent, #2a9d8f); }
    section.share .row { align-items: flex-end; }
  `;

  constructor() {
    super();
    this.persistence = null;
    /** @type {import('../../tools/team/domain/types.js').Person|null} */
    this.person = null;
    /** @type {import('../../lib/firestore.js').TenantMember[]} líderes del tenant (para compartir) */
    this.members = [];
    /** @type {string|null} uid del líder en sesión (dueño si coincide con ownerLeaderUid) */
    this.currentUid = null;
    /** @type {string} líder seleccionado en el formulario de compartir */
    this._shareSel = '';
    /** @type {import('../../tools/team/domain/types.js').SharePermission} */
    this._sharePerm = 'view';
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
      this._load();
    }
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
          ? html`<p class="empty">No hay áreas. Créalas en <strong>Ajustes</strong> para registrar conocimiento.</p>`
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

  /** @param {string} uid */
  _leaderName(uid) {
    const m = this.members.find((x) => x.uid === uid);
    return m?.displayName ?? m?.email ?? uid;
  }

  async _share() {
    const uid = this._shareSel;
    if (!uid) return;
    this.error = '';
    try {
      await sharePerson(this.persistence, this.person.id, uid, this._sharePerm);
      const sharedWith = { ...(this.person.sharedWith ?? {}), [uid]: this._sharePerm };
      this.person = { ...this.person, sharedWith, sharedWithUids: Object.keys(sharedWith) };
      this._shareSel = '';
      this._sharePerm = 'view';
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo compartir.';
    }
  }

  /** @param {string} uid */
  async _unshare(uid) {
    this.error = '';
    try {
      await unsharePerson(this.persistence, this.person.id, uid);
      const sharedWith = { ...(this.person.sharedWith ?? {}) };
      delete sharedWith[uid];
      this.person = { ...this.person, sharedWith, sharedWithUids: Object.keys(sharedWith) };
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo dejar de compartir.';
    }
  }

  /** Solo el líder dueño puede compartir la persona (ver/editar) con otros líderes. */
  _renderShare() {
    const isOwner = this.currentUid && this.person.ownerLeaderUid === this.currentUid;
    if (!isOwner) return null;
    const shared = this.person.sharedWith ?? {};
    const sharedUids = Object.keys(shared);
    const candidates = this.members.filter(
      (m) => m.uid !== this.currentUid && m.uid !== this.person.ownerLeaderUid && !sharedUids.includes(m.uid),
    );
    return html`
      <section class="share">
        <h3>Compartir</h3>
        <p class="empty">Comparte esta persona con otro líder para que colabore en su seguimiento.</p>
        ${sharedUids.length === 0
          ? html`<p class="empty">Aún no la has compartido con nadie.</p>`
          : html`<ul class="hist">
              ${sharedUids.map(
                (uid) => html`
                  <li>
                    <span class="lvl">${this._leaderName(uid)}</span>
                    <span class="note">${shared[uid] === 'edit' ? 'Puede editar' : 'Solo ver'}</span>
                    <span class="del"><button class="link yes" @click=${() => this._unshare(uid)}>Quitar</button></span>
                  </li>
                `,
              )}
            </ul>`}
        <div class="row">
          <label class="fld">Líder
            <select .value=${this._shareSel} @change=${(e) => { this._shareSel = e.target.value; }}>
              <option value="">— Elige un líder —</option>
              ${candidates.map((m) => html`<option value=${m.uid}>${m.displayName ?? m.email ?? m.uid}</option>`)}
            </select>
          </label>
          <label class="fld">Permiso
            <select .value=${this._sharePerm} @change=${(e) => { this._sharePerm = e.target.value; }}>
              <option value="view">Solo ver</option>
              <option value="edit">Puede editar</option>
            </select>
          </label>
          <button class="primary" ?disabled=${!this._shareSel} @click=${() => this._share()}>Compartir</button>
        </div>
      </section>
    `;
  }

  render() {
    if (!this.person) return null;
    return html`
      <div class="head">
        <h2>${this.person.name}</h2>
        ${(this.person.teamRoles ?? []).length > 0
          ? html`<span class="chips">${this.person.teamRoles.map((r) => html`<span class="chip">${r}</span>`)}</span>`
          : null}
      </div>
      ${this.error ? html`<p class="error">${this.error}</p>` : null}
      ${this.loading
        ? html`<p class="empty">Cargando…</p>`
        : html`
            ${DIMENSIONS.map((d) => this._renderDimension(d))}
            ${this._renderKnowledge()}
            ${this._renderContribution()}
            ${this._renderConversations()}
            ${this._renderNotes()}
            ${this._renderShare()}
          `}
    `;
  }
}

if (!customElements.get('team-person-detail')) {
  customElements.define('team-person-detail', TeamPersonDetail);
}
