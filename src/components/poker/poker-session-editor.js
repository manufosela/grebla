/**
 * <poker-session-editor> — editar una sesión de Scrum Poker ya creada
 * (RMR-TSK-0526): nombre, escala, si vota el organizador y la lista de tareas
 * (añadir, renombrar, quitar, reordenar). Trabaja sobre un BORRADOR y solo al
 * guardar emite `save` con lo que hay que escribir; `cancel` cierra sin tocar
 * nada. Las tareas ya estimadas se ven con su valor y no se pueden quitar.
 *
 * Props: session (la sesión tal cual está en Firestore).
 * Eventos: save ({ name, scale, ownerVotes, tasks, currentTaskId }), cancel.
 */
import { LitElement, html, css } from 'lit';
import { POKER_SCALES } from '../../tools/poker/domain/deck.js';
import { appendTask, retitleTask, removeTask, moveTask, pickCurrent } from '../../tools/poker/domain/tasks.js';

export class PokerSessionEditor extends LitElement {
  static properties = {
    session: { attribute: false },
    _name: { state: true },
    _scale: { state: true },
    _ownerVotes: { state: true },
    _tasks: { state: true },
    _newTask: { state: true },
  };

  static styles = css`
    :host { display: block; --teal: var(--rm-accent, #2a9d8f); }
    .form { display: flex; flex-direction: column; gap: 0.8rem; }
    label.field { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; color: var(--rm-muted, #5b6b7d); }
    input[type="text"] { padding: 0.5rem 0.7rem; font: inherit; border: 1px solid var(--rm-border, #dde7ec); border-radius: 8px; background: var(--rm-field, var(--rm-surface, #fff)); color: var(--rm-text, #1e3a5f); width: 100%; box-sizing: border-box; }
    input[type="text"]:focus { outline: none; border-color: var(--teal); background: var(--rm-surface, #fff); }
    .row { display: flex; gap: 1.2rem; flex-wrap: wrap; align-items: center; font-size: 0.9rem; color: var(--rm-text, #1e3a5f); }
    .row label { display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; }
    .hint { margin: 0; font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); }
    h4 { margin: 0.4rem 0 0; font-size: 0.9rem; color: var(--rm-text, #1e3a5f); }
    ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
    li { display: grid; grid-template-columns: 2.2rem 1fr auto; gap: 0.5rem; align-items: center; }
    li .est { text-align: center; font-weight: 800; color: var(--rm-accent-700, var(--teal)); }
    li .done { padding: 0.45rem 0.2rem; color: var(--rm-text, #1e3a5f); }
    .ctl { display: inline-flex; gap: 0.25rem; }
    button { font: inherit; cursor: pointer; border-radius: 8px; border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-text, #1e3a5f); padding: 0.3rem 0.6rem; font-size: 0.8rem; font-weight: 600; }
    button:hover:not(:disabled) { border-color: var(--teal); color: var(--rm-accent-700, var(--teal)); }
    button:disabled { opacity: 0.45; cursor: default; }
    button.primary { background: var(--teal); border-color: var(--teal); color: var(--rm-on-accent, #fff); padding: 0.5rem 1.1rem; }
    button.primary:hover:not(:disabled) { color: var(--rm-on-accent, #fff); filter: brightness(1.06); }
    .add { display: grid; grid-template-columns: 1fr auto; gap: 0.5rem; }
    .actions { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 0.4rem; }
  `;

  constructor() {
    super();
    this.session = null;
    this._name = '';
    this._scale = POKER_SCALES[0].id;
    this._ownerVotes = true;
    this._tasks = [];
    this._newTask = '';
  }

  /** El borrador arranca de la sesión cada vez que se abre con otra. */
  willUpdate(changed) {
    if (changed.has('session') && this.session) {
      this._name = this.session.name ?? '';
      this._scale = this.session.scale ?? POKER_SCALES[0].id;
      this._ownerVotes = this.session.ownerVotes !== false;
      this._tasks = (this.session.tasks ?? []).map((t) => ({ ...t }));
      this._newTask = '';
    }
  }

