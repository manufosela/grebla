/**
 * <o2o-register> — vista «Registrar O2O» (FASE 2, sin IA).
 *
 * El manager elige una persona de su equipo, ve el histórico de sus O2O y registra
 * uno nuevo A MANO: fecha, respuestas a la guía, notas privadas, transcripción,
 * resumen y qué comparte con la persona. El botón «Rellenar con IA» está presente
 * pero deshabilitado hasta configurar la IA (fase siguiente).
 *
 * Las sesiones son PRIVADAS del manager (se guardan bajo /leaders/{uid}/o2o); el
 * componente recibe `persistence` ya acotada a ese manager, la lista `people` de su
 * equipo y la `guide` cargada (para pintar las preguntas a responder).
 */
import { LitElement, html, css } from 'lit';
import { skeletonLines } from '../app-skeleton.js';
import {
  listSessions, createSession, updateSession, removeSession,
} from '../../tools/o2o/application/usecases/sessions.js';
import { getPersonProfile } from '../../lib/firestore.js';

const todayISO = () => new Date().toISOString().slice(0, 10);

export class O2ORegister extends LitElement {
  static properties = {
    persistence: { attribute: false },
    people: { attribute: false },
    roles: { attribute: false },
    guide: { attribute: false },
    periodId: { attribute: false },
    canEdit: { attribute: false },
    _personId: { state: true },
    _sessions: { state: true },
    _loadingList: { state: true },
    _draft: { state: true },
    _saving: { state: true },
    _error: { state: true },
    _confirmDelete: { state: true },
    _rmProfile: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .row { display: flex; gap: 0.75rem; align-items: end; flex-wrap: wrap; margin-bottom: 1rem; }
    label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; color: var(--rm-muted, #6b7280); }
    select, input[type='date'], textarea, input[type='text'] {
      font: inherit; padding: 0.45rem 0.6rem; border: 1px solid var(--rm-border, #d1d5db);
      border-radius: 8px; background: var(--rm-field, #eef2f6); color: var(--rm-text, #111827); width: 100%;
    }
    textarea { min-height: 3.5rem; resize: vertical; }
    .btn {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827);
      border-radius: 8px; padding: 0.45rem 0.9rem; font: inherit; font-weight: 600; cursor: pointer;
    }
    .btn.primary { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: #fff; }
    .btn.danger { color: var(--rm-danger, #dc2626); border-color: var(--rm-danger, #dc2626); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .item {
      display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
      border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.6rem 0.85rem;
    }
    .item .meta { font-size: 0.9rem; }
    .item .sub { font-size: 0.78rem; color: var(--rm-muted, #6b7280); }
    .tag { font-size: 0.72rem; border-radius: 999px; padding: 0.1rem 0.5rem; background: var(--rm-chip, #eef2f7); color: var(--rm-navy, #1e3a5f); }
    .actions { display: flex; gap: 0.4rem; }
    .form { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 12px; padding: 1rem 1.15rem; margin-top: 1rem; }
    .form h3 { margin: 0 0 0.75rem; font-size: 1rem; }
    .block { margin: 0 0 0.9rem; }
    .block > .bt { font-size: 0.85rem; font-weight: 600; color: var(--rm-navy, #1e3a5f); margin: 0 0 0.4rem; }
    .q { margin: 0 0 0.5rem; }
    .q .qt { font-size: 0.82rem; margin: 0 0 0.2rem; }
    .form-actions { display: flex; gap: 0.6rem; justify-content: flex-end; margin-top: 1rem; flex-wrap: wrap; }
    .ai-hint { font-size: 0.75rem; color: var(--rm-muted, #9ca3af); align-self: center; margin-right: auto; }
    .check { flex-direction: row; align-items: center; gap: 0.5rem; color: var(--rm-text, #111827); }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    .empty { color: var(--rm-muted, #9ca3af); font-size: 0.9rem; }
    .ext-note { font-size: 0.85rem; color: var(--rm-navy, #1e3a5f); background: var(--rm-chip, #eef2f7); border-radius: 8px; padding: 0.5rem 0.75rem; margin: 0 0 0.85rem; }
    .rm-context { font-size: 0.85rem; color: var(--rm-text, #111827); background: var(--rm-surface-hover, #eef3f5); border-left: 4px solid var(--rm-accent, #2a9d8f); border-radius: 8px; padding: 0.55rem 0.85rem; margin: 0 0 1rem; line-height: 1.5; }
  `;

  constructor() {
    super();
    this.persistence = null;
    this.people = [];
    this.roles = [];
    this.guide = null;
    this.periodId = null;
    this.canEdit = false;
    this._personId = '';
    this._sessions = [];
    this._loadingList = false;
    this._draft = null;
    this._saving = false;
    this._error = '';
    this._confirmDelete = '';
    /** @type {object|null} resumen de Role Mirror de la persona (RMR-TSK-0226) */
    this._rmProfile = null;
  }

  get _personName() {
    return this.people.find((p) => p.id === this._personId)?.name ?? '';
  }

  /** ¿La persona seleccionada es externa? Su O2O es libre (sin guía). */
  get _isExternalPerson() {
    return !!this.people.find((p) => p.id === this._personId)?.external;
  }

  async _selectPerson(personId) {
    this._personId = personId;
    this._draft = null;
    this._confirmDelete = '';
    this._error = '';
    this._rmProfile = null;
    if (!personId) {
      this._sessions = [];
      return;
    }
    this._loadingList = true;
    try {
      const [sessions, rmProfile] = await Promise.all([
        listSessions(this.persistence, personId, this.periodId),
        // Contexto de Role Mirror (RMR-TSK-0226): pie para hablar de la evolución
        // del rol en el O2O. No crítico: si falla, el registro sigue sin este dato.
        getPersonProfile(personId).catch(() => null),
      ]);
      this._sessions = sessions;
      this._rmProfile = rmProfile;
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar los O2O.';
    } finally {
      this._loadingList = false;
    }
  }

  /** Etiqueta de un rol Role Mirror por key, o el propio key si no está en catálogo. */
  _roleLabel(key) {
    return this.roles?.find((r) => r.key === key)?.label ?? key;
  }

  /** Tarjeta compacta de contexto: rol Role Mirror actual y quién lo tocó por
   * última vez, para comentarlo/ajustarlo durante el O2O (RMR-TSK-0226). */
  _renderRoleMirrorContext() {
    if (this._isExternalPerson || !this._rmProfile?.dominantRole) return null;
    const who = this._rmProfile.updatedBy?.kind === 'engineer' ? 'la propia persona' : 'el manager';
    const name = this._rmProfile.updatedBy?.name ? ` (${this._rmProfile.updatedBy.name})` : '';
    return html`<p class="rm-context">
      🔎 <strong>Role Mirror:</strong> ${this._roleLabel(this._rmProfile.dominantRole)} · ${this._rmProfile.completion ?? 0}% completado.
      Último ajuste por ${who}${name}. Es buen momento para comentar la evolución y ajustarlo entre los dos.
    </p>`;
  }

  _newDraft() {
    this._error = '';
    this._draft = {
      id: null, date: todayISO(), answers: {},
      transcript: '', privateNotes: '', summary: '', sharedSummary: '', sharedWithPerson: false,
    };
  }

  _editDraft(session) {
    this._error = '';
    const answers = Object.fromEntries((session.answers ?? []).map((a) => [a.questionId, a.answer]));
    this._draft = {
      id: session.id,
      date: session.date?.slice(0, 10) ?? todayISO(),
      answers,
      transcript: session.transcript ?? '',
      privateNotes: session.privateNotes ?? '',
      summary: session.summary ?? '',
      sharedSummary: session.sharedSummary ?? '',
      sharedWithPerson: session.sharedWithPerson ?? false,
    };
  }

  _setField(field, value) {
    this._draft = { ...this._draft, [field]: value };
  }

  _setAnswer(questionId, value) {
    this._draft = { ...this._draft, answers: { ...this._draft.answers, [questionId]: value } };
  }

  _buildAnswers() {
    return Object.entries(this._draft.answers)
      .filter(([, text]) => text?.trim())
      .map(([questionId, answer]) => ({ questionId, answer: answer.trim() }));
  }

  async _save() {
    const d = this._draft;
    if (!d) return;
    this._saving = true;
    this._error = '';
    const external = this._isExternalPerson;
    const payload = {
      personId: this._personId,
      periodId: this.periodId,
      date: d.date,
      guideVersion: external ? null : (this.guide?.version ?? null),
      answers: external ? [] : this._buildAnswers(),
      transcript: d.transcript.trim(),
      privateNotes: d.privateNotes.trim(),
      summary: d.summary.trim(),
      sharedSummary: d.sharedSummary.trim(),
      sharedWithPerson: d.sharedWithPerson,
    };
    try {
      if (d.id) await updateSession(this.persistence, d.id, payload);
      else await createSession(this.persistence, payload);
      this._draft = null;
      this._sessions = await listSessions(this.persistence, this._personId, this.periodId);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo guardar el O2O.';
    } finally {
      this._saving = false;
    }
  }

  async _delete(id) {
    this._error = '';
    try {
      await removeSession(this.persistence, id);
      this._confirmDelete = '';
      this._sessions = await listSessions(this.persistence, this._personId);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo borrar el O2O.';
    }
  }

  render() {
    return html`
      ${this._renderPicker()}
      ${this._renderRoleMirrorContext()}
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      ${this._renderBody()}
    `;
  }

  _renderPicker() {
    const options = this.people.map(
      (p) => html`<option value=${p.id} ?selected=${p.id === this._personId}>${p.name}</option>`,
    );
    return html`<div class="row">
      <label>Persona
        <select
          .value=${this._personId}
          @change=${(e) => this._selectPerson(e.target.value)}
        >
          <option value="">— Elige a alguien de tu equipo —</option>
          ${options}
        </select>
      </label>
      ${this._personId && !this._draft
        ? html`<button class="btn primary" type="button" @click=${() => this._newDraft()}>+ Nuevo O2O</button>`
        : null}
    </div>`;
  }

  _renderBody() {
    if (!this._personId) return html`<p class="empty">Elige una persona para ver y registrar sus O2O.</p>`;
    if (this._draft) return this._renderForm();
    if (this._loadingList) return skeletonLines(4);
    return this._renderList();
  }

  _renderList() {
    if (!this._sessions.length) {
      return html`<p class="empty">Aún no hay O2O con ${this._personName}. Registra el primero con «+ Nuevo O2O».</p>`;
    }
    const items = this._sessions.map((s) => this._renderSessionItem(s));
    return html`<ul class="list">${items}</ul>`;
  }

  _renderSessionItem(s) {
    const shared = s.sharedWithPerson ? html`<span class="tag">Compartido</span>` : null;
    const nAnswers = (s.answers ?? []).length;
    const confirming = this._confirmDelete === s.id;
    const delControl = confirming
      ? html`<button class="btn danger" type="button" @click=${() => this._delete(s.id)}>Confirmar</button>
             <button class="btn" type="button" @click=${() => { this._confirmDelete = ''; }}>Cancelar</button>`
      : html`<button class="btn" type="button" @click=${() => this._editDraft(s)}>Editar</button>
             <button class="btn danger" type="button" @click=${() => { this._confirmDelete = s.id; }}>Borrar</button>`;
    return html`<li class="item">
      <div class="meta">
        <div>${s.date?.slice(0, 10)} ${shared}</div>
        <div class="sub">${nAnswers} respuesta(s)${s.summary ? ' · con resumen' : ''}</div>
      </div>
      <div class="actions">${delControl}</div>
    </li>`;
  }

  _renderForm() {
    const d = this._draft;
    const external = this._isExternalPerson;
    // Un externo tiene O2O LIBRE: sin las preguntas de la guía del periodo.
    const blocks = external ? [] : (this.guide?.blocks ?? []).map((b) => this._renderAnswerBlock(b));
    return html`<div class="form">
      <h3>${d.id ? 'Editar' : 'Nuevo'} O2O con ${this._personName}</h3>
      ${external ? html`<p class="ext-note">Persona externa: O2O libre (notas y acuerdos), sin las preguntas de la guía.</p>` : null}
      <div class="row">
        <label>Fecha
          <input type="date" .value=${d.date} @change=${(e) => this._setField('date', e.target.value)} />
        </label>
      </div>

      ${blocks.length ? html`<p class="bt">Respuestas a la guía</p>${blocks}` : null}

      <div class="block">
        <p class="bt">Notas privadas (solo tú)</p>
        <textarea .value=${d.privateNotes} @input=${(e) => this._setField('privateNotes', e.target.value)}></textarea>
      </div>
      <div class="block">
        <p class="bt">Transcripción (opcional, privada)</p>
        <textarea .value=${d.transcript} @input=${(e) => this._setField('transcript', e.target.value)}></textarea>
      </div>
      <div class="block">
        <p class="bt">Resumen (privado)</p>
        <textarea .value=${d.summary} @input=${(e) => this._setField('summary', e.target.value)}></textarea>
      </div>
      <div class="block">
        <p class="bt">Resumen para compartir con la persona</p>
        <textarea .value=${d.sharedSummary} @input=${(e) => this._setField('sharedSummary', e.target.value)}></textarea>
        <label class="check">
          <input
            type="checkbox"
            .checked=${d.sharedWithPerson}
            @change=${(e) => this._setField('sharedWithPerson', e.target.checked)}
          />
          Visible para la persona en «Mi espacio»
        </label>
      </div>

      <div class="form-actions">
        <span class="ai-hint">La IA rellenará esto desde una transcripción en una fase próxima.</span>
        <button class="btn" type="button" disabled title="Disponible al configurar la IA">✨ Rellenar con IA</button>
        <button class="btn" type="button" @click=${() => { this._draft = null; }}>Cancelar</button>
        <button class="btn primary" type="button" ?disabled=${this._saving} @click=${() => this._save()}>
          ${this._saving ? 'Guardando…' : 'Guardar O2O'}
        </button>
      </div>
    </div>`;
  }

  _renderAnswerBlock(b) {
    const questions = (b.questions ?? []).map((q) => html`<div class="q">
      <p class="qt">${q.text}</p>
      <textarea
        .value=${this._draft.answers[q.id] ?? ''}
        @input=${(e) => this._setAnswer(q.id, e.target.value)}
      ></textarea>
    </div>`);
    if (!questions.length && !b.intro) return null;
    return html`<div class="block"><p class="bt">${b.title}</p>${questions}</div>`;
  }
}

if (!customElements.get('o2o-register')) {
  customElements.define('o2o-register', O2ORegister);
}
