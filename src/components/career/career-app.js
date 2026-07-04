/**
 * <career-app>
 * Shell del Mapa de Carrera: selector de PERSONA del equipo, barra de progreso/
 * nivel, el mapa de la isla y un panel de acciones/evidencias para la ciudad
 * seleccionada. Igual que Role Mirror, el líder elige a quién edita y el journey
 * se persiste en el subárbol de esa persona.
 *
 * En el modo 3D (MC-6) el detalle es un PANEL DE CIUDADANÍA overlay sobre el
 * canvas (lateral en escritorio, hoja inferior en móvil): estado como insignia
 * de juego, prerequisitos que faltan, y las MISMAS acciones/evidencias/
 * recomendaciones que la vista plana (métodos de render compartidos, sin
 * duplicar lógica). El zoom al hacer clic lo anima <career-island-3d> por
 * sí solo; aquí solo se invoca `focusOverview()` desde el botón «Isla completa».
 *
 * Evidencias (MC-8): las listas (formaciones, cursos) se editan como CHIPS con
 * ✕ para quitar y un input con botón «+» (o Enter) para añadir de una en una —
 * nada de texto separado por comas. El campo `titulos` desaparece de la UI:
 * los títulos existentes se muestran fusionados dentro de cursos y, al editar
 * cursos, se escriben en `cursos` vaciando `titulos` (migración suave; el
 * modelo CityEvidence no cambia).
 *
 * Primera persona (MC-7): el botón «Explorar a pie» del HUD 3D llama a
 * `enterFirstPerson()` del componente de la isla; con puntero grueso (táctil)
 * queda deshabilitado como «modo de escritorio». El evento `mode-change`
 * reduce el HUD en fps: se ocultan la barra superior (persona/vistas/progreso)
 * y solo queda el botón «Salir (Esc)». El panel de ciudadanía funciona igual
 * (se abre con E/clic desde la isla, que suelta el pointer lock; al cerrarlo,
 * un clic en el canvas lo re-engancha).
 *
 * Sonido (MC-11): el HUD 3D lleva un botón 🔊/🔇 persistente (localStorage)
 * que conmuta el audio procedural de la isla (olas, gaviotas, pasos y
 * fanfarria de ciudadanía); el motor WebAudio vive en <career-island-3d>.
 *
 * Compañeros en la isla (MC-12): el mapa individual es también el mapa del
 * EQUIPO. Al tener store y people se cargan EN PARALELO los journeys de todas
 * las personas visibles (asíncrono, 1 lectura por persona; con más de
 * MAX_TEAM_JOURNEYS se corta y se avisa por consola) y se derivan los
 * `teammates` [{personId, name, currentCity, progressPct}] — SOLO esos datos:
 * nada de lecturas ni evidencias de terceros (privacidad). La isla los pinta
 * junto a su ciudad actual; el clic sobre uno (`select-teammate`) abre aquí un
 * mini-popover DOM (uno solo a la vez; clic fuera lo cierra). El botón HUD
 * «👥 Equipo» (persistente en localStorage) los muestra/oculta.
 *
 * Archipiélago (MC-14): el mapa deja de ser una isla única — cada disciplina
 * es una isla (/careerMap/{islandId}) y el índice /careerMap/_archipelago las
 * sitúa en el MAPA DEL MAR. El journey de la persona es GLOBAL y guarda su
 * `currentIsland`: aquí se carga el mapa de esa isla y, al viajar (barca del
 * muelle, [E] Zarpar a pie o el botón «🧭 Archipiélago»), se abre un overlay
 * DOM con el mar y las islas — la actual marcada, las que aún no tienen doc
 * atenuadas como «En construcción» (se puede viajar igualmente: la isla
 * placeholder tiene playa, puerto y cartel). Elegir destino persiste
 * `currentIsland` (setCurrentIsland), recarga el mapa con un fundido de
 * travesía y el avatar aparece en el puerto de la isla nueva. Los compañeros
 * (MC-12) solo se pintan si su journey está en la MISMA isla; el progreso del
 * HUD sigue siendo el de la isla cargada.
 *
 * Onboarding (MC-13): la primera vez que se entra al mapa 3D (flag en
 * localStorage `grebla:career:onboarded`) un cartel de bienvenida overlay
 * (DOM, estilo del panel) explica qué es la isla, los controles de la vista
 * aérea y del modo a pie, y el objetivo (las casas con baliza tienen visado
 * disponible). El botón «¡A jugar!» (o Escape) lo cierra, persiste el flag y
 * no vuelve a salir; el botón «?» del HUD lo reabre cuando se quiera.
 *
 * Propiedades (inyectadas desde client/career.js):
 *  - store: CareerStore
 *  - people: { id: string, name: string }[]   personas del equipo del líder
 */
import { LitElement, html, css } from 'lit';
import './career-map.js';
import './career-island-3d.js';
import { readStoredMuted, writeStoredMuted } from './islandAudio.js';
import {
  getJourney,
  toggleVisited,
  setCurrent,
  setCurrentIsland,
  toggleRoute,
  setEvidence,
  stats,
} from '../../tools/career/application/usecases.js';
import { getCareerMap, getArchipelago, getExistingIslandIds } from '../../lib/careerMap.js';
import { DEFAULT_ISLAND_ID } from '../../tools/career/domain/types.js';
import { cityStatus, missingPrereqs, progressPct } from '../../tools/career/domain/progress.js';

export class CareerApp extends LitElement {
  static properties = {
    store: { attribute: false },
    people: { attribute: false },
    personId: { state: true },
    error: { state: true },
    journey: { state: true },
    selected: { state: true },
    loading: { state: true },
    map: { state: true },
    viewMode: { state: true },
    mode3d: { state: true },
    audioMuted: { state: true },
    teammates: { state: true },
    showTeam: { state: true },
    teammatePopover: { state: true },
    showOnboarding: { state: true },
    currentIsland: { state: true },
    archipelago: { state: true },
    existingIslands: { state: true },
    showArchipelago: { state: true },
    traveling: { state: true },
  };

  /** Clave de persistencia sencilla para el modo de vista. */
  static VIEW_MODE_KEY = 'grebla:career:viewMode';
  /** Clave de persistencia del toggle «👥 Equipo» (MC-12). */
  static TEAM_VISIBLE_KEY = 'grebla:career:teamVisible';
  /** Clave del flag «ya vio el cartel de bienvenida» (onboarding, MC-13). */
  static ONBOARDED_KEY = 'grebla:career:onboarded';
  /**
   * Tope de journeys de compañeros a cargar (MC-12): 1 lectura de Firestore
   * por persona es aceptable en equipos pequeños; con más de 25 personas
   * visibles se cargan solo las 25 primeras y se avisa por consola.
   */
  static MAX_TEAM_JOURNEYS = 25;
  /** Lista vacía ESTABLE: la isla no rehace su grupo en cada render sin equipo. */
  static EMPTY_TEAMMATES = Object.freeze([]);
  /** Duración (ms) del fundido de travesía entre islas (MC-14). */
  static TRAVEL_FADE_MS = 900;

