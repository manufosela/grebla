/**
 * <admin-dashboard>
 * Panel de administración: lista de perfiles (con nombre y email), comparativa,
 * distribución de roles agregada y export CSV (cliente). Solo consulta: el
 * cuestionario se rellena en la herramienta del líder. Incluye ayudas desplegables.
 *
 * Propiedades (asignadas como propiedades JS desde la página Astro):
 *  - roles: import('../data/roles.js').Role[]
 */
import { LitElement, html, css } from 'lit';
import { getPersonProfile, getUserAccount, listSessions, deleteSession, deleteUserData } from '../lib/firestore.js';
import { createTeamContainer } from '../tools/team/composition/container.js';
import { listActivePeople } from '../tools/team/application/usecases/index.js';

const dateFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });

/** @param {unknown} ts Firestore Timestamp | number | null */
function formatDate(ts) {
  if (!ts) return '—';
  /** @type {Date|null} */
  let date = null;
  if (typeof ts === 'object' && ts !== null && typeof (/** @type {any} */ (ts).toDate) === 'function') {
    date = /** @type {any} */ (ts).toDate();
  } else if (typeof ts === 'number') {
    date = new Date(ts);
  }
  return date ? dateFmt.format(date) : '—';
}

export class AdminDashboard extends LitElement {
  static properties = {
    roles: { attribute: false },
    leaderUid: { attribute: false },
    uid: { attribute: false },
    users: { state: true },
    _confirmDelete: { state: true },
    _confirmDeleteUser: { state: true },
    selected: { state: true },
    detail: { state: true },
    loading: { state: true },
    error: { state: true },
  };

  static styles = css`
    :host { display: block; font-family: var(--rm-font, system-ui, sans-serif); color: var(--rm-text, #111827); }
    section {
      background: var(--rm-surface, #fff);
      border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px);
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.5rem;
    }
    h2 { font-size: 1.1rem; margin: 0 0 1rem; }
    .toolbar { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; margin-bottom: 1rem; }
    button {
      border: 1px solid var(--rm-border, #d1d5db);
      background: var(--rm-surface, #fff);
      color: var(--rm-text, #111827);
      border-radius: 8px;
      padding: 0.45rem 0.9rem;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
    button.primary { background: var(--rm-accent, #3b82f6); border-color: var(--rm-accent, #3b82f6); color: var(--rm-on-accent, #fff); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th, td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #6b7280); font-weight: 600; }
    tbody tr { cursor: pointer; }
    tbody tr:hover { background: var(--rm-surface-hover, #f9fafb); }
    .badge { display: inline-block; padding: 0.15rem 0.55rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700; color: #fff; }
    .muted { color: var(--rm-muted, #9ca3af); }
    .completion { font-variant-numeric: tabular-nums; }
    .dist-row { display: grid; grid-template-columns: 11ch 1fr 4ch; align-items: center; gap: 0.6rem; margin-bottom: 0.4rem; }
    .dist-track { height: 16px; background: var(--rm-track, #f3f4f6); border-radius: 6px; overflow: hidden; }
    .dist-fill { height: 100%; border-radius: 6px; }
    .compare-grid { display: grid; gap: 1rem; }
    .compare-role { }
    .compare-role h4 { margin: 0 0 0.4rem; font-size: 0.85rem; }
    .compare-bar-row { display: grid; grid-template-columns: 16ch 1fr 4ch; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; font-size: 0.8rem; }
    .compare-track { height: 10px; background: var(--rm-track, #f3f4f6); border-radius: 999px; overflow: hidden; }
    .compare-fill { height: 100%; }
    select { padding: 0.45rem 0.6rem; border-radius: 8px; border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); font-size: 0.9rem; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    .detail { border-left: 4px solid var(--rm-accent, #3b82f6); }
    .check { width: 16px; height: 16px; }
    .empty { color: var(--rm-muted, #9ca3af); padding: 1rem 0; }
    .del-btn {
      border: 1px solid var(--rm-border, #d1d5db);
      background: var(--rm-surface, #fff);
      color: var(--rm-danger, #dc2626);
      border-radius: 6px;
      padding: 0.2rem 0.6rem;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
    }
    .del-btn:hover { border-color: var(--rm-danger, #dc2626); }
    .confirm { font-size: 0.78rem; color: var(--rm-muted, #6b7280); white-space: nowrap; }
    .confirm .link-danger, .confirm .link {
      border: 0; background: none; cursor: pointer; font-weight: 700; font-size: 0.78rem; padding: 0 0.25rem;
    }
    .confirm .link-danger { color: var(--rm-danger, #dc2626); }
    .confirm .link { color: var(--rm-muted, #6b7280); }
    .phase-desc { font-size: 0.82rem; color: var(--rm-muted, #6b7280); margin-top: 0.5rem; }
    section.intro { border-left: 4px solid var(--rm-accent, #2a9d8f); }
    details.help { margin: 0 0 1rem; }
    details.help summary {
      cursor: pointer; font-size: 0.85rem; font-weight: 700; color: var(--rm-accent, #2a9d8f);
      list-style: none; user-select: none; padding: 0.15rem 0;
    }
    details.help summary::-webkit-details-marker { display: none; }
    details.help summary:hover { text-decoration: underline; }
    details.help summary:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; border-radius: 4px; }
    details.help .help-body { font-size: 0.85rem; color: var(--rm-text, #111827); line-height: 1.5; margin-top: 0.5rem; }
    details.help .help-body p { margin: 0 0 0.5rem; }
    details.help .help-body ol { margin: 0.25rem 0 0.5rem; padding-left: 1.2rem; }
    details.help .help-body li { margin: 0 0 0.3rem; }
  `;

