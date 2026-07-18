/**
 * <o2o-prepare> — pestaña «Preparar O2O». Unifica la preparación con IA: un único
 * «Enfoque» + «Generar con IA» que, leyendo los O2O anteriores (guía + formulario),
 * genera a la vez la nueva guía (durante) y el nuevo formulario previo (antes).
 * Debajo, dos <o2o-questions-editor> para editar y guardar cada batería.
 *
 * Props: persistence, periodId, guide, form, aiPropose (proposePrep), previousPeriods.
 */
import { LitElement, html, css } from 'lit';
import './o2o-questions-editor.js';
import { periodPrep } from '../../tools/o2o/application/aiProposal.js';

export class O2OPrepare extends LitElement {
  static properties = {
    persistence: { attribute: false },
    periodId: { attribute: false },
    guide: { attribute: false },
    form: { attribute: false },
    aiPropose: { attribute: false },
    previousPeriods: { attribute: false },
    _focus: { state: true },
    _ai: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .lead { font-size: 0.88rem; color: var(--rm-muted, #6b7280); margin: 0 0 1rem; }
    .ai { border: 1px solid var(--rm-border, #e5e7eb); border-left: 4px solid var(--rm-accent, #2a9d8f);
      border-radius: 12px; padding: 1rem; margin: 0 0 1.5rem; background: var(--rm-surface-hover, #eef3f5); }
    .ai h3 { margin: 0 0 0.5rem; font-size: 0.98rem; color: var(--rm-text, #111827); }
    .ai label { display: block; font-size: 0.8rem; color: var(--rm-muted, #6b7280); font-weight: 600; margin: 0 0 0.3rem; }
    textarea { font: inherit; width: 100%; padding: 0.5rem 0.65rem; border: 1px solid var(--rm-border, #d1d5db);
      border-radius: 8px; background: var(--rm-field, #eef2f6); color: var(--rm-text, #111827); resize: vertical; }
    .actions { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.6rem; flex-wrap: wrap; }
    .btn { border: 1px solid var(--rm-accent, #2a9d8f); background: var(--rm-accent, #2a9d8f); color: #fff;
      border-radius: 8px; padding: 0.5rem 1.1rem; font: inherit; font-size: 0.9rem; font-weight: 700; cursor: pointer; }
    .btn:disabled { opacity: 0.5; cursor: progress; }
    .hint { font-size: 0.78rem; color: var(--rm-muted, #9ca3af); }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; margin: 0.4rem 0 0; }
    section { margin: 0 0 1.75rem; }
    section > h3 { font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.04em;
      color: var(--rm-muted, #6b7280); margin: 0 0 0.5rem; }
  `;

  constructor() {
    super();
    this.persistence = null;
    this.periodId = null;
    this.guide = null;
    this.form = null;
    this.aiPropose = null;
    this.previousPeriods = [];
    this._focus = '';
    this._ai = false;
    this._error = '';
  }

  async _generate() {
    if (!this.aiPropose || this._ai) return;
    this._ai = true;
    this._error = '';
    try {
      const previousPeriods = (this.previousPeriods ?? [])
        .map((p) => periodPrep(p))
        .filter((p) => p.guide.length || p.form.length);
      const { guide, form } = await this.aiPropose({ focus: this._focus.trim(), previousPeriods });
      this._editor('guide')?.applyProposal({ groups: guide.groups });
      this._editor('form')?.applyProposal({ groups: form.groups, intro: form.intro });
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo generar con IA.';
    } finally {
      this._ai = false;
    }
  }

  _editor(kind) {
    return this.renderRoot?.querySelector(`o2o-questions-editor[data-kind="${kind}"]`);
  }

  _renderAi() {
    if (!this.aiPropose) {
      return html`<div class="ai">
        <h3>✨ Preparar con IA</h3>
        <p class="hint">La IA aún no está configurada en esta instancia. Puedes preparar la guía y el formulario a mano o importando un <code>.md</code>.</p>
      </div>`;
    }
    return html`<div class="ai">
      <h3>✨ Preparar con IA</h3>
      <label for="focus">Enfoque de este O2O</label>
      <textarea id="focus" rows="3"
        placeholder="Describe en qué quieres centrar este O2O (p. ej.: crecimiento y próxima etapa de carrera; o cerrar temas de carga y bienestar tras el último trimestre). Déjalo vacío para un enfoque general centrado en la persona."
        .value=${this._focus} @input=${(e) => { this._focus = e.target.value; }} ?disabled=${this._ai}></textarea>
      <div class="actions">
        <button class="btn" ?disabled=${this._ai} @click=${() => this._generate()}>
          ${this._ai ? 'Generando…' : '✨ Generar guía y formulario'}
        </button>
        <span class="hint">La IA lee los O2O anteriores para dar continuidad. Revisa y edita antes de guardar.</span>
      </div>
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
    </div>`;
  }

  render() {
    return html`
      <p class="lead">Prepara el O2O de este periodo: describe el enfoque y genera con IA la guía y el formulario previo a la vez, o edítalos a mano. Cada uno se guarda por separado.</p>
      ${this._renderAi()}
      <section>
        <h3>Formulario previo · lo que la persona reflexiona ANTES</h3>
        <o2o-questions-editor data-kind="form" .persistence=${this.persistence} .periodId=${this.periodId}
          kind="form" .value=${this.form}></o2o-questions-editor>
      </section>
      <section>
        <h3>Guía · temas y preguntas para el manager DURANTE el O2O</h3>
        <o2o-questions-editor data-kind="guide" .persistence=${this.persistence} .periodId=${this.periodId}
          kind="guide" .value=${this.guide}></o2o-questions-editor>
      </section>
    `;
  }
}

if (!customElements.get('o2o-prepare')) {
  customElements.define('o2o-prepare', O2OPrepare);
}
