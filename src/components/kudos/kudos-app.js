/**
 * <kudos-app> — Kudos (RMR-PCS-0032 · F2): herramienta GENERAL de la empresa.
 *
 * Dos pestañas: «Muro» (cada semana, las personas a las que se les ha dado las
 * gracias con sus mensajes públicos — SIN contadores ni ranking: no es una
 * competición) y «Dar las gracias» (persona + mensaje público y/o privado,
 * ≤280, anónimo — quien quiera puede firmar dentro del texto).
 *
 * El alta va por la CF submitKudo (ADR de anonimato); el muro lee /kudos y lo
 * agrupa el dominio (groupWallByWeek). Errores siempre visibles, nunca
 * silenciosos.
 */
import { LitElement, html, css, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { getMyPerson } from '../../lib/engineer.js';
import { listWallKudos, listKudosRecipients, submitKudo, listMyKudos, getMyPrivateMessage } from '../../lib/kudos.js';
import { KUDO_MAX_LEN, isoWeekKey, groupWallByWeek, validateKudoInput } from '../../tools/kudos/domain/kudos.js';

/** Etiqueta humana de una clave YYYY-Www. @param {string} weekKey */
const weekLabel = (weekKey) => {
  const [year, week] = weekKey.split('-W');
  return `Semana ${Number(week)} · ${year}`;
};

export class KudosApp extends LitElement {
  static properties = {
    uid: { attribute: false },
    _tab: { state: true },
    _wall: { state: true },
    _weekKey: { state: true },
    _people: { state: true },
    _error: { state: true },
    _sending: { state: true },
    _sent: { state: true },
    _form: { state: true },
    _mine: { state: true },
    _mineState: { state: true },
  };

  static styles = css`
    :host { display: block; max-width: 46rem; margin: 0 auto; }
    .seg { display: inline-flex; background: var(--rm-surface-hover, #eef3f5); border: 1px solid var(--rm-border, #dde7ec); border-radius: 999px; padding: 0.25rem; gap: 0.2rem; margin-bottom: 1.3rem; }
    .seg button { border: 0; background: transparent; font: inherit; font-size: 0.85rem; font-weight: 600; color: var(--rm-muted, #5b6b7d); padding: 0.45rem 1.05rem; border-radius: 999px; cursor: pointer; }
    .seg button[aria-selected='true'] { background: var(--gr-teal, #2a9d8f); color: #0c1420; }
    .seg button:focus-visible { outline: 2px solid var(--gr-navy, #1e3a5f); outline-offset: 2px; }
    .linkish { border: 0; background: none; padding: 0; font: inherit; color: var(--gr-teal, #2a9d8f); font-weight: 700; text-decoration: underline; cursor: pointer; }
    .error { background: color-mix(in srgb, #e76f51 12%, var(--rm-surface, #fff)); border: 1px solid #e76f51; border-radius: 8px; padding: 0.6rem 0.85rem; color: var(--rm-text, #111827); font-size: 0.88rem; }
    .empty { color: var(--rm-muted, #6b7280); }

    /* Muro */
    .weeknav { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; margin-bottom: 1rem; }
    .weeknav h2 { margin: 0; font-size: 1.05rem; color: var(--rm-navy, #1e3a5f); }
    .weeknav button { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); border-radius: 8px; font: inherit; padding: 0.3rem 0.7rem; cursor: pointer; color: var(--rm-text, #111827); }
    .weeknav button:disabled { opacity: 0.35; cursor: default; }
    .wall { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.8rem; }
    .card { border: 1px solid var(--rm-border, #e5e7eb); border-left: 4px solid var(--gr-teal, #2a9d8f); border-radius: var(--rm-radius, 12px); background: var(--rm-surface, #fff); padding: 0.85rem 1.1rem; }
    .card h3 { margin: 0; font-size: 0.98rem; color: var(--rm-navy, #1e3a5f); }
    .card h3 .thanks { font-weight: 500; color: var(--rm-muted, #6b7280); }
    .card ul { margin: 0.5rem 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.4rem; }
    .card li { font-size: 0.88rem; color: var(--rm-text, #111827); font-style: italic; }
    .card li::before { content: '“'; color: var(--gr-teal, #2a9d8f); }
    .card li::after { content: '”'; color: var(--gr-teal, #2a9d8f); }
    .private-only { font-size: 0.82rem; color: var(--rm-muted, #6b7280); margin: 0.45rem 0 0; }

    /* Formulario */
    form { display: flex; flex-direction: column; gap: 0.9rem; }
    label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.88rem; font-weight: 600; color: var(--rm-navy, #1e3a5f); }
    select, textarea { font: inherit; font-size: 0.9rem; border: 1px solid var(--rm-border, #dde7ec); border-radius: 8px; padding: 0.55rem 0.7rem; background: var(--rm-field, color-mix(in srgb, var(--rm-text, #111827) 4%, var(--rm-surface, #fff))); color: var(--rm-text, #111827); }
    select:focus, textarea:focus { background: var(--rm-surface, #fff); }
    textarea { min-height: 4.6rem; resize: vertical; }
    .hint { font-weight: 400; font-size: 0.8rem; color: var(--rm-muted, #6b7280); }
    .count { font-weight: 400; font-size: 0.78rem; color: var(--rm-muted, #6b7280); align-self: flex-end; font-variant-numeric: tabular-nums; }
    .count.over { color: #e76f51; font-weight: 700; }
    .anon { background: color-mix(in srgb, var(--gr-teal, #2a9d8f) 10%, var(--rm-surface, #fff)); border-left: 3px solid var(--gr-teal, #2a9d8f); border-radius: 0 8px 8px 0; padding: 0.55rem 0.8rem; font-size: 0.84rem; color: var(--rm-text, #111827); }
    .send { align-self: flex-start; border: 0; border-radius: 999px; background: var(--gr-teal, #2a9d8f); color: #0c1420; font: inherit; font-weight: 700; font-size: 0.92rem; padding: 0.6rem 1.4rem; cursor: pointer; }
    .send:disabled { opacity: 0.55; cursor: default; }
    .sent { background: color-mix(in srgb, var(--gr-teal, #2a9d8f) 14%, var(--rm-surface, #fff)); border: 1px solid var(--gr-teal, #2a9d8f); border-radius: var(--rm-radius, 12px); padding: 1rem 1.2rem; }
    .sent p { margin: 0 0 0.8rem; color: var(--rm-text, #111827); }
    .sent button { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); border-radius: 999px; font: inherit; font-size: 0.86rem; padding: 0.4rem 1rem; cursor: pointer; color: var(--rm-text, #111827); }
    [hidden] { display: none; }
  `;

  constructor() {
    super();
    this.uid = null;
    this._tab = 'wall';
    /** @type {import('../../lib/kudos.js').WallKudo[]|null} null = cargando. */
    this._wall = null;
    this._weekKey = isoWeekKey(new Date());
    /** @type {{ personId: string, name: string }[]|null} null = aún no cargado. */
    this._people = null;
    this._error = null;
    this._sending = false;
    this._sent = false;
    this._form = { recipientPersonId: '', publicText: '', privateText: '' };
    /** @type {{ kudo: import('../../lib/kudos.js').WallKudo, privateText: string|null }[]} */
    this._mine = [];
    /** 'idle' | 'loading' | 'ready' | 'unlinked' | 'error' */
    this._mineState = 'idle';
  }

  /** El muro se carga cuando llega el uid (tras auth + gate en client/kudos.js):
   * en connectedCallback aún no hay sesión y la primera query fallaría sin
   * reintento. @param {Map<string, unknown>} changed */
  willUpdate(changed) {
    if (changed.has('uid') && this.uid) this._loadWall();
  }

  async _loadWall() {
    if (!this.uid) return;
    try {
      this._wall = await listWallKudos();
      this._error = null;
    } catch (err) {
      console.error('[kudos] no se pudo cargar el muro:', err);
      this._wall = [];
      this._error = 'No se pudo cargar el muro de kudos. Recarga para reintentar.';
    }
  }

  /** Carga perezosa del directorio al entrar a «Dar las gracias». */
  async _openGiveTab() {
    this._tab = 'give';
    this._sent = false;
    if (this._people !== null) return;
    try {
      this._people = await listKudosRecipients();
    } catch (err) {
      console.error('[kudos] no se pudo cargar el directorio:', err);
      this._error = 'No se pudo cargar la lista de personas. Cierra y vuelve a intentarlo.';
    }
  }

  /** Carga perezosa de «Los míos»: persona vinculada → kudos recibidos → sus
   * privados (solo el titular puede leerlos; las reglas lo garantizan). */
  async _openMineTab() {
    this._tab = 'mine';
    if (this._mineState === 'ready' || this._mineState === 'loading') return;
    this._mineState = 'loading';
    try {
      const person = await getMyPerson(this.uid);
      if (!person) {
        this._mineState = 'unlinked';
        return;
      }
      const kudos = await listMyKudos(person.id);
      this._mine = await Promise.all(
        kudos.map(async (kudo) => ({
          kudo,
          privateText: kudo.hasPrivate ? await getMyPrivateMessage(kudo.id) : null,
        })),
      );
      this._mineState = 'ready';
    } catch (err) {
      console.error('[kudos] no se pudieron cargar mis kudos:', err);
      this._mineState = 'error';
    }
  }

  /** Semanas navegables: las presentes en el muro más la actual. */
  get _weeks() {
    const keys = new Set((this._wall ?? []).map((k) => k.weekKey));
    keys.add(isoWeekKey(new Date()));
    return [...keys].toSorted((a, b) => a.localeCompare(b)).toReversed();
  }

  _shiftWeek(delta) {
    const weeks = this._weeks;
    const next = weeks[weeks.indexOf(this._weekKey) + delta];
    if (next) this._weekKey = next;
  }

  async _submit(event) {
    event.preventDefault();
    const input = {
      recipientPersonId: this._form.recipientPersonId,
      publicText: this._form.publicText,
      privateText: this._form.privateText,
    };
    try {
      validateKudoInput(input);
    } catch (err) {
      this._error = err.message;
      return;
    }
    this._sending = true;
    this._error = null;
    try {
      await submitKudo(input);
      this._sent = true;
      this._form = { recipientPersonId: '', publicText: '', privateText: '' };
      this._loadWall();
    } catch (err) {
      console.error('[kudos] fallo al enviar:', err);
      this._error = err.message ?? 'No se pudo enviar el kudo. Inténtalo de nuevo.';
    } finally {
      this._sending = false;
    }
  }

  /** Sincroniza el valor del select tras el render (gotcha de Lit con
   * opciones dinámicas: el value no se refleja si las option llegan después). */
  updated() {
    const select = this.renderRoot.querySelector('select');
    if (select && select.value !== this._form.recipientPersonId) {
      select.value = this._form.recipientPersonId;
    }
  }

  _renderWall() {
    if (this._wall === null) return html`<p class="empty">Cargando el muro…</p>`;
    const wall = groupWallByWeek(this._wall);
    const people = wall.get(this._weekKey) ?? [];
    const weeks = this._weeks;
    const index = weeks.indexOf(this._weekKey);
    return html`
      <div class="weeknav">
        <button @click=${() => this._shiftWeek(1)} ?disabled=${index >= weeks.length - 1} aria-label="Semana anterior">←</button>
        <h2>${weekLabel(this._weekKey)}</h2>
        <button @click=${() => this._shiftWeek(-1)} ?disabled=${index <= 0} aria-label="Semana siguiente">→</button>
      </div>
      ${people.length === 0
        ? html`<p class="empty">
            Nadie ha recibido las gracias esta semana todavía. Estrena el muro:
            <button class="linkish" @click=${this._openGiveTab}>da las tuyas</button>.
          </p>`
        : html`<ul class="wall">
            ${repeat(
              people,
              (p) => p.recipientPersonId,
              (p) => html`<li class="card">
                <h3>${p.recipientName} <span class="thanks">ha recibido las gracias</span></h3>
                ${p.messages.length > 0
                  ? html`<ul>${p.messages.map((m) => html`<li>${m}</li>`)}</ul>`
                  : html`<p class="private-only">Con mensaje privado 💌</p>`}
              </li>`,
            )}
          </ul>`}
    `;
  }

  _renderForm() {
    if (this._sent) {
      return html`<div class="sent">
        <p>💚 Gracias dadas. El kudo ya está en el muro (y el privado, de camino a su persona).</p>
        <button @click=${() => { this._sent = false; }}>Dar otro kudo</button>
      </div>`;
    }
    const over = (text) => text.length > KUDO_MAX_LEN;
    return html`
      <form @submit=${this._submit}>
        <p class="anon">
          Los kudos son <strong>anónimos</strong>: nadie verá quién los escribe.
          Si quieres que se sepa, fírmalo dentro del mensaje.
        </p>
        <label>
          ¿A quién le das las gracias?
          <select
            required
            @change=${(e) => { this._form = { ...this._form, recipientPersonId: e.target.value }; }}
          >
            <option value="" disabled selected>${this._people === null ? 'Cargando personas…' : 'Elige una persona'}</option>
            ${repeat(
              this._people ?? [],
              (p) => p.personId,
              (p) => html`<option value=${p.personId}>${p.name}</option>`,
            )}
          </select>
        </label>
        <label>
          Mensaje público
          <span class="hint">Se verá en el muro: por qué le das las gracias.</span>
          <textarea
            maxlength=${KUDO_MAX_LEN + 20}
            .value=${this._form.publicText}
            @input=${(e) => { this._form = { ...this._form, publicText: e.target.value }; }}
          ></textarea>
          <span class="count ${over(this._form.publicText) ? 'over' : ''}">${this._form.publicText.length}/${KUDO_MAX_LEN}</span>
        </label>
        <label>
          Mensaje privado
          <span class="hint">Solo lo leerá esa persona. Público, privado o ambos — al menos uno.</span>
          <textarea
            maxlength=${KUDO_MAX_LEN + 20}
            .value=${this._form.privateText}
            @input=${(e) => { this._form = { ...this._form, privateText: e.target.value }; }}
          ></textarea>
          <span class="count ${over(this._form.privateText) ? 'over' : ''}">${this._form.privateText.length}/${KUDO_MAX_LEN}</span>
        </label>
        <button class="send" type="submit" ?disabled=${this._sending}>
          ${this._sending ? 'Enviando…' : 'Dar las gracias'}
        </button>
      </form>
    `;
  }

  _renderMine() {
    if (this._mineState === 'loading' || this._mineState === 'idle') {
      return html`<p class="empty">Cargando tus kudos…</p>`;
    }
    if (this._mineState === 'unlinked') {
      return html`<p class="empty">
        Tu cuenta aún no está vinculada a una ficha de persona, así que no hay
        dónde buscar tus kudos. Pídele a un superadmin que te vincule.
      </p>`;
    }
    if (this._mineState === 'error') {
      return html`<p class="error" role="alert">No se pudieron cargar tus kudos. Recarga para reintentar.</p>`;
    }
    if (this._mine.length === 0) {
      return html`<p class="empty">Todavía no has recibido ningún kudo. Todo llega 💚</p>`;
    }
    return html`<ul class="wall">
      ${repeat(
        this._mine,
        ({ kudo }) => kudo.id,
        ({ kudo, privateText }) => html`<li class="card">
          <h3><span class="thanks">${weekLabel(kudo.weekKey)}</span></h3>
          <ul>
            ${kudo.publicText ? html`<li>${kudo.publicText}</li>` : nothing}
            ${privateText ? html`<li>💌 ${privateText}</li>` : nothing}
          </ul>
        </li>`,
      )}
    </ul>`;
  }

  render() {
    return html`
      <div class="seg" role="tablist" aria-label="Kudos">
        <button role="tab" aria-selected=${this._tab === 'wall'} @click=${() => { this._tab = 'wall'; this._loadWall(); }}>Muro</button>
        <button role="tab" aria-selected=${this._tab === 'give'} @click=${this._openGiveTab}>Dar las gracias</button>
        <button role="tab" aria-selected=${this._tab === 'mine'} @click=${this._openMineTab}>Los míos</button>
      </div>
      ${this._error ? html`<p class="error" role="alert">${this._error}</p>` : nothing}
      <div ?hidden=${this._tab !== 'wall'}>${this._renderWall()}</div>
      <div ?hidden=${this._tab !== 'give'}>${this._tab === 'give' ? this._renderForm() : nothing}</div>
      <div ?hidden=${this._tab !== 'mine'}>${this._tab === 'mine' ? this._renderMine() : nothing}</div>
    `;
  }
}

if (!customElements.get('kudos-app')) {
  customElements.define('kudos-app', KudosApp);
}
