/**
 * <survey-admin> — panel de administración de Encuestas (RMR-TSK-0325). Para
 * People (superadmin en Fase 1): lista las encuestas, permite crear/editar una
 * (título, preguntas de escala o texto, plantilla eNPS+Q12, umbral de anonimato)
 * y abrirla/cerrarla. El superadmin escribe /surveys directamente (reglas); los
 * tokens y las respuestas siguen siendo exclusivos de las Cloud Functions.
 */
import { LitElement, html, css } from 'lit';
import { skeletonLines } from '../app-skeleton.js';
import { climateTemplate } from '../../tools/survey/domain/templates.js';
import { surveyDraftErrors } from '../../tools/survey/domain/questions.js';
import { parseParticipants } from '../../tools/survey/domain/participants.js';
import {
  participationByDept, participationTotal, answerValues, textAnswers, scaleResult, segmentedScale,
} from '../../tools/survey/domain/results.js';
import {
  listSurveys, createSurvey, updateSurvey, setSurveyStatus, createSurveyTokens, listTokens, listAnswers,
} from '../../lib/survey.js';

const STATUS_LABEL = { draft: 'Borrador', open: 'Abierta', closed: 'Cerrada' };

export class SurveyAdmin extends LitElement {
  static properties = {
    _phase: { state: true }, // 'list' | 'edit'
    _surveys: { state: true },
    _loading: { state: true },
    _editId: { state: true },
    _title: { state: true },
    _questions: { state: true },
    _threshold: { state: true },
    _saving: { state: true },
    _partSurvey: { state: true },
    _partText: { state: true },
    _partTokens: { state: true },
    _partBusy: { state: true },
    _copiedAll: { state: true },
    _resSurvey: { state: true },
    _resAnswers: { state: true },
    _resTokens: { state: true },
    _resLoading: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; --teal: var(--rm-accent, #2a9d8f); color: var(--rm-text, #1e3a5f); }
    h2 { font-size: 1.15rem; margin: 0 0 1rem; }
    .lead { color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; margin: 0 0 1rem; }
    button { font: inherit; cursor: pointer; border-radius: 8px; font-weight: 600; }
    .primary { background: var(--teal); border: 1px solid var(--teal); color: var(--rm-on-accent, #fff); padding: 0.5rem 1.1rem; }
    .primary:disabled { opacity: 0.5; cursor: default; }
    .ghost { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-text, #1e3a5f); padding: 0.4rem 0.8rem; font-size: 0.82rem; }
    .ghost:hover { border-color: var(--teal); color: var(--rm-accent-700, var(--teal)); }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { text-align: left; padding: 0.55rem 0.5rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #5b6b7d); font-weight: 600; font-size: 0.78rem; }
    .chip { display: inline-block; font-size: 0.7rem; font-weight: 700; padding: 0.1rem 0.5rem; border-radius: 999px; }
    .chip.draft { background: var(--rm-surface-hover, #eef3f5); color: var(--rm-muted, #5b6b7d); }
    .chip.open { background: color-mix(in srgb, var(--teal) 16%, transparent); color: var(--rm-accent-700, var(--teal)); }
    .chip.closed { background: #fdecea; color: #b42318; }
    .row-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .toolbar { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 1.2rem; align-items: center; }
    .field { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 1rem; }
    .field label { font-size: 0.82rem; font-weight: 600; color: var(--rm-muted, #5b6b7d); }
    input, select { padding: 0.5rem 0.65rem; font: inherit; border: 1px solid var(--rm-border, #dde7ec); border-radius: 8px; background: var(--rm-field, var(--rm-surface, #fff)); color: var(--rm-text, #1e3a5f); }
    input:focus, select:focus { outline: none; border-color: var(--teal); background: var(--rm-surface, #fff); }
    input.title { max-width: 34rem; }
    input.num { width: 4.5rem; }
    .q { border: 1px solid var(--rm-border, #eef0f2); border-radius: 10px; padding: 0.7rem 0.8rem; margin-bottom: 0.6rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .q-top { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .q-top .kind { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--rm-muted, #5b6b7d); }
    .q-label { flex: 1 1 18rem; min-width: 0; }
    .q-opts { display: flex; gap: 0.9rem; align-items: center; flex-wrap: wrap; font-size: 0.82rem; }
    .q-opts label { display: inline-flex; align-items: center; gap: 0.3rem; }
    .q-move button, .q-del { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-muted, #5b6b7d); border-radius: 6px; padding: 0.15rem 0.5rem; font-size: 0.8rem; cursor: pointer; }
    .q-del:hover { border-color: #b42318; color: #b42318; }
    .add-row { display: flex; gap: 0.6rem; flex-wrap: wrap; margin: 0.6rem 0 1.4rem; }
    .save-row { display: flex; gap: 0.8rem; align-items: center; }
    .error { color: #b42318; font-size: 0.85rem; }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.88rem; padding: 0.5rem 0; }
    textarea { width: 100%; box-sizing: border-box; padding: 0.55rem 0.7rem; font: inherit; border: 1px solid var(--rm-border, #dde7ec); border-radius: 8px; background: var(--rm-field, var(--rm-surface, #fff)); color: var(--rm-text, #1e3a5f); resize: vertical; }
    textarea:focus { outline: none; border-color: var(--teal); background: var(--rm-surface, #fff); }
    code { background: var(--rm-surface-hover, #eef3f5); padding: 0.05rem 0.3rem; border-radius: 4px; font-size: 0.85em; }
    input.link { width: 100%; box-sizing: border-box; font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); }
    h3 { font-size: 1rem; margin: 1.4rem 0 0.6rem; color: var(--rm-text, #1e3a5f); }
    .qr { border: 1px solid var(--rm-border, #eef0f2); border-radius: 10px; padding: 0.7rem 0.85rem; margin-bottom: 0.6rem; }
    .qr-label { margin: 0 0 0.35rem; font-weight: 600; color: var(--rm-text, #1e3a5f); }
    .qr-summary { margin: 0 0 0.4rem; font-size: 0.9rem; color: var(--rm-text, #1e3a5f); }
    .dist, .seg { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.3rem; }
    .dchip { font-size: 0.78rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 6px; background: var(--rm-surface-hover, #eef3f5); color: var(--rm-muted, #5b6b7d); }
    .schip { font-size: 0.78rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 999px; background: color-mix(in srgb, var(--teal) 14%, transparent); color: var(--rm-accent-700, var(--teal)); }
    .hidden-note { font-size: 0.78rem; color: var(--rm-muted, #5b6b7d); font-style: italic; margin: 0.4rem 0 0; }
    .texts { margin: 0.2rem 0 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.9rem; color: var(--rm-text, #1e3a5f); }
  `;

  constructor() {
    super();
    this._phase = 'list';
    this._surveys = [];
    this._loading = false;
    this._editId = null;
    this._title = '';
    this._questions = [];
    this._threshold = 5;
    this._saving = false;
    this._partSurvey = null;
    this._partText = '';
    this._partTokens = [];
    this._partBusy = false;
    this._copiedAll = false;
    this._resSurvey = null;
    this._resAnswers = [];
    this._resTokens = [];
    this._resLoading = false;
    this._error = '';
    this._loaded = false;
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this._loaded) { this._loaded = true; this._loadList(); }
  }

  async _loadList() {
    this._loading = true;
    this._error = '';
    try {
      this._surveys = await listSurveys();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar las encuestas.';
    } finally {
      this._loading = false;
    }
  }

  _new() {
    this._editId = null;
    this._title = '';
    this._questions = [];
    this._threshold = 5;
    this._error = '';
    this._phase = 'edit';
  }

  _edit(survey) {
    this._editId = survey.id;
    this._title = survey.title ?? '';
    this._questions = (survey.questions ?? []).map((q) => ({ ...q }));
    this._threshold = Number.isInteger(survey.threshold) ? survey.threshold : 5;
    this._error = '';
    this._phase = 'edit';
  }

  _loadTemplate() { this._questions = climateTemplate(); }

  _addQuestion(type) {
    const q = type === 'text'
      ? { id: crypto.randomUUID(), type: 'text', required: false, label: '' }
      : { id: crypto.randomUUID(), type: 'scale', min: 1, max: 5, required: true, label: '' };
    this._questions = [...this._questions, q];
  }

  _patchQuestion(index, patch) {
    this._questions = this._questions.map((q, i) => (i === index ? { ...q, ...patch } : q));
  }

  _removeQuestion(index) {
    this._questions = this._questions.filter((_, i) => i !== index);
  }

  _moveQuestion(index, dir) {
    const to = index + dir;
    if (to < 0 || to >= this._questions.length) return;
    const next = [...this._questions];
    [next[index], next[to]] = [next[to], next[index]];
    this._questions = next;
  }

  async _save() {
    const title = this._title.trim();
    const errors = surveyDraftErrors({ title, questions: this._questions, threshold: this._threshold });
    if (errors.length) { this._error = errors[0]; return; }
    this._saving = true;
    this._error = '';
    try {
      const payload = { title, questions: this._questions, threshold: this._threshold };
      if (this._editId) await updateSurvey(this._editId, payload);
      else await createSurvey(payload);
      await this._loadList();
      this._phase = 'list';
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo guardar.';
    } finally {
      this._saving = false;
    }
  }

  async _setStatus(survey, status) {
    try {
      await setSurveyStatus(survey.id, status);
      await this._loadList();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cambiar el estado.';
    }
  }

  async _openParticipants(survey) {
    this._partSurvey = survey;
    this._partText = '';
    this._partTokens = [];
    this._error = '';
    this._phase = 'participants';
    try {
      this._partTokens = await listTokens(survey.id);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar los participantes.';
    }
  }

  async _generate() {
    const participants = parseParticipants(this._partText);
    if (!participants.length) { this._error = 'Pega al menos un email válido.'; return; }
    this._partBusy = true;
    this._error = '';
    try {
      await createSurveyTokens(this._partSurvey.id, participants);
      this._partTokens = await listTokens(this._partSurvey.id);
      this._partText = '';
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron generar los enlaces.';
    } finally {
      this._partBusy = false;
    }
  }

  _linkFor(token) {
    return `${location.origin}/encuesta?s=${this._partSurvey.id}&t=${token}`;
  }

  async _copyAll() {
    const lines = this._partTokens.map((t) => `${t.email},${this._linkFor(t.token)}`).join('\n');
    try {
      await navigator.clipboard.writeText(lines);
      this._copiedAll = true;
      setTimeout(() => { this._copiedAll = false; }, 2000);
    } catch {
      this._error = 'No se pudo copiar; selecciona el texto de la tabla a mano.';
    }
  }

  async _openResults(survey) {
    this._resSurvey = survey;
    this._resAnswers = [];
    this._resTokens = [];
    this._resLoading = true;
    this._error = '';
    this._phase = 'results';
    try {
      const [answers, tokens] = await Promise.all([listAnswers(survey.id), listTokens(survey.id)]);
      this._resAnswers = answers;
      this._resTokens = tokens;
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar los resultados.';
    } finally {
      this._resLoading = false;
    }
  }

  _renderQuestionResult(q, answers, threshold) {
    if (q.type === 'text') {
      const texts = textAnswers(answers, q.id);
      // Los textos verbatim pueden identificar a alguien: se ocultan hasta
      // alcanzar el umbral de anonimato (como los segmentos numéricos).
      if (texts.length < threshold) {
        return html`<div class="qr">
          <p class="qr-label">${q.label}</p>
          <p class="hidden-note">${texts.length} respuesta${texts.length === 1 ? '' : 's'} de texto: se ocultan hasta llegar a ${threshold} para no comprometer el anonimato.</p>
        </div>`;
      }
      return html`<div class="qr">
        <p class="qr-label">${q.label}</p>
        <ul class="texts">${texts.map((t) => html`<li>${t}</li>`)}</ul>
      </div>`;
    }
    const r = scaleResult(q, answerValues(answers, q.id));
    const seg = segmentedScale(answers, q, 'department', threshold);
    return html`<div class="qr">
      <p class="qr-label">${q.label}</p>
      <p class="qr-summary">
        ${r.enps !== null ? html`<strong>eNPS ${r.enps}</strong> · ` : null}
        ${r.n ? html`media ${r.average.toFixed(1)} · n=${r.n}` : 'sin respuestas'}
      </p>
      ${r.distribution.length ? html`<div class="dist">${r.distribution.map((d) => html`<span class="dchip">${d.value}: ${d.count}</span>`)}</div>` : null}
      ${seg.visible.length ? html`<div class="seg">${seg.visible.map((s) => html`<span class="schip">${s.key}: ${s.enps !== null ? `eNPS ${s.enps}` : `media ${s.average.toFixed(1)}`} (n=${s.count})</span>`)}</div>` : null}
      ${seg.suppressed.length ? html`<p class="hidden-note">${seg.suppressed.length} departamento${seg.suppressed.length === 1 ? '' : 's'} oculto${seg.suppressed.length === 1 ? '' : 's'} por privacidad (menos de ${threshold} respuestas).</p>` : null}
    </div>`;
  }

  _renderResults() {
    if (this._resLoading) return skeletonLines(5);
    const survey = this._resSurvey;
    const threshold = Number.isInteger(survey.threshold) ? survey.threshold : 5;
    const part = participationTotal(this._resTokens);
    const byDept = participationByDept(this._resTokens);
    return html`
      <div class="toolbar"><button class="ghost" @click=${() => { this._phase = 'list'; }}>← Volver</button></div>
      <h2>${survey.title} · Resultados</h2>
      <p class="lead">${this._resAnswers.length} respuesta${this._resAnswers.length === 1 ? '' : 's'} · participación ${part.responded}/${part.total} (${part.pct}%). Umbral de anonimato: ${threshold}.</p>
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      <h3>Participación por departamento</h3>
      ${byDept.length ? html`<table>
        <thead><tr><th>Departamento</th><th>Respondidos</th><th>%</th></tr></thead>
        <tbody>${byDept.map((d) => html`<tr><td>${d.department}</td><td>${d.responded}/${d.total}</td><td>${d.pct}%</td></tr>`)}</tbody>
      </table>` : html`<p class="empty">Aún no hay participantes cargados.</p>`}
      <h3>Resultados por pregunta</h3>
      ${this._resAnswers.length
        ? (survey.questions ?? []).map((q) => this._renderQuestionResult(q, this._resAnswers, threshold))
        : html`<p class="empty">Aún no hay respuestas.</p>`}`;
  }

  _renderList() {
    if (this._loading) return skeletonLines(4);
    return html`
      <div class="toolbar">
        <button class="primary" @click=${() => this._new()}>Nueva encuesta</button>
      </div>
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      ${this._surveys.length ? html`
        <table>
          <thead><tr><th>Encuesta</th><th>Estado</th><th>Preguntas</th><th></th></tr></thead>
          <tbody>${this._surveys.map((s) => html`<tr>
            <td>${s.title || '(sin título)'}</td>
            <td><span class="chip ${s.status}">${STATUS_LABEL[s.status] ?? s.status}</span></td>
            <td>${(s.questions ?? []).length}</td>
            <td><div class="row-actions">
              <button class="ghost" @click=${() => this._edit(s)}>Editar</button>
              <button class="ghost" @click=${() => this._openParticipants(s)}>Enlaces</button>
              <button class="ghost" @click=${() => this._openResults(s)}>Resultados</button>
              ${s.status === 'draft' ? html`<button class="ghost" @click=${() => this._setStatus(s, 'open')}>Abrir</button>` : null}
              ${s.status === 'open' ? html`<button class="ghost" @click=${() => this._setStatus(s, 'closed')}>Cerrar</button>` : null}
              ${s.status === 'closed' ? html`<button class="ghost" @click=${() => this._setStatus(s, 'open')}>Reabrir</button>` : null}
            </div></td>
          </tr>`)}</tbody>
        </table>`
        : html`<p class="empty">Aún no hay encuestas. Crea la primera.</p>`}`;
  }

  _renderQuestion(q, i) {
    return html`<div class="q">
      <div class="q-top">
        <span class="kind">${q.type === 'text' ? 'Texto' : 'Escala'}</span>
        <input class="q-label" type="text" placeholder="Enunciado de la pregunta" .value=${q.label ?? ''}
          @input=${(e) => this._patchQuestion(i, { label: e.target.value })} />
        <span class="q-move">
          <button title="Subir" @click=${() => this._moveQuestion(i, -1)}>↑</button>
          <button title="Bajar" @click=${() => this._moveQuestion(i, 1)}>↓</button>
        </span>
        <button class="q-del" title="Quitar" @click=${() => this._removeQuestion(i)}>✕</button>
      </div>
      <div class="q-opts">
        ${q.type === 'scale' ? html`
          <label>de <input class="num" type="number" .value=${String(q.min ?? 1)}
            @input=${(e) => this._patchQuestion(i, { min: Number(e.target.value) })} /></label>
          <label>a <input class="num" type="number" .value=${String(q.max ?? 5)}
            @input=${(e) => this._patchQuestion(i, { max: Number(e.target.value) })} /></label>` : null}
        <label><input type="checkbox" .checked=${q.required !== false}
          @change=${(e) => this._patchQuestion(i, { required: e.target.checked })} /> Obligatoria</label>
      </div>
    </div>`;
  }

  _renderEdit() {
    return html`
      <div class="toolbar"><button class="ghost" @click=${() => { this._phase = 'list'; }}>← Volver</button></div>
      <div class="field">
        <label for="t">Título de la encuesta</label>
        <input id="t" class="title" type="text" placeholder="p. ej. «Encuesta de clima — agosto»" .value=${this._title}
          @input=${(e) => { this._title = e.target.value; }} />
      </div>
      <div class="field">
        <label for="th">Umbral de anonimato (mínimo de respuestas por segmento)</label>
        <input id="th" class="num" type="number" min="2" .value=${String(this._threshold)}
          @input=${(e) => { this._threshold = Number(e.target.value) || 5; }} />
      </div>
      <h2>Preguntas</h2>
      ${this._questions.length
        ? this._questions.map((q, i) => this._renderQuestion(q, i))
        : html`<p class="empty">Sin preguntas. Carga la plantilla o añade una.</p>`}
      <div class="add-row">
        <button class="ghost" @click=${() => this._addQuestion('scale')}>+ Pregunta de escala</button>
        <button class="ghost" @click=${() => this._addQuestion('text')}>+ Pregunta de texto</button>
        <button class="ghost" @click=${() => this._loadTemplate()}>Cargar plantilla eNPS + Q12</button>
      </div>
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      <div class="save-row">
        <button class="primary" ?disabled=${this._saving} @click=${() => this._save()}>${this._saving ? 'Guardando…' : 'Guardar'}</button>
      </div>`;
  }

  _renderParticipants() {
    const total = this._partTokens.length;
    const responded = this._partTokens.filter((t) => t.used).length;
    return html`
      <div class="toolbar"><button class="ghost" @click=${() => { this._phase = 'list'; }}>← Volver</button></div>
      <h2>${this._partSurvey.title} · Participantes</h2>
      <p class="lead">${total} participante${total === 1 ? '' : 's'} · ${responded} ${responded === 1 ? 'ha' : 'han'} respondido. Pega el padrón y genera los enlaces personales.</p>
      <div class="field">
        <label for="pp">Una persona por línea: <code>email</code>, o <code>email,departamento</code>, o <code>email,departamento,fecha-alta</code></label>
        <textarea id="pp" rows="6" placeholder="ana@tribbuapp.com,People,2024-01-15" .value=${this._partText}
          @input=${(e) => { this._partText = e.target.value; }}></textarea>
      </div>
      <div class="save-row">
        <button class="primary" ?disabled=${this._partBusy || !this._partText.trim()} @click=${() => this._generate()}>
          ${this._partBusy ? 'Generando…' : 'Generar enlaces'}
        </button>
        ${total ? html`<button class="ghost" @click=${() => this._copyAll()}>${this._copiedAll ? '✓ Copiado' : 'Copiar todos (email, enlace)'}</button>` : null}
      </div>
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      ${total ? html`
        <table>
          <thead><tr><th>Email</th><th>Enlace personal</th><th>Estado</th></tr></thead>
          <tbody>${this._partTokens.map((t) => html`<tr>
            <td>${t.email}</td>
            <td><input class="link" type="text" readonly .value=${this._linkFor(t.token)} @focus=${(e) => e.target.select()} /></td>
            <td><span class="chip ${t.used ? 'open' : 'draft'}">${t.used ? 'Respondió' : 'Pendiente'}</span></td>
          </tr>`)}</tbody>
        </table>` : null}`;
  }

  render() {
    return html`
      <h2>Encuestas de clima</h2>
      <p class="lead">Crea y gestiona las encuestas anónimas. Solo tú (People) ves esto; las respuestas son anónimas.</p>
      ${this._phase === 'edit' ? this._renderEdit()
        : this._phase === 'participants' ? this._renderParticipants()
        : this._phase === 'results' ? this._renderResults()
        : this._renderList()}`;
  }
}

if (!customElements.get('survey-admin')) {
  customElements.define('survey-admin', SurveyAdmin);
}