  constructor() {
    super();
    /** @type {import('../data/roles.js').Role[]} */
    this.roles = [];
    /** @type {string|null} */
    this.uid = null;
    /** @type {string|null} uid del líder dueño de las personas */
    this.leaderUid = null;
    this._loaded = false;
    /** @type {Array<Object>} */
    this.users = [];
    /** @type {Set<string>} */
    this.selected = new Set();
    /** @type {{ user: Object, sessions: Array<Object> }|null} */
    this.detail = null;
    /** @type {string|null} sessionId pendiente de confirmar borrado */
    this._confirmDelete = null;
    /** @type {string|null} uid de usuario pendiente de confirmar borrado */
    this._confirmDeleteUser = null;
    this.loading = true;
    this.error = '';
  }

  /** @param {Map<string, unknown>} changed */
  updated(changed) {
    // Carga los perfiles solo cuando hay sesión y líder resueltos,
    // para no chocar con las reglas de seguridad antes de autenticarse.
    if (this.uid && this.leaderUid && !this._loaded) {
      this._loaded = true;
      this._loadUsers();
    }
  }

  async _loadUsers() {
    if (!this.leaderUid) return;
    this.loading = true;
    this.error = '';
    try {
      const { persistence } = await createTeamContainer({ mode: 'firestore', leaderUid: this.leaderUid });
      const people = await listActivePeople(persistence);
      this.users = await Promise.all(
        people.map(async (p) => {
          const [prof, account] = await Promise.all([getPersonProfile(p.id), getUserAccount(p.uid)]);
          // El nombre real vive en la Person; el email, en la cuenta vinculada (/users/{uid}).
          const base = { id: p.id, name: p.name, email: account?.email ?? null };
          return prof ? { ...base, ...prof } : base;
        }),
      );
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudieron cargar los perfiles.';
    } finally {
      this.loading = false;
    }
  }

  get _roleByKey() {
    return new Map(this.roles.map((r) => [r.key, r]));
  }

  _roleLabel(key) {
    return this._roleByKey.get(key)?.label ?? '—';
  }

  _roleColor(key) {
    return this._roleByKey.get(key)?.color ?? '#9ca3af';
  }