  /** Un título vacío no es un cambio: se devuelve el anterior al campo en vez de guardar nada en silencio. */
  _retitle(task, input) {
    const title = String(input.value ?? '').trim();
    if (!title) { input.value = task.title; return; }
    this._tasks = retitleTask(this._tasks, task.id, title);
  }

  _add() {
    const { tasks, task } = appendTask(this._tasks, this._newTask);
    if (!task) return;
    this._tasks = tasks;
    this._newTask = '';
  }

  _save() {
    if (!this._name.trim()) return;
    this.dispatchEvent(new CustomEvent('save', {
      detail: {
        name: this._name.trim(),
        scale: this._scale,
        ownerVotes: this._ownerVotes,
        tasks: this._tasks,
        currentTaskId: pickCurrent(this._tasks, this.session?.currentTaskId ?? null),
      },
    }));
  }

  _renderTask(task, i) {
    const pendiente = task.value == null;
    const etiquetas = {
      campo: `Tarea ${i + 1}`,
      subir: `Subir ${task.title}`,
      bajar: `Bajar ${task.title}`,
      quitar: `Quitar ${task.title}`,
    };
    const campo = pendiente
      ? html`<input type="text" maxlength="160" aria-label=${etiquetas.campo} .value=${task.title}
          @change=${(e) => this._retitle(task, e.target)} />`
      : html`<span class="done">${task.title}</span>`;
    return html`<li>
      <span class="est">${pendiente ? '·' : task.value}</span>
      ${campo}
      <span class="ctl">
        <button type="button" title="Subir" aria-label=${etiquetas.subir} ?disabled=${i === 0}
          @click=${() => { this._tasks = moveTask(this._tasks, task.id, -1); }}>↑</button>
        <button type="button" title="Bajar" aria-label=${etiquetas.bajar} ?disabled=${i === this._tasks.length - 1}
          @click=${() => { this._tasks = moveTask(this._tasks, task.id, 1); }}>↓</button>
        <button type="button" title=${pendiente ? 'Quitar' : 'Ya estimada: no se quita'} aria-label=${etiquetas.quitar} ?disabled=${!pendiente}
          @click=${() => { this._tasks = removeTask(this._tasks, task.id); }}>✕</button>
      </span>
    </li>`;
  }

  render() {
    const escalaCambia = this.session && this._scale !== (this.session.scale ?? POKER_SCALES[0].id);
    return html`<div class="form">
      <label class="field"><span>Nombre</span>
        <input type="text" maxlength="120" .value=${this._name} @input=${(e) => { this._name = e.target.value; }} /></label>
      <div class="row">
        ${POKER_SCALES.map((s) => html`<label title=${s.hint}><input type="radio" name="scale" .checked=${this._scale === s.id}
          @change=${() => { this._scale = s.id; }} /> ${s.label}</label>`)}
      </div>
      ${escalaCambia ? html`<p class="hint">Al cambiar la escala, los votos ya emitidos con otras cartas dejan de contar: conviene volver a votar.</p>` : null}
      <div class="row"><label><input type="checkbox" .checked=${this._ownerVotes}
        @change=${(e) => { this._ownerVotes = e.target.checked; }} /> Yo también voto</label></div>
      <h4>Tareas a estimar</h4>
      ${this._tasks.length ? html`<ol>${this._tasks.map((t, i) => this._renderTask(t, i))}</ol>` : html`<p class="hint">Sin tareas: se votará con el título de cada votación.</p>`}
      <div class="add">
        <input type="text" maxlength="160" placeholder="Añadir tarea…" aria-label="Nueva tarea" .value=${this._newTask}
          @input=${(e) => { this._newTask = e.target.value; }}
          @keydown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); this._add(); } }} />
        <button type="button" @click=${() => this._add()} ?disabled=${!this._newTask.trim()}>Añadir</button>
      </div>
      <div class="actions">
        <button type="button" @click=${() => this.dispatchEvent(new CustomEvent('cancel'))}>Cancelar</button>
        <button type="button" class="primary" @click=${() => this._save()} ?disabled=${!this._name.trim()}>Guardar cambios</button>
      </div>
    </div>`;
  }
}

if (!customElements.get('poker-session-editor')) {
  customElements.define('poker-session-editor', PokerSessionEditor);
}
