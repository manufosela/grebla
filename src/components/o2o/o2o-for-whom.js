/**
 * <o2o-for-whom> — pestaña «Para quién» de un O2O (RMR-TSK-0664). La rama del
 * manager con una casilla por persona: los directos arriba y el resto debajo,
 * con de quién depende. Cada cambio emite `change` con los ids marcados; quien
 * lo monta lo guarda.
 */
import { LitElement, html, css } from 'lit';
import { forWhomView, togglePerson } from '../../tools/o2o/domain/forWhom.js';

export class O2OForWhom extends LitElement {
  static properties = {
    people: { attribute: false },
    myUid: { attribute: false },
    personIds: { attribute: false },
  };

  static styles = css`
    :host { display: block; }
    .lead { font-size: 0.88rem; color: var(--rm-muted, #5b6b7d); margin: 0 0 1rem; }
    fieldset { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.6rem 0.9rem; margin: 0 0 1rem; }
    legend { font-weight: 700; color: var(--rm-navy, #1e3a5f); padding: 0 0.35rem; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 0.35rem 1rem; }
    label { display: flex; align-items: center; gap: 0.5rem; color: var(--rm-text, #111827); cursor: pointer; }
    .boss { font-size: 0.78rem; color: var(--rm-muted, #5b6b7d); }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; }
  `;

  constructor() {
    super();
    this.people = [];
    this.myUid = '';
    this.personIds = [];
  }

  _toggle(id) {
    this.dispatchEvent(new CustomEvent('change', { detail: { personIds: togglePerson(this.personIds, id) } }));
  }

  _renderPerson(p) {
    return html`<li><label>
      <input type="checkbox" .checked=${this.personIds.includes(p.id)} @change=${() => this._toggle(p.id)} />
      <span>${p.name}${p.bossName ? html` <span class="boss">(de ${p.bossName})</span>` : null}</span>
    </label></li>`;
  }

  _renderGroup(title, list) {
    if (!list.length) return null;
    const marked = list.filter((p) => this.personIds.includes(p.id)).length;
    return html`<fieldset>
      <legend>${title} · ${marked} de ${list.length}</legend>
      <ul>${list.map((p) => this._renderPerson(p))}</ul>
    </fieldset>`;
  }

  render() {
    const { directs, rest } = forWhomView(this.people, this.myUid);
    if (!directs.length && !rest.length) {
      return html`<p class="empty">No hay nadie en tu rama del directorio.</p>`;
    }
    return html`
      <p class="lead">A quién haces este O2O. Tus directos vienen marcados; marca o desmarca a quien quieras de tu rama.</p>
      ${this._renderGroup('Directos', directs)}
      ${this._renderGroup('Resto de tu rama', rest)}`;
  }
}

if (!customElements.get('o2o-for-whom')) {
  customElements.define('o2o-for-whom', O2OForWhom);
}
