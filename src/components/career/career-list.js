/**
 * <career-list> — la vista LISTA de la ruta de carrera (RMR-TSK-0205): para quien
 * NO quiere jugar, solo consultar y seguir su ruta. Muestra arriba «Mi ruta» (las
 * paradas planificadas o la ruta sugerida, en orden) y debajo todos los temas
 * agrupados por isla → comarca, cada uno con badges de estado (completado, en tu
 * ruta, actual, disponible, bloqueado, avalado). En desuso atenuado.
 *
 * Es un tercer «mapa»: recibe los datos por props (ya cargados por career-app) y
 * al pulsar un tema emite `select-city` ({cityId}, bubbles + composed) — el mismo
 * contrato que <career-map>, así career-app pinta el panel de detalle igual que en
 * el modo plano. No carga datos ni toca Firestore.
 *
 * Propiedades:
 *  - archipelago: { islands: IslandRef[] } índice del archipiélago (orden y nombres).
 *  - islandMaps: Map<string, CareerMap> mapas por isla YA cargados.
 *  - journey: Journey global (visitedCities, currentCity, plannedRoute).
 *  - routeCityIds: string[] ids de la ruta a listar arriba (planificada o sugerida).
 *  - endorsements: Endorsements avales del manager por casa.
 *  - selected: string|null cityId seleccionado (para resaltar la fila).
 */
import { LitElement, html, css, nothing } from 'lit';
import { topicState, groupTopicsByArea, resolveRoute } from '../../tools/career/domain/listView.js';

export class CareerListView extends LitElement {
  static properties = {
    archipelago: { attribute: false },
    islandMaps: { attribute: false },
    journey: { attribute: false },
    routeCityIds: { attribute: false },
    endorsements: { attribute: false },
    selected: { attribute: false },
  };

  static styles = css`
    :host { display: block; }
    .wrap { display: grid; gap: 1.4rem; }
    .block h3 { margin: 0 0 0.6rem; font-size: 1rem; color: var(--rm-navy, #1e3a5f); }
    .topics { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }
    .island { margin-bottom: 0.9rem; }
    .island > h4 { margin: 0.6rem 0 0.3rem; font-size: 0.95rem; color: var(--rm-text, #1a1a1a); }
    .area > h5 {
      margin: 0.55rem 0 0.25rem; font-size: 0.72rem; font-weight: 700; color: var(--rm-muted, #667085);
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .hint { color: var(--rm-muted, #667085); font-size: 0.85rem; margin: 0; }
    .hint.small { font-size: 0.78rem; }

    .topic {
      display: flex; align-items: center; gap: 0.55rem; width: 100%; text-align: left;
      background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: 10px; padding: 0.5rem 0.7rem; cursor: pointer; font: inherit;
      color: var(--rm-text, #1a1a1a);
    }
    .topic:hover { border-color: var(--rm-accent, #2a9d8f); }
    .topic:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .topic[aria-current='true'] {
      border-color: var(--rm-accent, #2a9d8f);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--rm-accent, #2a9d8f) 30%, transparent);
    }
    .topic.dep { opacity: 0.5; }
    .num {
      flex: 0 0 auto; width: 1.5rem; height: 1.5rem; border-radius: 50%;
      background: var(--rm-navy, #1e3a5f); color: #fff; display: grid; place-items: center;
      font-size: 0.72rem; font-weight: 700;
    }
    .name { flex: 1 1 auto; font-weight: 600; }
    .badges { display: flex; gap: 0.3rem; flex-wrap: wrap; justify-content: flex-end; }
    .badge {
      font-size: 0.66rem; font-weight: 700; padding: 0.08rem 0.44rem; border-radius: 999px;
      border: 1px solid transparent; white-space: nowrap;
    }
    .badge.done { background: var(--rm-accent, #2a9d8f); color: #fff; }
    .badge.available { background: var(--rm-coral, #f2887a); color: #fff; }
    .badge.current { background: var(--rm-coral-600, #e26d5e); color: #fff; }
    .badge.blocked { background: var(--rm-track, #d7dee2); color: var(--rm-muted, #667085); }
    .badge.route { background: transparent; border-color: var(--rm-accent, #2a9d8f); color: var(--rm-accent, #2a9d8f); }
    .badge.endorsed { background: var(--rm-navy, #1e3a5f); color: #fff; }
    .badge.dep { background: transparent; color: var(--rm-muted, #667085); border-color: var(--rm-border, #d7dee2); }
  `;

