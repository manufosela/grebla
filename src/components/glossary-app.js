/**
 * <glossary-app>
 * Glosario buscable de términos y leyes de desarrollo, equipos y liderazgo.
 * Contenido ESTÁTICO (importado de ../data/glossary.js): no hay Firestore ni
 * props obligatorias, así que funciona para cualquier persona logada.
 *
 * Un buscador filtra en vivo por término, alias o descripción (sin acentos,
 * case-insensitive) mediante la utilidad pura filterGlossary. Solo se pintan
 * las categorías con resultados; si no hay ninguno, se muestra un aviso.
 */
import { LitElement, html, css } from 'lit';
import { GLOSSARY } from '../data/glossary.js';
import { filterGlossary, countTerms } from '../lib/glossarySearch.js';

export class GlossaryApp extends LitElement {
  static properties = {
    /** Texto actual del buscador. */
    query: { state: true },
  };

  static styles = css`
    :host {
      display: block;
      font-family: var(--rm-font, system-ui, sans-serif);
      color: var(--rm-text, #1e3a5f);
    }

    /* Barra de búsqueda */
    .search {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem 1rem;
      margin-bottom: 1.5rem;
    }
    .search-field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      flex: 1 1 20rem;
    }
    .search-field label {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--rm-muted, #5b6b7d);
    }
    input[type='search'] {
      width: 100%;
      padding: 0.6rem 0.85rem;
      font: inherit;
      color: var(--rm-text, #1e3a5f);
      background: var(--rm-surface, #fff);
      border: 1px solid var(--rm-border, #dde7ec);
      border-radius: var(--rm-radius, 14px);
    }
    input[type='search']:focus-visible {
      outline: 2px solid var(--rm-accent, #2a9d8f);
      outline-offset: 1px;
      border-color: var(--rm-accent, #2a9d8f);
    }
    .count {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--rm-muted, #5b6b7d);
      white-space: nowrap;
    }

    /* Categorías */
    .category {
      margin: 0 0 2rem;
    }
    .category-title {
      font-size: 1.1rem;
      margin: 0 0 0.9rem;
      color: var(--rm-brand, #1e3a5f);
      border-bottom: 1px solid var(--rm-border, #dde7ec);
      padding-bottom: 0.4rem;
    }

    /* Rejilla de tarjetas de término (colapsa a 1 columna en móvil) */
    .terms {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
      gap: 0.85rem;
    }
    .term-card {
      background: var(--rm-surface, #fff);
      border: 1px solid var(--rm-border, #dde7ec);
      border-left: 4px solid var(--rm-accent, #2a9d8f);
      border-radius: var(--rm-radius, 14px);
      padding: 0.85rem 1rem;
    }
    .term-head {
      margin: 0 0 0.35rem;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.4rem;
    }
    .term-name {
      font-weight: 700;
      color: var(--rm-text, #1e3a5f);
    }
    .term-aka {
      font-size: 0.82rem;
      color: var(--rm-muted, #5b6b7d);
    }
    .term-desc {
      margin: 0;
      font-size: 0.9rem;
      line-height: 1.5;
      color: var(--rm-text, #1e3a5f);
    }

    .empty {
      margin: 0;
      padding: 1.5rem;
      text-align: center;
      color: var(--rm-muted, #5b6b7d);
      background: var(--rm-surface, #fff);
      border: 1px dashed var(--rm-border, #dde7ec);
      border-radius: var(--rm-radius, 14px);
    }
  `;

  constructor() {
    super();
    /** @type {string} */
    this.query = '';
  }

  /**
   * Actualiza la consulta con lo tecleado en el buscador.
   * @param {InputEvent} event Evento `input` del campo de búsqueda.
   */
  _onInput(event) {
    this.query = /** @type {HTMLInputElement} */ (event.target).value;
  }

  render() {
    // Categorías visibles según la búsqueda y su recuento de términos.
    const categories = filterGlossary(GLOSSARY, this.query);
    const total = countTerms(categories);

    return html`
      <div class="search">
        <div class="search-field">
          <label for="glossary-search">Buscar término, ley o concepto</label>
          <input
            id="glossary-search"
            type="search"
            placeholder="Ej.: Conway, sesgo, priorización…"
            autocomplete="off"
            aria-describedby="glossary-count"
            .value=${this.query}
            @input=${this._onInput}
          />
        </div>
        <p id="glossary-count" class="count" role="status" aria-live="polite">
          ${total} ${total === 1 ? 'término' : 'términos'}
        </p>
      </div>

      ${categories.length === 0
        ? html`<p class="empty">Sin resultados para «${this.query.trim()}».</p>`
        : categories.map(
            (category) => html`
              <section class="category" aria-labelledby=${`cat-${category.id}`}>
                <h2 id=${`cat-${category.id}`} class="category-title">${category.title}</h2>
                <ul class="terms">
                  ${category.terms.map(
                    (term) => html`
                      <li class="term-card">
                        <p class="term-head">
                          <span class="term-name">${term.term}</span>
                          ${term.aka ? html`<span class="term-aka">${term.aka}</span>` : null}
                        </p>
                        <p class="term-desc">${term.desc}</p>
                      </li>
                    `,
                  )}
                </ul>
              </section>
            `,
          )}
    `;
  }
}

if (!customElements.get('glossary-app')) {
  customElements.define('glossary-app', GlossaryApp);
}
