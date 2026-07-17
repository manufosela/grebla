/**
 * <career-app>
 * Shell del Mapa de Carrera: selector de PERSONA del equipo, barra de progreso/
 * nivel, el mapa de la isla y un panel de acciones/evidencias para la ciudad
 * seleccionada. Igual que Role Mirror, el manager elige a quién edita y el journey
 * se persiste en el subárbol de esa persona.
 *
 * CONSOLA DE JUEGO (JG-4): el componente ES el marco de consola — :host pinta
 * el borde grueso redondeado, el fondo navy y el bisel/glow; la página clara
 * queda fuera como passe-partout. Dentro del marco, la barra superior integra
 * los controles (viewswitch + botones de juego + selector de persona a la
 * derecha) y una SEGUNDA LÍNEA con el marcador (HUD de progreso y carpool en
 * chips oscuros). Los tokens locales `--game-*` viven en :host; las
 * superficies claras (overlays y paneles) conservan su tinta y se armonizan
 * con cabeceras oscuras (.sea-head y el header de la tarjeta de casa). De
 * cara al jugador, quien responde consultas es su «manager».
 *
 * UI PERGAMINO (JG-7, estética Monkey Island): DENTRO del chasis de consola,
 * los overlays del juego (archipiélago, ficha, retos, mi ruta, brujo,
 * carpools, coins, tiempo, onboarding, tarjeta de casa y popover) son papel
 * envejecido — gradientes y manchas CSS, bordes irregulares con quemado
 * interior, nada de imágenes externas — con cabecera de TABLÓN de madera y
 * títulos en serif del sistema con small-caps (el proyecto no carga fuentes
 * externas: decisión documentada). El re-tinte se hace re-declarando los
 * tokens --rm-* dentro de cada superficie (heredan al subárbol, shadow DOM
 * de <player-card> incluido): chips, inputs y botones interiores se ajustan
 * solos manteniendo contraste AA. El mapa del mar pasa a MAPA DEL TESORO:
 * aguada sobre papel, rosa de los vientos SVG inline, islas como manchas
 * dibujadas con nombre en tinta de mapa y una ✗ ROJA sobre la isla actual.
 *
 * En el modo 3D (MC-6) el detalle es la TARJETA DE LA CASA overlay sobre el
 * canvas (lateral en escritorio, hoja inferior en móvil). Desde JG-18 la
 * tarjeta es DIDÁCTICA: una sola tarjeta scrolleable sin pestañas, con el
 * badge de estado en la cabecera junto al título (completar una casa =
 * certificado; la ciudadanía es de la ISLA, MC-20) y el recorrido de lectura
 * «¿Qué es?» (summary) → «Qué aprenderás» (keyPoints con checks) → «🤖 En la
 * era IA» (aiFocus) → «Recursos para el viaje» (plegados, con fallback a las
 * recommendations legadas) → «El certificado» (el flujo explicado ANTES del
 * botón; prereqs navegables si está bloqueada, JG-2). Los renders se
 * COMPARTEN con el detalle de la vista plana (sin duplicar lógica). El zoom
 * al hacer clic lo anima <career-island-3d> por sí solo; aquí solo se invoca
 * `focusOverview()` desde el botón «Isla completa».
 *
 * Evidencias (MC-8): las listas (formaciones, cursos) se editan como CHIPS con
 * ✕ para quitar y un input con botón «+» (o Enter) para añadir de una en una —
 * nada de texto separado por comas. El campo `titulos` desaparece de la UI:
 * los títulos existentes se muestran fusionados dentro de cursos y, al editar
 * cursos, se escriben en `cursos` vaciando `titulos` (migración suave; el
 * modelo CityEvidence no cambia).
 *
 * Primera persona (MC-7, rediseñada en JG-3): el botón «Explorar a pie» del
 * HUD 3D llama a `enterFirstPerson()` del componente de la isla; con puntero
 * grueso (táctil) queda deshabilitado como «modo de escritorio». El evento
 * `mode-change` reduce el HUD en fps: se ocultan la barra superior
 * (persona/vistas/progreso) y quedan «Salir (Esc)» y «🎮 Inmersivo» (opt-in:
 * captura el ratón vía `enterImmersive()`; Escape lo suelta y vuelve al modo
 * libre). Por defecto el cursor queda LIBRE: los botones del HUD funcionan y
 * el panel de ciudadanía se cierra con ✕/Escape SIN re-capturas de ratón
 * (JG-3: cerrar un panel nunca re-engancha el lock). La prop `overlayOpen` de
 * la isla refleja si hay un overlay DOM abierto (panel o archipiélago) para
 * pausar la marcha por teclado.
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
 * viaje se VE antes del fundido, y desde JG-17 lo navega un barco PIRATA
 * (SVG lateral de carta náutica, estilo JG-7): curva Bézier determinista por
 * par de islas que ESQUIVA las islas que pisaría la recta, easing de
 * zarpa/atraque, proa al rumbo con escora en los giros y balanceo de oleaje
 * (estela incluida, duración según la distancia — domain/voyage.js, puro).
 * Escape salta la animación (el viaje sigue), otros clics se ignoran (un
 * viaje a la vez) y con `prefers-reduced-motion` se zarpa directo al fundido. Los compañeros
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
 * El brujo (MC-22, conversación JG-8): cada isla tiene la cabaña del brujo
 * (edificación singular de <career-island-3d>) donde el jugador deja
 * CONSULTAS ASÍNCRONAS al manager. El evento `open-wizard` (clic aéreo, [E] o
 * choque a pie) abre aquí el panel overlay «🧙 El brujo de {isla}»: una
 * CONVERSACIÓN estilo Monkey Island (<game-dialog>: retrato voodoo,
 * bocadillos con texto progresivo) cuyo guion se construye al abrir
 * (_buildWizardScript) — saludo, entrega de respuestas listas con «Entendido»
 * (markSeen) y la consulta como paso 'ask' (quien puede escribir: manager
 * jugando o jugador vinculado; si no, el brujo lo deja en solo escuchar). Al
 * enviarla el brujo entra en TRANCE y promete la LUZ VIOLETA. La lista
 * clásica de consultas de la isla queda tras «ver mis consultas». El estado
 * visual de la cabaña se deriva en puro (domain/wizard.js) de las consultas
 * de la isla actual: pendiente = farol ámbar, respuesta lista = farol VIOLETA
 * — y esa luz también se ve DESDE EL MAR: en el mapa del tesoro las islas con
 * respuesta lista emiten un halo violeta pulsante (JG-8). Con `canEdit`
 * (manager/superadmin) la
 * barra ofrece «🧙 Consultas (N)» con las PENDIENTES de todas sus personas
 * (carga en paralelo, cap MAX_TEAM_JOURNEYS como los journeys) y un overlay
 * de cola FIFO para responder (autoría del login, campo opcional «Con ayuda
 * de» para acreditar al developer que ayudó — derivación v1 informativa).
 * Todas las Q&A quedan en la ficha del jugador (<player-card>, MC-21).
 *
 * Tiempo de juego (MC-23): con permiso de JUGAR (canPlay || canEdit: el
 * ingeniero con su propia persona, o manager/superadmin jugando a la persona
 * seleccionada) un cronómetro de sesión activa
 * (src/lib/playtime.js) corre mientras la pestaña está visible Y hubo
 * interacción en los últimos 120 s; acumula en memoria y vuelca cada 60 s (y
 * al ocultarse la pestaña / pagehide) a
 * /people/{personId}/career/playtime con increment() — pérdida máxima ~60 s
 * si el navegador mata la pestaña sin avisar (best-effort documentado). El
 * histórico por día se poda a los últimos 30 días al cargar a la persona
 * (dispara con >35 claves). La ficha 🏅 muestra el tiempo de la persona
 * cargada (hoy / 7 días / total) y el manager tiene el botón «⏱ Tiempo» con la
 * vista agregada de sus personas (carga en paralelo, cap MAX_TEAM_JOURNEYS).
 *
 * EL INGENIERO JUEGA (JG-1, RMR-TSK-0139): el gating se divide en DOS ejes.
 *  - JUGAR el plan de la persona cargada (marcar visitadas/actual/ruta,
 *    evidencias, viajar, crear/unirse a carpools, preguntar al brujo,
 *    cronómetro de playtime y registro de achievements): `canPlay || canEdit`.
 *    El glue pone canPlay = true SOLO para el ingeniero vinculado, cuyo
 *    personId queda fijado a su propia persona (y las reglas de Firestore
 *    solo le abren journey/playtime/achievements de la SUYA).
 *  - Gestionar el EQUIPO (selector de persona, cola del brujo del manager,
 *    tiempo agregado del equipo): solo `canEdit` (manager/superadmin).
 * Con una sola persona y canPlay el selector ni se pinta.
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
 *  - people: { id: string, name: string, uid?: string|null, careerTargetLevelId?: string|null }[]   personas visibles (equipo del manager; solo la propia con canPlay); el objetivo de carrera alimenta la ruta sugerida (JG-14)
 *  - canEdit: boolean                          manager/superadmin: juega Y gestiona el equipo (cola del brujo, tiempo agregado, selector)
 *  - canPlay: boolean                          ingeniero vinculado (JG-1): juega SU plan, sin gestión de equipo
 *  - currentUser: { uid: string, name: string }|null   login (autoría de consultas/respuestas)
 */
import { LitElement, html, css } from 'lit';
import './career-map.js';
import './career-list.js';
import './career-island-3d.js';
import './player-card.js';
import './game-dialog.js';
import './city-references.js';
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
  getLogbook,
  recordLogbook,
  getEndorsements,
  endorseCity,
  unendorseCity,
  listQuestions,
  askQuestion,
  answerQuestion,
  markQuestionSeen,
  getPlaytime,
  recordPlaytime,
  prunePlaytime,
  startChallenge,
  clearChallenge,
  insertRouteStop,
  stats,
} from '../../tools/career/application/usecases.js';
import { playtimeSummary, formatPlayMinutes } from '../../tools/career/domain/playtime.js';
import { startPlaytimeTracker } from '../../lib/playtime.js';
import { getCareerMap, getArchipelago, getExistingIslandIds, listCareerRoutes } from '../../lib/careerMap.js';
import { getFramework } from '../../lib/careerFramework.js';
import * as carpoolsIo from '../../lib/carpools.js';
import {
  DEFAULT_CARPOOL_SEATS,
  MIN_CARPOOL_SEATS,
  MAX_CARPOOL_SEATS,
  canJoin as canJoinCarpool,
  isMember as isCarpoolMember,
  seatsLeft as carpoolSeatsLeft,
  routeSummary as carpoolRouteSummary,
  carpoolProgress,
  carpoolFromPlannedRoute,
} from '../../tools/career/domain/carpool.js';
import {
  getLedger,
  getCoinsMeta,
  getCoinsBalance,
  listCoinsBalances,
  readCoinsCheckpoint,
  writeCoinsCheckpoint,
} from '../../lib/coins.js';
import { COINS_PUBLIC_KEY_PEM } from '../../lib/coinsPublicKey.js';
import {
  verifyLedger as verifyCoinsLedger,
  entryLabel as coinsEntryLabel,
  coinsFillLevel,
} from '../../tools/career/domain/coins.js';
import { DEFAULT_ISLAND_ID } from '../../tools/career/domain/types.js';
import {
  WAKE_INTERVAL_MS,
  voyageCurve,
  voyagePose,
  voyageBoatOrientation,
  voyageDuration,
} from '../../tools/career/domain/voyage.js';
import { cityStatus, progressPct } from '../../tools/career/domain/progress.js';
import { archipelagoProgress, citizenshipCelebrations } from '../../tools/career/domain/citizenship.js';
import { newAchievements, formatAchievedAt } from '../../tools/career/domain/achievements.js';
import { newCertificateEntries, logbookView, completedRoutes, formatDuration, EMPTY_LOGBOOK } from '../../tools/career/domain/logbook.js';
import { endorsementFor } from '../../tools/career/domain/endorsements.js';
import {
  wizardState,
  pendingQuestions,
  sortQuestionsByDateDesc,
} from '../../tools/career/domain/wizard.js';
import {
  challengeProgress,
  stopNumberByCity,
  challengeEvents,
} from '../../tools/career/domain/challenge.js';
import {
  ROUTE_TIER_KEYS,
  groupRoutesByRole,
  suggestedTierKey,
  ROUTE_TIER_LABELS,
  tierLevelRangeLabel,
  islandOfStop,
  playerRouteDiscipline,
} from '../../tools/career/domain/careerRoutes.js';
import {
  routeNumberByCity,
  resolveRouteStops,
  routeSeaModel,
  formatStopRanges,
} from '../../tools/career/domain/route.js';
import { islandBlobPath } from '../../tools/career/domain/islandShape.js';

/**
 * Barco PIRATA del viaje entre islas (JG-17): SVG procedural lateral de carta
 * náutica, con la paleta de tinta y pergamino del mapa JG-7 (sin imágenes).
 * CONVENCIÓN: la proa mira a la DERECHA (+x, este) — los rumbos al oeste se
 * resuelven con scaleX(-1) en _boatStyleAt, sin el XOR de espejos que
 * necesitaba el glifo ⛵ (que miraba a la izquierda). Casco de madera con
 * franja roja y troneras, castillo de popa, dos velas de pergamino (la mayor
 * con costuras y parche) y gallardete negro con calavera ondeando a popa.
 */
const PIRATE_SHIP_SVG = html`<svg viewBox="0 0 64 44" aria-hidden="true">
  <path d="M27 3.2 L16 4.8 L27 6.6 Z" fill="#221a12" stroke="#4a2e12" stroke-width="0.6" />
  <circle cx="23.6" cy="4.9" r="1.05" fill="#f6eed6" />
  <path d="M27 3 L27 29" stroke="#4a2e12" stroke-width="1.6" />
  <path d="M45 9 L45 28" stroke="#4a2e12" stroke-width="1.4" />
  <path d="M55 27 L63 20.5" stroke="#4a2e12" stroke-width="1.4" stroke-linecap="round" />
  <path d="M27 7.5 Q39.5 9.5 40.5 17 Q39.5 24.5 27 26.5 Z" fill="#f6eed6" stroke="#4a2e12" stroke-width="1" />
  <path d="M29 10 Q37.5 12 38.5 17 M29 24 Q37.5 22 38.5 17" fill="none" stroke="#4a2e12" stroke-width="0.5" opacity="0.55" />
  <rect x="31.6" y="13.8" width="4.6" height="4.6" rx="0.8" transform="rotate(8 33.9 16.1)" fill="#d9c9a3" stroke="#4a2e12" stroke-width="0.55" />
  <path d="M45 11 Q53.5 13 54.5 19 Q53.5 24 45 26 Z" fill="#f6eed6" stroke="#4a2e12" stroke-width="0.9" />
  <path d="M5 26.5 L11 27.5 L52 27.5 Q57 27 60.5 23.5 L56.5 33 Q53.5 37.5 46 38 L17 38 Q10 37.5 7 33 Z" fill="#8a5a2b" stroke="#4a2e12" stroke-width="1.1" stroke-linejoin="round" />
  <path d="M5.5 27 L7 22.5 L14.5 22.5 L14.5 27.4 Z" fill="#6b4423" stroke="#4a2e12" stroke-width="1" />
  <path d="M9 31.5 Q30 33.8 54.5 30.4" fill="none" stroke="#b3261e" stroke-width="1.6" opacity="0.9" />
  <circle cx="22" cy="30.3" r="1" fill="#221a12" />
  <circle cx="32" cy="30.7" r="1" fill="#221a12" />
  <circle cx="42" cy="30.4" r="1" fill="#221a12" />
</svg>`;

/**
 * Metadatos de cada tipo de recurso (MC-15): icono y título del grupo en la
 * sección «Recursos para el viaje». El orden del objeto es el orden de pintado.
 * @type {Record<import('../../tools/career/domain/types.js').ResourceKind, { icon: string, title: string }>}
 */
const RESOURCE_GROUPS = {
  curso: { icon: '🎓', title: 'Cursos' },
  post: { icon: '✍️', title: 'Posts' },
  libro: { icon: '📚', title: 'Libros' },
  doc: { icon: '📄', title: 'Docs' },
};

/**
 * Caché de siluetas de isla del mar (JG-12): islandBlobPath es determinista
 * (misma id y escala → mismo path), así que se calcula una vez por capa y se
 * reutiliza en cada re-render del overlay (el barco re-renderiza por rAF).
 * @type {Map<string, string>}
 */
const seaBlobCache = new Map();

/** Path memoizado de la mancha de una isla a una escala dada (JG-12).
 * @param {string} id @param {number} [scale] */