  /** Badge principal (excluyente) según el estado del tema. Lógica en JS, no en la plantilla. */
  static _primaryBadge(st) {
    if (st.deprecated) return { cls: 'dep', label: 'En desuso' };
    if (st.done) return { cls: 'done', label: '✓ Completado' };
    if (st.current) return { cls: 'current', label: 'Aquí' };
    if (st.available) return { cls: 'available', label: 'Disponible' };
    return { cls: 'blocked', label: 'Bloqueado' };
  }

  /** Badges adicionales (no excluyentes): en la ruta y avalado. */
  static _extraBadges(st, showRoute) {
    const out = [];
    if (showRoute && st.inRoute) out.push({ cls: 'route', label: 'En tu ruta' });
    if (st.endorsed) out.push({ cls: 'endorsed', label: '✓ Avalado' });
    return out;
  }

  _select(cityId) {
    this.dispatchEvent(new CustomEvent('select-city', { detail: { cityId }, bubbles: true, composed: true }));
  }

  /**
   * Una fila de tema. `index` (1-based) numera las paradas de «Mi ruta»; `showRoute`
   * pinta el badge «En tu ruta» (se omite dentro de la propia sección Mi ruta).
   */
  _renderTopic(city, map, { index, showRoute } = {}) {
    const st = topicState(city, { map, journey: this.journey, endorsements: this.endorsements });
    const primary = CareerListView._primaryBadge(st);
    const extras = CareerListView._extraBadges(st, showRoute);
    const selected = this.selected === city.id;
    return html`<li>
      <button
        type="button"
        class=${st.deprecated ? 'topic dep' : 'topic'}
        aria-current=${selected ? 'true' : nothing}
        @click=${() => this._select(city.id)}
      >
        ${index == null ? nothing : html`<span class="num">${index}</span>`}
        <span class="name">${city.name}</span>
        <span class="badges">
          <span class="badge ${primary.cls}">${primary.label}</span>
          ${extras.map((e) => html`<span class="badge ${e.cls}">${e.label}</span>`)}
        </span>
      </button>
    </li>`;
  }

  _renderRoute() {
    const stops = resolveRoute(this.routeCityIds ?? [], this.islandMaps ?? new Map());
    if (stops.length === 0) {
      return html`<p class="hint">
        Aún no tienes ruta planificada. Añade paradas desde «Plano» o «Isla 3D», o pide a tu manager una ruta recomendada para tu rol y nivel.
      </p>`;
    }
    return html`<ol class="topics">
      ${stops.map(({ city, map }, i) => this._renderTopic(city, map, { index: i + 1, showRoute: false }))}
    </ol>`;
  }

  _renderIslands() {
    const maps = this.islandMaps ?? new Map();
    const islands = this.archipelago?.islands?.length
      ? this.archipelago.islands
      : [...maps.keys()].map((id) => ({ id, name: maps.get(id)?.name ?? id }));
    return islands.map((isl) => {
      const map = maps.get(isl.id);
      if (!map) {
        return html`<div class="island"><h4>${isl.name}</h4><p class="hint small">Cargando temas…</p></div>`;
      }
      const groups = groupTopicsByArea(map);
      return html`<div class="island">
        <h4>${isl.name}</h4>
        ${groups.map(
          (g) => html`<div class="area">
            <h5>${g.area.name}</h5>
            <ul class="topics">${g.cities.map((c) => this._renderTopic(c, map, { showRoute: true }))}</ul>
          </div>`,
        )}
      </div>`;
    });
  }

  render() {
    return html`<div class="wrap">
      <section class="block">
        <h3>Mi ruta</h3>
        ${this._renderRoute()}
      </section>
      <section class="block">
        <h3>Todos los temas</h3>
        ${this._renderIslands()}
      </section>
    </div>`;
  }
}

if (!customElements.get('career-list')) {
  customElements.define('career-list', CareerListView);
}
