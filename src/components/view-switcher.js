/**
 * Conmutador de vistas (RMR-TSK-0250): un superadmin o un manager (líder) puede
 * cambiar entre sus vistas para ver la app como la ve cada rol. Vive en la nav
 * (Base.astro) y solo se pinta cuando hay 2+ vistas disponibles (resolveViews):
 *  - Gestión  → /admin        (panel de superadmin/viewer; sin flag)
 *  - Manager  → /             (herramientas de manager; flag 'leader')
 *  - Ingeniero → /mi-espacio  (su propio «Mi espacio»; flag 'engineer')
 * El flag de vista vive en sessionStorage ('grebla-view'); lo leen landing.js
 * (enrutado de la home) y layout.js (oculta el halo de superadmin fuera de
 * gestión). La vista activa se resalta según el flag y la ruta actual.
 */
import { LitElement, html, css } from 'lit';
import { onUserChanged } from '../lib/auth.js';
import { resolveViews } from '../lib/access.js';

const VIEW_FLAG = 'grebla-view';

/** Metadatos de cada vista: etiqueta, destino y flag de sesión que la activa. */
const VIEW_META = {
  gestion: { label: 'Gestión', title: 'Panel de gestión (superadmin)', path: '/admin', flag: null },
  manager: { label: 'Manager', title: 'Herramientas de manager', path: '/', flag: 'leader' },
  engineer: { label: 'Ingeniero', title: 'Mi espacio, como lo ve un ingeniero', path: '/mi-espacio', flag: 'engineer' },
};

/** Vista activa ahora mismo, derivada del flag de sesión y la ruta actual. */
function currentView() {
  const flag = sessionStorage.getItem(VIEW_FLAG);
  if (flag === 'engineer') return 'engineer';
  if (flag === 'leader') return 'manager';
  const path = location.pathname;
  if (path.startsWith('/admin')) return 'gestion';
  if (path.startsWith('/mi-espacio')) return 'engineer';
  return 'manager';
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

  /** Cambia de vista: fija el flag de sesión y navega al destino de la vista. */
  _select(view) {
    const meta = VIEW_META[view];
    if (!meta) return;
    if (meta.flag) sessionStorage.setItem(VIEW_FLAG, meta.flag);
    else sessionStorage.removeItem(VIEW_FLAG);
    location.assign(meta.path);
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