  /** Etiqueta de atribución (RMR-TSK-0226): quién hizo este cambio. */
  _editorLabel(updatedBy) {
    if (!updatedBy?.kind) return '—';
    const who = updatedBy.kind === 'engineer' ? 'Ingeniero' : 'Líder';
    return updatedBy.name ? `${who} · ${updatedBy.name}` : who;
  }

  async _openDetail(user) {
    this.detail = { user, sessions: [] };
    try {
      const sessions = await listSessions(user.id);
      // Solo mediciones con contenido: las sesiones vacías no son puntos del
      // histórico (evita la "evolución absurda" de cuestionarios sin rellenar).
      const measurements = sessions.filter(
        (s) => (s.completion ?? 0) > 0 || s.dominantRole || (s.answers && Object.keys(s.answers).length > 0),
      );
      this.detail = { user, sessions: measurements };
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo cargar el detalle.';
    }
  }

  _renderDeleteCell(userId, sessionId) {
    if (this._confirmDelete === sessionId) {
      return html`
        <span class="confirm">¿Borrar?
          <button class="link-danger" @click=${() => this._deleteMeasurement(userId, sessionId)}>Sí</button>
          <button class="link" @click=${() => { this._confirmDelete = null; }}>No</button>
        </span>
      `;
    }
    return html`<button class="del-btn" @click=${() => { this._confirmDelete = sessionId; }}>Borrar</button>`;
  }

  async _deleteMeasurement(userId, sessionId) {
    this._confirmDelete = null;
    this.error = '';
    const user = this.detail?.user;
    try {
      await deleteSession(userId, sessionId);
      await this._loadUsers();
      if (user) await this._openDetail(user);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo borrar la medición.';
    }
  }

  _renderDeleteUserCell(uid) {
    if (this._confirmDeleteUser === uid) {
      return html`
        <span class="confirm">¿Borrar usuario?
          <button class="link-danger" @click=${() => this._deleteUser(uid)}>Sí</button>
          <button class="link" @click=${() => { this._confirmDeleteUser = null; }}>No</button>
        </span>
      `;
    }
    return html`<button class="del-btn" @click=${() => { this._confirmDeleteUser = uid; }}>Borrar usuario</button>`;
  }

  async _deleteUser(uid) {
    this._confirmDeleteUser = null;
    this.error = '';
    try {
      await deleteUserData(uid);
      if (this.detail?.user?.id === uid) this.detail = null;
      await this._loadUsers();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo borrar el usuario.';
    }
  }

  _toggleSelect(uid, checked) {
    const next = new Set(this.selected);
    if (checked) next.add(uid);
    else next.delete(uid);
    this.selected = next;
  }

  _exportCsv() {
    const roleKeys = this.roles.map((r) => r.key);
    const header = ['Nombre', 'Email', 'Rol dominante', ...roleKeys.map((k) => `% ${k}`), 'Completitud', 'Última actualización'];
    const rows = this.users.map((u) => {
      const affinities = u.affinities ?? {};
      return [
        u.name ?? '',
        u.email ?? '',
        this._roleLabel(u.dominantRole),
        ...roleKeys.map((k) => (affinities[k] ?? '')),
        u.completion ?? '',
        formatDate(u.updatedAt),
      ];
    });
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\r\n');

    // Generación en cliente sin backend: Blob + URL.createObjectURL.
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'role-mirror-perfiles.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  render() {
    if (this.loading) return html`<p class="empty">Cargando perfiles…</p>`;
    return html`
      ${this.error ? html`<p class="error">${this.error}</p>` : null}
      ${this._renderIntro()}
      ${this._renderProfiles()}
      ${this.detail ? this._renderDetail() : null}
      ${this._renderCompare()}
      ${this._renderDistribution()}
    `;
  }

  /** Bloque de ayuda desplegable (opcional): se abre para leer cómo actuar. */
  _help(title, content) {
    return html`<details class="help">
      <summary>ℹ️ ${title}</summary>
      <div class="help-body">${content}</div>
    </details>`;
  }

