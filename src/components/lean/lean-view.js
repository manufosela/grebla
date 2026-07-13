/**
 * Base común de las vistas de LEAN que leen el summary de flujo y pueden
 * recalcular desde Linear (Métricas y Atascos). Centraliza props, estado, carga
 * y la barra de recálculo para no duplicarlo en cada componente.
 */
import { LitElement } from 'lit';
import { getFlowSummary } from '../../tools/lean/application/usecases.js';
import { lastComputedAt, renderRecalcBar, runRecalc } from './recalc-bar.js';

export class LeanView extends LitElement {
  static properties = {
    persistence: { attribute: false },
    refresh: { attribute: false },
    _summary: { state: true },
    _loading: { state: true },
    _refreshing: { state: true },
    _error: { state: true },
  };

  constructor() {
    super();
    this.persistence = null;
    this.refresh = null;
    this._summary = null;
    this._loading = false;
    this._refreshing = false;
    this._error = '';
    this._loaded = false;
  }

  /** Mensaje de error de carga; las subclases lo especializan. */
  get _loadError() {
    return 'No se pudieron cargar los datos.';
  }

  updated(changed) {
    if (changed.has('persistence') && this.persistence && !this._loaded) {
      this._loaded = true;
      this._load();
    }
  }

  async _load() {
    this._loading = true;
    this._error = '';
    try {
      this._summary = await getFlowSummary(this.persistence);
    } catch (err) {
      this._error = err instanceof Error ? err.message : this._loadError;
    } finally {
      this._loading = false;
    }
  }

  /** Recalcula desde Linear (Cloud Function inyectada) y recarga. */
  _refresh() {
    return runRecalc(this);
  }

  /** Barra de acción: recalcular desde Linear + fecha del último cálculo. */
  _renderBar() {
    return renderRecalcBar({
      refresh: this.refresh,
      refreshing: this._refreshing,
      computedAt: lastComputedAt(this._summary),
      onRefresh: () => this._refresh(),
    });
  }
}