function seaBlobPath(id, scale = 1) {
  const key = `${id}@${scale}`;
  let d = seaBlobCache.get(key);
  if (d === undefined) {
    d = islandBlobPath(id, { scale });
    seaBlobCache.set(key, d);
  }
  return d;
}

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
    canPlay: { attribute: false },
    currentUser: { attribute: false },
    personId: { state: true },
    error: { state: true },
    journey: { state: true },
    selected: { state: true },
    _cityTab: { state: true },
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
    planoMaps: { state: true },
    existingIslands: { state: true },
    showArchipelago: { state: true },
    traveling: { state: true },
    voyage: { state: true },
    announcement: { state: true },
    achievements: { state: true },
    logbook: { state: true },
    showLogbook: { state: true },
    endorsements: { state: true },
    endorseBusy: { state: true },
    evidencePrompt: { state: true },
    showPlayerCard: { state: true },
    questions: { state: true },
    showWizard: { state: true },
    showWizardLog: { state: true },
    wizardScript: { state: true },
    showWizardQueue: { state: true },
    wizardPending: { state: true },
    wizardBusy: { state: true },
    wizardError: { state: true },
    playtime: { state: true },
    showPlaytime: { state: true },
    playtimeRows: { state: true },
    carpoolService: { attribute: false },
    showCarpools: { state: true },
    carpoolTab: { state: true },
    carpools: { state: true },
    myCarpools: { state: true },
    carpoolBusy: { state: true },
    carpoolError: { state: true },
    cpDraft: { state: true },
    carpoolStops: { state: true },
    showChallenges: { state: true },
    careerRoutes: { state: true },
    challengeBusy: { state: true },
    challengeError: { state: true },
    challengeConfirmAbandon: { state: true },
    routePicker: { state: true },
    showRoute: { state: true },
    routeView: { state: true },
    routeIsChallenge: { state: true },
    routeCompleted: { state: true },
    routeBusy: { state: true },
    routeError: { state: true },
    routeSea: { state: true },
    showCoins: { state: true },
    coinsBalance: { state: true },
    coinsLedger: { state: true },
    coinsVerify: { state: true },
    coinsAlert: { state: true },
    coinsBusy: { state: true },
    coinsError: { state: true },
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
  /** Duración (ms) del aviso «Siguiente: {casa}» del modo Reto (JG-5): más
   * largo que un badge — lleva el botón «Llévame» y hay que darle tiempo. */
  static ANNOUNCE_CHALLENGE_MS = 6000;
  /** Lista vacía ESTABLE de paradas de carpool (CP-1): sin cambios de
   * referencia la isla no rehace su grupo de ciudades en cada render. */
  static EMPTY_CARPOOL_STOPS = Object.freeze([]);
  /** Borrador VACÍO del formulario «Crear carpool» (CP-1). */
  static EMPTY_CP_DRAFT = Object.freeze({
    name: '',
    seats: DEFAULT_CARPOOL_SEATS,
    islandId: '',
    cityId: '',
    targetDate: '',
    stops: Object.freeze([]),
    notice: '',
  });
  /** Pestañas del overlay de carpools (CP-1). */
  static CARPOOL_TABS = Object.freeze(['board', 'mine', 'create']);
  /** Etiquetas de las pestañas del overlay de carpools. */
  static CARPOOL_TAB_LABELS = Object.freeze({
    board: 'Tablón',
    mine: 'Los míos',
    create: 'Crear',
  });
  /** Etiquetas legibles del estado de un carpool (CP-1). */
  static CARPOOL_STATUS_LABELS = Object.freeze({
    open: 'Abierto',
    full: 'Completo',
    completed: 'Terminado',
    closed: 'Cerrado',
  });

  static styles = css`
    /* ── CONSOLA DE JUEGO (JG-4): todo el juego vive dentro de este marco
       oscuro con look propio, claramente distinto de la página clara (que
       queda fuera como passe-partout). Tokens locales del marco: ── */
    :host {
      --game-bg: #0f1b2d;
      --game-bg-2: #16283f;
      --game-edge: #2c4568;
      --game-text: #e8eef7;
      --game-muted: #a7bad3;
      --game-chip: rgba(255, 255, 255, 0.07);
      --game-line: rgba(255, 255, 255, 0.14);
      --game-panel: rgba(11, 20, 34, 0.72);
      --game-accent: #3dd6c3;
      --game-accent-ink: #06231f;
      --game-focus: #8be9dd;
      /* ── UI PERGAMINO (JG-7): papel envejecido y madera de los overlays del
         juego (mapa del tesoro, ficha, retos, ruta, brujo, carpools, coins,
         tiempo, onboarding y tarjeta de casa). Solo gradientes/sombras CSS,
         nada de imágenes externas. Tinta marrón MUY oscura sobre papel claro:
         contraste AA holgado (>9:1). ── */
      --parch-bg: #f3e6c8;
      --parch-bg-2: #ead6a8;
      --parch-ink: #33240f;
      --parch-muted: #6b5433;
      --parch-edge: #b98f56;
      --parch-burn: rgba(92, 58, 20, 0.35);
      --wood-1: #7a5a33;
      --wood-2: #55391c;
      --wood-edge: #3a2712;
      --wood-text: #f6e8c9;
      /* Display serif del SISTEMA para títulos: el proyecto no carga fuentes
         externas (decisión JG-7) — el carácter lo dan small-caps + tracking. */
      --parch-title: Georgia, 'Palatino Linotype', 'Book Antiqua', 'Times New Roman', serif;
      display: flex;
      flex-direction: column;
      min-height: 0;
      font-family: var(--rm-font, system-ui, sans-serif);
      color: var(--game-text);
      background: linear-gradient(180deg, var(--game-bg-2) 0%, var(--game-bg) 55%, #0c1626 100%);
      border: 3px solid var(--game-edge);
      border-radius: 22px;
      padding: 0.85rem;
      box-sizing: border-box;
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.09),
        inset 0 0 0 1px rgba(6, 12, 22, 0.85),
        0 0 26px rgba(61, 214, 195, 0.14),
        0 18px 44px rgba(15, 27, 45, 0.28);
    }
    /* En móvil el marco ocupa el ancho con bordes menores. */
    @media (max-width: 760px) {
      :host { border-radius: 14px; border-width: 2px; padding: 0.5rem; }
    }
    /* Las superficies claras (overlays y paneles) conservan su tinta oscura:
       el color claro del marco NO debe heredarse dentro de ellas. */
    .sea, .ficha, .onboard, .citypanel, .panel, .matepop { color: var(--rm-text, #111827); }
    /* En modo 3D el canvas es el protagonista: ocupa todo el alto disponible y
       el panel de ciudadanía y el HUD flotan SOBRE él (overlay). */
    .stage3d { position: relative; display: flex; flex: 1 1 auto; min-height: 0; border-radius: 14px; overflow: hidden; }
    career-island-3d.stage { flex: 1 1 auto; min-height: 0; }
    .hud { position: absolute; top: 0.75rem; left: 0.75rem; z-index: 2; display: flex; gap: 0.5rem; flex-wrap: wrap; }
    /* Botones DENTRO del canvas: oscuros translúcidos, coherentes con el marco. */
    .hud button {
      background: var(--game-panel, rgba(11, 20, 34, 0.72));
      border: 1px solid var(--game-line, rgba(255, 255, 255, 0.14));
      color: var(--game-text, #e8eef7);
      font-weight: 700;
      backdrop-filter: blur(4px);
      box-shadow: 0 2px 10px rgba(4, 10, 20, 0.45);
    }
    .hud button:hover:not(:disabled) {
      border-color: color-mix(in srgb, var(--game-accent, #3dd6c3) 55%, transparent);
      background: color-mix(in srgb, var(--game-accent, #3dd6c3) 16%, var(--game-panel, rgba(11, 20, 34, 0.72)));
      box-shadow: 0 0 12px rgba(61, 214, 195, 0.28);
    }
    .hud button:focus-visible { outline: 2px solid var(--game-focus, #8be9dd); outline-offset: 2px; }
    .hud button:disabled { opacity: 0.6; cursor: not-allowed; }
    /* En móvil el HUD sobre el canvas se hace chip: roba menos escena. */
    @media (max-width: 760px) {
      .hud { top: 0.5rem; left: 0.5rem; gap: 0.35rem; }
      .hud button { padding: 0.32rem 0.5rem; font-size: 0.78rem; }
    }
    /* ═══ PANEL DE CASA = MAPA DEL TESORO (RMR-TSK-0256) ═══
       Pergamino LITERAL: papel asimétrico rasgado (filtro SVG #citytorn),
       extremos curvados (enrollado), tinta serif y contenido en pestañas.
       .citypanel = envoltorio 80% del área de juego; .paper = papel rasgado
       (fondo, filtrado); .ink = contenido nítido encima. */
    .citypanel {
      position: absolute;
      z-index: 5;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 80%;
      height: 82%;
      max-width: 1000px;
      box-sizing: border-box;
      outline: none;
      /* Tokens de papel para las superficies interiores de las secciones. */
      --rm-surface: #f4e7c3;
      --rm-border: #cdb183;
      --rm-track: #e9d9af;
      --rm-muted: var(--parch-muted, #6b5433);
      --rm-text: var(--parch-ink, #33240f);
      color: var(--parch-ink, #33240f);
      filter: drop-shadow(0 18px 36px rgba(6, 12, 22, 0.55));
    }
    /* Backdrop que atenúa el escenario detrás de la hoja (click = cerrar). */
    .citypanel-backdrop {
      position: absolute;
      inset: 0;
      z-index: 4;
      background: rgba(6, 12, 22, 0.5);
    }
    /* En móvil la hoja ocupa casi toda la pantalla. */
    @media (max-width: 760px) {
      .citypanel { width: 94%; height: 90%; max-width: none; }
    }
    /* Papel envejecido con bordes RASGADOS (filtro) y manchas de mugre. */
    .citypanel .paper {
      position: absolute;
      inset: 0;
      border-radius: 16px;
      filter: url(#citytorn);
      background:
        radial-gradient(90px 60px at 18% 24%, rgba(110, 70, 20, 0.20), transparent 70%),
        radial-gradient(130px 80px at 82% 30%, rgba(80, 50, 12, 0.18), transparent 70%),
        radial-gradient(70px 50px at 68% 82%, rgba(110, 70, 20, 0.20), transparent 70%),
        radial-gradient(60px 90px at 8% 70%, rgba(80, 50, 12, 0.16), transparent 70%),
        radial-gradient(50px 40px at 40% 92%, rgba(70, 45, 10, 0.20), transparent 70%),
        linear-gradient(180deg, #e7d3a1, #dcc389 48%, #cdb072 100%);
      box-shadow: inset 0 0 60px rgba(110, 70, 18, 0.5), inset 0 0 14px rgba(60, 38, 8, 0.7);
    }
    /* Sombras de CURVATURA (enrollado) en los extremos superior e inferior. */
    .citypanel .paper::before,
    .citypanel .paper::after {
      content: "";
      position: absolute;
      left: 4%;
      right: 4%;
      height: 42px;
      pointer-events: none;
    }
    .citypanel .paper::before {
      top: 0;
      background: linear-gradient(180deg, rgba(60, 38, 8, 0.45), transparent);
      border-radius: 100% 100% 40% 40% / 42px 42px 0 0;
    }
    .citypanel .paper::after {
      bottom: 0;
      background: linear-gradient(0deg, rgba(60, 38, 8, 0.5), transparent);
      border-radius: 40% 40% 100% 100% / 0 0 42px 42px;
    }
    /* Contenido (tinta): SIN filtro para que el texto quede nítido. */
    .citypanel .ink {
      position: absolute;
      inset: 22px 32px;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .citypanel .ctitle {
      font-family: var(--parch-title, Georgia, serif);
      font-variant: small-caps;
      letter-spacing: 0.03em;
      margin: 0.2rem 0 0.05rem;
      font-size: 1.5rem;
      color: #5a3d16;
    }
    .citypanel .ckind { margin: 0; font-size: 0.82rem; color: #7a5a2c; }
    .citypanel .ctabs {
      display: flex;
      gap: 0.15rem;
      flex-wrap: wrap;
      margin: 0.6rem 0 0;
      border-bottom: 2px solid rgba(110, 70, 20, 0.45);
    }
    .citypanel .ctabs button {
      border: 0;
      background: transparent;
      font-family: var(--parch-title, Georgia, serif);
      font-size: 0.9rem;
      color: #8a6a3a;
      padding: 0.35rem 0.75rem;
      cursor: pointer;
      border-bottom: 3px solid transparent;
      margin-bottom: -2px;
    }
    .citypanel .ctabs button.on { color: #4a3416; border-bottom-color: #8a4a18; font-weight: 700; }
    .citypanel .ctabs button:focus-visible { outline: 2px solid #8a4a18; outline-offset: 2px; }
    .citypanel .cbody {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 0.85rem 0.1rem 0;
    }
    /* Sello de LACRE = cerrar. */
    .citypanel .seal {
      position: absolute;
      z-index: 3;
      top: 10px;
      right: 18px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 0;
      cursor: pointer;
      font-family: var(--parch-title, Georgia, serif);
      font-size: 1rem;
      color: #f4d9a0;
      background: radial-gradient(circle at 38% 34%, #c0392b, #7a1d16);
      box-shadow: inset 0 2px 3px rgba(255, 180, 160, 0.4), inset 0 -3px 5px rgba(0, 0, 0, 0.5), 0 3px 7px rgba(0, 0, 0, 0.45);
    }
    .citypanel .seal:hover { filter: brightness(1.1); }
    .citypanel .seal:focus-visible { outline: 2px solid #f4d9a0; outline-offset: 2px; }
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
    /* Aval del manager (JG-6): sello dorado (misma familia que los badges
       grandes de la ficha) y acciones del manager en la tarjeta. */
    .endorse { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin: 0 0 0.75rem; }
    .endorse .seal {
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.28rem 0.75rem; border-radius: 999px;
      background: linear-gradient(135deg, #f6d365 0%, #e8b931 100%); color: #5b4300;
      font-size: 0.78rem; font-weight: 800;
      box-shadow: 0 1px 4px rgba(17, 24, 39, 0.18);
    }
    .endorse .seal .tick { font-weight: 900; }
    .endorse .seal .when { font-size: 0.7rem; font-weight: 600; opacity: 0.85; }
    .endorse .endorse-btn {
      border: 1.5px solid var(--rm-accent, #2a9d8f); color: var(--rm-accent, #2a9d8f);
      background: transparent; border-radius: 999px; font-weight: 700;
    }
    .endorse .endorse-btn:hover:not(:disabled) { background: var(--rm-accent, #2a9d8f); color: #fff; }
    .endorse .unendorse {
      border: none; background: transparent; padding: 0.15rem 0.35rem;
      font-size: 0.72rem; font-weight: 600; color: var(--rm-muted, #6b7280);
      text-decoration: underline; border-radius: 6px;
    }
    .endorse .unendorse:hover:not(:disabled) { color: var(--rm-danger, #dc2626); }
    .endorse button:disabled { opacity: 0.6; cursor: default; }
    /* Sugerencia de evidencia tras certificar (JG-6): invitación descartable. */
    .evprompt {
      display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;
      margin: 0.75rem 0 0; padding: 0.55rem 0.75rem;
      border: 1px solid color-mix(in srgb, var(--rm-accent, #2a9d8f) 45%, transparent);
      border-radius: 10px;
      background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 10%, var(--rm-surface, #fff));
    }
    .evprompt p { margin: 0; flex: 1 1 12rem; font-size: 0.82rem; color: var(--rm-text, #111827); font-weight: 600; }
    .evprompt .evlater {
      flex: 0 0 auto; border: none; background: transparent; padding: 0.2rem 0.4rem;
      font-size: 0.75rem; font-weight: 600; color: var(--rm-muted, #6b7280);
      text-decoration: underline; border-radius: 6px;
    }
    .evprompt .evlater:hover { color: var(--rm-navy, #1e3a5f); }
    /* ── Bloque de prerequisitos de una casa bloqueada (JG-2): sustituye al
       CTA imposible. Conseguidos en teal; pendientes como botones coral que
       navegan a la casa correspondiente. ── */
    .prereqs {
      border: 1px solid var(--rm-border, #e5e7eb);
      border-left: 4px solid var(--rm-coral-600, #e26d5e);
      background: color-mix(in srgb, var(--rm-coral, #f2887a) 8%, var(--rm-surface, #fff));
      border-radius: 10px;
      padding: 0.7rem 0.85rem;
      margin: 0 0 0.9rem;
    }
    .prereqs h4 { margin: 0 0 0.5rem; font-size: 0.85rem; color: var(--rm-text, #111827); }
    .prereqs ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .prereqs li { display: flex; align-items: center; gap: 0.45rem; font-size: 0.85rem; }
    .prereqs li.done { color: var(--rm-accent, #2a9d8f); font-weight: 600; }
    .prereqs li.done .tick { font-weight: 700; }
    .prereqs .goto {
      border: 1px solid var(--rm-coral-600, #e26d5e);
      color: var(--rm-coral-600, #e26d5e);
      background: var(--rm-surface, #fff);
      border-radius: 999px;
      padding: 0.3rem 0.75rem;
      font-size: 0.8rem;
      font-weight: 700;
      text-align: left;
      cursor: pointer;
    }
    .prereqs .goto:hover { background: var(--rm-coral-600, #e26d5e); color: #fff; }
    .prereqs .goto:focus-visible { outline: 2px solid var(--rm-navy, #1e3a5f); outline-offset: 2px; }
    /* Texto solo para lectores de pantalla (estado «conseguido» del prereq). */
    .visuallyhidden {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }
    /* ── Barra superior INTEGRADA del marco (JG-4): una banda oscura con los
       controles del juego en la primera línea y el marcador (HUD) en la
       segunda — nada de botones blancos sueltos sobre la página. ── */
    .bar {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      margin-bottom: 0.6rem;
      padding: 0.6rem 0.75rem;
      background: rgba(255, 255, 255, 0.045);
      border: 1px solid var(--game-line, rgba(255, 255, 255, 0.14));
      border-radius: 14px;
    }
    .controls { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .controls > button {
      border: 1px solid var(--game-line, rgba(255, 255, 255, 0.14));
      background: var(--game-chip, rgba(255, 255, 255, 0.07));
      color: var(--game-text, #e8eef7);
      font-weight: 700;
      letter-spacing: 0.01em;
      border-radius: 10px;
    }
    .controls > button:hover {
      border-color: color-mix(in srgb, var(--game-accent, #3dd6c3) 55%, transparent);
      background: color-mix(in srgb, var(--game-accent, #3dd6c3) 16%, transparent);
      box-shadow: 0 0 12px rgba(61, 214, 195, 0.25);
    }
    .controls > button:focus-visible { outline: 2px solid var(--game-focus, #8be9dd); outline-offset: 2px; }
    /* El selector de persona, a la derecha (salvo que sea el único control). */
    .controls label:not(:first-child) { margin-left: auto; }
    .controls label { color: var(--game-muted, #a7bad3); }
    .controls select {
      background: var(--game-panel, rgba(11, 20, 34, 0.72));
      border-color: var(--game-line, rgba(255, 255, 255, 0.14));
      color: var(--game-text, #e8eef7);
    }
    .controls select:focus-visible { outline: 2px solid var(--game-focus, #8be9dd); outline-offset: 2px; }
    /* Segunda línea del marco: el marcador de juego (progresión y carpool). */
    .hudline {
      display: flex;
      align-items: center;
      gap: 0.5rem 0.9rem;
      flex-wrap: wrap;
      border-top: 1px solid var(--game-line, rgba(255, 255, 255, 0.14));
      padding-top: 0.55rem;
    }
    /* En móvil la botonera NO envuelve (comería la mitad de la pantalla al
       juego): cada línea es UNA fila con scroll horizontal, patrón consola. */
    @media (max-width: 760px) {
      .bar { padding: 0.4rem 0.5rem; gap: 0.4rem; margin-bottom: 0.45rem; }
      .controls,
      .hudline {
        flex-wrap: nowrap;
        overflow-x: auto;
        overscroll-behavior-x: contain;
        scrollbar-width: none;
        padding-bottom: 0.1rem;
      }
      .controls::-webkit-scrollbar,
      .hudline::-webkit-scrollbar { display: none; }
      .controls > button,
      .viewswitch button { white-space: nowrap; padding: 0.35rem 0.55rem; font-size: 0.78rem; }
      .hudline { padding-top: 0.45rem; }
      /* Los hijos no se encogen: la fila se desplaza, no se aplasta. */
      .controls > *,
      .hudline > * { flex: 0 0 auto; }
      /* El botón-cofre (JG-13) no engorda la fila-scroll de la consola. */
      .coinsbtn .chesticon { width: 17px; height: 14px; }
    }
    label { font-size: 0.8rem; color: var(--rm-muted, #6b7280); font-weight: 600; display: inline-flex; gap: 0.4rem; align-items: center; }
    select { padding: 0.4rem 0.6rem; border-radius: 8px; border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); font-size: 0.9rem; }
    .viewswitch {
      display: inline-flex;
      border: 1px solid var(--game-line, rgba(255, 255, 255, 0.14));
      border-radius: 10px;
      overflow: hidden;
      background: var(--game-panel, rgba(11, 20, 34, 0.72));
    }
    .viewswitch button { border: none; border-radius: 0; background: transparent; color: var(--game-muted, #a7bad3); font-size: 0.8rem; font-weight: 800; padding: 0.45rem 0.75rem; cursor: pointer; }
    .viewswitch button + button { border-left: 1px solid var(--game-line, rgba(255, 255, 255, 0.14)); }
    .viewswitch button:hover:not(.active) { color: var(--game-text, #e8eef7); background: rgba(255, 255, 255, 0.06); }
    .viewswitch button.active { background: var(--game-accent, #3dd6c3); color: var(--game-accent-ink, #06231f); }
    .viewswitch button:focus-visible { outline: 2px solid var(--game-focus, #8be9dd); outline-offset: -2px; }
    /* ── HUD superior de progresión (MC-20): ciudadanía de la isla actual,
       islas pisadas, ciudadanías y badge. Compacto y a la derecha de la barra. ── */
    .hudtop { display: flex; align-items: center; gap: 0.5rem 0.75rem; flex-wrap: wrap; }
    .isle-stat {
      display: flex; align-items: center; gap: 0.45rem;
      background: var(--game-chip, rgba(255, 255, 255, 0.07));
      border: 1px solid var(--game-line, rgba(255, 255, 255, 0.14));
      border-radius: 999px;
      padding: 0.22rem 0.75rem;
    }
    .isle-here { font-weight: 800; font-size: 0.85rem; color: var(--game-text, #e8eef7); white-space: nowrap; }
    .minibar { position: relative; width: 110px; height: 8px; background: rgba(255, 255, 255, 0.16); border-radius: 999px; }
    .minibar .fill {
      display: block; height: 100%; max-width: 100%;
      background: var(--game-accent, #3dd6c3); border-radius: 999px; transition: width 0.3s ease;
    }
    /* Marca del % objetivo sobre la mini-barra: la meta visible de la ciudadanía. */
    .minibar .goal { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--rm-coral, #f2887a); border-radius: 1px; }
    .pcts { font-size: 0.8rem; font-weight: 600; color: var(--game-muted, #a7bad3); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .hudstat {
      font-size: 0.82rem; font-weight: 700; color: var(--game-text, #e8eef7);
      font-variant-numeric: tabular-nums; white-space: nowrap;
      background: var(--game-chip, rgba(255, 255, 255, 0.07));
      border: 1px solid var(--game-line, rgba(255, 255, 255, 0.14));
      border-radius: 999px;
      padding: 0.22rem 0.7rem;
    }
    /* Chip del RETO activo (JG-5): un .hudstat clicable (lleva a la siguiente
       casa del camino) con el acento coral del objetivo. */
    button.hudstat.challenge {
      cursor: pointer;
      border-color: color-mix(in srgb, var(--rm-coral-600, #e26d5e) 65%, transparent);
    }
    button.hudstat.challenge:hover {
      background: color-mix(in srgb, var(--rm-coral-600, #e26d5e) 22%, transparent);
      box-shadow: 0 0 12px rgba(226, 109, 94, 0.3);
    }
    button.hudstat.challenge:focus-visible { outline: 2px solid var(--game-focus, #8be9dd); outline-offset: 2px; }
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
    /* Avisos del modo Reto (JG-5): «Siguiente: {casa}» es el único toast
       INTERACTIVO (botón «Llévame» → recibe punteros); el de reto completado
       comparte su tinta navy→teal, pasivo como los demás. */
    .cit-toast.challenge,
    .cit-toast.challenge-done {
      background: linear-gradient(135deg, var(--rm-navy, #1e3a5f) 0%, var(--rm-accent, #2a9d8f) 100%);
      color: #fff;
    }
    .cit-toast.challenge { pointer-events: auto; }
    .cit-toast .golead {
      margin-left: 0.5rem;
      padding: 0.2rem 0.7rem;
      border: 1px solid rgba(255, 255, 255, 0.65);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.14);
      color: #fff;
      font-size: 0.82rem;
      font-weight: 800;
      cursor: pointer;
    }
    .cit-toast .golead:hover { background: rgba(255, 255, 255, 0.28); }
    .cit-toast .golead:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    .cit-toast p { margin: 0; font-size: 1.05rem; font-weight: 800; white-space: nowrap; }
    @keyframes cit-pop {
      from { opacity: 0; transform: translateX(-50%) translateY(-14px) scale(0.85); }
      to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .cit-toast { animation: none; }
    }
    @media (max-width: 760px) {
      .cit-toast p { white-space: normal; text-align: center; }
    }
    .grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(220px, 1fr); gap: 1.5rem; align-items: start; }
    @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
    /* Vista LISTA (RMR-BUG-0023): la lista larga scrollea DENTRO del marco (fijado
       a 100dvh por la página) en vez de desbordarlo. */
    .listgrid { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
    .panel { background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #e5e7eb); border-radius: var(--rm-radius, 12px); padding: 1rem 1.25rem; }
    .panel h3 { margin: 0 0 0.2rem; }
    .kind { font-size: 0.8rem; color: var(--rm-muted, #6b7280); margin: 0 0 0.75rem; text-transform: capitalize; }
    .actions { display: flex; flex-direction: column; gap: 0.5rem; }
    /* Selector «¿Dónde en tu ruta?» (JG-9): plegado inline bajo «Añadir a la
       ruta…», con el acento ámbar de la ruta libre. */
    .routepick {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      margin-top: 0.25rem;
      padding: 0.55rem 0.65rem;
      border: 1px solid color-mix(in srgb, #f2b632 55%, transparent);
      border-radius: 10px;
      background: color-mix(in srgb, #f2b632 12%, transparent);
    }
    .routepick-lead { margin: 0; font-size: 0.78rem; font-weight: 700; color: var(--rm-navy, #1e3a5f); }
    .routepick button { text-align: left; }
    .routepick .routepick-cancel { color: var(--rm-muted, #6b7280); }
    button { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); border-radius: 8px; padding: 0.5rem 0.8rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
    button.primary { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: #fff; }
    .nextstep { display: block; width: 100%; margin-top: 0.6rem; background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: #fff; font-weight: 800; text-align: center; }
    .nextstep:hover { filter: brightness(1.06); }
    .nextstep:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
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
    .empty { color: var(--game-muted, #a7bad3); padding: 1rem 0.25rem; }
    /* Errores: tinta clara sobre el marco oscuro; dentro de las superficies
       claras (overlays/paneles) conservan el rojo de siempre. */
    .error { color: #ff9d94; }
    .sea .error, .ficha .error, .onboard .error, .citypanel .error, .panel .error { color: var(--rm-danger, #dc2626); }
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
      border-top: 4px solid var(--game-accent, #3dd6c3);
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
    /* Cabecera oscura compartida por los overlays (archipiélago, ficha, brujo,
       tiempo, carpools, coins): armoniza cada modal con la consola (JG-4). */
    .sea-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin: -1rem -1.25rem 0.75rem;
      padding: 0.65rem 1.1rem;
      background: linear-gradient(180deg, var(--game-bg-2, #16283f), var(--game-bg, #0f1b2d));
      border-bottom: 2px solid var(--game-accent, #3dd6c3);
      border-radius: calc(var(--rm-radius, 12px) - 2px) calc(var(--rm-radius, 12px) - 2px) 0 0;
    }
    .sea-head h3 { margin: 0; font-size: 1.1rem; color: var(--game-text, #e8eef7); }
    .sea-head .close { color: var(--game-muted, #a7bad3); }
    .sea-head .close:hover { color: #fff; background: rgba(255, 255, 255, 0.12); }
    /* Ficha de ciudadanía del jugador (MC-21): modal hermano del mapa del mar
       (mismo backdrop y cabecera). Desde JG-10 es un PASAPORTE con grid de
       visados por isla: algo más ancho que las listas para que respiren dos
       columnas de sellos. */
    .ficha {
      width: min(760px, calc(100% - 2rem));
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
    /* ── Catálogo de RETOS (JG-14): modal hermano de la ficha (mismo backdrop
       y cabecera). Itinerarios de ROL y NIVEL agrupados por rol, con chips de
       hito en los colores de la escala y la ruta sugerida destacada; con reto
       activo, cabecera de progreso y abandono con confirmación in-place. ── */
    .retos {
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
    .retos .error { color: var(--rm-danger, #dc2626); }
    .reto-lead { margin: 0 0 0.85rem; font-size: 0.85rem; color: var(--rm-muted, #6b7280); }
    .reto-activo {
      margin: 0 0 0.85rem;
      padding: 0.6rem 0.8rem;
      border: 1px solid color-mix(in srgb, var(--rm-coral-600, #e26d5e) 45%, transparent);
      border-radius: 10px;
      background: color-mix(in srgb, var(--rm-coral, #f2887a) 12%, transparent);
    }
    .reto-activo .reto-nombre { margin: 0 0 0.45rem; font-size: 0.9rem; color: var(--rm-text, #111827); }
    .reto-activo .reto-confirm { margin: 0; font-size: 0.85rem; color: var(--rm-text, #111827); display: flex; flex-wrap: wrap; align-items: center; gap: 0.45rem; }
    .reto-activo button.danger { background: var(--rm-danger, #dc2626); border-color: var(--rm-danger, #dc2626); color: #fff; }
    .reto-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.45rem; }
    .reto {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.55rem 0.75rem;
      border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: 10px;
      background: var(--rm-surface, #fff);
    }
    .reto.active { border-color: var(--rm-accent, #2a9d8f); background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 8%, transparent); }
    .reto-info { display: flex; flex-direction: column; gap: 0.12rem; min-width: 0; }
    .reto-info strong { font-size: 0.9rem; color: var(--rm-navy, #1e3a5f); }
    .reto-meta { font-size: 0.76rem; color: var(--rm-muted, #6b7280); }
    .reto-tag {
      flex: 0 0 auto;
      font-size: 0.72rem;
      font-weight: 800;
      padding: 0.18rem 0.6rem;
      border-radius: 999px;
      background: var(--rm-accent, #2a9d8f);
      color: #fff;
      white-space: nowrap;
    }
    .reto > button, .reto-abandonar { flex: 0 0 auto; }
    /* Grupos por ROL del catálogo (JG-14): rótulo del rol y sus hitos. */
    /* Opción «Mi propia ruta» (JG-22): el default del selector, arriba del todo. */
    .reto-libre {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      width: 100%;
      text-align: left;
      margin: 0 0 0.85rem;
      padding: 0.7rem 0.85rem;
      border-radius: var(--rm-radius, 12px);
      border: 1.5px solid var(--parch-edge, #b98f56);
      background: var(--parch-bg-2, #ead6a8);
      color: var(--parch-ink, #33240f);
      cursor: pointer;
      font: inherit;
    }
    .reto-libre.sel { border-color: var(--rm-accent, #2a9d8f); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--rm-accent, #2a9d8f) 40%, transparent); cursor: default; }
    .reto-libre:not(.sel):hover { border-color: var(--rm-accent, #2a9d8f); }
    .reto-libre-ico { font-size: 1.3rem; line-height: 1; }
    .reto-libre-info { display: flex; flex-direction: column; gap: 0.1rem; }
    .reto-libre-info strong { font-size: 0.95rem; }
    .reto-libre-meta { font-size: 0.78rem; color: var(--parch-muted, #6b5433); }
    .reto-roles { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.85rem; }
    .rol-name { margin: 0 0 0.35rem; font-size: 0.95rem; color: var(--rm-navy, #1e3a5f); }
    /* Chip del HITO con el color de la escala GREBLA (levels.js): tinte de
       fondo + borde sólido para mantener contraste AA sobre pergamino. */
    .tier-chip {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      padding: 0.1rem 0.5rem;
      margin-right: 0.35rem;
      border-radius: 999px;
      border: 1.5px solid var(--tier-color);
      background: color-mix(in srgb, var(--tier-color) 22%, transparent);
      color: var(--rm-text, #111827);
      white-space: nowrap;
    }
    /* Tramo de niveles L del career path al que corresponde el rango. */
    .tier-range {
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--rm-muted, #6b7280);
      margin-right: 0.35rem;
      white-space: nowrap;
    }
    .reto-sugerida {
      display: inline-block;
      margin-left: 0.35rem;
      font-size: 0.7rem;
      font-weight: 800;
      padding: 0.1rem 0.5rem;
      border-radius: 999px;
      background: var(--rm-navy, #1e3a5f);
      color: #fff;
      white-space: nowrap;
    }
    /* ── Gestor «🧭 Mi ruta» (JG-9): modal hermano del catálogo de retos. La
       ruta libre completa en orden — número global (ámbar; ✓ certificada),
       casa, isla y estado — con subir/bajar y quitar. ── */
    .ruta {
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
    .ruta .error { color: var(--rm-danger, #dc2626); }
    .ruta-lead { margin: 0 0 0.85rem; font-size: 0.85rem; color: var(--rm-muted, #6b7280); }
    /* Panel de logro «🏆 ¡Ruta completada!» (RMR-BUG-0017). */
    .route-done {
      position: relative;
      width: min(440px, calc(100% - 2rem));
      box-sizing: border-box;
      text-align: center;
      background: linear-gradient(160deg, color-mix(in srgb, var(--rm-navy, #1e3a5f) 96%, #000) 0%, var(--rm-accent, #2a9d8f) 150%);
      color: #fff;
      border-radius: var(--rm-radius, 14px);
      padding: 1.6rem 1.4rem 1.2rem;
      box-shadow: 0 18px 50px rgba(17, 24, 39, 0.42);
      outline: none;
    }
    .route-done .close { position: absolute; top: 0.5rem; right: 0.6rem; background: transparent; border: none; color: rgba(255, 255, 255, 0.85); font-size: 1.1rem; cursor: pointer; }
    .route-done-badge { font-size: 3rem; line-height: 1; }
    .route-done h3 { margin: 0.35rem 0 0.15rem; font-size: 1.3rem; }
    .route-done-name { margin: 0.1rem 0 0.15rem; font-weight: 800; font-size: 1rem; }
    .route-done-meta { margin: 0; font-size: 0.85rem; color: rgba(255, 255, 255, 0.85); }
    .route-done-next { margin-top: 1.1rem; }
    .route-done-next-lead { margin: 0 0 0.4rem; font-size: 0.8rem; color: rgba(255, 255, 255, 0.85); }
    .route-done-next .primary { width: 100%; background: #fff; color: var(--rm-navy, #1e3a5f); border: none; border-radius: 999px; padding: 0.55rem 0.9rem; font-weight: 800; cursor: pointer; }
    .route-done-next .primary:hover { filter: brightness(0.96); }
    .route-done-ok { margin-top: 0.9rem; background: transparent; border: 1px solid rgba(255, 255, 255, 0.5); color: #fff; border-radius: 999px; padding: 0.4rem 1.1rem; font-weight: 700; cursor: pointer; }
    .ruta-done { text-align: left; }
    .ruta-hint { margin: 0.3rem 0 0; font-size: 0.8rem; color: var(--rm-muted, #9ca3af); }
    /* Historial «🏆 Mis rutas» (RMR-TSK-0170). */
    .mis-rutas { margin-top: 1.1rem; padding-top: 0.9rem; border-top: 1px solid var(--rm-border, #e5e7eb); }
    .mis-rutas h4 { margin: 0 0 0.6rem; font-size: 0.9rem; color: var(--rm-navy, #1e3a5f); }
    .mis-rutas-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .mis-rutas-item { display: flex; flex-direction: column; gap: 0.05rem; padding: 0.4rem 0.55rem; border-radius: 8px; background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 8%, transparent); }
    .mis-rutas-item .mr-name { font-weight: 700; font-size: 0.85rem; color: var(--rm-text, #111827); }
    .mis-rutas-item .mr-meta { font-size: 0.76rem; color: var(--rm-muted, #6b7280); }
    .mis-rutas-next { margin-top: 0.8rem; display: flex; flex-direction: column; gap: 0.35rem; }
    .mis-rutas-next .mr-next-lead { font-size: 0.78rem; font-weight: 700; color: var(--rm-navy, #1e3a5f); }
    .mis-rutas-next .primary { align-self: flex-start; }
    .ruta-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.45rem; }
    .ruta-stop {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: 10px;
      background: var(--rm-surface, #fff);
    }
    .ruta-stop.done { background: color-mix(in srgb, #f2b632 10%, transparent); }
    .ruta-n {
      flex: 0 0 auto;
      width: 1.7rem;
      height: 1.7rem;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: #f2b632;
      color: var(--rm-navy, #1e3a5f);
      font-weight: 800;
      font-size: 0.85rem;
    }
    .ruta-stop.done .ruta-n { background: #f8e3b0; }
    .ruta-info { display: flex; flex-direction: column; gap: 0.12rem; min-width: 0; flex: 1; }
    .ruta-info strong { font-size: 0.9rem; color: var(--rm-navy, #1e3a5f); }
    .ruta-meta { font-size: 0.76rem; color: var(--rm-muted, #6b7280); }
    .ruta-actions { display: flex; gap: 0.3rem; flex: 0 0 auto; }
    /* ── Tiempo de juego (MC-23): bloque de la ficha y tabla del manager. ── */
    .playblock {
      margin: 0 0 0.75rem;
      padding: 0.45rem 0.7rem;
      border-radius: 10px;
      background: var(--rm-track, #e9f0f2);
      font-size: 0.85rem;
      color: var(--rm-muted, #6b7280);
    }
    .playblock strong { color: var(--rm-navy, #1e3a5f); }
    .timesheet table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    .timesheet th {
      text-align: left;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--rm-muted, #6b7280);
      padding: 0.35rem 0.5rem;
      border-bottom: 2px solid var(--rm-border, #e5e7eb);
    }
    .timesheet td { padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--rm-border, #e5e7eb); }
    .timesheet th.num, .timesheet td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .timesheet td.who { font-weight: 600; color: var(--rm-navy, #1e3a5f); }
    .timesheet .zero { color: var(--rm-muted, #9ca3af); }
    .playlead { margin: 0 0 0.6rem; font-size: 0.85rem; color: var(--rm-muted, #6b7280); }
    /* ── El brujo (MC-22): panel del jugador y cola del manager (hermanos de la
       ficha: mismo backdrop/section, contenido de consultas). ── */
    /* La escena de conversación (JG-8) vive sobre el pergamino del panel. */
    .wizpanel game-dialog { margin: 0.25rem 0 0; }
    .wizlog-link { margin: 0.6rem 0 0; text-align: right; }
    .wizlog-link .linky {
      background: none;
      border: none;
      padding: 0;
      font: inherit;
      font-size: 0.78rem;
      color: var(--rm-muted, #6b7280);
      text-decoration: underline;
      cursor: pointer;
    }
    .wizlog-link .linky:hover { color: var(--rm-text, #111827); }
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
    /* «Respuesta lista» viste de VIOLETA místico (JG-8): el color de la luz
       del brujo, coherente con el farol de la cabaña y el halo del mar. */
    .wstatus.answered { background: #7b2cbf; color: #fff; }
    .wstatus.seen { background: var(--rm-track, #e9f0f2); color: var(--rm-muted, #6b7280); }
    .wtext { margin: 0.4rem 0 0; font-size: 0.88rem; color: var(--rm-text, #111827); white-space: pre-wrap; }
    .wizanswer {
      margin-top: 0.55rem;
      border-left: 4px solid #9d4edd;
      background: color-mix(in srgb, #9d4edd 10%, var(--rm-surface, #fff));
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
    /* En móvil vertical el mar 16/10 quedaría enano (~230px): formato retrato.
       Las islas van en % (translate -50%,-50%), así que se re-reparten solas. */
    @media (max-width: 760px) {
      .sea-map { aspect-ratio: 4 / 5; }
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
    /* Mancha de ISLA (JG-12): la silueta es un SVG inline con la costa
       irregular DETERMINISTA de cada id (islandShape.js) — nada de círculos.
       El span solo da tamaño y anclaje; el dibujo son las capas del path:
       bajío de agua clara, línea de sonda punteada, costa a plumilla con
       aguada de arena y verde de vegetación interior. */
    .isle-dot {
      width: 44px;
      height: 44px;
      display: block;
    }
    .isle-dot svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
      filter: drop-shadow(0 4px 7px rgba(10, 30, 50, 0.35));
    }
    .isle-shoal { fill: rgba(248, 251, 240, 0.38); }
    .isle-sound {
      fill: none;
      stroke: rgba(74, 46, 18, 0.55);
      stroke-width: 1.2;
      stroke-dasharray: 3 4.5;
      stroke-linecap: round;
    }
    .isle-coast { fill: #e5d5a4; stroke: #4a2e12; stroke-width: 2.4; stroke-linejoin: round; }
    .isle-inland { fill: #9dbd8b; }
    .isle.here .isle-coast { stroke: var(--rm-coral-600, #e26d5e); stroke-width: 3.2; }
    .isle.wip { opacity: 0.55; }
    .isle.wip .isle-dot { filter: grayscale(0.45); }
    /* La LUZ del brujo en el mar (JG-8): la isla con una respuesta lista
       emite un halo VIOLETA pulsante sobre su mancha del mapa del tesoro —
       visible desde el archipiélago, no solo desde la propia isla. */
    .isle.wizlit .isle-dot { position: relative; }
    .isle.wizlit .isle-dot::after {
      content: '';
      position: absolute;
      inset: -14px;
      border-radius: 50%;
      background: radial-gradient(
        circle,
        rgba(157, 78, 221, 0.85) 0%,
        rgba(157, 78, 221, 0.35) 45%,
        rgba(157, 78, 221, 0) 72%
      );
      animation: wizhalo 1.7s ease-in-out infinite;
      pointer-events: none;
    }
    @keyframes wizhalo {
      0%, 100% { opacity: 0.55; transform: scale(0.9); }
      50% { opacity: 1; transform: scale(1.18); }
    }
    @media (prefers-reduced-motion: reduce) {
      .isle.wizlit .isle-dot::after { animation: none; }
    }
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
    /* Isla objetivo del reto activo (JG-5): el mapa del mar «apunta» a ella. */
    .isle-tag.target { background: var(--rm-navy, #1e3a5f); color: #fff; }
    /* Ruta LIBRE en el mar (JG-9): etiqueta ámbar en cada isla que la ruta
       toca (con sus números de parada)… */
    .isle-tag.route { background: #f2b632; color: var(--rm-navy, #1e3a5f); }
    /* …y trazo punteado ámbar uniendo las islas EN ORDEN (estilo mapa de
       travesías), bajo los botones de isla y sin robar clics. */
    .route-lines { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
    .route-lines polyline {
      fill: none;
      stroke: #f2b632;
      stroke-width: 2.5px;
      stroke-dasharray: 7 5;
      stroke-linecap: round;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
    }
    /* Barco animado puerto→puerto (MC-19, pirata JG-17): capa del viaje sobre
       el mar. El bucle de rAF recoloca el barco (left/top/transform inline con
       la pose de la curva) y va soltando puntos de estela que se desvanecen
       solos. */
    .voyage-layer { position: absolute; inset: 0; pointer-events: none; }
    .boat {
      position: absolute;
      z-index: 2; /* la proa por delante de su propia estela */
      width: 42px;
      height: 29px;
      filter: drop-shadow(0 2px 3px rgba(10, 30, 50, 0.45));
      will-change: left, top, transform;
    }
    /* Balanceo de oleaje (JG-17): rotación sutil ±1.5° en un wrapper INTERNO —
       el transform del span externo lo pisa el rAF con la pose de cada frame.
       Con prefers-reduced-motion ni siquiera se navega (se zarpa directo al
       fundido), pero el balanceo se apaga igualmente por si acaso. */
    .boat-bob {
      display: block;
      width: 100%;
      height: 100%;
      animation: boat-bob 2.4s ease-in-out infinite;
    }
    .boat-bob svg { display: block; width: 100%; height: 100%; overflow: visible; }
    @keyframes boat-bob {
      0%, 100% { transform: rotate(-1.5deg); }
      50% { transform: rotate(1.5deg); }
    }
    @media (prefers-reduced-motion: reduce) {
      .boat-bob { animation: none; }
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
    /* ── Tarjeta de casa DIDÁCTICA (JG-18): secciones apiladas en orden de
       lectura (¿qué es? → aprender → IA → recursos → certificado), con
       separadores sutiles. h4 = título de sección, h5 = subgrupo. ── */
    .cardsec { margin: 0.9rem 0 0; padding-top: 0.9rem; border-top: 1px solid var(--rm-border, #e5e7eb); }
    .cardsec:first-of-type { margin-top: 0.6rem; border-top: none; padding-top: 0; }
    .cardsec > h4 { margin: 0 0 0.4rem; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rm-muted, #6b7280); font-weight: 800; }
    .summary { margin: 0; font-size: 0.9rem; line-height: 1.5; color: var(--rm-text, #111827); }
    /* Badge-sello de estado en la CABECERA (JG-18): separado de los botones. */
    .headbadge {
      display: inline-block;
      margin-top: 0.4rem;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.02em;
      padding: 0.16rem 0.6rem;
      border-radius: 999px;
      border: 1.5px solid currentColor;
    }
    .headbadge.visited { color: var(--rm-accent, #2a9d8f); background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 16%, transparent); }
    .headbadge.available { color: #b26a00; background: color-mix(in srgb, #f2887a 22%, transparent); }
    .headbadge.blocked { color: var(--rm-muted, #6b7280); background: color-mix(in srgb, var(--rm-muted, #6b7280) 14%, transparent); }
    .headbadge.deprecated { color: var(--rm-danger, #dc2626); text-decoration: line-through; }
    /* Sección final del certificado: el flujo explicado antes del botón. */
    .certflow { margin: 0 0 0.6rem; font-size: 0.85rem; line-height: 1.5; color: var(--rm-muted, #6b7280); }
    .ressec > summary { cursor: pointer; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rm-muted, #6b7280); font-weight: 800; }
    .ressec .resgroup { margin-top: 0.55rem; }
    .ressec h5 { margin: 0 0 0.25rem; font-size: 0.8rem; color: var(--rm-navy, #1e3a5f); }
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
    /* ── Carpools (CP-1): overlay hermano de la ficha (tablón / los míos /
       crear). Tarjetas por grupo, tabla compacta de avance y formulario. ── */
    .cplead { margin: 0 0 0.75rem; font-size: 0.9rem; color: var(--rm-muted, #6b7280); }
    .cplist { list-style: none; margin: 0.5rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
    .cpcard { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.6rem 0.8rem; }
    .cphead { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
    .cphead h4 { margin: 0; font-size: 0.95rem; color: var(--rm-navy, #1e3a5f); }
    .cphead .spacer { margin-left: auto; }
    .cpmeta { margin: 0.25rem 0 0; font-size: 0.8rem; color: var(--rm-muted, #6b7280); }
    .cpseats { font-weight: 700; color: var(--rm-navy, #1e3a5f); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .cpstatus { font-size: 0.66rem; font-weight: 800; padding: 0.12rem 0.5rem; border-radius: 999px; white-space: nowrap; }
    .cpstatus.open { background: var(--rm-accent, #2a9d8f); color: #fff; }
    .cpstatus.full { background: var(--rm-navy, #1e3a5f); color: #fff; }
    .cpstatus.completed { background: linear-gradient(135deg, #f6d365 0%, #e8b931 100%); color: #5b4300; }
    .cpstatus.closed { background: var(--rm-track, #e9f0f2); color: var(--rm-muted, #6b7280); }
    /* Tabla compacta de avance: una fila por parada, una columna por miembro. */
    .cptable { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-top: 0.5rem; }
    .cptable th {
      text-align: left; font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.04em;
      color: var(--rm-muted, #6b7280); padding: 0.25rem 0.4rem;
      border-bottom: 2px solid var(--rm-border, #e5e7eb); white-space: nowrap;
    }
    .cptable td { padding: 0.3rem 0.4rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    .cptable th.mate, .cptable td.mate { text-align: center; }
    .cptable .stopname { font-weight: 600; color: var(--rm-navy, #1e3a5f); }
    .cptable .stopisle { color: var(--rm-muted, #6b7280); }
    .cptable .stopdate { white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--rm-muted, #6b7280); }
    .cptable .stopdate.delayed { color: var(--rm-coral-600, #e26d5e); font-weight: 700; }
    .cpmark { font-weight: 700; }
    .cpmark.done { color: var(--rm-accent, #2a9d8f); }
    .cpmark.pending { color: var(--rm-muted, #9ca3af); }
    .cpmark.delayed { color: var(--rm-coral-600, #e26d5e); }
    /* Avance por miembro bajo la tabla. */
    .cpprogress { list-style: none; margin: 0.5rem 0 0; padding: 0; display: flex; gap: 0.5rem 1rem; flex-wrap: wrap; font-size: 0.8rem; }
    .cpprogress .pct { font-weight: 700; color: var(--rm-accent, #2a9d8f); font-variant-numeric: tabular-nums; }
    .cpprogress .nodata { color: var(--rm-muted, #9ca3af); font-style: italic; }
    .cpactions { display: flex; gap: 0.5rem; margin-top: 0.6rem; flex-wrap: wrap; }
    /* Formulario de creación: filas del constructor de ruta y lista de paradas. */
    .cpformrow { display: flex; gap: 0.5rem; align-items: flex-end; flex-wrap: wrap; margin: 0.4rem 0 0; }
    .cpformrow label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.75rem; }
    .cpformrow select, .cpformrow input { min-width: 0; }
    .cpstops { list-style: none; margin: 0.5rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
    .cpstop {
      display: flex; align-items: center; gap: 0.5rem;
      border: 1px solid var(--rm-border, #eef0f2); border-radius: 8px; padding: 0.3rem 0.5rem; font-size: 0.82rem;
    }
    .cpstop .ord { font-weight: 800; color: var(--rm-navy, #1e3a5f); font-variant-numeric: tabular-nums; }
    .cpstop .when { margin-left: auto; color: var(--rm-muted, #6b7280); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .cpstop button { padding: 0.15rem 0.45rem; font-size: 0.75rem; line-height: 1; }
    .cpnotice { margin: 0.4rem 0 0; font-size: 0.8rem; color: var(--rm-muted, #6b7280); }
    /* ── Tribbu-coins (CP-2): overlay del libro mayor (saldo, verificación,
       historial) y alerta roja del HUD si la verificación detecta trampa. ── */
    .hudbadge.coinsalert { background: var(--rm-danger, #dc2626); color: #fff; animation: coinspulse 1.2s ease-in-out infinite; }
    @keyframes coinspulse { 50% { opacity: 0.55; } }
    @media (prefers-reduced-motion: reduce) { .hudbadge.coinsalert { animation: none; } }
    /* ── Bitácora (JG-23): línea temporal de la travesía sobre el pergamino ── */
    .lb-empty { margin: 0.4rem 0; font-size: 0.9rem; color: var(--parch-muted, #6b5433); }
    .lb-list { list-style: none; margin: 0.3rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.55rem; }
    .lb-item {
      display: flex;
      align-items: baseline;
      gap: 0.6rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px dashed var(--parch-edge, #b98f56);
    }
    .lb-item:last-child { border-bottom: none; padding-bottom: 0; }
    .lb-ico { font-size: 1.1rem; line-height: 1; flex: 0 0 auto; }
    .lb-body { display: flex; flex-direction: column; gap: 0.1rem; }
    .lb-what { font-size: 0.9rem; color: var(--parch-ink, #33240f); }
    .lb-when { font-size: 0.76rem; font-style: italic; color: var(--parch-muted, #6b5433); }
    .coinshead { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin: 0.2rem 0 0.6rem; }
    /* ── JG-13: el COFRE de tribbu-coins (100% CSS/SVG procedural, JG-7) ── */
    /* Botón-cofre de la barra: mini cofre cerrado + saldo al lado. */
    .coinsbtn { display: inline-flex; align-items: center; gap: 0.35rem; font-variant-numeric: tabular-nums; }
    .coinsbtn .chesticon { display: block; width: 20px; height: 17px; flex: 0 0 auto; }
    .coinsbtn.forced { border-color: var(--rm-danger, #dc2626); }
    .coinsbtn.forced .chesticon { filter: drop-shadow(0 0 3px rgba(220, 38, 38, 0.85)); }
    /* Cofre grande del overlay: la tapa gira sobre la bisagra trasera (rotateX
       con origin en el borde inferior + perspective) y queda DETRÁS de la
       caja; el estado base ya es «abierto» para que prefers-reduced-motion
       (animation: none) lo muestre abierto sin animar. */
    .chest { position: relative; z-index: 1; width: min(250px, 100%); margin: 0.3rem auto 0; }
    .chest-scene { position: relative; height: 150px; perspective: 480px; }
    .chest-lid {
      position: absolute; left: 10px; right: 10px; bottom: 78px; height: 60px;
      background:
        repeating-linear-gradient(90deg, rgba(0, 0, 0, 0) 0 34px, rgba(30, 16, 4, 0.22) 34px 36px),
        linear-gradient(180deg, var(--wood-1, #7a5a33) 0%, var(--wood-2, #55391c) 100%);
      border: 2px solid var(--wood-edge, #3a2712);
      border-radius: 52% 52% 6px 6px / 92% 92% 4px 4px;
      box-shadow: inset 0 2px 0 rgba(255, 240, 210, 0.18);
      transform-origin: 50% 100%;
      transform: rotateX(108deg);
      animation: chest-open 0.5s ease-out;
      z-index: 0;
    }
    @keyframes chest-open { from { transform: rotateX(0deg); } }
    @media (prefers-reduced-motion: reduce) { .chest-lid { animation: none; } }
    .chest-lid-band {
      position: absolute; left: 50%; top: -2px; bottom: -2px; width: 26px;
      transform: translateX(-50%);
      background: linear-gradient(180deg, #e0b45c 0%, #c9973f 55%, #a87826 100%);
      border: 1px solid #7c5a18; border-radius: 8px 8px 2px 2px;
      box-shadow: inset 0 1px 0 rgba(255, 245, 210, 0.5);
    }
    /* El hueco oscuro tras el borde y las monedas asomando sobre él. */
    .chest-cavity {
      position: absolute; left: 18px; right: 18px; bottom: 72px; height: 18px;
      background: linear-gradient(180deg, #1c0f04 0%, #3a2712 100%);
      border-radius: 7px 7px 0 0;
      box-shadow: inset 0 3px 6px rgba(0, 0, 0, 0.6);
      z-index: 1;
    }
    .chest-coins { position: absolute; left: 22px; right: 22px; bottom: 74px; height: 52px; z-index: 2; }
    .chest-spill { position: absolute; left: 4px; right: 4px; bottom: -3px; height: 16px; z-index: 4; }
    .coin {
      position: absolute; width: 24px; height: 13px; border-radius: 50%;
      background: radial-gradient(ellipse at 38% 32%, #ffe9a3 0%, #f0c145 45%, #c9973f 78%, #a87826 100%);
      border: 1px solid #8a5f1d;
      box-shadow: inset 0 -2px 2px rgba(122, 80, 16, 0.55), 0 1px 1px rgba(20, 10, 2, 0.35);
    }
    .chest-base {
      position: absolute; left: 12px; right: 12px; bottom: 0; height: 80px;
      background:
        repeating-linear-gradient(0deg, rgba(0, 0, 0, 0) 0 24px, rgba(30, 16, 4, 0.28) 24px 26px),
        linear-gradient(180deg, #8a6a3f 0%, var(--wood-1, #7a5a33) 40%, var(--wood-2, #55391c) 100%);
      border: 2px solid var(--wood-edge, #3a2712);
      border-radius: 6px 6px 12px 12px;
      box-shadow:
        inset 0 2px 0 rgba(255, 240, 210, 0.18),
        inset 0 -6px 12px rgba(20, 10, 2, 0.4),
        0 6px 14px rgba(20, 10, 2, 0.35);
      z-index: 3;
    }
    /* Esquineras de latón de la caja. */
    .chest-base::before, .chest-base::after {
      content: ''; position: absolute; bottom: -2px; width: 18px; height: 22px;
      background: linear-gradient(180deg, #d9a441 0%, #a87826 100%);
      border: 1px solid #7c5a18;
    }
    .chest-base::before { left: -2px; border-radius: 4px 0 0 10px; }
    .chest-base::after { right: -2px; border-radius: 0 4px 10px 0; }
    .chest-band {
      position: absolute; left: 50%; top: -2px; bottom: -2px; width: 26px;
      transform: translateX(-50%);
      background: linear-gradient(180deg, #e0b45c 0%, #c9973f 55%, #a87826 100%);
      border: 1px solid #7c5a18; border-radius: 2px 2px 6px 6px;
      box-shadow: inset 0 1px 0 rgba(255, 245, 210, 0.5);
    }
    .chest-lock {
      position: absolute; left: 50%; top: 6px; width: 18px; height: 20px;
      transform: translateX(-50%);
      background: radial-gradient(circle at 40% 30%, #e8c268 0%, #c9973f 55%, #96691c 100%);
      border: 1px solid #7c5a18; border-radius: 5px;
      box-shadow: 0 1px 2px rgba(20, 10, 2, 0.5);
    }
    .chest-lock::after {
      content: ''; position: absolute; left: 50%; top: 5px; width: 4px; height: 9px;
      transform: translateX(-50%);
      background: #4a3208; border-radius: 2px 2px 1px 1px;
    }
    /* Rótulo de latón con el número del saldo «grabado». */
    .chest-plaque {
      position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%);
      z-index: 5; padding: 0.16rem 0.9rem;
      background: linear-gradient(180deg, #e8c268 0%, #c9973f 45%, #a87826 100%);
      border: 1px solid #7c5a18; border-radius: 7px;
      box-shadow:
        inset 0 1px 0 rgba(255, 245, 210, 0.65),
        inset 0 -2px 3px rgba(90, 60, 10, 0.45),
        0 2px 5px rgba(20, 10, 2, 0.4);
      font-size: 1.2rem; font-weight: 900; color: #4a3208;
      font-variant-numeric: tabular-nums; white-space: nowrap;
      text-shadow: 0 1px 0 rgba(255, 240, 200, 0.55);
    }
    .chest-plaque small { font-size: 0.58rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #5d4210; }
    .chest-plaque::before, .chest-plaque::after {
      content: ''; position: absolute; top: 50%; width: 5px; height: 5px;
      transform: translateY(-50%); border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #ffe9a3, #96691c);
    }
    .chest-plaque::before { left: 4px; }
    .chest-plaque::after { right: 4px; }
    /* Cofre FORZADO (misma señal que la alerta 🚨 del HUD): tapa torcida a
       medio abrir, herraje suelto y tinte rojizo con brillo de peligro. */
    .chest.forced .chest-scene { filter: sepia(0.35) hue-rotate(-24deg) saturate(1.5) drop-shadow(0 0 10px rgba(220, 38, 38, 0.5)); }
    .chest.forced .chest-lid { transform: rotateX(38deg) rotateZ(-7deg); animation: none; }
    .chest.forced .chest-band { transform: translateX(-50%) rotate(13deg) translateY(6px); }
    .chest.forced .chest-lock { transform: translateX(-30%) rotate(-18deg); top: 12px; }
    /* El libro mayor: pergamino desplegable que sale de DEBAJO del cofre. */
    .ledgerscroll {
      position: relative; z-index: 0;
      margin: -10px 6px 0; padding: 0 0.85rem 0.85rem;
      border: 1px solid var(--parch-edge, #b98f56);
      border-radius: 4px 4px 16px 12px / 4px 4px 12px 16px;
      background: linear-gradient(180deg, #f7ecd0 0%, #efdfba 100%);
      box-shadow: inset 0 0 16px rgba(92, 58, 20, 0.22), 0 4px 10px rgba(17, 24, 39, 0.18);
    }
    .ledgerscroll > summary {
      cursor: pointer; list-style: none;
      padding: 0.85rem 0.15rem 0.5rem;
      font-family: var(--parch-title, Georgia, serif);
      font-weight: 700; letter-spacing: 0.03em;
      color: var(--parch-ink, #33240f);
    }
    .ledgerscroll > summary::-webkit-details-marker { display: none; }
    .ledgerscroll > summary::before { content: '▸ '; color: var(--parch-muted, #6b5433); }
    .ledgerscroll[open] > summary::before { content: '▾ '; }
    .ledgerscroll > summary:focus-visible { outline: 2px solid var(--rm-navy, #1e3a5f); outline-offset: 2px; }
    .vsummary { margin: 0.4rem 0; font-size: 0.9rem; font-weight: 700; }
    .vsummary.good { color: var(--rm-accent, #2a9d8f); }
    .vsummary.warn { color: #8a5a00; }
    .vsummary.alert { color: var(--rm-danger, #dc2626); }
    .vchecks { list-style: none; margin: 0.3rem 0 0; padding: 0; font-size: 0.83rem; }
    .vcheck { display: flex; gap: 0.45rem; align-items: baseline; padding: 0.18rem 0; }
    .vcheck .vicon { font-weight: 800; }
    .vcheck.pass .vicon { color: var(--rm-accent, #2a9d8f); }
    .vcheck.fail { color: var(--rm-danger, #dc2626); }
    .vcheck.fail .vicon { color: var(--rm-danger, #dc2626); }
    .vcheck.skip { color: var(--rm-muted, #9ca3af); }
    .vwarnings { list-style: none; margin: 0.4rem 0 0; padding: 0; font-size: 0.78rem; color: #8a5a00; }
    .sub-coins { margin: 1rem 0 0.25rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rm-muted, #6b7280); font-weight: 700; }
    .coinslist { list-style: none; margin: 0; padding: 0; }
    .coinslist li {
      display: grid; grid-template-columns: 1fr auto auto; gap: 0.35rem 0.75rem;
      align-items: baseline; padding: 0.35rem 0;
      border-top: 1px solid var(--rm-border, #eef0f2); font-size: 0.85rem;
    }
    .coinslist .when { font-size: 0.72rem; color: var(--rm-muted, #6b7280); white-space: nowrap; }
    .coinslist .delta { font-weight: 800; color: var(--rm-accent, #2a9d8f); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .coinslist .unsigned {
      font-size: 0.62rem; font-weight: 800; padding: 0.08rem 0.4rem; border-radius: 999px;
      background: #fdebc8; color: #8a5a00; text-transform: uppercase; letter-spacing: 0.03em;
    }
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
    /* ═══ UI PERGAMINO (JG-7) — va al FINAL a propósito: mismas selecciones,
       última palabra en la cascada. Los overlays del juego pasan a papel
       envejecido re-declarando también los tokens --rm-* DENTRO de cada
       superficie: chips, inputs, bordes y botones interiores se re-tiñen
       solos (todos usan var(--rm-*) con fallback) sin tocar su CSS. La
       consola navy (JG-4) queda como chasis; el pergamino vive DENTRO. ═══ */
    .sea, .ficha, .retos, .ruta, .onboard, .matepop {
      /* Re-tinte de los tokens claros hacia el papel (hereda al subárbol,
         shadow DOM de <player-card> incluido). El panel de casa (.citypanel)
         tiene su propio pergamino «mapa del tesoro» (RMR-TSK-0256), aparte. */
      --rm-surface: #f9efd8;
      --rm-border: #cdb183;
      --rm-track: #e9d9af;
      --rm-muted: var(--parch-muted, #6b5433);
      --rm-text: var(--parch-ink, #33240f);
      color: var(--parch-ink, #33240f);
      background:
        radial-gradient(ellipse at 12% 8%, rgba(122, 90, 51, 0.14), transparent 42%),
        radial-gradient(ellipse at 88% 92%, rgba(122, 90, 51, 0.16), transparent 40%),
        radial-gradient(ellipse at 78% 18%, rgba(255, 250, 232, 0.5), transparent 46%),
        linear-gradient(160deg, var(--parch-bg, #f3e6c8) 0%, #efdfba 55%, var(--parch-bg-2, #ead6a8) 100%);
      border: 1px solid var(--parch-edge, #b98f56);
      /* Bordes irregulares del pliego: radios asimétricos + quemado interior. */
      border-radius: 16px 10px 18px 9px / 11px 17px 9px 15px;
      box-shadow:
        inset 0 0 22px var(--parch-burn, rgba(92, 58, 20, 0.35)),
        inset 0 0 3px rgba(70, 42, 12, 0.4),
        0 14px 40px rgba(17, 24, 39, 0.28);
    }
    /* Cabeceras como TABLÓN de madera claveteado (sustituyen el navy del
       marco dentro del pergamino); título en serif del sistema con
       small-caps — crema sobre madera oscura: AA holgado. */
    .sea-head {
      background:
        repeating-linear-gradient(90deg, rgba(0, 0, 0, 0) 0 46px, rgba(30, 16, 4, 0.22) 46px 48px),
        linear-gradient(180deg, var(--wood-1, #7a5a33) 0%, var(--wood-2, #55391c) 100%);
      border-bottom: 3px solid var(--wood-edge, #3a2712);
      border-radius: 12px 8px 3px 3px / 9px 12px 3px 3px;
      box-shadow: inset 0 1px 0 rgba(255, 240, 210, 0.22), inset 0 -3px 8px rgba(20, 10, 2, 0.35);
    }
    .sea-head h3 {
      font-family: var(--parch-title, Georgia, serif);
      font-variant: small-caps;
      letter-spacing: 0.06em;
      color: var(--wood-text, #f6e8c9);
      text-shadow: 0 1px 2px rgba(20, 10, 2, 0.65);
    }
    .sea-head .close { color: #e8d5ab; }
    .sea-head .close:hover { color: #fff; background: rgba(255, 240, 210, 0.16); }
    .sea-head .close:focus-visible { outline: 2px solid var(--wood-text, #f6e8c9); outline-offset: 2px; }
    /* Títulos interiores de las superficies pergamino: la misma serif. */
    .onboard h3, .cphead h4, .rol-name, .reto-info strong, .ruta-info strong, .wmeta strong {
      font-family: var(--parch-title, Georgia, serif);
      letter-spacing: 0.02em;
    }
    /* ── MAPA DEL TESORO (JG-7): el mar del archipiélago es una AGUADA sobre
       el papel (verdigris con vetas de oleaje) con viñeta sepia; las islas,
       manchas dibujadas con contorno de plumilla y nombre en tinta de mapa. ── */
    .sea-map {
      border: 2px solid var(--parch-edge, #b98f56);
      border-radius: 12px 7px 14px 8px / 8px 13px 7px 12px;
      background:
        radial-gradient(ellipse at 50% 50%, transparent 56%, rgba(92, 58, 20, 0.24) 100%),
        repeating-linear-gradient(178deg, rgba(46, 84, 96, 0.08) 0 3px, transparent 3px 14px),
        radial-gradient(circle at 24% 30%, rgba(255, 252, 240, 0.25), transparent 36%),
        linear-gradient(160deg, #b9d3c6 0%, #a8c8bf 45%, #93b7ad 100%);
      box-shadow: inset 0 0 26px rgba(70, 42, 12, 0.28);
    }
    /* Las manchas de isla (JG-12) ya llevan la plumilla dibujada en su SVG;
       sobre el pergamino solo se calienta la sombra al tono del papel. */
    .isle-dot svg { filter: drop-shadow(0 3px 5px rgba(40, 30, 10, 0.35)); }
    .isle:hover { background: rgba(255, 250, 232, 0.28); }
    .isle:focus-visible { outline: 2px solid var(--rm-navy, #1e3a5f); outline-offset: -2px; }
    .isle-name {
      font-family: var(--parch-title, Georgia, serif);
      font-style: italic;
      color: #33240f;
      text-shadow:
        0 0 3px rgba(246, 238, 214, 0.95),
        0 1px 2px rgba(246, 238, 214, 0.95);
    }
    /* Rosa de los vientos (SVG inline, decorativa) y ✗ ROJA del tesoro sobre
       la isla actual («estás aquí»: el mapa marca el sitio). */
    .compass {
      position: absolute;
      right: 3.5%;
      bottom: 5%;
      width: clamp(52px, 13cqi, 88px);
      height: auto;
      opacity: 0.82;
      pointer-events: none;
    }
    .isle-x {
      position: absolute;
      top: -0.4rem;
      left: 50%;
      transform: translateX(-50%) rotate(-8deg);
      font-size: 1.7rem;
      font-weight: 900;
      line-height: 1;
      color: #b3261e;
      text-shadow: 0 0 3px rgba(246, 238, 214, 0.9), 0 1px 2px rgba(40, 20, 5, 0.35);
      pointer-events: none;
    }
    /* Latón/madera SUTIL en la botonera de la consola (JG-7): solo un matiz
       en el borde — el chasis JG-4 no cambia de carácter. */
    .controls > button {
      border-color: color-mix(in srgb, #c9a24b 30%, var(--game-line, rgba(255, 255, 255, 0.14)));
    }
    /* ── PASAPORTE (JG-10): el tiempo de juego va como ANOTACIÓN DE BITÁCORA
       sobre el pasaporte — línea manuscrita con regla punteada, sin caja. ── */
    .ficha .playblock {
      background: transparent;
      border-radius: 0;
      padding: 0.2rem 0.2rem 0.5rem;
      border-bottom: 1px dashed var(--parch-edge, #b98f56);
      font-family: var(--parch-title, Georgia, serif);
      font-style: italic;
      color: var(--parch-muted, #6b5433);
    }
    .ficha .playblock strong { color: var(--parch-ink, #33240f); }
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
    this._cityTab = 'what'; // pestaña activa del panel de casa (RMR-TSK-0256)
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
    /** Bitácora del jugador (JG-23): histórico de certificados y rutas. null hasta cargar.
     * @type {{ entries: import('../../tools/career/domain/logbook.js').LogEntry[] }|null} */
    this.logbook = null;
    /** Overlay «📖 Bitácora» abierto (JG-23). */
    this.showLogbook = false;
    // Avales del manager (JG-6): sellos ✓ de la persona cargada. null hasta
    // que _load() los trae (gatea el botón «Avalar»: sin avales cargados no
    // se firma a ciegas).
    /** @type {import('../../tools/career/domain/endorsements.js').Endorsements|null} */
    this.endorsements = null;
    this.endorseBusy = false;
    // Sugerencia de evidencia (JG-6): id de la casa cuyo certificado se acaba
    // de obtener — su tarjeta abre las evidencias con un prompt amable y
    // descartable («Ahora no»). Nunca bloquea: el certificado ya vale.
    /** @type {string|null} */
    this.evidencePrompt = null;
    this.showPlayerCard = false;
    // El brujo (MC-22): rol del usuario (canEdit habilita la cola del manager),
    // login para la autoría, consultas de la persona cargada (TODAS las islas;
    // el panel del brujo filtra por la actual y la ficha las lista completas),
    // overlays y caché de consultas del equipo para el contador de pendientes.
    this.canEdit = false;
    // El ingeniero juega (JG-1): canPlay = jugar el plan de la persona cargada
    // (la suya) SIN gestión de equipo. Ver el bloque de gating del header.
    this.canPlay = false;
    /** @type {{ uid: string, name: string }|null} */
    this.currentUser = null;
    /** @type {import('../../tools/career/domain/wizard.js').WizardQuestion[]|null} */
    this.questions = null;
    this.showWizard = false;
    /** true con la lista «mis consultas» del panel del brujo desplegada (JG-8). */
    this.showWizardLog = false;
    /** Guion del <game-dialog> del brujo, construido al abrir el panel (JG-8).
     * @type {import('./dialogScript.js').DialogStep[]|null} */
    this.wizardScript = null;
    this.showWizardQueue = false;
    /** Nº de consultas PENDIENTES de todas las personas visibles (cola del manager). */
    this.wizardPending = 0;
    this.wizardBusy = false;
    this.wizardError = '';
    /** Consultas por persona (MC-22), cacheadas como los journeys del equipo.
     * @type {Map<string, import('../../tools/career/domain/wizard.js').WizardQuestion[]>} */
    this._teamQuestions = new Map();
    this._teamQuestionsLoaded = false;
    // Tiempo de juego (MC-23): registro de la persona cargada (para la ficha),
    // overlay del manager con sus filas cargadas en paralelo, y el cronómetro
    // vivo (solo canEdit; se rearma al cambiar de persona con volcado final).
    /** @type {import('../../tools/career/domain/playtime.js').Playtime|null} */
    this.playtime = null;
    this.showPlaytime = false;
    /** Filas del overlay «⏱ Tiempo» (null = cargando).
     * @type {{ personId: string, name: string, today: number, last7Days: number, total: number }[]|null} */
    this.playtimeRows = null;
    /** Handle del cronómetro (startPlaytimeTracker), o null sin persona/permiso. */
    this._playtimeTracker = null;
    /** Persona a la que mide el cronómetro vivo (o null). */
    this._playtimePerson = null;
    // Carpools (CP-1): tablón de grupos abiertos, los de la persona cargada,
    // el borrador del formulario de creación y las paradas a señalizar en la
    // isla actual. La IO vive en src/lib/carpools.js; `carpoolService` permite
    // inyectar un doble (arnés/tests) igual que se inyecta el store.
    /** @type {typeof carpoolsIo|null} */
    this.carpoolService = null;
    this.showCarpools = false;
    /** @type {'board'|'mine'|'create'} */
    this.carpoolTab = 'board';
    /** Tablón (carpools abiertos), o null mientras carga.
     * @type {import('../../tools/career/domain/carpool.js').Carpool[]|null} */
    this.carpools = null;
    /** Carpools de la persona cargada (cualquier estado), o null sin cargar.
     * @type {import('../../tools/career/domain/carpool.js').Carpool[]|null} */
    this.myCarpools = null;
    this.carpoolBusy = false;
    this.carpoolError = '';
    this.cpDraft = CareerApp.EMPTY_CP_DRAFT;
    /** Paradas del carpool activo en la ISLA ACTUAL (para <career-island-3d>).
     * @type {ReadonlyArray<string>} */
    this.carpoolStops = CareerApp.EMPTY_CARPOOL_STOPS;
    /** Mapas de isla cacheados para el constructor de rutas (CP-1).
     * @type {Map<string, import('../../tools/career/domain/types.js').CareerMap>} */
    this._islandMaps = new Map();
    /** Copia REACTIVA de la caché de mapas para el plano del archipiélago
     * (JG-11): cada mapa que llega renueva la identidad del Map y re-renderiza
     * <career-map> con datos parciales. @type {Map<string, import('../../tools/career/domain/types.js').CareerMap>} */
    this.planoMaps = new Map();
    /** La carga del plano (índice + 13 mapas) se lanza UNA vez por sesión. */
    this._planoStarted = false;
    /** Miembros de mis carpools cuyo journey NO se pudo leer (privacidad
     * entre managers): su avance se muestra como «sin datos». @type {Set<string>} */
    this._carpoolJourneysMissing = new Set();
    // Modo de juego (JG-5): el reto ACTIVO vive en el journey
    // (journey.challenge) — aquí solo el overlay del catálogo de retos, su
    // canal de error, el flag de trabajo y la confirmación in-place del
    // abandono. `_challenge3d` es el paquete ESTABLE de números para la isla
    // (se recalcula en willUpdate, no en cada render).
    this.showChallenges = false;
    /** Catálogo de rutas de ROL y NIVEL (/careerRoutes, JG-14), cargado una
     * vez por sesión al abrir el selector (es de la instancia, no de la
     * persona). @type {import('../../tools/career/domain/careerRoutes.js').CareerRoute[]|null} */
    this.careerRoutes = null;
    /** Niveles del career framework (para mapear careerTargetLevelId → hito
     * sugerido); se cargan con el catálogo de retos. @type {Array<{id: string, order: number}>|null} */
    this._frameworkLevels = null;
    this.challengeBusy = false;
    this.challengeError = '';
    this.challengeConfirmAbandon = false;
    /** @type {{ numbers: Map<string, number>, nextCityId: string|null }|null} */
    this._challenge3d = null;
    // Ruta LIBRE (JG-9): selector de posición de la tarjeta, gestor «🧭 Mi
    // ruta» y marca de la ruta en el mapa del mar. `_route3d` es el paquete
    // ESTABLE de números ámbar para la isla (memoizado en willUpdate, como
    // _challenge3d); con reto activo va null — los números del reto mandan.
    /** Selector inline «¿Dónde?» de la tarjeta: casa a insertar y paradas con
     * nombre, o null cerrado. @type {{ cityId: string, stops: { cityId: string, name: string }[] }|null} */
    this.routePicker = null;
    this.showRoute = false;
    /** Paradas de la ruta RESUELTAS (nombre, isla, estado) para el gestor, o
     * null mientras cargan. @type {{ n: number, cityId: string, cityName: string, islandName: string, visited: boolean }[]|null} */
    this.routeView = null;
    /** «Mi ruta» está mostrando la ruta de un RETO (solo lectura), no la libre. */
    this.routeIsChallenge = false;
    /** Panel de logro al COMPLETAR un reto (RMR-BUG-0017): resumen + siguiente
     * ruta si procede por nivel, o null si no hay panel abierto.
     * @type {{ name: string, stops: number, startedAt: string|null, durationMs: number|null,
     *          suggested: import('../../tools/career/domain/careerRoutes.js').CareerRoute|null }|null} */
    this.routeCompleted = null;
    this.routeBusy = false;
    this.routeError = '';
    /** Marca de la ruta libre en el MAPA DEL MAR: islas EN ORDEN y números de
     * parada por isla, o null sin ruta (o sin resolver).
     * @type {{ hops: string[], byIsland: Map<string, number[]> }|null} */
    this.routeSea = null;
    /** @type {Map<string, number>|null} */
    this._route3d = null;
    // Tribbu-coins (CP-2): saldo de la persona cargada, ledger cacheado,
    // resultado de la verificación y alerta roja del HUD (historia vista
    // traicionada / cadena rota / firma inválida).
    this.showCoins = false;
    /** Saldo materializado de la persona cargada (null mientras carga). @type {number|null} */
    this.coinsBalance = null;
    /** Ledger completo cacheado tras la verificación en segundo plano (o null).
     * @type {import('../../tools/career/domain/coins.js').CoinsEntry[]|null} */
    this.coinsLedger = null;
    /** Resultado de la última verificación completa (o null sin verificar).
     * @type {import('../../tools/career/domain/coins.js').LedgerVerification|null} */
    this.coinsVerify = null;
    /** true si la verificación detectó MANIPULACIÓN: la alerta roja del HUD. */
    this.coinsAlert = false;
    this.coinsBusy = false;
    this.coinsError = '';
    /** La verificación en segundo plano corre UNA vez por sesión. */
    this._coinsVerifyStarted = false;
    // Progresión (MC-20) y modo Reto (JG-5): aviso en pantalla (o null) y su
    // cola — los anuncios encadenados salen SECUENCIALES, nunca solapados.
    /** @typedef {import('../../tools/career/domain/citizenship.js').CitizenshipEvent
     *   | import('../../tools/career/domain/challenge.js').ChallengeEvent} GameAnnouncement */
    /** @type {GameAnnouncement|null} */
    this.announcement = null;
    /** @type {GameAnnouncement[]} */
    this._announceQueue = [];
    this._announceTimer = 0;
    // Barco animado (MC-19): viaje en curso sobre el mapa del mar, o null.
    // El rAF y sus relojes son privados: solo `voyage` re-renderiza.
    /** @type {{ toId: string, toName: string, path: import('../../tools/career/domain/voyage.js').VoyageCurve, duration: number }|null} */
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

  /** Lee la preferencia de modo de vista sin romper SSR/estático. Por defecto
   * 'list' (RMR-TSK-0205): quien no elige, entra a la lista, no al juego. Se
   * respeta lo que el usuario ya tuviera guardado ('flat'/'3d'); el valor legado
   * 'island' (2.5D, retirada en MC-8) cae al default. */
  _readViewMode() {
    if (typeof localStorage === 'undefined') return 'list';
    const stored = localStorage.getItem(CareerApp.VIEW_MODE_KEY);
    return stored === 'flat' || stored === '3d' || stored === 'list' ? stored : 'list';
  }

  /** @param {'list'|'flat'|'3d'} mode */
  _setViewMode(mode) {
    if (mode !== '3d') this.mode3d = 'aerial'; // el modo a pie no sobrevive al cambio de vista
    this.viewMode = mode;
    if (typeof localStorage !== 'undefined') localStorage.setItem(CareerApp.VIEW_MODE_KEY, mode);
  }

  /** @param {Map<string, unknown>} changed */
  willUpdate(changed) {
    // Números de la ruta de reto para la isla 3D (JG-5): identidad ESTABLE —
    // solo se recalculan cuando cambian el journey o la isla (una referencia
    // nueva en cada render obligaría a la isla a rehacer sus casas sin motivo).
    if (changed.has('journey') || changed.has('currentIsland')) {
      this._challenge3d = this._computeChallenge3d();
      this._route3d = this._computeRoute3d();
    }
  }

  /** @param {Map<string, unknown>} changed */
  updated(changed) {
    if (changed.has('personId')) {
      this.selected = null;
      this.teammatePopover = null; // el resumen abierto era de otro contexto
      this._clearAnnouncements(); // los avisos encolados también (MC-20)
      this.showPlayerCard = false; // la ficha abierta era de otra persona (MC-21)
      this.achievements = null;
      this.logbook = null; // la bitácora mostrada era de otra persona (JG-23)
      this.showLogbook = false;
      this.endorsements = null; // los avales mostrados eran de otra persona (JG-6)
      this.evidencePrompt = null; // la sugerencia de evidencia también
      this.showWizard = false; // el panel del brujo abierto era de otra persona (MC-22)
      this.questions = null;
      this.wizardError = '';
      this.playtime = null; // el tiempo mostrado era de otra persona (MC-23)
      // Los carpools mostrados eran de otra persona (CP-1); _load() recarga.
      this.showCarpools = false;
      this.carpoolTab = 'board';
      this.myCarpools = null;
      this.carpoolError = '';
      this.cpDraft = CareerApp.EMPTY_CP_DRAFT;
      // El saldo y el overlay de coins eran de otra persona (CP-2); _load()
      // recarga el saldo. El ledger y su verificación son GLOBALES: se quedan.
      this.showCoins = false;
      this.coinsBalance = null;
      this.coinsError = '';
      // El catálogo de retos abierto era de otra persona (JG-5); el reto
      // activo llega con su journey en _load().
      this.showChallenges = false;
      this.challengeError = '';
      this.challengeConfirmAbandon = false;
      // El selector «¿Dónde?», el gestor de la ruta y la marca del mar eran
      // de otra persona (JG-9); su ruta llega con el journey en _load().
      this.routePicker = null;
      this.showRoute = false;
      this.routeView = null;
      this.routeError = '';
      this.routeSea = null;
    }
    // Nombre de la siguiente casa cuando la PARADA del reto es de OTRA isla
    // (JG-5/JG-14): su mapa se carga bajo demanda (cacheado por sesión,
    // _islandMaps). El índice del archipiélago también dispara (resolver
    // parada → isla lo necesita y puede llegar después del journey).
    if (changed.has('journey') || changed.has('archipelago')) this._ensureChallengeMapLoaded();
    // Vistas PLANO (JG-11) y LISTA (RMR-TSK-0205): ambas necesitan el índice del
    // archipiélago y los mapas de TODAS las islas (cacheados, en paralelo, una vez).
    if ((this.viewMode === 'flat' || this.viewMode === 'list') && this.store && !this._planoStarted) {
      this._planoStarted = true;
      this._ensurePlanoMaps();
    }
    // Paradas del carpool a señalizar (CP-1): dependen de mis carpools y de la
    // isla cargada. Se recalculan con guarda de igualdad (no re-dispara).
    if (changed.has('myCarpools') || changed.has('currentIsland')) {
      this._refreshCarpoolStops();
    }
    // Cronómetro de juego (MC-23): se (re)arma cuando hay store + persona +
    // permiso de escritura; al cambiar de persona el anterior vuelca su resto.
    this._syncPlaytimeTracker();
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
    // El panel del brujo y la cola del manager reciben el foco al abrirse (MC-22).
    if (changed.has('showWizard') && this.showWizard) {
      this.renderRoot.querySelector('.wizpanel')?.focus();
    }
    if (changed.has('showWizardQueue') && this.showWizardQueue) {
      this.renderRoot.querySelector('.wizqueue')?.focus();
    }
    // El resumen de tiempo del manager recibe el foco al abrirse (MC-23).
    if (changed.has('showPlaytime') && this.showPlaytime) {
      this.renderRoot.querySelector('.timesheet')?.focus();
    }
    // El overlay de carpools recibe el foco al abrirse (CP-1): Escape cierra.
    if (changed.has('showCarpools') && this.showCarpools) {
      this.renderRoot.querySelector('.cppanel')?.focus();
    }
    // El overlay de tribbu-coins recibe el foco al abrirse (CP-2): Escape cierra.
    if (changed.has('showCoins') && this.showCoins) {
      this.renderRoot.querySelector('.coinspanel')?.focus();
    }
    // El catálogo de retos recibe el foco al abrirse (JG-5): Escape cierra.
    if (changed.has('showChallenges') && this.showChallenges) {
      this.renderRoot.querySelector('.retos')?.focus();
    }
    // El gestor de la ruta libre recibe el foco al abrirse (JG-9): Escape cierra.
    if (changed.has('showRoute') && this.showRoute) {
      this.renderRoot.querySelector('.ruta')?.focus();
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
      // Journey, logros registrados (MC-21), avales del manager (JG-6),
      // consultas al brujo (MC-22) y tiempo de juego (MC-23) en paralelo:
      // viven juntos en el subárbol career de la persona.
      const [journey, achievements, endorsements, questions, playtime, logbook] = await Promise.all([
        getJourney(this.store, this.personId),
        getAchievements(this.store, this.personId),
        getEndorsements(this.store, this.personId),
        listQuestions(this.store, this.personId),
        getPlaytime(this.store, this.personId),
        getLogbook(this.store, this.personId),
      ]);
      this.journey = journey;
      this.achievements = achievements;
      this.endorsements = endorsements;
      this.questions = questions;
      this.playtime = playtime;
      this.logbook = logbook;
      await this._prunePlaytime();
      // El journey es GLOBAL (MC-14): si esta persona está en otra isla del
      // archipiélago, se carga el mapa de SU isla.
      const island = this.journey.currentIsland ?? DEFAULT_ISLAND_ID;
      if (island !== this.currentIsland) {
        this.currentIsland = island;
        await this._loadMap();
      }
      await this._migrateAchievements();
      // Carpools de la persona (CP-1): en paralelo y SIN bloquear la carga
      // (gestiona sus propios errores — el mapa no se cae por el tablón).
      this._loadMyCarpools();
      // Tribbu-coins (CP-2): saldo de la persona y, UNA vez por sesión, la
      // verificación del libro mayor en segundo plano. Ninguna bloquea la
      // carga ni la tumba (gestionan sus propios errores).
      this._loadCoinsBalance();
      this._startCoinsBackgroundVerification();
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
    // Solo quien JUEGA escribe el registro (JG-1): el viewer ni lo intenta
    // (antes degradaba con console.warn en cada carga).
    if (!this._canPlayJourney || !this.personId || !this.achievements) return;
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
    if (!this._canPlayJourney || !this.personId || !this.achievements || !this.archipelago) return;
    const progress = archipelagoProgress(this.journey, this.archipelago.islands);
    const patch = newAchievements(progress, this.achievements, new Date().toISOString());
    if (patch) {
      this.achievements = await recordAchievements(this.store, this.personId, this.achievements, patch);
    }
    await this._recordNewCertificates();
  }

  /**
   * Anota en la bitácora (JG-23) las casas recién certificadas que aún no
   * tienen apunte — solo-añadir, con el nombre de la casa y la fecha del
   * momento. El resolutor de nombre usa el mapa cargado; una casa de otra isla
   * cae a su id (honesto). Sin nada nuevo no escribe.
   */
  async _recordNewCertificates() {
    if (!this._canPlayJourney || !this.personId || !this.logbook) return;
    const cityName = (id) =>
      this._selectedMap?.cities?.find((c) => c.id === id)?.name ??
      this.map?.cities?.find((c) => c.id === id)?.name ??
      id;
    const additions = newCertificateEntries(
      this.journey.visitedCities ?? [],
      this.logbook,
      cityName,
      new Date().toISOString(),
    );
    this.logbook = await recordLogbook(this.store, this.personId, this.logbook, additions);
  }

  /** Añade UN apunte a la bitácora (JG-23), p.ej. de evento de ruta. Sin
   * persona o bitácora, no hace nada. @param {import('../../tools/career/domain/logbook.js').LogEntry} entry */
  async _recordLogEntry(entry) {
    if (!this._canPlayJourney || !this.personId || !this.logbook) return;
    this.logbook = await recordLogbook(this.store, this.personId, this.logbook, [entry]);
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

  /**
   * Mapa que CONTIENE la casa seleccionada: el de la isla actual o, si la
   * selección viene del plano del archipiélago (JG-11) y es de OTRA isla, el
   * mapa cacheado que la tenga. Sin selección o sin mapa que la contenga, el
   * de la isla actual — el comportamiento de siempre. Con él, la tarjeta
   * (estado, prerequisitos, acciones) funciona para casas de cualquier isla.
   */
  get _selectedMap() {
    const id = this.selected;
    if (!id || !this.map || this.map.cities.some((c) => c.id === id)) return this.map;
    for (const islandMap of this._islandMaps.values()) {
      if (islandMap.cities.some((c) => c.id === id)) return islandMap;
    }
    return this.map;
  }

  _changePerson(event) {
    this.personId = event.target.value || null;
    this.error = '';
  }

  _onSelect(event) {
    this.selected = event.detail.cityId;
    this._cityTab = 'what'; // abrir siempre por «Qué es» (RMR-TSK-0256)
    this.teammatePopover = null; // la tarjeta de la casa releva al mini-resumen
    this.routePicker = null; // el selector «¿Dónde?» era de otra casa (JG-9)
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
    if (!this._canPlayJourney || !this.personId || !this.selected) return;
    const map = this._selectedMap;
    this.error = '';
    try {
      if (action === 'toggle') {
        const prev = this.journey;
        this.journey = await toggleVisited(this.store, this.personId, map, prev, this.selected);
        // Sugerencia de evidencia (JG-6): certificado recién OBTENIDO → la
        // tarjeta abre las evidencias con el prompt amable (descartable, sin
        // obligar: el certificado ya vale). Al retirarlo, el prompt se va.
        const obtained =
          !(prev.visitedCities ?? []).includes(this.selected) &&
          this.journey.visitedCities.includes(this.selected);
        this.evidencePrompt = obtained ? this.selected : null;
        // Progresión (MC-20): si este certificado cruza el % objetivo de la
        // isla, celebración MAYOR y avisos encadenados (isla → badges).
        await this._queueCitizenshipCelebrations(prev, this.journey, this.selected);
        // Y el logro queda REGISTRADO con su fecha en la ficha (MC-21).
        await this._recordNewAchievements();
        // Modo Reto (JG-5): si el certificado es una parada del reto, aviso de
        // la SIGUIENTE casa (o reto completado, con su celebración).
        await this._handleChallengeAfterToggle(prev, this.journey);
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
      event.kind === 'island' || event.kind === 'challenge-done'
        ? CareerApp.ANNOUNCE_ISLAND_MS
        : event.kind === 'challenge-next'
          ? CareerApp.ANNOUNCE_CHALLENGE_MS
          : CareerApp.ANNOUNCE_BADGE_MS;
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
    if (!this._canPlayJourney) return;
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
   * A pie NO se re-captura el ratón (JG-3): el modo libre no tiene nada que
   * re-enganchar y desde el inmersivo se vuelve al libre — «🎮 Inmersivo» es
   * siempre una decisión explícita del jugador.
   */
  _closeCityPanel() {
    this.selected = null;
    this.updateComplete.then(() => this.renderRoot.querySelector('.hud button')?.focus());
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
   * Botón HUD «🎮 Inmersivo» (JG-3, OPT-IN): captura el ratón (pointer lock)
   * para el mouse-look continuo. El clic del botón es el gesto real que exige
   * el navegador; Escape lo suelta y devuelve al modo libre.
   */
  _enterImmersive() {
    this.renderRoot.querySelector('career-island-3d')?.enterImmersive();
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
   * no lo tienen se atenúan como «En construcción». La ruta LIBRE (JG-9) se
   * resuelve aquí a su modelo del mar (islas en orden + paradas por isla):
   * mientras el mapa está abierto la ruta no puede cambiar (la tarjeta y el
   * gestor viven en otros overlays), así que calcularla al abrir basta.
   */
  async _openArchipelago() {
    if (!this.personId || this.traveling) return;
    this.error = '';
    try {
      this.archipelago ??= await getArchipelago();
      this.existingIslands ??= await getExistingIslandIds();
      const { stops } = await this._resolveRoute();
      this.routeSea = stops.length > 0 ? routeSeaModel(stops) : null;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo cargar el archipiélago.';
      return;
    }
    this.showArchipelago = true;
  }

  /** Cierra el mapa del archipiélago sin viajar y devuelve el foco al HUD.
   * Con el barco navegando (MC-19) ni ✕ ni el fondo cierran: un viaje a la
   * vez y ya está zarpado — Escape salta la animación, no la cancela. */
  _closeArchipelago() {
    if (this.voyage) return;
    this.showArchipelago = false;
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

  // ---- Modo de juego: Libre / Reto (JG-5) ---------------------------------------

  /** Reto ACTIVO del journey cargado (o null: modo Libre). El modo de juego es
   * DERIVADO: no hay un flag aparte que pueda desincronizarse.
   * @returns {import('../../tools/career/domain/types.js').Challenge|null} */
  get _challenge() {
    return this.journey?.challenge ?? null;
  }

  /**
   * Paquete de números de la ruta para <career-island-3d> (JG-5/JG-14):
   * número de parada GLOBAL por casa y la SIGUIENTE del camino. Las rutas son
   * multi-isla: la isla solo pinta las casas suyas (como los números ámbar de
   * la ruta libre, JG-9) — los ids de otras islas no le casan y no molestan.
   * Congelado y con identidad estable (lo memoiza willUpdate).
   * @returns {{ numbers: Map<string, number>, nextCityId: string|null }|null}
   */
  _computeChallenge3d() {
    const challenge = this._challenge;
    if (!challenge) return null;
    return Object.freeze({
      numbers: stopNumberByCity(challenge),
      nextCityId: challengeProgress(challenge, this.journey).nextCityId,
    });
  }

  /** Isla de una parada del reto (los ids van prefijados por disciplina), o
   * null si no casa con el índice. @param {string|null} cityId */
  _challengeStopIsland(cityId) {
    return islandOfStop(cityId, this.archipelago?.islands ?? []);
  }

  /**
   * Casa a la que apunta la brújula de a pie (JG-21): la SIGUIENTE parada del
   * reto activo o, sin reto, la primera de la ruta libre aún sin certificar.
   * El componente 3D solo la usa si está en la isla actual (las de otra isla
   * no le casan y no molestan). @returns {string|null} */
  get _guideCityId() {
    if (this._challenge) return challengeProgress(this._challenge, this.journey).nextCityId;
    const visited = new Set(this.journey?.visitedCities ?? []);
    return (this.journey?.plannedRoute ?? []).find((id) => !visited.has(id)) ?? null;
  }

  /** Isla de la SIGUIENTE parada del reto activo (adonde apunta el mapa del
   * mar), o null sin reto o completado. @returns {string|null} */
  _challengeTargetIsland() {
    const challenge = this._challenge;
    if (!challenge) return null;
    const { nextCityId } = challengeProgress(challenge, this.journey);
    return nextCityId ? this._challengeStopIsland(nextCityId) : null;
  }

  /**
   * Con la SIGUIENTE parada del reto en OTRA isla, su mapa se carga bajo
   * demanda (cacheado por sesión) para poder nombrar la casa en el chip y los
   * avisos. Mientras llega (o si falla) el chip degrada a «casa N» —
   * degradación documentada, no un fallback silencioso de datos críticos.
   */
  _ensureChallengeMapLoaded() {
    const islandId = this._challengeTargetIsland();
    if (!islandId || islandId === this.currentIsland) return;
    if (this._islandMaps.has(islandId)) return;
    this._ensureIslandMap(islandId)
      .then(() => this.requestUpdate())
      .catch((err) =>
        console.warn('Modo reto: no se pudo cargar el mapa de la isla del reto.', err),
      );
  }

  /** Nombre de una casa del RETO buscando en el mapa actual y en los cacheados
   * (la ruta es multi-isla), o null si aún no se conoce.
   * @param {string} cityId @returns {string|null} */
  _challengeCityName(cityId) {
    for (const map of [this.map, ...this._islandMaps.values()]) {
      const name = map?.cities.find((c) => c.id === cityId)?.name;
      if (name) return name;
    }
    return null;
  }

  /** Coletilla « (Isla X)» para la siguiente parada del reto cuando NO está en
   * la isla actual (o '' si es de aquí / no se conoce). @param {string|null} cityId */
  _challengeIslandSuffix(cityId) {
    const islandId = this._challengeStopIsland(cityId);
    if (!islandId || islandId === this.currentIsland) return '';
    const name = this._islandName(islandId);
    return name ? ` (${name})` : '';
  }

  /** Abre el catálogo de retos (botón «🎯 Modo» de la barra). Asegura el
   * índice del archipiélago (nombres de isla, sugerencia) y el catálogo de
   * rutas de ROL y NIVEL de /careerRoutes (JG-14), cacheado por sesión. */
  async _openChallenges() {
    if (!this.personId) return;
    this.challengeError = '';
    this.challengeConfirmAbandon = false;
    try {
      this.archipelago ??= await getArchipelago();
      this.careerRoutes ??= await listCareerRoutes();
      // Niveles del career framework: careerTargetLevelId apunta a ELLOS y la
      // sugerencia se mapea por su posición relativa. Si falla, sin insignia.
      this._frameworkLevels ??= await getFramework()
        .then((fw) => fw?.levels ?? [])
        .catch(() => []);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo cargar el catálogo de retos.';
      return;
    }
    this.showChallenges = true;
  }

  /** Cierra el catálogo de retos y devuelve el foco al HUD. */
  _closeChallenges() {
    this.showChallenges = false;
    this.challengeConfirmAbandon = false;
    this.updateComplete.then(() => this.renderRoot.querySelector('.hud button')?.focus());
  }

  /** Escape dentro del catálogo de retos lo cierra. @param {KeyboardEvent} event */
  _onChallengesKeydown(event) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    this._closeChallenges();
  }

  /**
   * Elige una ruta del catálogo (JG-14): persiste el itinerario del rol+hito
   * como reto activo del journey — mismo modelo {routeId, name, stops} de
   * siempre, con paradas multi-isla — y, si la primera parada PENDIENTE está
   * en otra isla, zarpa hacia ella (el fundido de travesía de siempre; el
   * progreso ya certificado se conserva: las paradas visitadas cuentan).
   * Solo quien JUEGA (JG-1).
   * @param {import('../../tools/career/domain/careerRoutes.js').CareerRoute} route
   */
  async _chooseChallenge(route) {
    if (!this._canPlayJourney || !this.personId || this.challengeBusy || this.traveling) return;
    this.challengeBusy = true;
    this.challengeError = '';
    try {
      this.journey = await startChallenge(this.store, this.personId, this.journey, {
        routeId: route.routeId,
        name: route.name,
        stops: [...route.stops],
        startedAt: null,
      });
      await this._recordLogEntry({
        kind: 'route-start',
        ref: route.routeId,
        label: route.name,
        at: new Date().toISOString(),
      });
      this.showChallenges = false;
      const islandId = this._challengeTargetIsland();
      if (islandId && islandId !== this.currentIsland) await this._departTo(islandId);
    } catch (err) {
      this.challengeError = err instanceof Error ? err.message : 'No se pudo empezar el reto.';
    } finally {
      this.challengeBusy = false;
    }
  }

  /**
   * Abandona el reto activo (vuelve al modo Libre). Llega SOLO desde la
   * confirmación in-place del catálogo: los certificados conseguidos se
   * quedan — abandonar el camino no borra lo andado.
   */
  async _abandonChallenge() {
    if (!this._canPlayJourney || !this.personId || this.challengeBusy) return;
    this.challengeBusy = true;
    this.challengeError = '';
    try {
      const abandoned = this._challenge;
      this.journey = await clearChallenge(this.store, this.personId, this.journey);
      if (abandoned) {
        await this._recordLogEntry({
          kind: 'route-abandon',
          ref: abandoned.routeId,
          label: abandoned.name,
          at: new Date().toISOString(),
        });
      }
      this.challengeConfirmAbandon = false;
    } catch (err) {
      this.challengeError = err instanceof Error ? err.message : 'No se pudo abandonar el reto.';
    } finally {
      this.challengeBusy = false;
    }
  }

  /**
   * Tras obtener un certificado (el MISMO gesto que MC-20/MC-21): si es una
   * parada del reto activo, o bien se anuncia la SIGUIENTE casa (con
   * «Llévame») o bien el reto queda COMPLETADO — celebración mayor tipo isla
   * (salvo que la ciudadanía ya la lanzara con este mismo gesto: no se
   * duplica) y el journey vuelve al modo Libre (decisión documentada en
   * clearChallenge). El detector es puro (challengeEvents).
   * @param {import('../../tools/career/domain/types.js').Journey} prev
   * @param {import('../../tools/career/domain/types.js').Journey} next
   */
  async _handleChallengeAfterToggle(prev, next) {
    const event = challengeEvents(prev, next).at(0);
    if (!event) return;
    if (event.kind === 'challenge-done') {
      const done = next.challenge; // capturar el reto ANTES de limpiarlo
      const citizenship = citizenshipCelebrations(prev, next, this.archipelago?.islands ?? []);
      if (!citizenship.some((e) => e.kind === 'island') && this.viewMode === '3d' && this.selected) {
        await this.updateComplete;
        const island = this.renderRoot.querySelector('career-island-3d');
        if (island) {
          await island.updateComplete;
          island.celebrateCitizenship(this.selected);
        }
      }
      // El HITO queda en la bitácora (persistente) ANTES de limpiar el reto: así
      // el logro no se pierde aunque el journey vuelva al modo Libre (RMR-BUG-0017).
      if (done) {
        await this._recordLogEntry({
          kind: 'route-complete',
          ref: done.routeId,
          label: done.name,
          at: new Date().toISOString(),
        });
      }
      this.journey = await clearChallenge(this.store, this.personId, next);
      if (done) await this._openRouteComplete(done);
    }
    this._announceQueue.push(event);
    if (!this.announcement) this._nextAnnouncement();
  }

  /**
   * Abre el panel de logro «🏆 ¡Ruta completada!» (RMR-BUG-0017): resumen
   * (nombre, nº de casas, tiempo desde el route-start de la bitácora) y, SOLO si
   * procede por nivel (_suggestedRouteId da una ruta válida distinta de la
   * terminada), la propuesta de la SIGUIENTE ruta. Asegura el catálogo y los
   * niveles del framework para poder sugerir; si fallan, el panel va sin sugerencia.
   * @param {import('../../tools/career/domain/types.js').Challenge} challenge Reto recién completado.
   */
  async _openRouteComplete(challenge) {
    try {
      this.careerRoutes ??= await listCareerRoutes();
      this._frameworkLevels ??= await getFramework()
        .then((fw) => fw?.levels ?? [])
        .catch(() => []);
    } catch {
      /* sin catálogo el panel va sin sugerencia (no bloquea la celebración) */
    }
    const groups = groupRoutesByRole(this.careerRoutes ?? []);
    const suggestedId = this._suggestedRouteId(groups);
    const suggested =
      suggestedId && suggestedId !== challenge.routeId
        ? (this.careerRoutes ?? []).find((r) => r.routeId === suggestedId) ?? null
        : null;
    const record = completedRoutes(this.logbook ?? EMPTY_LOGBOOK).find(
      (r) => r.routeId === challenge.routeId,
    );
    this.routeCompleted = {
      name: challenge.name,
      stops: challenge.stops.length,
      startedAt: record?.startedAt ?? null,
      durationMs: record?.durationMs ?? null,
      suggested,
    };
  }

  /** Cierra el panel de logro de ruta completada. */
  _closeRouteComplete() {
    this.routeCompleted = null;
  }

  /** Escape cierra el panel de logro. @param {KeyboardEvent} event */
  _onRouteCompleteKeydown(event) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    this._closeRouteComplete();
  }

  /** Cierra el panel y arranca la ruta sugerida (mismo flujo que el catálogo).
   * @param {import('../../tools/career/domain/careerRoutes.js').CareerRoute} route */
  async _chooseNextRoute(route) {
    this.routeCompleted = null;
    await this._chooseChallenge(route);
  }

  /**
   * Panel de logro «🏆 ¡Ruta completada!» (RMR-BUG-0017): modal con el resumen
   * de la ruta terminada (casas, tiempo) y, si procede por nivel, la propuesta
   * de la SIGUIENTE ruta. Fondo, ✕ o Escape lo cierran.
   */
  _renderRouteComplete() {
    const rc = this.routeCompleted;
    if (!rc) return null;
    const casas = `${rc.stops} casa${rc.stops === 1 ? '' : 's'}`;
    const tiempo = rc.durationMs === null ? '' : ` · ${formatDuration(rc.durationMs)}`;
    return html`<div class="sea-backdrop" @click=${(e) => { if (e.target === e.currentTarget) this._closeRouteComplete(); }}>
      <section
        class="route-done"
        role="dialog"
        aria-modal="true"
        aria-label="Ruta completada"
        tabindex="-1"
        @keydown=${this._onRouteCompleteKeydown}
      >
        <button class="close" aria-label="Cerrar" title="Cerrar (Esc)" @click=${this._closeRouteComplete}>✕</button>
        <div class="route-done-badge" aria-hidden="true">🏆</div>
        <h3>¡Ruta completada!</h3>
        <p class="route-done-name">${rc.name}</p>
        <p class="route-done-meta">${casas}${tiempo}</p>
        ${rc.suggested
          ? html`<div class="route-done-next">
              <p class="route-done-next-lead">Siguiente por tu nivel:</p>
              <button class="primary" @click=${() => this._chooseNextRoute(rc.suggested)}>
                ▶ Elegir siguiente ruta: ${rc.suggested.name}
              </button>
            </div>`
          : null}
        <button class="route-done-ok" @click=${this._closeRouteComplete}>Cerrar</button>
      </section>
    </div>`;
  }

  /** Clic en el chip del reto: foco a la SIGUIENTE casa del camino. */
  _focusChallengeNext() {
    const challenge = this._challenge;
    if (!challenge) return;
    const { nextCityId } = challengeProgress(challenge, this.journey);
    if (!nextCityId) return;
    this._goToChallengeStop(nextCityId);
  }

  /**
   * Lleva al jugador a una parada del reto: en la isla actual, foco de cámara
   * y tarjeta de la casa (el mismo gesto que los prerequisitos, JG-2); si la
   * parada está en OTRA isla (su id lleva la disciplina delante, JG-14), abre
   * el mapa del mar apuntando a ella (la isla va señalada con «🎯 Tu reto»).
   * @param {string} cityId
   */
  _goToChallengeStop(cityId) {
    if (this.announcement?.kind === 'challenge-next') this._nextAnnouncement();
    const islandId = this._challengeStopIsland(cityId);
    if (islandId && islandId !== this.currentIsland) {
      this._openArchipelago();
      return;
    }
    this._goToPrereq(cityId);
  }

  /** Botón «🎯 Modo» de la barra: muestra el modo derivado (Libre/Reto) y
   * abre el catálogo de retos. */
  _renderChallengeModeButton() {
    const active = Boolean(this._challenge);
    return html`<button
      @click=${this._openChallenges}
      aria-pressed=${active}
      title=${active
        ? 'Estás jugando un reto (ruta guiada con casas numeradas). Abre el selector para cambiarlo o volver a tu propia ruta'
        : 'Estás en tu propia ruta (modo libre). Abre el selector para elegir un reto: una ruta de rol y nivel guiada'}
    >🎯 ${active ? 'Cambiar reto' : 'Elegir reto'}</button>`;
  }

  /** Rótulo «{casa}» de la siguiente parada del reto, con su isla entre
   * paréntesis si NO es la actual (JG-14): «PHP 8.x moderno (Isla Backend
   * PHP)». Sin nombre conocido degrada a «casa N».
   * @param {import('../../tools/career/domain/challenge.js').ChallengeProgress} progress */
  _challengeNextLabel(progress) {
    if (!progress.nextCityId) return '';
    const name = this._challengeCityName(progress.nextCityId) ?? `casa ${progress.nextIndex + 1}`;
    return `${name}${this._challengeIslandSuffix(progress.nextCityId)}`;
  }

  /**
   * Chip HUD del reto activo (JG-5): «🎯 {nombre}: X/Y · siguiente: {casa}»
   * — con la ISLA de la siguiente casa si no es la actual (JG-14). Clic →
   * foco a la siguiente casa (o mapa del mar si es de otra isla).
   */
  _renderChallengeHudChip() {
    const challenge = this._challenge;
    if (!challenge) return null;
    const progress = challengeProgress(challenge, this.journey);
    const nextLabel = this._challengeNextLabel(progress);
    return html`<button
      class="hudstat challenge"
      @click=${this._focusChallengeNext}
      title="Ir a la siguiente casa del reto"
    >🎯 ${challenge.name}: ${progress.done}/${progress.total}${nextLabel
      ? ` · siguiente: ${nextLabel}`
      : ''}</button>`;
  }

  /**
   * Ruta SUGERIDA para el jugador (JG-14): su `careerTargetLevelId` (nivel L
   * del career framework, lo ÚNICO que declara el plan de carrera) se mapea a
   * un hito por su posición relativa en el marco (suggestedTierKey) y su
   * disciplina se INFIERE del juego (playerRouteDiscipline: reto activo →
   * isla actual → más certificados). Sin objetivo declarado o sin señal de
   * disciplina no se destaca nada.
   * @param {import('../../tools/career/domain/careerRoutes.js').RoleRouteGroup[]} groups
   * @returns {string|null} routeId de la sugerida, o null.
   */
  _suggestedRouteId(groups) {
    const target = (this.people ?? []).find((p) => p.id === this.personId)?.careerTargetLevelId;
    const tierKey = suggestedTierKey(target ?? null, this._frameworkLevels ?? []);
    if (!tierKey) return null;
    const disciplines = new Set(groups.map((g) => g.discipline));
    const discipline = playerRouteDiscipline(
      this.journey,
      this.archipelago?.islands ?? [],
      disciplines,
    );
    if (!discipline) return null;
    return groups.find((g) => g.discipline === discipline)?.tiers[tierKey]?.routeId ?? null;
  }

  /** Grupo de un ROL del catálogo: rótulo del rol y sus hitos disponibles.
   * @param {import('../../tools/career/domain/careerRoutes.js').RoleRouteGroup} group
   * @param {string|null} suggestedId */
  _renderRouteGroup(group, suggestedId) {
    return html`<li class="reto-rol">
      <h4 class="rol-name">${group.roleName}</h4>
      <ul class="reto-list">
        ${ROUTE_TIER_KEYS.filter((key) => group.tiers[key]).map((key) =>
          this._renderRouteTier(group.tiers[key], suggestedId),
        )}
      </ul>
    </li>`;
  }

  /** Una ruta (rol + hito) del catálogo: chip del hito con el color de la
   * escala, paradas/islas, la insignia «Sugerida para ti» y su acción.
   * @param {import('../../tools/career/domain/careerRoutes.js').CareerRoute} route
   * @param {string|null} suggestedId */
  _renderRouteTier(route, suggestedId) {
    const active = this._challenge?.routeId === route.routeId;
    const chipStyle = `--tier-color:${CareerApp.TIER_COLORS[route.levelKey] ?? 'var(--rm-muted, #6b7280)'}`;
    const islandsCount = new Set(route.stops.map((s) => s.split('/').at(0))).size;
    const rank = ROUTE_TIER_LABELS[route.levelKey] ?? route.levelKey;
    const range = tierLevelRangeLabel(route.levelKey, this._frameworkLevels ?? []);
    return html`<li class="reto ${active ? 'active' : ''}">
      <div class="reto-info">
        <strong>
          <span class="tier-chip" style=${chipStyle}>${rank}</span>
          ${range ? html`<span class="tier-range">${range}</span>` : null}
          ${route.name}
          ${suggestedId === route.routeId
            ? html`<span class="reto-sugerida">✨ Sugerida para ti</span>`
            : null}
        </strong>
        <span class="reto-meta">${route.stops.length} paradas · ${islandsCount} islas${route.description ? ` — ${route.description}` : ''}</span>
      </div>
      ${this._renderRouteTierAction(route, active)}
    </li>`;
  }

  /** Acción de una ruta del catálogo: «En curso» si es el reto activo,
   * Empezar/Cambiar si se puede jugar, nada en solo lectura.
   * @param {import('../../tools/career/domain/careerRoutes.js').CareerRoute} route
   * @param {boolean} active */
  _renderRouteTierAction(route, active) {
    if (active) return html`<span class="reto-tag">En curso</span>`;
    if (!this._canPlayJourney) return null;
    const hasChallenge = Boolean(this._challenge);
    const title = hasChallenge
      ? `Cambiar a «${route.name}» (sustituye al reto actual; lo certificado se queda)`
      : `Empezar «${route.name}»`;
    return html`<button
      class="primary"
      ?disabled=${this.challengeBusy}
      title=${title}
      @click=${() => this._chooseChallenge(route)}
    >${hasChallenge ? 'Cambiar' : 'Empezar'}</button>`;
  }

  /** Cabecera del reto ACTIVO del catálogo: progreso, siguiente parada (con
   * su isla si no es la actual) y «Abandonar reto» con confirmación in-place.
   * @param {import('../../tools/career/domain/types.js').Challenge} challenge
   * @param {import('../../tools/career/domain/challenge.js').ChallengeProgress} progress */
  /**
   * Opción «Mi propia ruta» del selector (JG-22): el modo LIBRE, primera de la
   * lista y marcada ✓ cuando no hay reto — el default explícito que pedía el
   * usuario. Con un reto activo, es el botón para volver a tu ruta (abandona
   * el reto; los certificados se quedan).
   * @param {boolean} challengeActive
   */
  _renderFreeRouteOption(challengeActive) {
    const selected = !challengeActive;
    return html`<button
      class="reto-libre ${selected ? 'sel' : ''}"
      ?disabled=${selected || this.challengeBusy || !this._canPlayJourney}
      aria-pressed=${selected}
      title=${selected
        ? 'Estás en tu propia ruta: eliges tú el camino, casa a casa'
        : 'Volver a tu propia ruta (abandona el reto; los certificados se quedan)'}
      @click=${this._chooseFreeRoute}
    >
      <span class="reto-libre-ico" aria-hidden="true">🧭</span>
      <span class="reto-libre-info">
        <strong>Mi propia ruta${selected ? ' ✓' : ''}</strong>
        <span class="reto-libre-meta">${selected ? 'Modo libre — eliges tú el camino' : 'Volver al modo libre'}</span>
      </span>
    </button>`;
  }

  /** Vuelve a la propia ruta desde el selector (JG-22): abandona el reto si lo
   * hay. Sin reto no hace nada (ya estás libre). */
  async _chooseFreeRoute() {
    if (!this._challenge) return;
    await this._abandonChallenge();
  }

  _renderActiveChallenge(challenge, progress) {
    const nextLabel = this._challengeNextLabel(progress);
    return html`<div class="reto-activo">
      <p class="reto-nombre">
        <strong>${challenge.name}</strong> · ${progress.done}/${progress.total} casas
        ${nextLabel ? html` · siguiente: <strong>${nextLabel}</strong>` : null}
      </p>
      ${this._renderAbandonControls()}
    </div>`;
  }

  /** Botón «Abandonar reto» y su confirmación in-place (solo quien juega). */
  _renderAbandonControls() {
    if (!this._canPlayJourney) return null;
    if (!this.challengeConfirmAbandon) {
      return html`<button
        class="reto-abandonar"
        ?disabled=${this.challengeBusy}
        @click=${() => { this.challengeConfirmAbandon = true; }}
      >Abandonar reto</button>`;
    }
    return html`<p class="reto-confirm">
      ¿Abandonar el reto? Los certificados conseguidos se quedan.
      <button
        class="danger"
        ?disabled=${this.challengeBusy}
        @click=${this._abandonChallenge}
      >Sí, abandonar</button>
      <button
        ?disabled=${this.challengeBusy}
        @click=${() => { this.challengeConfirmAbandon = false; }}
      >Seguir con el reto</button>
    </p>`;
  }

  /**
   * Overlay del CATÁLOGO DE RETOS (JG-14): itinerarios de ROL y NIVEL desde
   * /careerRoutes, agrupados por rol con sus rangos piratas (Grumete/Corsario/
   * Capitán, ROUTE_TIER_LABELS) y el tramo L del career path como subtítulo,
   * con la ruta sugerida destacada. Las rutas por isla de JG-5
   * desaparecen del selector. Con reto activo, cabecera con el progreso y
   * «Abandonar reto». Modal hermano del mapa del mar: ✕, fondo o Escape lo
   * cierran.
   */
  _renderChallenges() {
    if (!this.showChallenges) return null;
    const challenge = this._challenge;
    const progress = challenge ? challengeProgress(challenge, this.journey) : null;
    const groups = groupRoutesByRole(this.careerRoutes ?? []);
    const suggestedId = this._suggestedRouteId(groups);
    return html`<div class="sea-backdrop" @click=${(e) => { if (e.target === e.currentTarget) this._closeChallenges(); }}>
      <section
        class="retos"
        role="dialog"
        aria-modal="true"
        aria-label="Catálogo de retos"
        tabindex="-1"
        @keydown=${this._onChallengesKeydown}
      >
        <header class="sea-head">
          <h3>🎯 ${challenge ? 'Tu reto' : 'Elige tu reto'}</h3>
          <button class="close" aria-label="Cerrar el catálogo de retos" title="Cerrar (Esc)" @click=${this._closeChallenges}>✕</button>
        </header>
        ${this.challengeError ? html`<p class="error">${this.challengeError}</p>` : null}
        ${challenge && progress
          ? this._renderActiveChallenge(challenge, progress)
          : html`<p class="reto-lead">
              Cada ruta es el itinerario de un ROL a un rango de tu career
              path: multi-isla y entrando por Bases. Al lograr cada
              certificado el juego te señala la siguiente casa.
            </p>`}
        ${this._renderFreeRouteOption(Boolean(challenge))}
        ${groups.length === 0
          ? html`<p class="reto-lead">
              El catálogo de rutas aún no está publicado en esta instancia.
              Pídele al superadmin que lo siembre (o que active alguna ruta).
            </p>`
          : html`<ul class="reto-roles">
              ${groups.map((group) => this._renderRouteGroup(group, suggestedId))}
            </ul>`}
      </section>
    </div>`;
  }

  // ---- Ruta libre: posición elegida, gestor y marca en el mar (JG-9) -----------

  /**
   * Números ámbar de la ruta LIBRE para <career-island-3d> (JG-9): número de
   * parada GLOBAL por casa (la isla solo pinta las suyas). Congelado y con
   * identidad estable (lo memoiza willUpdate, como _challenge3d). DECISIÓN
   * JG-9: con un RETO activo devuelve null — dos numeraciones a la vez
   * saturan la isla y el camino guiado manda; la presencia de la ruta libre
   * (anillo navy y línea discontinua) sí se queda.
   * @returns {Map<string, number>|null}
   */
  _computeRoute3d() {
    if (this._challenge) return null;
    const planned = this.journey?.plannedRoute ?? [];
    return planned.length > 0 ? Object.freeze(routeNumberByCity(planned)) : null;
  }

  /**
   * Resuelve la ruta planificada a paradas con nombre e isla cargando los
   * mapas del archipiélago BAJO DEMANDA (solo hasta resolver todas las
   * ciudades, cacheados por sesión — el mismo patrón que _cpSharePlanned).
   * @returns {Promise<ReturnType<typeof resolveRouteStops>>}
   */
  async _resolveRoute() {
    return this._resolveStops(this.journey?.plannedRoute ?? []);
  }

  /**
   * Resuelve una lista de casas (ruta libre o paradas de reto) a paradas con
   * nombre e isla, cargando los mapas del archipiélago bajo demanda.
   * @param {ReadonlyArray<string>} cityIds
   * @returns {Promise<ReturnType<typeof resolveRouteStops>>}
   */
  async _resolveStops(cityIds) {
    if (cityIds.length === 0) return { stops: [], missing: [] };
    this.archipelago ??= await getArchipelago();
    const maps = [];
    const pending = new Set(cityIds);
    for (const isle of this.archipelago.islands) {
      if (pending.size === 0) break;
      const map = await this._ensureIslandMap(isle.id);
      maps.push(map);
      for (const city of map.cities) pending.delete(city.id);
    }
    return resolveRouteStops(cityIds, maps);
  }

  /**
   * Abre/cierra el selector «¿Dónde en tu ruta?» de la tarjeta (JG-9): solo
   * aparece al AÑADIR con la ruta no vacía — las paradas actuales se resuelven
   * a nombre para ofrecer «Antes de N. {casa}» además del «Al final» por
   * defecto. Volver a pulsar el botón lo pliega.
   * @param {string} cityId Casa que se quiere añadir.
   */
  async _toggleRoutePicker(cityId) {
    if (!this._canPlayJourney) return;
    if (this.routePicker?.cityId === cityId) {
      this.routePicker = null;
      return;
    }
    this.error = '';
    try {
      const { stops } = await this._resolveRoute();
      this.routePicker = {
        cityId,
        stops: stops.map((s) => ({ cityId: s.cityId, n: s.n, name: s.cityName })),
      };
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo leer tu ruta.';
    }
  }

  /**
   * Inserta la casa del selector en la posición elegida (JG-9) y lo cierra.
   * @param {number} [index] Posición 0-based; al final si se omite.
   */
  async _insertRouteAt(index) {
    if (!this._canPlayJourney || !this.routePicker) return;
    const { cityId } = this.routePicker;
    this.error = '';
    try {
      this.journey = await insertRouteStop(this.store, this.personId, this.journey, cityId, index);
      this.routePicker = null;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo actualizar la ruta.';
    }
  }

  /** Botón «🧭 Mi ruta» de la barra: abre el gestor de la ruta libre (JG-9). */
  _renderRouteButton() {
    // «Mi ruta» refleja la ruta ACTIVA (JG-22): las paradas del reto si lo hay,
    // o la ruta libre. El contador acompaña.
    const challenge = this._challenge;
    const count = challenge ? challenge.stops.length : (this.journey?.plannedRoute ?? []).length;
    return html`<button
      @click=${this._openRouteManager}
      title=${challenge
        ? 'Abrir la ruta del reto activo: sus paradas en orden'
        : 'Abrir tu ruta libre: paradas en orden, reordenar y quitar'}
    >🧭 Mi ruta${count > 0 ? ` (${count})` : ''}</button>`;
  }

  /** Abre el gestor «🧭 Mi ruta» y resuelve las paradas (nombre, isla, estado). */
  async _openRouteManager() {
    if (!this.personId) return;
    this.routeError = '';
    this.routeView = null;
    this.showRoute = true;
    await this._refreshRouteView();
    // Catálogo, archipiélago y niveles para la sugerencia de la SIGUIENTE ruta
    // en «Mis rutas» (F2). Best-effort: si falla, la sección va sin sugerencia.
    try {
      this.careerRoutes ??= await listCareerRoutes();
      this.archipelago ??= await getArchipelago();
      this._frameworkLevels ??= await getFramework()
        .then((fw) => fw?.levels ?? [])
        .catch(() => []);
    } catch {
      /* sin catálogo, «Mis rutas» solo muestra el historial */
    }
  }

  /** Cierra el gestor de la ruta y devuelve el foco al HUD. */
  _closeRouteManager() {
    this.showRoute = false;
    this.updateComplete.then(() => this.renderRoot.querySelector('.hud button')?.focus());
  }

  /** Escape dentro del gestor de la ruta lo cierra. @param {KeyboardEvent} event */
  _onRouteKeydown(event) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    this._closeRouteManager();
  }

  /**
   * (Re)construye la vista del gestor: paradas resueltas con su estado
   * (✓ certificada / pendiente). Las casas que no estén en ningún mapa se
   * cuentan en el canal de error del gestor — nunca se inventan.
   */
  async _refreshRouteView() {
    try {
      // «Mi ruta» muestra la ruta ACTIVA (JG-22): las paradas del reto si hay
      // uno (solo lectura), o la ruta libre editable si no.
      const challenge = this._challenge;
      this.routeIsChallenge = Boolean(challenge);
      const cityIds = challenge ? challenge.stops : (this.journey?.plannedRoute ?? []);
      const { stops, missing } = await this._resolveStops(cityIds);
      const visited = new Set(this.journey?.visitedCities ?? []);
      this.routeView = stops.map((s) => ({
        n: s.n,
        cityId: s.cityId,
        cityName: s.cityName,
        islandName: s.islandName,
        visited: visited.has(s.cityId),
      }));
      if (missing.length > 0) {
        this.routeError = `${missing.length} parada${missing.length === 1 ? '' : 's'} de tu ruta no está${missing.length === 1 ? '' : 'n'} en ningún mapa (contenido retirado).`;
      }
    } catch (err) {
      this.routeError = err instanceof Error ? err.message : 'No se pudo leer tu ruta.';
      this.routeView = [];
    }
  }

  /**
   * Sube/baja una parada del gestor (JG-9): recoloca la casa con
   * insertRouteStop (mover = quitar + insertar, sin duplicados) y refresca.
   * @param {string} cityId @param {-1|1} delta
   */
  async _moveRouteStop(cityId, delta) {
    if (!this._canPlayJourney || this.routeBusy) return;
    const planned = this.journey?.plannedRoute ?? [];
    const from = planned.indexOf(cityId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= planned.length) return;
    this.routeBusy = true;
    this.routeError = '';
    try {
      this.journey = await insertRouteStop(this.store, this.personId, this.journey, cityId, to);
      await this._refreshRouteView();
    } catch (err) {
      this.routeError = err instanceof Error ? err.message : 'No se pudo reordenar la ruta.';
    } finally {
      this.routeBusy = false;
    }
  }

  /** Quita una parada desde el gestor (toggleRoute de siempre) y refresca.
   * @param {string} cityId */
  async _removeRouteStop(cityId) {
    if (!this._canPlayJourney || this.routeBusy) return;
    this.routeBusy = true;
    this.routeError = '';
    try {
      this.journey = await toggleRoute(this.store, this.personId, this.journey, cityId);
      await this._refreshRouteView();
    } catch (err) {
      this.routeError = err instanceof Error ? err.message : 'No se pudo quitar la parada.';
    } finally {
      this.routeBusy = false;
    }
  }

  /**
   * Overlay del GESTOR «🧭 Mi ruta» (JG-9): la ruta libre completa en orden —
   * número global, casa, isla y estado (✓ certificada / pendiente) — con
   * subir/bajar y quitar para quien JUEGA (el viewer la ve de solo lectura).
   * Modal hermano del catálogo de retos: ✕, fondo o Escape lo cierran.
   */
  _renderRouteManager() {
    if (!this.showRoute) return null;
    const stops = this.routeView;
    const isChallenge = this.routeIsChallenge;
    const editable = !isChallenge && this._canPlayJourney;
    const title = isChallenge ? 'Ruta del reto' : 'Mi ruta';
    return html`<div class="sea-backdrop" @click=${(e) => { if (e.target === e.currentTarget) this._closeRouteManager(); }}>
      <section
        class="ruta"
        role="dialog"
        aria-modal="true"
        aria-label=${isChallenge ? 'Ruta del reto activo' : 'Mi ruta libre'}
        tabindex="-1"
        @keydown=${this._onRouteKeydown}
      >
        <header class="sea-head">
          <h3>🧭 ${title}</h3>
          <button class="close" aria-label="Cerrar mi ruta" title="Cerrar (Esc)" @click=${this._closeRouteManager}>✕</button>
        </header>
        ${isChallenge
          ? html`<p class="ruta-lead">Sigues el reto <strong>${this._challenge?.name ?? ''}</strong>: sus paradas en orden. Para editar tu propio camino, vuelve a «Mi propia ruta».</p>`
          : null}
        ${this.routeError ? html`<p class="error">${this.routeError}</p>` : null}
        ${this._renderRouteStops(stops, editable)}
        ${this._renderCompletedRoutes()}
      </section>
    </div>`;
  }

  /**
   * Cuerpo de «Mi ruta» (JG-9): cargando, la lista de paradas, o —si no hay—
   * el cuerpo de ruta vacía (_renderRouteEmpty). Early-returns para no anidar.
   * @param {{ n: number, cityId: string, cityName: string, islandName: string, visited: boolean }[]|null} stops
   * @param {boolean} editable
   */
  _renderRouteStops(stops, editable) {
    if (stops === null) return html`<p class="ruta-lead">Leyendo tu ruta…</p>`;
    if (stops.length === 0) return this._renderRouteEmpty();
    return html`<ol class="ruta-list">
      ${stops.map((stop, i) => html`<li class="ruta-stop ${stop.visited ? 'done' : ''}">
        <span class="ruta-n" aria-hidden="true">${stop.visited ? '✓' : stop.n}</span>
        <span class="ruta-info">
          <strong>${stop.cityName}</strong>
          <span class="ruta-meta">${stop.islandName} · ${stop.visited ? 'certificada ✓' : 'pendiente'}</span>
        </span>
        ${editable
          ? html`<span class="ruta-actions">
              <button
                ?disabled=${this.routeBusy || i === 0}
                aria-label=${`Subir ${stop.cityName} en la ruta`}
                title="Subir"
                @click=${() => this._moveRouteStop(stop.cityId, -1)}
              >↑</button>
              <button
                ?disabled=${this.routeBusy || i === stops.length - 1}
                aria-label=${`Bajar ${stop.cityName} en la ruta`}
                title="Bajar"
                @click=${() => this._moveRouteStop(stop.cityId, 1)}
              >↓</button>
              <button
                ?disabled=${this.routeBusy}
                aria-label=${`Quitar ${stop.cityName} de la ruta`}
                title="Quitar de la ruta"
                @click=${() => this._removeRouteStop(stop.cityId)}
              >Quitar</button>
            </span>`
          : null}
      </li>`)}
    </ol>`;
  }

  /**
   * «Mi ruta» sin paradas: invita a planificar o a elegir un reto. El historial
   * de rutas completadas ya no vive aquí, sino en la sección «Mis rutas» (F2).
   */
  _renderRouteEmpty() {
    return html`<p class="ruta-lead">
      Aún no tienes paradas planificadas. Abre la tarjeta de una casa y pulsa
      «Añadir a la ruta», o elige un reto guiado con «🎯».
    </p>`;
  }

  /** La CareerRoute SUGERIDA por rol×nivel (F2), o null si no procede o si ya
   * es el reto en curso. @returns {import('../../tools/career/domain/careerRoutes.js').CareerRoute|null} */
  _nextSuggestedRoute() {
    const id = this._suggestedRouteId(groupRoutesByRole(this.careerRoutes ?? []));
    if (!id || id === this._challenge?.routeId) return null;
    return (this.careerRoutes ?? []).find((r) => r.routeId === id) ?? null;
  }

  /** Ids de casas para «Mi ruta» en la vista LISTA (RMR-TSK-0205): la ruta
   * planificada si tiene paradas; si está vacía, la ruta sugerida por rol×nivel. */
  get _listRouteCityIds() {
    const planned = this.journey?.plannedRoute ?? [];
    if (planned.length > 0) return planned;
    return this._nextSuggestedRoute()?.stops ?? [];
  }

  /** Panel lateral de la vista LISTA: la ficha de la casa seleccionada, o la pista
   * inicial si aún no hay ninguna (evita el ternario anidado en el render). */
  _renderListPanel(sel, selAreaName) {
    if (sel) return this._renderPlanoPanel(sel, selAreaName);
    return html`<p class="hint">Pulsa un tema de la lista para ver su ficha: qué es, qué aprenderás y cómo certificarte.</p>`;
  }

  /** Meta de una ruta completada: «{fecha} · {duración}» (o solo fecha si no
   * hay duración). @param {import('../../tools/career/domain/logbook.js').CompletedRoute} r */
  _completedMeta(r) {
    const when = formatAchievedAt(r.completedAt) ?? 'fecha no registrada';
    const dur = r.durationMs === null ? '' : ` · ${formatDuration(r.durationMs)}`;
    return `${when}${dur}`;
  }

  /**
   * Sección «🏆 Mis rutas» (F2, RMR-TSK-0170): historial de TODAS las rutas
   * completadas (bitácora → completedRoutes: nombre, fecha, duración) y, si
   * procede por tu nivel, la SIGUIENTE ruta sugerida con botón para empezarla.
   * No aparece si no hay historial NI sugerencia (no ensucia «Mi ruta»).
   */
  _renderCompletedRoutes() {
    const done = completedRoutes(this.logbook ?? EMPTY_LOGBOOK);
    const suggested = this._nextSuggestedRoute();
    if (done.length === 0 && !suggested) return null;
    return html`<section class="mis-rutas">
      <h4>🏆 Mis rutas</h4>
      ${done.length === 0
        ? html`<p class="ruta-hint">Aún no has completado ninguna ruta entera.</p>`
        : html`<ul class="mis-rutas-list">
            ${done.map(
              (r) => html`<li class="mis-rutas-item">
                <span class="mr-name">${r.name}</span>
                <span class="mr-meta">${this._completedMeta(r)}</span>
              </li>`,
            )}
          </ul>`}
      ${suggested && this._canPlayJourney
        ? html`<div class="mis-rutas-next">
            <span class="mr-next-lead">Siguiente por tu nivel:</span>
            <button
              class="primary"
              ?disabled=${this.challengeBusy}
              @click=${() => this._chooseChallenge(suggested)}
            >▶ Empezar: ${suggested.name}</button>
          </div>`
        : null}
    </section>`;
  }

  /**
   * Trazo de la ruta libre sobre el MAPA DEL MAR (JG-9): polilínea punteada
   * ámbar uniendo las islas de la ruta EN ORDEN (estilo mapa de travesías).
   * Decorativa (aria-hidden): la información accesible va en las etiquetas
   * «🧭 Tu ruta» de cada isla. Con la ruta en una sola isla no hay tramos.
   * @param {ReadonlyArray<{ id: string, x: number, y: number }>} islands
   */
  _renderSeaRoute(islands) {
    const hops = this.routeSea?.hops ?? [];
    if (hops.length < 2) return null;
    const points = hops
      .map((id) => islands.find((i) => i.id === id))
      .filter((isle) => isle !== undefined)
      .map((isle) => `${isle.x},${isle.y}`);
    if (points.length < 2) return null;
    return html`<svg class="route-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polyline points=${points.join(' ')} />
    </svg>`;
  }

  /** Etiqueta «🧭 Tu ruta (paradas i–j)» de una isla del mar, o null si la
   * ruta no la toca. @param {string} islandId */
  _renderSeaRouteTag(islandId) {
    const numbers = this.routeSea?.byIsland.get(islandId);
    if (!numbers || numbers.length === 0) return null;
    return html`<span class="isle-tag route">
      🧭 Tu ruta (${numbers.length === 1 ? 'parada' : 'paradas'} ${formatStopRanges(numbers)})
    </span>`;
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

  /** Cierra la ficha y devuelve el foco al HUD. */
  _closePlayerCard() {
    this.showPlayerCard = false;
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

  /** Botón «📖 Bitácora» (JG-23): abre el histórico de la travesía del jugador. */
  _renderLogbookButton() {
    if (!this._canPlayJourney) return null;
    return html`<button
      @click=${this._openLogbook}
      title="Tu bitácora: el histórico de certificados y rutas de tu travesía"
    >📖 Bitácora</button>`;
  }

  /** Abre/cierra el overlay de la bitácora (JG-23). */
  _openLogbook() {
    this.showLogbook = true;
    this.updateComplete.then(() => this.renderRoot.querySelector('.logbook')?.focus());
  }

  _closeLogbook() {
    this.showLogbook = false;
    this.updateComplete.then(() => this.renderRoot.querySelector('.hud button')?.focus());
  }

  /** Escape dentro de la bitácora la cierra. @param {KeyboardEvent} event */
  _onLogbookKeydown(event) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    this._closeLogbook();
  }

  /** Icono y verbo del apunte según su tipo (JG-23). @param {string} kind */
  static LOG_META = Object.freeze({
    certificate: { icon: '📜', verb: 'Certificado' },
    'route-start': { icon: '🎯', verb: 'Empezaste el reto' },
    'route-abandon': { icon: '⚓', verb: 'Dejaste el reto' },
    'route-complete': { icon: '🏆', verb: 'Completaste el reto' },
  });

  /**
   * Overlay «📖 Bitácora» (JG-23): la línea temporal de la travesía, más
   * reciente primero — certificados obtenidos y retos empezados/dejados con su
   * fecha. Modal hermano de la ficha: ✕, fondo o Escape lo cierran.
   */
  _renderLogbook() {
    if (!this.showLogbook) return null;
    const entries = this.logbook ? logbookView(this.logbook) : [];
    return html`<div class="sea-backdrop" @click=${(e) => { if (e.target === e.currentTarget) this._closeLogbook(); }}>
      <section
        class="ficha logbook"
        role="dialog"
        aria-modal="true"
        aria-label="Bitácora de la travesía"
        tabindex="-1"
        @keydown=${this._onLogbookKeydown}
      >
        <header class="sea-head">
          <h3>📖 Bitácora</h3>
          <button class="close" aria-label="Cerrar la bitácora" title="Cerrar (Esc)" @click=${this._closeLogbook}>✕</button>
        </header>
        ${this._renderLogbookBody(entries)}
      </section>
    </div>`;
  }

  /** Cuerpo de la bitácora (JG-23): cargando, vacía, o la lista de apuntes. */
  _renderLogbookBody(entries) {
    if (this.logbook === null) {
      return html`<p class="lb-empty">Leyendo tu bitácora…</p>`;
    }
    if (entries.length === 0) {
      return html`<p class="lb-empty">Tu travesía acaba de empezar: aquí quedará constancia de cada certificado que logres y cada reto que emprendas.</p>`;
    }
    return html`<ol class="lb-list">
      ${entries.map((e) => {
        const meta = CareerApp.LOG_META[e.kind] ?? { icon: '•', verb: '' };
        const when = formatAchievedAt(e.at);
        return html`<li class="lb-item">
          <span class="lb-ico" aria-hidden="true">${meta.icon}</span>
          <span class="lb-body">
            <span class="lb-what"><strong>${meta.verb}</strong> ${e.label}</span>
            ${when ? html`<span class="lb-when">${when}</span>` : null}
          </span>
        </li>`;
      })}
    </ol>`;
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
    // Carpools del jugador con SU avance (CP-1): derivado de lo ya cargado
    // (sus carpools + su propio journey) — cero lecturas extra. null mientras
    // la lista no está: la ficha oculta la sección.
    const visited = new Set(this.journey?.visitedCities ?? []);
    const carpools =
      this.myCarpools === null
        ? null
        : this.myCarpools.map((cp) => {
            const total = cp.route.length;
            const completed = cp.route.filter((s) => visited.has(s.cityId)).length;
            return {
              id: cp.id,
              name: cp.name,
              status: cp.status,
              completed,
              total,
              pct: total > 0 ? Math.round((completed / total) * 100) : 0,
            };
          });
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
        ${this._renderPlaytimeBlock()}
        <player-card
          .playerName=${name}
          .progress=${prog}
          .achievements=${this.achievements}
          .endorsements=${this.endorsements}
          .visitedIslands=${this.journey?.visitedIslands ?? []}
          .questions=${this.questions ?? []}
          .carpools=${carpools}
          .coins=${this._coinsForCard()}
        ></player-card>
      </section>
    </div>`;
  }

  // ---- Tiempo de juego (MC-23) --------------------------------------------------

  /**
   * (Re)arma el cronómetro de juego según el contexto: mide SOLO con store,
   * persona seleccionada y permiso de JUGAR (canPlay || canEdit — desde JG-1
   * el ingeniero vinculado mide contra su propia persona; las reglas le abren
   * career/playtime de la suya). Al cambiar de persona, el cronómetro
   * anterior se para VOLCANDO su resto a la persona a la que midió (el
   * onFlush captura su personId). Idempotente: sin cambios de contexto no
   * toca nada.
   */
  _syncPlaytimeTracker() {
    const target = this.store && this._canPlayJourney && this.personId ? this.personId : null;
    if (target === this._playtimePerson) return;
    this._playtimeTracker?.stop(); // volcado final a la persona anterior
    this._playtimeTracker = null;
    this._playtimePerson = target;
    if (!target) return;
    const store = this.store;
    this._playtimeTracker = startPlaytimeTracker({
      onFlush: async (minutes) => {
        const { day } = await recordPlaytime(store, target, minutes);
        this._applyPlaytimeIncrement(target, day, minutes);
      },
    });
  }

  /**
   * Refleja en el estado local un incremento ya persistido: la ficha abierta
   * ve crecer el tiempo sin relecturas. Si la persona cargada ya es otra (el
   * volcado final de un cambio de persona), no hay nada que reflejar.
   * @param {string} personId @param {string} day @param {number} minutes
   */
  _applyPlaytimeIncrement(personId, day, minutes) {
    if (personId !== this.personId || !this.playtime) return;
    this.playtime = {
      totalMinutes: this.playtime.totalMinutes + minutes,
      byDay: { ...this.playtime.byDay, [day]: (this.playtime.byDay[day] ?? 0) + minutes },
    };
  }

  /**
   * Poda del histórico por día al cargar a la persona (MC-23): solo con
   * permiso de escritura, y solo si byDay superó el umbral (>35 claves →
   * quedan 30). Las claves crecen 1 por día: podar al cargar basta y evita
   * leer el doc en cada flush. El fallo no tumba la carga (console.warn):
   * lo podará la próxima sesión con permisos.
   */
  async _prunePlaytime() {
    if (!this._canPlayJourney || !this.personId || !this.playtime) return;
    try {
      this.playtime = await prunePlaytime(this.store, this.personId, this.playtime);
    } catch (err) {
      console.warn('Tiempo de juego: no se pudo podar el histórico por día.', err);
    }
  }

  /**
   * Bloque de tiempo de juego de la ficha 🏅 (MC-23): hoy / últimos 7 días /
   * total de la persona cargada, en minutos legibles. Desde JG-10 va como
   * anotación de bitácora sobre el pasaporte («Días de travesía»).
   */
  _renderPlaytimeBlock() {
    const s = playtimeSummary(this.playtime, new Date());
    const fmt = (m) => formatPlayMinutes(m) ?? '—';
    return html`<p
      class="playblock"
      title="Tiempo de juego activo en el mapa (pestaña visible y jugando)"
    >
      ⏱ Días de travesía — hoy <strong>${fmt(s.today)}</strong> · 7 días
      <strong>${fmt(s.last7Days)}</strong> · total <strong>${fmt(s.total)}</strong>
    </p>`;
  }

  /** Botón «⏱ Tiempo» de la barra: solo con canEdit (vista agregada del manager). */
  _renderPlaytimeButton() {
    if (!this.canEdit) return null;
    return html`<button
      @click=${this._openPlaytimeSummary}
      title="Ver el tiempo de juego de tu gente (hoy, últimos 7 días y total)"
    >⏱ Tiempo</button>`;
  }

  /**
   * Abre la vista agregada del manager (MC-23): carga EN PARALELO el playtime de
   * las personas visibles (misma política y cap que los journeys del equipo) y
   * lo resume por filas. Una persona ilegible no tumba al resto (console.warn
   * y fila a cero). Se recarga en cada apertura: el tiempo cambia jugando.
   */
  async _openPlaytimeSummary() {
    if (!this.canEdit) return;
    this.showPlaytime = true;
    this.playtimeRows = null; // «Cargando…»
    const people = this.people ?? [];
    const capped = people.slice(0, CareerApp.MAX_TEAM_JOURNEYS);
    if (people.length > capped.length) {
      console.warn(
        `Tiempo de juego: ${people.length} personas visibles; se carga solo el de las ${CareerApp.MAX_TEAM_JOURNEYS} primeras para acotar las lecturas.`,
      );
    }
    const now = new Date();
    const rows = await Promise.all(
      capped.map(async (person) => {
        try {
          const summary = playtimeSummary(await getPlaytime(this.store, person.id), now);
          return { personId: person.id, name: person.name, ...summary };
        } catch (err) {
          console.warn(`Tiempo de juego: no se pudo cargar el de "${person.id}".`, err);
          return { personId: person.id, name: person.name, today: 0, last7Days: 0, total: 0 };
        }
      }),
    );
    if (!this.showPlaytime) return; // se cerró mientras cargaba
    this.playtimeRows = rows;
  }

  /** Cierra el resumen de tiempo y devuelve el foco al HUD. */
  _closePlaytimeSummary() {
    this.showPlaytime = false;
    this.playtimeRows = null;
    this.updateComplete.then(() => this.renderRoot.querySelector('.hud button')?.focus());
  }

  /** Escape dentro del resumen de tiempo lo cierra. @param {KeyboardEvent} event */
  _onPlaytimeKeydown(event) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    this._closePlaytimeSummary();
  }

  /**
   * Overlay «⏱ Tiempo de juego» del manager (MC-23): tabla sencilla y legible —
   * persona, hoy, últimos 7 días y total — de las personas visibles. Modal
   * hermano de la ficha (mismo backdrop/section): foco al abrir, Escape/✕/
   * fondo cierran.
   */
  _renderPlaytimeSummary() {
    if (!this.showPlaytime) return null;
    const fmt = (m) => formatPlayMinutes(m) ?? '—';
    const cell = (m) =>
      m > 0 ? html`<td class="num">${fmt(m)}</td>` : html`<td class="num zero">0 min</td>`;
    return html`<div class="sea-backdrop" @click=${(e) => { if (e.target === e.currentTarget) this._closePlaytimeSummary(); }}>
      <section
        class="ficha timesheet"
        role="dialog"
        aria-modal="true"
        aria-label="Tiempo de juego del equipo"
        tabindex="-1"
        @keydown=${this._onPlaytimeKeydown}
      >
        <header class="sea-head">
          <h3>⏱ Tiempo de juego</h3>
          <button class="close" aria-label="Cerrar el resumen de tiempo de juego" title="Cerrar (Esc)" @click=${this._closePlaytimeSummary}>✕</button>
        </header>
        <p class="playlead">
          Tiempo de sesión activa en el mapa por persona (pestaña visible y
          jugando). Se guarda por día; el detalle diario cubre los últimos 30 días.
        </p>
        ${this.playtimeRows === null
          ? html`<p class="wizempty">Cargando el tiempo de juego…</p>`
          : this.playtimeRows.length === 0
            ? html`<p class="wizempty">No hay personas visibles en tu equipo.</p>`
            : html`<table>
                <thead>
                  <tr>
                    <th scope="col">Persona</th>
                    <th scope="col" class="num">Hoy</th>
                    <th scope="col" class="num">7 días</th>
                    <th scope="col" class="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.playtimeRows.map(
                    (row) => html`<tr>
                      <td class="who">${row.name}</td>
                      ${cell(row.today)}${cell(row.last7Days)}${cell(row.total)}
                    </tr>`,
                  )}
                </tbody>
              </table>`}
      </section>
    </div>`;
  }

  // ---- Carpools de formación (CP-1) --------------------------------------------

  /** IO de carpools: la real (src/lib/carpools.js) o el doble inyectado. */
  get _carpoolApi() {
    return this.carpoolService ?? carpoolsIo;
  }

  /** Mis carpools EN MARCHA (abiertos o llenos): los que se señalizan. */
  get _activeCarpools() {
    return (this.myCarpools ?? []).filter((c) => c.status === 'open' || c.status === 'full');
  }

  /**
   * Recalcula las paradas a señalizar en la ISLA ACTUAL (CP-1): la unión de
   * las paradas de mis carpools en marcha que caen en ella. Con guarda de
   * igualdad para no re-disparar renders (la isla 3D rehace su grupo de
   * ciudades cuando esta lista CAMBIA).
   */
  _refreshCarpoolStops() {
    const ids = [
      ...new Set(
        this._activeCarpools.flatMap((c) =>
          c.route.filter((s) => s.islandId === this.currentIsland).map((s) => s.cityId),
        ),
      ),
    ];
    const next = ids.length > 0 ? ids : CareerApp.EMPTY_CARPOOL_STOPS;
    if (next.join('|') !== (this.carpoolStops ?? []).join('|')) this.carpoolStops = next;
  }

  /**
   * Carga los carpools de la persona cargada (consulta array-contains sobre
   * memberIds). No tumba nada: un fallo deja la lista vacía y constancia por
   * consola (el mapa sigue jugable sin tablón).
   */
  async _loadMyCarpools() {
    const personId = this.personId;
    if (!personId) return;
    try {
      const list = await this._carpoolApi.listMyCarpools(personId);
      if (personId !== this.personId) return; // cambió la persona mientras cargaba
      this.myCarpools = list;
      this._ensureCarpoolJourneys();
    } catch (err) {
      console.warn(`Carpools: no se pudieron cargar los de "${personId}".`, err);
      if (personId === this.personId) this.myCarpools = [];
    }
  }

  /**
   * Asegura los journeys de los MIEMBROS de mis carpools para derivar su
   * avance (mismo patrón que MC-12: 1 lectura por persona, cap
   * MAX_TEAM_JOURNEYS, caché compartida en _teamJourneys). Un journey
   * ilegible (persona de otro manager: las reglas protegen su subárbol) no
   * tumba al resto — ese miembro queda como «sin datos».
   */
  async _ensureCarpoolJourneys() {
    const ids = new Set((this.myCarpools ?? []).flatMap((c) => c.memberIds));
    ids.delete(this.personId);
    const missing = [...ids]
      .filter((id) => !this._teamJourneys.has(id) && !this._carpoolJourneysMissing.has(id))
      .slice(0, CareerApp.MAX_TEAM_JOURNEYS);
    if (missing.length === 0 || !this.store) return;
    await Promise.all(
      missing.map(async (id) => {
        try {
          this._teamJourneys.set(id, await getJourney(this.store, id));
        } catch (err) {
          this._carpoolJourneysMissing.add(id);
          console.warn(`Carpools: no se pudo cargar el journey del miembro "${id}".`, err);
        }
      }),
    );
    // Re-render: la tabla de avance ya puede pintar los journeys recién cargados.
    if (this.myCarpools !== null) this.myCarpools = [...this.myCarpools];
  }

  /** Journeys por persona para el progreso: la caché del equipo + el propio. */
  _carpoolJourneyMap() {
    const journeys = new Map(this._teamJourneys);
    if (this.personId) journeys.set(this.personId, this.journey);
    return journeys;
  }

  /** Abre el overlay de carpools (botón «🚗 Carpools») y refresca el tablón. */
  async _openCarpools() {
    this.carpoolError = '';
    this.showCarpools = true;
    try {
      this.archipelago ??= await getArchipelago(); // islas del constructor de rutas
    } catch (err) {
      this.carpoolError =
        err instanceof Error ? err.message : 'No se pudo cargar el archipiélago.';
    }
    this._loadCarpoolBoard();
    if (this.personId && this.myCarpools === null) this._loadMyCarpools();
  }

  /** Refresca el TABLÓN (carpools abiertos). Se recarga en cada apertura. */
  async _loadCarpoolBoard() {
    this.carpools = null; // «Cargando…»
    try {
      const list = await this._carpoolApi.listOpenCarpools();
      if (!this.showCarpools) return; // se cerró mientras cargaba
      this.carpools = list;
    } catch (err) {
      this.carpools = [];
      this.carpoolError =
        err instanceof Error ? err.message : 'No se pudo cargar el tablón de carpools.';
    }
  }

  /** Cierra el overlay de carpools y devuelve el foco al HUD. */
  _closeCarpools() {
    this.showCarpools = false;
    this.updateComplete.then(() => this.renderRoot.querySelector('.hud button')?.focus());
  }

  /** Escape dentro del overlay de carpools lo cierra. @param {KeyboardEvent} event */
  _onCarpoolsKeydown(event) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    this._closeCarpools();
  }

  /** Pestañas visibles del overlay: «Crear» solo para quien JUEGA (JG-1). */
  get _carpoolTabs() {
    return this._canPlayJourney
      ? CareerApp.CARPOOL_TABS
      : CareerApp.CARPOOL_TABS.filter((t) => t !== 'create');
  }

  /** Activa una pestaña del overlay de carpools. @param {'board'|'mine'|'create'} tab */
  _setCarpoolTab(tab) {
    this.carpoolTab = tab;
    this.carpoolError = '';
  }

  /**
   * Teclado de la barra de pestañas de carpools (mismo patrón tablist que la
   * tarjeta de la casa): ←/→ circulan, Home/End a los extremos.
   * @param {KeyboardEvent} e
   */
  _onCarpoolTabsKeydown(e) {
    const tabs = this._carpoolTabs;
    const i = tabs.indexOf(this.carpoolTab);
    let next = i;
    if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    e.stopPropagation();
    const tab = tabs[next];
    this._setCarpoolTab(tab);
    this.updateComplete.then(() => {
      /** @type {HTMLElement|null} */ (this.renderRoot.querySelector(`#cptab-${tab}`))?.focus();
    });
  }

  /**
   * «Unirse» desde el tablón: la PERSONA SELECCIONADA entra de copiloto. La
   * validación fina (abierto, plaza, no repetido) es del dominio y de la lib;
   * aquí solo se refrescan tablón, «los míos» y la señalización.
   * @param {import('../../tools/career/domain/carpool.js').Carpool} carpool
   */
  async _joinCarpool(carpool) {
    if (!this._canPlayJourney || this.carpoolBusy) return;
    const person = this._selectedPerson;
    if (!person) {
      this.carpoolError = 'Elige una persona (selector de arriba) para unirla al carpool.';
      return;
    }
    this.carpoolBusy = true;
    this.carpoolError = '';
    try {
      const updated = await this._carpoolApi.joinCarpool(carpool, {
        personId: person.id,
        name: person.name,
      });
      // El tablón solo lista abiertos: si se llenó, sale; si no, se refresca.
      this.carpools = (this.carpools ?? [])
        .map((c) => (c.id === updated.id ? updated : c))
        .filter((c) => c.status === 'open');
      this.myCarpools = [updated, ...(this.myCarpools ?? []).filter((c) => c.id !== updated.id)];
      this._ensureCarpoolJourneys();
    } catch (err) {
      this.carpoolError = err instanceof Error ? err.message : 'No se pudo unir al carpool.';
    } finally {
      this.carpoolBusy = false;
    }
  }

  /**
   * «Salir» de un carpool (la persona cargada). El conductor no sale: cierra.
   * @param {import('../../tools/career/domain/carpool.js').Carpool} carpool
   */
  async _leaveCarpool(carpool) {
    if (!this._canPlayJourney || this.carpoolBusy || !this.personId) return;
    this.carpoolBusy = true;
    this.carpoolError = '';
    try {
      const updated = await this._carpoolApi.leaveCarpool(carpool, this.personId);
      this.myCarpools = (this.myCarpools ?? []).filter((c) => c.id !== updated.id);
      this.carpools = (this.carpools ?? []).map((c) => (c.id === updated.id ? updated : c));
    } catch (err) {
      this.carpoolError = err instanceof Error ? err.message : 'No se pudo salir del carpool.';
    } finally {
      this.carpoolBusy = false;
    }
  }

  /**
   * «Cerrar» un carpool: solo su creador (createdBy.uid, lo mismo que exigen
   * las reglas) — lo retira del tablón y de la señalización del mapa.
   * @param {import('../../tools/career/domain/carpool.js').Carpool} carpool
   */
  async _closeCarpool(carpool) {
    if (this.carpoolBusy) return;
    this.carpoolBusy = true;
    this.carpoolError = '';
    try {
      const updated = await this._carpoolApi.closeCarpool(carpool);
      this.myCarpools = (this.myCarpools ?? []).map((c) => (c.id === updated.id ? updated : c));
      this.carpools = (this.carpools ?? []).filter((c) => c.id !== updated.id);
    } catch (err) {
      this.carpoolError = err instanceof Error ? err.message : 'No se pudo cerrar el carpool.';
    } finally {
      this.carpoolBusy = false;
    }
  }

  /**
   * Mapa de una isla para el constructor de rutas, cargado BAJO DEMANDA y
   * cacheado por sesión (la isla actual reutiliza el mapa ya cargado).
   * @param {string} islandId
   * @returns {Promise<import('../../tools/career/domain/types.js').CareerMap>}
   */
  async _ensureIslandMap(islandId) {
    const cached = this._islandMaps.get(islandId);
    if (cached) return cached;
    if (islandId === this.currentIsland && this.map) {
      this._islandMaps.set(islandId, this.map);
      return this.map;
    }
    const map = await getCareerMap(islandId, this._islandName(islandId));
    this._islandMaps.set(islandId, map);
    return map;
  }

  /**
   * Vista PLANO (JG-11): asegura el índice del archipiélago y lanza la carga
   * (cacheada, en paralelo) de los mapas de TODAS las islas. `planoMaps` es
   * la copia reactiva de la caché: cada mapa que llega re-renderiza el plano,
   * que pinta con datos parciales (isla sin mapa = contador «n temas»). Una
   * isla que falla queda como contador — degradación visible, con aviso en
   * consola; el resto del plano no se cae.
   */
  async _ensurePlanoMaps() {
    try {
      this.archipelago ??= await getArchipelago();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo cargar el archipiélago.';
      this._planoStarted = false; // reintentable en el siguiente render de la vista
      return;
    }
    this.planoMaps = new Map(this._islandMaps);
    await Promise.all(
      this.archipelago.islands.map(async (isle) => {
        try {
          await this._ensureIslandMap(isle.id);
          this.planoMaps = new Map(this._islandMaps);
        } catch (err) {
          console.warn(`Plano: no se pudo cargar el mapa de la isla "${isle.id}".`, err);
        }
      }),
    );
  }

  /** Cambio de isla en el constructor de rutas: carga su mapa para el selector
   * de ciudades. @param {Event} e */
  async _onCpIslandChange(e) {
    const islandId = /** @type {HTMLSelectElement} */ (e.target).value;
    this.cpDraft = { ...this.cpDraft, islandId, cityId: '' };
    if (!islandId) return;
    try {
      await this._ensureIslandMap(islandId);
      this.cpDraft = { ...this.cpDraft }; // re-render: ya hay ciudades que ofrecer
    } catch (err) {
      this.carpoolError =
        err instanceof Error ? err.message : 'No se pudo cargar el mapa de esa isla.';
    }
  }

  /** Añade la parada del constructor (isla + ciudad + fecha objetivo opcional). */
  _cpAddStop() {
    const { islandId, cityId, targetDate, stops } = this.cpDraft;
    if (!islandId || !cityId) {
      this.carpoolError = 'Elige isla y casa para añadir la parada.';
      return;
    }
    if (stops.some((s) => s.cityId === cityId)) {
      this.carpoolError = 'Esa casa ya está en la ruta.';
      return;
    }
    const map = this._islandMaps.get(islandId);
    const city = map?.cities.find((c) => c.id === cityId);
    if (!map || !city) {
      this.carpoolError = 'No se encontró la casa elegida en el mapa de la isla.';
      return;
    }
    this.carpoolError = '';
    this.cpDraft = {
      ...this.cpDraft,
      cityId: '',
      targetDate: '',
      stops: [
        ...stops,
        {
          cityId,
          islandId,
          islandName: this._islandName(islandId) || map.name,
          cityName: city.name,
          targetDate: targetDate || null,
        },
      ],
    };
  }

  /** Quita una parada del borrador. @param {number} index */
  _cpRemoveStop(index) {
    this.cpDraft = { ...this.cpDraft, stops: this.cpDraft.stops.toSpliced(index, 1) };
  }

  /** Sube/baja una parada del borrador. @param {number} index @param {-1|1} delta */
  _cpMoveStop(index, delta) {
    const to = index + delta;
    const stops = this.cpDraft.stops;
    if (to < 0 || to >= stops.length) return;
    this.cpDraft = {
      ...this.cpDraft,
      stops: stops.toSpliced(index, 1).toSpliced(to, 0, stops[index]),
    };
  }

  /**
   * «Compartir mi ruta planificada»: precarga las paradas del borrador desde
   * la plannedRoute de la persona cargada, resolviendo isla y nombres con los
   * mapas del archipiélago — cargados BAJO DEMANDA (solo hasta resolver todas
   * las ciudades) y cacheados. Las ciudades que no aparezcan en ningún mapa
   * se cuentan en un aviso, nunca se inventan.
   */
  async _cpSharePlanned() {
    if (!this.personId || this.carpoolBusy) return;
    const planned = this.journey?.plannedRoute ?? [];
    if (planned.length === 0) {
      this.carpoolError = 'Esta persona no tiene ruta planificada que compartir.';
      return;
    }
    this.carpoolBusy = true;
    this.carpoolError = '';
    try {
      this.archipelago ??= await getArchipelago();
      const maps = [];
      const pending = new Set(planned);
      for (const isle of this.archipelago.islands) {
        if (pending.size === 0) break;
        const map = await this._ensureIslandMap(isle.id);
        maps.push(map);
        for (const city of map.cities) pending.delete(city.id);
      }
      const { stops, missing } = carpoolFromPlannedRoute(this.journey, maps);
      this.cpDraft = {
        ...this.cpDraft,
        stops,
        notice:
          missing.length > 0
            ? `${missing.length} parada${missing.length === 1 ? '' : 's'} de la ruta planificada no está${missing.length === 1 ? '' : 'n'} en ningún mapa y se ha${missing.length === 1 ? '' : 'n'} omitido.`
            : '',
      };
    } catch (err) {
      this.carpoolError =
        err instanceof Error ? err.message : 'No se pudo leer la ruta planificada.';
    } finally {
      this.carpoolBusy = false;
    }
  }

  /** «Crear carpool»: la persona seleccionada queda de CONDUCTOR. */
  async _createCarpool() {
    if (!this._canPlayJourney || this.carpoolBusy) return;
    const person = this._selectedPerson;
    if (!person) {
      this.carpoolError = 'Elige la persona que conducirá (selector de arriba).';
      return;
    }
    if (!this.currentUser?.uid) {
      this.carpoolError = 'Hace falta la sesión iniciada para crear un carpool.';
      return;
    }
    this.carpoolBusy = true;
    this.carpoolError = '';
    try {
      const created = await this._carpoolApi.createCarpool(
        {
          name: this.cpDraft.name,
          seats: Number(this.cpDraft.seats),
          route: this.cpDraft.stops,
          conductor: { personId: person.id, name: person.name },
        },
        this.currentUser,
      );
      this.myCarpools = [created, ...(this.myCarpools ?? [])];
      this.carpools = [created, ...(this.carpools ?? [])];
      this.cpDraft = CareerApp.EMPTY_CP_DRAFT;
      this.carpoolTab = 'mine';
    } catch (err) {
      this.carpoolError = err instanceof Error ? err.message : 'No se pudo crear el carpool.';
    } finally {
      this.carpoolBusy = false;
    }
  }

  /** Botón «🚗 Carpools» de la barra: el tablón lo ve todo el mundo. */
  _renderCarpoolButton() {
    return html`<button
      @click=${this._openCarpools}
      title="Abrir el tablón de carpools: recorre la formación en grupo"
    >🚗 Carpools</button>`;
  }

  /**
   * Chip del HUD (CP-1): «🚗 {nombre}: X/Y paradas» del primer carpool EN
   * MARCHA de la persona cargada — X = paradas que ELLA ya completó.
   */
  _renderCarpoolHudStat() {
    const cp = this._activeCarpools.at(0);
    if (!cp) return null;
    const visited = new Set(this.journey?.visitedCities ?? []);
    const done = cp.route.filter((s) => visited.has(s.cityId)).length;
    return html`<span
      class="hudstat"
      title=${`Carpool «${cp.name}»: has completado ${done} de ${cp.route.length} paradas`}
    >🚗 ${cp.name}: ${done}/${cp.route.length} paradas</span>`;
  }

  /** Insignia del estado de un carpool. @param {import('../../tools/career/domain/carpool.js').Carpool} cp */
  _renderCarpoolStatus(cp) {
    return html`<span class="cpstatus ${cp.status}">${CareerApp.CARPOOL_STATUS_LABELS[cp.status]}</span>`;
  }

  /** Fecha objetivo legible de una parada ('—' sin objetivo). @param {string|null} iso */
  _cpDateLabel(iso) {
    return iso ?? '—';
  }

  /**
   * Una entrada del TABLÓN: nombre, conductor, ruta resumida (islas y nº de
   * paradas), plazas y el botón «Unirse» con la persona seleccionada.
   * @param {import('../../tools/career/domain/carpool.js').Carpool} cp
   */
  _renderBoardCarpool(cp) {
    const summary = carpoolRouteSummary(cp);
    const free = carpoolSeatsLeft(cp);
    const already = this.personId ? isCarpoolMember(cp, this.personId) : false;
    const joinable = this._canPlayJourney && this.personId && canJoinCarpool(cp, this.personId);
    return html`<li class="cpcard">
      <div class="cphead">
        <h4>🚗 ${cp.name}</h4>
        ${this._renderCarpoolStatus(cp)}
        <span class="cpseats spacer" title="Plazas ocupadas / totales">
          ${cp.members.length}/${cp.seats} plazas
        </span>
      </div>
      <p class="cpmeta">
        Conduce <strong>${cp.conductor.name}</strong> ·
        ${summary.islandNames.join(' · ')} · ${summary.stops} parada${summary.stops === 1 ? '' : 's'}
      </p>
      ${this._canPlayJourney
        ? html`<div class="cpactions">
            ${already
              ? html`<span class="cpmeta">Ya vas dentro.</span>`
              : html`<button
                  class="primary"
                  ?disabled=${!joinable || this.carpoolBusy}
                  title=${!this.personId
                    ? 'Elige una persona en el selector de arriba'
                    : free === 0
                      ? 'Sin plazas libres'
                      : `Unir a ${this._selectedPerson?.name ?? 'la persona seleccionada'}`}
                  @click=${() => this._joinCarpool(cp)}
                >Unirse</button>`}
          </div>`
        : null}
    </li>`;
  }

  /**
   * Una entrada de «LOS MÍOS»: ruta completa (isla · ciudad · tiempo objetivo)
   * con el estado ✓/pendiente/⏰ de cada miembro en tabla compacta, el avance
   * % por miembro y las acciones (Salir / Cerrar del conductor-creador).
   * @param {import('../../tools/career/domain/carpool.js').Carpool} cp
   */
  _renderMyCarpool(cp) {
    const prog = carpoolProgress(cp, this._carpoolJourneyMap());
    const inMarch = cp.status === 'open' || cp.status === 'full';
    const isConductor = cp.conductor.personId === this.personId;
    const isCreator = Boolean(this.currentUser?.uid) && cp.createdBy?.uid === this.currentUser.uid;
    /** Estado de una parada para un miembro, como marca compacta. */
    const mark = (state) =>
      state === 'done'
        ? html`<span class="cpmark done" title="Parada completada">✓</span>`
        : state === 'delayed'
          ? html`<span class="cpmark delayed" title="Tiempo objetivo pasado (sin castigo)">⏰</span>`
          : html`<span class="cpmark pending" title="Pendiente">·</span>`;
    return html`<li class="cpcard">
      <div class="cphead">
        <h4>🚗 ${cp.name}</h4>
        ${this._renderCarpoolStatus(cp)}
        ${prog.completed ? html`<span class="cpstatus completed">🏁 Ruta completada</span>` : null}
        <span class="cpseats spacer" title="Plazas ocupadas / totales">
          ${cp.members.length}/${cp.seats} plazas
        </span>
      </div>
      <p class="cpmeta">Conduce <strong>${cp.conductor.name}</strong></p>
      <table class="cptable">
        <thead>
          <tr>
            <th scope="col">Parada</th>
            <th scope="col">Objetivo</th>
            ${cp.members.map(
              (m) => html`<th scope="col" class="mate" title=${m.name}>${m.name.split(' ').at(0)}</th>`,
            )}
          </tr>
        </thead>
        <tbody>
          ${prog.stops.map(
            (s) => html`<tr>
              <td>
                <span class="stopisle">${s.stop.islandName} · </span>
                <span class="stopname">${s.stop.cityName}</span>
              </td>
              <td class="stopdate ${s.delayed ? 'delayed' : ''}">${this._cpDateLabel(s.stop.targetDate)}</td>
              ${cp.members.map((m) => html`<td class="mate">${mark(s.states[m.personId])}</td>`)}
            </tr>`,
          )}
        </tbody>
      </table>
      <ul class="cpprogress" aria-label="Avance por miembro">
        ${prog.members.map(
          (m) => html`<li>
            ${m.name}
            <span class="pct">${m.pct}%</span>
            ${m.personId !== this.personId && this._carpoolJourneysMissing.has(m.personId)
              ? html`<span class="nodata">(sin datos)</span>`
              : null}
          </li>`,
        )}
      </ul>
      <div class="cpactions">
        ${this._canPlayJourney && inMarch && !isConductor && this.personId && isCarpoolMember(cp, this.personId)
          ? html`<button ?disabled=${this.carpoolBusy} @click=${() => this._leaveCarpool(cp)}>
              Salir del carpool
            </button>`
          : null}
        ${isCreator && cp.status !== 'closed'
          ? html`<button
              ?disabled=${this.carpoolBusy}
              title="Cerrar el carpool: lo retira del tablón y del mapa"
              @click=${() => this._closeCarpool(cp)}
            >Cerrar</button>`
          : null}
      </div>
    </li>`;
  }

  /** Pestaña «Crear» (CP-1): nombre, plazas, constructor de ruta y compartir
   * la ruta planificada de la persona cargada. */
  _renderCarpoolCreate() {
    const draft = this.cpDraft;
    const islands = this.archipelago?.islands ?? [];
    const islandMap = draft.islandId ? this._islandMaps.get(draft.islandId) : undefined;
    const cities = (islandMap?.cities ?? []).filter((c) => c.deprecated !== true);
    return html`
      <div class="wizform">
        <label for="cp-name">Nombre del carpool</label>
        <input
          id="cp-name"
          type="text"
          placeholder="P. ej. «Los frontends del sur»"
          .value=${draft.name}
          ?disabled=${this.carpoolBusy}
          @input=${(e) => { this.cpDraft = { ...this.cpDraft, name: e.target.value }; }}
        />
        <label for="cp-seats">Plazas (incluye a quien conduce)</label>
        <input
          id="cp-seats"
          type="number"
          min=${MIN_CARPOOL_SEATS}
          max=${MAX_CARPOOL_SEATS}
          .value=${String(draft.seats)}
          ?disabled=${this.carpoolBusy}
          @input=${(e) => { this.cpDraft = { ...this.cpDraft, seats: e.target.value }; }}
        />
      </div>
      <p class="sub">Ruta (paradas en orden)</p>
      <div class="cpformrow">
        <label>Isla
          <select .value=${draft.islandId} ?disabled=${this.carpoolBusy} @change=${this._onCpIslandChange}>
            <option value="" ?selected=${!draft.islandId}>— Isla —</option>
            ${islands.map(
              (i) => html`<option value=${i.id} ?selected=${i.id === draft.islandId}>${i.name}</option>`,
            )}
          </select>
        </label>
        <label>Casa
          <select
            .value=${draft.cityId}
            ?disabled=${this.carpoolBusy || !draft.islandId}
            @change=${(e) => { this.cpDraft = { ...this.cpDraft, cityId: e.target.value }; }}
          >
            <option value="" ?selected=${!draft.cityId}>— Casa —</option>
            ${cities.map(
              (c) => html`<option value=${c.id} ?selected=${c.id === draft.cityId}>${c.name}</option>`,
            )}
          </select>
        </label>
        <label>Tiempo objetivo (opcional)
          <input
            type="date"
            .value=${draft.targetDate}
            ?disabled=${this.carpoolBusy}
            @input=${(e) => { this.cpDraft = { ...this.cpDraft, targetDate: e.target.value }; }}
          />
        </label>
        <button type="button" ?disabled=${this.carpoolBusy} @click=${this._cpAddStop}>
          + Añadir parada
        </button>
      </div>
      ${draft.stops.length === 0
        ? html`<p class="wizempty">Aún no hay paradas: añade casas o comparte tu ruta planificada.</p>`
        : html`<ol class="cpstops">
            ${draft.stops.map(
              (s, i) => html`<li class="cpstop">
                <span class="ord">${i + 1}.</span>
                <span>${s.islandName} · <strong>${s.cityName}</strong></span>
                <span class="when">${this._cpDateLabel(s.targetDate)}</span>
                <button type="button" aria-label="Subir la parada ${s.cityName}" title="Subir"
                  ?disabled=${this.carpoolBusy || i === 0} @click=${() => this._cpMoveStop(i, -1)}>↑</button>
                <button type="button" aria-label="Bajar la parada ${s.cityName}" title="Bajar"
                  ?disabled=${this.carpoolBusy || i === draft.stops.length - 1} @click=${() => this._cpMoveStop(i, 1)}>↓</button>
                <button type="button" aria-label="Quitar la parada ${s.cityName}" title="Quitar"
                  ?disabled=${this.carpoolBusy} @click=${() => this._cpRemoveStop(i)}>✕</button>
              </li>`,
            )}
          </ol>`}
      ${draft.notice ? html`<p class="cpnotice">${draft.notice}</p>` : null}
      <div class="cpactions">
        <button
          type="button"
          ?disabled=${this.carpoolBusy || (this.journey?.plannedRoute ?? []).length === 0}
          title=${(this.journey?.plannedRoute ?? []).length === 0
            ? 'Esta persona no tiene ruta planificada'
            : 'Precargar las paradas desde la ruta planificada de la persona cargada'}
          @click=${this._cpSharePlanned}
        >⛵ Compartir mi ruta planificada</button>
        <button class="primary" ?disabled=${this.carpoolBusy} @click=${this._createCarpool}>
          Crear carpool
        </button>
      </div>
    `;
  }

  /** Contenido de la pestaña activa del overlay de carpools. */
  _renderCarpoolTabContent() {
    if (this.carpoolTab === 'create' && this._canPlayJourney) return this._renderCarpoolCreate();
    if (this.carpoolTab === 'mine') {
      if (!this.personId) {
        return html`<p class="wizempty">Elige una persona (selector de arriba) para ver sus carpools.</p>`;
      }
      if (this.myCarpools === null) return html`<p class="wizempty">Cargando tus carpools…</p>`;
      if (this.myCarpools.length === 0) {
        return html`<p class="wizempty">Aún no participas en ningún carpool: únete desde el tablón o crea uno.</p>`;
      }
      return html`<ul class="cplist">${this.myCarpools.map((cp) => this._renderMyCarpool(cp))}</ul>`;
    }
    // Tablón (default).
    if (this.carpools === null) return html`<p class="wizempty">Cargando el tablón…</p>`;
    if (this.carpools.length === 0) {
      return html`<p class="wizempty">No hay carpools abiertos: ${this._canPlayJourney ? 'crea el primero.' : 'vuelve más tarde.'}</p>`;
    }
    return html`<ul class="cplist">${this.carpools.map((cp) => this._renderBoardCarpool(cp))}</ul>`;
  }

  /**
   * Overlay «🚗 Carpools» (CP-1): modal hermano de la ficha con pestañas
   * Tablón / Los míos / Crear (esta última solo con permiso). Foco al abrir,
   * Escape/✕/fondo cierran.
   */
  _renderCarpools() {
    if (!this.showCarpools) return null;
    const tabs = this._carpoolTabs;
    return html`<div class="sea-backdrop" @click=${(e) => { if (e.target === e.currentTarget) this._closeCarpools(); }}>
      <section
        class="ficha cppanel"
        role="dialog"
        aria-modal="true"
        aria-label="Carpools de formación"
        tabindex="-1"
        @keydown=${this._onCarpoolsKeydown}
      >
        <header class="sea-head">
          <h3>🚗 Carpools</h3>
          <button class="close" aria-label="Cerrar el tablón de carpools" title="Cerrar (Esc)" @click=${this._closeCarpools}>✕</button>
        </header>
        <p class="cplead">
          Como compartir coche: un grupo con nombre recorre junto una ruta de
          paradas con tiempos objetivo. Únete a uno abierto o comparte tu ruta.
        </p>
        <div class="ctabs" role="tablist" aria-label="Secciones de carpools" @keydown=${this._onCarpoolTabsKeydown}>
          ${tabs.map((tab) => {
            const selected = this.carpoolTab === tab;
            return html`<button
              id="cptab-${tab}"
              class="ctab ${selected ? 'active' : ''}"
              type="button"
              role="tab"
              aria-selected=${selected ? 'true' : 'false'}
              aria-controls="cppanel-${tab}"
              tabindex=${selected ? '0' : '-1'}
              @click=${() => this._setCarpoolTab(tab)}
            >${CareerApp.CARPOOL_TAB_LABELS[tab]}</button>`;
          })}
        </div>
        ${this.carpoolError ? html`<p class="error" role="alert">${this.carpoolError}</p>` : null}
        <div
          id="cppanel-${this.carpoolTab}"
          class="ctabpanel"
          role="tabpanel"
          aria-labelledby="cptab-${this.carpoolTab}"
          tabindex="0"
        >${this._renderCarpoolTabContent()}</div>
      </section>
    </div>`;
  }

  // ---- Tribbu-coins (CP-2) ------------------------------------------------------

  /**
   * Saldo materializado de la persona cargada (/coins/balances). No bloquea
   * ni tumba la carga: sin saldo legible se muestra «—» y se deja constancia.
   */
  async _loadCoinsBalance() {
    const personId = this.personId;
    this.coinsBalance = null;
    if (!personId) return;
    try {
      const balance = await getCoinsBalance(personId);
      if (this.personId === personId) this.coinsBalance = balance; // se cambió de persona mientras cargaba
    } catch (err) {
      console.warn('Tribbu-coins: no se pudo leer el saldo.', err);
    }
  }

  /**
   * Lee ledger + meta + saldos y ejecuta la verificación COMPLETA del dominio
   * (cadena, contratos, saldos, firmas si hay clave pública, checkpoint
   * local). Si NO hay manipulación, avanza el checkpoint a la cabeza recién
   * verificada (avanzarlo sobre una historia manipulada la «bendeciría»).
   * Actualiza coinsLedger/coinsVerify/coinsAlert. Lanza si la IO falla.
   */
  async _refreshCoinsLedger() {
    const [entries, meta, balances] = await Promise.all([
      getLedger(),
      getCoinsMeta(),
      listCoinsBalances(),
    ]);
    const result = await verifyCoinsLedger({
      entries,
      meta,
      balances,
      publicKeyPem: COINS_PUBLIC_KEY_PEM,
      checkpoint: readCoinsCheckpoint(),
    });
    this.coinsLedger = entries;
    this.coinsVerify = result;
    this.coinsAlert = result.alert;
    if (!result.alert && entries.length > 0) {
      const head = entries.at(-1);
      writeCoinsCheckpoint({ seq: head.seq, headHash: head.hash });
    }
    return result;
  }

  /**
   * Verificación EN SEGUNDO PLANO al abrir el juego (una vez por sesión): si
   * la historia vista por este navegador cambió (o la cadena/firmas no
   * cuadran), coinsAlert enciende la alerta roja del HUD. Un fallo de IO no
   * molesta al jugador: queda en consola y el botón «verificar» permite
   * reintentar a mano.
   */
  _startCoinsBackgroundVerification() {
    if (this._coinsVerifyStarted || !this.store) return;
    this._coinsVerifyStarted = true;
    this._refreshCoinsLedger().catch((err) => {
      console.warn('Tribbu-coins: no se pudo verificar el libro mayor en segundo plano.', err);
    });
  }

  /** Botón «🪙 Verificar libro mayor» del overlay: verificación a demanda. */
  async _runCoinsVerification() {
    if (this.coinsBusy) return;
    this.coinsBusy = true;
    this.coinsError = '';
    try {
      await this._refreshCoinsLedger();
      await this._loadCoinsBalance(); // el saldo mostrado se refresca a la vez
    } catch (err) {
      this.coinsError =
        err instanceof Error ? err.message : 'No se pudo verificar el libro mayor.';
    } finally {
      this.coinsBusy = false;
    }
  }

  /** Abre el overlay «🪙 Tribbu-coins» (y verifica si aún no hay resultado). */
  _openCoins() {
    this.coinsError = '';
    this.showCoins = true;
    if (this.coinsLedger === null) this._runCoinsVerification();
  }

  /** Cierra el overlay de coins y devuelve el foco al HUD. */
  _closeCoins() {
    this.showCoins = false;
    this.updateComplete.then(() => this.renderRoot.querySelector('.hud button')?.focus());
  }

  /** Escape dentro del overlay de coins lo cierra. @param {KeyboardEvent} event */
  _onCoinsKeydown(event) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    this._closeCoins();
  }

  /**
   * Montones de monedas del cofre por nivel de llenado (JG-13): pares [x, y]
   * (x en % del hueco, y en px sobre el borde) elegidos a mano para que cada
   * nivel se lea de un vistazo (fila suelta → capa → montículo → desborde).
   */
  /** Colores de los chips de hito del selector de retos (identidad del juego,
   * cálido→frío con la cima en plata; SIN dependencia de la escala de
   * lecturas subjetivas del tool Equipo). */
  static TIER_COLORS = Object.freeze({
    peritus: '#ffc53d',
    veteranus: '#3b82f6',
    magister: '#c7ccd1',
  });

  static COIN_PILES = Object.freeze({
    empty: Object.freeze([]),
    low: Object.freeze([[34, 0], [50, 0], [42, 7]]),
    mid: Object.freeze([[14, 0], [32, 0], [50, 0], [68, 0], [23, 8], [41, 8], [59, 8]]),
    high: Object.freeze([
      [8, 0], [26, 0], [44, 0], [62, 0], [80, 0],
      [17, 9], [35, 9], [53, 9], [71, 9],
      [26, 18], [44, 18], [62, 18],
    ]),
    overflow: Object.freeze([
      [4, 0], [22, 0], [40, 0], [58, 0], [76, 0], [92, 0],
      [13, 9], [31, 9], [49, 9], [67, 9], [85, 9],
      [22, 18], [40, 18], [58, 18], [76, 18],
      [31, 27], [49, 27], [67, 27],
    ]),
  });

  /** Monedas caídas DELANTE del cofre cuando el saldo desborda (nivel 'overflow'). */
  static COIN_SPILL = Object.freeze([[6, 0], [18, 4], [84, 2], [94, 0]]);

  /** Botón-cofre de tribbu-coins de la barra (JG-13): cofre cerrado dibujado + saldo. */
  _renderCoinsButton() {
    const balance = this.coinsBalance ?? '—';
    const cls = this.coinsAlert ? 'coinsbtn forced' : 'coinsbtn';
    return html`<button
      class=${cls}
      @click=${this._openCoins}
      aria-label="Tribbu-coins: saldo ${balance}. Abre el cofre con el libro mayor firmado"
      title="Tribbu-coins: saldo, historial y verificación del libro mayor firmado"
    >
      <svg class="chesticon" viewBox="0 0 24 20" aria-hidden="true">
        <path d="M2 9 V7.5 A10 7 0 0 1 22 7.5 V9 Z" fill="#7a5a33" stroke="#3a2712" stroke-width="1" />
        <rect x="2" y="9" width="20" height="9.5" rx="1.5" fill="#8a6a3f" stroke="#3a2712" stroke-width="1" />
        <line x1="2.6" y1="13.8" x2="21.4" y2="13.8" stroke="#3a2712" stroke-opacity="0.35" />
        <rect x="10" y="1.4" width="4" height="17" rx="1" fill="#c9973f" stroke="#7c5a18" stroke-width="0.8" />
        <circle cx="12" cy="10.6" r="1.3" fill="#5d4210" />
      </svg>
      ${balance}
    </button>`;
  }

  /**
   * Monedas doradas del cofre (JG-13): el montón del nivel de llenado dentro
   * del hueco y, si desborda, unas monedas caídas delante de la caja.
   * @param {'empty'|'low'|'mid'|'high'|'overflow'} level
   */
  _renderChestCoins(level) {
    const pile = CareerApp.COIN_PILES[level] ?? [];
    if (pile.length === 0) return null;
    const spill = level === 'overflow' ? CareerApp.COIN_SPILL : [];
    const coin = ([x, y]) => {
      const at = `left:${x}%;bottom:${y}px`;
      return html`<span class="coin" style=${at}></span>`;
    };
    const spilled = spill.length > 0 ? html`<div class="chest-spill">${spill.map(coin)}</div>` : null;
    return html`<div class="chest-coins">${pile.map(coin)}</div>
      ${spilled}`;
  }

  /**
   * Cofre grande del overlay (JG-13), 100% CSS procedural (decisión JG-7):
   * tapa que se levanta al abrir (bisagra trasera; con prefers-reduced-motion
   * aparece ya abierto), montón de monedas según coinsFillLevel y rótulo de
   * latón con el número del saldo. Si la última verificación detectó trampa
   * (la misma señal que la alerta 🚨 del HUD), el cofre se pinta forzado:
   * tapa torcida, herraje suelto y tinte rojizo.
   * @param {string} name Nombre de la persona cargada (para el título).
   */
  _renderChest(name) {
    const balance = this.coinsBalance;
    const level = coinsFillLevel(balance ?? 0);
    const cls = this.coinsAlert ? 'chest forced' : 'chest';
    return html`<div class=${cls}>
      <div class="chest-scene" aria-hidden="true">
        <div class="chest-lid"><span class="chest-lid-band"></span></div>
        <div class="chest-cavity"></div>
        ${this._renderChestCoins(level)}
        <div class="chest-base">
          <span class="chest-band"></span>
          <span class="chest-lock"></span>
        </div>
      </div>
      <span class="chest-plaque" title="Saldo materializado de ${name}">
        ${balance ?? '—'} <small>tribbu-coins</small>
      </span>
    </div>`;
  }

  /**
   * Apuntes del ledger de la PERSONA cargada, el más reciente primero
   * (null si el ledger aún no se cargó).
   * @returns {import('../../tools/career/domain/coins.js').CoinsEntry[]|null}
   */
  get _personCoinsEntries() {
    if (this.coinsLedger === null || !this.personId) return null;
    return this.coinsLedger
      .filter((e) => e.personId === this.personId)
      .toSorted((a, b) => b.seq - a.seq);
  }

  /**
   * Datos de coins para <player-card> (CP-2): saldo y las últimas 10
   * transacciones legibles. null mientras no haya nada que enseñar (la ficha
   * oculta la sección).
   * @returns {{ balance: number, recent: { label: string, delta: number, ts: string }[] }|null}
   */
  _coinsForCard() {
    const entries = this._personCoinsEntries;
    if (this.coinsBalance === null && entries === null) return null;
    return {
      balance: this.coinsBalance ?? 0,
      recent: (entries ?? []).slice(0, 10).map((e) => ({
        label: coinsEntryLabel(e),
        delta: e.delta,
        ts: e.ts,
      })),
    };
  }

  /**
   * Una línea del resultado de verificación: ✓/✗ (o ○ si esa comprobación se
   * saltó) + etiqueta + motivo del fallo si lo hay.
   * @param {string} label
   * @param {{ ok: boolean, checked?: boolean, reason?: string }} check
   * @param {string} [detail] Detalle extra del fallo (ya legible).
   */
  _renderCoinsCheck(label, check, detail = '') {
    const skipped = check.checked === false;
    const icon = skipped ? '○' : check.ok ? '✓' : '✗';
    const cls = skipped ? 'skip' : check.ok ? 'pass' : 'fail';
    const reason = skipped ? 'no comprobado' : (check.reason ?? detail);
    return html`<li class="vcheck ${cls}">
      <span class="vicon" aria-hidden="true">${icon}</span>
      <span>${label}${!check.ok || skipped ? html` — <em>${reason}</em>` : null}</span>
    </li>`;
  }

  /** Resultado DETALLADO de la última verificación del libro mayor. */
  _renderCoinsVerifyResult() {
    const v = this.coinsVerify;
    if (!v) return html`<p class="wizempty">Aún sin verificar: pulsa «Verificar libro mayor».</p>`;
    const c = v.checks;
    const rulesDetail = c.rules.failures
      .map((f) => `apunte ${f.seq}: ${f.reason}`)
      .join(' · ');
    const balancesDetail = c.balances.mismatches
      .map((m) => `${m.personId}: ledger ${m.computed} ≠ guardado ${m.stored}`)
      .join(' · ');
    const sigDetail = c.signatures.failures.length
      ? `firma inválida en seq ${c.signatures.failures.join(', ')}`
      : '';
    return html`
      <p class="vsummary ${v.alert ? 'alert' : v.ok ? 'good' : 'warn'}" role="status">
        ${v.alert
          ? '🚨 MANIPULACIÓN DETECTADA en el libro mayor'
          : v.ok
            ? `✅ Libro mayor íntegro (${c.chain.length} apuntes verificados)`
            : '⚠️ El libro mayor tiene discrepancias (detalle abajo)'}
      </p>
      <ul class="vchecks">
        ${this._renderCoinsCheck('Cadena de hashes (seq + prevHash + hash)', c.chain)}
        ${this._renderCoinsCheck('Cabeza /coins/meta coherente con la cadena', c.meta)}
        ${this._renderCoinsCheck('Contratos: cada delta sale de su regla', c.rules, rulesDetail)}
        ${this._renderCoinsCheck('Saldos materializados = recomputación del ledger', c.balances, balancesDetail)}
        ${this._renderCoinsCheck(
          `Firmas KMS (${c.signatures.verified} verificadas, ${c.signatures.unsigned} sin firma)`,
          c.signatures,
          sigDetail,
        )}
        ${this._renderCoinsCheck('Historia vista por este navegador (checkpoint)', c.checkpoint)}
      </ul>
      ${v.warnings.length
        ? html`<ul class="vwarnings">${v.warnings.map((w) => html`<li>⚠️ ${w}</li>`)}</ul>`
        : null}
    `;
  }

  /**
   * Historial de apuntes de la persona en el pergamino (o su estado de
   * carga/vacío). El contenido es el bloque CP-2 de siempre, intacto.
   * @param {import('../../tools/career/domain/coins.js').CoinsEntry[]|null} entries
   */
  _renderCoinsHistory(entries) {
    if (entries === null) return html`<p class="wizempty">Cargando el libro mayor…</p>`;
    if (entries.length === 0) {
      return html`<p class="wizempty">Sin transacciones todavía: los coins llegan con certificados, ciudadanías, badges y carpools completados.</p>`;
    }
    return html`<ul class="coinslist">
      ${entries.map(
        (e) => html`<li>
          <span class="what">${coinsEntryLabel(e)}${e.unsigned ? html` <span class="unsigned" title="Apunte emitido sin clave KMS configurada">sin firma</span>` : null}</span>
          <span class="when">${formatWizardDate(e.ts)}</span>
          <span class="delta">+${e.delta} 🪙</span>
        </li>`,
      )}
    </ul>`;
  }

  /**
   * Overlay «🪙 Tribbu-coins» (CP-2 + JG-13): el cofre con las monedas y el
   * rótulo del saldo arriba y, colgando de él, el pergamino desplegable con
   * la verificación del libro mayor (botón + resultado detallado) y el
   * historial completo. Modal hermano de la ficha: foco al abrir,
   * Escape/✕/fondo cierran.
   */
  _renderCoins() {
    if (!this.showCoins) return null;
    const name = (this.people ?? []).find((p) => p.id === this.personId)?.name ?? '';
    const entries = this._personCoinsEntries;
    // El pergamino del libro mayor sale abierto si la última verificación
    // falló (la trampa no se esconde); el resto de veces decide el jugador.
    const ledgerOpen = Boolean(this.coinsVerify && !this.coinsVerify.ok);
    return html`<div class="sea-backdrop" @click=${(e) => { if (e.target === e.currentTarget) this._closeCoins(); }}>
      <section
        class="ficha coinspanel"
        role="dialog"
        aria-modal="true"
        aria-label="Tribbu-coins de ${name}"
        tabindex="-1"
        @keydown=${this._onCoinsKeydown}
      >
        <header class="sea-head">
          <h3>🪙 Tribbu-coins</h3>
          <button class="close" aria-label="Cerrar el panel de tribbu-coins" title="Cerrar (Esc)" @click=${this._closeCoins}>✕</button>
        </header>
        <p class="cplead">
          Los tribbu-coins se emiten SOLO por contratos y quedan en un libro
          mayor firmado y encadenado que cualquiera puede auditar: si alguien
          tocase la base de datos, aquí se vería.
        </p>
        ${this._renderChest(name)}
        <details class="ledgerscroll" ?open=${ledgerOpen}>
          <summary>📜 Libro mayor firmado y verificación</summary>
          <div class="coinshead">
            <button @click=${this._runCoinsVerification} ?disabled=${this.coinsBusy}>
              ${this.coinsBusy ? 'Verificando…' : '🪙 Verificar libro mayor'}
            </button>
          </div>
          ${this.coinsError ? html`<p class="error" role="alert">${this.coinsError}</p>` : null}
          ${this._renderCoinsVerifyResult()}
          <p class="sub-coins">Historial de ${name}</p>
          ${this._renderCoinsHistory(entries)}
        </details>
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
   * true si el usuario JUEGA el plan de la persona cargada (JG-1): el
   * ingeniero vinculado (canPlay, su propia persona) o el manager/superadmin
   * (canEdit, la persona seleccionada). Gatea TODAS las acciones de juego:
   * visitadas/actual/ruta, evidencias, viajar, carpools (crear/unirse/salir),
   * preguntar al brujo, cronómetro de playtime y registro de achievements.
   * El viewer (ni canPlay ni canEdit) queda en solo lectura de verdad.
   */
  get _canPlayJourney() {
    return this.canPlay || this.canEdit;
  }

  /**
   * true si el usuario puede DEJAR consultas y marcarlas como vistas: quien
   * JUEGA (canPlay || canEdit, JG-1) o el jugador vinculado a la persona
   * seleccionada (Person.uid == su uid: la excepción acotada de las reglas,
   * que cubre al ingeniero cuando un manager carga SU persona). Si no, el
   * panel del brujo queda en solo lectura.
   */
  get _canAskWizard() {
    if (this._canPlayJourney) return true;
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
   * del manager, MC-22): misma política y cap que los journeys del equipo. Una
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
   * Cola FIFO del manager: las consultas pendientes de TODAS las personas en
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

  /** Personaje del <game-dialog> del brujo (identidad estable entre renders). */
  static WIZARD_CHARACTER = Object.freeze({ name: 'El brujo', portrait: 'brujo' });

  /**
   * Abre el panel del brujo de la isla actual y construye el GUION de la
   * conversación (JG-8): la escena arranca con el saludo y sigue según el
   * estado de las consultas (respuesta lista → la entrega; si no → pregunta).
   */
  _openWizard() {
    if (!this.personId) return;
    this.wizardError = '';
    this.showWizardLog = false;
    this.wizardScript = this._buildWizardScript();
    this.showWizard = true;
  }

  /**
   * Respuestas LISTAS (status 'answered') de la persona en la isla actual, la
   * más antigua primero: el brujo las entrega en orden de llegada.
   * @returns {import('../../tools/career/domain/wizard.js').WizardQuestion[]}
   */
  _answeredQueue() {
    const mine = (this.questions ?? []).filter(
      (q) => q.islandId === this.currentIsland && q.status === 'answered',
    );
    return sortQuestionsByDateDesc(mine).toReversed();
  }

  /**
   * Guion inicial de la conversación con el brujo: saludo con sabor según el
   * estado de la cabaña y, después, la primera respuesta lista (con su
   * «Entendido») o directamente la pregunta. El viewer (sin _canAskWizard)
   * solo escucha: ni Entendido ni consulta.
   * @returns {import('./dialogScript.js').DialogStep[]}
   */
  _buildWizardScript() {
    const islandName = this._currentIslandName() || 'la isla';
    const mine = (this.questions ?? []).filter((q) => q.islandId === this.currentIsland);
    const state = wizardState(mine);
    const greeting =
      state === 'ready'
        ? `Ahh… te esperaba, viajero de ${islandName}. El éter trae noticias para ti…`
        : state === 'pending'
          ? `Ahh… un viajero de ${islandName}. Tu consulta aún viaja por el éter… paciencia. ¿Otra duda te atormenta?`
          : `Ahh… un viajero de ${islandName}. Pasa, no temas a las sombras. ¿Qué duda te atormenta?`;
    const steps = [{ kind: 'say', text: greeting }];
    if (!this._canAskWizard) {
      steps.push({
        kind: 'say',
        text: 'Tú solo puedes escuchar los ecos: las consultas de esta persona no son tuyas. Su lista espera abajo, en «ver mis consultas».',
      });
      return steps;
    }
    const answered = this._answeredQueue().at(0);
    steps.push(...(answered ? this._wizardAnswerSteps(answered) : this._wizardAskSteps()));
    return steps;
  }

  /**
   * Pasos de ENTREGA de una respuesta lista: recordatorio de la pregunta, el
   * oráculo con su crédito y el «Entendido» (choices v1) que la marca vista.
   * @param {import('../../tools/career/domain/wizard.js').WizardQuestion} q
   * @returns {import('./dialogScript.js').DialogStep[]}
   */
  _wizardAnswerSteps(q) {
    const credit = q.creditedTo ?? q.answeredBy?.name ?? '';
    return [
      { kind: 'say', text: `Preguntaste: «${q.text}»` },
      {
        kind: 'say',
        text: `El oráculo ha hablado: «${q.answer ?? ''}»${credit ? ` — palabra de ${credit}.` : ''}`,
      },
      {
        kind: 'choices',
        text: '¿Te sirve? Márcalo y seguimos.',
        options: [{ id: `seen:${q.id}`, label: 'Entendido' }],
      },
    ];
  }

  /**
   * Paso de PREGUNTA al brujo: el textarea de la consulta (el envío lo
   * resuelve _onWizardSubmit con el trance y la promesa de la luz violeta).
   * @returns {import('./dialogScript.js').DialogStep[]}
   */
  _wizardAskSteps() {
    return [
      {
        kind: 'ask',
        text: 'Escribe tu duda y la susurraré al éter…',
        placeholder: 'Cuéntale tu duda al brujo…',
        submitLabel: 'Consultar al brujo',
      },
    ];
  }

  /** El <game-dialog> del brujo montado en el panel (o null). */
  _wizardDialog() {
    return /** @type {import('./game-dialog.js').GameDialog|null} */ (
      this.renderRoot.querySelector('game-dialog')
    );
  }

  /** Cierra el panel del brujo (✕, Escape o fondo) y devuelve el foco al HUD. */
  _closeWizard() {
    this.showWizard = false;
    this.updateComplete.then(() => this.renderRoot.querySelector('.hud button')?.focus());
  }

  /** Escape dentro del panel del brujo lo cierra. @param {KeyboardEvent} event */
  _onWizardKeydown(event) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    this._closeWizard();
  }

  /**
   * El jugador envió su consulta en el diálogo (evento 'dialog-submit'):
   * usecase askQuestion (texto ya validado por la escena), autoría del login y
   * la isla ACTUAL. En éxito el brujo entra en TRANCE para llevarla al manager
   * y promete la LUZ VIOLETA; si falla, el paso sigue vivo para reintentar.
   * @param {CustomEvent<{ text: string }>} event
   */
  async _onWizardSubmit(event) {
    if (!this.personId || this.wizardBusy) return;
    this.wizardBusy = true;
    this.wizardError = '';
    try {
      const created = await askQuestion(this.store, this.personId, {
        islandId: this.currentIsland,
        islandName: this._currentIslandName(),
        text: event.detail.text,
        createdBy: this._wizardAuthor(),
      });
      this.questions = [created, ...(this.questions ?? [])];
      this._wizardDialog()?.continueWith([
        {
          kind: 'effect',
          effect: 'trance',
          text: '✨ mmmMMMmmm… tu consulta viaja por el éter hasta tu manager…',
        },
        {
          kind: 'say',
          text: 'Está hecho: se lo he susurrado a tu manager. Cuando tenga la respuesta, encenderé una LUZ VIOLETA en mi cabaña… la verás incluso desde el mar, allá donde navegues.',
        },
      ]);
    } catch (err) {
      this.wizardError =
        err instanceof Error ? err.message : 'No se pudo dejar la consulta al brujo.';
    } finally {
      this.wizardBusy = false;
    }
  }

  /**
   * El jugador pulsó una opción del diálogo (evento 'dialog-choice'). Única
   * opción v1: «Entendido» (`seen:{questionId}`) — marca la respuesta como
   * vista y el brujo sigue con la siguiente respuesta lista o con la pregunta.
   * @param {CustomEvent<{ id: string }>} event
   */
  async _onWizardChoice(event) {
    const id = event.detail.id;
    if (!id.startsWith('seen:')) return; // opción de otro guion futuro
    const question = (this.questions ?? []).find((q) => q.id === id.slice('seen:'.length));
    if (!question) return;
    await this._markSeen(question);
    if (this.wizardError) return; // markSeen falló: el paso sigue vivo
    const next = this._answeredQueue().at(0);
    this._wizardDialog()?.continueWith(
      next
        ? this._wizardAnswerSteps(next)
        : [
            { kind: 'say', text: 'Bien. El éter queda en calma…' },
            ...this._wizardAskSteps(),
          ],
    );
  }

  /** El guion terminó: la lista de consultas se despliega como cierre suave. */
  _onWizardDialogEnd() {
    this.showWizardLog = true;
  }

  /** Despliega/oculta la lista «mis consultas» del panel del brujo (JG-8). */
  _toggleWizardLog() {
    this.showWizardLog = !this.showWizardLog;
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

  /** Abre la cola de consultas del manager (botón «🧙 Consultas (N)»). */
  _openWizardQueue() {
    if (!this.canEdit) return;
    this.wizardError = '';
    this.showWizardQueue = true;
  }

  /** Cierra la cola del manager y devuelve el foco al HUD. */
  _closeWizardQueue() {
    this.showWizardQueue = false;
    this.updateComplete.then(() => this.renderRoot.querySelector('.hud button')?.focus());
  }

  /** Escape dentro de la cola del manager la cierra. @param {KeyboardEvent} event */
  _onWizardQueueKeydown(event) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    this._closeWizardQueue();
  }

  /**
   * «Responder» desde la cola del manager: usecase answerQuestion con la autoría
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

  /** Botón «🧙 Consultas (N)» de la barra: solo con canEdit (cola del manager). */
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
   * Overlay del PANEL DEL BRUJO (JG-8): la CONVERSACIÓN estilo Monkey Island
   * dentro del pergamino — <game-dialog> con el retrato voodoo, bocadillos
   * progresivos, la consulta como paso del guion (trance al enviarla) y las
   * respuestas listas entregadas con «Entendido» (markSeen). La lista clásica
   * de consultas queda tras el enlace discreto «ver mis consultas» (y se
   * despliega sola al terminar el guion). Modal como el archipiélago: foco al
   * abrir, Escape/✕/fondo cierran.
   */
  _renderWizard() {
    if (!this.showWizard) return null;
    const islandName = this._currentIslandName();
    const mine = (this.questions ?? []).filter((q) => q.islandId === this.currentIsland);
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
        ${this.wizardError ? html`<p class="error" role="alert">${this.wizardError}</p>` : null}
        ${this.wizardScript
          ? html`<game-dialog
              .character=${CareerApp.WIZARD_CHARACTER}
              .script=${this.wizardScript}
              .busy=${this.wizardBusy}
              @dialog-submit=${this._onWizardSubmit}
              @dialog-choice=${this._onWizardChoice}
              @dialog-end=${this._onWizardDialogEnd}
            ></game-dialog>`
          : null}
        <p class="wizlog-link">
          <button
            class="linky"
            aria-expanded=${this.showWizardLog}
            @click=${this._toggleWizardLog}
          >${this.showWizardLog ? 'ocultar mis consultas' : 'ver mis consultas'}</button>
        </p>
        ${this.showWizardLog ? this._renderWizardLog(mine) : null}
      </section>
    </div>`;
  }

  /**
   * Lista clásica de MIS consultas de esta isla (pergamino, MC-22): estado,
   * respuesta y «Entendido» (markSeen) cuando está respondida — el registro
   * completo detrás del enlace «ver mis consultas».
   * @param {import('../../tools/career/domain/wizard.js').WizardQuestion[]} mine
   */
  _renderWizardLog(mine) {
    const canAsk = this._canAskWizard;
    return html`<p class="sub">Consultas en esta isla</p>
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
          </ul>`}`;
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
    // Viajar ESCRIBE el journey (setCurrentIsland): solo quien juega (JG-1).
    // El cierre del overlay de arriba sí queda disponible para todos.
    if (!this._canPlayJourney) return;
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
    // Desembarco (JG-25): se llega a la nueva isla A PIE, desde el puerto —
    // mucho más inmersivo que aparecer en la vista aérea. Solo en escritorio
    // (el modo a pie requiere ratón/teclado); en móvil se queda en aérea.
    if (!this.error && this._canPlayJourney && !this._coarsePointer) {
      await this.updateComplete;
      this.renderRoot.querySelector('career-island-3d')?.enterFirstPerson();
    }
  }

  /**
   * Arranca la animación del barco (MC-19): calcula el trayecto — desde JG-17
   * la curva pirata determinista del par, esquivando el resto de islas del
   * índice — y su duración (puras, domain/voyage.js), publica el estado
   * `voyage` (pinta el barco, la capa de estela y el aviso aria-live
   * «Zarpando hacia…») y lanza el bucle de rAF. Si los dos puertos del índice
   * coincidieran (trayecto imposible), se zarpa sin animación: el viaje NUNCA
   * se pierde por la parte visual.
   * @param {import('../../tools/career/domain/types.js').IslandRef} from
   * @param {import('../../tools/career/domain/types.js').IslandRef} to
   */
  async _startVoyage(from, to) {
    let path;
    try {
      path = voyageCurve(from, to, this.archipelago?.islands ?? []);
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
   * Un frame del viaje: t = tiempo/duración, la pose (posición con easing,
   * rumbo tangente y escora — JG-17) recoloca el barco sobre la curva y suelta
   * estela cada WAKE_INTERVAL_MS. Al llegar (t = 1) desemboca en
   * _finishVoyage → _departTo. Se manipula el DOM directamente (fuera de
   * Lit): re-renderizar el overlay entero a 60 fps sería tirar el resto del
   * mapa por un left/top.
   * @param {number} now Reloj del rAF (ms).
   */
  _voyageFrame(now) {
    const voyage = this.voyage;
    if (!voyage) return; // el viaje terminó (Escape) entre frame y frame
    this._voyageStart ||= now;
    const t = Math.min((now - this._voyageStart) / voyage.duration, 1);
    const boat = this.renderRoot.querySelector('.boat');
    if (boat) {
      const pose = voyagePose(voyage.path, t);
      boat.style.cssText = this._boatStyleAt(pose);
      const layer = this.renderRoot.querySelector('.voyage-layer');
      if (layer && now - this._voyageWakeAt >= WAKE_INTERVAL_MS && t < 1) {
        this._voyageWakeAt = now;
        this._spawnWake(layer, pose);
      }
    }
    if (t >= 1) {
      this._finishVoyage();
      return;
    }
    this._voyageRaf = requestAnimationFrame((n) => this._voyageFrame(n));
  }

  /**
   * Estilo inline del barco para una pose (JG-17): posición sobre la curva y
   * transform del sprite LATERAL. CONVENCIÓN: el barco pirata se dibuja con
   * la proa a la DERECHA (+x, la misma que asume voyageBoatOrientation), así
   * que a rumbo oeste basta un scaleX(-1) — se acabó el espejo base y el XOR
   * que necesitaba el glifo ⛵, que miraba a la izquierda. El rotate es el
   * transform MÁS EXTERNO (gira en pantalla): trae el cabeceo acotado a ±20°
   * y la escora del giro ya sumados.
   * @param {import('../../tools/career/domain/voyage.js').VoyagePose} pose
   * @returns {string}
   */
  _boatStyleAt(pose) {
    const heading = voyageBoatOrientation(pose);
    const mirror = heading.mirrored ? ' scaleX(-1)' : '';
    return `left:${pose.x}%; top:${pose.y}%; transform: translate(-50%, -50%) rotate(${heading.rotateDeg}deg)${mirror}`;
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
    // Y el cronómetro de juego, con su volcado final best-effort (MC-23).
    this._playtimeTracker?.stop();
    this._playtimeTracker = null;
    this._playtimePerson = null;
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
    // La luz del brujo (JG-8): islas con alguna respuesta LISTA para la
    // persona cargada — su mancha del mapa emite el halo violeta.
    const wizardLit = new Set(
      (this.questions ?? []).filter((q) => q.status === 'answered').map((q) => q.islandId),
    );
    // Isla de la SIGUIENTE parada del reto (JG-14, rutas multi-isla): el mapa
    // del mar «apunta» a ella con «🎯 Tu reto».
    const challengeIsland = this._challengeTargetIsland();
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
          <!-- Rosa de los vientos (JG-7): decorativa, tinta sepia de mapa. -->
          <svg class="compass" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="55" r="27" fill="none" stroke="#4a2e12" stroke-width="1.6" opacity="0.75" />
            <circle cx="50" cy="55" r="21" fill="none" stroke="#4a2e12" stroke-width="0.8" opacity="0.5" />
            <path d="M50 17 L55 50 L50 55 L45 50 Z" fill="#b3261e" stroke="#4a2e12" stroke-width="1" />
            <path d="M50 93 L55 60 L50 55 L45 60 Z" fill="#f6eed6" stroke="#4a2e12" stroke-width="1" />
            <path d="M12 55 L45 50 L50 55 L45 60 Z" fill="#f6eed6" stroke="#4a2e12" stroke-width="1" />
            <path d="M88 55 L55 50 L50 55 L55 60 Z" fill="#f6eed6" stroke="#4a2e12" stroke-width="1" />
            <text x="50" y="11" text-anchor="middle" font-size="11" font-family="Georgia, serif" font-weight="700" fill="#4a2e12">N</text>
          </svg>
          ${this._renderSeaRoute(islands)}
          ${islands.map((island) => {
            const here = island.id === this.currentIsland;
            const built = this.existingIslands?.has(island.id) ?? island.id === DEFAULT_ISLAND_ID;
            const challengeTarget = !here && challengeIsland === island.id;
            const lit = wizardLit.has(island.id);
            const baseTitle = here
              ? `${island.name} — estás aquí`
              : built
                ? `Zarpar hacia ${island.name}`
                : `Zarpar hacia ${island.name} (en construcción)`;
            return html`<button
              type="button"
              role="listitem"
              class="isle ${here ? 'here' : ''} ${built ? '' : 'wip'} ${lit ? 'wizlit' : ''}"
              style=${`left:${island.x}%; top:${island.y}%`}
              title=${lit ? `${baseTitle} — 🔮 el brujo tiene tu respuesta` : baseTitle}
              @click=${() => this._travelTo(island.id)}
            >
              <span class="isle-dot" aria-hidden="true">
                <!-- Silueta de ISLA (JG-12): mancha asimétrica determinista por id
                     (bajío de agua clara, línea de sonda punteada, costa a plumilla
                     con aguada de arena y verde interior). Solo cambia el dibujo:
                     el área interactiva sigue siendo el botón completo. -->
                <svg viewBox="0 0 100 100">
                  <path class="isle-shoal" d=${seaBlobPath(island.id, 1.22)}></path>
                  <path class="isle-sound" d=${seaBlobPath(island.id, 1.12)}></path>
                  <path class="isle-coast" d=${seaBlobPath(island.id)}></path>
                  <path class="isle-inland" d=${seaBlobPath(island.id, 0.72)}></path>
                </svg>
              </span>
              ${here ? html`<span class="isle-x" aria-hidden="true">✗</span>` : null}
              <span class="isle-name">${island.name}</span>
              ${here
                ? html`<span class="isle-tag here">Estás aquí</span>`
                : challengeTarget
                  ? html`<span class="isle-tag target">🎯 Tu reto</span>`
                  : built
                    ? null
                    : html`<span class="isle-tag">En construcción</span>`}
              ${this._renderSeaRouteTag(island.id)}
            </button>`;
          })}
          ${this.voyage
            ? html`<div class="voyage-layer" aria-hidden="true">
                <span class="boat" style=${this._boatStyleAt(voyagePose(this.voyage.path, 0))}>
                  <span class="boat-bob">${PIRATE_SHIP_SVG}</span>
                </span>
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
      ${this.coinsBalance !== null
        ? html`<span class="hudstat" title="Tribbu-coins: saldo según el libro mayor firmado (botón 🪙 para auditarlo)">🪙 ${this.coinsBalance}</span>`
        : null}
      ${this.coinsAlert
        ? html`<span
            class="hudbadge coinsalert"
            role="alert"
            title="La verificación del libro mayor de tribbu-coins detectó manipulación: cadena rota, firma inválida o historia reescrita. Abre 🪙 Tribbu-coins para el detalle."
          >🚨 Libro mayor alterado</span>`
        : null}
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
    // Modo Reto (JG-5): «Siguiente: {casa} — {isla}» con botón «Llévame» (el
    // único aviso INTERACTIVO: recibe punteros, el resto son pasivos). La
    // isla es la de la PARADA (las rutas son multi-isla, JG-14).
    if (a.kind === 'challenge-next') {
      const cityName = this._challengeCityName(a.nextCityId) ?? `casa ${a.stopNumber}`;
      const islandName = this._islandName(this._challengeStopIsland(a.nextCityId) ?? '');
      return html`<div class="cit-toast challenge" role="status" aria-live="assertive">
        <p>
          🎯 Siguiente: <strong>${cityName}</strong>${islandName ? ` — ${islandName}` : ''}
          <button
            class="golead"
            @click=${() => this._goToChallengeStop(a.nextCityId)}
            title="Ir a la siguiente casa del reto"
          >Llévame</button>
        </p>
      </div>`;
    }
    const text =
      a.kind === 'island'
        ? `🏆 ¡Ciudadanía de ${a.islandName} conseguida!`
        : a.kind === 'super'
          ? '⭐ ¡Super-ciudadano del archipiélago!'
          : a.kind === 'challenge-done'
            ? `🎉 ¡${a.name} completado!`
            : '👑 ¡Leyenda del archipiélago!';
    return html`<div class="cit-toast ${a.kind}" role="status" aria-live="assertive">
      <p>${text}</p>
    </div>`;
  }

  /** Fundido de travesía mientras se cambia de isla (MC-14): al LLEGAR se está
   * desembarcando en la isla nueva (JG-25), no de camino. */
  _renderTravelFade() {
    if (!this.traveling) return null;
    const name = this._islandName(this.currentIsland) || this.map?.name || '';
    return html`<div class="travel-fade" role="status" aria-live="polite">
      <p>🌊 Desembarcando en ${name}…</p>
    </div>`;
  }

  /** Botón «🧭 Archipiélago» (siempre disponible: barra y HUD a pie). */
  _renderArchipelagoButton() {
    return html`<button
      @click=${this._openArchipelago}
      title="Abrir el mapa del archipiélago y viajar a otra isla"
    >🧭 Archipiélago</button>`;
  }

  /** Botón HUD «🚶 Explorar a pie»: deshabilitado (y abreviado) en táctil. */
  _renderWalkButton() {
    const coarse = this._coarsePointer;
    const title = coarse
      ? 'Modo de escritorio: requiere ratón y teclado'
      : 'Recorre la isla a pie en primera persona: cursor libre, arrastra para mirar (WASD/flechas para andar)';
    return html`<button @click=${this._enterFps} ?disabled=${coarse} title=${title}>
      🚶 ${coarse ? 'A pie (escritorio)' : 'Explorar a pie'}
    </button>`;
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
            <kbd>WASD</kbd> + ratón para caminar, <kbd>E</kbd> abre la casa cercana
            y <kbd>Esc</kbd> vuelve a la vista aérea.
          </li>
          <li>
            <strong>Tu objetivo:</strong> las casas con una baliza de luz coral tienen
            el <strong>visado disponible</strong> — son tu siguiente paso. La ruta
            planificada queda marcada en el suelo.
          </li>
          <li>
            <strong>Casas bloqueadas 🔒:</strong> algunas casas están bloqueadas — su
            tarjeta te dice qué necesitas conseguir antes; pulsa un requisito
            para ir a él.
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
      { id: 'list', label: 'Lista' },
      { id: 'flat', label: 'Plano' },
      { id: '3d', label: 'Isla 3D' },
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
   * Acciones de journey sobre la casa (visitada/actual/ruta). Si la casa está
   * en desuso solo se muestra la nota (no es visitable), como hasta ahora.
   * En una casa BLOQUEADA (JG-2) no se ofrecen acciones imposibles (obtener
   * el certificado o marcarla como actual): solo planificar la ruta.
   *
   * «Añadir a la ruta» (JG-9): con la ruta VACÍA añade directo (no hay orden
   * que elegir); con paradas abre el selector inline «¿Dónde en tu ruta?»
   * (al final por defecto, o antes de cualquier parada).
   * @param {import('../../tools/career/domain/types.js').City} sel
   * @param {boolean} [blocked] true si la casa está bloqueada por prerequisitos.
   */
  _renderCityActions(sel, blocked = false) {
    if (sel.deprecated) {
      return html`<p class="dep">Tecnología en desuso — no forma parte de la ruta.</p>`;
    }
    // Solo quien JUEGA (JG-1) ve las acciones de journey; el viewer, nada
    // (antes veía botones que Firestore rechazaba después).
    if (!this._canPlayJourney) return null;
    const visited = this.journey.visitedCities ?? [];
    const planned = this.journey.plannedRoute ?? [];
    const inRoute = planned.includes(sel.id);
    const pickerOpen = this.routePicker?.cityId === sel.id;
    return html`<div class="actions">
      ${blocked
        ? null
        : html`
            <button class="primary" @click=${() => this._act('toggle')}>
              ${visited.includes(sel.id) ? 'Retirar el certificado' : 'Obtener certificado'}
            </button>
            <button
              title="La fija como tu objetivo: el juego te la señala en el mapa y el minimapa"
              @click=${() => this._act('current')}
            >🎯 Centrarme en esta casa</button>
          `}
      ${inRoute
        ? html`<button @click=${() => this._act('route')}>Quitar de la ruta</button>`
        : planned.length === 0
          ? html`<button @click=${() => this._act('route')}>Añadir a la ruta</button>`
          : html`<button
              aria-expanded=${pickerOpen ? 'true' : 'false'}
              @click=${() => this._toggleRoutePicker(sel.id)}
            >Añadir a la ruta…</button>`}
      ${pickerOpen ? this._renderRoutePicker() : null}
    </div>`;
  }

  /**
   * Selector inline «¿Dónde en tu ruta?» (JG-9): al final (por defecto) o
   * antes de cualquiera de las paradas actuales, listadas con su número
   * global y su nombre. «Antes de N» inserta en el índice N-1 (el número es
   * 1-based sobre la plannedRoute, missing incluidas: los índices no bailan).
   */
  _renderRoutePicker() {
    const picker = this.routePicker;
    if (!picker) return null;
    return html`<div class="routepick" role="group" aria-label="¿Dónde en tu ruta?">
      <p class="routepick-lead">¿Dónde en tu ruta?</p>
      <button class="primary" @click=${() => this._insertRouteAt()}>Al final</button>
      ${picker.stops.map(
        (stop) => html`<button @click=${() => this._insertRouteAt(stop.n - 1)}>
          Antes de ${stop.n}. ${stop.name}
        </button>`,
      )}
      <button class="routepick-cancel" @click=${() => { this.routePicker = null; }}>Cancelar</button>
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

  /**
   * Sección FINAL «El certificado» (JG-18): EXPLICA el flujo antes de ofrecer
   * el botón — declarar el certificado, aportar una evidencia opcional y el
   * aval del manager (JG-6). En una casa BLOQUEADA (JG-2) no hay CTA imposible:
   * en su lugar, el bloque «Para entrar necesitas» lista sus prerequisitos
   * con su estado y los pendientes son botones que navegan a esa casa.
   * @param {import('../../tools/career/domain/types.js').City} sel
   */
  _renderCityCertificate(sel) {
    const status = this._cityCardStatus(sel);
    const blocked = status === 'blocked';
    const inRoute = (this.journey.plannedRoute ?? []).includes(sel.id);
    const isCurrent = this.journey.currentCity === sel.id;
    return html`<section class="cardsec certsec">
      <h4>El certificado</h4>
      ${status === 'available'
        ? html`<p class="certflow">Cuando domines lo de arriba, declara tu certificado. Puedes aportar una evidencia (enlace o nota) y tu manager podrá avalarlo ⭐.</p>`
        : null}
      ${blocked ? this._renderBlockedPrereqs(sel) : null}
      ${this._renderEndorsement(sel, status === 'visited')}
      ${this._renderCityFlags(isCurrent, inRoute)}
      ${this._renderCityActions(sel, blocked)}
      ${this._renderNextStepLink(sel)}
      ${this._renderEvidencePrompt(sel)}
      ${this._renderCityEvidences(sel)}
    </section>`;
  }

  /**
   * Enlace «Ir al siguiente paso» tras certificar (RMR-TSK-0169). Al certificar
   * una casa, ofrece ir a la SIGUIENTE parada pendiente de la ruta CON MOVIMIENTO
   * (autopiloto a pie, vuelo en aérea, o mapa del mar si está en otra isla), para
   * no tener que buscarla a mano. Reutiliza la brújula (_guideCityId, que cubre
   * modo Reto y Libre) y el mismo gesto de navegación que los prerequisitos
   * (_goToChallengeStop → _goToPrereq). Solo tras certificar (status «visited») y
   * si hay una siguiente casa distinta de la abierta.
   * @param {import('../../tools/career/domain/types.js').City} sel
   */
  _renderNextStepLink(sel) {
    if (!this._canPlayJourney) return null;
    if (this._cityCardStatus(sel) !== 'visited') return null;
    const nextId = this._guideCityId;
    if (!nextId || nextId === sel.id) return null;
    const label = `${this._challengeCityName(nextId) ?? 'siguiente casa'}${this._challengeIslandSuffix(nextId)}`;
    return html`<button
      type="button"
      class="nextstep"
      title="Te lleva con movimiento a la siguiente casa de tu ruta"
      @click=${() => this._goToChallengeStop(nextId)}
    >Ir al siguiente paso: ${label} →</button>`;
  }

  /** Chips «Actual» / «En ruta» de la casa (JG-18), o nada si no aplican. */
  _renderCityFlags(isCurrent, inRoute) {
    if (!isCurrent && !inRoute) return null;
    const current = isCurrent ? html`<span class="badge current">Actual</span>` : null;
    const route = inRoute ? html`<span class="badge route">En ruta</span>` : null;
    return html`<div class="badges">${current}${route}</div>`;
  }

  /**
   * Estado de juego de la casa para la tarjeta (JG-18): el de cityStatus con
   * el desconocido plegado a bloqueada (misma casuística que el badge).
   * @param {import('../../tools/career/domain/types.js').City} sel
   * @returns {'visited'|'available'|'blocked'|'deprecated'}
   */
  _cityCardStatus(sel) {
    const st = cityStatus(this._selectedMap, sel.id, this.journey);
    return st === 'unknown' ? 'blocked' : st;
  }

  /**
   * Badge-sello del estado de la casa en la CABECERA de la tarjeta (JG-18),
   * junto al título y separado de cualquier botón — antes se pintaba mezclado
   * con las acciones y lo primero que se veía era el CTA.
   * @param {import('../../tools/career/domain/types.js').City} sel
   */
  _renderCityStatusBadge(sel) {
    const status = this._cityCardStatus(sel);
    return html`<span class="badge headbadge ${status}">${CareerApp.STATUS_BADGES[status]}</span>`;
  }

  /**
   * Aval del manager sobre el certificado (JG-6). Solo en casas CERTIFICADAS:
   *  - Con aval: el sello «✓ Avalado por {name} · {fecha}» — lo ve TODO el
   *    mundo (jugador incluido); quien lo firmó puede retirarlo.
   *  - Sin aval y el usuario es manager (canEdit) de OTRA persona: el botón
   *    «✓ Avalar certificado». El jugador nunca ve botones de aval (no puede
   *    auto-avalarse: la UI lo oculta y las reglas de Firestore lo prohíben).
   * El aval es reconocimiento, nunca bloqueo: el certificado ya vale.
   * @param {import('../../tools/career/domain/types.js').City} sel
   * @param {boolean} certified true si la casa tiene el certificado.
   */
  _renderEndorsement(sel, certified) {
    if (!certified) return null;
    const record = endorsementFor(this.endorsements, sel.id);
    if (record) {
      const when = formatAchievedAt(record.at);
      const mine = this._canEndorse && record.by.uid === this.currentUser?.uid;
      return html`<div class="endorse">
        <span class="seal">
          <span class="tick" aria-hidden="true">✓</span>
          Avalado por ${record.by.name}${when ? html` <span class="when">· ${when}</span>` : null}
        </span>
        ${mine
          ? html`<button
              type="button"
              class="unendorse"
              ?disabled=${this.endorseBusy}
              title="Retirar tu aval de este certificado"
              @click=${this._unendorseSelected}
            >Retirar aval</button>`
          : null}
      </div>`;
    }
    if (!this._canEndorse) return null;
    return html`<div class="endorse">
      <button
        type="button"
        class="endorse-btn"
        ?disabled=${this.endorseBusy}
        title="Sella este certificado con tu aval: un reconocimiento, nunca un requisito"
        @click=${this._endorseSelected}
      >✓ Avalar certificado</button>
    </div>`;
  }

  /**
   * true si el usuario puede AVALAR/retirar avales de la persona cargada
   * (JG-6): manager (canEdit) con login, avales ya cargados y — clave — la
   * persona NO es la suya (el jugador no se auto-avala, ni siquiera un manager
   * sobre su propia persona vinculada).
   */
  get _canEndorse() {
    const uid = this.currentUser?.uid;
    return Boolean(
      this.canEdit && uid && this.endorsements && this._selectedPerson?.uid !== uid,
    );
  }

  /** El manager firma el sello de la casa seleccionada (JG-6). */
  async _endorseSelected() {
    if (!this._canEndorse || !this.personId || !this.selected) return;
    this.endorseBusy = true;
    this.error = '';
    try {
      const { uid, name } = /** @type {{ uid: string, name: string }} */ (this.currentUser);
      this.endorsements = await endorseCity(
        this.store,
        this.personId,
        this.selected,
        { uid, name },
        this.endorsements,
      );
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo avalar el certificado.';
    } finally {
      this.endorseBusy = false;
    }
  }

  /** Quien firmó el aval lo retira (JG-6): la única corrección posible. */
  async _unendorseSelected() {
    if (!this._canEndorse || !this.personId || !this.selected) return;
    this.endorseBusy = true;
    this.error = '';
    try {
      this.endorsements = await unendorseCity(
        this.store,
        this.personId,
        this.selected,
        this.endorsements,
      );
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo retirar el aval.';
    } finally {
      this.endorseBusy = false;
    }
  }

  /**
   * Prompt de evidencia tras certificar (JG-6): invitación amable y
   * DESCARTABLE a contar cómo se logró — nunca un requisito. Solo en la casa
   * cuyo certificado se acaba de obtener; «Ahora no» lo retira.
   * @param {import('../../tools/career/domain/types.js').City} sel
   */
  _renderEvidencePrompt(sel) {
    if (this.evidencePrompt !== sel.id) return null;
    return html`<div class="evprompt" role="status">
      <p>🎉 ¡Certificado! ¿Cómo lo lograste? Añade una evidencia (opcional).</p>
      <button type="button" class="evlater" @click=${this._dismissEvidencePrompt}>Ahora no</button>
    </div>`;
  }

  /** «Ahora no»: descarta la sugerencia de evidencia (JG-6). */
  _dismissEvidencePrompt() {
    this.evidencePrompt = null;
  }

  /**
   * Bloque «🔒 Para entrar necesitas» de una casa bloqueada (JG-2): TODOS sus
   * prerequisitos con su estado — ✓ conseguido (teal) o pendiente (coral) — y
   * cada pendiente es un botón que lleva a esa casa (_goToPrereq). Visible
   * también para el viewer: orienta aunque no juegue.
   * @param {import('../../tools/career/domain/types.js').City} sel
   */
  _renderBlockedPrereqs(sel) {
    const visited = new Set(this.journey.visitedCities ?? []);
    const prereqs = (sel.prereqs ?? []).map((id) => ({
      id,
      name: this._selectedMap.cities.find((c) => c.id === id)?.name ?? id,
      done: visited.has(id),
    }));
    if (!prereqs.length) return null;
    return html`<div class="prereqs">
      <h4>🔒 Para entrar necesitas</h4>
      <ul>
        ${prereqs.map((p) =>
          p.done
            ? html`<li class="done">
                <span class="tick" aria-hidden="true">✓</span>
                <span>${p.name}</span>
                <span class="visuallyhidden">— conseguido</span>
              </li>`
            : html`<li class="todo">
                <button
                  type="button"
                  class="goto"
                  title="Ir a ${p.name}"
                  aria-label="Pendiente: ir a la casa ${p.name}"
                  @click=${() => this._goToPrereq(p.id)}
                >${p.name} →</button>
              </li>`,
        )}
      </ul>
    </div>`;
  }

  /**
   * Navega a una casa (JG-21): el enlace LLEVA a la casa, no abre su tarjeta
   * (que se abre al LLEGAR). En 3D a pie, autopiloto — el avatar camina solo
   * hasta ella (walkToCity) y al chocar entra; en 3D aérea, la cámara vuela
   * hasta ella (focusCity) sin abrir la tarjeta. En la vista plana no hay
   * recorrido físico: se selecciona para resaltarla en el mapa.
   * @param {string} cityId
   */
  _goToPrereq(cityId) {
    if (this.viewMode !== '3d') {
      this.selected = cityId;
      return;
    }
    // El enlace nunca abre la tarjeta: se cierra la actual y se navega.
    this.selected = null;
    const island = this.renderRoot.querySelector('career-island-3d');
    if (this.mode3d === 'fps') island?.walkToCity(cityId);
    else island?.focusCity(cityId);
  }

  /**
   * Sección «¿Qué es?» (JG-18): el resumen didáctico de la casa — lo PRIMERO
   * que se lee, para saber a qué te enfrentas antes de nada. Sin summary aún,
   * un placeholder honesto en vez de dejar el hueco mudo.
   * @param {import('../../tools/career/domain/types.js').City} sel
   */
  _renderCityWhat(sel) {
    const summary = (sel.summary ?? '').trim();
    return html`<section class="cardsec whatsec">
      <h4>¿Qué es?</h4>
      ${summary
        ? html`<p class="summary">${summary}</p>`
        : html`<p class="placeholder">Resumen en preparación.</p>`}
    </section>`;
  }

  /**
   * Sección «Qué aprenderás» (JG-18): los puntos fundamentales con check
   * visual (keyPoints). Se oculta entera si la casa aún no tiene ninguno.
   * @param {import('../../tools/career/domain/types.js').City} sel
   */
  _renderCityLearn(sel) {
    const points = sel.keyPoints ?? [];
    if (!points.length) return null;
    return html`<section class="cardsec">
      <h4>Qué aprenderás</h4>
      <ul class="keypoints">
        ${points.map(
          (p) => html`<li><span class="tick" aria-hidden="true">✔</span><span>${p}</span></li>`,
        )}
      </ul>
    </section>`;
  }

  /**
   * Sección «🤖 En la era IA» (JG-18): la lente de IA de la casa (aiFocus).
   * Se oculta si no la tiene.
   * @param {import('../../tools/career/domain/types.js').City} sel
   */
  _renderCityAiFocus(sel) {
    const focus = (sel.aiFocus ?? '').trim();
    if (!focus) return null;
    return html`<section class="aifocus">
      <h4>🤖 En la era IA</h4>
      <p>${focus}</p>
    </section>`;
  }

  /**
   * Sección «Recursos para el viaje» (JG-18): recursos agrupados por tipo con
   * su icono y enlace. Van dentro de un <details> PLEGADO (la tarjeta no debe
   * hacerse eterna) con el conteo en el summary. Se oculta si no hay ninguno.
   * @param {import('../../tools/career/domain/types.js').City} sel
   */
  _renderCityResources(sel) {
    const resources = this._cityResources(sel);
    if (!resources.length) return null;
    const groups = Object.entries(RESOURCE_GROUPS)
      .map(([kind, meta]) => ({ meta, items: resources.filter((r) => r.kind === kind) }))
      .filter((g) => g.items.length);
    return html`<details class="cardsec ressec">
      <summary>Recursos para el viaje (${resources.length})</summary>
      ${groups.map(
        ({ meta, items }) => html`<div class="resgroup">
          <h5>${meta.icon} ${meta.title}</h5>
          <ul class="res">
            ${items.map(
              (r) => html`<li>
                ${r.url ? html`<a href=${r.url} target="_blank" rel="noopener">${r.label}</a>` : html`<span>${r.label}</span>`}
                ${r.format ? html`<span class="fmt">${r.format}</span>` : null}
              </li>`,
            )}
          </ul>
        </div>`,
      )}
    </details>`;
  }

  /**
   * Cuerpo DIDÁCTICO de la tarjeta de casa (JG-18): una sola tarjeta
   * scrolleable, sin pestañas que escondan el contenido tras el botón. Orden:
   * ¿Qué es? → Qué aprenderás → En la era IA → Recursos (plegados) → El
   * certificado (el flujo explicado y el botón AL FINAL). COMPARTIDA por el
   * overlay del 3D y la vista plana.
   * @param {import('../../tools/career/domain/types.js').City} sel
   */
  _renderCityBody(sel) {
    return html`
      ${this._renderCityWhat(sel)}
      ${this._renderCityLearn(sel)}
      ${this._renderCityAiFocus(sel)}
      ${this._renderCityResources(sel)}
      ${this._renderCityReferences(sel)}
      ${this._renderCityCertificate(sel)}
    `;
  }

  /** Referencias de aprendizaje aportadas por la tripulación para esta casa
   *  (RMR-TSK-0255): componente en vivo, firmado por el ingeniero logado. */
  _renderCityReferences(sel) {
    return html`<city-references
      .islandId=${this._selectedMap?.id ?? this.currentIsland}
      .cityId=${sel.id}
      .user=${this.currentUser}
    ></city-references>`;
  }

  /**
   * Panel lateral de la vista plano con la tarjeta del tema seleccionado:
   * cabecera (comarca · tipo · puntos) con el badge de estado, y el cuerpo
   * didáctico compartido.
   */
  _renderPlanoPanel(sel, selAreaName) {
    const area = selAreaName ? html`${selAreaName} · ` : null;
    return html`
      <div class="cityhead">
        <div>
          <h3>${sel.name}</h3>
          <p class="kind">${area}${sel.kind} · ${sel.weight} pts</p>
        </div>
        ${this._renderCityStatusBadge(sel)}
      </div>
      ${this._renderCityBody(sel)}
    `;
  }

  /**
   * Evidencias de ciudadanía de la ciudad (editables por quien JUEGA, JG-1;
   * en solo lectura para el resto; ocultas si está en desuso). Las listas se
   * editan como chips (MC-8); los títulos legados se muestran fusionados
   * dentro de cursos (ver _saveEvidenceList).
   */
  _renderCityEvidences(sel) {
    if (sel.deprecated) return null;
    const editable = this._canPlayJourney;
    const ev = this.journey.evidences?.[sel.id] ?? {};
    const cursos = [...(ev.cursos ?? []), ...(ev.titulos ?? [])];
    // Certificado recién obtenido (JG-6): las evidencias se abren solas, de la
    // mano del prompt — la invitación es opcional, no un formulario obligado.
    return html`<details class="ev" ?open=${this.evidencePrompt === sel.id}>
      <summary>Evidencias</summary>
      <label>Experiencia previa (años)
        <input
          type="number"
          min="0"
          step="0.5"
          .value=${ev.priorExperienceYears ?? ''}
          ?disabled=${!editable}
          @change=${(e) => this._saveExperience(e.target.value)}
        />
      </label>
      ${this._renderEvidenceList('formaciones', 'Formaciones', ev.formaciones ?? [], editable)}
      ${this._renderEvidenceList('cursos', 'Cursos y títulos', cursos, editable)}
    </details>`;
  }

  /**
   * Lista de evidencias como chips: editable (cada valor con su ✕ para quitar
   * y un input con botón «+» o Enter para añadir de una en una) o de solo
   * lectura (chips sin controles) cuando no se juega el plan (JG-1).
   * @param {'formaciones'|'cursos'} field
   * @param {string} label
   * @param {string[]} values
   * @param {boolean} editable
   */
  _renderEvidenceList(field, label, values, editable) {
    const add = (input) => this._addEvidenceItem(field, values, input);
    return html`<div class="evlist">
      <span class="evtitle">${label}</span>
      ${values.length
        ? html`<ul class="chips">
            ${values.map(
              (value, i) => html`<li class="chip">
                <span>${value}</span>
                ${editable
                  ? html`<button
                      type="button"
                      class="chip-x"
                      aria-label="Quitar ${value} de ${label}"
                      title="Quitar"
                      @click=${() => this._removeEvidenceItem(field, values, i)}
                    >✕</button>`
                  : null}
              </li>`,
            )}
          </ul>`
        : null}
      ${editable
        ? html`<div class="evadd">
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
          </div>`
        : null}
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
   * Tarjeta de la casa overlay del modo 3D (JG-18): cabecera con nombre,
   * comarca · tipo · puntos y el BADGE de estado (separado del cierre), y el
   * cuerpo didáctico compartido con la vista plana.
   * @param {import('../../tools/career/domain/types.js').City} sel
   */
  _renderCityPanel(sel) {
    const areaName = this._selectedMap.areas.find((a) => a.id === sel.area)?.name;
    return html`<div class="citypanel-backdrop" @click=${this._closeCityPanel}></div>
    <aside
      class="citypanel"
      role="dialog"
      aria-label="Tarjeta de ${sel.name}"
      tabindex="-1"
      @keydown=${this._onPanelKeydown}
    >
      <div class="paper"></div>
      <svg class="torn-def" width="0" height="0" aria-hidden="true">
        <filter id="citytorn" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="3" seed="7" result="n"></feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="17" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>
        </filter>
      </svg>
      <button class="seal" aria-label="Cerrar panel" title="Cerrar (Esc)" @click=${this._closeCityPanel}>✕</button>
      <div class="ink">
        <h3 class="ctitle">${sel.name}</h3>
        <p class="ckind">${areaName ? html`${areaName} · ` : null}${sel.kind} · ${sel.weight} pts ${this._renderCityStatusBadge(sel)}</p>
        ${this._renderCityTabs(sel)}
      </div>
    </aside>`;
  }

  /** Cuerpo del panel de casa en PESTAÑAS (RMR-TSK-0256): una sección a la vez,
   *  para que quepa en el pergamino sin scroll. */
  _renderCityTabs(sel) {
    const tab = this._cityTab;
    const TABS = [
      ['what', 'Qué es'], ['learn', 'Aprender'], ['resources', 'Recursos'],
      ['crew', 'Tripulación'], ['certify', 'Certificarte'],
    ];
    return html`
      <div class="ctabs" role="tablist" aria-label="Secciones de la casa">
        ${TABS.map(([id, label]) => html`
          <button role="tab" aria-selected=${tab === id} class=${tab === id ? 'on' : ''}
            @click=${() => { this._cityTab = id; }}>${label}</button>`)}
      </div>
      <div class="cbody" role="tabpanel">
        ${tab === 'what' ? this._renderCityWhat(sel) : null}
        ${tab === 'learn' ? html`${this._renderCityLearn(sel)}${this._renderCityAiFocus(sel)}` : null}
        ${tab === 'resources' ? this._renderCityResources(sel) : null}
        ${tab === 'crew' ? this._renderCityReferences(sel) : null}
        ${tab === 'certify' ? this._renderCityCertificate(sel) : null}
      </div>
    `;
  }

  /** Etiqueta de la opción del selector: marca a los externos (no tienen carrera). */
  static _personOptionLabel(p) {
    return p.external ? `${p.name} (externo)` : p.name;
  }

  _renderPersonSelect() {
    // El ingeniero juega SU plan (JG-1): con una sola persona (la suya) el
    // selector es ruido de gestión de equipo — no se pinta.
    if (this.canPlay && (this.people ?? []).length === 1) return null;
    // Los externos aparecen DESHABILITADOS: no tienen carrera/mapa (solo datos y
    // O2O), así que no son un destino válido del Mapa de Carrera.
    return html`<label>Persona
      <select @change=${this._changePerson}>
        <option value="" ?selected=${!this.personId}>— Elige una persona —</option>
        ${(this.people ?? []).map(
          (p) => html`<option
            value=${p.id}
            ?selected=${p.id === this.personId}
            ?disabled=${p.external}
          >${CareerApp._personOptionLabel(p)}</option>`,
        )}
      </select>
    </label>`;
  }

  render() {
    if (this.error && !this.store) return html`<p class="error">${this.error}</p>`;
    if (!this.store) return html`<p class="empty">Cargando…</p>`;

    if (!this.personId) {
      return html`
        <div class="bar"><div class="controls">${this._renderPersonSelect()}</div></div>
        ${this.error ? html`<p class="error">${this.error}</p>` : null}
        <p class="empty">Elige una persona de tu equipo para ver y editar su mapa de carrera en la isla.</p>
      `;
    }

    if (this.loading || !this.map) {
      return html`
        <div class="bar"><div class="controls">${this._renderPersonSelect()}</div></div>
        <p class="empty">Cargando el mapa de esta persona…</p>
      `;
    }

    const map = this._map;
    const s = stats(map, this.journey);
    // Progresión del archipiélago (MC-20): del journey global y el índice ya
    // cargado para el mapa del mar (nada de leer los 13 docs de isla).
    const prog = this.archipelago ? archipelagoProgress(this.journey, this.archipelago.islands) : null;
    // La selección puede venir del plano y ser de OTRA isla (JG-11): su
    // tarjeta se resuelve contra el mapa que la contiene, no el actual.
    const selMap = this._selectedMap;
    const sel = this.selected ? selMap.cities.find((c) => c.id === this.selected) : null;
    const selAreaName = sel ? selMap.areas.find((a) => a.id === sel.area)?.name : null;
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
              <div class="controls">
                ${this._renderViewSwitch()}
                ${this._renderChallengeModeButton()}
                ${this._renderRouteButton()}
                ${this._renderArchipelagoButton()}
                ${this._renderPlayerCardButton()}
                ${this._renderLogbookButton()}
                ${this._renderCarpoolButton()}
                ${this._renderCoinsButton()}
                ${this._renderWizardQueueButton()}
                ${this._renderPlaytimeButton()}
                ${this._renderPersonSelect()}
              </div>
              ${prog || this._activeCarpools.at(0) || this._challenge
                ? html`<div class="hudline">
                    ${this._renderChallengeHudChip()}
                    ${this._renderCarpoolHudStat()}
                    ${this._renderProgressHud(prog, s)}
                  </div>`
                : null}
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
              .carpoolStops=${this.carpoolStops}
              .challengeStops=${this._challenge3d}
              .routeStops=${this._route3d}
              .guideCityId=${this._guideCityId}
              .overlayOpen=${Boolean(this.selected) ||
              this.showArchipelago ||
              this.showPlayerCard ||
              this.showWizard ||
              this.showWizardQueue ||
              this.showPlaytime ||
              this.showCarpools ||
              this.showChallenges ||
              this.showRoute ||
              this.showLogbook ||
              this.showCoins}
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
                  >Salir (Esc)</button><button
                    @click=${this._enterImmersive}
                    title="Captura el ratón para mirar moviéndolo, sin arrastrar (Escape lo suelta y vuelve al cursor libre)"
                  >🎮 Inmersivo</button>${this._renderArchipelagoButton()}${this._renderPlayerCardButton()}${this._renderAudioButton()}`
                : html`
                    <button
                      @click=${this._focusOverview}
                      title="Volver a la vista aérea de toda la isla"
                    >Isla completa</button>
                    ${this._renderWalkButton()}
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
        : null}
      ${this.viewMode === 'flat'
        ? html`<div class="grid">
        <career-map
          .archipelago=${this.archipelago}
          .islandMaps=${this.planoMaps}
          .journey=${this.journey}
          .selected=${this.selected}
          @select-city=${this._onSelect}
        ></career-map>

        <div class="panel">
          ${sel
            ? this._renderPlanoPanel(sel, selAreaName)
            : html`<p class="hint">Haz clic en una casa de la isla para ver su tarjeta: qué es, qué aprenderás y cómo certificarte.</p>`}
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
      </div>`
        : null}
      ${this.viewMode === 'list'
        ? html`<div class="grid listgrid">
            <career-list
              .archipelago=${this.archipelago}
              .islandMaps=${this.planoMaps}
              .journey=${this.journey}
              .routeCityIds=${this._listRouteCityIds}
              .endorsements=${this.endorsements}
              .selected=${this.selected}
              @select-city=${this._onSelect}
            ></career-list>
            <div class="panel">${this._renderListPanel(sel, selAreaName)}</div>
          </div>`
        : null}
      ${this._renderArchipelago()}
      ${this._renderChallenges()}
      ${this._renderRouteManager()}
      ${this._renderPlayerCard()}
      ${this._renderLogbook()}
      ${this._renderWizard()}
      ${this._renderWizardQueue()}
      ${this._renderPlaytimeSummary()}
      ${this._renderCarpools()}
      ${this._renderCoins()}
      ${this._renderTravelFade()}
      ${this._renderRouteComplete()}
      ${this._renderAnnouncement()}
    `;
  }
}

if (!customElements.get('career-app')) {
  customElements.define('career-app', CareerApp);
}
