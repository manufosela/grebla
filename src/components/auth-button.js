/**
 * <auth-button>
 * Botón de login/logout con Google. Refleja el estado de sesión y emite el
 * evento `auth-changed` con detalle { user } para que la página reaccione.
 */
import { LitElement, html, css } from 'lit';
import { onUserChanged, signInWithGoogle, signOutUser } from '../lib/auth.js';
import { resolveAccess } from '../lib/access.js';

/**
 * Etiqueta legible por rol para el badge del botón de sesión.
 * @type {Record<Exclude<import('../lib/access.js').AccessRole, null>, string>}
 */
const ROLE_LABELS = {
  superadmin: 'Superadmin',
  viewer: 'Viewer',
  leader: 'Líder',
  engineer: 'Ingeniero',
};

export class AuthButton extends LitElement {
  static properties = {
    user: { state: true },
    busy: { state: true },
    error: { state: true },
    role: { state: true },
  };

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      font-family: var(--rm-font, system-ui, sans-serif);
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      border: 1px solid var(--rm-border, #d1d5db);
      background: var(--rm-surface, #fff);
      color: var(--rm-text, #111827);
      border-radius: 999px;
      padding: 0.5rem 1rem;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    button:hover:not(:disabled) {
      background: var(--rm-surface-hover, #f3f4f6);
    }
    button:disabled {
      opacity: 0.6;
      cursor: progress;
    }
    .user {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }
    img.avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      object-fit: cover;
    }
    .name {
      font-size: 0.9rem;
      color: var(--rm-text, #111827);
      max-width: 12ch;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .role {
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 0.1rem 0.5rem;
      border-radius: 999px;
      background: var(--rm-track, #e9f0f2);
      color: var(--rm-muted, #4b5563);
    }
    .error {
      color: var(--rm-danger, #dc2626);
      font-size: 0.8rem;
    }
    svg {
      width: 18px;
      height: 18px;
    }
  `;

  constructor() {
    super();
    /** @type {import('firebase/auth').User|null} */
    this.user = null;
    this.busy = false;
    this.error = '';
    /** @type {import('../lib/access.js').AccessRole} */
    this.role = null;
    /** @type {(() => void)|null} */
    this._unsub = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this._unsub = onUserChanged(async (user) => {
      this.user = user;
      this.role = null;
      if (user) {
        try {
          const { role } = await resolveAccess(user);
          this.role = role;
        } catch {
          this.role = null;
        }
      }
      this.dispatchEvent(
        new CustomEvent('auth-changed', { detail: { user }, bubbles: true, composed: true }),
      );
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._unsub) this._unsub();
    this._unsub = null;
  }

  async _signIn() {
    this.busy = true;
    this.error = '';
    try {
      await signInWithGoogle();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Error al iniciar sesión';
    } finally {
      this.busy = false;
    }
  }

  async _signOut() {
    this.busy = true;
    this.error = '';
    try {
      await signOutUser();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Error al cerrar sesión';
    } finally {
      this.busy = false;
    }
  }

  render() {
    if (this.user) {
      return html`
        <span class="user">
          ${this.user.photoURL
            ? html`<img class="avatar" src=${this.user.photoURL} alt="" referrerpolicy="no-referrer" />`
            : null}
          <span class="name">${this.user.displayName ?? this.user.email}</span>
          ${this.role ? html`<span class="role">${ROLE_LABELS[this.role] ?? this.role}</span>` : null}
        </span>
        <button ?disabled=${this.busy} @click=${this._signOut}>Salir</button>
        ${this.error ? html`<span class="error">${this.error}</span>` : null}
      `;
    }
    return html`
      <button ?disabled=${this.busy} @click=${this._signIn}>
        ${googleIcon()} Entrar con Google
      </button>
      ${this.error ? html`<span class="error">${this.error}</span>` : null}
    `;
  }
}

function googleIcon() {
  return html`<svg viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>`;
}

if (!customElements.get('auth-button')) {
  customElements.define('auth-button', AuthButton);
}
