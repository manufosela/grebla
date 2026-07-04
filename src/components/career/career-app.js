/**
 * <career-app>
 * Shell del Mapa de Carrera: selector de PERSONA del equipo, barra de progreso/
 * nivel, el mapa de la isla y un panel de acciones/evidencias para la ciudad
 * seleccionada. Igual que Role Mirror, el líder elige a quién edita y el journey
 * se persiste en el subárbol de esa persona.
 *
 * En el modo 3D (MC-6) el detalle es la TARJETA DE LA CASA overlay sobre el
 * canvas (lateral en escritorio, hoja inferior en móvil). Desde MC-15 la
 * tarjeta se organiza en TRES PESTAÑAS (tablist ARIA, estado local, ←/→):
 * «Certificado» (insignia de estado — completar una casa = certificado; la
 * ciudadanía es de la ISLA, MC-20 —, prereqs que faltan, acciones y
 * evidencias), «Qué aprender» (keyPoints con checks + bloque destacado
 * «🤖 Con IA» con el aiFocus) y «Recursos» (resources agrupados por tipo, con
 * fallback a las recommendations legadas). Los renders se COMPARTEN con el
 * detalle de la vista plana (sin duplicar lógica). El zoom al hacer clic lo
 * anima <career-island-3d> por sí solo; aquí solo se invoca `focusOverview()`
 * desde el botón «Isla completa».
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
 * (se abre con E/clic desde la isla, que suelta el pointer lock; al cerrarlo
 * con Escape/✕ se pide el re-enganche del lock — el gesto del cierre aún
 * vale, MC-18 — y, si el navegador lo rechaza, la isla sigue jugable solo con
 * teclado). La prop `overlayOpen` de la isla refleja si hay un overlay DOM
 * abierto (panel o archipiélago) para pausar la marcha por teclado sin lock.
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
 * travesía y el avatar aparece en el puerto de la isla nueva. Desde MC-19 el
 * viaje se VE antes del fundido: un barquito ⛵ navega la curva puerto→puerto
 * sobre el mapa del mar (estela incluida, proa al rumbo, duración según la
 * distancia — domain/voyage.js, puro). Escape salta la animación (el viaje
 * sigue), otros clics se ignoran (un viaje a la vez) y con
 * `prefers-reduced-motion` se zarpa directo al fundido. Los compañeros
 * (MC-12) solo se pintan si su journey está en la MISMA isla; el progreso del
 * HUD sigue siendo el de la isla cargada.
 *
 * Progresión (MC-20): completar una casa = CERTIFICADO; alcanzar el % objetivo
 * de certificados de una isla (citizenshipPct del índice) = CIUDADANÍA de esa
 * isla. El HUD superior (barra de arriba, modos 3D y plano; en fps el HUD es
 * mínimo) muestra el % de la isla actual frente a su objetivo (mini-barra con
 * la marca de la meta; lograda → «🏆 Ciudadanía»), las islas pisadas
 * (journey.visitedIslands), las ciudadanías y el badge más alto
 * (⭐ Super-ciudadano ≥ 3 incluyendo Bases; 👑 Leyenda ≥ 6) — todo derivado en
 * puro (domain/citizenship.js) del journey global y el índice del archipiélago
 * ya cargado (los ids de ciudad prefijados por disciplina lo hacen barato).
 * El contador de nivel de viaje de antes queda como tooltip del bloque de la
 * isla. Al cruzar el umbral con un certificado, la celebración de la isla 3D
 * se SUSTITUYE por la variante MAYOR (más confeti, fanfarria larga) y sale el
 * aviso «¡Ciudadanía de {isla} conseguida!»; si además cae un badge, se
 * anuncia después EN COLA (secuencial, nunca solapado).
 *
 * Ficha del jugador (MC-21): el botón «🏅 Ficha» (barra superior y HUD a pie)
 * abre un overlay modal (como el del archipiélago) con la ficha de ciudadanía
 * — <player-card>, compartida con mi-espacio —: badges con fecha, totales y el
 * detalle por isla. Los LOGROS con fecha se persisten en
 * /people/{personId}/career/achievements de solo-añadir: al cargar a la
 * persona se registran con fecha null los logros pre-MC-21 aún sin registro
 * (migración suave, «fecha no registrada»; si el rol no puede escribir se
 * degrada a console.warn y lo registrará la próxima sesión con permisos) y,
 * al cruzar un umbral jugando, el mismo gesto que celebró la ciudadanía la
 * registra con la fecha ISO del momento. Las fechas existentes NUNCA se
 * re-escriben (newAchievements, puro).
 *
 * El brujo (MC-22): cada isla tiene la cabaña del brujo (edificación singular
 * de <career-island-3d>) donde el jugador deja CONSULTAS ASÍNCRONAS al líder.
 * El evento `open-wizard` (clic aéreo, [E] o choque a pie) abre aquí el panel
 * overlay «🧙 El brujo de {isla}»: textarea para dejar la consulta (quien
 * puede escribir: líder jugando o jugador vinculado; si no, solo lectura) y
 * las consultas de ESA isla de la persona cargada con su estado, la respuesta
 * («— respondida por {answeredBy/creditedTo}») y el botón «Entendido» que la
 * marca como vista. El estado visual de la cabaña se deriva en puro
 * (domain/wizard.js) de las consultas de la isla actual: pendiente = farol
 * ámbar, respuesta lista = farol teal. Con `canEdit` (líder/superadmin) la
 * barra ofrece «🧙 Consultas (N)» con las PENDIENTES de todas sus personas
 * (carga en paralelo, cap MAX_TEAM_JOURNEYS como los journeys) y un overlay
 * de cola FIFO para responder (autoría del login, campo opcional «Con ayuda
 * de» para acreditar al developer que ayudó — derivación v1 informativa).
 * Todas las Q&A quedan en la ficha del jugador (<player-card>, MC-21).
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
 *  - people: { id: string, name: string, uid?: string|null }[]   personas del equipo del líder
 *  - canEdit: boolean                          líder/superadmin (cola del brujo, MC-22)
 *  - currentUser: { uid: string, name: string }|null   login (autoría de consultas/respuestas)
 */
import { LitElement, html, css } from 'lit';
import './career-map.js';
import './career-island-3d.js';
import './player-card.js';
import { readStoredMuted, writeStoredMuted } from './islandAudio.js';
import {
  getJourney,
  toggleVisited,
  setCurrent,
  setCurrentIsland,
  toggleRoute,
  setEvidence,
  getAchievements,
  recordAchievements,
  listQuestions,
  askQuestion,
  answerQuestion,
  markQuestionSeen,
  stats,
} from '../../tools/career/application/usecases.js';
import { getCareerMap, getArchipelago, getExistingIslandIds } from '../../lib/careerMap.js';
import { DEFAULT_ISLAND_ID } from '../../tools/career/domain/types.js';
import {
  WAKE_INTERVAL_MS,
  voyagePath,
  voyagePointAt,
  voyageTangentAngle,
  voyageDuration,
  voyageHeading,
} from '../../tools/career/domain/voyage.js';
import { cityStatus, missingPrereqs, progressPct } from '../../tools/career/domain/progress.js';
import { archipelagoProgress, citizenshipCelebrations } from '../../tools/career/domain/citizenship.js';
import { newAchievements } from '../../tools/career/domain/achievements.js';
import { wizardState, pendingQuestions } from '../../tools/career/domain/wizard.js';

/**
 * Pestañas de la tarjeta de la casa (MC-15): estado/acciones del certificado,
 * qué aprender (con lente IA) y recursos. Patrón ARIA tablist con roving
 * tabindex, como <engineer-space>, pero con estado LOCAL (la pestaña muere con
 * el panel: no toca location.hash).
 * @type {ReadonlyArray<'certificado'|'aprender'|'recursos'>}
 */
const CITY_TABS = ['certificado', 'aprender', 'recursos'];

/** Etiquetas de la barra de pestañas de la tarjeta. @type {Record<typeof CITY_TABS[number], string>} */
const CITY_TAB_LABELS = {
  certificado: 'Certificado',
  aprender: 'Qué aprender',
  recursos: 'Recursos',
};

/**
 * Metadatos de cada tipo de recurso (MC-15): icono y título del grupo en la
 * pestaña «Recursos». El orden del objeto es el orden de pintado.
 * @type {Record<import('../../tools/career/domain/types.js').ResourceKind, { icon: string, title: string }>}
 */
const RESOURCE_GROUPS = {
  curso: { icon: '🎓', title: 'Cursos' },
  post: { icon: '✍️', title: 'Posts' },
  libro: { icon: '📚', title: 'Libros' },
  doc: { icon: '📄', title: 'Docs' },
};

/** Formato de fechas de las consultas al brujo (MC-22). */
const wizardDateFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' });

/** Fecha legible de una consulta (o '—' si no la trae/es corrupta). @param {string} iso */
function formatWizardDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : wizardDateFmt.format(d);
}