  /** Intro general: qué es Role Mirror y quién hace qué (superadmin vs líder). */
  _renderIntro() {
    return html`<section class="intro">
      ${this._help('¿Cómo funciona Role Mirror? (empieza por aquí)', html`
        <p><strong>Role Mirror es un diagnóstico, no una asignación manual de roles.</strong></p>
        <ol>
          <li>El <strong>líder</strong> rellena un <strong>cuestionario sobre cada ingeniero</strong> en la herramienta Role Mirror (no aquí, sino en «Role Mirror» del menú).</li>
          <li>El sistema <strong>calcula</strong> el «rol dominante» a partir de las respuestas (Engineer, Tech Lead, Staff Engineer…). Nadie lo fija a mano.</li>
          <li>Cada <strong>ingeniero</strong> ve su resultado en <strong>solo lectura</strong> en «Mi espacio»; no lo edita.</li>
        </ol>
        <p><strong>Superadmin vs líder:</strong> el <strong>superadmin</strong> gestiona toda la organización (este panel, altas y borrados); el <strong>líder</strong> gestiona su equipo y rellena los cuestionarios. En esta instancia una misma persona puede ser ambos: como superadmin puedes «usar como líder» para entrar en las herramientas.</p>
        <p>Este panel es solo de <strong>consulta</strong>: aquí ves los resultados de todo el equipo, comparas y exportas, pero el cuestionario se rellena en la herramienta del líder.</p>
      `)}
    </section>`;
  }

  _renderProfilesHelp() {
    return this._help('¿Qué muestra esta tabla?', html`
      <p>Un perfil por persona de tu equipo. <strong>Completitud</strong> = % del cuestionario respondido; el <strong>rol dominante</strong> es el de mayor afinidad en su último cuestionario. Pulsa una fila para ver su histórico de mediciones. «Borrar usuario» elimina sus datos de Role Mirror.</p>
      <p>Si el email aparece vacío es que la persona aún no ha iniciado sesión con su cuenta (solo está dada de alta).</p>
    `);
  }

