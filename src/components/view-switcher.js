/**
 * Conmutador de vistas (RMR-TSK-0250): un superadmin o un manager (líder) puede
 * cambiar entre sus vistas para ver la app como la ve cada rol. Vive en la nav
 * (Base.astro) y solo se pinta cuando hay 2+ vistas disponibles (resolveViews).
 *
 * Las CUATRO vistas aterrizan en el hub (RMR-BUG-0104). Desde RMR-TSK-0459 todos
 * comparten el mismo hub de cards y lo personal y la administración son cards,
 * no páginas propias: lo que cambia de una vista a otra es CÓMO SE VE el hub,
 * no a qué página te lleva. Cuando cada vista tenía su página, «Ingeniero»
 * dejaba encerrado en /mi-espacio —la home redirigía allí mientras el flag
 * siguiera puesto— y volver de /admin marcaba «Manager», porque esa vista no
 * dejaba flag y se deducía de la ruta.
 *
 * El flag vive en sessionStorage ('grebla-view') y SIEMPRE es explícito, para
 * que la vista activa no dependa de en qué página estés: lo leen landing.js
 * (cómo pinta el hub) y layout.js (oculta el halo de superadmin al simular).
 */
import { LitElement, html, css } from 'lit';
import { onUserChanged } from '../lib/auth.js';
import { resolveViews } from '../lib/access.js';

const VIEW_FLAG = 'grebla-view';

/** Metadatos de cada vista: etiqueta, destino y flag de sesión que la activa. */
const VIEW_META = {
  gestion: { label: 'Admin (superadmin)', title: 'El hub con todo, incluida la administración', path: '/', flag: 'admin' },
  manager: { label: 'Manager', title: 'El hub como lo ve quien lleva un equipo', path: '/', flag: 'leader' },
  engineer: { label: 'Ingeniero', title: 'El hub como lo ve un ingeniero', path: '/', flag: 'engineer' },
  empleado: { label: 'Empleado', title: 'El hub como lo ve quien no está en ningún equipo', path: '/', flag: 'empleado' },
};

/** Vista de cada flag. Fuente única: la usan el conmutador y el hub. */
export const VIEW_BY_FLAG = { admin: 'gestion', leader: 'manager', engineer: 'engineer', empleado: 'empleado' };

/**
 * Vista activa ahora mismo. Manda el flag; la ruta solo decide en la primera
 * visita, cuando aún no se ha elegido vista.
 */
function currentView() {
  const porFlag = VIEW_BY_FLAG[sessionStorage.getItem(VIEW_FLAG)];
  if (porFlag) return porFlag;
  return location.pathname.startsWith('/admin') ? 'gestion' : 'manager';
}

export class ViewSwitcher extends LitElement {
  static properties = {
    _views: { state: true },
    _current: { state: true },
  };

  static styles = css`
    :host { display: inline-flex; }
    .switch {
      display: inline-flex;
      border: 1px solid var(--rm-border);
      border-radius: 999px;
      overflow: hidden;
      background: var(--rm-surface);
    }
    button {
      border: 0;
      background: transparent;
      color: var(--rm-muted);
      font: inherit;
      font-size: 0.8rem;
      font-weight: 600;
      padding: 0.32rem 0.7rem;
      cursor: pointer;
      transition: color 0.12s ease, background 0.12s ease;
    }
    button + button { border-left: 1px solid var(--rm-border); }
    button:hover { color: var(--rm-text); background: var(--rm-surface-hover); }
    button.on { color: var(--rm-on-accent, #fff); background: var(--rm-accent); }
    button:focus-visible { outline: 2px solid var(--rm-accent); outline-offset: 2px; }
  `;

  constructor() {
    super();
    this._views = [];
    this._current = currentView();
    this._unsub = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this._unsub = onUserChanged(async (user) => {
      try {
        const { views } = await resolveViews(user);
        // Solo tiene sentido conmutar con 2+ vistas.
        this._views = views.length >= 2 ? views : [];
      } catch {
        this._views = [];
      }
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsub?.();
  }

  /** Cambia de vista: fija el flag y lleva al hub, que es lo que se repinta. */
  _select(view) {
    const meta = VIEW_META[view];
    if (!meta) return;
    sessionStorage.setItem(VIEW_FLAG, meta.flag);
    // El flag se lee al cargar la página: estando ya en el hub hay que recargar,
    // porque `assign` a la misma URL no repinta nada y la vista no cambiaría.
    if (location.pathname === meta.path) location.reload();
    else location.assign(meta.path);
  }

  render() {
    if (this._views.length < 2) return null;
    return html`
      <div class="switch" role="group" aria-label="Cambiar de vista">
        ${this._views.map((view) => {
          const meta = VIEW_META[view];
          const on = view === this._current;
          return html`<button
            type="button"
            class=${on ? 'on' : ''}
            aria-pressed=${on}
            title=${meta.title}
            @click=${() => this._select(view)}
          >${meta.label}</button>`;
        })}
      </div>
    `;
  }
}

customElements.define('view-switcher', ViewSwitcher);
