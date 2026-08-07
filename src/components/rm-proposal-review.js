/**
 * <rm-proposal-review> — la decisión del manager sobre la propuesta del
 * ingeniero (RM-v2 · RMR-TSK-0423). Si la persona elegida tiene una propuesta
 * ABIERTA con diferencias frente a la sesión canónica, muestra el diff
 * respuesta a respuesta (pregunta, valor del manager, valor propuesto) con una
 * marca de aceptación por ítem. «Aplicar lo aceptado» fusiona en la canónica
 * (recalculando perfil y summary, misma forma de guardado que el cuestionario)
 * y sella la propuesta como approved; «Rechazar propuesta» la sella rejected
 * sin tocar la canónica. PREVALECE SIEMPRE el manager.
 */
import { LitElement, html, css } from 'lit';
import './common/busy-overlay.js';
import {
  createSession,
  decideRmProposal,
  getRmProposal,
  listSessions,
  saveSession,
  upsertUserSummary,
} from '../lib/firestore.js';
import { applyAccepted, diffSessions, normalizeProposal } from '../lib/rmProposal.js';
import { pickActiveMeasurement } from '../lib/measurement.js';
import { computeProfile } from '../lib/scoring.js';

export class RmProposalReview extends LitElement {
  static properties = {
    personId: { attribute: false },
    personName: { attribute: false },
    items: { attribute: false },
    roles: { attribute: false },
    orgConfig: { attribute: false },
    editorUid: { attribute: false },
    editorName: { attribute: false },
    _proposal: { state: true },
    _session: { state: true },
    _accepted: { state: true },
    _busy: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .panel {
      border: 1px solid var(--rm-accent, #2a9d8f);
      border-left-width: 4px;
      border-radius: var(--rm-radius, 12px);
      background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 6%, var(--rm-surface, #fff));
      padding: 1rem 1.25rem;
      margin: 0 0 1.5rem;
      color: var(--rm-text, #111827);
    }
    h3 { margin: 0 0 0.25rem; font-size: 1rem; }
    .who { margin: 0 0 0.9rem; font-size: 0.85rem; color: var(--rm-muted, #6b7280); }
    ul { list-style: none; margin: 0 0 1rem; padding: 0; display: grid; gap: 0.55rem; }
    li { display: grid; grid-template-columns: auto 1fr; gap: 0.6rem; align-items: start; }
    li input { margin-top: 0.2rem; width: 1.05rem; height: 1.05rem; accent-color: var(--rm-accent, #2a9d8f); }
    .q { font-size: 0.88rem; font-weight: 600; margin: 0; }
    .vals { font-size: 0.85rem; margin: 0.1rem 0 0; }
    .old { color: var(--rm-muted, #6b7280); text-decoration: line-through; }
    .new { font-weight: 700; color: var(--rm-navy, #1e3a5f); }
    .row { display: flex; gap: 0.6rem; flex-wrap: wrap; }
    button {
      border-radius: 8px; padding: 0.5rem 1rem; font: inherit; font-size: 0.85rem;
      font-weight: 600; cursor: pointer; border: 1px solid var(--rm-border, #d1d5db);
      background: var(--rm-surface, #fff); color: var(--rm-text, #111827);
    }
    button.primary { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
  `;

  constructor() {
    super();
    this.personId = null;
    this.personName = '';
    this.items = [];
    this.roles = [];
    this.orgConfig = null;
    this.editorUid = null;
    this.editorName = null;
    this._proposal = null;
    this._session = null;
    /** @type {Set<string>} ids de ítems aceptados */
    this._accepted = new Set();
    this._busy = '';
    this._error = '';
  }

  updated(changed) {
    if (changed.has('personId')) this._load();
  }

  async _load() {
    this._proposal = null;
    this._session = null;
    this._error = '';
    if (!this.personId) return;
    try {
      const [proposal, sessions] = await Promise.all([
        getRmProposal(this.personId),
        listSessions(this.personId),
      ]);
      const normalized = normalizeProposal(proposal);
      if (normalized?.status !== 'open') return;
      this._session = pickActiveMeasurement(sessions) ?? null;
      this._proposal = normalized;
      this._accepted = new Set(this._diffs().map((d) => d.itemId));
    } catch {
      // Sin acceso o sin datos: el panel simplemente no aparece.
    }
  }

  _diffs() {
    return diffSessions(this._session?.answers ?? {}, this._proposal?.answers ?? {});
  }

  _questionOf(itemId) {
    return (this.items ?? []).find((i) => i.id === itemId)?.text ?? itemId;
  }

  _fmt(value) {
    if (value === null || value === undefined) return 'sin respuesta';
    if (Array.isArray(value)) return value.join(', ');
    if (value === true) return 'Sí';
    if (value === false) return 'No';
    return String(value);
  }

  _toggle(itemId, checked) {
    const next = new Set(this._accepted);
    if (checked) next.add(itemId);
    else next.delete(itemId);
    this._accepted = next;
  }

  async _apply() {
    const diffs = this._diffs();
    const acceptedIds = diffs.map((d) => d.itemId).filter((id) => this._accepted.has(id));
    this._busy = 'Aplicando la decisión…';
    this._error = '';
    try {
      const decidedBy = { uid: this.editorUid ?? null, name: this.editorName ?? null };
      if (acceptedIds.length > 0) {
        const merged = applyAccepted(this._session?.answers ?? {}, diffs, acceptedIds);
        const targetRole = this._session?.targetRole ?? this._proposal?.targetRole ?? null;
        let sessionId = this._session?.id ?? null;
        if (!sessionId) {
          sessionId = await createSession(this.personId, { answers: merged, targetRole });
        }
        // Misma forma de guardado que el cuestionario: answers + perfil derivado
        // + summary, con la atribución del manager que decide.
        const profile = computeProfile({ items: this.items, roles: this.roles, answers: merged, orgConfig: this.orgConfig ?? undefined });
        const affinities = Object.fromEntries(profile.affinities.map((a) => [a.key, Math.round(a.affinity)]));
        const updatedBy = { kind: 'leader', ...decidedBy };
        await saveSession(this.personId, sessionId, {
          answers: merged,
          targetRole,
          dominantRole: profile.dominant?.key ?? null,
          completion: Math.round(profile.completion),
          orgPhase: this.orgConfig?.phase ?? null,
          updatedBy,
        });
        await upsertUserSummary(this.personId, {
          dominantRole: profile.dominant?.key ?? null,
          completion: Math.round(profile.completion),
          affinities,
          lastSessionId: sessionId,
          updatedBy,
        });
      }
      await decideRmProposal(this.personId, {
        status: acceptedIds.length > 0 ? 'approved' : 'rejected',
        decidedBy,
        appliedItemIds: acceptedIds,
      });
      this._proposal = null;
      this.dispatchEvent(new CustomEvent('proposal-decided', { bubbles: true, composed: true }));
    } catch {
      this._error = 'No se pudo aplicar la decisión. Vuelve a intentarlo en unos minutos.';
    } finally {
      this._busy = '';
    }
  }

  async _reject() {
    this._busy = 'Registrando el rechazo…';
    this._error = '';
    try {
      await decideRmProposal(this.personId, {
        status: 'rejected',
        decidedBy: { uid: this.editorUid ?? null, name: this.editorName ?? null },
        appliedItemIds: [],
      });
      this._proposal = null;
      this.dispatchEvent(new CustomEvent('proposal-decided', { bubbles: true, composed: true }));
    } catch {
      this._error = 'No se pudo registrar el rechazo. Vuelve a intentarlo en unos minutos.';
    } finally {
      this._busy = '';
    }
  }

  render() {
    if (!this._proposal) return null;
    const diffs = this._diffs();
    if (diffs.length === 0) return null;
    const who = this._proposal.by?.name ?? this.personName ?? 'la persona';
    return html`
      <div class="panel">
        <h3>Propuesta de ${who} pendiente de decidir</h3>
        <p class="who">Ha propuesto ${diffs.length === 1 ? '1 cambio' : `${diffs.length} cambios`} sobre tu versión. Marca lo que aceptas — tu versión es la que cuenta.</p>
        <ul>
          ${diffs.map(
            (d) => html`<li>
              <input
                type="checkbox"
                id="acc-${d.itemId}"
                .checked=${this._accepted.has(d.itemId)}
                @change=${(e) => this._toggle(d.itemId, e.target.checked)}
              />
              <label for="acc-${d.itemId}">
                <p class="q">${this._questionOf(d.itemId)}</p>
                <p class="vals"><span class="old">${this._fmt(d.managerValue)}</span> → <span class="new">${this._fmt(d.proposedValue)}</span></p>
              </label>
            </li>`,
          )}
        </ul>
        ${this._error ? html`<p class="error">${this._error}</p>` : null}
        <div class="row">
          <button class="primary" ?disabled=${Boolean(this._busy)} @click=${this._apply}>Aplicar lo aceptado</button>
          <button ?disabled=${Boolean(this._busy)} @click=${this._reject}>Rechazar propuesta</button>
        </div>
      </div>
      ${this._busy ? html`<busy-overlay message=${this._busy}></busy-overlay>` : null}
    `;
  }
}

if (!customElements.get('rm-proposal-review')) {
  customElements.define('rm-proposal-review', RmProposalReview);
}