  _renderProfiles() {
    return html`
      <section>
        ${this._renderProfilesHelp()}
        <h2>Perfiles (${this.users.length})</h2>
        <div class="toolbar">
          <button class="primary" @click=${this._exportCsv} ?disabled=${this.users.length === 0}>
            Exportar CSV
          </button>
          <button @click=${this._loadUsers}>Recargar</button>
        </div>
        ${this.users.length === 0
          ? html`<p class="empty">Aún no hay perfiles.</p>`
          : html`
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Última sesión</th>
                    <th>Rol dominante</th>
                    <th>Completitud</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${this.users.map(
                    (u) => html`
                      <tr @click=${() => this._openDetail(u)}>
                        <td @click=${(e) => e.stopPropagation()}>
                          <input
                            class="check"
                            type="checkbox"
                            .checked=${this.selected.has(u.id)}
                            @change=${(e) => this._toggleSelect(u.id, e.target.checked)}
                          />
                        </td>
                        <td>${u.name ?? '—'}</td>
                        <td class="muted">${u.email ?? '—'}</td>
                        <td class="muted">${formatDate(u.updatedAt)}</td>
                        <td>
                          ${u.dominantRole
                            ? html`<span class="badge" style=${`background:${this._roleColor(u.dominantRole)}`}>${this._roleLabel(u.dominantRole)}</span>`
                            : html`<span class="muted">—</span>`}
                        </td>
                        <td class="completion">${u.completion ?? 0}%</td>
                        <td class="num" @click=${(e) => e.stopPropagation()}>${this._renderDeleteUserCell(u.id)}</td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
            `}
      </section>
    `;
  }

  _renderDetail() {
    const { user, sessions } = this.detail;
    return html`
      <section class="detail">
        <div class="toolbar" style="justify-content: space-between;">
          <h2>${user.displayName ?? user.email} · evolución</h2>
          <button @click=${() => (this.detail = null)}>Cerrar</button>
        </div>
        ${sessions.length === 0
          ? html`<p class="empty">Sin sesiones registradas.</p>`
          : html`
              <table>
                <thead>
                  <tr><th>Fecha</th><th>Rol dominante</th><th>Completitud</th><th>Objetivo</th><th>Editado por</th><th></th></tr>
                </thead>
                <tbody>
                  ${sessions.map(
                    (s) => html`
                      <tr>
                        <td class="muted">${formatDate(s.updatedAt)}</td>
                        <td>
                          ${s.dominantRole
                            ? html`<span class="badge" style=${`background:${this._roleColor(s.dominantRole)}`}>${this._roleLabel(s.dominantRole)}</span>`
                            : html`<span class="muted">—</span>`}
                        </td>
                        <td class="completion">${s.completion ?? 0}%</td>
                        <td class="muted">${s.targetRole ? this._roleLabel(s.targetRole) : '—'}</td>
                        <td class="muted">${this._editorLabel(s.updatedBy)}</td>
                        <td class="num">${this._renderDeleteCell(user.id, s.id)}</td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
            `}
      </section>
    `;
  }

  _renderCompare() {
    const selectedUsers = this.users.filter((u) => this.selected.has(u.id));
    return html`
      <section>
        ${this._help('¿Para qué sirve la comparativa?', html`<p>Marca 2 o más personas en la tabla de arriba (casilla de la izquierda) para ver su <strong>afinidad por cada rol</strong> lado a lado. Útil para comparar perfiles de un mismo equipo.</p>`)}
        <h2>Comparativa (${selectedUsers.length} seleccionados)</h2>
        ${selectedUsers.length < 2
          ? html`<p class="empty">Selecciona 2 o más perfiles en la tabla para compararlos.</p>`
          : html`
              <div class="compare-grid">
                ${this.roles.map((role) => {
                  const max = Math.max(1, ...selectedUsers.map((u) => (u.affinities?.[role.key] ?? 0)));
                  return html`
                    <div class="compare-role">
                      <h4 style=${`color:${role.color}`}>${role.label}</h4>
                      ${selectedUsers.map((u) => {
                        const pct = u.affinities?.[role.key] ?? 0;
                        return html`
                          <div class="compare-bar-row">
                            <span class="muted" title=${u.displayName ?? u.email}>${u.displayName ?? u.email}</span>
                            <span class="compare-track">
                              <span class="compare-fill" style=${`width:${(pct / max) * 100}%;background:${role.color}`}></span>
                            </span>
                            <span>${pct}%</span>
                          </div>
                        `;
                      })}
                    </div>
                  `;
                })}
              </div>
            `}
      </section>
    `;
  }

  _renderDistribution() {
    const counts = new Map(this.roles.map((r) => [r.key, 0]));
    for (const u of this.users) {
      if (u.dominantRole && counts.has(u.dominantRole)) {
        counts.set(u.dominantRole, counts.get(u.dominantRole) + 1);
      }
    }
    const total = this.users.length || 1;
    const max = Math.max(1, ...counts.values());
    return html`
      <section>
        ${this._help('¿Qué es esta distribución?', html`<p>Cuántas personas del equipo tienen cada rol como <strong>rol dominante</strong> (el de mayor afinidad en su último cuestionario). Sirve para ver la forma del equipo de un vistazo.</p>`)}
        <h2>Distribución de roles</h2>
        ${this.roles.map((role) => {
          const count = counts.get(role.key) ?? 0;
          return html`
            <div class="dist-row">
              <span class="muted" title=${role.label}>${role.label}</span>
              <span class="dist-track">
                <span class="dist-fill" style=${`width:${(count / max) * 100}%;background:${role.color}`}></span>
              </span>
              <span>${count}</span>
            </div>
          `;
        })}
        <p class="phase-desc">Total de perfiles con rol dominante calculado: ${this.users.filter((u) => u.dominantRole).length} / ${total}.</p>
      </section>
    `;
  }
}

if (!customElements.get('admin-dashboard')) {
  customElements.define('admin-dashboard', AdminDashboard);
}