  static styles = css`
    :host { display: flex; flex-direction: column; min-height: 0; font-family: var(--rm-font, system-ui, sans-serif); color: var(--rm-text, #111827); }
    /* En modo 3D el canvas es el protagonista: ocupa todo el alto disponible y
       el panel de ciudadanía y el HUD flotan SOBRE él (overlay). */
    .stage3d { position: relative; display: flex; flex: 1 1 auto; min-height: 0; }
    career-island-3d.stage { flex: 1 1 auto; min-height: 0; }
    .hud { position: absolute; top: 0.75rem; left: 0.75rem; z-index: 2; display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .hud button { box-shadow: 0 2px 8px rgba(17, 24, 39, 0.12); }
    .hud button:disabled { opacity: 0.6; cursor: not-allowed; }
    .citypanel {
      position: absolute;
      z-index: 3;
      top: 0.75rem;
      right: 0.75rem;
      bottom: 0.75rem;
      width: min(360px, calc(100% - 1.5rem));
      box-sizing: border-box;
      overflow-y: auto;
      overscroll-behavior: contain;
      background: color-mix(in srgb, var(--rm-surface, #fff) 90%, transparent);
      backdrop-filter: blur(6px);
      border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px);
      padding: 1rem 1.25rem;
      box-shadow: 0 10px 30px rgba(17, 24, 39, 0.18);
      outline: none;
    }
    /* En móvil el panel pasa a hoja inferior: el mapa sigue visible encima. */
    @media (max-width: 760px) {
      .citypanel { top: auto; left: 0.5rem; right: 0.5rem; bottom: 0.5rem; width: auto; max-height: 60%; }
    }
    .citypanel header { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; }
    .citypanel h3 { margin: 0; font-size: 1.05rem; }
    .citypanel .kind { margin-bottom: 0; }
    .close { border: none; background: transparent; font-size: 1.05rem; line-height: 1; padding: 0.25rem 0.45rem; color: var(--rm-muted, #6b7280); }
    .close:hover { color: var(--rm-text, #111827); background: var(--rm-track, #e9f0f2); }
    .badges { display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 0.6rem 0 0.75rem; }
    .badge { font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.55rem; border-radius: 999px; border: 1px solid transparent; }
    .badge.visited { background: var(--rm-accent, #2a9d8f); color: #fff; }
    .badge.available { background: var(--rm-coral, #f2887a); color: #fff; }
    .badge.blocked { background: var(--rm-track, #d7dee2); color: var(--rm-text, #374151); }
    .badge.deprecated { background: var(--rm-danger, #dc2626); color: #fff; }
    .badge.route { border-color: var(--rm-navy, #1e3a5f); color: var(--rm-navy, #1e3a5f); }
    .badge.current { border-color: var(--rm-coral-600, #e26d5e); color: var(--rm-coral-600, #e26d5e); }
    .blockedby { font-size: 0.78rem; color: var(--rm-muted, #6b7280); margin: 0 0 0.75rem; }
    .bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
    label { font-size: 0.8rem; color: var(--rm-muted, #6b7280); font-weight: 600; display: inline-flex; gap: 0.4rem; align-items: center; }
    select { padding: 0.4rem 0.6rem; border-radius: 8px; border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); font-size: 0.9rem; }
    .viewswitch { display: inline-flex; border: 1px solid var(--rm-border, #d1d5db); border-radius: 8px; overflow: hidden; }
    .viewswitch button { border: none; border-radius: 0; background: var(--rm-surface, #fff); color: var(--rm-muted, #6b7280); font-size: 0.8rem; font-weight: 700; padding: 0.4rem 0.7rem; cursor: pointer; }
    .viewswitch button + button { border-left: 1px solid var(--rm-border, #d1d5db); }
    .viewswitch button.active { background: var(--rm-accent, #2a9d8f); color: #fff; }
    .viewswitch button:focus-visible { outline: 2px solid var(--rm-navy, #1e3a5f); outline-offset: -2px; }
    .stat { display: flex; align-items: baseline; gap: 0.6rem; }
    .lvl { font-weight: 800; color: var(--rm-accent, #2a9d8f); }
    .pts { font-size: 0.85rem; color: var(--rm-muted, #6b7280); font-variant-numeric: tabular-nums; }
    .progress { height: 8px; background: var(--rm-track, #e9f0f2); border-radius: 999px; overflow: hidden; margin-bottom: 1rem; }
    .progress span { display: block; height: 100%; background: var(--rm-accent, #2a9d8f); border-radius: 999px; transition: width 0.3s ease; }
    .grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(220px, 1fr); gap: 1.5rem; align-items: start; }
    @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
    .panel { background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #e5e7eb); border-radius: var(--rm-radius, 12px); padding: 1rem 1.25rem; }
    .panel h3 { margin: 0 0 0.2rem; }
    .kind { font-size: 0.8rem; color: var(--rm-muted, #6b7280); margin: 0 0 0.75rem; text-transform: capitalize; }
    .actions { display: flex; flex-direction: column; gap: 0.5rem; }
    button { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); border-radius: 8px; padding: 0.5rem 0.8rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
    button.primary { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: #fff; }
    .pre { font-size: 0.78rem; color: var(--rm-muted, #9ca3af); margin: 0.75rem 0 0; }
    .hint { font-size: 0.85rem; color: var(--rm-muted, #9ca3af); }
    .legend { display: flex; flex-wrap: wrap; gap: 0.5rem 0.9rem; margin-top: 1rem; font-size: 0.72rem; color: var(--rm-muted, #6b7280); }
    .legend span { display: inline-flex; align-items: center; gap: 0.3rem; }
    .legend .d { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .legend .d.visited { background: var(--rm-accent, #2a9d8f); }
    .legend .d.reachable { background: var(--rm-coral, #f2887a); }
    .legend .d.locked { background: var(--rm-track, #d7dee2); }
    .legend .d.deprecated { background: var(--rm-danger, #dc2626); opacity: 0.55; }
    .legend .r { width: 10px; height: 10px; border-radius: 50%; display: inline-block; border: 2px solid; }
    .legend .r.current { border-color: var(--rm-coral-600, #e26d5e); }
    .legend .r.target { border-color: var(--rm-navy, #1e3a5f); }
    .empty { color: var(--rm-muted, #9ca3af); padding: 1rem 0; }
    .error { color: var(--rm-danger, #dc2626); }
    .ev { margin-top: 1rem; border-top: 1px solid var(--rm-border, #eef0f2); padding-top: 0.75rem; }
    .ev summary { margin: 0 0 0.5rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rm-muted, #6b7280); cursor: pointer; font-weight: 700; }
    .ev label { display: block; margin-bottom: 0.5rem; font-weight: 600; font-size: 0.75rem; color: var(--rm-muted, #6b7280); }
    .ev input { width: 100%; box-sizing: border-box; margin-top: 0.2rem; padding: 0.4rem 0.5rem; border-radius: 8px; border: 1px solid var(--rm-border, #d1d5db); font-size: 0.85rem; color: var(--rm-text, #111827); background: var(--rm-surface, #fff); }
    /* Listas de evidencias como chips (MC-8): ✕ para quitar, «+» para añadir. */
    .evlist { margin-bottom: 0.6rem; }
    .evtitle { display: block; font-weight: 600; font-size: 0.75rem; color: var(--rm-muted, #6b7280); margin-bottom: 0.25rem; }
    .chips { list-style: none; display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0 0 0.35rem; padding: 0; }
    .chip { display: inline-flex; align-items: center; gap: 0.25rem; background: var(--rm-track, #e9f0f2); border-radius: 999px; padding: 0.15rem 0.3rem 0.15rem 0.6rem; font-size: 0.78rem; color: var(--rm-text, #111827); }
    .chip-x { border: none; background: transparent; cursor: pointer; padding: 0.05rem 0.3rem; font-size: 0.7rem; line-height: 1; color: var(--rm-muted, #6b7280); border-radius: 999px; }
    .chip-x:hover { color: var(--rm-danger, #dc2626); background: rgba(220, 38, 38, 0.1); }
    .evadd { display: flex; gap: 0.35rem; }
    .evadd input { width: auto; flex: 1 1 auto; min-width: 0; margin-top: 0; }
    .evadd .plus { flex: 0 0 auto; padding: 0.3rem 0.75rem; font-weight: 700; font-size: 0.9rem; line-height: 1; }
    /* Mini-popover del compañero clicado en la isla (MC-12): flota sobre el
       canvas anclado al clic, por encima del HUD y bajo el panel de ciudadanía. */
    .matepop {
      position: absolute;
      z-index: 4;
      transform: translate(-50%, calc(-100% - 14px));
      min-width: 170px;
      max-width: 240px;
      background: color-mix(in srgb, var(--rm-surface, #fff) 94%, transparent);
      backdrop-filter: blur(6px);
      border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px);
      padding: 0.6rem 0.8rem;
      box-shadow: 0 8px 24px rgba(17, 24, 39, 0.2);
    }
    .matepop header { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
    .matepop strong { font-size: 0.9rem; color: var(--rm-navy, #1e3a5f); }
    .matepop p { margin: 0.3rem 0 0; font-size: 0.8rem; color: var(--rm-muted, #6b7280); }
    .matepop .pct { font-weight: 700; color: var(--rm-accent, #2a9d8f); }
    /* Cartel de bienvenida / onboarding (MC-13): overlay centrado sobre el
       mapa, por encima del panel de ciudadanía y del mini-popover. */
    .onboard-backdrop {
      position: absolute;
      inset: 0;
      z-index: 5;
      display: grid;
      place-items: center;
      background: rgba(30, 58, 95, 0.35);
      backdrop-filter: blur(2px);
    }
    .onboard {
      max-width: 480px;
      width: calc(100% - 2rem);
      max-height: calc(100% - 2rem);
      box-sizing: border-box;
      overflow-y: auto;
      background: color-mix(in srgb, var(--rm-surface, #fff) 96%, transparent);
      border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px);
      padding: 1.25rem 1.5rem;
      box-shadow: 0 14px 40px rgba(17, 24, 39, 0.28);
      outline: none;
    }
    .onboard h3 { margin: 0 0 0.35rem; font-size: 1.15rem; color: var(--rm-navy, #1e3a5f); }
    .onboard .lead { margin: 0 0 0.75rem; font-size: 0.9rem; color: var(--rm-muted, #6b7280); }
    .onboard ul { margin: 0 0 1rem; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }
    .onboard li { font-size: 0.85rem; color: var(--rm-text, #111827); }
    .onboard li strong { color: var(--rm-navy, #1e3a5f); }
    .onboard kbd {
      display: inline-block;
      padding: 0 0.35rem;
      border-radius: 4px;
      border: 1px solid var(--rm-border, #d1d5db);
      background: var(--rm-track, #e9f0f2);
      font-family: inherit;
      font-size: 0.78rem;
      font-weight: 700;
    }
    .onboard .play { width: 100%; font-size: 0.95rem; padding: 0.6rem 1rem; }
    /* Mapa del ARCHIPIÉLAGO (MC-14): modal fixed sobre toda la vista con un
       mar estilizado y las islas en su x/y del índice. */
    .sea-backdrop {
      position: fixed;
      inset: 0;
      z-index: 60;
      display: grid;
      place-items: center;
      background: rgba(30, 58, 95, 0.45);
      backdrop-filter: blur(2px);
    }
    .sea {
      width: min(760px, calc(100% - 2rem));
      max-height: calc(100% - 2rem);
      box-sizing: border-box;
      overflow-y: auto;
      background: color-mix(in srgb, var(--rm-surface, #fff) 96%, transparent);
      border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px);
      padding: 1rem 1.25rem 1.1rem;
      box-shadow: 0 14px 40px rgba(17, 24, 39, 0.28);
      outline: none;
    }
    .sea-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.6rem; }
    .sea-head h3 { margin: 0; font-size: 1.1rem; color: var(--rm-navy, #1e3a5f); }
    .sea-map {
      position: relative;
      aspect-ratio: 16 / 10;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid var(--rm-border, #e5e7eb);
      background:
        radial-gradient(circle at 22% 28%, rgba(255, 255, 255, 0.14), transparent 34%),
        radial-gradient(circle at 76% 68%, rgba(255, 255, 255, 0.1), transparent 30%),
        linear-gradient(165deg, #3f7fb4 0%, #4d90c4 45%, #2f6a9c 100%);
    }
    .isle {
      position: absolute;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.15rem;
      padding: 0.3rem 0.4rem;
      border: none;
      background: transparent;
      cursor: pointer;
      border-radius: 10px;
    }
    .isle:hover { background: rgba(255, 255, 255, 0.12); }
    .isle:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }
    .isle-dot {
      width: 30px;
      height: 30px;
      border-radius: 46% 54% 52% 48% / 55% 48% 52% 45%; /* silueta de isla, no un círculo perfecto */
      background: radial-gradient(circle at 38% 34%, #b7e0a8 0%, #9fce8f 52%, #e9dcae 78%, #dccb96 100%);
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.35), 0 5px 12px rgba(10, 30, 50, 0.35);
    }
    .isle.here .isle-dot { box-shadow: 0 0 0 3px var(--rm-coral-600, #e26d5e), 0 5px 12px rgba(10, 30, 50, 0.35); }
    .isle.wip { opacity: 0.55; }
    .isle.wip .isle-dot { filter: grayscale(0.45); }
    .isle-name {
      font-size: 0.72rem;
      font-weight: 700;
      color: #fff;
      white-space: nowrap;
      text-shadow: 0 1px 3px rgba(17, 24, 39, 0.75);
    }
    .isle-tag {
      font-size: 0.6rem;
      font-weight: 700;
      padding: 0.08rem 0.45rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.88);
      color: var(--rm-navy, #1e3a5f);
      white-space: nowrap;
    }
    .isle-tag.here { background: var(--rm-coral-600, #e26d5e); color: #fff; }
    .sea-hint { margin: 0.7rem 0 0; font-size: 0.82rem; color: var(--rm-muted, #6b7280); }
    /* Fundido de travesía entre islas (MC-14). */
    .travel-fade {
      position: fixed;
      inset: 0;
      z-index: 70;
      display: grid;
      place-items: center;
      background: linear-gradient(180deg, #16324f 0%, #1e3a5f 60%, #274b6e 100%);
      animation: travel-in 260ms ease-out both;
    }
    .travel-fade p {
      margin: 0;
      color: #fff;
      font-size: 1.15rem;
      font-weight: 700;
      animation: travel-bob 1.4s ease-in-out infinite;
    }
    @keyframes travel-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes travel-bob {
      0%, 100% { transform: translateY(0) rotate(-1deg); }
      50% { transform: translateY(-7px) rotate(1.5deg); }
    }
    .legend-wrap { margin-top: 1rem; }
    .legend-wrap summary { font-size: 0.78rem; color: var(--rm-muted, #6b7280); cursor: pointer; font-weight: 700; }
    .recs { margin: 0.75rem 0 0; padding: 0; list-style: none; font-size: 0.78rem; }
    .recs li { margin: 0.2rem 0; color: var(--rm-muted, #6b7280); }
    .recs a { color: var(--rm-accent, #2a9d8f); }
    .dep { font-size: 0.78rem; color: var(--rm-danger, #dc2626); font-weight: 600; margin: 0 0 0.5rem; }
  `;