export class CareerApp extends LitElement {
  static properties = {
    store: { attribute: false },
    people: { attribute: false },
    canEdit: { attribute: false },
    currentUser: { attribute: false },
    personId: { state: true },
    error: { state: true },
    journey: { state: true },
    selected: { state: true },
    cityTab: { state: true },
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
    voyage: { state: true },
    announcement: { state: true },
    achievements: { state: true },
    showPlayerCard: { state: true },
    questions: { state: true },
    showWizard: { state: true },
    showWizardQueue: { state: true },
    wizardPending: { state: true },
    wizardBusy: { state: true },
    wizardError: { state: true },
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
  /** Duración (ms) del aviso de CIUDADANÍA DE ISLA (acompaña a la celebración
   * mayor, CELEBRATION_VARIANTS.island ≈ 4.2 s) (MC-20). */
  static ANNOUNCE_ISLAND_MS = 4200;
  /** Duración (ms) de los avisos de badge (super-ciudadano / leyenda, MC-20). */
  static ANNOUNCE_BADGE_MS = 3200;

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
    /* ── HUD superior de progresión (MC-20): ciudadanía de la isla actual,
       islas pisadas, ciudadanías y badge. Compacto y a la derecha de la barra. ── */
    .hudtop { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-left: auto; }
    .isle-stat { display: flex; align-items: center; gap: 0.45rem; }
    .isle-here { font-weight: 800; font-size: 0.85rem; color: var(--rm-navy, #1e3a5f); white-space: nowrap; }
    .minibar { position: relative; width: 110px; height: 8px; background: var(--rm-track, #e9f0f2); border-radius: 999px; }
    .minibar .fill {
      display: block; height: 100%; max-width: 100%;
      background: var(--rm-accent, #2a9d8f); border-radius: 999px; transition: width 0.3s ease;
    }
    /* Marca del % objetivo sobre la mini-barra: la meta visible de la ciudadanía. */
    .minibar .goal { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--rm-coral-600, #e26d5e); border-radius: 1px; }
    .pcts { font-size: 0.8rem; color: var(--rm-muted, #6b7280); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .hudstat { font-size: 0.85rem; font-weight: 700; color: var(--rm-navy, #1e3a5f); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .hudbadge {
      font-size: 0.72rem; font-weight: 800; padding: 0.18rem 0.6rem; border-radius: 999px; white-space: nowrap;
      background: linear-gradient(135deg, #f6d365 0%, #e8b931 100%); color: #5b4300;
      box-shadow: 0 1px 4px rgba(17, 24, 39, 0.18);
    }
    .hudbadge.legend { background: linear-gradient(135deg, #b993ff 0%, #7f5af0 100%); color: #fff; }
    /* Aviso de progresión (MC-20): toast centrado arriba, sobre todo lo demás
       (acompaña a la celebración mayor; los badges salen detrás, en cola). */
    .cit-toast {
      position: fixed;
      top: 4.5rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 80;
      pointer-events: none;
      background: linear-gradient(135deg, #f6d365 0%, #e8b931 100%);
      color: #4a3700;
      border-radius: 999px;
      padding: 0.65rem 1.4rem;
      box-shadow: 0 10px 30px rgba(17, 24, 39, 0.3);
      animation: cit-pop 420ms cubic-bezier(0.2, 1.4, 0.4, 1) both;
    }
    .cit-toast.legend { background: linear-gradient(135deg, #b993ff 0%, #7f5af0 100%); color: #fff; }
    .cit-toast p { margin: 0; font-size: 1.05rem; font-weight: 800; white-space: nowrap; }
    @keyframes cit-pop {
      from { opacity: 0; transform: translateX(-50%) translateY(-14px) scale(0.85); }
      to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .cit-toast { animation: none; }
    }
    @media (max-width: 760px) {
      .hudtop { margin-left: 0; }
      .cit-toast p { white-space: normal; text-align: center; }
    }
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
    /* Ficha de ciudadanía del jugador (MC-21): modal hermano del mapa del mar
       (mismo backdrop y cabecera), algo más estrecho — es una lista, no un mapa. */
    .ficha {
      width: min(640px, calc(100% - 2rem));
      max-height: calc(100% - 2rem);
      box-sizing: border-box;
      overflow-y: auto;
      overscroll-behavior: contain;
      background: color-mix(in srgb, var(--rm-surface, #fff) 96%, transparent);
      border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px);
      padding: 1rem 1.25rem 1.1rem;
      box-shadow: 0 14px 40px rgba(17, 24, 39, 0.28);
      outline: none;
    }
    /* ── El brujo (MC-22): panel del jugador y cola del líder (hermanos de la
       ficha: mismo backdrop/section, contenido de consultas). ── */
    .wizlead { margin: 0 0 0.75rem; font-size: 0.9rem; color: var(--rm-muted, #6b7280); }
    .wizreadonly { margin: 0.5rem 0 0.75rem; font-size: 0.85rem; color: var(--rm-muted, #9ca3af); }
    .wizempty { color: var(--rm-muted, #9ca3af); font-size: 0.85rem; margin: 0.4rem 0 0; }
    .sub { margin: 1.1rem 0 0.35rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rm-muted, #6b7280); font-weight: 700; }
    .wizform { display: flex; flex-direction: column; gap: 0.4rem; margin: 0.5rem 0 0.25rem; }
    .wizform label { font-size: 0.75rem; }
    .wizform textarea,
    .wizform input {
      width: 100%;
      box-sizing: border-box;
      padding: 0.5rem 0.6rem;
      border-radius: 8px;
      border: 1px solid var(--rm-border, #d1d5db);
      background: var(--rm-surface, #fff);
      color: var(--rm-text, #111827);
      font: inherit;
      font-size: 0.88rem;
      resize: vertical;
    }
    .wizform button { align-self: flex-start; }
    .wizlist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
    .wizq { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.6rem 0.8rem; }
    .wmeta { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
    .wmeta strong { font-size: 0.9rem; color: var(--rm-navy, #1e3a5f); }
    .wmeta .when { font-size: 0.75rem; color: var(--rm-muted, #6b7280); }
    .wisle { font-size: 0.78rem; font-weight: 700; color: var(--rm-navy, #1e3a5f); }
    .wstatus { font-size: 0.7rem; font-weight: 800; padding: 0.14rem 0.55rem; border-radius: 999px; white-space: nowrap; }
    .wstatus.pending { background: #fdebc8; color: #8a5a00; }
    .wstatus.answered { background: var(--rm-accent, #2a9d8f); color: #fff; }
    .wstatus.seen { background: var(--rm-track, #e9f0f2); color: var(--rm-muted, #6b7280); }
    .wtext { margin: 0.4rem 0 0; font-size: 0.88rem; color: var(--rm-text, #111827); white-space: pre-wrap; }
    .wizanswer {
      margin-top: 0.55rem;
      border-left: 4px solid var(--rm-accent, #2a9d8f);
      background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 9%, var(--rm-surface, #fff));
      border-radius: 0 10px 10px 0;
      padding: 0.5rem 0.7rem;
    }
    .wizanswer .wtext { margin: 0; }
    .wby { margin: 0.35rem 0 0; font-size: 0.76rem; font-style: italic; color: var(--rm-muted, #6b7280); }
    .wseen { margin-top: 0.55rem; }
    .sea-map {
      position: relative;
      aspect-ratio: 16 / 10;
      border-radius: 10px;
      overflow: hidden;
      /* Contenedor de query (MC-17): los nombres de isla escalan con el ancho
         del mapa (cqi) para no pisarse entre islas vecinas a ventana estrecha. */
      container-type: inline-size;
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
      /* Fluida con el ancho del mapa (MC-17): a 760px es el 0.72rem de siempre
         y en móvil encoge hasta 0.55rem — los nombres largos dejan de tocarse. */
      font-size: clamp(0.55rem, 1.6cqi, 0.72rem);
      font-weight: 700;
      color: #fff;
      white-space: nowrap;
      text-shadow: 0 1px 3px rgba(17, 24, 39, 0.75);
    }
    .isle-tag {
      font-size: clamp(0.5rem, 1.3cqi, 0.6rem);
      font-weight: 700;
      padding: 0.08rem 0.45rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.88);
      color: var(--rm-navy, #1e3a5f);
      white-space: nowrap;
    }
    .isle-tag.here { background: var(--rm-coral-600, #e26d5e); color: #fff; }
    /* Barco animado puerto→puerto (MC-19): capa del viaje sobre el mar. El
       bucle de rAF recoloca el barco (left/top/transform inline) y va soltando
       puntos de estela que se desvanecen solos. */
    .voyage-layer { position: absolute; inset: 0; pointer-events: none; }
    .boat {
      position: absolute;
      z-index: 2; /* la proa por delante de su propia estela */
      font-size: 1.45rem;
      line-height: 1;
      filter: drop-shadow(0 2px 3px rgba(10, 30, 50, 0.45));
      will-change: left, top, transform;
    }
    .wake {
      position: absolute;
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.85);
      transform: translate(-50%, -50%);
      animation: wake-fade 1s ease-out forwards;
    }
    @keyframes wake-fade {
      from { opacity: 0.85; transform: translate(-50%, -50%) scale(1); }
      to { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
    }
    /* Estado del viaje (aria-live SIEMPRE presente: el texto entra y se anuncia). */
    .sea-status {
      margin: 0.45rem 0 0;
      min-height: 1.2em;
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--rm-navy, #1e3a5f);
    }
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
    .dep { font-size: 0.78rem; color: var(--rm-danger, #dc2626); font-weight: 600; margin: 0 0 0.5rem; }
    /* ── Tarjeta de la casa en pestañas (MC-15): tablist ARIA como en
       <engineer-space>, versión compacta para el panel. ── */
    .ctabs { display: flex; gap: 0.35rem; margin: 0.6rem 0 0.75rem; flex-wrap: wrap; }
    .ctab {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-muted, #6b7280);
      border-radius: 999px; padding: 0.3rem 0.75rem; font: inherit; font-size: 0.78rem; font-weight: 700; cursor: pointer;
    }
    .ctab.active { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: #fff; }
    .ctab:hover:not(.active) { color: var(--rm-text, #111827); }
    .ctab:focus-visible { outline: 2px solid var(--rm-navy, #1e3a5f); outline-offset: 2px; }
    .ctabpanel { outline: none; }
    .ctabpanel:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; border-radius: 8px; }
    .placeholder { color: var(--rm-muted, #9ca3af); font-size: 0.85rem; margin: 0.4rem 0 0; }
    /* Pestaña «Qué aprender»: puntos con check visual y bloque destacado IA. */
    .keypoints { list-style: none; margin: 0.3rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.85rem; }
    .keypoints li { display: flex; gap: 0.45rem; align-items: baseline; }
    .keypoints .tick { color: var(--rm-accent, #2a9d8f); font-weight: 800; flex: 0 0 auto; }
    .aifocus {
      margin-top: 0.85rem;
      border-left: 4px solid var(--rm-accent, #2a9d8f);
      background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 9%, var(--rm-surface, #fff));
      border-radius: 0 10px 10px 0;
      padding: 0.6rem 0.8rem;
    }
    .aifocus h4 { margin: 0 0 0.3rem; font-size: 0.8rem; color: var(--rm-navy, #1e3a5f); }
    .aifocus p { margin: 0; font-size: 0.83rem; color: var(--rm-text, #111827); }
    /* Pestaña «Recursos»: grupos por tipo con icono; enlaces cuando hay url. */
    .resgroup { margin: 0.7rem 0 0; }
    .resgroup h4 { margin: 0 0 0.25rem; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rm-muted, #6b7280); }
    .res { list-style: none; margin: 0; padding: 0; font-size: 0.83rem; }
    .res li { display: flex; gap: 0.4rem; align-items: baseline; padding: 0.2rem 0; color: var(--rm-text, #111827); }
    .res a { color: var(--rm-accent, #2a9d8f); }
    .res .fmt {
      font-size: 0.66rem; font-weight: 700; padding: 0.08rem 0.45rem; border-radius: 999px;
      background: var(--rm-track, #e9f0f2); color: var(--rm-muted, #6b7280); text-transform: uppercase; letter-spacing: 0.03em;
    }
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
    // Pestaña activa de la tarjeta de la casa (MC-15). Cada casa se abre por
    // la pestaña «Certificado» (se resetea al seleccionar otra ciudad).
    this.cityTab = 'certificado';
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
    // Ficha del jugador (MC-21): logros registrados de la persona cargada y
    // visibilidad del overlay «🏅 Ficha».
    /** @type {import('../../tools/career/domain/achievements.js').Achievements|null} */
    this.achievements = null;
    this.showPlayerCard = false;
    // El brujo (MC-22): rol del usuario (canEdit habilita la cola del líder),
    // login para la autoría, consultas de la persona cargada (TODAS las islas;
    // el panel del brujo filtra por la actual y la ficha las lista completas),
    // overlays y caché de consultas del equipo para el contador de pendientes.
    this.canEdit = false;
    /** @type {{ uid: string, name: string }|null} */
    this.currentUser = null;
    /** @type {import('../../tools/career/domain/wizard.js').WizardQuestion[]|null} */
    this.questions = null;
    this.showWizard = false;
    this.showWizardQueue = false;
    /** Nº de consultas PENDIENTES de todas las personas visibles (cola del líder). */
    this.wizardPending = 0;
    this.wizardBusy = false;
    this.wizardError = '';
    /** Consultas por persona (MC-22), cacheadas como los journeys del equipo.
     * @type {Map<string, import('../../tools/career/domain/wizard.js').WizardQuestion[]>} */
    this._teamQuestions = new Map();
    this._teamQuestionsLoaded = false;
    // Progresión (MC-20): aviso de ciudadanía/badge en pantalla (o null) y su
    // cola — los anuncios encadenados salen SECUENCIALES, nunca solapados.
    /** @type {import('../../tools/career/domain/citizenship.js').CitizenshipEvent|null} */
    this.announcement = null;
    /** @type {import('../../tools/career/domain/citizenship.js').CitizenshipEvent[]} */
    this._announceQueue = [];
    this._announceTimer = 0;
    // Barco animado (MC-19): viaje en curso sobre el mapa del mar, o null.
    // El rAF y sus relojes son privados: solo `voyage` re-renderiza.
    /** @type {{ toId: string, toName: string, path: import('../../tools/career/domain/voyage.js').VoyagePath, duration: number }|null} */
    this.voyage = null;
    this._voyageRaf = 0;
    this._voyageStart = 0;
    this._voyageWakeAt = 0;
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
      this._clearAnnouncements(); // los avisos encolados también (MC-20)
      this.showPlayerCard = false; // la ficha abierta era de otra persona (MC-21)
      this.achievements = null;
      this.showWizard = false; // el panel del brujo abierto era de otra persona (MC-22)
      this.questions = null;
      this.wizardError = '';
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
    // Cola del brujo (MC-22): con canEdit se cargan en paralelo las consultas
    // de todas las personas visibles (mismo cap y política que los journeys)
    // para el contador «🧙 Consultas (N)».
    if (this.store && this.canEdit && (this.people ?? []).length > 0 && !this._teamQuestionsLoaded) {
      this._teamQuestionsLoaded = true;
      this._loadTeamQuestions();
    }
    // Las consultas recién cargadas/mutadas de la persona actual refrescan la
    // caché del equipo y el contador de pendientes (MC-22).
    if (changed.has('questions') && this.personId && this.questions) {
      this._teamQuestions.set(this.personId, this.questions);
      this._refreshWizardPending();
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
    // Accesibilidad de la tarjeta de la casa (3D): al abrirse recibe el foco
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
    // La ficha del jugador recibe el foco al abrirse (MC-21): Escape cierra.
    if (changed.has('showPlayerCard') && this.showPlayerCard) {
      this.renderRoot.querySelector('.ficha')?.focus();
    }
    // El panel del brujo y la cola del líder reciben el foco al abrirse (MC-22).
    if (changed.has('showWizard') && this.showWizard) {
      this.renderRoot.querySelector('.wizpanel')?.focus();
    }
    if (changed.has('showWizardQueue') && this.showWizardQueue) {
      this.renderRoot.querySelector('.wizqueue')?.focus();
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
      // Journey, logros registrados (MC-21) y consultas al brujo (MC-22) en
      // paralelo: viven juntos en el subárbol career de la persona.
      const [journey, achievements, questions] = await Promise.all([
        getJourney(this.store, this.personId),
        getAchievements(this.store, this.personId),
        listQuestions(this.store, this.personId),
      ]);
      this.journey = journey;
      this.achievements = achievements;
      this.questions = questions;
      // El journey es GLOBAL (MC-14): si esta persona está en otra isla del
      // archipiélago, se carga el mapa de SU isla.
      const island = this.journey.currentIsland ?? DEFAULT_ISLAND_ID;
      if (island !== this.currentIsland) {
        this.currentIsland = island;
        await this._loadMap();
      }
      await this._migrateAchievements();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo cargar el mapa de esta persona.';
    } finally {
      this.loading = false;
    }
  }

  /**
   * Migración suave de logros pre-MC-21: si el journey recién cargado YA
   * cumple ciudadanías/badges sin registro, se registran con fecha null
   * («fecha no registrada»: registrar la fecha de hoy sería inventarla). El
   * fallo aquí NO tumba la carga (p. ej. un rol de solo lectura no puede
   * escribir el subárbol): se deja constancia por consola y lo registrará la
   * próxima sesión con permisos de edición — degradación documentada, no un
   * fallback silencioso.
   */
  async _migrateAchievements() {
    if (!this.personId || !this.achievements) return;
    this.archipelago ??= await getArchipelago();
    const progress = archipelagoProgress(this.journey, this.archipelago.islands);
    const patch = newAchievements(progress, this.achievements, null);
    if (!patch) return;
    try {
      this.achievements = await recordAchievements(this.store, this.personId, this.achievements, patch);
    } catch (err) {
      console.warn('Ficha del jugador: no se pudieron registrar los logros previos a MC-21.', err);
    }
  }

  /**
   * Registra los logros que el journey actual acaba de cumplir y aún no tienen
   * fecha (MC-21): el MISMO gesto de juego que celebró la ciudadanía/badge la
   * persiste con la fecha ISO del momento. newAchievements garantiza que las
   * fechas ya registradas no se re-escriben; sin nada nuevo no hay escritura.
   * Lanza en caso de error (el caller, _act, lo muestra como this.error).
   */
  async _recordNewAchievements() {
    if (!this.personId || !this.achievements || !this.archipelago) return;
    const progress = archipelagoProgress(this.journey, this.archipelago.islands);
    const patch = newAchievements(progress, this.achievements, new Date().toISOString());
    if (!patch) return;
    this.achievements = await recordAchievements(this.store, this.personId, this.achievements, patch);
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
    this.cityTab = 'certificado'; // cada casa se abre por su pestaña Certificado (MC-15)
    this.teammatePopover = null; // la tarjeta de la casa releva al mini-resumen
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
      if (action === 'toggle') {
        const prev = this.journey;
        this.journey = await toggleVisited(this.store, this.personId, map, prev, this.selected);
        // Progresión (MC-20): si este certificado cruza el % objetivo de la
        // isla, celebración MAYOR y avisos encadenados (isla → badges).
        await this._queueCitizenshipCelebrations(prev, this.journey, this.selected);
        // Y el logro queda REGISTRADO con su fecha en la ficha (MC-21).
        await this._recordNewAchievements();
      } else if (action === 'current') {
        this.journey = await setCurrent(this.store, this.personId, this.journey, this.selected);
      } else if (action === 'route') {
        this.journey = await toggleRoute(this.store, this.personId, this.journey, this.selected);
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo actualizar.';
    }
  }

  // ---- Progresión: ciudadanía por isla y badges (MC-20) ----------------------

  /**
   * Detecta (puro, citizenshipCelebrations) qué anuncios dispara el
   * certificado recién obtenido y los ENCOLA: la ciudadanía de la isla
   * sustituye la celebración de certificado del 3D por la variante MAYOR
   * (más confeti y fanfarria larga) y los badges (super-ciudadano, leyenda)
   * se anuncian después, secuenciales — nunca solapados.
   * @param {import('../../tools/career/domain/types.js').Journey} prev
   * @param {import('../../tools/career/domain/types.js').Journey} next
   * @param {string} cityId Ciudad del certificado recién obtenido.
   */
  async _queueCitizenshipCelebrations(prev, next, cityId) {
    const events = citizenshipCelebrations(prev, next, this.archipelago?.islands ?? []);
    if (events.length === 0) return;
    if (events.some((e) => e.kind === 'island') && this.viewMode === '3d') {
      // La isla 3D ya arrancó la celebración de certificado con el mismo diff:
      // se espera a que su update procese el journey y se SUSTITUYE por la
      // celebración mayor de ciudadanía (una celebración nueva corta la anterior).
      await this.updateComplete;
      const island = this.renderRoot.querySelector('career-island-3d');
      if (island) {
        await island.updateComplete;
        island.celebrateCitizenship(cityId);
      }
    }
    this._announceQueue.push(...events);
    if (!this.announcement) this._nextAnnouncement();
  }

  /** Muestra el siguiente aviso de la cola (o retira el actual si no quedan). */
  _nextAnnouncement() {
    clearTimeout(this._announceTimer);
    this._announceTimer = 0;
    const event = this._announceQueue.shift() ?? null;
    this.announcement = event;
    if (!event) return;
    const ms =
      event.kind === 'island' ? CareerApp.ANNOUNCE_ISLAND_MS : CareerApp.ANNOUNCE_BADGE_MS;
    this._announceTimer = setTimeout(() => this._nextAnnouncement(), ms);
  }

  /** Vacía la cola de avisos (cambio de persona: eran de otro contexto). */
  _clearAnnouncements() {
    clearTimeout(this._announceTimer);
    this._announceTimer = 0;
    this._announceQueue = [];
    this.announcement = null;
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
   * Cierra la tarjeta de la casa: deselecciona SIN mover la cámara (el usuario
   * sigue donde estaba) y devuelve el foco al HUD para no perder el teclado.
   * En fps se intenta re-enganchar el pointer lock (MC-18: el Escape/clic del
   * cierre aún cuenta como gesto); si el navegador lo rechaza, la marcha por
   * teclado sin lock sigue funcionando y un clic en el canvas retoma el ratón.
   */
  _closeCityPanel() {
    this.selected = null;
    this._recapturePointerLock();
    this.updateComplete.then(() => this.renderRoot.querySelector('.hud button')?.focus());
  }

  /** Pide a la isla re-enganchar el pointer lock si se está a pie (MC-18). */
  _recapturePointerLock() {
    if (this.viewMode !== '3d' || this.mode3d !== 'fps') return;
    this.renderRoot.querySelector('career-island-3d')?.recapturePointerLock();
  }

  /** Escape dentro de la tarjeta de la casa la cierra. @param {KeyboardEvent} event */
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

  /** Cierra el mapa del archipiélago sin viajar y devuelve el foco al HUD.
   * Si se llegó a pie ([E] Zarpar), intenta re-enganchar el lock (MC-18).
   * Con el barco navegando (MC-19) ni ✕ ni el fondo cierran: un viaje a la
   * vez y ya está zarpado — Escape salta la animación, no la cancela. */
  _closeArchipelago() {
    if (this.voyage) return;
    this.showArchipelago = false;
    this._recapturePointerLock();
    this.updateComplete.then(() => this.renderRoot.querySelector('.hud button')?.focus());
  }

  /** Escape dentro del mapa del archipiélago lo cierra; con el barco en el mar
   * (MC-19) NO aborta el viaje: salta la animación y va directo a la carga.
   * @param {KeyboardEvent} event */
  _onArchipelagoKeydown(event) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    if (this.voyage) {
      this._finishVoyage();
      return;
    }
    this._closeArchipelago();
  }

  /** La barca del muelle (clic o [E] Zarpar a pie) pide abrir el mapa del mar. */
  _onOpenArchipelago() {
    this._openArchipelago();
  }

  // ---- Ficha del jugador (MC-21) ----------------------------------------------

  /**
   * Abre la ficha de ciudadanía (botón «🏅 Ficha»). Asegura el índice del
   * archipiélago (la ficha lista TODAS las islas en su orden); los logros ya
   * llegaron con _load(). Modal como el del archipiélago: foco al abrir
   * (updated), Escape/✕/fondo cierran.
   */
  async _openPlayerCard() {
    if (!this.personId) return;
    this.error = '';
    try {
      this.archipelago ??= await getArchipelago();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo cargar el archipiélago.';
      return;
    }
    this.showPlayerCard = true;
  }

  /** Cierra la ficha y devuelve el foco al HUD (re-enganche del lock en fps). */
  _closePlayerCard() {
    this.showPlayerCard = false;
    this._recapturePointerLock();
    this.updateComplete.then(() => this.renderRoot.querySelector('.hud button')?.focus());
  }

  /** Escape dentro de la ficha la cierra. @param {KeyboardEvent} event */
  _onPlayerCardKeydown(event) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    this._closePlayerCard();
  }

  /** Botón «🏅 Ficha» (barra superior y HUD a pie, junto al archipiélago). */
  _renderPlayerCardButton() {
    return html`<button
      @click=${this._openPlayerCard}
      title="Abrir la ficha de ciudadanía del jugador: sus logros en el archipiélago"
    >🏅 Ficha</button>`;
  }

  /**
   * Overlay de la FICHA DE CIUDADANÍA (MC-21): modal fixed (mismo patrón que
   * el mapa del archipiélago, reutiliza su backdrop) con <player-card> — el
   * componente compartido con mi-espacio — alimentada con la progresión
   * derivada del journey (MC-20) y los logros registrados.
   */
  _renderPlayerCard() {
    if (!this.showPlayerCard) return null;
    const prog = this.archipelago
      ? archipelagoProgress(this.journey, this.archipelago.islands)
      : null;
    const name = (this.people ?? []).find((p) => p.id === this.personId)?.name ?? '';
    return html`<div class="sea-backdrop" @click=${(e) => { if (e.target === e.currentTarget) this._closePlayerCard(); }}>
      <section
        class="ficha"
        role="dialog"
        aria-modal="true"
        aria-label="Ficha de ciudadanía de ${name}"
        tabindex="-1"
        @keydown=${this._onPlayerCardKeydown}
      >
        <header class="sea-head">
          <h3>🏅 Ficha de ciudadanía</h3>
          <button class="close" aria-label="Cerrar la ficha de ciudadanía" title="Cerrar (Esc)" @click=${this._closePlayerCard}>✕</button>
        </header>
        <player-card
          .playerName=${name}
          .progress=${prog}
          .achievements=${this.achievements}
          .visitedIslands=${this.journey?.visitedIslands ?? []}
          .questions=${this.questions ?? []}
        ></player-card>
      </section>
    </div>`;
  }

  // ---- El brujo de la isla (MC-22) --------------------------------------------

  /** Etiquetas de estado de una consulta al brujo. */
  static QUESTION_BADGES = Object.freeze({
    pending: 'Esperando al brujo',
    answered: 'Respuesta lista',
    seen: 'Vista',
  });

  /** La persona seleccionada (con su uid de cuenta vinculada, si lo tiene). */
  get _selectedPerson() {
    return (this.people ?? []).find((p) => p.id === this.personId) ?? null;
  }

  /**
   * true si el usuario puede DEJAR consultas y marcarlas como vistas: el líder
   * jugando (canEdit: escribe todo el subárbol) o el jugador vinculado
   * (Person.uid == su uid: la excepción acotada de las reglas). Si no, el
   * panel del brujo queda en solo lectura.
   */
  get _canAskWizard() {
    if (this.canEdit) return true;
    const uid = this.currentUser?.uid;
    return Boolean(uid && this._selectedPerson?.uid === uid);
  }

  /**
   * Autoría de consultas/respuestas desde el login (como las notas del tool
   * Equipo): sin uid no se registra autoría — degradación con gracia, nunca
   * un autor inventado.
   * @returns {{ uid: string, name: string }|undefined}
   */
  _wizardAuthor() {
    const user = this.currentUser;
    if (!user?.uid) return undefined;
    return { uid: user.uid, name: user.name };
  }

  /** Nombre de la isla actual: el del índice del archipiélago o el del mapa cargado. */
  _currentIslandName() {
    const indexName = this._islandName(this.currentIsland);
    if (indexName !== '') return indexName;
    return this.map?.name ?? '';
  }

  /**
   * Carga EN PARALELO las consultas al brujo de las personas visibles (cola
   * del líder, MC-22): misma política y cap que los journeys del equipo. Una
   * persona ilegible no tumba al resto (se avisa por consola y no cuenta).
   */
  async _loadTeamQuestions() {
    const people = this.people ?? [];
    const capped = people.slice(0, CareerApp.MAX_TEAM_JOURNEYS);
    if (people.length > capped.length) {
      console.warn(
        `Cola del brujo: ${people.length} personas visibles; se cargan solo las consultas de las ${CareerApp.MAX_TEAM_JOURNEYS} primeras para acotar las lecturas.`,
      );
    }
    await Promise.all(
      capped.map(async (person) => {
        if (person.id === this.personId && this.questions) return; // ya en caché vía _load()
        try {
          this._teamQuestions.set(person.id, await listQuestions(this.store, person.id));
        } catch (err) {
          console.warn(`Cola del brujo: no se pudieron cargar las consultas de "${person.id}".`, err);
        }
      }),
    );
    this._refreshWizardPending();
  }

  /** Recuenta las consultas PENDIENTES de la caché del equipo (contador HUD). */
  _refreshWizardPending() {
    let count = 0;
    for (const questions of this._teamQuestions.values()) {
      count += pendingQuestions(questions).length;
    }
    this.wizardPending = count;
  }

  /**
   * Cola FIFO del líder: las consultas pendientes de TODAS las personas en
   * caché, la más antigua primero, con su persona para responder en contexto.
   * @returns {{ personId: string, personName: string, question: import('../../tools/career/domain/wizard.js').WizardQuestion }[]}
   */
  _pendingQueue() {
    const names = new Map((this.people ?? []).map((p) => [p.id, p.name]));
    const queue = [];
    for (const [personId, questions] of this._teamQuestions) {
      const personName = names.get(personId);
      if (personName === undefined) continue; // persona ya no visible
      for (const question of pendingQuestions(questions)) {
        queue.push({ personId, personName, question });
      }
    }
    return queue.toSorted((a, b) => {
      if (a.question.createdAt === b.question.createdAt) return 0;
      if (!a.question.createdAt) return 1;
      if (!b.question.createdAt) return -1;
      return a.question.createdAt < b.question.createdAt ? -1 : 1;
    });
  }

  /** La cabaña pidió abrir el panel del brujo (clic, [E] o choque en la isla). */
  _onOpenWizard() {
    this._openWizard();
  }

  /** Abre el panel del brujo de la isla actual. */
  _openWizard() {
    if (!this.personId) return;
    this.wizardError = '';
    this.showWizard = true;
  }

  /** Cierra el panel del brujo (✕, Escape o fondo) y devuelve el foco al HUD. */
  _closeWizard() {
    this.showWizard = false;
    this._recapturePointerLock();
    this.updateComplete.then(() => this.renderRoot.querySelector('.hud button')?.focus());
  }

  /** Escape dentro del panel del brujo lo cierra. @param {KeyboardEvent} event */
  _onWizardKeydown(event) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    this._closeWizard();
  }

  /**
   * Deja la consulta escrita en la cabaña del brujo: usecase askQuestion
   * (valida el texto), autoría del login y la isla ACTUAL. La lista local, la
   * caché del equipo y el estado de la cabaña se refrescan al momento.
   */
  async _askWizard() {
    if (!this.personId || this.wizardBusy) return;
    const textarea = /** @type {HTMLTextAreaElement|null} */ (
      this.renderRoot.querySelector('#wizard-question')
    );
    const text = textarea?.value.trim() ?? '';
    if (!text) {
      this.wizardError = 'Escribe tu consulta antes de dejarla al brujo.';
      return;
    }
    this.wizardBusy = true;
    this.wizardError = '';
    try {
      const created = await askQuestion(this.store, this.personId, {
        islandId: this.currentIsland,
        islandName: this._currentIslandName(),
        text,
        createdBy: this._wizardAuthor(),
      });
      this.questions = [created, ...(this.questions ?? [])];
      textarea.value = '';
    } catch (err) {
      this.wizardError =
        err instanceof Error ? err.message : 'No se pudo dejar la consulta al brujo.';
    } finally {
      this.wizardBusy = false;
    }
  }

  /**
   * «Entendido»: marca la respuesta como VISTA (usecase markQuestionSeen, que
   * escribe SOLO status+seenAt — la máscara de la excepción del jugador
   * vinculado). La cabaña vuelve a su reposo si no queda nada pendiente.
   * @param {import('../../tools/career/domain/wizard.js').WizardQuestion} question
   */
  async _markSeen(question) {
    if (!this.personId || this.wizardBusy) return;
    this.wizardBusy = true;
    this.wizardError = '';
    try {
      const patch = await markQuestionSeen(this.store, this.personId, question.id);
      this.questions = (this.questions ?? []).map((q) =>
        q.id === question.id ? { ...q, ...patch } : q,
      );
    } catch (err) {
      this.wizardError =
        err instanceof Error ? err.message : 'No se pudo marcar la respuesta como vista.';
    } finally {
      this.wizardBusy = false;
    }
  }

  /** Abre la cola de consultas del líder (botón «🧙 Consultas (N)»). */
  _openWizardQueue() {
    if (!this.canEdit) return;
    this.wizardError = '';
    this.showWizardQueue = true;
  }

  /** Cierra la cola del líder y devuelve el foco al HUD. */
  _closeWizardQueue() {
    this.showWizardQueue = false;
    this.updateComplete.then(() => this.renderRoot.querySelector('.hud button')?.focus());
  }

  /** Escape dentro de la cola del líder la cierra. @param {KeyboardEvent} event */
  _onWizardQueueKeydown(event) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    this._closeWizardQueue();
  }

  /**
   * «Responder» desde la cola del líder: usecase answerQuestion con la autoría
   * del login y el «Con ayuda de» opcional (creditedTo). Al responder, la
   * consulta sale de pendientes; si era de la persona cargada, su lista (y la
   * cabaña de su isla) se refrescan también.
   * @param {string} personId
   * @param {import('../../tools/career/domain/wizard.js').WizardQuestion} question
   */
  async _answerFromQueue(personId, question) {
    if (this.wizardBusy) return;
    const textarea = /** @type {HTMLTextAreaElement|null} */ (
      this.renderRoot.querySelector(`#wq-answer-${question.id}`)
    );
    const credited = /** @type {HTMLInputElement|null} */ (
      this.renderRoot.querySelector(`#wq-credit-${question.id}`)
    );
    const answer = textarea?.value.trim() ?? '';
    if (!answer) {
      this.wizardError = 'Escribe la respuesta antes de enviarla.';
      return;
    }
    this.wizardBusy = true;
    this.wizardError = '';
    try {
      const patch = await answerQuestion(this.store, personId, question.id, {
        answer,
        answeredBy: this._wizardAuthor(),
        creditedTo: credited?.value.trim() ?? '',
      });
      const updated = (this._teamQuestions.get(personId) ?? []).map((q) =>
        q.id === question.id ? { ...q, ...patch } : q,
      );
      this._teamQuestions.set(personId, updated);
      if (personId === this.personId) this.questions = updated; // la cabaña pasa a «respuesta lista»
      this._refreshWizardPending();
    } catch (err) {
      this.wizardError =
        err instanceof Error ? err.message : 'No se pudo responder la consulta.';
    } finally {
      this.wizardBusy = false;
    }
  }

  /** Botón «🧙 Consultas (N)» de la barra: solo con canEdit (cola del líder). */
  _renderWizardQueueButton() {
    if (!this.canEdit) return null;
    return html`<button
      @click=${this._openWizardQueue}
      title="Abrir la cola de consultas al brujo pendientes de tu gente"
    >🧙 Consultas (${this.wizardPending})</button>`;
  }

  /** Insignia de estado de una consulta. @param {import('../../tools/career/domain/wizard.js').WizardQuestion} q */
  _renderQuestionBadge(q) {
    return html`<span class="wstatus ${q.status}">${CareerApp.QUESTION_BADGES[q.status]}</span>`;
  }

  /**
   * Bloque de respuesta de una consulta (si la tiene): el texto del brujo y
   * «— respondida por {con-ayuda-de ?? quien-respondió}». Con `creditedTo` el
   * crédito es para el developer que ayudó (derivación v1 informativa).
   * @param {import('../../tools/career/domain/wizard.js').WizardQuestion} q
   */
  _renderQuestionAnswer(q) {
    if (!q.answer) return null;
    const credit = q.creditedTo ?? q.answeredBy?.name ?? '';
    return html`<div class="wizanswer">
      <p class="wtext">${q.answer}</p>
      <p class="wby">
        ${credit ? `— respondida por ${credit}` : '— respuesta del brujo'}
        ${q.answeredAt ? ` · ${formatWizardDate(q.answeredAt)}` : ''}
      </p>
    </div>`;
  }

  /**
   * Overlay del PANEL DEL BRUJO (jugador, MC-22): tono jugable, textarea para
   * dejar la consulta (solo quien puede escribir) y MIS consultas de esta isla
   * con estado, respuesta y el botón «Entendido» (markSeen) cuando está
   * respondida. Modal como el archipiélago: foco al abrir, Escape/✕/fondo
   * cierran.
   */
  _renderWizard() {
    if (!this.showWizard) return null;
    const islandName = this._currentIslandName();
    const mine = (this.questions ?? []).filter((q) => q.islandId === this.currentIsland);
    const canAsk = this._canAskWizard;
    return html`<div class="sea-backdrop" @click=${(e) => { if (e.target === e.currentTarget) this._closeWizard(); }}>
      <section
        class="ficha wizpanel"
        role="dialog"
        aria-modal="true"
        aria-label="El brujo de ${islandName}"
        tabindex="-1"
        @keydown=${this._onWizardKeydown}
      >
        <header class="sea-head">
          <h3>🧙 El brujo de ${islandName}</h3>
          <button class="close" aria-label="Cerrar el panel del brujo" title="Cerrar (Esc)" @click=${this._closeWizard}>✕</button>
        </header>
        <p class="wizlead">
          El brujo escucha tu consulta sobre los temas de la isla y se la hace
          llegar al líder. La respuesta te esperará aquí — su farol se
          encenderá en turquesa.
        </p>
        ${this.wizardError ? html`<p class="error" role="alert">${this.wizardError}</p>` : null}
        ${canAsk
          ? html`<div class="wizform">
              <label for="wizard-question">Tu consulta</label>
              <textarea
                id="wizard-question"
                rows="3"
                placeholder="Cuéntale tu duda al brujo…"
                ?disabled=${this.wizardBusy}
              ></textarea>
              <button class="primary" ?disabled=${this.wizardBusy} @click=${this._askWizard}>
                Dejar la consulta
              </button>
            </div>`
          : html`<p class="wizreadonly">Solo puedes leer las consultas de esta persona.</p>`}
        <p class="sub">Consultas en esta isla</p>
        ${mine.length === 0
          ? html`<p class="wizempty">Aún no has dejado ninguna consulta al brujo de esta isla.</p>`
          : html`<ul class="wizlist">
              ${mine.map(
                (q) => html`<li class="wizq">
                  <div class="wmeta">
                    ${this._renderQuestionBadge(q)}
                    <span class="when">${formatWizardDate(q.createdAt)}</span>
                  </div>
                  <p class="wtext">${q.text}</p>
                  ${this._renderQuestionAnswer(q)}
                  ${q.status === 'answered' && canAsk
                    ? html`<button
                        class="primary wseen"
                        ?disabled=${this.wizardBusy}
                        title="Marcar la respuesta como vista"
                        @click=${() => this._markSeen(q)}
                      >Entendido</button>`
                    : null}
                </li>`,
              )}
            </ul>`}
      </section>
    </div>`;
  }

  /**
   * Overlay de la COLA DEL LÍDER (MC-22): las consultas pendientes de todas
   * sus personas (FIFO, la más antigua primero) con persona, isla, fecha y
   * texto; textarea de respuesta, «Con ayuda de» opcional (creditedTo) y
   * «Responder». Al responder desaparece de pendientes.
   */
  _renderWizardQueue() {
    if (!this.showWizardQueue) return null;
    const queue = this._pendingQueue();
    return html`<div class="sea-backdrop" @click=${(e) => { if (e.target === e.currentTarget) this._closeWizardQueue(); }}>
      <section
        class="ficha wizqueue"
        role="dialog"
        aria-modal="true"
        aria-label="Consultas al brujo pendientes"
        tabindex="-1"
        @keydown=${this._onWizardQueueKeydown}
      >
        <header class="sea-head">
          <h3>🧙 Consultas pendientes (${queue.length})</h3>
          <button class="close" aria-label="Cerrar la cola de consultas" title="Cerrar (Esc)" @click=${this._closeWizardQueue}>✕</button>
        </header>
        ${this.wizardError ? html`<p class="error" role="alert">${this.wizardError}</p>` : null}
        ${queue.length === 0
          ? html`<p class="wizempty">No hay consultas pendientes: los brujos descansan.</p>`
          : html`<ul class="wizlist">
              ${queue.map(
                ({ personId, personName, question }) => html`<li class="wizq">
                  <div class="wmeta">
                    <strong>${personName}</strong>
                    <span class="wisle">🏝️ ${question.islandName !== '' ? question.islandName : question.islandId}</span>
                    <span class="when">${formatWizardDate(question.createdAt)}</span>
                  </div>
                  <p class="wtext">${question.text}</p>
                  <div class="wizform">
                    <label for="wq-answer-${question.id}">Respuesta</label>
                    <textarea
                      id="wq-answer-${question.id}"
                      rows="3"
                      placeholder="Tu respuesta (el brujo se la hará llegar)…"
                      ?disabled=${this.wizardBusy}
                    ></textarea>
                    <label for="wq-credit-${question.id}">Con ayuda de (opcional)</label>
                    <input
                      id="wq-credit-${question.id}"
                      type="text"
                      placeholder="Developer que ayudó con la respuesta"
                      ?disabled=${this.wizardBusy}
                    />
                    <button
                      class="primary"
                      ?disabled=${this.wizardBusy}
                      @click=${() => this._answerFromQueue(personId, question)}
                    >Responder</button>
                  </div>
                </li>`,
              )}
            </ul>`}
      </section>
    </div>`;
  }

  /**
   * Viaja en barco a otra isla. Desde MC-19 el viaje se VE: un barquito navega
   * la curva puerto→puerto sobre el mapa del mar (con estela y la proa al
   * rumbo) ANTES del fundido de travesía. Con `prefers-reduced-motion` — o si
   * el índice no trae los puertos — se va directo al fundido de siempre.
   * Un viaje a la vez: clics en otras islas mientras se navega se ignoran.
   * @param {string} islandId
   */
  async _travelTo(islandId) {
    if (!this.personId || this.traveling || this.voyage) return;
    if (islandId === this.currentIsland) {
      this._closeArchipelago();
      return;
    }
    this.error = '';
    const islands = this.archipelago?.islands ?? [];
    const from = islands.find((i) => i.id === this.currentIsland);
    const to = islands.find((i) => i.id === islandId);
    const reduced =
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !from || !to) {
      await this._departTo(islandId);
      return;
    }
    await this._startVoyage(from, to);
  }

  /**
   * Zarpa de verdad (MC-14): persiste `currentIsland` en el journey GLOBAL de
   * la persona, recarga el mapa de la isla destino bajo el fundido de travesía
   * y deja al avatar en su puerto (el spawn por defecto cuando la ciudad
   * actual del journey no está en el mapa cargado). Es el tramo FINAL del
   * viaje: la animación del barco (MC-19) desemboca aquí.
   * @param {string} islandId
   */
  async _departTo(islandId) {
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
   * Arranca la animación del barco (MC-19): calcula el trayecto y su duración
   * (puras, domain/voyage.js), publica el estado `voyage` (pinta el barco, la
   * capa de estela y el aviso aria-live «Zarpando hacia…») y lanza el bucle de
   * rAF. Si los dos puertos del índice coincidieran (trayecto imposible), se
   * zarpa sin animación: el viaje NUNCA se pierde por la parte visual.
   * @param {import('../../tools/career/domain/types.js').IslandRef} from
   * @param {import('../../tools/career/domain/types.js').IslandRef} to
   */
  async _startVoyage(from, to) {
    let path;
    try {
      path = voyagePath(from, to);
    } catch {
      await this._departTo(to.id);
      return;
    }
    this.voyage = { toId: to.id, toName: to.name, path, duration: voyageDuration(path.distance) };
    this._voyageStart = 0;
    this._voyageWakeAt = 0;
    await this.updateComplete; // el barco y su capa ya están en el DOM
    this._voyageRaf = requestAnimationFrame((now) => this._voyageFrame(now));
  }

  /**
   * Un frame del viaje: t = tiempo/duración, el barco se recoloca sobre la
   * curva con la proa al rumbo tangente y suelta estela cada WAKE_INTERVAL_MS.
   * Al llegar (t = 1) desemboca en _finishVoyage → _departTo. Se manipula el
   * DOM directamente (fuera de Lit): re-renderizar el overlay entero a 60 fps
   * sería tirar el resto del mapa por un left/top.
   * @param {number} now Reloj del rAF (ms).
   */
  _voyageFrame(now) {
    const voyage = this.voyage;
    if (!voyage) return; // el viaje terminó (Escape) entre frame y frame
    this._voyageStart ||= now;
    const t = Math.min((now - this._voyageStart) / voyage.duration, 1);
    const boat = this.renderRoot.querySelector('.boat');
    if (boat) {
      boat.style.cssText = this._boatStyleAt(voyage.path, t);
      const layer = this.renderRoot.querySelector('.voyage-layer');
      if (layer && now - this._voyageWakeAt >= WAKE_INTERVAL_MS && t < 1) {
        this._voyageWakeAt = now;
        this._spawnWake(layer, voyagePointAt(voyage.path, t));
      }
    }
    if (t >= 1) {
      this._finishVoyage();
      return;
    }
    this._voyageRaf = requestAnimationFrame((n) => this._voyageFrame(n));
  }

  /**
   * Estilo inline del barco en el instante t: posición sobre la curva y
   * transform con la proa al rumbo tangente. voyageHeading asume un sprite con
   * la proa a +x (este), pero el glifo ⛵ (Noto/Twemoji) mira a la IZQUIERDA:
   * hace falta un espejo base a proa-este que se ANULA con el espejo de los
   * rumbos al oeste — un XOR. El mástil nunca queda boca abajo (|rotate| ≤ 90).
   * El scaleX va DESPUÉS del rotate: se aplica primero al glifo.
   * @param {import('../../tools/career/domain/voyage.js').VoyagePath} path
   * @param {number} t
   * @returns {string}
   */
  _boatStyleAt(path, t) {
    const p = voyagePointAt(path, t);
    const heading = voyageHeading(voyageTangentAngle(path, t));
    const mirror = heading.mirrored ? '' : ' scaleX(-1)';
    return `left:${p.x}%; top:${p.y}%; transform: translate(-50%, -50%) rotate(${heading.rotateDeg}deg)${mirror}`;
  }

  /**
   * Suelta un punto de estela en la posición actual del barco: un span barato
   * con animación CSS de desvanecido que se borra solo al terminar. Imperativo
   * a propósito (como el resto del frame): la estela no es estado de la app.
   * @param {Element} layer Capa .voyage-layer del mapa del mar.
   * @param {{ x: number, y: number }} point Posición en unidades de mapa (%).
   */
  _spawnWake(layer, point) {
    const dot = document.createElement('span');
    dot.className = 'wake';
    dot.style.left = `${point.x}%`;
    dot.style.top = `${point.y}%`;
    dot.addEventListener('animationend', () => dot.remove());
    layer.append(dot);
  }

  /**
   * Fin del viaje animado (por llegada o por Escape): apaga el rAF, retira el
   * barco y zarpa de verdad (_departTo). El viaje SIEMPRE se completa — saltar
   * la animación no lo aborta.
   */
  _finishVoyage() {
    if (!this.voyage) return;
    cancelAnimationFrame(this._voyageRaf);
    this._voyageRaf = 0;
    this._voyageStart = 0;
    const { toId } = this.voyage;
    this.voyage = null;
    this._departTo(toId);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Barco en el mar y componente fuera del DOM: se apaga el rAF (MC-19).
    if (this._voyageRaf) cancelAnimationFrame(this._voyageRaf);
    this._voyageRaf = 0;
    // Y el timer de avisos de ciudadanía (MC-20).
    clearTimeout(this._announceTimer);
    this._announceTimer = 0;
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
          ${this.voyage
            ? html`<div class="voyage-layer" aria-hidden="true">
                <span class="boat" style=${this._boatStyleAt(this.voyage.path, 0)}>⛵</span>
              </div>`
            : null}
        </div>
        <p class="sea-status" role="status" aria-live="polite">
          ${this.voyage ? `Zarpando hacia ${this.voyage.toName}…` : ''}
        </p>
        <p class="sea-hint">
          Elige una isla y zarpa. El viaje es libre: tus certificados te acompañan
          allá donde vayas.
        </p>
      </section>
    </div>`;
  }

  /**
   * HUD superior de PROGRESIÓN (MC-20), en 3D y plano (en fps el HUD es
   * mínimo y no se pinta): progreso de ciudadanía de la isla actual (% frente
   * al objetivo con mini-barra y marca del objetivo; lograda → «🏆
   * Ciudadanía»), islas pisadas, ciudadanías y el badge más alto
   * (👑 Leyenda releva a ⭐ Super-ciudadano). Absorbe al contador de nivel de
   * viaje de antes: los pts/nivel quedan como tooltip del bloque de la isla.
   * @param {import('../../tools/career/domain/citizenship.js').ArchipelagoProgress|null} prog
   * @param {ReturnType<typeof stats>} s Estadísticas de la isla cargada (tooltip).
   */
  _renderProgressHud(prog, s) {
    if (!prog) return null;
    const isle = prog.islands.find((i) => i.id === this.currentIsland) ?? null;
    return html`<div class="hudtop">
      ${isle
        ? html`<div
            class="isle-stat"
            title=${`Nivel de viaje: ${s.level} · ${s.points}/${s.total} pts (${s.pct}%)`}
          >
            <span class="isle-here">${isle.name}</span>
            <div
              class="minibar"
              role="progressbar"
              aria-valuenow=${isle.pct}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label=${`Certificados de ${isle.name}: ${isle.certificates} de ${isle.total} (${isle.pct}%, objetivo ${isle.targetPct}%)`}
            >
              <span class="fill" style=${`width:${isle.pct}%`}></span>
              <span class="goal" style=${`left:${isle.targetPct}%`}></span>
            </div>
            <span class="pcts">${isle.pct}% / objetivo ${isle.targetPct}%</span>
            ${isle.achieved ? html`<span class="hudbadge got">🏆 Ciudadanía</span>` : null}
          </div>`
        : null}
      <span class="hudstat" title="Islas del archipiélago pisadas">
        🏝️ ${prog.islandsVisited}/${prog.islands.length}
      </span>
      <span class="hudstat" title="Ciudadanías de isla conseguidas">🛂 ${prog.citizenships}</span>
      ${prog.legend
        ? html`<span class="hudbadge legend" title="Leyenda del archipiélago: 6 ciudadanías o más">👑 Leyenda</span>`
        : prog.superCitizen
          ? html`<span class="hudbadge super" title="Super-ciudadano: 3 ciudadanías incluyendo Bases de software">⭐ Super-ciudadano</span>`
          : null}
    </div>`;
  }

  /**
   * Aviso de progresión en pantalla (MC-20): «¡Ciudadanía de {isla}
   * conseguida!» acompaña a la celebración mayor y, detrás, los badges
   * (super-ciudadano / leyenda) — uno cada vez, desde la cola secuencial.
   */
  _renderAnnouncement() {
    const a = this.announcement;
    if (!a) return null;
    const text =
      a.kind === 'island'
        ? `🏆 ¡Ciudadanía de ${a.islandName} conseguida!`
        : a.kind === 'super'
          ? '⭐ ¡Super-ciudadano del archipiélago!'
          : '👑 ¡Leyenda del archipiélago!';
    return html`<div class="cit-toast ${a.kind}" role="status" aria-live="assertive">
      <p>${text}</p>
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
          aporta evidencias y consigue sus certificados… y con ellos, la ciudadanía
          de cada isla.
        </p>
        <ul>
          <li>
            <strong>Vista aérea:</strong> arrastra para orbitar, rueda para hacer zoom
            y clic en una casa abre su tarjeta. <kbd>WASD</kbd> o las flechas mueven
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
        ${visited.includes(sel.id) ? 'Retirar el certificado' : 'Obtener certificado'}
      </button>
      <button @click=${() => this._act('current')}>Marcar como ciudad actual</button>
      <button @click=${() => this._act('route')}>${inRoute ? 'Quitar de la ruta' : 'Añadir a la ruta'}</button>
    </div>`;
  }

  /**
   * Recursos a pintar en la pestaña «Recursos» (MC-15): los `resources` de la
   * ciudad y, si aún no tiene (contenido pendiente de curar, MC-16), CAE a las
   * `recommendations` legadas traducidas al modelo nuevo — doc sigue siendo
   * doc y el resto (curso, formacion, titulo) son material de curso.
   * @param {import('../../tools/career/domain/types.js').City} sel
   * @returns {import('../../tools/career/domain/types.js').Resource[]}
   */
  _cityResources(sel) {
    if ((sel.resources ?? []).length) return sel.resources;
    return (sel.recommendations ?? []).map((r) => ({
      kind: r.kind === 'doc' ? 'doc' : 'curso',
      label: r.label,
      ...(r.url ? { url: r.url } : {}),
    }));
  }

  /** Activa una pestaña de la tarjeta. @param {typeof CITY_TABS[number]} tab */
  _setCityTab(tab) {
    this.cityTab = tab;
  }

  /**
   * Teclado de la barra de pestañas de la tarjeta (patrón ARIA tablist con
   * activación automática, como <engineer-space>): ←/→ circulan, Home/End
   * saltan a los extremos y el foco sigue a la pestaña activada.
   * @param {KeyboardEvent} e
   */
  _onCityTabsKeydown(e) {
    const i = CITY_TABS.indexOf(this.cityTab);
    let next = i;
    if (e.key === 'ArrowLeft') next = (i - 1 + CITY_TABS.length) % CITY_TABS.length;
    else if (e.key === 'ArrowRight') next = (i + 1) % CITY_TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = CITY_TABS.length - 1;
    else return;
    e.preventDefault();
    e.stopPropagation(); // que las flechas no lleguen al canvas (movería el avatar)
    const tab = CITY_TABS[next];
    this._setCityTab(tab);
    this.updateComplete.then(() => {
      /** @type {HTMLElement|null} */ (this.renderRoot.querySelector(`#citytab-${tab}`))?.focus();
    });
  }

  /**
   * Barra de pestañas de la tarjeta (roving tabindex: solo la activa tabula).
   * Compartida por el panel overlay del 3D y el detalle de la vista plana.
   */
  _renderCityTabBar() {
    return html`<div class="ctabs" role="tablist" aria-label="Secciones de la tarjeta" @keydown=${this._onCityTabsKeydown}>
      ${CITY_TABS.map((tab) => {
        const selected = this.cityTab === tab;
        return html`<button
          id="citytab-${tab}"
          class="ctab ${selected ? 'active' : ''}"
          type="button"
          role="tab"
          aria-selected=${selected ? 'true' : 'false'}
          aria-controls="citypanel-${tab}"
          tabindex=${selected ? '0' : '-1'}
          @click=${() => this._setCityTab(tab)}
        >${CITY_TAB_LABELS[tab]}</button>`;
      })}
    </div>`;
  }

  /**
   * Pestaña «Certificado» (default): insignias de estado, prerequisitos que
   * faltan para el visado, acciones del journey y evidencias (chips).
   * @param {import('../../tools/career/domain/types.js').City} sel
   */
  _renderCityCertificate(sel) {
    const map = this._map;
    const st = cityStatus(map, sel.id, this.journey);
    const status = st === 'unknown' ? 'blocked' : st;
    const inRoute = (this.journey.plannedRoute ?? []).includes(sel.id);
    const isCurrent = this.journey.currentCity === sel.id;
    const missing = missingPrereqs(map, sel.id, this.journey.visitedCities ?? []).map(
      (id) => map.cities.find((c) => c.id === id)?.name ?? id,
    );
    return html`
      <div class="badges">
        <span class="badge ${status}">${CareerApp.STATUS_BADGES[status]}</span>
        ${isCurrent ? html`<span class="badge current">Actual</span>` : null}
        ${inRoute ? html`<span class="badge route">En ruta</span>` : null}
      </div>
      ${status === 'blocked' && missing.length
        ? html`<p class="blockedby">Para conseguir el visado te falta: ${missing.join(', ')}.</p>`
        : null}
      ${this._renderCityActions(sel)}
      ${this._renderCityEvidences(sel)}
    `;
  }

  /**
   * Pestaña «Qué aprender» (MC-15): puntos fundamentales con check visual y el
   * bloque destacado «🤖 Con IA» (aiFocus: qué hace la IA por ti y dónde
   * profundizar tú). Sin contenido todavía → «Contenido en preparación».
   * @param {import('../../tools/career/domain/types.js').City} sel
   */
  _renderCityLearn(sel) {
    const points = sel.keyPoints ?? [];
    const focus = sel.aiFocus ?? '';
    if (!points.length && !focus) {
      return html`<p class="placeholder">Contenido en preparación.</p>`;
    }
    return html`
      ${points.length
        ? html`<ul class="keypoints">
            ${points.map((p) => html`<li><span class="tick" aria-hidden="true">✔</span><span>${p}</span></li>`)}
          </ul>`
        : null}
      ${focus
        ? html`<div class="aifocus">
            <h4>🤖 Con IA</h4>
            <p>${focus}</p>
          </div>`
        : null}
    `;
  }

  /**
   * Pestaña «Recursos» (MC-15): recursos agrupados por tipo con su icono
   * (🎓 curso, ✍️ post, 📚 libro con etiqueta papel/online, 📄 doc) y enlace
   * cuando tienen url. Sin recursos ni recommendations → «Sin recursos todavía».
   * @param {import('../../tools/career/domain/types.js').City} sel
   */
  _renderCityResources(sel) {
    const resources = this._cityResources(sel);
    if (!resources.length) return html`<p class="placeholder">Sin recursos todavía.</p>`;
    const groups = Object.entries(RESOURCE_GROUPS)
      .map(([kind, meta]) => ({ meta, items: resources.filter((r) => r.kind === kind) }))
      .filter((g) => g.items.length);
    return html`${groups.map(
      ({ meta, items }) => html`<div class="resgroup">
        <h4>${meta.icon} ${meta.title}</h4>
        <ul class="res">
          ${items.map(
            (r) => html`<li>
              ${r.url ? html`<a href=${r.url} target="_blank" rel="noopener">${r.label}</a>` : html`<span>${r.label}</span>`}
              ${r.format ? html`<span class="fmt">${r.format}</span>` : null}
            </li>`,
          )}
        </ul>
      </div>`,
    )}`;
  }

  /**
   * Tarjeta de la casa en pestañas (MC-15): barra tablist + el panel de la
   * pestaña activa. COMPARTIDA por el overlay del 3D y la vista plana.
   * @param {import('../../tools/career/domain/types.js').City} sel
   */
  _renderCityTabs(sel) {
    const content = {
      certificado: () => this._renderCityCertificate(sel),
      aprender: () => this._renderCityLearn(sel),
      recursos: () => this._renderCityResources(sel),
    }[this.cityTab]();
    return html`
      ${this._renderCityTabBar()}
      <div
        id="citypanel-${this.cityTab}"
        class="ctabpanel"
        role="tabpanel"
        aria-labelledby="citytab-${this.cityTab}"
        tabindex="0"
      >${content}</div>
    `;
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

  /** Insignias de juego del estado de la casa (completar una casa = CERTIFICADO;
   * la ciudadanía es de la ISLA, MC-20). */
  static STATUS_BADGES = Object.freeze({
    visited: 'Certificado',
    available: 'Visado disponible',
    blocked: 'Bloqueada',
    deprecated: 'En desuso',
  });

  /**
   * Tarjeta de la casa overlay del modo 3D (MC-15): título con el nombre de la
   * ciudad, subtítulo de comarca y las TRES pestañas (Certificado / Qué
   * aprender / Recursos) — el mismo render de tabs que la vista plana.
   * @param {import('../../tools/career/domain/types.js').City} sel
   */
  _renderCityPanel(sel) {
    const areaName = this._map.areas.find((a) => a.id === sel.area)?.name;
    return html`<aside
      class="citypanel"
      role="dialog"
      aria-label="Tarjeta de ${sel.name}"
      tabindex="-1"
      @keydown=${this._onPanelKeydown}
    >
      <header>
        <div>
          <h3>${sel.name}</h3>
          <p class="kind">${areaName ? html`${areaName} · ` : null}${sel.kind} · ${sel.weight} pts</p>
        </div>
        <button class="close" aria-label="Cerrar panel" title="Cerrar (Esc)" @click=${this._closeCityPanel}>✕</button>
      </header>
      ${this._renderCityTabs(sel)}
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
    // Progresión del archipiélago (MC-20): del journey global y el índice ya
    // cargado para el mapa del mar (nada de leer los 13 docs de isla).
    const prog = this.archipelago ? archipelagoProgress(this.journey, this.archipelago.islands) : null;
    const sel = this.selected ? map.cities.find((c) => c.id === this.selected) : null;
    const selAreaName = sel ? map.areas.find((a) => a.id === sel.area)?.name : null;
    const fps = this.viewMode === '3d' && this.mode3d === 'fps';
    // Estado de la cabaña del brujo (MC-22): derivado en puro de las consultas
    // de la persona cargada EN la isla actual.
    const hutState = wizardState(
      (this.questions ?? []).filter((q) => q.islandId === this.currentIsland),
    );
    return html`
      ${fps
        ? null
        : html`
            <div class="bar">
              ${this._renderPersonSelect()}
              ${this._renderViewSwitch()}
              ${this._renderArchipelagoButton()}
              ${this._renderPlayerCardButton()}
              ${this._renderWizardQueueButton()}
              ${this._renderProgressHud(prog, s)}
            </div>
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
              .overlayOpen=${Boolean(this.selected) ||
              this.showArchipelago ||
              this.showPlayerCard ||
              this.showWizard ||
              this.showWizardQueue}
              .teammates=${this.showTeam ? this.teammates : CareerApp.EMPTY_TEAMMATES}
              .wizardState=${hutState}
              @select-city=${this._onSelect}
              @select-teammate=${this._onSelectTeammate}
              @open-archipelago=${this._onOpenArchipelago}
              @open-wizard=${this._onOpenWizard}
              @webgl-unavailable=${this._onWebglUnavailable}
              @mode-change=${this._onModeChange}
            ></career-island-3d>
            <div class="hud">
              ${fps
                ? html`<button
                    @click=${this._exitFps}
                    title="Volver a la vista aérea de la isla"
                  >Salir (Esc)</button>${this._renderArchipelagoButton()}${this._renderPlayerCardButton()}${this._renderAudioButton()}`
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
                <p class="kind">${selAreaName ? html`${selAreaName} · ` : null}${sel.kind} · ${sel.weight} pts</p>
                ${this._renderCityTabs(sel)}
                ${(sel.prereqs ?? []).length
                  ? html`<p class="pre">Requiere: ${sel.prereqs.map((p) => map.cities.find((c) => c.id === p)?.name).join(', ')}</p>`
                  : null}
              `
            : html`<p class="hint">Haz clic en una ciudad de la isla para ver su tarjeta: certificado, qué aprender y recursos.</p>`}
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
      ${this._renderPlayerCard()}
      ${this._renderWizard()}
      ${this._renderWizardQueue()}
      ${this._renderTravelFade()}
      ${this._renderAnnouncement()}
    `;
  }
}

if (!customElements.get('career-app')) {
  customElements.define('career-app', CareerApp);
}