  constructor() {
    super();
    this.store = null;
    /** @type {{ id: string, name: string }[]} */
    this.people = [];
    this.personId = null;
    this.error = '';
    this.journey = { visitedCities: [], currentCity: null, plannedRoute: [], evidences: {} };
    this.selected = null;
    this.loading = false;
    /** @type {import('../../tools/career/domain/types.js').CareerMap|null} */
    this.map = null;
    this._loadedPerson = null;
    this._mapLoaded = false;
    // Modo de vista: '3d' (isla Three.js, por defecto) o 'flat' (plano,
    // fallback). La 2.5D se retiró en MC-8.
    this.viewMode = this._readViewMode();
    // Modo de cámara del 3D (MC-7): 'aerial' | 'fps'; lo comunica la isla.
    this.mode3d = 'aerial';
    // Sonido de la isla (MC-11): preferencia persistida; el motor WebAudio
    // vive en <career-island-3d> y este botón HUD solo lo conmuta.
    this.audioMuted = readStoredMuted();
    // Compañeros en la isla (MC-12): journeys del equipo cacheados por persona
    // (1 lectura por persona, una sola vez) y lista derivada para la isla.
    /** @type {Map<string, import('../../tools/career/domain/types.js').Journey>} */
    this._teamJourneys = new Map();
    this._teamLoaded = false;
    /** @type {{ personId: string, name: string, currentCity: string, progressPct: number }[]} */
    this.teammates = CareerApp.EMPTY_TEAMMATES;
    this.showTeam = this._readTeamVisible();
    /** Mini-popover del compañero clicado (uno solo a la vez), o null. */
    this.teammatePopover = null;
    // Onboarding (MC-13): el cartel de bienvenida sale la PRIMERA vez que se
    // entra al mapa 3D; el flag de localStorage lo silencia para siempre y el
    // botón «?» del HUD lo reabre a demanda.
    this.showOnboarding = !this._readOnboarded();
    // Archipiélago (MC-14): isla actual (viene del journey de la persona),
    // índice de islas, ids con doc real (para atenuar «En construcción» en el
    // mapa del mar, cacheado por sesión), overlay abierto y fundido de viaje.
    this.currentIsland = DEFAULT_ISLAND_ID;
    /** @type {import('../../tools/career/domain/types.js').Archipelago|null} */
    this.archipelago = null;
    /** @type {Set<string>|null} */
    this.existingIslands = null;
    this.showArchipelago = false;
    this.traveling = false;
    // Puntero grueso (táctil): la primera persona necesita ratón y teclado; el
    // botón queda deshabilitado como «modo de escritorio» (controles táctiles,
    // futura mejora). Guardado con typeof por el render estático de Astro.
    this._coarsePointer =
      typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  }

  /** true si el cartel de bienvenida ya se vio (SSR cuenta como visto: en el
   * servidor no hay nada que enseñar; el cliente relee al hidratar). */
  _readOnboarded() {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem(CareerApp.ONBOARDED_KEY) === 'done';
  }

  /**
   * Cierra el cartel de bienvenida («¡A jugar!» o Escape) y persiste el flag:
   * no vuelve a salir solo. El foco vuelve al HUD para no perder el teclado.
   */
  _closeOnboarding() {
    this.showOnboarding = false;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CareerApp.ONBOARDED_KEY, 'done');
    }
    this.updateComplete.then(() => this.renderRoot.querySelector('.hud button')?.focus());
  }

  /** Botón «?» del HUD: reabre el cartel de bienvenida a demanda (MC-13). */
  _openOnboarding() {
    this.showOnboarding = true;
  }

  /** Escape dentro del cartel de bienvenida lo cierra. @param {KeyboardEvent} event */
  _onOnboardingKeydown(event) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    this._closeOnboarding();
  }

  /** Lee la preferencia del toggle «👥 Equipo» (visible por defecto, MC-12). */
  _readTeamVisible() {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem(CareerApp.TEAM_VISIBLE_KEY) !== 'hidden';
  }

  /** Botón HUD «👥 Equipo»: muestra/oculta a los compañeros y lo persiste. */
  _toggleTeam() {
    this.showTeam = !this.showTeam;
    if (!this.showTeam) this.teammatePopover = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CareerApp.TEAM_VISIBLE_KEY, this.showTeam ? 'visible' : 'hidden');
    }
  }

  /** Lee la preferencia de modo de vista sin romper SSR/estático. El valor
   * legado 'island' (2.5D, retirada en MC-8) cae al 3D. */
  _readViewMode() {
    if (typeof localStorage === 'undefined') return '3d';
    const stored = localStorage.getItem(CareerApp.VIEW_MODE_KEY);
    return stored === 'flat' ? 'flat' : '3d';
  }

  /** @param {'3d'|'flat'} mode */
  _setViewMode(mode) {
    if (mode !== '3d') this.mode3d = 'aerial'; // el modo a pie no sobrevive al cambio de vista
    this.viewMode = mode;
    if (typeof localStorage !== 'undefined') localStorage.setItem(CareerApp.VIEW_MODE_KEY, mode);
  }

  /** @param {Map<string, unknown>} changed */
  updated(changed) {
    if (changed.has('personId')) {
      this.selected = null;
      this.teammatePopover = null; // el resumen abierto era de otro contexto
    }
    if (this.store && !this._mapLoaded) {
      this._mapLoaded = true;
      this._loadMap();
    }
    if (this.store && this.personId && this._loadedPerson !== this.personId) {
      this._loadedPerson = this.personId;
      this._load();
    }
    // Compañeros (MC-12): una única carga en paralelo de los journeys del
    // equipo en cuanto hay store y personas visibles.
    if (this.store && (this.people ?? []).length > 0 && !this._teamLoaded) {
      this._teamLoaded = true;
      this._loadTeamJourneys();
    }
    // El journey propio recién cargado/mutado también refresca la caché del
    // equipo: al cambiar de persona, la anterior aparece como compañera con
    // sus últimos cambios.
    if (changed.has('journey') && this.personId) {
      this._teamJourneys.set(this.personId, this.journey);
    }
    if (changed.has('personId') || changed.has('journey') || changed.has('map')) {
      this._refreshTeammates();
    }
    // Accesibilidad del panel de ciudadanía (3D): al abrirse recibe el foco
    // (tabindex="-1"), de modo que Escape lo cierra sin pasos intermedios.
    if (changed.has('selected') && this.selected && this.viewMode === '3d') {
      this.renderRoot.querySelector('.citypanel')?.focus();
    }
    // El cartel de bienvenida recibe el foco al abrirse (tabindex="-1"): Escape
    // lo cierra sin pasos intermedios, como el panel de ciudadanía (MC-13).
    if (changed.has('showOnboarding') && this.showOnboarding) {
      this.renderRoot.querySelector('.onboard')?.focus();
    }
    // El mapa del archipiélago recibe el foco al abrirse (MC-14): Escape cierra.
    if (changed.has('showArchipelago') && this.showArchipelago) {
      this.renderRoot.querySelector('.sea')?.focus();
    }
  }

  /** Nombre de una isla según el índice del archipiélago (o '' si no está). @param {string} islandId */
  _islandName(islandId) {
    return (this.archipelago?.islands ?? []).find((i) => i.id === islandId)?.name ?? '';
  }

  /**
   * Carga el índice del archipiélago (una vez) y el mapa de la ISLA ACTUAL
   * desde Firestore; ambos con fallback a su semilla en código. Una isla sin
   * doc llega como placeholder vacío con el nombre del índice (MC-14).
   */
  async _loadMap() {
    try {
      this.archipelago ??= await getArchipelago();
      this.map = await getCareerMap(this.currentIsland, this._islandName(this.currentIsland));
    } catch (err) {
      this._mapLoaded = false;
      this.error = err instanceof Error ? err.message : 'No se pudo cargar el mapa de carrera.';
    }
  }

  async _load() {
    this.loading = true;
    this.error = '';
    try {
      this.journey = await getJourney(this.store, this.personId);
      // El journey es GLOBAL (MC-14): si esta persona está en otra isla del
      // archipiélago, se carga el mapa de SU isla.
      const island = this.journey.currentIsland ?? DEFAULT_ISLAND_ID;
      if (island !== this.currentIsland) {
        this.currentIsland = island;
        await this._loadMap();
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo cargar el mapa de esta persona.';
    } finally {
      this.loading = false;
    }
  }

  /**
   * Carga EN PARALELO los journeys de las personas visibles (MC-12). Coste: 1
   * lectura de Firestore por persona (aceptable en equipos pequeños); con más
   * de MAX_TEAM_JOURNEYS personas se cargan solo las primeras y se deja
   * constancia por consola. La persona seleccionada se salta: su journey ya lo
   * trae _load() y la caché se refresca desde updated(). Un journey ilegible
   * no tumba al resto: ese compañero no se pinta y se avisa por consola.
   */
  async _loadTeamJourneys() {
    const people = this.people ?? [];
    const capped = people.slice(0, CareerApp.MAX_TEAM_JOURNEYS);
    if (people.length > capped.length) {
      console.warn(
        `Mapa del equipo: ${people.length} personas visibles; se cargan solo los journeys de las ${CareerApp.MAX_TEAM_JOURNEYS} primeras para acotar las lecturas.`,
      );
    }
    await Promise.all(
      capped.map(async (person) => {
        if (person.id === this.personId) return;
        try {
          this._teamJourneys.set(person.id, await getJourney(this.store, person.id));
        } catch (err) {
          console.warn(`Mapa del equipo: no se pudo cargar el journey de "${person.id}".`, err);
        }
      }),
    );
    this._refreshTeammates();
  }

  /**
   * Deriva la lista de compañeros para la isla (MC-12) a partir de la caché de
   * journeys: todas las personas visibles MENOS la seleccionada, y solo
   * quienes tienen ciudad actual (sin `currentCity` no hay dónde pintarlos).
   * SOLO nombre, ciudad y % de progreso — nada sensible (privacidad).
   */
  _refreshTeammates() {
    const map = this.map;
    if (!map) {
      this.teammates = CareerApp.EMPTY_TEAMMATES;
      return;
    }
    const next = (this.people ?? [])
      .filter((p) => p.id !== this.personId)
      .map((p) => {
        const journey = this._teamJourneys.get(p.id);
        if (!journey || !journey.currentCity) return null;
        // Archipiélago (MC-14): cada compañero se pinta SOLO en su isla — si
        // está en otra, aquí no aparece (su casa ni existe en este mapa).
        if ((journey.currentIsland ?? DEFAULT_ISLAND_ID) !== this.currentIsland) return null;
        return {
          personId: p.id,
          name: p.name,
          currentCity: journey.currentCity,
          progressPct: progressPct(map, journey.visitedCities),
        };
      })
      .filter((t) => t !== null);
    this.teammates = next.length > 0 ? next : CareerApp.EMPTY_TEAMMATES;
  }

  get _map() {
    return this.map;
  }

  _changePerson(event) {
    this.personId = event.target.value || null;
    this.error = '';
  }

  _onSelect(event) {
    this.selected = event.detail.cityId;
    this.teammatePopover = null; // el panel de ciudadanía releva al mini-resumen
  }

  /**
   * Clic sobre un compañero en la isla (MC-12): abre su mini-popover anclado a
   * las coordenadas del clic (px relativos al canvas). Uno solo a la vez: el
   * anterior, si lo había, se sustituye.
   * @param {CustomEvent<{personId: string, x: number, y: number}>} event
   */
  _onSelectTeammate(event) {
    const { personId, x, y } = event.detail;
    this.teammatePopover = { personId, x, y };
  }

  /**
   * Cualquier pointerdown en el escenario 3D (canvas, HUD…) cierra el
   * mini-popover abierto: «clic fuera lo cierra». El popover detiene la
   * propagación de sus propios pointerdown; si el mismo gesto acaba sobre otro
   * compañero, el `select-teammate` posterior abre el suyo.
   */
  _onStagePointerDown() {
    if (this.teammatePopover) this.teammatePopover = null;
  }

  async _act(action) {
    if (!this.personId || !this.selected) return;
    const map = this._map;
    this.error = '';
    try {
      if (action === 'toggle') this.journey = await toggleVisited(this.store, this.personId, map, this.journey, this.selected);
      else if (action === 'current') this.journey = await setCurrent(this.store, this.personId, this.journey, this.selected);
      else if (action === 'route') this.journey = await toggleRoute(this.store, this.personId, this.journey, this.selected);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo actualizar.';
    }
  }

  /** Persiste el objeto de evidencias completo de la ciudad seleccionada. */
  async _persistEvidence(next) {
    this.error = '';
    try {
      this.journey = await setEvidence(this.store, this.personId, this.journey, this.selected, next);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudieron guardar las evidencias.';
    }
  }

  /** Guarda la experiencia previa (años) de la ciudad seleccionada. @param {string} value */
  async _saveExperience(value) {
    if (!this.personId || !this.selected) return;
    const prev = this.journey.evidences?.[this.selected] ?? {};
    await this._persistEvidence({
      ...prev,
      priorExperienceYears: value === '' ? undefined : Number(value),
    });
  }

  /**
   * Guarda una LISTA de evidencias (chips). Al editar cursos, los títulos
   * antiguos ya vienen fusionados en `values` (los muestra la UI dentro de
   * cursos), así que el campo legado `titulos` se vacía: migración suave al
   * editar, sin tocar journeys que nadie edita.
   * @param {'formaciones'|'cursos'} field
   * @param {string[]} values
   */
  async _saveEvidenceList(field, values) {
    if (!this.personId || !this.selected) return;
    const prev = this.journey.evidences?.[this.selected] ?? {};
    const next = { ...prev, [field]: values };
    if (field === 'cursos' && (prev.titulos ?? []).length > 0) next.titulos = [];
    await this._persistEvidence(next);
  }

  /**
   * Añade el valor del input de una lista de chips (botón «+» o Enter) y lo
   * limpia. Los duplicados exactos se ignoran sin error.
   * @param {'formaciones'|'cursos'} field
   * @param {string[]} values Lista actual mostrada.
   * @param {HTMLInputElement} input
   */
  _addEvidenceItem(field, values, input) {
    const value = input.value.trim();
    if (!value) return;
    input.value = '';
    if (values.includes(value)) return;
    this._saveEvidenceList(field, [...values, value]);
  }

  /**
   * Quita un chip de una lista de evidencias.
   * @param {'formaciones'|'cursos'} field
   * @param {string[]} values Lista actual mostrada.
   * @param {number} index
   */
  _removeEvidenceItem(field, values, index) {
    this._saveEvidenceList(field, values.toSpliced(index, 1));
  }

  /**
   * Cierra el panel de ciudadanía: deselecciona SIN mover la cámara (el usuario
   * sigue donde estaba) y devuelve el foco al HUD para no perder el teclado.
   * En fps el foco cae en «Salir (Esc)»; un clic en el canvas retoma el lock.
   */
  _closeCityPanel() {
    this.selected = null;
    this.updateComplete.then(() => this.renderRoot.querySelector('.hud button')?.focus());
  }

  /** Escape dentro del panel de ciudadanía lo cierra. @param {KeyboardEvent} event */
  _onPanelKeydown(event) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    this._closeCityPanel();
  }

  /** Botón HUD «Isla completa»: vuelta animada al encuadre aéreo de la isla. */
  _focusOverview() {
    this.renderRoot.querySelector('career-island-3d')?.focusOverview();
  }

  /** La isla comunica su modo de cámara ('aerial'|'fps'): el HUD se adapta. */
  _onModeChange(event) {
    this.mode3d = event.detail.mode;
    this.teammatePopover = null; // el ancla del popover ya no vale en el otro modo
  }

  /** Botón HUD «Explorar a pie»: entra en primera persona (solo escritorio). */
  _enterFps() {
    if (this._coarsePointer) return;
    this.renderRoot.querySelector('career-island-3d')?.enterFirstPerson();
  }

  /** Botón HUD «Salir (Esc)»: vuelta a la vista aérea con transición. */
  _exitFps() {
    this.renderRoot.querySelector('career-island-3d')?.exitFirstPerson();
  }

  /**
   * Botón HUD 🔊/🔇 (MC-11): conmuta el sonido de la isla. El motor y la
   * persistencia viven en <career-island-3d>/islandAudio; si la isla no está
   * montada (p. ej. cayó a la vista plana) solo se persiste la preferencia.
   * El clic es un gesto real: activar el sonido puede crear el AudioContext.
   */
  _toggleAudio() {
    const next = !this.audioMuted;
    const island = this.renderRoot.querySelector('career-island-3d');
    this.audioMuted = island ? island.setAudioMuted(next) : writeStoredMuted(next);
  }

  // ---- Archipiélago: mapa del mar y viaje en barco (MC-14) -------------------

  /**
   * Abre el mapa del archipiélago (botón «🧭 Archipiélago» del HUD o la barca
   * del muelle vía `open-archipelago`). Antes de abrir se asegura el índice y
   * qué islas tienen ya doc (una consulta, cacheada para la sesión): las que
   * no lo tienen se atenúan como «En construcción».
   */
  async _openArchipelago() {
    if (!this.personId || this.traveling) return;
    this.error = '';
    try {
      this.archipelago ??= await getArchipelago();
      this.existingIslands ??= await getExistingIslandIds();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo cargar el archipiélago.';
      return;
    }
    this.showArchipelago = true;
  }

  /** Cierra el mapa del archipiélago sin viajar y devuelve el foco al HUD. */
  _closeArchipelago() {
    this.showArchipelago = false;
    this.updateComplete.then(() => this.renderRoot.querySelector('.hud button')?.focus());
  }

  /** Escape dentro del mapa del archipiélago lo cierra. @param {KeyboardEvent} event */
  _onArchipelagoKeydown(event) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    this._closeArchipelago();
  }

  /** La barca del muelle (clic o [E] Zarpar a pie) pide abrir el mapa del mar. */
  _onOpenArchipelago() {
    this._openArchipelago();
  }

  /**
   * Viaja en barco a otra isla: persiste `currentIsland` en el journey GLOBAL
   * de la persona, recarga el mapa de la isla destino bajo un fundido de
   * travesía y deja al avatar en su puerto (el spawn por defecto cuando la
   * ciudad actual del journey no está en el mapa cargado).
   * @param {string} islandId
   */
  async _travelTo(islandId) {
    if (!this.personId || this.traveling) return;
    if (islandId === this.currentIsland) {
      this._closeArchipelago();
      return;
    }
    this.error = '';
    this.traveling = true;
    this.showArchipelago = false;
    this.selected = null; // el panel abierto era de una ciudad de la otra isla
    this.teammatePopover = null;
    try {
      this.journey = await setCurrentIsland(this.store, this.personId, this.journey, islandId);
      this.currentIsland = islandId;
      await this._loadMap();
      // El fundido tapa el cambio de isla; una pausa corta deja que la nueva
      // termine de montar antes de descubrirla.
      await new Promise((resolve) => setTimeout(resolve, CareerApp.TRAVEL_FADE_MS));
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo viajar a esa isla.';
    } finally {
      this.traveling = false;
    }
  }

  /**
   * Overlay del mapa del ARCHIPIÉLAGO (MC-14): un mar estilizado con cada isla
   * en su x/y del índice. La isla actual va marcada («Estás aquí»); las que
   * aún no tienen doc, atenuadas con «En construcción» (se puede viajar: al
   * llegar espera la isla-placeholder con su puerto y su cartel). Clic en otra
   * isla → zarpar. Modal suave: ✕ o Escape lo cierran.
   */
  _renderArchipelago() {
    if (!this.showArchipelago) return null;
    const islands = this.archipelago?.islands ?? [];
    return html`<div class="sea-backdrop" @click=${(e) => { if (e.target === e.currentTarget) this._closeArchipelago(); }}>
      <section
        class="sea"
        role="dialog"
        aria-modal="true"
        aria-label="Mapa del archipiélago"
        tabindex="-1"
        @keydown=${this._onArchipelagoKeydown}
      >
        <header class="sea-head">
          <h3>🧭 El archipiélago</h3>
          <button class="close" aria-label="Cerrar el mapa del archipiélago" title="Cerrar (Esc)" @click=${this._closeArchipelago}>✕</button>
        </header>
        <div class="sea-map" role="list" aria-label="Islas del archipiélago">
          ${islands.map((island) => {
            const here = island.id === this.currentIsland;
            const built = this.existingIslands?.has(island.id) ?? island.id === DEFAULT_ISLAND_ID;
            return html`<button
              type="button"
              role="listitem"
              class="isle ${here ? 'here' : ''} ${built ? '' : 'wip'}"
              style=${`left:${island.x}%; top:${island.y}%`}
              title=${here
                ? `${island.name} — estás aquí`
                : built
                  ? `Zarpar hacia ${island.name}`
                  : `Zarpar hacia ${island.name} (en construcción)`}
              @click=${() => this._travelTo(island.id)}
            >
              <span class="isle-dot" aria-hidden="true"></span>
              <span class="isle-name">${island.name}</span>
              ${here
                ? html`<span class="isle-tag here">Estás aquí</span>`
                : built
                  ? null
                  : html`<span class="isle-tag">En construcción</span>`}
            </button>`;
          })}
        </div>
        <p class="sea-hint">
          Elige una isla y zarpa. El viaje es libre: tus ciudadanías te acompañan
          allá donde vayas.
        </p>
      </section>
    </div>`;
  }

  /** Fundido de travesía mientras se cambia de isla (MC-14). */
  _renderTravelFade() {
    if (!this.traveling) return null;
    const name = this._islandName(this.currentIsland) || this.map?.name || '';
    return html`<div class="travel-fade" role="status" aria-live="polite">
      <p>⛵ Rumbo a ${name}…</p>
    </div>`;
  }

  /** Botón «🧭 Archipiélago» (siempre disponible: barra y HUD a pie). */
  _renderArchipelagoButton() {
    return html`<button
      @click=${this._openArchipelago}
      title="Abrir el mapa del archipiélago y viajar a otra isla"
    >🧭 Archipiélago</button>`;
  }

  /** Botón HUD «👥 Equipo» (MC-12): muestra/oculta los avatares del equipo. */
  _renderTeamButton() {
    return html`<button
      @click=${this._toggleTeam}
      aria-pressed=${this.showTeam}
      title=${this.showTeam
        ? 'Ocultar a los compañeros del equipo en la isla'
        : 'Mostrar a los compañeros del equipo en la isla'}
    >👥 Equipo</button>`;
  }

  /**
   * Mini-popover del compañero clicado (MC-12): nombre, ciudad actual y % de
   * progreso — NADA más (privacidad: sin lecturas ni evidencias de terceros).
   * Anclado al punto del clic, acotado a los bordes del escenario; su
   * pointerdown no se propaga (el del escenario lo cerraría).
   */
  _renderTeammatePopover() {
    const pop = this.teammatePopover;
    if (!pop || !this.showTeam) return null;
    const mate = this.teammates.find((t) => t.personId === pop.personId);
    if (!mate) return null;
    const cityName =
      this.map?.cities.find((c) => c.id === mate.currentCity)?.name ?? mate.currentCity;
    return html`<div
      class="matepop"
      role="dialog"
      aria-label="Resumen de ${mate.name}"
      style=${`left: clamp(110px, ${Math.round(pop.x)}px, calc(100% - 110px)); top: ${Math.max(Math.round(pop.y), 96)}px;`}
      @pointerdown=${(e) => e.stopPropagation()}
    >
      <header>
        <strong>${mate.name}</strong>
        <button
          class="close"
          aria-label="Cerrar resumen"
          title="Cerrar"
          @click=${() => { this.teammatePopover = null; }}
        >✕</button>
      </header>
      <p>Vive en ${cityName}</p>
      <p>Progreso <span class="pct">${mate.progressPct}%</span></p>
    </div>`;
  }

  /**
   * Cartel de bienvenida overlay (onboarding, MC-13): qué es la isla, los
   * controles de ambos modos y el objetivo (las balizas coral). Modal suave
   * sobre el mapa: «¡A jugar!» o Escape lo cierran y persisten el flag.
   */
  _renderOnboarding() {
    if (!this.showOnboarding) return null;
    return html`<div class="onboard-backdrop">
      <section
        class="onboard"
        role="dialog"
        aria-modal="true"
        aria-label="Bienvenida a tu isla de carrera"
        tabindex="-1"
        @keydown=${this._onOnboardingKeydown}
      >
        <h3>Bienvenido a tu isla de carrera</h3>
        <p class="lead">
          Cada casa de la isla es un conocimiento de tu mapa de carrera: visítalas,
          aporta evidencias y consigue sus ciudadanías.
        </p>
        <ul>
          <li>
            <strong>Vista aérea:</strong> arrastra para orbitar, rueda para hacer zoom
            y clic en una casa abre su ciudadanía. <kbd>WASD</kbd> o las flechas mueven
            tu avatar por la isla.
          </li>
          <li>
            <strong>A pie:</strong> el botón 🚶 te baja a la isla en primera persona:
            <kbd>WASD</kbd> + ratón para caminar, <kbd>E</kbd> abre la ciudad cercana
            y <kbd>Esc</kbd> vuelve a la vista aérea.
          </li>
          <li>
            <strong>Tu objetivo:</strong> las casas con una baliza de luz coral tienen
            el <strong>visado disponible</strong> — son tu siguiente paso. La ruta
            planificada queda marcada en el suelo.
          </li>
        </ul>
        <button class="primary play" @click=${this._closeOnboarding}>¡A jugar!</button>
      </section>
    </div>`;
  }

  /** Botón HUD del sonido, presente en vista aérea Y a pie (MC-11). */
  _renderAudioButton() {
    return html`<button
      @click=${this._toggleAudio}
      aria-pressed=${!this.audioMuted}
      aria-label=${this.audioMuted ? 'Activar el sonido de la isla' : 'Silenciar la isla'}
      title=${this.audioMuted ? 'Activar el sonido de la isla' : 'Silenciar la isla'}
    >${this.audioMuted ? '🔇' : '🔊'}</button>`;
  }

  /**
   * Conmutador de vista Isla 3D / Plano. El plano queda como fallback
   * (también automático si no hay WebGL); la 2.5D se retiró en MC-8.
   */
  _renderViewSwitch() {
    const modes = [
      { id: '3d', label: 'Isla 3D' },
      { id: 'flat', label: 'Plano' },
    ];
    return html`<div class="viewswitch" role="group" aria-label="Modo de vista del mapa">
      ${modes.map(
        (m) => html`<button
          type="button"
          class=${this.viewMode === m.id ? 'active' : ''}
          aria-pressed=${this.viewMode === m.id}
          @click=${() => this._setViewMode(m.id)}
        >${m.label}</button>`,
      )}
    </div>`;
  }

  /** WebGL no disponible: cae a la vista plana SIN persistir (permite reintentar). */
  _onWebglUnavailable() {
    this.viewMode = 'flat';
  }

  // ---- Detalle de ciudad COMPARTIDO entre vistas (grid y panel 3D) -----------

  /**
   * Acciones de journey sobre la ciudad (visitada/actual/ruta). Si la ciudad
   * está en desuso solo se muestra la nota (no es visitable), como hasta ahora.
   * @param {import('../../tools/career/domain/types.js').City} sel
   */
  _renderCityActions(sel) {
    if (sel.deprecated) {
      return html`<p class="dep">Tecnología en desuso — no forma parte de la ruta.</p>`;
    }
    const visited = this.journey.visitedCities ?? [];
    const inRoute = (this.journey.plannedRoute ?? []).includes(sel.id);
    return html`<div class="actions">
      <button class="primary" @click=${() => this._act('toggle')}>
        ${visited.includes(sel.id) ? 'Quitar de visitadas' : 'Marcar como visitada'}
      </button>
      <button @click=${() => this._act('current')}>Marcar como ciudad actual</button>
      <button @click=${() => this._act('route')}>${inRoute ? 'Quitar de la ruta' : 'Añadir a la ruta'}</button>
    </div>`;
  }

  /** Recomendaciones formativas de la ciudad (enlaces cuando tienen url). */
  _renderCityRecs(sel) {
    if (!(sel.recommendations ?? []).length) return null;
    return html`<ul class="recs">
      ${sel.recommendations.map(
        (r) => html`<li>${r.kind}: ${r.url ? html`<a href=${r.url} target="_blank" rel="noopener">${r.label}</a>` : r.label}</li>`,
      )}
    </ul>`;
  }

  /**
   * Evidencias de ciudadanía de la ciudad (editables; ocultas si está en
   * desuso). Las listas se editan como chips (MC-8); los títulos legados se
   * muestran fusionados dentro de cursos (ver _saveEvidenceList).
   */
  _renderCityEvidences(sel) {
    if (sel.deprecated) return null;
    const ev = this.journey.evidences?.[sel.id] ?? {};
    const cursos = [...(ev.cursos ?? []), ...(ev.titulos ?? [])];
    return html`<details class="ev">
      <summary>Evidencias</summary>
      <label>Experiencia previa (años)
        <input
          type="number"
          min="0"
          step="0.5"
          .value=${ev.priorExperienceYears ?? ''}
          @change=${(e) => this._saveExperience(e.target.value)}
        />
      </label>
      ${this._renderEvidenceList('formaciones', 'Formaciones', ev.formaciones ?? [])}
      ${this._renderEvidenceList('cursos', 'Cursos y títulos', cursos)}
    </details>`;
  }

  /**
   * Lista de evidencias editable como chips: cada valor con su ✕ para quitar,
   * y un input con botón «+» (o Enter) para añadir de una en una.
   * @param {'formaciones'|'cursos'} field
   * @param {string} label
   * @param {string[]} values
   */
  _renderEvidenceList(field, label, values) {
    const add = (input) => this._addEvidenceItem(field, values, input);
    return html`<div class="evlist">
      <span class="evtitle">${label}</span>
      ${values.length
        ? html`<ul class="chips">
            ${values.map(
              (value, i) => html`<li class="chip">
                <span>${value}</span>
                <button
                  type="button"
                  class="chip-x"
                  aria-label="Quitar ${value} de ${label}"
                  title="Quitar"
                  @click=${() => this._removeEvidenceItem(field, values, i)}
                >✕</button>
              </li>`,
            )}
          </ul>`
        : null}
      <div class="evadd">
        <input
          type="text"
          placeholder="Añadir…"
          aria-label="Añadir a ${label}"
          @keydown=${(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            add(e.target);
          }}
        />
        <button
          type="button"
          class="plus"
          aria-label="Añadir a ${label}"
          title="Añadir"
          @click=${(e) => add(e.target.closest('.evadd').querySelector('input'))}
        >+</button>
      </div>
    </div>`;
  }

  /** Insignias de juego del estado de ciudadanía (panel del modo 3D). */
  static STATUS_BADGES = Object.freeze({
    visited: 'Ciudadano',
    available: 'Visado disponible',
    blocked: 'Bloqueada',
    deprecated: 'En desuso',
  });

  /**
   * Panel de ciudadanía overlay del modo 3D: título de juego, insignias de
   * estado, explicación del bloqueo (prereqs que faltan, con sus nombres) y el
   * mismo detalle (acciones/recomendaciones/evidencias) que las otras vistas.
   * @param {import('../../tools/career/domain/types.js').City} sel
   */
  _renderCityPanel(sel) {
    const map = this._map;
    const st = cityStatus(map, sel.id, this.journey);
    const status = st === 'unknown' ? 'blocked' : st;
    const areaName = map.areas.find((a) => a.id === sel.area)?.name;
    const inRoute = (this.journey.plannedRoute ?? []).includes(sel.id);
    const isCurrent = this.journey.currentCity === sel.id;
    const missing = missingPrereqs(map, sel.id, this.journey.visitedCities ?? []).map(
      (id) => map.cities.find((c) => c.id === id)?.name ?? id,
    );
    return html`<aside
      class="citypanel"
      role="dialog"
      aria-label="Ciudadanía de ${sel.name}"
      tabindex="-1"
      @keydown=${this._onPanelKeydown}
    >
      <header>
        <div>
          <h3>Ciudadanía de ${sel.name}</h3>
          <p class="kind">${areaName ? html`${areaName} · ` : null}${sel.kind} · ${sel.weight} pts</p>
        </div>
        <button class="close" aria-label="Cerrar panel" title="Cerrar (Esc)" @click=${this._closeCityPanel}>✕</button>
      </header>
      <div class="badges">
        <span class="badge ${status}">${CareerApp.STATUS_BADGES[status]}</span>
        ${isCurrent ? html`<span class="badge current">Actual</span>` : null}
        ${inRoute ? html`<span class="badge route">En ruta</span>` : null}
      </div>
      ${status === 'blocked' && missing.length
        ? html`<p class="blockedby">Para conseguir el visado te falta: ${missing.join(', ')}.</p>`
        : null}
      ${this._renderCityActions(sel)}
      ${this._renderCityRecs(sel)}
      ${this._renderCityEvidences(sel)}
    </aside>`;
  }

  _renderPersonSelect() {
    return html`<label>Persona
      <select @change=${this._changePerson}>
        <option value="" ?selected=${!this.personId}>— Elige una persona —</option>
        ${(this.people ?? []).map(
          (p) => html`<option value=${p.id} ?selected=${p.id === this.personId}>${p.name}</option>`,
        )}
      </select>
    </label>`;
  }

  render() {
    if (this.error && !this.store) return html`<p class="error">${this.error}</p>`;
    if (!this.store) return html`<p class="empty">Cargando…</p>`;

    if (!this.personId) {
      return html`
        <div class="bar">${this._renderPersonSelect()}</div>
        ${this.error ? html`<p class="error">${this.error}</p>` : null}
        <p class="empty">Elige una persona de tu equipo para ver y editar su mapa de carrera en la isla.</p>
      `;
    }

    if (this.loading || !this.map) {
      return html`
        <div class="bar">${this._renderPersonSelect()}</div>
        <p class="empty">Cargando el mapa de esta persona…</p>
      `;
    }

    const map = this._map;
    const s = stats(map, this.journey);
    const sel = this.selected ? map.cities.find((c) => c.id === this.selected) : null;
    const fps = this.viewMode === '3d' && this.mode3d === 'fps';
    return html`
      ${fps
        ? null
        : html`
            <div class="bar">
              ${this._renderPersonSelect()}
              ${this._renderViewSwitch()}
              ${this._renderArchipelagoButton()}
              <div class="stat"><span class="lvl">${s.level}</span><span class="pts">${s.points}/${s.total} pts · ${s.pct}%</span></div>
            </div>
            <div class="progress"><span style=${`width:${s.pct}%`}></span></div>
          `}
      ${this.error ? html`<p class="error">${this.error}</p>` : null}

      ${this.viewMode === '3d'
        ? html`<div class="stage3d" @pointerdown=${this._onStagePointerDown}>
            <career-island-3d
              class="stage"
              .map=${map}
              .journey=${this.journey}
              .reachable=${s.reachable}
              .selected=${this.selected}
              .teammates=${this.showTeam ? this.teammates : CareerApp.EMPTY_TEAMMATES}
              @select-city=${this._onSelect}
              @select-teammate=${this._onSelectTeammate}
              @open-archipelago=${this._onOpenArchipelago}
              @webgl-unavailable=${this._onWebglUnavailable}
              @mode-change=${this._onModeChange}
            ></career-island-3d>
            <div class="hud">
              ${fps
                ? html`<button
                    @click=${this._exitFps}
                    title="Volver a la vista aérea de la isla"
                  >Salir (Esc)</button>${this._renderArchipelagoButton()}${this._renderAudioButton()}`
                : html`
                    <button
                      @click=${this._focusOverview}
                      title="Volver a la vista aérea de toda la isla"
                    >Isla completa</button>
                    <button
                      @click=${this._enterFps}
                      ?disabled=${this._coarsePointer}
                      title=${this._coarsePointer
                        ? 'Modo de escritorio: requiere ratón y teclado'
                        : 'Recorre la isla a pie en primera persona (WASD + ratón)'}
                    >🚶 Explorar a pie${this._coarsePointer ? ' (modo de escritorio)' : ''}</button>
                    ${this._renderTeamButton()}
                    ${this._renderAudioButton()}
                    <button
                      @click=${this._openOnboarding}
                      aria-label="Ver la guía de la isla"
                      title="Ver la guía de la isla"
                    >?</button>
                  `}
            </div>
            ${this._renderTeammatePopover()}
            ${sel ? this._renderCityPanel(sel) : null}
            ${fps ? null : this._renderOnboarding()}
          </div>`
        : html`<div class="grid">
        <career-map
          .map=${map}
          .journey=${this.journey}
          .reachable=${s.reachable}
          .selected=${this.selected}
          @select-city=${this._onSelect}
        ></career-map>

        <div class="panel">
          ${sel
            ? html`
                <h3>${sel.name}</h3>
                <p class="kind">${sel.kind} · ${sel.weight} pts</p>
                ${this._renderCityActions(sel)}
                ${(sel.prereqs ?? []).length
                  ? html`<p class="pre">Requiere: ${sel.prereqs.map((p) => map.cities.find((c) => c.id === p)?.name).join(', ')}</p>`
                  : null}
                ${this._renderCityRecs(sel)}
                ${this._renderCityEvidences(sel)}
              `
            : html`<p class="hint">Haz clic en una ciudad de la isla para ver sus acciones y evidencias.</p>`}
          <details class="legend-wrap">
            <summary>Leyenda</summary>
            <div class="legend">
              <span><i class="d visited"></i>Visitada</span>
              <span><i class="d reachable"></i>Disponible</span>
              <span><i class="d locked"></i>Bloqueada</span>
              <span><i class="d deprecated"></i>En desuso</span>
              <span><i class="r current"></i>Actual</span>
              <span><i class="r target"></i>En ruta</span>
            </div>
          </details>
        </div>
      </div>`}
      ${this._renderArchipelago()}
      ${this._renderTravelFade()}
    `;
  }
}

if (!customElements.get('career-app')) {
  customElements.define('career-app', CareerApp);
}
