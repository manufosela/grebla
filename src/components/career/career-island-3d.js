/**
 * <career-island-3d>
 * Render 3D REAL de la isla de carrera con Three.js (MC-5: fundación;
 * MC-6: zoom animado a ciudad/comarca; MC-7: primera persona; MC-8: pulido;
 * MC-9: puerto reconocible, fachadas hacia el puerto y entrar en las casas;
 * MC-11: celebración de ciudadanía y sonido de la isla).
 *
 * Es intercambiable con <career-map> (vista plana): mismas propiedades y el
 * mismo evento `select-city`. La escena se GENERA del modelo (/careerMap/island)
 * con geometrías low-poly de código, sin assets externos:
 *  - isla (playa + hierba), agua y cielo/niebla
 *  - una plataforma sutil por comarca con su etiqueta flotante
 *  - una casa por ciudad, coloreada por estado, con puerta, placa con el
 *    nombre sobre la puerta, ventanas emisivas y variación determinista por id
 *    (altura/rotación/tono vía cityVariant: nada de Math.random()); la fachada
 *    mira HACIA el puerto (facadeYawToward, MC-9): llegando desde el mar las
 *    puertas y placas se ven de frente
 *  - senda del camino recorrido (cinta) y ruta planificada (línea discontinua)
 *  - puerto de inicio reconocible (MC-9): muelle de tablones de madera clara
 *    sobre postes que se adentra en el agua, faro blanco con franjas rojas
 *    (galería, linterna cálida emisiva y cúpula) y barca low-poly amarrada
 *
 * Three.js se carga por IMPORT DINÁMICO al montar el componente: el resto de la
 * app no paga el bundle. Si WebGL no está disponible se emite `webgl-unavailable`
 * para que <career-app> caiga a la vista plana.
 *
 * Cámara aérea orbital (OrbitControls): orbitar, panear y zoom con límites sanos
 * (nunca por debajo del horizonte, distancia acotada por el radio de la isla).
 *
 * Reconstrucción: al cambiar `journey`/`reachable`/`selected` se reconstruye
 * SOLO el grupo de ciudades (decenas de meshes, coste trivial); la parte
 * estática (isla/agua/comarcas/puerto) solo se reconstruye si cambia el mapa.
 * Se eligió rebuild simple del grupo frente a mutar materiales in situ por
 * claridad: el estado visual siempre es función pura del modelo.
 *
 * Picking (MC-6): clic (sin arrastre) sobre una ciudad → emite `select-city` Y
 * anima la cámara hasta ella (el zoom lo hace ESTE componente, no el contenedor,
 * para evitar dobles animaciones); clic sobre la plataforma de una comarca →
 * zoom a la comarca (sin evento); clic en agua/vacío → nada (no se deselecciona).
 *
 * Zoom animado: `focusCity(id)`, `focusArea(id)` y `focusOverview()` interpolan
 * posición de cámara y `controls.target` (easeInOutCubic, FOCUS_ANIM_MS) dentro
 * del loop rAF existente. Cualquier input del usuario sobre los OrbitControls
 * (evento 'start': arrastre, rueda, touch) cancela la animación en curso.
 *
 * Primera persona (MC-7, rediseñada en JG-3): `enterFirstPerson()` baja la
 * cámara con transición hasta la altura de ojos (puerto o ciudad actual del
 * journey) y activa los controles tipo DOOM por teclado (MC-8): ←/→ GIRAN
 * sobre uno mismo (turnYaw, puro), ↑/↓ y W/S avanzan/retroceden, A/D hacen
 * strafe y con Shift se corre. Por defecto el modo a pie es LIBRE (JG-3): SIN
 * pointer lock, con el cursor visible — los botones del HUD funcionan y las
 * tarjetas se cierran con ✕ siempre. Se mira MANTENIENDO pulsado el botón
 * izquierdo y ARRASTRANDO sobre el canvas (dragLook puro: metáfora de «agarrar
 * el mundo», mismos topes de pitch que el teclado) con cursor grab/grabbing; un
 * CLIC corto y quieto (< DRAG_THRESHOLD px y < FPS_CLICK_MAX_MS) sobre una
 * casa/compañero/brujo/barca interactúa (raycast) — un arrastre JAMÁS abre
 * nada. El pointer lock queda como «🎮 Modo inmersivo» OPT-IN
 * (`enterImmersive()`, botón HUD de <career-app>): mouse-look continuo con
 * crosshair; Escape (nativo del lock) o abrir cualquier panel lo sueltan y
 * DEVUELVEN al modo libre — nunca hay re-captura automática. A pie las
 * etiquetas flotantes se ocultan (el nombre se lee en la placa de la puerta y
 * en el prompt de proximidad). La lógica de marcha es pura y compartida con el
 * terreno (walk.js): groundHeightAt pega la cámara al MISMO suelo que pintan
 * las mallas y stepPosition acota el paso a la isla deslizando por la costa.
 * Cada ~100 ms se muestrea la ciudad cercana: se resalta (emisivo, como
 * selected) y un prompt ofrece [E]/clic → `select-city`.
 *
 * Entrar en las casas (MC-9): las casas NO se atraviesan (collideWithCities,
 * puro: deslizamiento por el contorno). Un empuje FRONTAL contra una casa
 * «entra»: se abre su panel de ciudadanía (mismo flujo que la tecla E) con el
 * jugador detenido en la puerta y `_insideCityId` recordando la casa. Con ese
 * panel abierto, ↓ o S (si el foco no está en un campo del panel) cierran el
 * panel y retroceden unos pasos; el ✕/Escape del panel también limpian
 * `_insideCityId` (vía la propiedad `selected` a null). Escape (en modo libre)
 * o `exitFirstPerson()` vuelven, con transición, a la vista aérea.
 * `mode-change {mode:'fps'|'aerial'}` avisa a <career-app>.
 * Pensado para escritorio: en táctil el HUD no ofrece el botón de entrada.
 *
 * Jugabilidad 100% teclado (MC-18): en fps las teclas mandan CON y SIN pointer
 * lock. Q/Re Pág y E/Av Pág inclinan la mirada (tiltPitch puro, mismos topes
 * polares que el ratón); la marcha, el giro, la mirada y [E] funcionan siempre
 * salvo con un overlay DOM abierto encima (prop `overlayOpen`, puesta por
 * <career-app>: panel de ciudadanía o archipiélago) o escribiendo en un campo
 * (_isTypingTarget).
 *
 * Avatar en vista aérea (MC-10): un personajillo low-poly (piernas navy,
 * cuerpo teal, gorra coral: colores GREBLA) SIEMPRE visible en la vista aérea
 * que se mueve con WASD/flechas usando LA MISMA lógica pura del modo a pie
 * (stepPosition, groundHeightAt, collideWithCities, walkableRadius): rota
 * hacia su dirección de marcha (yawToward, puro) con animación procedural de
 * zancada (balanceo de piernas/brazos + rebote, en función de la distancia
 * recorrida — nada de rigs ni RNG). Mientras camina, el target de los
 * OrbitControls (y la cámara con él) lo SIGUE con un lerp suave; el usuario
 * puede orbitar/zoomear a la vez, y cualquier focusCity/focusArea/focusOverview
 * manda: el follow se pausa hasta que el avatar vuelva a moverse. El choque
 * FRONTAL contra una casa abre su ciudadanía (mismo `_insideCityId` de MC-9,
 * sin pointer lock: el teclado ya está libre) y ↓/S retrocede y cierra. Al
 * entrar en primera persona el avatar se OCULTA (la cámara ES el avatar y
 * parte de su posición); al salir reaparece donde estaba la cámara.
 *
 * Salto gráfico (MC-10), todo procedural y determinista (sin Math.random ni
 * assets externos):
 *  - texturas CanvasTexture cacheadas (userData.shared): hierba y arena
 *    moteadas, tablones de pared (base clara que TINTA el color de estado),
 *    tejas del tejado, veta de madera para puertas y muelle
 *  - vegetación y props con InstancedMesh: coníferas (conos apilados),
 *    frondosos (copa achatada), rocas (icosaedros a escala no uniforme) y
 *    flores junto a las casas — posiciones de scatterPositions (walk.js, puro)
 *    con exclusiones de casas, puerto y senda del journey vigente
 *  - agua VIVA: plano subdividido con ondulación senoidal de vértices en el
 *    loop y cinta de espuma clara siguiendo la línea de costa (coastFactor)
 *  - cielo: cúpula con gradiente por vertex colors + nubes sprite con deriva
 *    lentísima; la niebla funde el horizonte con el color del propio cielo
 *  - sombras suaves: shadow map PCF de 1024 con borde difuminado (radius)
 *    SOLO en el sol direccional — PCFSoftShadowMap está deprecado en three
 *    0.185 — (casas, árboles, rocas y avatar proyectan; terreno y plataformas
 *    reciben). El flag SHADOWS.enabled permite apagarlas si algún hardware sufre.
 *
 * Celebración de ciudadanía (MC-11): cuando el journey cambia y el diff de
 * visitedCities dice que una ciudad ACABA de pasar a visitada (justVisitedCity,
 * puro — y solo si es la ciudad del panel abierto: cargar el journey de otra
 * persona no celebra nada), sobre su casa se dispara una celebración de ~2 s:
 * pulso emisivo dorado en las paredes, confeti instanciado con colores GREBLA
 * (trayectorias DETERMINISTAS de hash+índice, celebration.js) y fanfarria
 * (islandAudio). Funciona en vista aérea y a pie (si la casa está a la vista).
 * Además la placa de la puerta de las casas VISITADAS es DORADA de forma
 * permanente: el distintivo de ciudadano.
 *
 * Compañeros del equipo (MC-12): la prop `teammates` ({personId, name,
 * currentCity, progressPct}, SOLO esos datos: privacidad) pinta un avatar por
 * compañero junto a su casa actual — figura del avatar propio con camiseta y
 * gorra deterministas por personId (teammateTint, sin la gorra coral propia),
 * repartidos en arco frente a la fachada (teammateOffsets) para que varios en
 * la misma ciudad no se solapen, mirando hacia fuera. Nombre en sprite sobre
 * la cabeza con fundido por distancia (a pie, solo a corta distancia) e idle
 * de balanceo procedural con fase por hash. Clic sobre un compañero (raycast
 * en aérea; desde la mira en fps, soltando el lock como el panel) emite
 * `select-teammate {personId, x, y}` para que <career-app> muestre su
 * mini-resumen. El grupo se reconstruye al cambiar la prop, con dispose limpio
 * y materiales/geometrías compartidos por build.
 *
 * Guía de objetivo y minimapa (MC-13):
 *  - las ciudades con visado DISPONIBLE (estado 'available') llevan una baliza:
 *    haz de luz coral vertical SUTIL y pulsante (más estrecho y tenue que el de
 *    la ciudad actual, con fase determinista por hashId — nada de RNG), visible
 *    en vista aérea y a pie; la ciudad actual conserva su haz intenso y no
 *    recibe baliza (su marcador manda)
 *  - la ruta planificada gana presencia: bajo la línea discontinua navy va una
 *    cinta translúcida del mismo color (ribbonStrip compartido con la senda)
 *  - minimapa a pie estilo DOOM: disco Canvas 2D (overlay esquina inferior
 *    izquierda, solo en modo fps) con NORTE FIJO — la silueta de la isla sale
 *    del MISMO perfil de costa (coastFactor/TERRAIN de walk.js), casas como
 *    puntos con su color de estado, puerto, senda de visitadas, compañeros como
 *    puntitos neutros y tu posición como flecha orientada por el yaw de la
 *    cámara (minimapProject/minimapHeading, puros). La capa estática (isla,
 *    casas, senda) se pre-pinta en un canvas offscreen al cambiar el journey y
 *    se compone cada ~MINIMAP.redrawMs con la capa dinámica (flecha, equipo).
 *
 * Archipiélago (MC-14): la BARCA del muelle es la puerta a las demás islas —
 * clicable en vista aérea (raycast, como las casas) y con prompt «[E] Zarpar»
 * al acercarse a pie (radio propio, mayor que el de ciudades: la barca flota
 * fuera del área caminable). Ambas vías emiten `open-archipelago`; el mapa del
 * mar (overlay DOM) y el viaje los gestiona <career-app> — aquí solo se
 * detecta el gesto (a pie soltando el lock a propósito, como el panel de
 * ciudadanía). Una isla SIN ciudades (placeholder «En construcción», aún sin
 * contenido) se genera igual que cualquier otra (terreno + puerto) y añade un
 * cartel de obra junto al puerto.
 *
 * La CABAÑA DEL BRUJO (MC-22): cada isla tiene una edificación SINGULAR —
 * torre cónica púrpura con estrellas (CanvasTexture), tejado ladeado, farol y
 * cartel «El brujo» — donde el jugador deja consultas asíncronas al líder. Su
 * posición es determinista y cercana al puerto (wizardSpot, puro: barrido de
 * candidatos con holgura a todas las casas) y entra en las exclusiones de la
 * vegetación. La prop `wizardState` pinta el INDICADOR de estado: 'none' =
 * humo gris tenue saliendo de la chimenea; 'pending' = farol ÁMBAR pulsante;
 * 'ready' = farol VIOLETA brillante con un destello (JG-8). Todo barato: materiales
 * emisivos y tres esferitas de humo animadas en el loop, sin partículas. La
 * interacción calca la de las casas: clic en vista aérea (raycast, como la
 * barca), prompt «[E] El brujo» y choque frontal a pie/avatar — todas las vías
 * emiten `open-wizard` y el panel DOM lo gestiona <career-app>. El grupo de la
 * cabaña se rehace solo (al cambiar `wizardState` o el mapa), sin tocar el
 * grupo estático ni el de ciudades.
 *
 * Vallas TRIBBU (MC-23): 2-3 vallas publicitarias low-poly por isla — dos
 * postes de madera y un tablero ligeramente inclinado hacia el camino con la
 * marca TRIBBU pintada en CanvasTexture (pin + logotipo con tipografía
 * redondeada, teal sobre blanco; UNA textura cacheada compartida por todas).
 * Posiciones puras y deterministas (billboardSpots): flanquean la senda de
 * llegada cerca del puerto, con holgura a casas y a la cabaña del brujo, y
 * entran en las exclusiones de la vegetación. Decorativas: sin colisión ni
 * picking, visibles en vista aérea y a pie.
 *
 * Dirección de arte PIRATA (JG-7, espíritu Monkey Island), todo procedural y
 * determinista (hashUnit/hashId, sin Math.random ni assets externos):
 *  - terreno más rico: hierba tropical con moteado multi-tono y briznas, arena
 *    con conchas y ondas de marea (las MISMAS CanvasTexture compartidas de
 *    MC-10, repintadas), y un camino de tierra insinuado del muelle hacia el
 *    interior (ribbonStrip, como la senda, por debajo de senda y ruta)
 *  - PALMERAS como variante estrella de la costa: tronco curvado en segmentos
 *    y corona de hojas arqueadas low-poly, cada conjunto FUSIONADO
 *    (mergeGeometries de three/addons) en una única geometría → TODAS las
 *    palmeras de la isla son 2 draw calls (InstancedMesh); coníferas y
 *    frondosos quedan para el interior. Matas de hierba instanciadas (+1).
 *  - puerto pirata: barriles con duelas (InstancedMesh + textura 'barrel') y
 *    cajas apiladas junto al arranque del muelle, norays de amarre con una
 *    cuerda vencida, y la BANDERA PIRATA en lo alto del faro — paño con
 *    calavera (CanvasTexture 'jollyroger') que ondea por vértices en el loop,
 *    la misma mecánica que el agua
 *  - carteles de MADERA por comarca: poste con brazo y tablón colgante con el
 *    nombre QUEMADO en la madera (textura cacheada por nombre). El cartel da
 *    el topónimo DE CERCA (a pie las etiquetas flotantes se ocultan) y el
 *    sprite flotante SE CONSERVA para la lectura aérea y su declutter (MC-17):
 *    poste de cerca + sprite de lejos es más limpio que retirar el sprite
 *  - atardecer caribeño SUAVE: el horizonte del gradiente del cielo (y la
 *    niebla, que es su mismo color) vira a un melocotón cálido sin tocar el
 *    cénit — la legibilidad de casas y etiquetas no cambia
 *
 * Sonido (MC-11, islandAudio.js): ambiente de olas + gaviota ocasional, un
 * tick de paso por ZANCADA (fase ∝ distancia: el rate sigue a la velocidad,
 * tanto del avatar aéreo como del caminante fps) y la fanfarria de ciudadanía.
 * El AudioContext se crea/reanuda SOLO en gestos reales (pointerdown/keydown
 * → _audio.unlock()); el silencio persiste en localStorage y lo conmuta el
 * botón HUD de <career-app> vía setAudioMuted().
 *
 * Etiquetas legibles a cualquier zoom (MC-17, _updateLabels cada
 * LABEL_FADE_MS): cada sprite de etiqueta (ciudades, comarcas, puerto y
 * nombres de compañero) se re-escala por su profundidad de vista
 * (labelWorldScale, puro, con clamp) para mantener un alto APARENTE constante
 * en px (LABEL_PX por tipo), y un declutter puro por prioridad
 * (declutterLabels sobre las cajas proyectadas a pantalla, LABEL_PRIORITY)
 * decide la VISIBILIDAD: dos etiquetas nunca se pisan. Los fundidos por
 * distancia previos (MC-8/MC-12) quedan como mera atenuación de opacidad.
 *
 * Es un componente presentacional: no escribe en Firestore.
 */
import { LitElement, html, css } from 'lit';
import { cityStatus } from '../../tools/career/domain/progress.js';
import {
  LABEL_PRIORITY,
  labelWorldScale,
  labelScreenPx,
  declutterLabels,
} from '../../tools/career/domain/labels.js';
import {
  worldFromMap,
  cityStatusColor,
  areaLayout,
  islandRadius,
  cityFocusFrame,
  areaFocusFrame,
  cityVariant,
  facadeYawToward,
  journeyPathPoints,
  ribbonStrip,
  hashId,
  teammateOffsets,
  teammateTint,
  wizardSpot,
  billboardSpots,
  ACCENT_COLORS,
  STATUS_COLORS,
} from '../../tools/career/domain/islandLayout.js';
import {
  TERRAIN,
  coastFactor,
  groundHeightAt,
  walkableRadius,
  stepPosition,
  turnYaw,
  tiltPitch,
  dragLook,
  yawToward,
  nearestCityWithin,
  collideWithCities,
  hashUnit,
  scatterPositions,
  minimapProject,
  minimapHeading,
  WALK_SPEED,
  RUN_MULTIPLIER,
  TURN_SPEED,
  PITCH_SPEED,
  PITCH_LIMIT,
  DRAG_LOOK_SENSITIVITY,
  EYE_HEIGHT,
  PROXIMITY_RADIUS,
} from '../../tools/career/domain/walk.js';
import {
  CELEBRATION_VARIANTS,
  CONFETTI_COLOR_COUNT,
  justVisitedCity,
  confettiParticles,
  confettiPosition,
} from '../../tools/career/domain/celebration.js';
import { IslandAudio } from './islandAudio.js';

/**
 * Altura (y de mundo) de la superficie de hierba donde se asientan las
 * ciudades. Derivada del perfil compartido del terreno (walk.js).
 */
const GROUND_Y = TERRAIN.baseY + TERRAIN.grass.height / 2;
/** Dimensiones del hito de ciudad (casa low-poly). */
const CITY_BODY = { w: 2.6, h: 3.2 };
const CITY_ROOF = { r: 2.3, h: 2.2 };
/** Puerta de madera de la fachada y placa con el nombre sobre ella (MC-8). */
const CITY_DOOR = { w: 0.95, h: 1.5, d: 0.12 };
const CITY_PLATE = { w: 1.5, h: 0.5 };
/** Ventanas: planos emisivos suaves en fachada y costados. */
const CITY_WINDOW = { w: 0.55, h: 0.62 };
/** Elevación de los overlays del suelo (plataformas, senda, ruta) contra el z-fighting. */
const PATCH_LIFT = 0.1;
const PATH_LIFT = 0.18;
const ROUTE_LIFT = 0.24;
/** Anchura de la cinta del camino recorrido. */
const PATH_WIDTH = 1.2;
/** Fundido por distancia de las etiquetas de ciudad en vista aérea (× radio de isla). */
const LABEL_FADE = { near: 1.1, far: 2.0 };
/** Cadencia (ms) del muestreo de etiquetas (fundido + tamaño + declutter, MC-17). */
const LABEL_FADE_MS = 150;
/**
 * Alto APARENTE objetivo de cada tipo de etiqueta (px CSS del sprite, MC-17):
 * el muestreo re-escala cada sprite según su profundidad de vista
 * (labelWorldScale) para que en pantalla siempre mida esto, a cualquier zoom.
 * La comarca va algo mayor que la ciudad (topónimo estructural) y el nombre
 * de compañero menor (rótulo personal). El texto ocupa ~2/3 del alto del
 * sprite (fuente de 44px en un canvas de 68px, _makeLabel).
 */
const LABEL_PX = Object.freeze({ area: 30, city: 24, teammate: 19 });
/**
 * Clamp de la escala de mundo resultante (unidades, MC-17): `min` evita
 * sprites degenerados pegados a la cámara; `max` que un zoom-out extremo
 * llene la isla de rótulos gigantes (a partir de ahí encogen en pantalla).
 */
const LABEL_WORLD_CLAMP = Object.freeze({ min: 0.5, max: 12 });
/** Umbral (px de cliente) para distinguir un arrastre (órbita o mirada a pie) de un clic. */
const DRAG_THRESHOLD = 5;
/**
 * Duración máxima (ms) de un CLIC de interacción en el modo a pie libre
 * (JG-3): pointerdown→pointerup más largos (o con más desplazamiento que
 * DRAG_THRESHOLD) son un arrastre de mirada y JAMÁS abren tarjetas.
 */
const FPS_CLICK_MAX_MS = 400;
/** Límite del paneo del target respecto al radio de la isla. */
const PAN_LIMIT_FACTOR = 1.2;
/** Duración (ms) de las animaciones de foco de cámara (zoom a ciudad/comarca/vista general). */
const FOCUS_ANIM_MS = 700;
/** Duración (ms) de las transiciones de entrada/salida del modo primera persona. */
const FPS_ANIM_MS = 1200;
/** Cadencia (ms) del muestreo de proximidad a ciudades al caminar. */
const PROXIMITY_CHECK_MS = 100;
/**
 * Proximidad a la BARCA del muelle a pie (MC-14): la barca flota al final del
 * muelle, fuera del radio caminable (el caminante no pisa el agua), así que su
 * radio es mayor que el de ciudades — basta acercarse al arranque del muelle
 * para que salga el prompt «[E] Zarpar».
 */
const BOAT_PROXIMITY_RADIUS = 12;
/** Color de la vela de pergamino del barquito pirata amarrado (JG-24). */
const PARCH_SAIL = 0xf1e4c3;
/** Guardián de tiempo (s) del autopiloto a pie (JG-21): si no llega, se rinde. */
const AUTOWALK_TIMEOUT_S = 30;
/** Distancia (unidades) delante de la puerta a la que el autopiloto se coloca antes de entrar (JG-25 fix). */
const AUTOWALK_APPROACH = CITY_COLLIDER_RADIUS + 2.5;
/** El autopiloto solo AVANZA cuando el rumbo al objetivo está dentro de este ángulo (rad): gira primero. */
const AUTOWALK_FACING = 0.35;
/** Distancia (unidades) del cartel «En construcción» hacia el interior desde el puerto (MC-14). */
const SIGN_INLAND_OFFSET = 10;
/** Distancia (unidades) a la que se aparece frente a la ciudad actual del journey. */
const CITY_SPAWN_OFFSET = 12;
/** Distancia del punto de mira usado como origen del giro de cámara al salir del modo fps. */
const EXIT_LOOK_AHEAD = 30;
/**
 * Radio de colisión de una casa a pie (MC-9): semidiagonal de la planta de la
 * casa (cubre las esquinas gire como gire la fachada) más una holgura para el
 * cuerpo del caminante. La planta es constante (solo varía la altura por
 * cityVariant), así que un único radio vale para todas.
 */
const CITY_COLLIDER_RADIUS = Math.hypot(CITY_BODY.w, CITY_BODY.w) / 2 + 0.65;
/**
 * Escala del yaw extra determinista de cityVariant (±0.3 rad) al orientar las
 * fachadas hacia el puerto (MC-9): la variación queda en ±0.15 rad — las casas
 * no son clónicas pero la puerta se sigue viendo llegando desde el puerto.
 */
const FACADE_JITTER = 0.5;
/** Paso atrás (unidades) al salir de una casa dando hacia atrás (↓/S, MC-9). */
const CITY_EXIT_BACKSTEP = 3;
/** Colores del entorno (cielo, agua, arena, hierba, maderas, faro, barca, puertas y ventanas). */
const ENV_COLORS = {
  sky: 0xdceff5,
  water: 0x4d90c4,
  sand: 0xe9dcae,
  grass: 0x9fce8f,
  wood: 0x9a7b4f,
  plank: 0xd9b877,
  post: 0x7c5f3a,
  lighthouse: 0xf5f2ea,
  lighthouseRed: 0xc94f3f,
  boat: 0xf4f0e4,
  door: 0x6b4a26,
  window: 0xfff2c0,
  windowGlow: 0xf4c96b,
  // Vegetación y props (MC-10).
  conifer: 0x3f7d4f,
  leafy: 0x6da95d,
  rock: 0x9aa1a6,
  stem: 0x59915b,
  flowerCoral: 0xf2887a,
  flowerWarm: 0xf4c96b,
  // Arte pirata (JG-7): palmeras, camino de tierra y cuerdas del muelle.
  palmTrunk: 0xa9814f,
  palmLeaf: 0x4e9a4e,
  dirt: 0xb08a55,
  rope: 0xcbb287,
};
/**
 * Gradiente de la cúpula de cielo (MC-10); el horizonte es también el color de
 * la niebla. Desde JG-7 el horizonte vira a un melocotón CÁLIDO (atardecer
 * caribeño suave): el cénit sigue azul y el contraste de casas/etiquetas no
 * cambia — solo la franja baja del cielo y el fundido de la niebla.
 */
const SKY_COLORS = Object.freeze({ zenith: 0x8fcdea, horizon: 0xf8e6cd });
/**
 * Sombras suaves (MC-10): shadow map PCF SOLO en el sol direccional, con
 * resolución contenida y borde difuminado vía shadow.radius (PCFSoftShadowMap
 * está deprecado en three 0.185). Si algún hardware sufre, poner `enabled` a
 * false apaga todo el sistema (luz, casters y receivers) sin tocar nada más.
 */
const SHADOWS = Object.freeze({ enabled: true, mapSize: 1024, radius: 4 });
/**
 * Agua viva (MC-10): plano subdividido (lado sizeFactor·R) cuyos vértices
 * ondulan con un seno en el loop. La frecuencia es baja (olas largas) porque
 * la malla es gruesa: segmentos mucho menores que la longitud de onda.
 */
const WATER = Object.freeze({ sizeFactor: 22, segments: 40, amp: 0.12, freq: 0.045, speed: 0.5 });
/** Nubes billboard (MC-10): pocas, blancas y con deriva lentísima (unidades/s). */
const CLOUDS = Object.freeze({ count: 5, drift: 0.5 });
/** Avatar de la vista aérea (MC-10): dimensiones (unidades de mundo) y marcha. */
const AVATAR = Object.freeze({
  legH: 0.78,
  legW: 0.26,
  hipGap: 0.17,
  bodyW: 0.72,
  bodyH: 0.82,
  bodyD: 0.4,
  armH: 0.62,
  armW: 0.18,
  headS: 0.44,
  /** Velocidad (rad/s) del giro hacia la dirección de marcha (yawToward). */
  turnSpeed: 9,
  /** Fase de zancada acumulada por unidad de distancia recorrida. */
  stepFreq: 1.7,
  /** Amplitud (rad) del balanceo de piernas; los brazos van a contrapié. */
  swingAmp: 0.55,
  /** Rebote vertical del cuerpo por zancada (unidades). */
  bobAmp: 0.07,
  /** Constante (1/s) del lerp con el que la cámara sigue al avatar. */
  followRate: 3.5,
});
/** Colores del avatar: paleta GREBLA (teal/navy/coral) + piel cálida. */
const AVATAR_COLORS = Object.freeze({
  body: 0x2a9d8f,
  legs: 0x1e3a5f,
  skin: 0xf1c9a5,
  cap: 0xe26d5e,
});
/**
 * Compañeros del equipo en la isla (MC-12). Sus figuras reutilizan la geometría
 * del avatar propio con variación determinista por personId (teammateTint):
 * camiseta y gorra del hash — la gorra coral queda EXCLUSIVA del avatar propio.
 */
const TEAMMATE = Object.freeze({
  /** Fundido por distancia del nombre sobre la cabeza (unidades de mundo). */
  labelFadeAerial: Object.freeze({ near: 22, far: 44 }),
  /** A pie el nombre solo se ve a corta distancia (misma política que placas/prompts). */
  labelFadeFps: Object.freeze({ near: 8, far: 16 }),
  /** Altura (unidades) del nombre sobre los pies y escala del sprite. */
  labelY: 3.05,
  labelScale: 1.7,
  /** Balanceo idle: amplitudes (rad) de brazos y de la inclinación del cuerpo. */
  swayArm: 0.09,
  swayLean: 0.022,
  /** Velocidad angular (rad/s) base y variación determinista del balanceo. */
  swaySpeedBase: 0.9,
  swaySpeedJitter: 0.7,
  /** Alcance (unidades) del clic sobre un compañero desde la mira en modo fps. */
  fpsPickRange: 22,
});
/** Dorado de ciudadano (MC-11): placa de las casas visitadas y pulso emisivo. */
const CITIZEN_GOLD = 0xd4af37;
/**
 * Paleta del confeti de la celebración (MC-11): colores GREBLA + dorado. Su
 * longitud DEBE ser CONFETTI_COLOR_COUNT (celebration.js reparte los índices).
 */
const CONFETTI_COLORS = Object.freeze([0x2a9d8f, 0xf2887a, 0x1e3a5f, CITIZEN_GOLD]);
/** Tamaño (unidades) de cada plano de confeti. */
const CONFETTI_SIZE = Object.freeze({ w: 0.24, h: 0.15 });
/** Pico de intensidad del pulso emisivo dorado de la casa celebrada. */
const CELEBRATION_PULSE_PEAK = 0.85;
/** Frecuencia (Hz) del pulso emisivo (dos destellos por segundo). */
const CELEBRATION_PULSE_HZ = 2;
/**
 * Baliza de «visado disponible» (MC-13): haz coral vertical SUTIL y pulsante
 * sobre las ciudades con estado 'available'. Más estrecho, más bajo y mucho
 * más tenue que el haz de la ciudad actual (radio 0.9, opacidad 0.35) para
 * señalar el objetivo sin competir con él; el pulso es lento y su fase es
 * determinista por ciudad (hashId) para que no palpiten al unísono.
 */
const BEACON = Object.freeze({
  radius: 0.55,
  height: 24,
  opacityMin: 0.08,
  opacityMax: 0.22,
  speedHz: 0.35,
});
/**
 * Rango de opacidad REFORZADO de la baliza cuando la casa es la SIGUIENTE
 * parada del reto activo (JG-5): la misma baliza de «visado disponible», con
 * más presencia — el camino señala claramente a dónde ir. Solo cambia el
 * rango; velocidad y fase son las de BEACON.
 */
const BEACON_NEXT = Object.freeze({ opacityMin: 0.2, opacityMax: 0.5 });
/**
 * Rango de la baliza VERDE de una casa ya CERTIFICADA (JG-25): más tenue que la
 * coral de «disponible» — a pie se lee de un vistazo qué está hecho (verde) y
 * qué falta por hacer (coral); las bloqueadas no llevan baliza (aún no tocan).
 */
const BEACON_DONE = Object.freeze({ opacityMin: 0.05, opacityMax: 0.13 });
/**
 * Badge circular con el NÚMERO de parada de la ruta de reto (JG-5), pintado
 * en un canvas cuadrado (sprite): tamaño del lienzo en px de textura, alto
 * APARENTE objetivo en pantalla (px CSS, vía el muestreo de etiquetas MC-17)
 * y colores de la médula del juego por estado de la parada.
 */
const CHALLENGE_BADGE = Object.freeze({
  canvasPx: 96,
  targetPx: 26,
  colors: Object.freeze({
    next: '#e26d5e', // coral-600: la SIGUIENTE casa del camino
    pending: '#1e3a5f', // navy: paradas aún pendientes
    done: '#2a9d8f', // teal: paradas ya certificadas (✓)
  }),
});
/**
 * Badge circular con el número de parada de la RUTA LIBRE (JG-9): mismo
 * mecanismo que el del reto pero con acento PROPIO — fondo ámbar/dorado con
 * tinta navy (el reto usa fondos coral/navy/teal con tinta blanca), para que
 * ambos caminos no se confundan. El número es el orden GLOBAL de la ruta en el
 * archipiélago; las paradas ya certificadas llevan ✓ sobre ámbar claro. Con un
 * reto activo estos números NO se pintan (<career-app> pasa routeStops null):
 * los del reto mandan y la isla no se satura.
 */
const ROUTE_BADGE = Object.freeze({
  targetPx: 24,
  ink: '#1e3a5f', // navy: la tinta de la ruta personal
  colors: Object.freeze({
    pending: '#f2b632', // ámbar: paradas planificadas pendientes
    done: '#f8e3b0', // ámbar claro: paradas de la ruta ya certificadas (✓)
  }),
});
/**
 * Presencia de la ruta planificada en el suelo (MC-13): cinta navy translúcida
 * bajo la línea discontinua (ribbonStrip, el mismo mecanismo que la senda),
 * elevada entre la senda (PATH_LIFT) y la línea (ROUTE_LIFT) contra el
 * z-fighting. La línea sube además su opacidad (antes 0.55).
 */
const ROUTE_RIBBON = Object.freeze({ width: 0.9, opacity: 0.22, lift: 0.21 });
/** Opacidad de la línea discontinua de la ruta planificada (MC-13: antes 0.55). */
const ROUTE_DASH_OPACITY = 0.75;
/**
 * Banderola de parada de CARPOOL (CP-1): mástil navy con banderín coral junto
 * a la casa, acompañando al anillo coral exterior (el navy interior sigue
 * siendo el de la ruta planificada personal). offset = separación en x/z
 * locales para no atravesar la fachada.
 */
const CARPOOL_FLAG = Object.freeze({
  poleH: 7.2,
  pennantW: 1.5,
  pennantH: 0.85,
  offset: 2.4,
});
/**
 * Minimapa a pie (MC-13), estilo DOOM: disco de MINIMAP.size px de lado (CSS)
 * en la esquina inferior izquierda, SOLO en modo fps. Norte fijo (el mapa no
 * rota; rota la flecha del jugador). La capa estática (agua, silueta de isla,
 * senda, puerto y casas por estado) se pre-pinta en un canvas offscreen y se
 * compone con la dinámica (compañeros + flecha) cada redrawMs. Colores de la
 * paleta GREBLA; el agua es navy oscurecido translúcido para que el overlay no
 * tape la escena.
 */
const MINIMAP = Object.freeze({
  size: 180,
  redrawMs: 150,
  worldPad: 2, // respiro (unidades de mundo) alrededor de la playa
  cityDot: 3.5,
  currentRing: 6,
  portDot: 3,
  mateDot: 2.5,
  water: 'rgba(23, 48, 77, 0.78)',
  sand: '#e9dcae',
  grass: '#9fce8f',
  path: '#2a9d8f',
  port: '#1e3a5f',
  // Pizarra oscura: neutro pero distinguible de las casas bloqueadas (#d7dee2).
  mate: '#5b6b7d',
  player: '#f2887a',
  currentAccent: '#e26d5e',
  outline: 'rgba(255, 255, 255, 0.85)',
});

/**
 * La cabaña del BRUJO (MC-22): dimensiones de la torre cónica púrpura, farol
 * indicador y humo de reposo. `colliderRadius` cubre la planta (radio del
 * tejado) más holgura del caminante, como CITY_COLLIDER_RADIUS; el radio de
 * proximidad a pie es el mismo de las ciudades (PROXIMITY_RADIUS). Colores
 * del indicador: reposo gris, pendiente ÁMBAR, respuesta lista VIOLETA
 * místico (JG-8: la «luz» que el brujo promete encender — coherente con el
 * halo del mapa del tesoro). El pulso del farol y el humo se animan en
 * _tickWizard (barato: emisivos y tres esferitas).
 */
const WIZARD = Object.freeze({
  bodyR: 1.7,
  bodyH: 3,
  roofR: 2.15,
  roofH: 3.4,
  /** Inclinación (rad) del tejado: el toque «retorcido» del brujo. */
  roofTilt: 0.09,
  colliderRadius: Math.hypot(2.15, 2.15) / 2 + 0.65,
  colors: Object.freeze({
    roof: 0x3f2a66,
    star: 0xf4c96b,
    none: 0x8a8f98,
    pending: 0xf4a53b,
    ready: 0x9d4edd,
    smoke: 0xb7bcc2,
  }),
  /** Farol junto a la puerta: radio, altura y poste. */
  lantern: Object.freeze({ r: 0.3, y: 2.1, postX: 1.9 }),
  /** Pulso del farol ÁMBAR (Hz) e intensidades emisivas por estado. */
  pulseHz: 0.9,
  emissive: Object.freeze({ none: 0.12, pendingMin: 0.25, pendingMax: 1, ready: 1.3 }),
  /** Humo de reposo: esferitas que suben riseS segundos hasta height unidades. */
  smoke: Object.freeze({ count: 3, riseS: 3.6, height: 2.8, r: 0.22, maxOpacity: 0.35 }),
  /** Destello del estado «respuesta lista»: tamaño y pulso del sprite. */
  sparkle: Object.freeze({ scale: 2.6, pulseHz: 0.6, opacityMin: 0.35, opacityMax: 0.9 }),
});

/**
 * Vallas publicitarias de TRIBBU (MC-23): tablero sobre dos postes de madera,
 * ligeramente inclinado hacia el camino (rotation.x del subgrupo del tablero),
 * con la marca pintada en CanvasTexture (una textura cacheada para TODAS las
 * vallas). Decorativas: sin colisión ni picking. `clearance` es el respiro que
 * la vegetación deja alrededor de cada valla; `avoidWizard` la holgura extra
 * con la cabaña del brujo al elegir posiciones.
 */
const BILLBOARD = Object.freeze({
  boardW: 4,
  boardH: 1.9,
  boardD: 0.12,
  faceW: 3.72,
  faceH: 1.66,
  postX: 1.5,
  postH: 3.1,
  postR: 0.13,
  boardY: 2.6,
  /** Inclinación (rad) del tablero hacia el camino (+z local mira al puerto). */
  tilt: 0.09,
  clearance: 3,
  avoidWizard: 4,
});

/** Colores de la marca TRIBBU en las vallas (teal/verde sobre blanco + coral). */
const TRIBBU_BRAND = Object.freeze({
  teal: '#2a9d8f',
  dark: '#1f7268',
  coral: '#f2887a',
  white: '#ffffff',
});

/**
 * Palmeras de costa (JG-7): tronco CURVADO en `segments` tramos (cilindros
 * cortos con deriva lateral cuadrática horneada en la geometría) y corona de
 * `leaves` hojas arqueadas low-poly (planos doblados a lo largo). Tronco y
 * corona se FUSIONAN (mergeGeometries) en una geometría cada uno: todas las
 * palmeras de la isla suman 2 draw calls (InstancedMesh). `coastBand` es la
 * fracción del radio de dispersión a partir de la cual un árbol es palmera
 * (la franja costera) en vez de conífera/frondoso (el interior).
 */
const PALM = Object.freeze({
  segments: 4,
  segmentH: 1.05,
  baseR: 0.22,
  topR: 0.13,
  /** Deriva lateral total (unidades) de la punta del tronco (+x local). */
  lean: 0.55,
  leaves: 6,
  leafLen: 2.3,
  leafW: 0.5,
  /** Subdivisiones a lo largo de cada hoja (el arco se dobla por vértices). */
  leafSteps: 4,
  /** Caída (unidades) de la punta de la hoja: sube un poco y luego se vence. */
  droop: 1.15,
  coastBand: 0.68,
});
/** Matas de hierba (JG-7): manojo de conos finos fusionados, instanciado. */
const TUFT = Object.freeze({ blades: 3, h: 0.42, r: 0.045, spread: 0.09 });
/**
 * Camino de tierra insinuado (JG-7): cinta translúcida del arranque del
 * muelle hacia el interior (ribbonStrip, como la senda), con una comba
 * lateral determinista para que no sea una regla. Va por DEBAJO de senda y
 * ruta (lift menor que PATH_LIFT) y de las plataformas de comarca.
 */
const DIRT_PATH = Object.freeze({
  width: 1.6,
  opacity: 0.45,
  lift: 0.07,
  /** Longitud como fracción de la distancia puerto→centro. */
  lenFactor: 0.6,
  steps: 6,
  /** Amplitud máxima (unidades) de la comba lateral. */
  swayAmp: 3,
});
/**
 * Atrezzo pirata del muelle (JG-7): barriles y cajas apilados en dos grupos a
 * los lados del ARRANQUE del muelle (coordenadas locales del puerto, +z hacia
 * el mar; lz negativos = tierra adentro), y dos norays de amarre en el borde
 * del tablero con una cuerda vencida entre ellos. Posiciones fijas y
 * deterministas; decorativo (sin colisión ni picking) y barato: 4 draw calls.
 */
const PORT_PROPS = Object.freeze({
  barrelR: 0.42,
  barrelH: 0.85,
  /** Barriles: posición local, giro y escala; `stacked` = encima de otros. */
  barrels: Object.freeze([
    Object.freeze({ lx: 2.5, lz: -0.9, ry: 0.3, s: 1 }),
    Object.freeze({ lx: 3.35, lz: -0.4, ry: 1.8, s: 0.92 }),
    Object.freeze({ lx: 2.9, lz: -0.6, ry: 0.9, s: 0.9, stacked: true }),
    Object.freeze({ lx: -2.6, lz: -1.7, ry: 2.4, s: 1 }),
    Object.freeze({ lx: -3.3, lz: -1, ry: 0.6, s: 0.9 }),
  ]),
  crateS: 0.78,
  crates: Object.freeze([
    Object.freeze({ lx: 1.9, lz: -2.1, ry: 0.2, s: 1 }),
    Object.freeze({ lx: 2.75, lz: -2.4, ry: 0.7, s: 0.85 }),
    Object.freeze({ lx: 2.25, lz: -2.2, ry: 1.2, s: 0.78, stacked: true }),
  ]),
  /** Norays: postes bajos de amarre en el borde del muelle (lx fijo). */
  bollardR: 0.14,
  bollardH: 0.55,
  bollardLx: 1.45,
  bollardsLz: Object.freeze([2.2, 7.4]),
  /** Cuerda entre norays: comba (unidades) y radio del tubo. */
  ropeSag: 0.5,
  ropeR: 0.045,
});
/**
 * Bandera pirata (JG-7): mástil fino sobre la cúpula del faro y paño con
 * calavera (CanvasTexture 'jollyroger'). El paño es un plano subdividido
 * cuyos vértices ondean con un seno en _tickEnvironment — la MISMA mecánica
 * que el agua — con amplitud creciente hacia el borde libre (el lado del
 * mástil no se mueve).
 */
const PIRATE_FLAG = Object.freeze({
  poleH: 1.5,
  poleR: 0.05,
  w: 1.5,
  h: 0.95,
  segX: 8,
  segY: 3,
  waveAmp: 0.09,
  waveFreq: 4.2,
  waveSpeed: 3.1,
});
/**
 * Cartel de comarca (JG-7): poste de madera con brazo y tablón COLGANTE (dos
 * cadenitas) con el nombre QUEMADO en la madera (textura cacheada por
 * nombre en _plateTextures). Da el topónimo DE CERCA — a pie las etiquetas
 * flotantes van ocultas —; el sprite flotante se conserva para la vista
 * aérea y su declutter (MC-17). `inset` sitúa el poste hacia el borde de la
 * plataforma de la comarca, mirando al puerto. Decorativo: sin colisión.
 */
const AREA_SIGN = Object.freeze({
  postH: 3.3,
  postR: 0.11,
  armLen: 1.7,
  armR: 0.07,
  armY: 3.05,
  plankW: 1.9,
  plankH: 0.62,
  plankD: 0.08,
  /** Caída (unidades) de las cadenitas entre el brazo y el tablón. */
  chainDrop: 0.32,
  /** Posición radial del poste dentro de la plataforma (fracción del radio). */
  inset: 0.62,
  /** Holgura con casas/brujo al elegir el punto (barrido de yaws si choca). */
  clearance: 1.2,
});

export class CareerIsland3D extends LitElement {
  static properties = {
    map: { attribute: false },
    journey: { attribute: false },
    reachable: { attribute: false },
    selected: { attribute: false },
    carpoolStops: { attribute: false },
    challengeStops: { attribute: false },
    routeStops: { attribute: false },
    guideCityId: { attribute: false },
    teammates: { attribute: false },
    overlayOpen: { attribute: false },
    wizardState: { attribute: false },
    _phase: { state: true },
    _mode: { state: true },
    _fpsLocked: { state: true },
    _fpsDragging: { state: true },
    _nearCityId: { state: true },
    _insideCityId: { state: true },
    _nearBoat: { state: true },
    _nearWizard: { state: true },
  };

  static styles = css`
    :host { display: block; height: 100%; min-height: 320px; }
    .wrap {
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: var(--rm-radius, 12px);
      overflow: hidden;
      background: #dceff5;
      border: 1px solid var(--rm-border, #e5e7eb);
    }
    canvas { width: 100%; height: 100%; display: block; touch-action: none; }
    /* Modo a pie LIBRE (JG-3): el cursor invita a arrastrar para mirar. */
    .wrap.fps-free canvas { cursor: grab; }
    .wrap.fps-free.dragging canvas { cursor: grabbing; }
    .overlay {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      text-align: center;
      padding: 1rem;
      color: var(--rm-muted, #6b7280);
      font-weight: 600;
      background: rgba(220, 239, 245, 0.75);
    }
    .overlay.error { color: var(--rm-danger, #dc2626); }
    /* --- Modo primera persona (MC-7) --- */
    .crosshair {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 16px;
      height: 16px;
      transform: translate(-50%, -50%);
      pointer-events: none;
      opacity: 0.75;
    }
    .crosshair::before,
    .crosshair::after {
      content: '';
      position: absolute;
      background: #fff;
      box-shadow: 0 0 3px rgba(17, 24, 39, 0.65);
    }
    .crosshair::before { left: 50%; top: 0; width: 2px; height: 100%; transform: translateX(-50%); }
    .crosshair::after { top: 50%; left: 0; height: 2px; width: 100%; transform: translateY(-50%); }
    .fps-hint {
      position: absolute;
      left: 50%;
      bottom: 1.1rem;
      transform: translateX(-50%);
      max-width: calc(100% - 2rem);
      padding: 0.45rem 0.9rem;
      border-radius: 999px;
      background: rgba(30, 58, 95, 0.82);
      color: #fff;
      font-family: var(--rm-font, system-ui, sans-serif);
      font-size: 0.85rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }
    .fps-hint kbd {
      display: inline-block;
      padding: 0 0.4rem;
      margin-right: 0.15rem;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.65);
      background: rgba(255, 255, 255, 0.14);
      font-family: inherit;
    }
    /* El prompt de ciudad cercana sube para dejar sitio a la ayuda de controles. */
    .fps-hint.near { bottom: 3.1rem; }
    /* --- Brújula de objetivo a pie (JG-21): chip arriba-centro con una flecha
       que apunta hacia la siguiente casa girando según hacia dónde miras. --- */
    .guide {
      position: absolute;
      top: 0.9rem;
      left: 50%;
      transform: translateX(-50%);
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.3rem 0.7rem 0.3rem 0.5rem;
      border-radius: 999px;
      background: rgba(11, 20, 34, 0.72);
      border: 1px solid rgba(255, 255, 255, 0.16);
      color: #e8eef7;
      font-size: 0.82rem;
      font-weight: 700;
      box-shadow: 0 2px 10px rgba(4, 10, 20, 0.45);
      backdrop-filter: blur(4px);
      pointer-events: none;
      white-space: nowrap;
    }
    .guide[hidden] { display: none; }
    .guide-arrow {
      display: inline-block;
      font-size: 1.05rem;
      line-height: 1;
      color: #f2887a;
      transition: transform 0.12s linear;
      will-change: transform;
    }
    .guide-label { color: #e8eef7; }
    .guide-label .dist { color: #a7bad3; font-weight: 600; margin-left: 0.3rem; }
    @media (prefers-reduced-motion: reduce) { .guide-arrow { transition: none; } }
    /* --- Minimapa a pie (MC-13): disco estilo DOOM, esquina inferior izquierda --- */
    .minimap {
      position: absolute;
      left: 0.9rem;
      bottom: 0.9rem;
      width: 180px;
      height: 180px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.75);
      box-shadow: 0 4px 14px rgba(17, 24, 39, 0.35);
      pointer-events: none;
    }
    .fps-help {
      position: absolute;
      left: 50%;
      bottom: 1.1rem;
      transform: translateX(-50%);
      max-width: calc(100% - 2rem);
      padding: 0.3rem 0.8rem;
      border-radius: 999px;
      background: rgba(17, 24, 39, 0.55);
      color: rgba(255, 255, 255, 0.92);
      font-family: var(--rm-font, system-ui, sans-serif);
      font-size: 0.72rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }
  `;

  constructor() {
    super();
    /** @type {import('../../tools/career/domain/types.js').CareerMap|null} */
    this.map = null;
    this.journey = { visitedCities: [], currentCity: null, plannedRoute: [], evidences: {} };
    this.reachable = [];
    this.selected = null;
    /**
     * Paradas del CARPOOL activo de la persona cargada que caen en ESTA isla
     * (CP-1): ids de ciudad a señalizar con la banderola navy+coral. La pone
     * <career-app> (union de sus carpools abiertos/llenos).
     * @type {string[]}
     */
    this.carpoolStops = [];
    /**
     * Ruta de RETO activa en ESTA isla (JG-5), o null en modo Libre (o con el
     * reto en otra isla): número de parada por casa y la SIGUIENTE casa del
     * camino. La pone <career-app> con identidad ESTABLE (solo cambia al
     * cambiar el journey/isla: este grupo no se rehace en cada render).
     * @type {{ numbers: Map<string, number>, nextCityId: string|null }|null}
     */
    this.challengeStops = null;
    /** Casa a la que la brújula de a pie apunta (JG-21): la siguiente parada
     * del reto o de la ruta, la señala <career-app>. Si hay autopiloto, manda
     * su objetivo. Solo se usa si la casa está en ESTA isla. */
    this.guideCityId = null;
    /**
     * Números de la RUTA LIBRE planificada (JG-9), o null sin ruta que numerar
     * (o con un reto activo: sus números mandan). Número de parada GLOBAL de
     * la ruta por casa — aquí solo se pintan las casas de ESTA isla, pero el
     * número conserva el orden del archipiélago. La pone <career-app> con
     * identidad ESTABLE (memoizada en su willUpdate, como challengeStops).
     * @type {Map<string, number>|null}
     */
    this.routeStops = null;
    /**
     * Compañeros del equipo a pintar junto a su casa actual (MC-12). SOLO
     * nombre, ciudad y % de progreso: el contenedor no pasa nada más.
     * @type {{ personId: string, name: string, currentCity: string, progressPct: number }[]}
     */
    this.teammates = [];
    /**
     * true con un overlay DOM del contenedor abierto encima (panel de
     * ciudadanía, archipiélago): la marcha por teclado SIN lock se pausa para
     * no pelear con la navegación del overlay (MC-18). La pone <career-app>.
     */
    this.overlayOpen = false;
    /** Fase del canvas: 'loading' | 'ready' | 'unsupported' | 'error'. */
    this._phase = 'loading';
    /** Módulo three (cargado dinámicamente). */
    this._THREE = null;
    this._renderer = null;
    this._scene = null;
    this._camera = null;
    this._controls = null;
    /** Grupo estático (isla, agua, comarcas, puerto): se rehace al cambiar el mapa. */
    this._staticGroup = null;
    /** Grupo de ciudades: se rehace al cambiar mapa/journey/reachable/selected. */
    this._citiesGroup = null;
    this._raf = 0;
    this._resizeObserver = null;
    this._lastMapId = null;
    this._islandR = 0;
    this._pointerDownAt = null;
    /**
     * Animación de foco de cámara en curso (o null). Se interpola en el loop
     * rAF y se cancela con cualquier input del usuario sobre los controles.
     * @type {{fromPos: object, toPos: object, fromTarget: object, toTarget: object, start: number}|null}
     */
    this._camAnim = null;
    /** Plataformas de comarca raycasteables (userData.areaId); se rehacen con el grupo estático. */
    this._areaPatches = [];
    /** Modo de cámara (MC-7): 'aerial' | 'to-fps' | 'fps' | 'to-aerial'. */
    this._mode = 'aerial';
    /** Clase PointerLockControls (import dinámico) e instancia perezosa. */
    this._PointerLockControls = null;
    this._plc = null;
    /** true mientras el puntero está capturado por el canvas (🎮 modo inmersivo, opt-in JG-3). */
    this._fpsLocked = false;
    /**
     * Arrastre de mirada en curso en el modo a pie LIBRE (JG-3), o null.
     * `moved` pasa a true al superar DRAG_THRESHOLD: a partir de ahí el gesto
     * es mirada y el pointerup NO interactúa.
     * @type {{ startX: number, startY: number, lastX: number, lastY: number, t: number, moved: boolean }|null}
     */
    this._fpsDrag = null;
    /** true con un arrastre de mirada activo (cursor grabbing, JG-3). */
    this._fpsDragging = false;
    /** Teclas de marcha actualmente pulsadas (por event.code). */
    this._keys = new Set();
    /** Ciudad dentro del radio de proximidad al caminar (o null). */
    this._nearCityId = null;
    /** true con el caminante junto a la barca del muelle (prompt «[E] Zarpar», MC-14). */
    this._nearBoat = false;
    /** Grupo de la barca del muelle (raycasteable para zarpar, MC-14), o null. */
    this._boatGroup = null;
    /** Posición de mundo de la barca para la proximidad a pie (MC-14), o null. */
    this._boatSpot = null;
    // La cabaña del brujo (MC-22): estado visual (lo pone <career-app> desde
    // las consultas de la isla), grupo propio (se rehace al cambiar el estado
    // o el mapa), posición determinista (wizardSpot) y refs del indicador.
    /** @type {'none'|'pending'|'ready'} */
    this.wizardState = 'none';
    /** Grupo de la cabaña del brujo (raycasteable, MC-22), o null. */
    this._wizardGroup = null;
    /** Posición de mundo de la cabaña (colisión, proximidad y exclusiones), o null. */
    this._wizardSpotW = null;
    /** Posiciones de mundo de las vallas TRIBBU (MC-23), con su yaw hacia el puerto.
     * @type {{ wx: number, wz: number, yaw: number }[]} */
    this._billboardSpotsW = [];
    /** true con el caminante junto a la cabaña (prompt «[E] El brujo»). */
    this._nearWizard = false;
    /** Farol indicador de la cabaña (pulso emisivo en _tickWizard), o null. */
    this._wizardLantern = null;
    /** Sprite del destello «respuesta lista» (pulsa en _tickWizard), o null. */
    this._wizardSparkle = null;
    /** Esferitas de humo del estado de reposo (userData.phase), animadas en _tickWizard. */
    this._wizardSmoke = [];
    /** Etiqueta flotante «El brujo» (muestreada con las demás, MC-17). */
    this._wizardLabels = [];
    /** Casa en la que se ha «entrado» al chocar de frente (MC-9), o null. */
    this._insideCityId = null;
    /** Posiciones de mundo de las ciudades para la marcha (colisión y proximidad). */
    this._walkCities = [];
    /** Radio caminable (walkableRadius) de la isla actual. */
    this._walkRadius = 0;
    this._lastWalkTs = 0;
    this._lastProxTs = 0;
    this._lastLabelTs = 0;
    /** Tamaño CSS (px) del viewport del canvas: lo fija _onResize (MC-17). */
    this._viewW = 0;
    this._viewH = 0;
    /** Vectores scratch para la marcha (se crean al cargar three). */
    this._walkDirScratch = null;
    this._lookScratch = null;
    /** Euler scratch (orden YXZ, el del pointer lock) para el giro con ←/→. */
    this._eulerScratch = null;
    /** Etiquetas flotantes de ciudad (muestreadas en _updateLabels; ocultas a pie). */
    this._cityLabels = [];
    /** Etiquetas flotantes de comarca y puerto (ocultas a pie). */
    this._areaLabels = [];
    /** Grupo de figuras de compañeros (MC-12): se rehace al cambiar la prop. */
    this._teammatesGroup = null;
    /** Figuras de compañero vivas (userData.limbs y userData.sway) para el idle. */
    this._teammateFigures = [];
    /** Sprites de nombre de compañero (muestreados en _updateLabels). */
    this._teammateLabels = [];
    /**
     * Caché de texturas de placa de puerta por nombre de ciudad: el grupo de
     * ciudades se rehace a menudo (journey/selección/proximidad) y pintar el
     * canvas de cada placa cada vez sería un despilfarro. Marcadas con
     * userData.shared para que _disposeSubtree NO las libere; se liberan en
     * _clearPlateCache (cambio de mapa) y en el teardown.
     * @type {Map<string, object>}
     */
    this._plateTextures = new Map();
    /**
     * Caché de texturas del número de ruta sobre la puerta (JG-25), por clave
     * texto+color. Mismo régimen que las placas: userData.shared, liberadas en
     * _clearPlateCache y el teardown.
     * @type {Map<string, object>}
     */
    this._doorNumTextures = new Map();
    /**
     * Caché de texturas procedurales del entorno (hierba, arena, tablones,
     * tejas, veta de madera, nube), por clave (MC-10). Independientes del mapa:
     * viven hasta el teardown (_clearEnvTextures). userData.shared, como las placas.
     * @type {Map<string, object>}
     */
    this._envTextures = new Map();
    /** Avatar low-poly de la vista aérea (MC-10), o null hasta tener mapa. */
    this._avatar = null;
    /** Posición del avatar en el plano del suelo (misma lógica que el fps). */
    this._avatarPos = { x: 0, z: 0 };
    /** Yaw del avatar (rota hacia su dirección de marcha con yawToward). */
    this._avatarYaw = 0;
    /** Fase de zancada acumulada (∝ distancia recorrida): anima piernas/brazos. */
    this._avatarPhase = 0;
    /** Peso 0..1 del balanceo (sube al andar, baja al parar: sin cortes secos). */
    this._avatarSwing = 0;
    this._lastAvatarTs = 0;
    /** Sol direccional (guardado para configurar su shadow camera por isla). */
    this._sun = null;
    /** Malla de agua animada (vértices ondulados en el loop) del mapa actual. */
    this._waterMesh = null;
    /** Sprites de nube con deriva (userData.drift) del mapa actual. */
    this._clouds = [];
    /** Paños que ondean por vértices (JG-7): la bandera pirata del faro. */
    this._flags = [];
    /** Puntos de los carteles de comarca (JG-7) por areaId: build + exclusiones.
     * @type {Map<string, { wx: number, wz: number, yaw: number, name: string }>} */
    this._areaSignSpots = new Map();
    /** mergeGeometries de three/addons (import dinámico, JG-7): fusiona el
     * tronco y la corona de las palmeras en una geometría cada uno. */
    this._mergeGeometries = null;
    this._lastEnvTs = 0;
    /**
     * Celebración en curso (certificado MC-11 o ciudadanía de isla MC-20), o
     * null. Guarda la variante (cfg: duración/fundido del tick), el grupo de
     * confeti (vive en la escena, sobrevive a rebuilds del grupo de ciudades),
     * las trayectorias puras y el material de pulso VIGENTE de la casa (se
     * recrea en cada rebuild: _disposeSubtree libera el del build anterior).
     * @type {{cityId: string, cfg: {durationS: number, fadeS: number, count: number, gravity: number}, start: number, group: object, mesh: object, params: object[], topY: number, bodyMat: object|null, intensity: number}|null}
     */
    this._celebration = null;
    /** Ciudad recién visitada pendiente de celebrar (diff en updated()). */
    this._pendingCelebration = null;
    /** Object3D scratch para las matrices del confeti (creado al cargar three). */
    this._confettiDummy = null;
    /** Motor de audio procedural de la isla (MC-11): gestiona su propio gating. */
    this._audio = new IslandAudio();
    /** Zancadas completas ya sonadas del avatar aéreo (fase ∝ distancia). */
    this._avatarStepCount = 0;
    /** Fase de zancada acumulada del caminante fps (solo para los pasos). */
    this._fpsPhase = 0;
    this._fpsStepCount = 0;
    /** Autopiloto a pie (JG-21): id de la casa a la que caminar solo, o null.
     * Cualquier tecla de movimiento lo cancela; al chocar con la casa se abre
     * su tarjeta como al llegar andando. */
    this._autoWalkTargetId = null;
    /** Balizas de «visado disponible» vivas (userData.phase) del build (MC-13). */
    this._beacons = [];
    /** Canvas offscreen con la capa ESTÁTICA del minimapa (isla, senda, casas). */
    this._minimapBase = null;
    /** true cuando la capa estática del minimapa debe repintarse (MC-13). */
    this._minimapDirty = true;
    this._lastMinimapTs = 0;
    /** Posiciones de mundo de los compañeros para el minimapa (MC-13). */
    this._teammateSpots = [];
    /** Puntero grueso (táctil): el hint de teclado del avatar no aplica. */
    this._coarsePointer =
      typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    /** Aborta de golpe todos los listeners (documento y canvas) en el teardown. */
    this._abort = null;
    this._onVisibility = () => {
      if (document.hidden) this._stopLoop();
      else if (this._renderer) this._startLoop();
    };
  }

  /** true si WebGL no está disponible (career-app puede leerlo además del evento). */
  get webglUnavailable() {
    return this._phase === 'unsupported';
  }

  firstUpdated() {
    this._init();
  }

  /** @param {Map<string, unknown>} changed */
  updated(changed) {
    if (this._phase !== 'ready') return;
    // El panel de ciudadanía se cerró desde el contenedor (✕ o Escape): ya no
    // se está «dentro» de ninguna casa (MC-9).
    if (changed.has('selected') && this.selected === null) this._insideCityId = null;
    // Un overlay DOM se abrió encima (panel, archipiélago): las teclas
    // mantenidas se sueltan — con él abierto no se camina ni se mira (MC-18) —
    // y un arrastre de mirada a medias se aborta (JG-3).
    if (changed.has('overlayOpen') && this.overlayOpen) {
      this._keys.clear();
      this._endFpsDrag();
    }
    // Celebración (MC-11): diff de visitadas ANTES de reconstruir. Solo cuenta
    // el gesto real de «marcar como visitada» (el conjunto anterior + una) y
    // solo si es la ciudad del panel abierto — cargar el journey de otra
    // persona (selected es null en ese momento) no celebra nada.
    if (changed.has('journey')) {
      const prev = changed.get('journey');
      const justId = justVisitedCity(prev?.visitedCities, this.journey?.visitedCities);
      this._pendingCelebration = justId !== null && justId === this.selected ? justId : null;
    }
    if (changed.has('map')) {
      // Cambio de isla: una celebración en curso quedaría en coordenadas de
      // la isla anterior — se corta antes de reconstruir.
      this._endCelebration();
      this._pendingCelebration = null;
      this._rebuildAll();
    } else if (
      changed.has('journey') ||
      changed.has('reachable') ||
      changed.has('selected') ||
      changed.has('carpoolStops') || // señalización del carpool (CP-1)
      changed.has('challengeStops') || // números de la ruta de reto (JG-5)
      changed.has('routeStops') // números de la ruta libre (JG-9)
    ) {
      this._rebuildCities();
    }
    // Compañeros (MC-12): su grupo solo depende de la prop y del mapa (el
    // cambio de mapa ya los rehace dentro de _rebuildAll).
    if (!changed.has('map') && changed.has('teammates')) this._rebuildTeammates();
    // La cabaña del brujo (MC-22): su grupo solo depende de wizardState y del
    // mapa (el cambio de mapa ya la rehace dentro de _rebuildAll).
    if (!changed.has('map') && changed.has('wizardState')) this._rebuildWizard();
    if (this._pendingCelebration) {
      const cityId = this._pendingCelebration;
      this._pendingCelebration = null;
      this._celebrate(cityId);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._teardown();
  }

  connectedCallback() {
    super.connectedCallback();
    // Si el elemento se re-conecta tras un teardown (cambio de vista y vuelta),
    // se vuelve a inicializar desde cero.
    if (this.hasUpdated && !this._renderer && this._phase !== 'unsupported') this._init();
  }

  // ---- Inicialización --------------------------------------------------------

  /** Carga three por import dinámico, comprueba WebGL y levanta la escena. */
  async _init() {
    this._phase = 'loading';
    let THREE;
    let OrbitControls;
    let PointerLockControls;
    let mergeGeometries;
    try {
      // Import dinámico: three solo se descarga al montar la vista 3D.
      [THREE, { OrbitControls }, { PointerLockControls }, { mergeGeometries }] = await Promise.all([
        import('three'),
        import('three/addons/controls/OrbitControls.js'),
        import('three/addons/controls/PointerLockControls.js'),
        import('three/addons/utils/BufferGeometryUtils.js'),
      ]);
    } catch (err) {
      this._phase = 'error';
      throw err instanceof Error ? err : new Error('No se pudo cargar el motor 3D.');
    }
    if (!this.isConnected || this._renderer) return;
    this._THREE = THREE;
    this._PointerLockControls = PointerLockControls;
    this._mergeGeometries = mergeGeometries;
    this._walkDirScratch = new THREE.Vector3();
    this._lookScratch = new THREE.Vector3();
    this._eulerScratch = new THREE.Euler(0, 0, 0, 'YXZ');
    this._confettiDummy = new THREE.Object3D();

    // Detección de WebGL en un canvas desechable (no bloquea el canvas real).
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
    if (!gl) {
      this._markUnsupported();
      return;
    }

    const canvas = this.renderRoot.querySelector('canvas');
    try {
      this._renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch {
      this._markUnsupported();
      return;
    }
    this._renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2));
    // Sombras suaves (MC-10): shadow map PCF del sol direccional. OJO:
    // PCFSoftShadowMap está DEPRECADO en three 0.185 (el propio renderer lo
    // degrada a PCF con un warning por frame); el suavizado del borde lo da
    // shadow.radius sobre el PCF estándar.
    this._renderer.shadowMap.enabled = SHADOWS.enabled;
    this._renderer.shadowMap.type = THREE.PCFShadowMap;

    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(ENV_COLORS.sky);

    this._camera = new THREE.PerspectiveCamera(45, 1, 0.5, 4000);

    // Cámara aérea orbital con límites sanos (se acota por isla en _frameIsland).
    this._controls = new OrbitControls(this._camera, canvas);
    this._controls.enableDamping = true;
    this._controls.dampingFactor = 0.08;
    this._controls.screenSpacePanning = false; // panear sobre el plano del suelo
    this._controls.maxPolarAngle = Math.PI * 0.46; // nunca bajo el horizonte/agua
    this._controls.target.set(0, GROUND_Y, 0);
    // Cualquier input del usuario (arrastre, rueda, touch) cancela el zoom animado.
    this._controls.addEventListener('start', () => {
      this._camAnim = null;
    });

    // Luz (MC-8): sol direccional CÁLIDO + contraluz frío muy suave (las caras
    // en sombra no quedan planas) + hemisférica cielo/hierba. Sin sombras
    // proyectadas (fluidez); el volumen lo dan el flatShading y las dos luces.
    const sun = new THREE.DirectionalLight(0xffe9c4, 1.5);
    sun.position.set(60, 120, 40);
    if (SHADOWS.enabled) {
      // Solo el sol proyecta sombras; el encuadre ortográfico de su shadow
      // camera se ajusta al radio de la isla en _frameIsland.
      sun.castShadow = true;
      sun.shadow.mapSize.set(SHADOWS.mapSize, SHADOWS.mapSize);
      sun.shadow.bias = -0.0005; // contra el acné en el terreno plano
      sun.shadow.radius = SHADOWS.radius; // borde suave con el PCF estándar
    }
    this._sun = sun;
    this._scene.add(sun);
    const fill = new THREE.DirectionalLight(0xbcd7e8, 0.35);
    fill.position.set(-70, 60, -50);
    this._scene.add(fill);
    this._scene.add(new THREE.HemisphereLight(0xeaf7fc, 0xc7dcc2, 0.85));

    // Tamaño real del contenedor (dispara una primera medición al observar).
    this._resizeObserver = new ResizeObserver((entries) => this._onResize(entries));
    this._resizeObserver.observe(this.renderRoot.querySelector('.wrap'));

    this._abort = new AbortController();
    const { signal } = this._abort;
    document.addEventListener('visibilitychange', this._onVisibility, { signal });

    // Picking básico (hook para MC-6): clic sin arrastre → select-city.
    canvas.addEventListener(
      'pointerdown',
      (e) => {
        this._pointerDownAt = { x: e.clientX, y: e.clientY };
        // Modo a pie LIBRE (JG-3): mantener el botón izquierdo y arrastrar
        // mira (dragLook); un clic corto y quieto interactúa (ver _onPick).
        if (this._mode === 'fps' && !this._fpsLocked && e.button === 0) {
          this._fpsDrag = {
            startX: e.clientX,
            startY: e.clientY,
            lastX: e.clientX,
            lastY: e.clientY,
            t: e.timeStamp,
            moved: false,
          };
          // La captura del PUNTERO (no confundir con el pointer lock) mantiene
          // el arrastre aunque el cursor salga del canvas a mitad de gesto.
          // Puede fallar con un puntero ya liberado (o sintético en tests):
          // el arrastre sigue funcionando mientras el cursor esté encima.
          try {
            canvas.setPointerCapture(e.pointerId);
          } catch {
            /* sin captura: solo se pierde el arrastre fuera del canvas */
          }
        }
        // Gesto real del usuario: momento válido para crear/reanudar el audio
        // (autoplay policy). Idempotente: unlock() es barato.
        this._audio.unlock();
      },
      { signal },
    );
    canvas.addEventListener('pointermove', (e) => this._onFpsDragMove(e), { signal });
    canvas.addEventListener('pointercancel', () => this._endFpsDrag(), { signal });
    canvas.addEventListener('pointerup', (e) => this._onPick(e), { signal });

    // Marcha en primera persona (MC-7): las teclas se escuchan en el documento
    // (con el pointer lock el foco es global) y solo actúan en modo fps.
    document.addEventListener('keydown', (e) => this._onKeyDown(e), { signal });
    document.addEventListener('keyup', (e) => this._onKeyUp(e), { signal });

    this._phase = 'ready';
    this._rebuildAll();
    if (!document.hidden) this._startLoop();
  }

  /** Marca WebGL como no disponible y avisa al contenedor para su fallback. */
  _markUnsupported() {
    this._phase = 'unsupported';
    this.dispatchEvent(
      new CustomEvent('webgl-unavailable', { bubbles: true, composed: true }),
    );
  }

  // ---- Bucle de render / tamaño ---------------------------------------------

  /**
   * Bucle rAF por modo. En vista aérea: damping de los controles + animación
   * de foco + render; la animación se aplica DESPUÉS de controls.update() para
   * que tenga la última palabra sobre cámara y target mientras dura (el
   * damping residual no la pelea; el input del usuario la cancela vía el
   * evento 'start'). En fps: un paso de marcha por frame. En las transiciones
   * de entrada/salida del fps (OrbitControls apagado) solo manda la animación.
   * Se pausa con document.hidden.
   */
  _startLoop() {
    if (this._raf || !this._renderer) return;
    /** @param {DOMHighResTimeStamp} now */
    const step = (now) => {
      this._raf = requestAnimationFrame(step);
      if (this._mode === 'aerial') {
        this._controls.update();
        // El avatar camina ANTES de la animación de foco: si hay una en curso,
        // ella manda sobre cámara y target (el follow se salta solo, MC-10).
        this._tickAvatar(now);
        this._tickCameraAnim(now);
        this._clampTarget();
      } else if (this._mode === 'fps') {
        this._tickWalk(now);
        // Minimapa (MC-13): composición barata cada redrawMs, solo a pie.
        if (now - this._lastMinimapTs >= MINIMAP.redrawMs) {
          this._lastMinimapTs = now;
          this._drawMinimap();
        }
      } else {
        this._tickCameraAnim(now);
      }
      this._tickEnvironment(now); // agua ondulada y deriva de nubes (MC-10)
      this._tickCelebration(now); // confeti y pulso dorado, en cualquier modo (MC-11)
      this._tickTeammates(now); // idle de los compañeros, en cualquier modo (MC-12)
      // Etiquetas flotantes (MC-17): tamaño aparente constante + declutter,
      // en cualquier modo y con la cadencia de los antiguos fundidos.
      if (now - this._lastLabelTs >= LABEL_FADE_MS) {
        this._lastLabelTs = now;
        this._updateLabels();
      }
      this._tickBeacons(now); // pulso de las balizas de visado disponible (MC-13)
      this._tickWizard(now); // farol/humo de la cabaña del brujo (MC-22)
      this._renderer.render(this._scene, this._camera);
    };
    this._raf = requestAnimationFrame(step);
  }

  _stopLoop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  /** Acota el paneo: el target no puede alejarse de la isla ni cambiar de altura. */
  _clampTarget() {
    const limit = (this._islandR || 50) * PAN_LIMIT_FACTOR;
    const t = this._controls.target;
    t.x = Math.min(Math.max(t.x, -limit), limit);
    t.z = Math.min(Math.max(t.z, -limit), limit);
    t.y = GROUND_Y;
  }

  // ---- Etiquetas flotantes (MC-8 / MC-17) --------------------------------------

  /**
   * Muestreo de TODAS las etiquetas flotantes (MC-17), cada LABEL_FADE_MS:
   *
   *  1. Tamaño aparente constante: re-escala cada sprite por su profundidad de
   *     vista (labelWorldScale + LABEL_WORLD_CLAMP, puro) para que mida
   *     ~targetPx px en pantalla a cualquier zoom — ni gigante de cerca ni
   *     ilegible de lejos.
   *  2. Opacidad: se conservan los fundidos por distancia previos como pura
   *     ATENUACIÓN (ciudades según LABEL_FADE×R, MC-8; compañeros con umbrales
   *     absolutos y más cortos a pie, MC-12) — ya no controlan el tamaño.
   *  3. Visibilidad: la decide el declutter puro (declutterLabels) sobre las
   *     cajas proyectadas a pantalla, por prioridad (LABEL_PRIORITY, horneada
   *     en cada sprite al construirlo) — ninguna letra pisa a otra. Detrás de
   *     la cámara (profundidad ≤ 0) o más allá del far (NDC z > 1) → oculta.
   *
   * A pie (fps/to-fps) los topónimos siguen ocultos (_setLabelsVisible, la
   * política de MC-8: placa de puerta y prompt hacen ese trabajo) y solo se
   * muestrean los nombres de compañeros. Barato: decenas de sprites por tick.
   */
  _updateLabels() {
    if (!this._camera || !this._renderer || this._viewH === 0) return;
    const onFoot = this._mode === 'fps' || this._mode === 'to-fps';
    const sprites = onFoot
      ? this._teammateLabels
      : [...this._areaLabels, ...this._cityLabels, ...this._wizardLabels, ...this._teammateLabels];
    if (sprites.length === 0) return;
    const cam = this._camera;
    cam.updateMatrixWorld();
    // El renderer refresca la inversa al pintar; recalcularla aquí evita
    // proyectar con la cámara de un frame atrás justo después de moverla.
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    const fovRad = (cam.fov * Math.PI) / 180;
    const R = this._islandR || 50;
    const cityNear = R * LABEL_FADE.near;
    const cityFar = R * LABEL_FADE.far;
    const mateConf = onFoot ? TEAMMATE.labelFadeFps : TEAMMATE.labelFadeAerial;
    /** @type {import('../../tools/career/domain/labels.js').LabelBox[]} */
    const boxes = [];
    const byId = new Map();
    const v = this._lookScratch;
    for (const sprite of sprites) {
      const meta = sprite.userData.label;
      sprite.getWorldPosition(v).applyMatrix4(cam.matrixWorldInverse);
      const depth = -v.z; // profundidad de vista: la que fija el tamaño aparente
      if (depth <= 0) {
        sprite.visible = false; // detrás de la cámara
        continue;
      }
      const dist = v.length(); // euclídea: la semántica de los fundidos previos
      let opacity = 1; // las comarcas y el puerto no se funden (como hasta ahora)
      if (meta.kind === 'city') {
        opacity = 1 - Math.min(Math.max((dist - cityNear) / (cityFar - cityNear), 0), 1);
      } else if (meta.kind === 'teammate') {
        opacity =
          1 - Math.min(Math.max((dist - mateConf.near) / (mateConf.far - mateConf.near), 0), 1);
      }
      sprite.material.opacity = opacity;
      if (opacity <= 0.02) {
        sprite.visible = false;
        continue;
      }
      const h = labelWorldScale(depth, meta.targetPx, fovRad, this._viewH, LABEL_WORLD_CLAMP);
      sprite.scale.set(h * meta.aspect, h, 1);
      // Caja en pantalla para el declutter: px reales tras el clamp y centro
      // proyectado del ancla (los sprites se anclan centrados).
      const px = labelScreenPx(h, depth, fovRad, this._viewH);
      v.applyMatrix4(cam.projectionMatrix); // vista → NDC (con división perspectiva)
      if (v.z > 1) {
        sprite.visible = false; // más allá del far
        continue;
      }
      boxes.push({
        id: meta.id,
        x: ((v.x + 1) / 2) * this._viewW,
        y: ((1 - v.y) / 2) * this._viewH,
        w: px * meta.aspect,
        h: px,
        priority: meta.priority,
        dist,
      });
      byId.set(meta.id, sprite);
    }
    const visibleIds = declutterLabels(boxes);
    for (const [id, sprite] of byId) sprite.visible = visibleIds.has(id);
  }

  /**
   * Muestra/oculta TODAS las etiquetas flotantes (ciudades, comarcas y puerto).
   * A pie ensucian (nombres gigantes sobre la cabeza): el nombre se lee en la
   * placa de la puerta y en el prompt de proximidad.
   * @param {boolean} visible
   */
  _setLabelsVisible(visible) {
    for (const sprite of [...this._cityLabels, ...this._areaLabels, ...this._wizardLabels]) {
      sprite.visible = visible;
      if (visible) sprite.material.opacity = 1;
    }
    // Al volver a la vista aérea el muestreo se aplica YA: ni un frame con
    // etiquetas a escala vieja o pisándose antes del siguiente tick (MC-17).
    if (visible) this._updateLabels();
  }

  // ---- Zoom animado de cámara (MC-6) ------------------------------------------

  /**
   * Enfoca una ciudad con zoom animado: la cámara llega cerca de su casa, con
   * un ángulo agradable (~38°) y conservando el azimut actual (llega "desde
   * donde está", sin giros bruscos). API pública para <career-app>.
   * @param {string} cityId
   */
  focusCity(cityId) {
    if (this._phase !== 'ready' || this._mode !== 'aerial') return;
    const frame = cityFocusFrame(this.map, cityId);
    if (frame) this._animateTo(this._poseFromFrame(frame));
  }

  /**
   * Enfoca una comarca completa: encuadra su plataforma (distancia proporcional
   * a su radio) con vista más aérea. API pública para <career-app>.
   * @param {string} areaId
   */
  focusArea(areaId) {
    if (this._phase !== 'ready' || this._mode !== 'aerial') return;
    const frame = areaFocusFrame(this.map, areaId);
    if (frame) this._animateTo(this._poseFromFrame(frame));
  }

  /** Vuelve, con animación, al encuadre aéreo inicial de toda la isla. */
  focusOverview() {
    if (this._phase !== 'ready' || this._mode !== 'aerial') return;
    this._animateTo(this._overviewPose());
  }

  /**
   * Pose de cámara (posición + target) para un encuadre de foco del dominio.
   * Conserva el azimut actual de la cámara respecto al NUEVO target y respeta
   * la distancia mínima de los controles.
   * @param {import('../../tools/career/domain/islandLayout.js').FocusFrame} frame
   */
  _poseFromFrame(frame) {
    const THREE = this._THREE;
    const target = new THREE.Vector3(frame.wx, GROUND_Y, frame.wz);
    const distance = Math.max(frame.distance, this._controls.minDistance);
    const cam = this._camera.position;
    const azimuth = Math.atan2(cam.x - target.x, cam.z - target.z);
    const horizontal = distance * Math.cos(frame.elevation);
    const position = new THREE.Vector3(
      target.x + Math.sin(azimuth) * horizontal,
      GROUND_Y + distance * Math.sin(frame.elevation),
      target.z + Math.cos(azimuth) * horizontal,
    );
    return { position, target };
  }

  /** Pose del encuadre aéreo de toda la isla (la misma del arranque). */
  _overviewPose() {
    const THREE = this._THREE;
    const R = this._islandR;
    return {
      position: new THREE.Vector3(R * 1.1, R * 1.5, R * 1.1),
      target: new THREE.Vector3(0, GROUND_Y, 0),
    };
  }

  /**
   * Arranca una animación de cámara desde la pose actual hacia la indicada.
   * @param {{ position: object, target: object }} pose
   * @param {{ duration?: number, onDone?: () => void, fromTarget?: object }} [opts]
   *   duration: ms (por defecto FOCUS_ANIM_MS); onDone: callback al completar;
   *   fromTarget: punto de mira inicial (por defecto el target de los controles).
   */
  _animateTo({ position, target }, opts = {}) {
    this._camAnim = {
      fromPos: this._camera.position.clone(),
      toPos: position,
      fromTarget: (opts.fromTarget ?? this._controls.target).clone(),
      toTarget: target,
      start: performance.now(),
      duration: opts.duration ?? FOCUS_ANIM_MS,
      onDone: opts.onDone ?? null,
    };
  }

  /**
   * Avanza la animación de cámara en curso (easeInOutCubic). En vista aérea
   * interpola el target de los OrbitControls; en las transiciones del modo fps
   * (controles apagados) orienta la cámara directamente con lookAt. Al
   * completarse se limpia sola y dispara su onDone; el input del usuario la
   * cancela antes (evento 'start' de los controles, solo en vista aérea).
   * @param {DOMHighResTimeStamp} now
   */
  _tickCameraAnim(now) {
    const anim = this._camAnim;
    if (!anim) return;
    const t = Math.min((now - anim.start) / anim.duration, 1);
    const k = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    this._camera.position.lerpVectors(anim.fromPos, anim.toPos, k);
    if (this._mode === 'aerial') {
      this._controls.target.lerpVectors(anim.fromTarget, anim.toTarget, k);
    } else {
      this._lookScratch.lerpVectors(anim.fromTarget, anim.toTarget, k);
      this._camera.lookAt(this._lookScratch);
    }
    if (t >= 1) {
      this._camAnim = null;
      anim.onDone?.();
    }
  }

  // ---- Modo primera persona (MC-7) --------------------------------------------

  /** Modo de cámara público: las transiciones cuentan como su modo de destino. */
  get mode() {
    return this._mode === 'fps' || this._mode === 'to-fps' ? 'fps' : 'aerial';
  }

  /**
   * Entra en primera persona: transición animada desde la vista aérea hasta la
   * altura de ojos frente a la ciudad actual del journey (o junto al puerto), y
   * al llegar activa PointerLockControls (ratón) y la marcha WASD/flechas.
   * API pública para <career-app>. Pensado para escritorio (puntero fino): en
   * táctil el HUD ni siquiera ofrece el botón de entrada.
   */
  enterFirstPerson() {
    if (this._phase !== 'ready' || this._mode !== 'aerial' || !this.map) return;
    const THREE = this._THREE;
    // La cámara ES el avatar (MC-10): a pie se parte de donde está el avatar,
    // mirando hacia donde él mira, y el personajillo se oculta mientras tanto.
    const spawn = this._avatar
      ? {
          x: this._avatarPos.x,
          z: this._avatarPos.z,
          lookX: this._avatarPos.x + Math.sin(this._avatarYaw) * 10,
          lookZ: this._avatarPos.z + Math.cos(this._avatarYaw) * 10,
        }
      : this._fpsSpawn();
    const eyeY = groundHeightAt(spawn.x, spawn.z, { radius: this._islandR }) + EYE_HEIGHT;
    this._mode = 'to-fps';
    this._keys.clear(); // las teclas de la marcha aérea no arrastran al fps
    this._setAvatarVisible(false);
    this._controls.enabled = false; // el damping no pelea con la transición
    this._setLabelsVisible(false); // a pie los nombres gigantes ensucian
    this._animateTo(
      {
        position: new THREE.Vector3(spawn.x, eyeY, spawn.z),
        target: new THREE.Vector3(spawn.lookX, eyeY, spawn.lookZ),
      },
      { duration: FPS_ANIM_MS, onDone: () => this._activateFps() },
    );
    this._emitMode('fps');
  }

  /**
   * Sale de primera persona: suelta el pointer lock si sigue activo y vuelve,
   * con transición, al encuadre aéreo con OrbitControls. También cubre la
   * salida a mitad de la transición de entrada.
   */
  exitFirstPerson() {
    if (this._phase !== 'ready') return;
    if (this._mode !== 'fps' && this._mode !== 'to-fps') return;
    // El cambio de modo va ANTES de soltar el lock: así el pointerlockchange
    // resultante no re-entra aquí (sin estados colgados).
    this._mode = 'to-aerial';
    this._keys.clear();
    this._endFpsDrag();
    this._insideCityId = null;
    this._nearBoat = false;
    this._setLabelsVisible(true); // de vuelta a la vista aérea, con sus nombres
    if (this.renderRoot.pointerLockElement) document.exitPointerLock();
    if (this._plc) this._plc.enabled = false;
    if (this._nearCityId) {
      this._nearCityId = null;
      this._rebuildCities(); // apaga el resalte de proximidad
    }
    const THREE = this._THREE;
    // El giro parte del punto que se está mirando ahora mismo (continuidad).
    const lookNow = new THREE.Vector3();
    this._camera.getWorldDirection(lookNow);
    // El avatar reaparece DONDE ESTABA la cámara, mirando hacia donde miraba
    // el caminante (MC-10): la vuelta a la vista aérea lo muestra en el sitio.
    if (this._avatar) {
      this._avatarPos = { x: this._camera.position.x, z: this._camera.position.z };
      this._avatarYaw = Math.atan2(lookNow.x, lookNow.z);
      this._placeAvatar();
      this._setAvatarVisible(true);
    }
    lookNow.multiplyScalar(EXIT_LOOK_AHEAD).add(this._camera.position);
    const pose = this._overviewPose();
    this._animateTo(pose, {
      duration: FPS_ANIM_MS,
      fromTarget: lookNow,
      onDone: () => {
        this._mode = 'aerial';
        this._controls.target.copy(pose.target);
        this._controls.enabled = true;
        this._controls.update();
      },
    });
    this._emitMode('aerial');
  }

  /**
   * Punto de aparición del caminante: unos pasos por delante de la ciudad
   * actual del journey mirándola (si existe); si no, junto al puerto mirando
   * al interior de la isla; y en un mapa sin puerto, el centro mirando al norte.
   * @returns {{ x: number, z: number, lookX: number, lookZ: number }}
   */
  _fpsSpawn() {
    const currentId = this.journey?.currentCity ?? null;
    const city = currentId ? (this.map.cities ?? []).find((c) => c.id === currentId) : null;
    if (city) {
      const { wx, wz } = worldFromMap(city.x, city.y);
      const d = Math.hypot(wx, wz);
      // Desplazado hacia el centro de la isla (o hacia +z si la ciudad está en el origen).
      const ux = d > 0.001 ? wx / d : 0;
      const uz = d > 0.001 ? wz / d : 1;
      return {
        x: wx - ux * CITY_SPAWN_OFFSET,
        z: wz - uz * CITY_SPAWN_OFFSET,
        lookX: wx,
        lookZ: wz,
      };
    }
    if (this.map.startPort) {
      const { wx, wz } = worldFromMap(this.map.startPort.x, this.map.startPort.y);
      if (Math.hypot(wx, wz) < 0.5) return { x: wx, z: wz, lookX: 0, lookZ: -10 };
      return { x: wx, z: wz, lookX: 0, lookZ: 0 };
    }
    return { x: 0, z: 0, lookX: 0, lookZ: -10 };
  }

  /**
   * La transición de entrada llegó a la altura de ojos: cambio de controles.
   * OrbitControls queda apagado y PointerLockControls (creado perezosamente la
   * primera vez) queda LISTO pero sin capturar el ratón (JG-3): el modo a pie
   * arranca SIEMPRE libre — el lock solo llega vía «🎮 Modo inmersivo»
   * (enterImmersive, opt-in). PLC solo procesa el ratón con isLocked=true, así
   * que dejarlo enabled es inocuo en modo libre.
   */
  _activateFps() {
    this._mode = 'fps';
    this._lastWalkTs = 0;
    this._autoWalkTargetId = null; // sin autopiloto heredado al entrar a pie
    this._guideEl = null; // la brújula se recrea con el HUD fps: recachear tras render
    if (!this._plc) {
      const canvas = this.renderRoot.querySelector('canvas');
      this._plc = new this._PointerLockControls(this._camera, canvas);
      // Sin mirar al cénit/nadir puro: el forward proyectado al suelo nunca
      // degenera. El MISMO tope que la mirada por teclado (PITCH_LIMIT, MC-18).
      this._plc.minPolarAngle = Math.PI / 2 - PITCH_LIMIT;
      this._plc.maxPolarAngle = Math.PI / 2 + PITCH_LIMIT;
      // IMPORTANTE (shadow DOM): document.pointerLockElement retargetea al HOST,
      // así que el detector interno de PointerLockControls nunca ve el canvas y
      // dejaría isLocked=false (sin ratón). Este listener se registra DESPUÉS
      // del connect() del control (orden de registro = orden de ejecución) y
      // corrige isLocked con la verdad del shadow root en cada cambio.
      document.addEventListener('pointerlockchange', () => this._onPointerLockChange(), {
        signal: this._abort.signal,
      });
    }
    this._plc.enabled = true;
  }

  /**
   * «🎮 Modo inmersivo» (JG-3, OPT-IN): captura el ratón (pointer lock) para el
   * mouse-look continuo tipo DOOM. API pública para el botón del HUD de
   * <career-app> — el clic del botón es el gesto real que el navegador exige.
   * Escape (nativo del lock) o abrir cualquier panel lo sueltan y DEVUELVEN al
   * modo libre: nunca hay re-captura automática (la preferencia no se
   * persiste; el default siempre es libre).
   */
  enterImmersive() {
    if (this._phase !== 'ready' || this._mode !== 'fps' || this._fpsLocked) return;
    this._endFpsDrag(); // un arrastre a medias no debe sobrevivir al cambio de modo
    this._requestLock();
  }

  /** Pide el pointer lock sobre el canvas absorbiendo el rechazo del navegador. */
  _requestLock() {
    const canvas = this.renderRoot.querySelector('canvas');
    try {
      // requestPointerLock devuelve una promesa en navegadores modernos: el
      // rechazo (sin gesto de usuario reciente) NO es un error de la app — el
      // modo libre sigue siendo completamente jugable sin lock.
      canvas.requestPointerLock()?.catch?.(() => {});
    } catch {
      // Navegadores antiguos pueden lanzar de forma síncrona: mismo tratamiento.
    }
  }

  /**
   * Única fuente de verdad del estado del lock (ver nota de shadow DOM en
   * _activateFps). Soltar el lock — Escape del usuario o apertura de un panel
   * desde el modo inmersivo — SIEMPRE devuelve al modo a pie LIBRE (JG-3): se
   * sigue caminando con el cursor visible y se re-activa «🎮 inmersivo» a
   * voluntad. Nada de re-capturas automáticas ni salidas sorpresa del modo.
   */
  _onPointerLockChange() {
    const canvas = this.renderRoot.querySelector('canvas');
    const locked = this.renderRoot.pointerLockElement === canvas;
    if (this._plc) this._plc.isLocked = locked; // corrige el retargeting del shadow DOM
    this._fpsLocked = locked;
    if (locked) return;
    this._keys.clear(); // sin lock no hay keyups garantizados: nada de teclas pegadas
  }

  /**
   * Arrastre de mirada del modo a pie libre (JG-3): con el botón izquierdo
   * mantenido, el movimiento del puntero gira la cámara (dragLook puro,
   * metáfora de «agarrar el mundo»). Hasta superar DRAG_THRESHOLD el gesto
   * sigue siendo un posible CLIC y la cámara no se toca (los primeros píxeles
   * se descartan: nada de micro-giros al clicar).
   * @param {PointerEvent} event
   */
  _onFpsDragMove(event) {
    const drag = this._fpsDrag;
    if (!drag) return;
    if (this._mode !== 'fps' || this._fpsLocked) {
      this._endFpsDrag(); // el modo cambió a mitad de gesto: se aborta limpio
      return;
    }
    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (!drag.moved) {
      const total = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (total <= DRAG_THRESHOLD) return;
      drag.moved = true;
      this._fpsDragging = true; // cursor grabbing vía CSS
    }
    // Solo se editan yaw/pitch del euler YXZ de la cámara (mismo esquema que
    // el giro por teclado de _tickWalk: conviven sin pelearse).
    this._eulerScratch.setFromQuaternion(this._camera.quaternion);
    const next = dragLook(
      this._eulerScratch.y,
      this._eulerScratch.x,
      dx,
      dy,
      DRAG_LOOK_SENSITIVITY,
      PITCH_LIMIT,
    );
    this._eulerScratch.y = next.yaw;
    this._eulerScratch.x = next.pitch;
    this._camera.quaternion.setFromEuler(this._eulerScratch);
  }

  /** Cierra (o aborta) el arrastre de mirada del modo libre y repone el cursor. */
  _endFpsDrag() {
    this._fpsDrag = null;
    this._fpsDragging = false;
  }

  /** Teclas de marcha (mantenidas), por event.code: WASD (independiente del layout), flechas y Shift. */
  static MOVE_CODES = Object.freeze(
    new Set([
      'KeyW', 'KeyA', 'KeyS', 'KeyD',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'ShiftLeft', 'ShiftRight',
    ]),
  );

  /** Teclas de mirada vertical (mantenidas, MC-18): Q/Re Pág arriba, E/Av Pág abajo. */
  static PITCH_CODES = Object.freeze(new Set(['KeyQ', 'KeyE', 'PageUp', 'PageDown']));

  /** Todas las teclas que se MANTIENEN pulsadas en el modo a pie (marcha + mirada). */
  static HELD_CODES = Object.freeze(
    new Set([...CareerIsland3D.MOVE_CODES, ...CareerIsland3D.PITCH_CODES]),
  );

  /** @param {KeyboardEvent} event */
  _onKeyDown(event) {
    // Cualquier tecla es un gesto real: momento válido para el audio (MC-11).
    this._audio.unlock();
    if (this._mode === 'aerial') {
      // Marcha del avatar en vista aérea (MC-10): el teclado está libre (sin
      // pointer lock), así que se ignoran las teclas escritas en campos
      // editables (panel de ciudadanía, formularios) mirando el origen REAL
      // del evento (el shadow DOM retargetea, ver _isTypingTarget).
      if (this._phase !== 'ready' || !this.map || !this._avatar) return;
      if (CareerIsland3D._isTypingTarget(event)) return;
      if (this._insideCityId !== null) {
        // «Dentro» de una casa por choque: solo ↓/S actúan — dar hacia atrás
        // cierra el panel y despega al avatar (mismo patrón que MC-9 a pie).
        if (event.code === 'ArrowDown' || event.code === 'KeyS') {
          event.preventDefault();
          this._exitCity();
        }
        return;
      }
      if (CareerIsland3D.MOVE_CODES.has(event.code)) {
        this._keys.add(event.code);
        event.preventDefault(); // las flechas no deben hacer scroll de la página
      }
      return;
    }
    if (this._mode !== 'fps') return;
    if (!this._fpsLocked) {
      // Modo LIBRE (JG-3, el default): Escape → salir del modo a pie y, con el
      // panel abierto por CHOQUE contra una casa (MC-9), ↓/S → salir de la casa
      // (salvo que se esté escribiendo en un campo del panel). El Escape
      // DENTRO del panel no llega aquí: el panel lo consume (stopPropagation)
      // para cerrarse. En el modo inmersivo el Escape lo consume el propio
      // pointer lock (suelta el ratón → modo libre) y no llega a este handler.
      // El RESTO de teclas del modo a pie funciona siempre (MC-18) salvo con
      // un overlay DOM abierto encima (panel/archipiélago).
      if (event.code === 'Escape') {
        this.exitFirstPerson();
        return;
      }
      if (CareerIsland3D._isTypingTarget(event)) return;
      if (
        this._insideCityId !== null &&
        (event.code === 'ArrowDown' || event.code === 'KeyS')
      ) {
        event.preventDefault();
        this._exitCity();
        return;
      }
      if (this.overlayOpen) return;
    }
    // Interacción [E] (solo la pulsación inicial: MANTENER E es mirar abajo,
    // MC-18): entrar en la ciudad cercana o zarpar en la barca (MC-14).
    // Funciona con y sin lock: la proximidad no depende del ratón.
    if (event.code === 'KeyE' && !event.repeat && this._nearCityId) {
      event.preventDefault();
      this._openNearCity();
      return;
    }
    if (event.code === 'KeyE' && !event.repeat && this._nearWizard) {
      event.preventDefault();
      this._openWizard();
      return;
    }
    if (event.code === 'KeyE' && !event.repeat && this._nearBoat) {
      event.preventDefault();
      this._openArchipelago();
      return;
    }
    if (CareerIsland3D.HELD_CODES.has(event.code)) {
      this._keys.add(event.code);
      this._autoWalkTargetId = null; // tomar el control cancela el autopiloto (JG-21)
      event.preventDefault(); // ni scroll con las flechas ni paginación con Re/Av Pág
    }
  }

  /** @param {KeyboardEvent} event */
  _onKeyUp(event) {
    this._keys.delete(event.code);
  }

  /**
   * Un frame de marcha con controles tipo DOOM (MC-8): ←/→ GIRAN sobre uno
   * mismo (yaw suave con turnYaw, compatible con el ratón del pointer lock),
   * ↑/↓ y W/S avanzan/retroceden, A/D hacen strafe. La dirección se proyecta
   * al plano del suelo relativa a la cámara, el paso se acota a la isla
   * (stepPosition de walk.js, desliza por la costa) y la cámara va pegada al
   * suelo a altura de ojos con groundHeightAt (el MISMO perfil que pintan las
   * mallas: ni se atraviesa el suelo ni se pisa el agua). Cada
   * PROXIMITY_CHECK_MS se refresca la ciudad cercana.
   * @param {DOMHighResTimeStamp} now
   */
  _tickWalk(now) {
    const dt = Math.min((now - (this._lastWalkTs || now)) / 1000, 0.05);
    this._lastWalkTs = now;
    const cam = this._camera.position;
    // Sin gate por _fpsLocked (MC-18): _keys solo se llena en los estados
    // válidos (_onKeyDown filtra overlay/campos y el unlock la vacía), así que
    // el teclado sigue mandando aunque el navegador rechazara el lock.
    if (this._keys.size > 0) {
      const key = (code) => (this._keys.has(code) ? 1 : 0);
      // Giro sobre uno mismo y mirada vertical: se editan SOLO yaw/pitch del
      // euler YXZ de la cámara (mismo orden que usa PointerLockControls, que
      // relee el quaternion en cada movimiento de ratón: conviven sin
      // pelearse). El pitch por teclas (Q/Re Pág arriba, E/Av Pág abajo,
      // MC-18) comparte topes con el ratón (tiltPitch puro, ±PITCH_LIMIT).
      const turn = key('ArrowLeft') - key('ArrowRight');
      const tilt = key('KeyQ') + key('PageUp') - key('KeyE') - key('PageDown');
      if (turn !== 0 || tilt !== 0) {
        this._eulerScratch.setFromQuaternion(this._camera.quaternion);
        if (turn !== 0) {
          this._eulerScratch.y = turnYaw(this._eulerScratch.y, turn, dt, TURN_SPEED);
        }
        if (tilt !== 0) {
          this._eulerScratch.x = tiltPitch(this._eulerScratch.x, tilt, dt, PITCH_SPEED, PITCH_LIMIT);
        }
        this._camera.quaternion.setFromEuler(this._eulerScratch);
      }
      const fwd = key('KeyW') + key('ArrowUp') - key('KeyS') - key('ArrowDown');
      const strafe = key('KeyD') - key('KeyA');
      if (fwd !== 0 || strafe !== 0) {
        // Forward de la cámara proyectado al plano XZ (los límites polares del
        // PointerLockControls garantizan que nunca degenera).
        const look = this._camera.getWorldDirection(this._walkDirScratch);
        const flen = Math.hypot(look.x, look.z);
        const fx = look.x / flen;
        const fz = look.z / flen;
        // right = forward × up (mundo y-arriba) = (-fz, fx).
        const dir = { x: fx * fwd - fz * strafe, z: fz * fwd + fx * strafe };
        const running = this._keys.has('ShiftLeft') || this._keys.has('ShiftRight');
        const next = stepPosition(
          { x: cam.x, z: cam.z },
          dir,
          dt,
          WALK_SPEED * (running ? RUN_MULTIPLIER : 1),
          { radius: this._walkRadius },
        );
        // Colisión con las casas (MC-9, collideWithCities puro): no se
        // atraviesan — se desliza por su contorno — y un empuje FRONTAL
        // contra una casa «entra» (abre su panel de ciudadanía).
        const colCities = collideWithCities(
          { x: cam.x, z: cam.z },
          next,
          this._walkCities,
          CITY_COLLIDER_RADIUS,
        );
        // La cabaña del brujo tampoco se atraviesa (MC-22): mismo colisionador
        // puro, y el empuje FRONTAL abre el panel del brujo.
        const col = this._collideWizard({ x: cam.x, z: cam.z }, colCities);
        // Pasos a pie (MC-11): misma fase ∝ distancia que la zancada del
        // avatar — un tick por media onda, con el rate siguiendo a la velocidad.
        this._fpsPhase += Math.hypot(col.x - cam.x, col.z - cam.z) * AVATAR.stepFreq;
        const steps = Math.floor(this._fpsPhase / Math.PI);
        if (steps > this._fpsStepCount) this._audio.step();
        this._fpsStepCount = steps;
        cam.x = col.x;
        cam.z = col.z;
        // Entrar en la casa SOLO al chocar AVANZANDO (fwd > 0) y por el FRONTAL
        // (la puerta, JG-25 fix): chocar por un lateral o la trasera no abre la
        // tarjeta — hay que rodear hasta la puerta, como en una casa de verdad.
        const hit = colCities.hitCityId;
        if (hit !== null && this._insideCityId === null && fwd > 0 && this._isFrontalApproach(hit, cam)) {
          this._enterCity(hit);
        } else if (col.hitWizard && fwd > 0) {
          this._openWizard();
        }
      }
    } else if (this._autoWalkTargetId) {
      // Autopiloto (JG-21): sin teclas pulsadas, el avatar camina solo hacia
      // la casa objetivo. Al chocar con ella se abre su tarjeta (como al
      // llegar andando); una tecla de movimiento cancela el autopiloto.
      this._autoWalkStep(dt);
    }
    cam.y = groundHeightAt(cam.x, cam.z, { radius: this._islandR }) + EYE_HEIGHT;
    this._updateGuide();
    if (now - this._lastProxTs >= PROXIMITY_CHECK_MS) {
      this._lastProxTs = now;
      this._updateProximity();
    }
  }

  /**
   * Brújula de objetivo a pie (JG-21): apunta la flecha del HUD hacia la casa
   * guía (el objetivo del autopiloto o la siguiente parada, guideCityId) y
   * muestra su nombre y distancia. La flecha gira según hacia dónde miras: si
   * la casa está delante apunta arriba; si la tienes detrás, hacia abajo. Solo
   * si la casa está en ESTA isla; si no, esconde el chip.
   */
  _updateGuide() {
    this._guideEl ??= this.renderRoot.querySelector('.guide');
    const el = this._guideEl;
    if (!el) return;
    const targetId = this._autoWalkTargetId ?? this.guideCityId;
    const target = targetId ? this._walkCities.find((c) => c.id === targetId) : null;
    if (!target) {
      if (!el.hidden) el.hidden = true;
      return;
    }
    const cam = this._camera.position;
    const dx = target.wx - cam.x;
    const dz = target.wz - cam.z;
    const dist = Math.hypot(dx, dz) || 1;
    const look = this._camera.getWorldDirection(this._walkDirScratch);
    const flen = Math.hypot(look.x, look.z) || 1;
    const fx = look.x / flen;
    const fz = look.z / flen;
    // Ángulo firmado entre hacia dónde miras y hacia dónde está la casa.
    const signed = Math.atan2(fx * (dz / dist) - fz * (dx / dist), fx * (dx / dist) + fz * (dz / dist));
    el.hidden = false;
    el.querySelector('.guide-arrow').style.transform = `rotate(${(signed * 180) / Math.PI}deg)`;
    const name = this.map?.cities?.find((c) => c.id === targetId)?.name ?? '';
    el.querySelector('.gname').textContent = name;
    el.querySelector('.dist').textContent = `${Math.round(dist)} m`;
  }

  /**
   * Camina el avatar (a pie) hacia la casa objetivo (JG-21): gira la vista
   * hacia ella y avanza en línea hacia su posición, deslizando por la costa y
   * las casas. Al chocar CON la casa objetivo se entra (abre su tarjeta); si
   * llega al punto sin choque (raro), se detiene. Un guardián de tiempo evita
   * quedarse dando vueltas si algo la bloquea.
   * @param {number} dt Delta de tiempo del frame (s).
   */
  _autoWalkStep(dt) {
    const target = this._walkCities.find((c) => c.id === this._autoWalkTargetId);
    if (!target) {
      this._autoWalkTargetId = null;
      return;
    }
    const cam = this._camera.position;
    // La puerta mira al puerto: normal de la puerta y punto de aproximación
    // DELANTE de ella. El autopiloto va primero a ese punto (para entrar de
    // frente, no por un lateral) y solo entonces embiste la puerta.
    const nx = Math.sin(target.doorYaw ?? 0);
    const nz = Math.cos(target.doorYaw ?? 0);
    const approach = { x: target.wx + nx * AUTOWALK_APPROACH, z: target.wz + nz * AUTOWALK_APPROACH };
    const nearApproach = Math.hypot(approach.x - cam.x, approach.z - cam.z) < AUTOWALK_APPROACH * 0.6;
    // Sub-objetivo: el punto frente a la puerta hasta llegar a él; después, la
    // propia casa (embestir la puerta de frente para entrar).
    const goal = nearApproach ? { x: target.wx, z: target.wz } : approach;
    const dx = goal.x - cam.x;
    const dz = goal.z - cam.z;
    const dist = Math.hypot(dx, dz) || 1;
    const dirx = dx / dist;
    const dirz = dz / dist;
    // GIRA la cámara HACIA el objetivo con rotateTowards (robusto, nivela el
    // cabeceo al mirar a la misma altura) — nada de aritmética de euler
    // compartido: gira suave y sin NaN. Matrix4.lookAt(ojo, objetivo, up) da la
    // orientación en convención de CÁMARA (−z hacia el objetivo); un Object3D
    // normal orientaría el +z y saldría de espaldas.
    const THREE = this._THREE;
    this._autoMat ??= new THREE.Matrix4();
    this._autoQuat ??= new THREE.Quaternion();
    this._autoUp ??= new THREE.Vector3(0, 1, 0);
    this._autoGoal ??= new THREE.Vector3();
    this._autoGoal.set(goal.x, cam.y, goal.z);
    this._autoMat.lookAt(cam, this._autoGoal, this._autoUp);
    this._autoQuat.setFromRotationMatrix(this._autoMat);
    this._camera.quaternion.rotateTowards(this._autoQuat, TURN_SPEED * dt);
    this._autoWalkElapsed = (this._autoWalkElapsed ?? 0) + dt;
    // ¿mira ya al objetivo? coseno del ángulo entre el forward (plano) y la
    // dirección al objetivo. AVANZA solo cuando lo tiene DELANTE: así sale de
    // espaldas, GIRA sobre sí mismo, y camina de FRENTE — nunca de lado.
    const look = this._camera.getWorldDirection(this._walkDirScratch);
    const flen = Math.hypot(look.x, look.z) || 1;
    const facing = (look.x / flen) * dirx + (look.z / flen) * dirz;
    if (facing > Math.cos(AUTOWALK_FACING)) {
      const next = stepPosition({ x: cam.x, z: cam.z }, { x: dirx, z: dirz }, dt, WALK_SPEED, { radius: this._walkRadius });
      const colCities = collideWithCities({ x: cam.x, z: cam.z }, next, this._walkCities, CITY_COLLIDER_RADIUS);
      const col = this._collideWizard({ x: cam.x, z: cam.z }, colCities);
      this._fpsPhase += Math.hypot(col.x - cam.x, col.z - cam.z) * AVATAR.stepFreq;
      const steps = Math.floor(this._fpsPhase / Math.PI);
      if (steps > this._fpsStepCount) this._audio.step();
      this._fpsStepCount = steps;
      cam.x = col.x;
      cam.z = col.z;
      if (colCities.hitCityId === this._autoWalkTargetId && this._insideCityId === null) {
        this._enterCity(colCities.hitCityId);
        this._autoWalkTargetId = null;
        return;
      }
    }
    if (this._autoWalkElapsed > AUTOWALK_TIMEOUT_S) this._autoWalkTargetId = null;
  }

  /**
   * Ordena al avatar caminar hasta una casa (JG-21, API pública para
   * <career-app> desde «Llévame»/enlaces). Solo tiene efecto a pie; en aérea
   * <career-app> usa focusCity. Arranca el autopiloto (lo cancela cualquier
   * tecla de movimiento en _onKeyDown).
   * @param {string} cityId
   * @returns {boolean} true si la casa existe en esta isla y se inició la marcha.
   */
  walkToCity(cityId) {
    if (this._mode !== 'fps') return false;
    if (!this._walkCities.some((c) => c.id === cityId)) return false;
    this._autoWalkTargetId = cityId;
    this._autoWalkElapsed = 0;
    return true;
  }

  /**
   * ¿El caminante se acerca a la casa por su FRONTAL (la puerta)? (JG-25 fix).
   * La puerta mira al puerto (doorYaw): se entra solo si el jugador está en el
   * arco frontal — su posición, respecto al eje de la casa, cae del lado de la
   * puerta. Rodear a un lateral o la trasera no abre la tarjeta.
   * @param {string} cityId @param {{x:number,z:number}} fromPos
   */
  _isFrontalApproach(cityId, fromPos) {
    const city = this._walkCities.find((c) => c.id === cityId);
    if (!city) return false;
    const px = fromPos.x - city.wx;
    const pz = fromPos.z - city.wz;
    const plen = Math.hypot(px, pz) || 1;
    // Normal de la puerta (cara +z local girada por doorYaw) y coseno del ángulo
    // con la dirección casa→jugador: > cos(~75°) = está delante de la puerta.
    const nx = Math.sin(city.doorYaw ?? 0);
    const nz = Math.cos(city.doorYaw ?? 0);
    return (px * nx + pz * nz) / plen > 0.26;
  }

  /** Ciudad cercana al caminante, para el resalte emisivo y el prompt «[E] Entrar en». */
  _updateProximity() {
    const cam = this._camera.position;
    // Barca del muelle (MC-14): el prompt «[E] Zarpar» sale al acercarse a
    // ella (la ciudad cercana, si la hay, tiene prioridad en el HUD).
    this._nearBoat = this._boatSpot
      ? Math.hypot(cam.x - this._boatSpot.x, cam.z - this._boatSpot.z) <= BOAT_PROXIMITY_RADIUS
      : false;
    // La cabaña del brujo (MC-22): prompt «[E] El brujo» — mismo radio que
    // las ciudades; en el HUD la ciudad cercana manda y la barca cede.
    this._nearWizard = this._wizardSpotW
      ? Math.hypot(cam.x - this._wizardSpotW.wx, cam.z - this._wizardSpotW.wz) <= PROXIMITY_RADIUS
      : false;
    const near = nearestCityWithin({ x: cam.x, z: cam.z }, this._walkCities, PROXIMITY_RADIUS);
    const id = near?.id ?? null;
    if (id === this._nearCityId) return;
    this._nearCityId = id;
    this._rebuildCities(); // aplica/retira el resalte emisivo de proximidad
  }

  /** Abre el panel de ciudadanía de la ciudad cercana ([E] o clic). */
  _openNearCity() {
    if (this._nearCityId) this._openCityPanel(this._nearCityId);
  }

  /**
   * Zarpar (MC-14): abre el mapa del archipiélago en <career-app>. Desde el
   * modo inmersivo suelta el pointer lock (JG-3: se vuelve al modo libre) para
   * que el ratón pueda usar el overlay; al cerrarlo se sigue en modo libre.
   */
  _openArchipelago() {
    this._keys.clear(); // sin lock no habrá pointerlockchange que las suelte (MC-18)
    if (this._fpsLocked) document.exitPointerLock();
    this.dispatchEvent(
      new CustomEvent('open-archipelago', { bubbles: true, composed: true }),
    );
  }

  /**
   * Abre el panel de ciudadanía de una ciudad a pie, SIN salir del modo
   * primera persona. Desde el modo inmersivo suelta el pointer lock (JG-3): al
   * cerrar el panel se sigue en modo LIBRE — el ✕/Escape cierran siempre, sin
   * bailes de re-captura.
   * @param {string} cityId
   */
  _openCityPanel(cityId) {
    this._keys.clear(); // sin lock no habrá pointerlockchange que las suelte (MC-18)
    if (this._fpsLocked) document.exitPointerLock();
    this.dispatchEvent(
      new CustomEvent('select-city', { detail: { cityId }, bubbles: true, composed: true }),
    );
  }

  /**
   * Entrada en una casa por choque frontal (MC-9 a pie, MC-10 con el avatar en
   * vista aérea): el caminante queda detenido en la puerta (la colisión ya lo
   * dejó en el borde), se abre su panel de ciudadanía (mismo flujo que la
   * tecla E) y `_insideCityId` recuerda la casa para poder «salir dando hacia
   * atrás» (↓/S). Las teclas de marcha se sueltan: dentro no se camina.
   * @param {string} cityId
   */
  _enterCity(cityId) {
    this._insideCityId = cityId;
    this._keys.clear();
    this._openCityPanel(cityId);
  }

  /**
   * Salida de la casa dando hacia atrás (↓/S con el panel abierto por choque,
   * MC-9/10): cierra el panel (select-city con cityId null: el contenedor
   * deselecciona) y retrocede al caminante unos pasos alejándose de la puerta
   * (stepPosition: acotado a la isla). En vista aérea el que retrocede es el
   * AVATAR; a pie retrocede la cámara y se sigue en modo LIBRE (JG-3: nada de
   * re-capturas del ratón — «🎮 inmersivo» es siempre una decisión del jugador).
   */
  _exitCity() {
    const city = this._walkCities.find((c) => c.id === this._insideCityId) ?? null;
    this._insideCityId = null;
    this.dispatchEvent(
      new CustomEvent('select-city', { detail: { cityId: null }, bubbles: true, composed: true }),
    );
    if (this._mode === 'aerial') {
      if (city && this._avatar) {
        const away = { x: this._avatarPos.x - city.wx, z: this._avatarPos.z - city.wz };
        if (Math.hypot(away.x, away.z) > 1e-6) {
          this._avatarPos = stepPosition(this._avatarPos, away, 1, CITY_EXIT_BACKSTEP, {
            radius: this._walkRadius,
          });
          this._placeAvatar();
        }
      }
      return;
    }
    if (city) {
      const cam = this._camera.position;
      const away = { x: cam.x - city.wx, z: cam.z - city.wz };
      if (Math.hypot(away.x, away.z) > 1e-6) {
        const next = stepPosition({ x: cam.x, z: cam.z }, away, 1, CITY_EXIT_BACKSTEP, {
          radius: this._walkRadius,
        });
        cam.x = next.x;
        cam.z = next.z;
        cam.y = groundHeightAt(cam.x, cam.z, { radius: this._islandR }) + EYE_HEIGHT;
      }
    }
  }

  /**
   * true si la tecla se está escribiendo en un campo editable (input, textarea,
   * select o contenteditable) — p. ej. las evidencias del panel de ciudadanía.
   * Con shadow DOM `event.target` se RETARGETEA al host en el documento, así
   * que se mira el origen real con composedPath().
   * @param {KeyboardEvent} event
   */
  static _isTypingTarget(event) {
    const origin = event.composedPath()[0];
    if (!(origin instanceof HTMLElement)) return false;
    return origin.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(origin.tagName);
  }

  /** Notifica el cambio de modo de cámara a <career-app> (adapta su HUD). @param {'aerial'|'fps'} mode */
  _emitMode(mode) {
    this.dispatchEvent(
      new CustomEvent('mode-change', { detail: { mode }, bubbles: true, composed: true }),
    );
  }

  /**
   * Corte duro a vista aérea (cambio de isla bajo los pies): sin animación.
   * El encuadre lo repone _frameIsland justo después.
   */
  _resetToAerial() {
    this._camAnim = null;
    this._keys.clear();
    this._endFpsDrag();
    this._nearCityId = null;
    this._insideCityId = null;
    this._nearBoat = false;
    this._nearWizard = false;
    if (this.renderRoot.pointerLockElement) document.exitPointerLock();
    if (this._plc) this._plc.enabled = false;
    this._controls.enabled = true;
    this._setLabelsVisible(true);
    this._setAvatarVisible(true); // el avatar de la vista aérea vuelve a verse
    if (this._mode !== 'aerial') {
      this._mode = 'aerial';
      this._emitMode('aerial');
    }
  }

  /** Ayuda compacta del modo a pie LIBRE (JG-3, el default): arrastrar para mirar + teclado. */
  static FPS_HELP_FREE = html`<div class="fps-help">arrastra para mirar · ←→ girar · ↑↓ avanzar · A/D lateral · E entrar · 🎮 inmersivo</div>`;

  /** Ayuda compacta del 🎮 modo inmersivo (pointer lock): mouse-look continuo, Esc lo suelta. */
  static FPS_HELP_IMMERSIVE = html`<div class="fps-help">←→ girar · ↑↓ avanzar · A/D lateral · Q/E o RePág/AvPág mirar · Shift correr · E entrar · Esc salir</div>`;

  /**
   * HUD inferior del modo fps: ayuda compacta de controles siempre visible
   * (la del modo libre o la del inmersivo, JG-3) y encima el prompt de
   * proximidad ([E] ciudad/brujo/barca) cuando lo hay — la proximidad no
   * depende del ratón, así que el prompt sale en AMBOS modos.
   */
  _renderFpsHint() {
    if (this._mode !== 'fps') return null;
    // Dentro de una casa por choque (MC-9): la salida natural es dar atrás.
    if (this._insideCityId !== null) {
      return html`<div class="fps-hint"><kbd>↓</kbd>/<kbd>S</kbd> da hacia atrás para salir a la isla</div>`;
    }
    const city = this._nearCityId
      ? (this.map?.cities ?? []).find((c) => c.id === this._nearCityId)
      : null;
    return html`
      ${city
        ? html`<div class="fps-hint near"><kbd>E</kbd> Entrar en ${city.name}</div>`
        : this._nearWizard
          ? html`<div class="fps-hint near"><kbd>E</kbd> El brujo</div>`
          : this._nearBoat
            ? html`<div class="fps-hint near"><kbd>E</kbd> Zarpar</div>`
            : null}
      ${this._fpsLocked ? CareerIsland3D.FPS_HELP_IMMERSIVE : CareerIsland3D.FPS_HELP_FREE}
    `;
  }

  /**
   * Hint del avatar en vista aérea (MC-10): ayuda compacta de teclado (no
   * aplica en táctil: sin teclado no hay marcha) y, «dentro» de una casa por
   * choque, cómo salir dando hacia atrás.
   */
  _renderAerialHint() {
    if (this._mode !== 'aerial' || this._phase !== 'ready' || !this.map || this._coarsePointer) {
      return null;
    }
    if (this._insideCityId !== null) {
      return html`<div class="fps-hint"><kbd>↓</kbd>/<kbd>S</kbd> da hacia atrás para salir a la isla</div>`;
    }
    return html`<div class="fps-help">WASD / flechas mueven tu avatar · Shift corre · chocar de frente con una casa te hace entrar en ella</div>`;
  }

  /** @param {ResizeObserverEntry[]} entries */
  _onResize(entries) {
    const { width, height } = entries[0].contentRect;
    if (!this._renderer || width === 0 || height === 0) return;
    this._renderer.setSize(width, height, false);
    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();
    // El muestreo de etiquetas (MC-17) proyecta a px CSS de este viewport.
    this._viewW = width;
    this._viewH = height;
  }

  // ---- Construcción de la escena ---------------------------------------------

  /** Rehace toda la escena; re-encuadra la cámara solo si cambió la isla (map.id). */
  _rebuildAll() {
    if (!this.map) return;
    this._islandR = islandRadius(this.map);
    this._walkRadius = walkableRadius(this._islandR);
    // Posiciones de mundo de las ciudades para la marcha: colisión por frame y
    // muestreo de proximidad comparten esta lista (se rehace con el mapa). Cada
    // casa guarda el yaw de su PUERTA (mira al puerto, facadeYawToward): sirve
    // para entrar SOLO por el frontal (JG-25 fix) y para que el autopiloto se
    // coloque delante de la puerta antes de entrar.
    const portForDoor = this.map.startPort
      ? worldFromMap(this.map.startPort.x, this.map.startPort.y)
      : { wx: 0, wz: 0 };
    this._walkCities = (this.map.cities ?? []).map((c) => {
      const w = worldFromMap(c.x, c.y);
      return { id: c.id, ...w, doorYaw: facadeYawToward(w, portForDoor) };
    });
    if (this.map.id !== this._lastMapId) this._clearPlateCache(); // otra isla, otras placas
    // La cabaña del brujo (MC-22): posición determinista ANTES del grupo
    // estático (la vegetación la excluye). Acotada al radio caminable para que
    // siempre se pueda llegar a pie.
    this._wizardSpotW = wizardSpot(this.map, { maxRadius: this._walkRadius - WIZARD.colliderRadius });
    this._nearWizard = false;
    // Vallas TRIBBU (MC-23): posiciones deterministas ANTES del grupo estático
    // (la vegetación las excluye), acotadas al radio caminable — se ven de
    // cerca a pie — y esquivando la cabaña del brujo.
    this._billboardSpotsW = billboardSpots(this.map, {
      maxRadius: this._walkRadius - 2,
      avoid: [
        {
          x: this._wizardSpotW.wx,
          z: this._wizardSpotW.wz,
          r: WIZARD.colliderRadius + BILLBOARD.avoidWizard,
        },
      ],
    });
    // Carteles de comarca (JG-7): sus puntos se calculan ANTES del grupo
    // estático (la vegetación los excluye), esquivando casas y brujo.
    this._areaSignSpots = this._computeAreaSignSpots();
    // La barca vive en el grupo estático: sus referencias se rehacen con él
    // (y quedan null en un mapa sin puerto, MC-14).
    this._boatGroup = null;
    this._boatSpot = null;
    this._nearBoat = false;
    this._replaceGroup('_staticGroup', this._buildStatic());
    this._rebuildCities();
    this._rebuildWizard(); // la cabaña del brujo depende del mapa (MC-22)
    this._rebuildTeammates(); // las posiciones de los compañeros dependen del mapa (MC-12)
    // Avatar de la vista aérea (MC-10): se construye UNA vez (vive en la
    // escena, fuera de los grupos que se rehacen) y se recoloca por isla.
    if (!this._avatar) {
      this._avatar = this._buildAvatar();
      this._scene.add(this._avatar);
    }
    if (this.map.id !== this._lastMapId) {
      this._lastMapId = this.map.id;
      // Si cambia la ISLA con el caminante dentro, el modo a pie no sobrevive.
      if (this._mode !== 'aerial') this._resetToAerial();
      this._resetAvatar(); // nueva isla: el avatar aparece en su spawn
      this._frameIsland();
    }
    // Etiquetas recién construidas: escala y declutter aplicados YA, sin
    // esperar (hasta LABEL_FADE_MS) un frame de rótulos pisándose (MC-17).
    this._updateLabels();
  }

  _rebuildCities() {
    if (!this.map) return;
    this._replaceGroup('_citiesGroup', this._buildCities());
    // La capa estática del minimapa refleja estados y senda: se repinta en la
    // próxima composición (MC-13). Marcarla aquí cubre journey/reachable/mapa.
    this._minimapDirty = true;
    this._updateLabels(); // etiquetas nuevas: ni un frame sin escala/declutter (MC-17)
  }

  /** Sustituye un grupo de la escena liberando los recursos GPU del anterior. */
  _replaceGroup(field, nextGroup) {
    const prev = this[field];
    if (prev) {
      this._scene.remove(prev);
      CareerIsland3D._disposeSubtree(prev);
    }
    this[field] = nextGroup;
    this._scene.add(nextGroup);
  }

  /** Encuadre aéreo inicial + límites de zoom proporcionales al radio de la isla. */
  _frameIsland() {
    const R = this._islandR;
    const { position, target } = this._overviewPose();
    this._camera.far = R * 20;
    this._camera.position.copy(position);
    this._camera.updateProjectionMatrix();
    this._controls.target.copy(target);
    this._controls.minDistance = R * 0.3;
    this._controls.maxDistance = R * 4;
    this._controls.update();
    // Niebla suave para fundir el horizonte con el color de la propia cúpula
    // de cielo (MC-10): lo lejano se disuelve sin costura.
    this._scene.fog = new this._THREE.Fog(SKY_COLORS.horizon, R * 4, R * 10);
    // El encuadre ortográfico de la shadow camera del sol cubre toda la isla.
    if (SHADOWS.enabled && this._sun) {
      const cam = this._sun.shadow.camera;
      cam.left = -R * 1.4;
      cam.right = R * 1.4;
      cam.top = R * 1.4;
      cam.bottom = -R * 1.4;
      cam.near = 20;
      cam.far = 420;
      cam.updateProjectionMatrix();
    }
  }

  /** Grupo estático: agua, isla (playa + hierba), plataformas de comarca y puerto. */
  _buildStatic() {
    const THREE = this._THREE;
    const R = this._islandR;
    const group = new THREE.Group();
    // Las banderas de paño (JG-7) viven en este grupo: se rehacen con él.
    this._flags = [];

    // Agua VIVA (MC-10): plano subdividido alrededor de la isla cuyos vértices
    // ondulan con un seno en el loop (_tickEnvironment). El plano llega más
    // allá de la niebla: el borde nunca se ve.
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(
        R * WATER.sizeFactor,
        R * WATER.sizeFactor,
        WATER.segments,
        WATER.segments,
      ),
      new THREE.MeshLambertMaterial({ color: ENV_COLORS.water, transparent: true, opacity: 0.9 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = TERRAIN.waterY;
    this._waterMesh = water;
    group.add(water);

    // Espuma: cinta clara siguiendo la línea de costa (mismo coastFactor).
    group.add(this._buildFoam());

    // Playa: anillo de arena en pendiente con costa irregular (low-poly).
    // El perfil (radios, alto, irregularidad) viene de walk.js: es el MISMO
    // suelo que pisa el modo primera persona (groundHeightAt). Con textura
    // procedural de granulado (MC-10) para que de cerca no sea color plano.
    const beach = new THREE.Mesh(
      this._coastGeometry(
        R + TERRAIN.beach.topPad,
        R + TERRAIN.beach.bottomPad,
        TERRAIN.beach.height,
        TERRAIN.beach.amount,
      ),
      new THREE.MeshLambertMaterial({ map: this._envTexture('sand'), flatShading: true }),
    );
    beach.position.y = TERRAIN.baseY;
    beach.receiveShadow = SHADOWS.enabled;
    group.add(beach);

    // Interior: meseta de hierba donde viven comarcas y ciudades, con textura
    // procedural moteada (MC-10). Recibe las sombras de casas y árboles.
    const grass = new THREE.Mesh(
      this._coastGeometry(
        R + TERRAIN.grass.topPad,
        R + TERRAIN.grass.bottomPad,
        TERRAIN.grass.height,
        TERRAIN.grass.amount,
      ),
      new THREE.MeshLambertMaterial({ map: this._envTexture('grass'), flatShading: true }),
    );
    grass.position.y = TERRAIN.baseY;
    grass.receiveShadow = SHADOWS.enabled;
    group.add(grass);

    // Camino de tierra insinuado (JG-7): del arranque del muelle hacia el
    // interior, con comba determinista — por debajo de senda y ruta.
    if (this.map.startPort) group.add(this._buildDirtPath());

    // Ambiente (MC-10): cúpula de cielo con gradiente, nubes con deriva y
    // vegetación/rocas instanciadas y deterministas.
    group.add(this._buildSky());
    this._clouds = this._buildClouds();
    for (const cloud of this._clouds) group.add(cloud);
    group.add(this._buildVegetation());

    // Comarcas: parche circular sutil + etiqueta flotante con el nombre.
    // Los parches son raycasteables (MC-6): clic en la plataforma → zoom a la
    // comarca. Contra el z-fighting con la hierba (parpadeo al caminar, MC-8):
    // elevados PATCH_LIFT y con polygonOffset que sesga su profundidad.
    this._areaPatches = [];
    this._areaLabels = [];
    const labelsVisible = this._mode === 'aerial' || this._mode === 'to-aerial';
    for (const { area, center, radius, color } of areaLayout(this.map)) {
      const patch = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 24),
        new THREE.MeshLambertMaterial({
          color,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }),
      );
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(center.wx, GROUND_Y + PATCH_LIFT, center.wz);
      patch.receiveShadow = SHADOWS.enabled; // si no, taparían las sombras de la hierba
      patch.userData.areaId = area.id;
      this._areaPatches.push(patch);
      group.add(patch);
      const label = this._makeLabel(area.name, {
        x: center.wx,
        y: GROUND_Y + 10.5,
        z: center.wz,
        scale: 6.5,
        color: '#5b6b7d',
        id: `area:${area.id}`,
        kind: 'area',
        targetPx: LABEL_PX.area,
        priority: LABEL_PRIORITY.area,
      });
      label.visible = labelsVisible;
      this._areaLabels.push(label);
      group.add(label);
      // Cartel de madera colgante (JG-7): el topónimo de cerca; el sprite de
      // arriba sigue haciendo la lectura aérea/lejana con su declutter.
      const signSpot = this._areaSignSpots.get(area.id);
      if (signSpot) group.add(this._buildAreaSign(signSpot));
    }

    // Vallas TRIBBU (MC-23): decorativas y deterministas, flanqueando la
    // senda de llegada — la marca recibe al viajero desde el mar y desde el aire.
    for (const spot of this._billboardSpotsW) group.add(this._buildTribbuBillboard(spot));

    if (this.map.startPort) group.add(this._buildPort(this.map.startPort, labelsVisible));
    // Isla sin ciudades (aún sin contenido, MC-14): cartel «En construcción»
    // recibiendo al viajero junto al puerto. La generación del resto de la
    // isla (terreno, puerto, vegetación) ya tolera mapas vacíos.
    if ((this.map.cities ?? []).length === 0) group.add(this._buildConstructionSign());
    return group;
  }

  /**
   * Cartel de obra low-poly para las islas-placeholder (MC-14): dos postes de
   * madera y un tablero con «En construcción», plantado unos pasos hacia el
   * interior desde el puerto y mirando HACIA él (el viajero lo lee al llegar).
   * En un mapa sin puerto, en el centro de la isla mirando al sur.
   */
  _buildConstructionSign() {
    const THREE = this._THREE;
    const group = new THREE.Group();
    let x = 0;
    let z = 0;
    let yaw = 0;
    if (this.map.startPort) {
      const { wx, wz } = worldFromMap(this.map.startPort.x, this.map.startPort.y);
      const d = Math.hypot(wx, wz);
      const ux = d > 0.001 ? wx / d : 0;
      const uz = d > 0.001 ? wz / d : 1;
      x = wx - ux * SIGN_INLAND_OFFSET;
      z = wz - uz * SIGN_INLAND_OFFSET;
      yaw = Math.atan2(wx - x, wz - z); // la cara del tablero (+z local) mira al puerto
    }
    group.position.set(x, groundHeightAt(x, z, { radius: this._islandR }), z);
    group.rotation.y = yaw;

    const postMat = new THREE.MeshLambertMaterial({
      color: ENV_COLORS.post,
      flatShading: true,
      map: this._envTexture('wood'),
    });
    const postGeo = new THREE.CylinderGeometry(0.14, 0.16, 3.1, 6);
    for (const lx of [-1.6, 1.6]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(lx, 1.55, 0);
      post.castShadow = SHADOWS.enabled;
      group.add(post);
    }
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 1.7, 0.14),
      new THREE.MeshLambertMaterial({ color: ENV_COLORS.plank, flatShading: true, map: this._envTexture('wood') }),
    );
    board.position.set(0, 2.5, 0);
    board.castShadow = SHADOWS.enabled;
    group.add(board);
    // Texto pintado en un canvas (no cacheado: un cartel por build, lo libera
    // _disposeSubtree con el grupo estático).
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 208;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f6ead2';
    ctx.fillRect(0, 0, 512, 208);
    ctx.strokeStyle = '#7a5a33';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 502, 198);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1e3a5f';
    ctx.font = '700 58px system-ui, sans-serif';
    ctx.fillText('🚧 En construcción', 256, 78);
    ctx.fillStyle = '#5b6b7d';
    ctx.font = '600 30px system-ui, sans-serif';
    ctx.fillText('Esta disciplina llegará pronto', 256, 148);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(3.9, 1.55),
      new THREE.MeshBasicMaterial({ map: texture }),
    );
    face.position.set(0, 2.5, 0.08);
    group.add(face);
    return group;
  }

  /**
   * Camino de tierra insinuado (JG-7): cinta translúcida (ribbonStrip, el
   * mecanismo de la senda) desde unos pasos tierra adentro del muelle hacia
   * el interior de la isla, con una comba lateral DETERMINISTA (una única
   * amplitud por isla, hashUnit) para que no sea una regla. Decal del suelo:
   * elevación mínima + polygonOffset, por debajo de senda y ruta.
   */
  _buildDirtPath() {
    const { wx, wz } = worldFromMap(this.map.startPort.x, this.map.startPort.y);
    const d = Math.hypot(wx, wz);
    const ux = d > 0.001 ? wx / d : 0;
    const uz = d > 0.001 ? wz / d : 1;
    // Perpendicular a la dirección puerto→centro: el eje de la comba.
    const px = -uz;
    const pz = ux;
    const seed = hashId(`dirt:${this.map.id}`);
    const sway = (hashUnit(seed, 1) - 0.5) * 2 * DIRT_PATH.swayAmp;
    const len = Math.min(d * DIRT_PATH.lenFactor, this._islandR * 0.6);
    const points = [];
    for (let i = 0; i <= DIRT_PATH.steps; i += 1) {
      const t = i / DIRT_PATH.steps;
      const along = 2 + len * t; // arranca unos pasos tierra adentro del muelle
      const side = Math.sin(t * Math.PI) * sway; // comba en arco, extremos fijos
      points.push({ wx: wx - ux * along + px * side, wz: wz - uz * along + pz * side });
    }
    return this._buildGroundRibbon(points, {
      width: DIRT_PATH.width,
      color: ENV_COLORS.dirt,
      opacity: DIRT_PATH.opacity,
      y: GROUND_Y + DIRT_PATH.lift,
    });
  }

  /**
   * Punto del cartel de cada comarca (JG-7), determinista: hacia el borde de
   * su plataforma en dirección al puerto (el viajero lo lee al llegar), con
   * un barrido de yaws si el candidato cae encima de una casa o de la cabaña
   * del brujo (mismo espíritu que wizardSpot). Una comarca sin hueco libre se
   * queda sin cartel: su sprite flotante basta.
   * @returns {Map<string, { wx: number, wz: number, yaw: number, name: string }>}
   */
  _computeAreaSignSpots() {
    const spots = new Map();
    if (!this.map) return spots;
    const portW = this.map.startPort
      ? worldFromMap(this.map.startPort.x, this.map.startPort.y)
      : null;
    const clearance = CITY_COLLIDER_RADIUS + AREA_SIGN.clearance;
    for (const { area, center, radius } of areaLayout(this.map)) {
      // Objetivo al que mira el tablón: el puerto (o el centro sin puerto).
      const tx = portW?.wx ?? 0;
      const tz = portW?.wz ?? 0;
      const base = Math.atan2(tx - center.wx, tz - center.wz);
      for (const off of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, Math.PI]) {
        const a = base + off;
        const wx = center.wx + Math.sin(a) * radius * AREA_SIGN.inset;
        const wz = center.wz + Math.cos(a) * radius * AREA_SIGN.inset;
        const hitsCity = this._walkCities.some(
          (c) => Math.hypot(c.wx - wx, c.wz - wz) < clearance,
        );
        const hitsWizard = this._wizardSpotW
          ? Math.hypot(this._wizardSpotW.wx - wx, this._wizardSpotW.wz - wz) <
            WIZARD.colliderRadius + AREA_SIGN.clearance
          : false;
        if (!hitsCity && !hitsWizard) {
          spots.set(area.id, {
            wx,
            wz,
            yaw: facadeYawToward({ wx, wz }, { wx: tx, wz: tz }),
            name: area.name,
          });
          break;
        }
      }
    }
    return spots;
  }

  /**
   * Cartel de MADERA de comarca (JG-7): poste con brazo, dos cadenitas y
   * tablón colgante con el nombre quemado (textura cacheada, _signTexture).
   * Cara delantera y trasera con la MISMA textura (legible desde ambos
   * lados). Decorativo: sin colisión ni picking, como las vallas TRIBBU.
   * @param {{ wx: number, wz: number, yaw: number, name: string }} spot
   */
  _buildAreaSign(spot) {
    const THREE = this._THREE;
    const group = new THREE.Group();
    group.position.set(
      spot.wx,
      groundHeightAt(spot.wx, spot.wz, { radius: this._islandR }),
      spot.wz,
    );
    group.rotation.y = spot.yaw;
    const woodMat = new THREE.MeshLambertMaterial({
      color: ENV_COLORS.post,
      flatShading: true,
      map: this._envTexture('wood'),
    });
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(AREA_SIGN.postR, AREA_SIGN.postR + 0.03, AREA_SIGN.postH, 6),
      woodMat,
    );
    post.position.y = AREA_SIGN.postH / 2;
    post.castShadow = SHADOWS.enabled;
    group.add(post);
    // Brazo horizontal del que cuelga el tablón (+x local).
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(AREA_SIGN.armR, AREA_SIGN.armR, AREA_SIGN.armLen, 6),
      woodMat,
    );
    arm.rotation.z = Math.PI / 2;
    arm.position.set(AREA_SIGN.armLen / 2 - AREA_SIGN.postR, AREA_SIGN.armY, 0);
    arm.castShadow = SHADOWS.enabled;
    group.add(arm);
    const plankX = AREA_SIGN.armLen * 0.55;
    const plankTop = AREA_SIGN.armY - AREA_SIGN.chainDrop;
    // Cadenitas: dos cilindros finos del brazo al canto superior del tablón.
    const chainGeo = new THREE.CylinderGeometry(0.02, 0.02, AREA_SIGN.chainDrop, 4);
    const chainMat = new THREE.MeshLambertMaterial({ color: 0x4a4a4a, flatShading: true });
    for (const lx of [plankX - AREA_SIGN.plankW / 2 + 0.18, plankX + AREA_SIGN.plankW / 2 - 0.18]) {
      const chain = new THREE.Mesh(chainGeo, chainMat);
      chain.position.set(lx, plankTop + AREA_SIGN.chainDrop / 2, 0);
      group.add(chain);
    }
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(AREA_SIGN.plankW, AREA_SIGN.plankH, AREA_SIGN.plankD),
      new THREE.MeshLambertMaterial({
        color: ENV_COLORS.plank,
        flatShading: true,
        map: this._envTexture('wood'),
      }),
    );
    plank.position.set(plankX, plankTop - AREA_SIGN.plankH / 2, 0);
    plank.castShadow = SHADOWS.enabled;
    group.add(plank);
    // Cara del nombre por delante Y por detrás (cada plano mira a su lado:
    // el texto se lee bien desde ambos, sin espejos).
    const faceGeo = new THREE.PlaneGeometry(AREA_SIGN.plankW - 0.12, AREA_SIGN.plankH - 0.08);
    const faceMat = new THREE.MeshBasicMaterial({ map: this._signTexture(spot.name) });
    for (const side of [1, -1]) {
      const face = new THREE.Mesh(faceGeo, faceMat);
      face.position.set(plankX, plankTop - AREA_SIGN.plankH / 2, side * (AREA_SIGN.plankD / 2 + 0.01));
      if (side === -1) face.rotation.y = Math.PI;
      group.add(face);
    }
    return group;
  }

  /**
   * Textura del tablón de comarca (JG-7): madera clara con veta determinista
   * y el nombre QUEMADO (halo de quemado ancho + tinta marrón muy oscura,
   * serif del sistema). Cacheada por nombre en _plateTextures (clave
   * "sign:", userData.shared): se libera con la caché al cambiar de isla.
   * @param {string} name
   */
  _signTexture(name) {
    const key = `sign:${name}`;
    let texture = this._plateTextures.get(key);
    if (texture) return texture;
    const THREE = this._THREE;
    const seed = hashId(`sign:${name}`);
    const rnd = (i) => hashUnit(seed, i);
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 104;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#c19a63';
    ctx.fillRect(0, 0, 320, 104);
    // Veta de la madera del tablón.
    for (let i = 0; i < 9; i += 1) {
      const y = rnd(i * 4) * 104;
      ctx.strokeStyle = `rgba(90, 58, 25, ${(0.12 + rnd(i * 4 + 1) * 0.14).toFixed(3)})`;
      ctx.lineWidth = 1 + rnd(i * 4 + 2) * 1.6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(106, y + rnd(i * 4 + 3) * 8 - 4, 212, y - (rnd(i * 4 + 1) * 8 - 4), 320, y);
      ctx.stroke();
    }
    // Borde quemado del tablón.
    ctx.strokeStyle = 'rgba(52, 30, 10, 0.65)';
    ctx.lineWidth = 7;
    ctx.strokeRect(3.5, 3.5, 313, 97);
    // Nombre quemado: halo ancho de quemado + tinta oscura encima. La fuente
    // se encoge hasta que quepan también los nombres largos.
    let fontSize = 40;
    const font = (px) => `700 ${px}px Georgia, 'Times New Roman', serif`;
    ctx.font = font(fontSize);
    while (fontSize > 16 && ctx.measureText(name).width > 284) {
      fontSize -= 2;
      ctx.font = font(fontSize);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(70, 38, 12, 0.4)';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.strokeText(name, 160, 54);
    ctx.fillStyle = '#3a2008';
    ctx.fillText(name, 160, 54);
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.userData.shared = true;
    this._plateTextures.set(key, texture);
    return texture;
  }

  /**
   * Una valla publicitaria de TRIBBU (MC-23): dos postes de madera y un
   * tablero LIGERAMENTE inclinado hacia el camino (subgrupo con rotation.x:
   * con el yaw mirando al puerto, el tablero se vence hacia el viajero que
   * llega) con la marca en CanvasTexture. Sin colisión: decorativa.
   * @param {{ wx: number, wz: number, yaw: number }} spot
   */
  _buildTribbuBillboard(spot) {
    const THREE = this._THREE;
    const group = new THREE.Group();
    group.position.set(
      spot.wx,
      groundHeightAt(spot.wx, spot.wz, { radius: this._islandR }),
      spot.wz,
    );
    group.rotation.y = spot.yaw;

    const postMat = new THREE.MeshLambertMaterial({
      color: ENV_COLORS.post,
      flatShading: true,
      map: this._envTexture('wood'),
    });
    const postGeo = new THREE.CylinderGeometry(
      BILLBOARD.postR,
      BILLBOARD.postR + 0.03,
      BILLBOARD.postH,
      6,
    );
    for (const lx of [-BILLBOARD.postX, BILLBOARD.postX]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(lx, BILLBOARD.postH / 2, 0);
      post.castShadow = SHADOWS.enabled;
      group.add(post);
    }

    // Tablero + cara de la marca en un subgrupo inclinado hacia el camino:
    // rotación +x → el borde superior (+y) se vence hacia +z (el puerto).
    const tilted = new THREE.Group();
    tilted.position.set(0, BILLBOARD.boardY, 0);
    tilted.rotation.x = BILLBOARD.tilt;
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(BILLBOARD.boardW, BILLBOARD.boardH, BILLBOARD.boardD),
      new THREE.MeshLambertMaterial({
        color: ENV_COLORS.plank,
        flatShading: true,
        map: this._envTexture('wood'),
      }),
    );
    board.castShadow = SHADOWS.enabled;
    tilted.add(board);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(BILLBOARD.faceW, BILLBOARD.faceH),
      new THREE.MeshBasicMaterial({ map: this._tribbuTexture() }),
    );
    face.position.z = BILLBOARD.boardD / 2 + 0.02;
    tilted.add(face);
    group.add(tilted);
    return group;
  }

  /**
   * Textura de la marca TRIBBU (MC-23 + JG-20): la valla se pinta al momento
   * con el emblema procedural (pin de mapa) como base, y en cuanto carga el
   * LOGO OFICIAL local (/img/tribbu-logo-pink.svg, versionado en el repo) se
   * repinta esa zona con él (needsUpdate). Si la imagen falla, la valla se
   * queda con el pin — nunca en blanco. Se pinta UNA vez y se cachea en
   * _envTextures ('tribbu', userData.shared): todas las vallas la comparten y
   * la libera _clearEnvTextures en el teardown, no _disposeSubtree.
   */
  _tribbuTexture() {
    let texture = this._envTextures.get('tribbu');
    if (texture) return texture;
    const THREE = this._THREE;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 232;
    const ctx = canvas.getContext('2d');

    // Fondo blanco con marco teal redondeado.
    ctx.fillStyle = TRIBBU_BRAND.white;
    ctx.fillRect(0, 0, 512, 232);
    ctx.strokeStyle = TRIBBU_BRAND.teal;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.roundRect(9, 9, 494, 214, 20);
    ctx.stroke();

    // Pin de mapa (marca simple): gota teal con rueda blanca y cubo coral —
    // el guiño «coche compartido» de TRIBBU. Todo con paths.
    const cx = 96;
    const cy = 96;
    const r = 40;
    ctx.fillStyle = TRIBBU_BRAND.teal;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.72, cy + r * 0.62);
    ctx.lineTo(cx + r * 0.72, cy + r * 0.62);
    ctx.lineTo(cx, cy + r * 1.75);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = TRIBBU_BRAND.white;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = TRIBBU_BRAND.coral;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
    ctx.fill();

    // Logotipo: TRIBBU en tipografía redondeada, teal, con subrayado coral
    // (la «carretera» del pin al texto). El tamaño se ajusta al hueco entre el
    // pin y el marco (mismo patrón de encaje que las placas de las puertas).
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = TRIBBU_BRAND.dark;
    const logoFont = (px) =>
      `800 ${px}px ui-rounded, "Arial Rounded MT Bold", "Nunito", system-ui, sans-serif`;
    let fontSize = 80;
    ctx.font = logoFont(fontSize);
    while (fontSize > 40 && ctx.measureText('TRIBBU').width > 512 - 168 - 44) {
      fontSize -= 2;
      ctx.font = logoFont(fontSize);
    }
    ctx.fillText('TRIBBU', 168, 104);
    ctx.strokeStyle = TRIBBU_BRAND.coral;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(172, 168);
    ctx.quadraticCurveTo(320, 148, 468, 168);
    ctx.stroke();

    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.userData.shared = true;
    this._envTextures.set('tribbu', texture);

    // Logo oficial (JG-20): al cargar sustituye el pin procedural. El SVG es
    // el icono cuadrado redondeado de la app; se centra en el hueco del pin.
    const logo = new Image();
    logo.decoding = 'async';
    logo.addEventListener('load', () => {
      ctx.fillStyle = TRIBBU_BRAND.white;
      ctx.fillRect(20, 20, 138, 192);
      ctx.drawImage(logo, 32, 52, 128, 128);
      texture.needsUpdate = true;
    });
    logo.src = '/img/tribbu-logo-pink.svg';
    return texture;
  }

  /**
   * Cilindro low-poly con la costa irregular: los vértices del perímetro se
   * desplazan radialmente con coastFactor (walk.js), determinista y compartido
   * con groundHeightAt — el suelo pintado y el suelo pisado son la misma
   * función, para que la isla no sea un círculo perfecto pero sí estable.
   * @param {number} topR @param {number} bottomR @param {number} height
   * @param {number} amount Amplitud relativa del desplazamiento (0.05 → ±5%).
   */
  _coastGeometry(topR, bottomR, height, amount) {
    const THREE = this._THREE;
    const geo = new THREE.CylinderGeometry(topR, bottomR, height, 40, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 0.001) continue; // vértices centrales de las tapas
      const k = coastFactor(Math.atan2(z, x), amount);
      pos.setX(i, x * k);
      pos.setZ(i, z * k);
    }
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Puerto de inicio RECONOCIBLE (MC-9), no una torre: muelle de tablones de
   * madera clara sobre postes que sale de la costa y se adentra en el agua
   * (la longitud se deriva del MISMO perfil de terreno de walk.js — coastFactor
   * y TERRAIN — así que el final del muelle siempre pisa agua, determinista),
   * faro blanco con franjas rojas (galería con barandilla, linterna cálida
   * emisiva y cúpula roja) y una barca low-poly amarrada al costado. Todo
   * generado por código, con materiales cacheados por color.
   * @param {{x: number, y: number}} port
   * @param {boolean} labelVisible La etiqueta flotante se oculta a pie.
   */
  _buildPort(port, labelVisible) {
    const THREE = this._THREE;
    const { wx, wz } = worldFromMap(port.x, port.y);
    const group = new THREE.Group();
    group.position.set(wx, GROUND_Y, wz);

    /**
     * Materiales del puerto cacheados por color y textura opcional (misma
     * pareja → mismo material). La veta de madera (MC-10) es una textura casi
     * blanca compartida: el color del material la tinta (map × color).
     * @param {number} color @param {string|null} [texKey]
     */
    const materials = new Map();
    const materialFor = (color, texKey = null) => {
      const key = `${color}:${texKey ?? ''}`;
      let m = materials.get(key);
      if (!m) {
        m = new THREE.MeshLambertMaterial({
          color,
          flatShading: true,
          map: texKey ? this._envTexture(texKey) : null,
        });
        materials.set(key, m);
      }
      return m;
    };

    // Todo el puerto se construye en coordenadas locales con +z hacia el MAR
    // (radialmente hacia fuera del centro de la isla): un único giro lo orienta.
    const d = Math.hypot(wx, wz);
    const seaYaw = d > 0.001 ? Math.atan2(wx, wz) : 0;
    const harbor = new THREE.Group();
    harbor.rotation.y = seaYaw;
    group.add(harbor);

    // Longitud del muelle: desde el puerto hasta pasada la línea de agua (la
    // falda de la playa muere en (R + bottomPad)·coastFactor, ver walk.js).
    const R = this._islandR;
    const polar = Math.atan2(wz, wx);
    const waterEdge = (R + TERRAIN.beach.bottomPad) * coastFactor(polar, TERRAIN.beach.amount);
    const dockLen = Math.max(waterEdge - d + 3, 10);

    // Tablones: planos de madera clara con separación entre ellos (pasarela
    // elevada sobre el terreno, como un embarcadero).
    const DECK_Y = 0.5; // altura local del tablero del muelle
    const PLANK = { w: 3.2, t: 0.16, d: 0.92, pitch: 1.24 };
    const plankGeo = new THREE.BoxGeometry(PLANK.w, PLANK.t, PLANK.d);
    const planks = Math.max(Math.floor(dockLen / PLANK.pitch), 2);
    for (let i = 0; i < planks; i += 1) {
      // Veta de madera (MC-10): textura procedural tintada por el color claro.
      const plank = new THREE.Mesh(plankGeo, materialFor(ENV_COLORS.plank, 'wood'));
      plank.position.set(0, DECK_Y, 0.9 + i * PLANK.pitch);
      harbor.add(plank);
    }

    // Postes: pares bajo el muelle cada tres tablones, hundidos en el terreno
    // (o en el agua al final): groundHeightAt es el MISMO suelo del caminante.
    const cosYaw = Math.cos(seaYaw);
    const sinYaw = Math.sin(seaYaw);
    for (let i = 0; i < planks; i += 3) {
      const lz = 0.9 + i * PLANK.pitch;
      for (const lx of [-1.35, 1.35]) {
        // Posición de mundo del poste (rotación manual del offset local).
        const px = wx + lx * cosYaw + lz * sinYaw;
        const pz = wz - lx * sinYaw + lz * cosYaw;
        const bottom = groundHeightAt(px, pz, { radius: R }) - 0.45 - GROUND_Y;
        const len = DECK_Y - bottom;
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.16, len, 6),
          materialFor(ENV_COLORS.post),
        );
        post.position.set(lx, bottom + len / 2, lz);
        harbor.add(post);
      }
    }

    // Atrezzo pirata del muelle (JG-7): barriles, cajas, norays y cuerda.
    harbor.add(this._buildPortProps(materialFor, { wx, wz, seaYaw, deckY: DECK_Y }));

    // Barca low-poly amarrada al costado del muelle, flotando en el agua:
    // casco blanco con borda de madera, banco y proa apuntada. Es la puerta
    // del ARCHIPIÉLAGO (MC-14): clicable en vista aérea (raycast, como las
    // casas) y con prompt «[E] Zarpar» al acercarse a pie.
    const BOAT_LOCAL = { lx: 2.7, lz: dockLen - 1.6 };
    const boat = new THREE.Group();
    boat.position.set(BOAT_LOCAL.lx, TERRAIN.waterY - GROUND_Y, BOAT_LOCAL.lz);
    boat.userData.sail = true;
    this._boatGroup = boat;
    // Posición de MUNDO de la barca (offset local rotado, como los postes):
    // la proximidad a pie se mide contra este punto.
    this._boatSpot = {
      x: wx + BOAT_LOCAL.lx * Math.cos(seaYaw) + BOAT_LOCAL.lz * Math.sin(seaYaw),
      z: wz - BOAT_LOCAL.lx * Math.sin(seaYaw) + BOAT_LOCAL.lz * Math.cos(seaYaw),
    };
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.5, 2.6), materialFor(ENV_COLORS.boat));
    hull.position.y = 0.1;
    boat.add(hull);
    const bowGeo = new THREE.ConeGeometry(0.58, 0.9, 4);
    bowGeo.rotateY(Math.PI / 4); // sección cuadrada alineada con el casco
    bowGeo.rotateX(Math.PI / 2); // vértice hacia +z (proa)
    const bow = new THREE.Mesh(bowGeo, materialFor(ENV_COLORS.boat));
    bow.scale.set(1.4, 0.6, 1);
    bow.position.set(0, 0.1, 1.72);
    boat.add(bow);
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(1.31, 0.14, 2.72),
      materialFor(ENV_COLORS.wood, 'wood'),
    );
    rim.position.y = 0.4;
    boat.add(rim);
    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.1, 0.4),
      materialFor(ENV_COLORS.plank, 'wood'),
    );
    bench.position.y = 0.52;
    boat.add(bench);
    // Aparejo pirata (JG-24): mástil, verga, vela de pergamino y gallardete con
    // calavera — la barca amarrada pasa a leerse como un barquito pirata. Vela
    // y bandera son hijas del grupo: siguen siendo puerta del archipiélago
    // (raycast al clicar cualquier parte, y prompt «[E] Zarpar» a pie).
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.07, 2.5, 6),
      materialFor(ENV_COLORS.wood, 'wood'),
    );
    mast.position.set(0, 1.55, 0.1);
    boat.add(mast);
    const yard = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 1.5, 6),
      materialFor(ENV_COLORS.wood, 'wood'),
    );
    yard.rotation.z = Math.PI / 2;
    yard.position.set(0, 2.35, 0.1);
    boat.add(yard);
    const sail = new THREE.Mesh(
      new THREE.PlaneGeometry(1.35, 1.25),
      new THREE.MeshLambertMaterial({ color: PARCH_SAIL, side: THREE.DoubleSide, flatShading: true }),
    );
    sail.position.set(0, 1.72, 0.1);
    boat.add(sail);
    const pennant = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.36),
      new THREE.MeshBasicMaterial({ map: this._envTexture('jollyroger'), transparent: true, side: THREE.DoubleSide }),
    );
    pennant.position.set(0.32, 2.75, 0.1);
    boat.add(pennant);
    harbor.add(boat);

    // Faro a pie de muelle: torre BLANCA troncocónica con dos franjas rojas,
    // galería con barandilla, linterna cálida (emisiva) y cúpula roja.
    const lighthouse = new THREE.Group();
    lighthouse.position.set(-3.1, 0, 1.2);
    harbor.add(lighthouse);
    const SEG = { h: 1.3, baseR: 1.5, topR: 0.95, count: 5 };
    for (let i = 0; i < SEG.count; i += 1) {
      const r0 = SEG.baseR + ((SEG.topR - SEG.baseR) * i) / SEG.count;
      const r1 = SEG.baseR + ((SEG.topR - SEG.baseR) * (i + 1)) / SEG.count;
      const stripe = new THREE.Mesh(
        new THREE.CylinderGeometry(r1, r0, SEG.h, 12),
        materialFor(i % 2 === 1 ? ENV_COLORS.lighthouseRed : ENV_COLORS.lighthouse),
      );
      stripe.position.y = SEG.h * (i + 0.5);
      lighthouse.add(stripe);
    }
    const towerTop = SEG.h * SEG.count;
    const gallery = new THREE.Mesh(
      new THREE.CylinderGeometry(1.32, 1.32, 0.22, 12),
      materialFor(ENV_COLORS.post),
    );
    gallery.position.y = towerTop + 0.11;
    lighthouse.add(gallery);
    const rail = new THREE.Mesh(
      new THREE.TorusGeometry(1.18, 0.05, 6, 16),
      materialFor(ENV_COLORS.lighthouse),
    );
    rail.rotation.x = Math.PI / 2;
    rail.position.y = towerTop + 0.85;
    lighthouse.add(rail);
    // Linterna: pequeña luz cálida arriba (material emisivo, como las ventanas).
    const lantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.85, 10),
      new THREE.MeshLambertMaterial({
        color: ENV_COLORS.window,
        emissive: ENV_COLORS.windowGlow,
        emissiveIntensity: 0.9,
      }),
    );
    lantern.position.y = towerTop + 0.65;
    lighthouse.add(lantern);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      materialFor(ENV_COLORS.lighthouseRed),
    );
    dome.position.y = towerTop + 1.07;
    lighthouse.add(dome);

    // Bandera pirata (JG-7) en lo alto del faro: mástil fino y paño con
    // calavera que ondea por vértices en _tickEnvironment (como el agua).
    const poleBase = towerTop + 1.35;
    const flagPole = new THREE.Mesh(
      new THREE.CylinderGeometry(PIRATE_FLAG.poleR, PIRATE_FLAG.poleR, PIRATE_FLAG.poleH, 5),
      materialFor(ENV_COLORS.post),
    );
    flagPole.position.y = poleBase + PIRATE_FLAG.poleH / 2;
    lighthouse.add(flagPole);
    const flagGeo = new THREE.PlaneGeometry(
      PIRATE_FLAG.w,
      PIRATE_FLAG.h,
      PIRATE_FLAG.segX,
      PIRATE_FLAG.segY,
    );
    flagGeo.translate(PIRATE_FLAG.w / 2, 0, 0); // el borde izquierdo, fijo al mástil
    const flag = new THREE.Mesh(
      flagGeo,
      new THREE.MeshLambertMaterial({
        map: this._envTexture('jollyroger'),
        side: THREE.DoubleSide,
      }),
    );
    flag.position.y = poleBase + PIRATE_FLAG.poleH - PIRATE_FLAG.h / 2 - 0.06;
    flag.rotation.y = Math.PI / 5; // el paño no queda plano de cara al mar
    // Posiciones base del paño: el ondeo del loop parte SIEMPRE de ellas.
    flag.userData.basePos = Float32Array.from(flagGeo.attributes.position.array);
    this._flags.push(flag);
    lighthouse.add(flag);

    // Cartel «Puerto» discreto (la etiqueta flotante existente).
    const label = this._makeLabel('Puerto', {
      x: 0,
      y: 11,
      z: 0,
      scale: 6,
      color: '#5b6b7d',
      id: 'area:puerto',
      kind: 'area', // topónimo estructural: mismo rango que las comarcas
      targetPx: LABEL_PX.area,
      priority: LABEL_PRIORITY.area,
    });
    label.visible = labelVisible;
    this._areaLabels.push(label);
    group.add(label);
    return group;
  }

  /**
   * Atrezzo pirata del muelle (JG-7): barriles con duelas (InstancedMesh y
   * textura 'barrel' a color), cajas de madera apiladas, dos norays en el
   * borde del tablero y una cuerda vencida entre ellos (tubo sobre una Bézier
   * cuadrática). Coordenadas locales del puerto (+z hacia el mar); lo apoyado
   * en tierra se pega al MISMO suelo del caminante (groundHeightAt, rotando
   * el offset local a mundo como los postes del muelle). 4 draw calls.
   * @param {(color: number, texKey?: string|null) => object} materialFor
   * @param {{ wx: number, wz: number, seaYaw: number, deckY: number }} at
   */
  _buildPortProps(materialFor, { wx, wz, seaYaw, deckY }) {
    const THREE = this._THREE;
    const group = new THREE.Group();
    const R = this._islandR;
    const cosY = Math.cos(seaYaw);
    const sinY = Math.sin(seaYaw);
    /** Altura LOCAL del suelo bajo un punto local del puerto. */
    const groundLocalY = (lx, lz) => {
      const px = wx + lx * cosY + lz * sinY;
      const pz = wz - lx * sinY + lz * cosY;
      return groundHeightAt(px, pz, { radius: R }) - GROUND_Y;
    };
    const dummy = new THREE.Object3D();
    /** InstancedMesh con una matriz por pieza del atrezzo (fija, determinista). */
    const instanced = (geo, material, items, place) => {
      const mesh = new THREE.InstancedMesh(geo, material, items.length);
      items.forEach((item, i) => {
        dummy.position.set(0, 0, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        place(dummy, item);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = SHADOWS.enabled;
      group.add(mesh);
    };

    // Barriles: cilindro ligeramente troncocónico con la textura de duelas y
    // flejes (a color: el material no tinta). Los `stacked` van encima.
    instanced(
      new THREE.CylinderGeometry(PORT_PROPS.barrelR * 0.86, PORT_PROPS.barrelR, PORT_PROPS.barrelH, 9),
      new THREE.MeshLambertMaterial({ map: this._envTexture('barrel'), flatShading: true }),
      PORT_PROPS.barrels,
      (d, b) => {
        const y =
          groundLocalY(b.lx, b.lz) +
          (PORT_PROPS.barrelH * b.s) / 2 +
          (b.stacked ? PORT_PROPS.barrelH * 0.92 : 0);
        d.position.set(b.lx, y, b.lz);
        d.rotation.y = b.ry;
        d.scale.setScalar(b.s);
      },
    );

    // Cajas de madera: cubos con veta tintada del color de tablón claro.
    instanced(
      new THREE.BoxGeometry(PORT_PROPS.crateS, PORT_PROPS.crateS, PORT_PROPS.crateS),
      materialFor(ENV_COLORS.plank, 'wood'),
      PORT_PROPS.crates,
      (d, c) => {
        const y =
          groundLocalY(c.lx, c.lz) +
          (PORT_PROPS.crateS * c.s) / 2 +
          (c.stacked ? PORT_PROPS.crateS * 0.82 : 0);
        d.position.set(c.lx, y, c.lz);
        d.rotation.y = c.ry;
        d.scale.setScalar(c.s);
      },
    );

    // Norays de amarre en el borde del tablero del muelle.
    instanced(
      new THREE.CylinderGeometry(PORT_PROPS.bollardR, PORT_PROPS.bollardR + 0.04, PORT_PROPS.bollardH, 6),
      materialFor(ENV_COLORS.post),
      PORT_PROPS.bollardsLz,
      (d, lz) => {
        d.position.set(PORT_PROPS.bollardLx, deckY + PORT_PROPS.bollardH / 2, lz);
      },
    );

    // Cuerda vencida entre los dos norays (tubo sobre Bézier cuadrática).
    const top1 = new THREE.Vector3(
      PORT_PROPS.bollardLx,
      deckY + PORT_PROPS.bollardH,
      PORT_PROPS.bollardsLz[0],
    );
    const top2 = new THREE.Vector3(
      PORT_PROPS.bollardLx,
      deckY + PORT_PROPS.bollardH,
      PORT_PROPS.bollardsLz[1],
    );
    const mid = top1.clone().add(top2).multiplyScalar(0.5);
    mid.y -= PORT_PROPS.ropeSag;
    const rope = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(top1, mid, top2), 12, PORT_PROPS.ropeR, 5),
      materialFor(ENV_COLORS.rope),
    );
    group.add(rope);
    return group;
  }

  /**
   * Grupo de ciudades: una casa low-poly por ciudad coloreada por estado
   * (cityStatus del dominio) y enriquecida (MC-8) con puerta de madera, placa
   * con el nombre sobre la puerta (legible de cerca), ventanas emisivas y
   * variación determinista por id (altura/rotación/tono, cityVariant — sin
   * Math.random()). La fachada mira HACIA el puerto (MC-9): llegando desde el
   * mar, puertas y placas se ven de frente. Además:
   * acento navy en la ruta planificada, haz de luz en la ciudad actual,
   * etiqueta flotante con el nombre (oculta a pie), la senda del camino
   * recorrido y la ruta planificada discontinua. Geometrías y materiales se
   * comparten dentro de cada build (mismo color → mismo material) y las
   * texturas de placa se cachean entre builds.
   */
  _buildCities() {
    const THREE = this._THREE;
    const group = new THREE.Group();
    const route = new Set(this.journey?.plannedRoute ?? []);
    const current = this.journey?.currentCity ?? null;
    this._cityLabels = [];
    this._beacons = []; // las balizas viven en este grupo: se rehacen con él (MC-13)
    const labelsVisible = this._mode === 'aerial' || this._mode === 'to-aerial';

    // Geometrías compartidas por todas las ciudades de este build.
    const bodyGeo = new THREE.BoxGeometry(CITY_BODY.w, CITY_BODY.h, CITY_BODY.w);
    const roofGeo = new THREE.ConeGeometry(CITY_ROOF.r, CITY_ROOF.h, 4);
    roofGeo.rotateY(Math.PI / 4); // tejado alineado con la caja
    const ringGeo = new THREE.TorusGeometry(2.9, 0.28, 8, 28);
    // Señalización del CARPOOL (CP-1): anillo exterior + banderola navy+coral
    // en las paradas del grupo. Geometrías compartidas por todas las paradas.
    const carpool = new Set(this.carpoolStops ?? []);
    // Ruta de RETO activa en esta isla (JG-5), o null en modo Libre.
    const challenge = this.challengeStops ?? null;
    const carpoolRingGeo = new THREE.TorusGeometry(3.55, 0.24, 8, 30);
    const carpoolPoleGeo = new THREE.CylinderGeometry(0.09, 0.09, CARPOOL_FLAG.poleH, 8);
    const carpoolPennantGeo = new THREE.PlaneGeometry(CARPOOL_FLAG.pennantW, CARPOOL_FLAG.pennantH);
    // Baliza de visado disponible (MC-13): geometría compartida; el material es
    // por baliza (cada una pulsa con su propia fase → su propia opacidad).
    const beaconGeo = new THREE.CylinderGeometry(BEACON.radius, BEACON.radius, BEACON.height, 10, 1, true);
    const doorGeo = new THREE.BoxGeometry(CITY_DOOR.w, CITY_DOOR.h, CITY_DOOR.d);
    const plateGeo = new THREE.PlaneGeometry(CITY_PLATE.w, CITY_PLATE.h);
    const windowGeo = new THREE.PlaneGeometry(CITY_WINDOW.w, CITY_WINDOW.h);
    /**
     * Cache de materiales por color y textura opcional: mismas ciudades →
     * mismo material. Las texturas (tablones, tejas, veta — MC-10) son casi
     * blancas y compartidas: el color de estado las TINTA (map × color), así
     * una única textura de pared sirve para todos los estados.
     * @param {number} color @param {string|null} [texKey]
     */
    const materials = new Map();
    const materialFor = (color, texKey = null) => {
      const key = `${color}:${texKey ?? ''}`;
      let m = materials.get(key);
      if (!m) {
        m = new THREE.MeshLambertMaterial({
          color,
          map: texKey ? this._envTexture(texKey) : null,
        });
        materials.set(key, m);
      }
      return m;
    };
    // Ventanas: un ÚNICO material emisivo suave compartido por todas las casas.
    const windowMat = new THREE.MeshLambertMaterial({
      color: ENV_COLORS.window,
      emissive: ENV_COLORS.windowGlow,
      emissiveIntensity: 0.75,
    });
    const half = CITY_BODY.w / 2;
    // Punto de llegada al que miran todas las fachadas (MC-9): el puerto.
    const portW = this.map.startPort
      ? worldFromMap(this.map.startPort.x, this.map.startPort.y)
      : null;

    for (const city of this.map.cities ?? []) {
      const st = cityStatus(this.map, city.id, this.journey);
      const status = st === 'unknown' ? 'blocked' : st;
      const v = cityVariant(city.id);
      // Tono determinista por ciudad sobre el color de estado (cuantizado en
      // cityVariant: la caché de materiales sigue siendo pequeña).
      const color = new THREE.Color(cityStatusColor(status)).multiplyScalar(v.tone).getHex();
      const { wx, wz } = worldFromMap(city.x, city.y);
      const bodyH = CITY_BODY.h * v.height;

      const node = new THREE.Group();
      node.position.set(wx, GROUND_Y, wz);
      // La fachada (+z local) mira HACIA el puerto — el punto de llegada
      // (facadeYawToward, puro) — con un yaw extra pequeño (±0.15 rad)
      // determinista por ciudad para que el pueblo no parezca un cuartel.
      // En un mapa sin puerto, hacia el centro de la isla (como hasta MC-8).
      const d = Math.hypot(wx, wz);
      const baseYaw = portW
        ? facadeYawToward({ wx, wz }, portW)
        : d > 0.001
          ? Math.atan2(-wx, -wz)
          : 0;
      node.rotation.y = baseYaw + v.rotation * FACADE_JITTER;
      node.userData.cityId = city.id;
      // Altura del tejado: origen del confeti de la celebración (MC-11).
      node.userData.topY = bodyH + CITY_ROOF.h;

      // Paredes con tablones (textura procedural tintada por el estado, MC-10).
      const body = new THREE.Mesh(bodyGeo, materialFor(color, 'wall'));
      body.scale.y = v.height;
      body.position.y = bodyH / 2;
      body.castShadow = SHADOWS.enabled;
      node.add(body);
      node.userData.body = body; // paredes: objetivo del pulso de celebración

      // Celebración en curso sobre ESTA casa y el grupo se reconstruye (p. ej.
      // el propio rebuild del toggle, o proximidad): se re-aplica el material
      // de pulso dorado. Se crea uno NUEVO por build (el anterior lo libera
      // _disposeSubtree con su grupo); _tickCelebration anima el vigente.
      if (this._celebration?.cityId === city.id) {
        const pulseMat = new THREE.MeshLambertMaterial({
          color,
          map: this._envTexture('wall'),
          emissive: CITIZEN_GOLD,
          emissiveIntensity: this._celebration.intensity,
        });
        body.material = pulseMat;
        this._celebration.bodyMat = pulseMat;
      }

      // Tejado: mismo tono oscurecido (determinista) para dar volumen, con
      // textura de tejas escalonadas (MC-10).
      const roofColor = new THREE.Color(color).multiplyScalar(0.72).getHex();
      const roof = new THREE.Mesh(roofGeo, materialFor(roofColor, 'roof'));
      roof.position.y = bodyH + CITY_ROOF.h / 2;
      roof.castShadow = SHADOWS.enabled;
      node.add(roof);

      // Puerta de madera en la fachada, ligeramente saliente (veta, MC-10).
      const door = new THREE.Mesh(doorGeo, materialFor(ENV_COLORS.door, 'wood'));
      door.position.set(0, CITY_DOOR.h / 2, half + CITY_DOOR.d / 2 - 0.02);
      node.add(door);

      // Placa con el nombre de la ciudad sobre la puerta (textura cacheada).
      // En las casas VISITADAS la placa es DORADA de forma permanente (MC-11):
      // el distintivo de ciudadano.
      const plate = new THREE.Mesh(
        plateGeo,
        new THREE.MeshBasicMaterial({
          map: this._plateTexture(city.name, status === 'visited'),
        }),
      );
      plate.position.set(0, CITY_DOOR.h + 0.42, half + 0.03);
      node.add(plate);

      // Ventanas emisivas: dos en la fachada y una por costado.
      for (const [x, y, z, ry] of [
        [-0.9, 2.5, half + 0.02, 0],
        [0.9, 2.5, half + 0.02, 0],
        [half + 0.02, 1.95, 0, Math.PI / 2],
        [-(half + 0.02), 1.95, 0, -Math.PI / 2],
      ]) {
        const win = new THREE.Mesh(windowGeo, windowMat);
        win.position.set(x, y, z);
        win.rotation.y = ry;
        node.add(win);
      }

      // Acento de ruta planificada: anillo navy en la base.
      if (route.has(city.id)) {
        const ring = new THREE.Mesh(ringGeo, materialFor(ACCENT_COLORS.route));
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.25;
        node.add(ring);
      }

      // Parada del CARPOOL activo (CP-1): anillo coral EXTERIOR (convive con
      // el navy de la ruta personal) y banderola — mástil navy con banderín
      // coral — junto a la casa. Distintivo del grupo, no del estado.
      if (carpool.has(city.id)) {
        const cpRing = new THREE.Mesh(carpoolRingGeo, materialFor(STATUS_COLORS.available));
        cpRing.rotation.x = -Math.PI / 2;
        cpRing.position.y = 0.45;
        node.add(cpRing);
        const pole = new THREE.Mesh(carpoolPoleGeo, materialFor(ACCENT_COLORS.route));
        pole.position.set(CARPOOL_FLAG.offset, CARPOOL_FLAG.poleH / 2, CARPOOL_FLAG.offset);
        node.add(pole);
        const pennant = new THREE.Mesh(
          carpoolPennantGeo,
          new THREE.MeshBasicMaterial({ color: ACCENT_COLORS.current, side: THREE.DoubleSide }),
        );
        pennant.position.set(
          CARPOOL_FLAG.offset + CARPOOL_FLAG.pennantW / 2 + 0.09,
          CARPOOL_FLAG.poleH - CARPOOL_FLAG.pennantH / 2 - 0.15,
          CARPOOL_FLAG.offset,
        );
        node.add(pennant);
      }

      // Ciudad actual: haz de luz vertical coral (marcador distintivo).
      if (current === city.id) {
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.9, 0.9, 30, 12, 1, true),
          new THREE.MeshBasicMaterial({
            color: ACCENT_COLORS.current,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        beam.position.y = 15;
        node.add(beam);
      }

      // Baliza de «visado disponible» (MC-13): haz coral sutil y PULSANTE en
      // las ciudades alcanzables no visitadas. La ciudad actual no la lleva
      // (su haz intenso manda). Fase determinista por id: no palpitan a la vez.
      // La SIGUIENTE parada del reto activo (JG-5) la lleva REFORZADA (rango
      // de opacidad mayor y algo más ancha): el camino señala a dónde ir.
      if (status === 'available' && current !== city.id) {
        const isChallengeNext = challenge?.nextCityId === city.id;
        const range = isChallengeNext ? BEACON_NEXT : BEACON;
        const beacon = new THREE.Mesh(
          beaconGeo,
          new THREE.MeshBasicMaterial({
            color: STATUS_COLORS.available,
            transparent: true,
            opacity: range.opacityMin,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        beacon.position.y = BEACON.height / 2;
        if (isChallengeNext) beacon.scale.set(1.35, 1, 1.35);
        beacon.userData.phase = hashUnit(hashId(city.id), 13) * Math.PI * 2;
        beacon.userData.range = range;
        this._beacons.push(beacon);
        node.add(beacon);
      } else if (status === 'visited' && current !== city.id) {
        // Baliza VERDE y tenue de casa CERTIFICADA (JG-25): a pie se distingue
        // lo hecho (verde) de lo que falta (coral) sin abrir nada.
        const beacon = new THREE.Mesh(
          beaconGeo,
          new THREE.MeshBasicMaterial({
            color: STATUS_COLORS.visited,
            transparent: true,
            opacity: BEACON_DONE.opacityMin,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        beacon.position.y = BEACON.height / 2;
        beacon.userData.phase = hashUnit(hashId(city.id), 13) * Math.PI * 2;
        beacon.userData.range = BEACON_DONE;
        this._beacons.push(beacon);
        node.add(beacon);
      }

      // Selección (MC-6) o proximidad a pie (MC-7): resalte emisivo sutil
      // (conserva la textura de tablones para no «despintar» la casa). La
      // celebración (MC-11) manda: su pulso dorado ya ocupa el material.
      if (
        this._celebration?.cityId !== city.id &&
        (this.selected === city.id || (this._mode === 'fps' && this._nearCityId === city.id))
      ) {
        const selMat = new THREE.MeshLambertMaterial({
          color,
          map: this._envTexture('wall'),
          emissive: ACCENT_COLORS.route,
          emissiveIntensity: 0.35,
        });
        body.material = selMat;
        materials.set(`sel:${city.id}`, selMat);
      }

      const strike = status === 'deprecated';
      // Prioridad del declutter (MC-17): la seleccionada manda, luego la
      // ciudad actual del journey, luego las disponibles (las accionables) y
      // por último el resto. Se hornea aquí: cambiar selected/journey ya
      // reconstruye este grupo.
      const labelPriority =
        this.selected === city.id
          ? LABEL_PRIORITY.selected
          : current === city.id
            ? LABEL_PRIORITY.current
            : status === 'available'
              ? LABEL_PRIORITY.available
              : LABEL_PRIORITY.city;
      const label = this._makeLabel(city.name, {
        x: 0,
        y: bodyH + CITY_ROOF.h + 2.2,
        z: 0,
        scale: 4,
        color: strike ? '#9ca3af' : '#1e3a5f',
        strike,
        id: `city:${city.id}`,
        kind: 'city',
        targetPx: LABEL_PX.city,
        priority: labelPriority,
      });
      label.visible = labelsVisible;
      this._cityLabels.push(label);
      node.add(label);

      // Número de parada de la RUTA DE RETO (JG-5): badge circular sobre la
      // casa — coral la SIGUIENTE, navy las pendientes, teal con ✓ las ya
      // certificadas. Vive en el sistema de etiquetas (tamaño aparente
      // constante + declutter) con la prioridad MÁXIMA: el camino siempre se
      // lee, aunque para ello ceda su hueco el nombre de la casa.
      const stopNumber = challenge?.numbers?.get(city.id);
      if (stopNumber !== undefined) {
        const stopState =
          status === 'visited' ? 'done' : challenge.nextCityId === city.id ? 'next' : 'pending';
        const badge = this._makeChallengeBadge(stopNumber, stopState, {
          y: bodyH + CITY_ROOF.h + 4.7,
          id: `challenge:${city.id}`,
        });
        badge.visible = labelsVisible;
        this._cityLabels.push(badge);
        node.add(badge);
        // Número FIJO sobre la puerta (JG-25): a pie no se ve el badge aéreo
        // (capa de etiquetas oculta), así que este plano marca la casa del reto.
        const doorBadge = this._doorNumberBadge(
          stopState === 'done' ? '✓' : String(stopNumber),
          CHALLENGE_BADGE.colors[stopState],
          '#ffffff',
        );
        doorBadge.position.set(0, CITY_DOOR.h + 1.05, half + 0.05);
        node.add(doorBadge);
      }

      // Número de parada de la RUTA LIBRE (JG-9): badge ámbar con tinta navy
      // sobre la casa, con el orden GLOBAL de la ruta (✓ en las ya
      // certificadas). Con reto activo routeStops llega null desde
      // <career-app> (sus números mandan); la guarda extra evita pintar dos
      // badges si alguna vez convivieran.
      const routeNumber = stopNumber === undefined ? this.routeStops?.get(city.id) : undefined;
      if (routeNumber !== undefined) {
        const routeState = status === 'visited' ? 'done' : 'pending';
        const badge = this._makeRouteBadge(routeNumber, routeState, {
          y: bodyH + CITY_ROOF.h + 4.7,
          id: `route:${city.id}`,
        });
        badge.visible = labelsVisible;
        this._cityLabels.push(badge);
        node.add(badge);
        // Número FIJO sobre la puerta (JG-25), acento ámbar de la ruta libre.
        const doorBadge = this._doorNumberBadge(
          routeState === 'done' ? '✓' : String(routeNumber),
          ROUTE_BADGE.colors[routeState],
          ROUTE_BADGE.ink,
        );
        doorBadge.position.set(0, CITY_DOOR.h + 1.05, half + 0.05);
        node.add(doorBadge);
      }

      group.add(node);
    }

    // Camino recorrido (MC-8): senda teal sobre la hierba uniendo las ciudades
    // visitadas EN ORDEN; y la ruta planificada como línea discontinua
    // atenuada desde la ciudad actual (o la última visitada).
    const visited = this.journey?.visitedCities ?? [];
    const visitedPts = journeyPathPoints(this.map, visited);
    if (visitedPts.length >= 2) {
      group.add(
        this._buildGroundRibbon(visitedPts, {
          width: PATH_WIDTH,
          color: STATUS_COLORS.visited,
          opacity: 0.85,
          y: GROUND_Y + PATH_LIFT,
        }),
      );
    }
    const routeStart = current ?? visited.at(-1) ?? null;
    const routePts = journeyPathPoints(this.map, [
      ...(routeStart === null ? [] : [routeStart]),
      ...(this.journey?.plannedRoute ?? []),
    ]);
    if (routePts.length >= 2) group.add(this._buildPlannedRoute(routePts));

    return group;
  }

  /**
   * Cinta plana de suelo (ribbonStrip, puro) apoyada sobre la hierba con
   * elevación + polygonOffset anti z-fighting; sin escribir profundidad (es un
   * decal del suelo). La usan la senda del camino recorrido (teal, MC-8) y la
   * presencia de la ruta planificada (navy translúcido, MC-13).
   * @param {{wx: number, wz: number}[]} points Polilínea de mundo, en orden.
   * @param {{ width: number, color: number, opacity: number, y: number }} opts
   */
  _buildGroundRibbon(points, { width, color, opacity, y }) {
    const THREE = this._THREE;
    const strip = ribbonStrip(points, width);
    const positions = new Float32Array(strip.length * 2 * 3);
    for (const [i, p] of strip.entries()) {
      positions.set([p.lx, y, p.lz, p.rx, y, p.rz], i * 6);
    }
    const indices = [];
    for (let i = 0; i < strip.length - 1; i += 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    return mesh;
  }

  /**
   * Ruta planificada con presencia (MC-13): cinta navy translúcida en el suelo
   * (la guía se ve de lejos) + la línea discontinua navy encima (el trazo de
   * «plan»), cada una a su elevación para que convivan con la senda sin
   * pelearse (WebGL ignora linewidth: el grosor lo aporta la cinta).
   * @param {{wx: number, wz: number}[]} points Ciudad de partida + ruta, en orden.
   */
  _buildPlannedRoute(points) {
    const THREE = this._THREE;
    const group = new THREE.Group();
    group.add(
      this._buildGroundRibbon(points, {
        width: ROUTE_RIBBON.width,
        color: ACCENT_COLORS.route,
        opacity: ROUTE_RIBBON.opacity,
        y: GROUND_Y + ROUTE_RIBBON.lift,
      }),
    );
    const y = GROUND_Y + ROUTE_LIFT;
    const geo = new THREE.BufferGeometry().setFromPoints(
      points.map((p) => new THREE.Vector3(p.wx, y, p.wz)),
    );
    const line = new THREE.Line(
      geo,
      new THREE.LineDashedMaterial({
        color: ACCENT_COLORS.route,
        transparent: true,
        opacity: ROUTE_DASH_OPACITY,
        dashSize: 1.6,
        gapSize: 1.1,
      }),
    );
    line.computeLineDistances(); // sin esto el dash no se pinta
    group.add(line);
    return group;
  }

  /**
   * Un frame del pulso de las balizas de «visado disponible» (MC-13), en
   * cualquier modo de cámara: opacidad senoidal lenta entre opacityMin y
   * opacityMax con fase determinista por ciudad. Barato: pocas balizas y solo
   * se toca la opacidad del material.
   * @param {DOMHighResTimeStamp} now
   */
  _tickBeacons(now) {
    if (this._beacons.length === 0) return;
    const t = (now / 1000) * Math.PI * 2 * BEACON.speedHz;
    for (const beacon of this._beacons) {
      const k = 0.5 + 0.5 * Math.sin(t + beacon.userData.phase);
      // Rango por baliza: la SIGUIENTE parada del reto pulsa reforzada (JG-5).
      const range = beacon.userData.range ?? BEACON;
      beacon.material.opacity = range.opacityMin + (range.opacityMax - range.opacityMin) * k;
    }
  }

  // ---- La cabaña del brujo (MC-22) -----------------------------------------------

  /** Rehace SOLO el grupo de la cabaña (cambio de wizardState o de mapa). */
  _rebuildWizard() {
    if (!this.map) return;
    this._replaceGroup('_wizardGroup', this._buildWizardHut());
    this._updateLabels(); // la etiqueta nueva, ya con escala/declutter (MC-17)
  }

  /**
   * La CABAÑA DEL BRUJO: torre cilíndrica púrpura con estrellas (CanvasTexture
   * 'wizard'), tejado cónico LADEADO con estrella dorada en la punta, puerta,
   * cartel «El brujo», chimenea trasera y un farol en un poste junto a la
   * puerta — el INDICADOR de estado (wizardState): reposo = farol gris y humo
   * tenue en la chimenea; 'pending' = farol ÁMBAR pulsante; 'ready' = farol
   * VIOLETA brillante con un destello (JG-8: la luz prometida por el brujo).
   * Distinta a las casas a propósito (planta
   * redonda, otro tejado, otra paleta): es LA edificación singular de la isla.
   * La fachada mira al puerto, como las casas (facadeYawToward).
   */
  _buildWizardHut() {
    const THREE = this._THREE;
    const group = new THREE.Group();
    this._wizardLantern = null;
    this._wizardSparkle = null;
    this._wizardSmoke = [];
    this._wizardLabels = [];
    const spot = this._wizardSpotW;
    if (!spot) return group;
    const { wx, wz } = spot;
    group.position.set(wx, GROUND_Y, wz);
    const portW = this.map.startPort
      ? worldFromMap(this.map.startPort.x, this.map.startPort.y)
      : null;
    const d = Math.hypot(wx, wz);
    group.rotation.y = portW
      ? facadeYawToward({ wx, wz }, portW)
      : d > 0.001
        ? Math.atan2(-wx, -wz)
        : 0;
    group.userData.wizard = true;

    // Torre: cilindro púrpura estrellado, levemente troncocónico.
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(WIZARD.bodyR * 0.88, WIZARD.bodyR, WIZARD.bodyH, 10),
      new THREE.MeshLambertMaterial({ map: this._envTexture('wizard'), flatShading: true }),
    );
    body.position.y = WIZARD.bodyH / 2;
    body.castShadow = SHADOWS.enabled;
    group.add(body);

    // Tejado cónico ladeado (el toque «retorcido») con estrella dorada arriba.
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(WIZARD.roofR, WIZARD.roofH, 10),
      new THREE.MeshLambertMaterial({ color: WIZARD.colors.roof, flatShading: true }),
    );
    roof.position.y = WIZARD.bodyH + WIZARD.roofH / 2 - 0.25;
    roof.rotation.z = WIZARD.roofTilt;
    roof.castShadow = SHADOWS.enabled;
    group.add(roof);
    const star = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.3, 0),
      new THREE.MeshLambertMaterial({
        color: WIZARD.colors.star,
        emissive: WIZARD.colors.star,
        emissiveIntensity: 0.5,
        flatShading: true,
      }),
    );
    star.scale.set(0.6, 1, 0.6);
    // La punta del cono, con su inclinación (rotación z alrededor del centro del tejado).
    const tipLocalY = WIZARD.roofH / 2 + 0.25;
    star.position.set(
      -Math.sin(WIZARD.roofTilt) * tipLocalY,
      roof.position.y + Math.cos(WIZARD.roofTilt) * tipLocalY,
      0,
    );
    group.add(star);

    // Puerta de madera en la fachada (+z local, hacia el puerto).
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(CITY_DOOR.w, CITY_DOOR.h, CITY_DOOR.d),
      new THREE.MeshLambertMaterial({ color: ENV_COLORS.door, flatShading: true, map: this._envTexture('wood') }),
    );
    door.position.set(0, CITY_DOOR.h / 2, WIZARD.bodyR - 0.08);
    group.add(door);

    // Cartel «El brujo» sobre la puerta (canvas por build, como el de obra).
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 256;
    signCanvas.height = 64;
    const ctx = signCanvas.getContext('2d');
    ctx.fillStyle = '#2c1e4a';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = '#f4c96b';
    ctx.lineWidth = 5;
    ctx.strokeRect(3, 3, 250, 58);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f4c96b';
    ctx.font = '700 30px system-ui, sans-serif';
    ctx.fillText('🔮 El brujo', 128, 34);
    const signTexture = new THREE.CanvasTexture(signCanvas);
    signTexture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY_PLATE.w, CITY_PLATE.h),
      new THREE.MeshBasicMaterial({ map: signTexture }),
    );
    sign.position.set(0, CITY_DOOR.h + 0.45, WIZARD.bodyR + 0.02);
    group.add(sign);

    // Chimenea trasera (ancla del humo de reposo).
    const chimney = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.26, 1.1, 6),
      new THREE.MeshLambertMaterial({ color: WIZARD.colors.roof, flatShading: true }),
    );
    const chimneyTop = WIZARD.bodyH + 1.15;
    chimney.position.set(-WIZARD.bodyR * 0.55, chimneyTop - 0.55, -WIZARD.bodyR * 0.45);
    group.add(chimney);

    // Farol indicador junto a la puerta: poste + esfera emisiva por estado.
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, WIZARD.lantern.y, 6),
      new THREE.MeshLambertMaterial({ color: ENV_COLORS.post, flatShading: true, map: this._envTexture('wood') }),
    );
    post.position.set(WIZARD.lantern.postX, WIZARD.lantern.y / 2, WIZARD.bodyR - 0.3);
    group.add(post);
    const lanternColor =
      this.wizardState === 'pending'
        ? WIZARD.colors.pending
        : this.wizardState === 'ready'
          ? WIZARD.colors.ready
          : WIZARD.colors.none;
    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(WIZARD.lantern.r, 10, 8),
      new THREE.MeshLambertMaterial({
        color: lanternColor,
        emissive: lanternColor,
        emissiveIntensity:
          this.wizardState === 'ready'
            ? WIZARD.emissive.ready
            : this.wizardState === 'pending'
              ? WIZARD.emissive.pendingMax
              : WIZARD.emissive.none,
      }),
    );
    lantern.position.set(WIZARD.lantern.postX, WIZARD.lantern.y, WIZARD.bodyR - 0.3);
    this._wizardLantern = lantern;
    group.add(lantern);

    // Destello de «respuesta lista»: sprite de brillo radial sobre el farol.
    if (this.wizardState === 'ready') {
      const glowCanvas = document.createElement('canvas');
      glowCanvas.width = 64;
      glowCanvas.height = 64;
      const gctx = glowCanvas.getContext('2d');
      const glow = gctx.createRadialGradient(32, 32, 2, 32, 32, 32);
      glow.addColorStop(0, 'rgba(230, 190, 255, 0.95)');
      glow.addColorStop(0.4, 'rgba(157, 78, 221, 0.55)');
      glow.addColorStop(1, 'rgba(157, 78, 221, 0)');
      gctx.fillStyle = glow;
      gctx.fillRect(0, 0, 64, 64);
      const sparkle = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: new THREE.CanvasTexture(glowCanvas),
          transparent: true,
          depthWrite: false,
          opacity: WIZARD.sparkle.opacityMax,
        }),
      );
      sparkle.position.copy(lantern.position);
      sparkle.scale.setScalar(WIZARD.sparkle.scale);
      this._wizardSparkle = sparkle;
      group.add(sparkle);
    }

    // Humo gris tenue en reposo: esferitas que suben y se desvanecen en bucle
    // (fases repartidas; la animación vive en _tickWizard).
    if (this.wizardState === 'none') {
      const smokeGeo = new THREE.SphereGeometry(WIZARD.smoke.r, 8, 6);
      for (let i = 0; i < WIZARD.smoke.count; i += 1) {
        const puff = new THREE.Mesh(
          smokeGeo,
          new THREE.MeshLambertMaterial({
            color: WIZARD.colors.smoke,
            transparent: true,
            opacity: 0,
            depthWrite: false,
          }),
        );
        puff.position.set(chimney.position.x, chimneyTop, chimney.position.z);
        puff.userData.phase = i / WIZARD.smoke.count;
        puff.userData.baseY = chimneyTop;
        this._wizardSmoke.push(puff);
        group.add(puff);
      }
    }

    // Etiqueta flotante «El brujo» (misma política que las de ciudad: oculta a
    // pie, muestreada con tamaño constante y declutter, MC-17).
    const label = this._makeLabel('El brujo', {
      x: 0,
      y: WIZARD.bodyH + WIZARD.roofH + 1.6,
      z: 0,
      scale: 4,
      color: '#5b3d8f',
      id: 'wizard:hut',
      kind: 'city',
      targetPx: LABEL_PX.city,
      priority: LABEL_PRIORITY.city,
    });
    label.visible = this._mode === 'aerial' || this._mode === 'to-aerial';
    this._wizardLabels.push(label);
    group.add(label);

    return group;
  }

  /**
   * Un frame del indicador de la cabaña del brujo (MC-22), en cualquier modo:
   * farol ÁMBAR pulsante ('pending'), destello VIOLETA respirando ('ready') y
   * humo de reposo subiendo en bucle ('none'). Barato: un emisivo, un sprite y
   * tres esferitas.
   * @param {DOMHighResTimeStamp} now
   */
  _tickWizard(now) {
    const t = now / 1000;
    if (this.wizardState === 'pending' && this._wizardLantern) {
      const k = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * WIZARD.pulseHz);
      this._wizardLantern.material.emissiveIntensity =
        WIZARD.emissive.pendingMin + (WIZARD.emissive.pendingMax - WIZARD.emissive.pendingMin) * k;
    }
    if (this._wizardSparkle) {
      const k = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * WIZARD.sparkle.pulseHz);
      const m = this._wizardSparkle.material;
      m.opacity =
        WIZARD.sparkle.opacityMin + (WIZARD.sparkle.opacityMax - WIZARD.sparkle.opacityMin) * k;
      this._wizardSparkle.scale.setScalar(WIZARD.sparkle.scale * (0.85 + 0.3 * k));
    }
    for (const puff of this._wizardSmoke) {
      const p = (t / WIZARD.smoke.riseS + puff.userData.phase) % 1;
      puff.position.y = puff.userData.baseY + p * WIZARD.smoke.height;
      puff.material.opacity = WIZARD.smoke.maxOpacity * (1 - p);
      puff.scale.setScalar(0.6 + p * 0.9);
    }
  }

  /**
   * Abre el panel del brujo en <career-app> (clic en la cabaña, [E] o choque
   * frontal). A pie suelta el pointer lock A PROPÓSITO (como el panel de
   * ciudadanía y la barca) para que el ratón pueda usar el overlay.
   */
  _openWizard() {
    if (this.overlayOpen) return; // ya hay un overlay encima: no se re-dispara
    this._keys.clear(); // sin lock no habrá pointerlockchange que las suelte (MC-18)
    if (this._fpsLocked) document.exitPointerLock(); // del inmersivo al modo libre (JG-3)
    this.dispatchEvent(new CustomEvent('open-wizard', { bubbles: true, composed: true }));
  }

  /**
   * Colisión del caminante/avatar con la cabaña del brujo (MC-22): el MISMO
   * colisionador puro de las casas (collideWithCities) con la cabaña como
   * único «edificio». Devuelve la posición corregida y si hubo empuje FRONTAL
   * (hitWizard: abre el panel del brujo, como entrar en una casa).
   * @param {{x: number, z: number}} from Posición previa.
   * @param {{x: number, z: number}} next Posición ya corregida por las casas.
   * @returns {{ x: number, z: number, hitWizard: boolean }}
   */
  _collideWizard(from, next) {
    if (!this._wizardSpotW) return { x: next.x, z: next.z, hitWizard: false };
    const col = collideWithCities(
      from,
      next,
      [{ id: 'wizard', wx: this._wizardSpotW.wx, wz: this._wizardSpotW.wz }],
      WIZARD.colliderRadius,
    );
    return { x: col.x, z: col.z, hitWizard: col.hitCityId !== null };
  }

  /**
   * Textura de la placa de puerta con el nombre de la ciudad, cacheada por
   * nombre (userData.shared: _disposeSubtree no la libera; ver constructor).
   * Placa clara con borde de madera y texto navy, con la fuente adaptada para
   * que quepan también los nombres largos. La variante DORADA (MC-11, casas
   * visitadas: el distintivo de ciudadano) se cachea con su propia clave.
   * @param {string} name
   * @param {boolean} [golden] Placa dorada de ciudadano (ciudad visitada).
   */
  _plateTexture(name, golden = false) {
    const key = golden ? `gold:${name}` : name;
    let texture = this._plateTextures.get(key);
    if (texture) return texture;
    const THREE = this._THREE;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = golden ? '#d4af37' : '#f6ead2';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = golden ? '#8a6d1d' : '#7a5a33';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 250, 58);
    if (golden) {
      // Brillo sutil de metal: banda clara diagonal sobre el dorado.
      const shine = ctx.createLinearGradient(0, 0, 256, 64);
      shine.addColorStop(0.35, 'rgba(255, 245, 200, 0)');
      shine.addColorStop(0.5, 'rgba(255, 245, 200, 0.5)');
      shine.addColorStop(0.65, 'rgba(255, 245, 200, 0)');
      ctx.fillStyle = shine;
      ctx.fillRect(3, 3, 250, 58);
    }
    let fontSize = 34;
    ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
    while (fontSize > 14 && ctx.measureText(name).width > 228) {
      fontSize -= 2;
      ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1e3a5f';
    ctx.fillText(name, 128, 34);
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.userData.shared = true;
    this._plateTextures.set(key, texture);
    return texture;
  }

  /** Libera y vacía la caché de texturas de placa (cambio de isla, teardown). */
  _clearPlateCache() {
    for (const texture of this._plateTextures.values()) texture.dispose();
    this._plateTextures.clear();
    for (const texture of this._doorNumTextures.values()) texture.dispose();
    this._doorNumTextures.clear();
  }

  // ---- Texturas procedurales del entorno (MC-10) --------------------------------

  /**
   * Configuración de las texturas procedurales: lado del canvas y repetición.
   * Las de terreno repiten a escala fina (RepeatWrapping) para que de cerca no
   * sean color plano; las de casa/madera van una vez por cara (UV 0..1).
   */
  static ENV_TEXTURE_CONF = Object.freeze({
    grass: Object.freeze({ size: 128, repeat: [20, 20] }),
    sand: Object.freeze({ size: 128, repeat: [24, 24] }),
    wall: Object.freeze({ size: 128, repeat: [1, 1] }),
    roof: Object.freeze({ size: 128, repeat: [4, 1] }),
    wood: Object.freeze({ size: 128, repeat: [1, 1] }),
    cloud: Object.freeze({ size: 128, repeat: [1, 1] }),
    wizard: Object.freeze({ size: 128, repeat: [3, 1] }),
    // Arte pirata (JG-7): duelas de barril y paño de la bandera (a color).
    barrel: Object.freeze({ size: 128, repeat: [1, 1] }),
    jollyroger: Object.freeze({ size: 128, repeat: [1, 1] }),
  });

  /**
   * Textura procedural del entorno, cacheada por clave (MC-10): se pinta UNA
   * vez en un canvas (determinista: hashUnit, sin Math.random) y se comparte
   * entre todos los materiales que la usan. userData.shared: _disposeSubtree
   * no la libera; su ciclo de vida lo lleva _clearEnvTextures (teardown).
   * @param {'grass'|'sand'|'wall'|'roof'|'wood'|'cloud'|'wizard'} key
   */
  _envTexture(key) {
    let texture = this._envTextures.get(key);
    if (texture) return texture;
    const conf = CareerIsland3D.ENV_TEXTURE_CONF[key];
    if (!conf) throw new Error(`Textura de entorno desconocida: "${key}"`);
    const THREE = this._THREE;
    const canvas = document.createElement('canvas');
    canvas.width = conf.size;
    canvas.height = conf.size;
    CareerIsland3D._paintEnvCanvas(key, canvas.getContext('2d'), conf.size);
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(conf.repeat[0], conf.repeat[1]);
    texture.userData.shared = true;
    this._envTextures.set(key, texture);
    return texture;
  }

  /**
   * Pinta el canvas de una textura procedural. Determinista: la «aleatoriedad»
   * sale de hashUnit con semilla derivada de la clave. Las texturas de casa y
   * madera son casi BLANCAS con juntas/vetas oscuras: el color del material
   * las tinta (map × color en Lambert), así una única textura de pared sirve
   * para todos los estados de ciudad.
   * @param {string} key
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} size
   */
  static _paintEnvCanvas(key, ctx, size) {
    const seed = hashId(`env:${key}`);
    const rnd = (i) => hashUnit(seed, i);
    if (key === 'grass') {
      // Hierba TROPICAL (JG-7): moteado en 5 tonos (antes 3, con un verde
      // hondo y otro amarillento) + briznas cortas dibujadas — de cerca deja
      // de ser un moteado uniforme y parece manto vegetal.
      const tones = ['#8fbf7f', '#a9d699', '#85b275', '#b9de9e', '#79a468'];
      ctx.fillStyle = '#9cc98c';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 1000; i += 1) {
        ctx.fillStyle = tones[i % tones.length];
        const s = 1 + rnd(i * 3 + 2) * 2.4;
        ctx.fillRect(rnd(i * 3) * size, rnd(i * 3 + 1) * size, s, s);
      }
      // Briznas: trazos cortos casi verticales en verde hondo translúcido.
      ctx.strokeStyle = 'rgba(62, 105, 66, 0.5)';
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      for (let i = 0; i < 90; i += 1) {
        const x = rnd(10_000 + i * 4) * size;
        const y = rnd(10_001 + i * 4) * size;
        const len = 3 + rnd(10_002 + i * 4) * 4;
        const tilt = (rnd(10_003 + i * 4) - 0.5) * 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + tilt, y - len);
        ctx.stroke();
      }
      return;
    }
    if (key === 'sand') {
      // Arena con detalle (JG-7): granulado de siempre + ondas de marea
      // claras (bandas onduladas translúcidas) y conchas puntuales (abanicos
      // diminutos con varillas).
      const tones = ['#dfcf9c', '#f2e8c4', '#d6c48e'];
      ctx.fillStyle = '#e9dcae';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 1300; i += 1) {
        ctx.fillStyle = tones[i % tones.length];
        const s = 1 + rnd(i * 3 + 2) * 1.4;
        ctx.fillRect(rnd(i * 3) * size, rnd(i * 3 + 1) * size, s, s);
      }
      // Ondas de marea: líneas onduladas claras, casi lavadas.
      ctx.strokeStyle = 'rgba(255, 252, 236, 0.35)';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 4; i += 1) {
        const y = (0.14 + i * 0.24 + rnd(20_000 + i * 5) * 0.08) * size;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(
          size * 0.33,
          y + rnd(20_001 + i * 5) * 7 - 3.5,
          size * 0.66,
          y - (rnd(20_002 + i * 5) * 7 - 3.5),
          size,
          y,
        );
        ctx.stroke();
      }
      // Conchas: abanico (arco + varillas radiales) en tonos claros/rosados.
      for (let i = 0; i < 7; i += 1) {
        const cx = rnd(21_000 + i * 6) * size;
        const cy = rnd(21_001 + i * 6) * size;
        const r = 2.2 + rnd(21_002 + i * 6) * 2.4;
        const a0 = rnd(21_003 + i * 6) * Math.PI * 2;
        ctx.fillStyle = i % 2 === 0 ? '#f6efdd' : '#efd4c4';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, a0, a0 + Math.PI);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(160, 120, 90, 0.55)';
        ctx.lineWidth = 0.7;
        for (const k of [0.25, 0.5, 0.75]) {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          const a = a0 + Math.PI * k;
          ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          ctx.stroke();
        }
      }
      return;
    }
    if (key === 'barrel') {
      // Barril (JG-7): duelas verticales sobre madera media y dos flejes
      // oscuros. A COLOR: el material del barril no tinta (map sin color).
      ctx.fillStyle = '#8a6437';
      ctx.fillRect(0, 0, size, size);
      const staves = 7;
      const w = size / staves;
      for (let s = 0; s < staves; s += 1) {
        ctx.fillStyle = `rgba(50, 30, 10, ${(0.08 + rnd(s * 3) * 0.1).toFixed(3)})`;
        ctx.fillRect(s * w, 0, w, size);
        ctx.fillStyle = 'rgba(40, 22, 8, 0.4)';
        ctx.fillRect(s * w, 0, 1.5, size);
      }
      ctx.fillStyle = '#3d2f1c';
      ctx.fillRect(0, size * 0.16, size, size * 0.09);
      ctx.fillRect(0, size * 0.75, size, size * 0.09);
      return;
    }
    if (key === 'jollyroger') {
      // Bandera pirata (JG-7): paño negro con veladuras y calavera con
      // tibias cruzadas — todo paths de canvas. A COLOR, como 'wizard'.
      ctx.fillStyle = '#181a1f';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 5; i += 1) {
        ctx.fillStyle = `rgba(255, 255, 255, ${(0.02 + rnd(i * 3) * 0.04).toFixed(3)})`;
        ctx.fillRect(0, rnd(i * 3 + 1) * size, size, 3 + rnd(i * 3 + 2) * 6);
      }
      const cx = size / 2;
      const cy = size * 0.4;
      const r = size * 0.17;
      ctx.fillStyle = '#f2efe4';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - r * 0.55, cy + r * 0.7, r * 1.1, r * 0.55); // mandíbula
      ctx.fillStyle = '#181a1f';
      ctx.beginPath(); // cuencas
      ctx.arc(cx - r * 0.42, cy - r * 0.1, r * 0.26, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.42, cy - r * 0.1, r * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath(); // nariz
      ctx.moveTo(cx, cy + r * 0.18);
      ctx.lineTo(cx - r * 0.14, cy + r * 0.52);
      ctx.lineTo(cx + r * 0.14, cy + r * 0.52);
      ctx.closePath();
      ctx.fill();
      // Tibias cruzadas bajo el cráneo.
      ctx.strokeStyle = '#f2efe4';
      ctx.lineWidth = size * 0.055;
      ctx.lineCap = 'round';
      const by = cy + r * 1.75;
      const bl = r * 1.3;
      for (const sgn of [1, -1]) {
        ctx.beginPath();
        ctx.moveTo(cx - bl * sgn, by - r * 0.45);
        ctx.lineTo(cx + bl * sgn, by + r * 0.45);
        ctx.stroke();
      }
      return;
    }
    if (key === 'wall') {
      // Tablones horizontales: junta oscura + sombra y vetas sutiles por tablón.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      const rows = 6;
      const rowH = size / rows;
      for (let r = 0; r < rows; r += 1) {
        ctx.fillStyle = `rgba(70, 45, 20, ${(0.03 + rnd(r * 5) * 0.05).toFixed(3)})`;
        ctx.fillRect(0, r * rowH, size, rowH);
        ctx.fillStyle = 'rgba(60, 40, 20, 0.32)';
        ctx.fillRect(0, r * rowH, size, 2);
        ctx.strokeStyle = 'rgba(80, 55, 25, 0.10)';
        ctx.lineWidth = 1;
        for (let v = 0; v < 3; v += 1) {
          const y = r * rowH + 3 + rnd(r * 17 + v * 3 + 1) * (rowH - 6);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.bezierCurveTo(
            size * 0.33,
            y + rnd(r * 17 + v * 3 + 2) * 4 - 2,
            size * 0.66,
            y - (rnd(r * 17 + v * 3 + 3) * 4 - 2),
            size,
            y,
          );
          ctx.stroke();
        }
      }
      return;
    }
    if (key === 'roof') {
      // Tejas: filas con junta horizontal, sombra del borde inferior y
      // separadores verticales escalonados (alternos por fila).
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      const rows = 8;
      const rowH = size / rows;
      const cols = 6;
      const colW = size / cols;
      for (let r = 0; r < rows; r += 1) {
        ctx.fillStyle = 'rgba(60, 30, 20, 0.30)';
        ctx.fillRect(0, r * rowH, size, 2.5);
        ctx.fillStyle = 'rgba(60, 30, 20, 0.09)';
        ctx.fillRect(0, r * rowH + rowH * 0.55, size, rowH * 0.45);
        ctx.fillStyle = 'rgba(60, 30, 20, 0.22)';
        const off = (r % 2) * (colW / 2);
        for (let c = 0; c <= cols; c += 1) {
          ctx.fillRect((off + c * colW) % size, r * rowH, 1.5, rowH);
        }
      }
      return;
    }
    if (key === 'wood') {
      // Veta: trazos horizontales ondulados de opacidad y grosor variables.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 14; i += 1) {
        const y = rnd(i * 5) * size;
        ctx.strokeStyle = `rgba(70, 45, 15, ${(0.08 + rnd(i * 5 + 1) * 0.12).toFixed(3)})`;
        ctx.lineWidth = 1 + rnd(i * 5 + 2) * 1.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(
          size * 0.33,
          y + rnd(i * 5 + 3) * 6 - 3,
          size * 0.66,
          y - (rnd(i * 5 + 4) * 6 - 3),
          size,
          y,
        );
        ctx.stroke();
      }
      return;
    }
    if (key === 'cloud') {
      // Nube: blobs radiales blancos superpuestos sobre fondo transparente.
      for (let i = 0; i < 6; i += 1) {
        const cx = size * (0.25 + rnd(i * 4) * 0.5);
        const cy = size * (0.4 + rnd(i * 4 + 1) * 0.25);
        const cr = size * (0.14 + rnd(i * 4 + 2) * 0.16);
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
      }
      return;
    }
    if (key === 'wizard') {
      // Manto del brujo (MC-22): púrpura nocturno con estrellas de 4 puntas
      // doradas/blancas. A COLOR (el material va en blanco, sin tintar): la
      // cabaña no comparte paleta con ninguna casa.
      ctx.fillStyle = '#4a3178';
      ctx.fillRect(0, 0, size, size);
      // Veteado sutil del manto.
      for (let i = 0; i < 5; i += 1) {
        ctx.fillStyle = `rgba(30, 18, 58, ${(0.12 + rnd(i * 7) * 0.1).toFixed(3)})`;
        ctx.fillRect(0, rnd(i * 7 + 1) * size, size, 3 + rnd(i * 7 + 2) * 5);
      }
      const drawStar = (cx, cy, r, color) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        // Rombo de 4 puntas: vértices largos arriba/abajo, cortos a los lados.
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r * 0.3, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r * 0.3, cy);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx - r, cy);
        ctx.lineTo(cx, cy + r * 0.3);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy - r * 0.3);
        ctx.closePath();
        ctx.fill();
      };
      for (let i = 0; i < 12; i += 1) {
        drawStar(
          rnd(i * 3 + 40) * size,
          rnd(i * 3 + 41) * size,
          3 + rnd(i * 3 + 42) * 5,
          i % 3 === 0 ? '#f4c96b' : 'rgba(255, 250, 235, 0.9)',
        );
      }
      return;
    }
    throw new Error(`Textura de entorno desconocida: "${key}"`);
  }

  /** Libera y vacía la caché de texturas del entorno (solo en el teardown). */
  _clearEnvTextures() {
    for (const texture of this._envTextures.values()) texture.dispose();
    this._envTextures.clear();
  }

  // ---- Ambiente: cielo, nubes, espuma y vegetación (MC-10) ----------------------

  /**
   * Cúpula de cielo: esfera grande vista desde dentro con gradiente por vertex
   * colors, del horizonte cálido claro al cenit azul. Sin niebla ni escritura
   * de profundidad: siempre queda detrás de todo lo demás.
   */
  _buildSky() {
    const THREE = this._THREE;
    const R = this._islandR;
    const geo = new THREE.SphereGeometry(R * 11, 24, 12);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const zenith = new THREE.Color(SKY_COLORS.zenith);
    const horizon = new THREE.Color(SKY_COLORS.horizon);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 1) {
      // Altura normalizada 0..1 (bajo el horizonte se queda el color cálido);
      // el exponente concentra el degradado cerca del horizonte.
      const t = Math.min(Math.max(pos.getY(i) / (R * 11), 0), 1) ** 0.65;
      c.copy(horizon).lerp(zenith, t);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
      }),
    );
  }

  /**
   * Espuma de costa: cinta clara siguiendo el radio donde la falda de la playa
   * cruza el nivel del agua (el MISMO perfil de walk.js: coastFactor + TERRAIN),
   * ligeramente por encima de la cresta de las olas para no parpadear con ellas.
   */
  _buildFoam() {
    const THREE = this._THREE;
    const R = this._islandR;
    const SEGS = 96;
    const HALF_W = 0.9;
    const y = TERRAIN.waterY + WATER.amp + 0.05;
    const top = TERRAIN.baseY + TERRAIN.beach.height / 2;
    const bottom = TERRAIN.baseY - TERRAIN.beach.height / 2;
    const waterFrac = (TERRAIN.waterY - top) / (bottom - top);
    const positions = new Float32Array((SEGS + 1) * 2 * 3);
    for (let i = 0; i <= SEGS; i += 1) {
      const angle = (i / SEGS) * Math.PI * 2 - Math.PI;
      const k = coastFactor(angle, TERRAIN.beach.amount);
      const topR = (R + TERRAIN.beach.topPad) * k;
      const bottomR = (R + TERRAIN.beach.bottomPad) * k;
      const waterR = topR + waterFrac * (bottomR - topR);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      positions.set(
        [cos * (waterR - HALF_W), y, sin * (waterR - HALF_W), cos * (waterR + HALF_W), y, sin * (waterR + HALF_W)],
        i * 6,
      );
    }
    const indices = [];
    for (let i = 0; i < SEGS; i += 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
  }

  /**
   * Nubes billboard: pocos sprites blancos suaves (textura radial cacheada) a
   * gran altura, con posiciones deterministas por hash y deriva lentísima en
   * el loop (_tickEnvironment). Sin niebla: son parte del cielo.
   * @returns {object[]} Sprites (con userData.drift) para añadir al grupo estático.
   */
  _buildClouds() {
    const THREE = this._THREE;
    const R = this._islandR;
    const seed = hashId(`clouds:${this.map?.id ?? 'seed'}`);
    const texture = this._envTexture('cloud');
    const clouds = [];
    for (let i = 0; i < CLOUDS.count; i += 1) {
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.7 + hashUnit(seed, i * 7 + 5) * 0.2,
        depthWrite: false,
        fog: false,
      });
      const sprite = new THREE.Sprite(material);
      const angle = hashUnit(seed, i * 7 + 1) * Math.PI * 2;
      const r = R * (0.5 + hashUnit(seed, i * 7 + 2) * 2);
      sprite.position.set(
        Math.cos(angle) * r,
        R * (0.95 + hashUnit(seed, i * 7 + 3) * 0.4),
        Math.sin(angle) * r,
      );
      const w = R * (0.55 + hashUnit(seed, i * 7 + 4) * 0.5);
      sprite.scale.set(w, w * 0.42, 1);
      sprite.userData.drift = CLOUDS.drift * (0.5 + hashUnit(seed, i * 7 + 6));
      clouds.push(sprite);
    }
    return clouds;
  }

  /**
   * Vegetación y props DETERMINISTAS (MC-10): árboles (coníferas de conos
   * apilados y frondosos de copa achatada), rocas (icosaedros a escala no
   * uniforme) y flores junto a las casas. Posiciones de scatterPositions
   * (walk.js, puro) sobre la meseta de hierba, con exclusiones de casas,
   * puerto y senda/ruta del journey VIGENTE al construir (si el journey cambia
   * en la sesión la vegetación no se recoloca: coste cero, deriva asumida).
   * Todo con InstancedMesh: decenas de instancias por geometría en una sola
   * draw call cada una.
   */
  _buildVegetation() {
    const THREE = this._THREE;
    const R = this._islandR;
    const group = new THREE.Group();
    const seed = hashId(`veg:${this.map?.id ?? 'seed'}`);

    // Exclusiones: casas (+respiro), puerto y senda/ruta muestreadas a círculos.
    const exclusions = this._walkCities.map((c) => ({
      x: c.wx,
      z: c.wz,
      r: CITY_COLLIDER_RADIUS + 2.4,
    }));
    if (this.map.startPort) {
      const p = worldFromMap(this.map.startPort.x, this.map.startPort.y);
      exclusions.push({ x: p.wx, z: p.wz, r: 15 });
    }
    // La cabaña del brujo (MC-22): mismo respiro que las casas.
    if (this._wizardSpotW) {
      exclusions.push({
        x: this._wizardSpotW.wx,
        z: this._wizardSpotW.wz,
        r: WIZARD.colliderRadius + 2.4,
      });
    }
    // Vallas TRIBBU (MC-23): respiro alrededor de cada valla (que ningún árbol
    // tape la marca).
    for (const spot of this._billboardSpotsW) {
      exclusions.push({ x: spot.wx, z: spot.wz, r: BILLBOARD.clearance });
    }
    // Carteles de comarca (JG-7): que la vegetación no tape el tablón.
    for (const spot of this._areaSignSpots.values()) {
      exclusions.push({ x: spot.wx, z: spot.wz, r: 2.2 });
    }
    const pathIds = [
      ...(this.journey?.visitedCities ?? []),
      ...(this.journey?.plannedRoute ?? []),
    ];
    const path = journeyPathPoints(this.map, pathIds);
    for (let i = 0; i < path.length - 1; i += 1) {
      const a = path[i];
      const b = path[i + 1];
      const steps = Math.max(Math.ceil(Math.hypot(b.wx - a.wx, b.wz - a.wz) / 3), 1);
      for (let s = 0; s <= steps; s += 1) {
        exclusions.push({
          x: a.wx + ((b.wx - a.wx) * s) / steps,
          z: a.wz + ((b.wz - a.wz) * s) / steps,
          r: PATH_WIDTH + 1,
        });
      }
    }

    // Siempre sobre la meseta de hierba, pese a la costa irregular.
    const maxR = R * (1 - 1.6 * TERRAIN.grass.amount) - 1.5;
    const treeCount = Math.min(Math.max(Math.round(R * 0.9), 24), 90);
    const rockCount = Math.min(Math.max(Math.round(R * 0.35), 8), 30);
    const spots = scatterPositions(treeCount + rockCount, maxR, exclusions, seed);
    /** @type {{x: number, z: number}[]} */
    const conifers = [];
    const leafies = [];
    const palms = [];
    const rocks = [];
    // Reparto (JG-7): la franja COSTERA es de las palmeras (la estrella de la
    // isla pirata); coníferas y frondosos se quedan con el interior.
    const coastR = maxR * PALM.coastBand;
    spots.forEach((p, i) => {
      if (i >= treeCount) rocks.push(p);
      else if (Math.hypot(p.x, p.z) > coastR) palms.push(p);
      else if (hashUnit(seed, 5000 + i) < 0.55) conifers.push(p);
      else leafies.push(p);
    });

    /** Materiales planos de la vegetación (uno por color). */
    const mat = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });
    const dummy = new THREE.Object3D();
    /**
     * InstancedMesh con una matriz por elemento; `place` configura el dummy
     * (posición/rotación/escala) para el elemento i — DEBE ser determinista.
     */
    const instanced = (geo, material, items, place, castShadow = true) => {
      if (items.length === 0) return;
      const mesh = new THREE.InstancedMesh(geo, material, items.length);
      items.forEach((p, i) => {
        dummy.position.set(0, 0, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        place(dummy, p, i);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = SHADOWS.enabled && castShadow;
      group.add(mesh);
    };
    const groundY = (p) => groundHeightAt(p.x, p.z, { radius: R });

    // Conífera: tronco + dos conos apilados (offsets horneados en la geometría:
    // las tres mallas instanciadas comparten la MISMA transformación).
    const coniferPlace = (d, p, i) => {
      d.position.set(p.x, groundY(p) - 0.05, p.z);
      d.rotation.y = hashUnit(seed, 6000 + i * 3) * Math.PI * 2;
      d.scale.setScalar(0.8 + hashUnit(seed, 6001 + i * 3) * 0.6);
    };
    const coniferTrunk = new THREE.CylinderGeometry(0.16, 0.24, 1.1, 5);
    coniferTrunk.translate(0, 0.55, 0);
    const coniferCone1 = new THREE.ConeGeometry(1.15, 1.7, 6);
    coniferCone1.translate(0, 1.75, 0);
    const coniferCone2 = new THREE.ConeGeometry(0.75, 1.3, 6);
    coniferCone2.translate(0, 2.9, 0);
    const trunkMat = mat(ENV_COLORS.post);
    const coniferMat = mat(ENV_COLORS.conifer);
    instanced(coniferTrunk, trunkMat, conifers, coniferPlace);
    instanced(coniferCone1, coniferMat, conifers, coniferPlace);
    instanced(coniferCone2, coniferMat, conifers, coniferPlace);

    // Frondoso: tronco más alto + copa esférica achatada.
    const leafyPlace = (d, p, i) => {
      d.position.set(p.x, groundY(p) - 0.05, p.z);
      d.rotation.y = hashUnit(seed, 7000 + i * 3) * Math.PI * 2;
      d.scale.setScalar(0.85 + hashUnit(seed, 7001 + i * 3) * 0.5);
    };
    const leafyTrunk = new THREE.CylinderGeometry(0.14, 0.2, 1.5, 5);
    leafyTrunk.translate(0, 0.75, 0);
    const leafyCrown = new THREE.SphereGeometry(1.05, 7, 5);
    leafyCrown.scale(1, 0.75, 1);
    leafyCrown.translate(0, 2.05, 0);
    instanced(leafyTrunk, trunkMat, leafies, leafyPlace);
    instanced(leafyCrown, mat(ENV_COLORS.leafy), leafies, leafyPlace);

    // PALMERA (JG-7): tronco curvado — segmentos cortos con deriva lateral
    // cuadrática horneada — y corona de hojas arqueadas (planos doblados por
    // vértices). Cada conjunto se FUSIONA en una geometría (mergeGeometries):
    // todas las palmeras de la isla suman 2 draw calls.
    const merge = this._mergeGeometries;
    const palmPlace = (d, p, i) => {
      d.position.set(p.x, groundY(p) - 0.05, p.z);
      d.rotation.y = hashUnit(seed, 6500 + i * 3) * Math.PI * 2;
      d.scale.setScalar(0.85 + hashUnit(seed, 6501 + i * 3) * 0.5);
    };
    const trunkParts = [];
    for (let s = 0; s < PALM.segments; s += 1) {
      const t0 = s / PALM.segments;
      const t1 = (s + 1) / PALM.segments;
      const part = new THREE.CylinderGeometry(
        PALM.baseR + (PALM.topR - PALM.baseR) * t1,
        PALM.baseR + (PALM.topR - PALM.baseR) * t0,
        PALM.segmentH,
        5,
      );
      const mid = (t0 + t1) / 2;
      part.translate(PALM.lean * mid * mid, PALM.segmentH * (s + 0.5), 0);
      trunkParts.push(part);
    }
    const palmTrunkGeo = merge(trunkParts);
    for (const part of trunkParts) part.dispose();
    // Hoja: plano a lo largo de +z con arco por vértices (sube un poco y la
    // punta se vence, droop cuadrático); la corona reparte `leaves` copias.
    const leafBase = new THREE.PlaneGeometry(PALM.leafW, PALM.leafLen, 1, PALM.leafSteps);
    leafBase.translate(0, PALM.leafLen / 2, 0); // la base de la hoja, en el origen
    leafBase.rotateX(Math.PI / 2); // tumbada, apuntando a +z
    const lp = leafBase.attributes.position;
    for (let i = 0; i < lp.count; i += 1) {
      const t = lp.getZ(i) / PALM.leafLen;
      lp.setY(i, lp.getY(i) + 0.35 * t - PALM.droop * t * t);
    }
    leafBase.computeVertexNormals();
    const trunkTop = PALM.segments * PALM.segmentH;
    const fronds = [];
    for (let l = 0; l < PALM.leaves; l += 1) {
      const frond = leafBase.clone();
      frond.rotateY((l / PALM.leaves) * Math.PI * 2 + 0.4);
      frond.translate(PALM.lean, trunkTop, 0); // la corona nace donde acaba el tronco
      fronds.push(frond);
    }
    const palmCrownGeo = merge(fronds);
    leafBase.dispose();
    for (const frond of fronds) frond.dispose();
    instanced(palmTrunkGeo, mat(ENV_COLORS.palmTrunk), palms, palmPlace);
    instanced(
      palmCrownGeo,
      new THREE.MeshLambertMaterial({
        color: ENV_COLORS.palmLeaf,
        flatShading: true,
        side: THREE.DoubleSide,
      }),
      palms,
      palmPlace,
    );

    // Matas de hierba (JG-7): manojos de conos finos fusionados, repartidos
    // con las MISMAS exclusiones y semilla propia (no pisan árboles ni props).
    const tuftCount = Math.min(Math.max(Math.round(R * 1.3), 30), 110);
    const tuftSpots = scatterPositions(
      tuftCount,
      maxR,
      exclusions,
      hashId(`tuft:${this.map?.id ?? 'seed'}`),
    );
    const tuftParts = [];
    for (let b = 0; b < TUFT.blades; b += 1) {
      const blade = new THREE.ConeGeometry(TUFT.r, TUFT.h, 4);
      blade.translate(0, TUFT.h / 2, 0);
      const a = (b / TUFT.blades) * Math.PI * 2;
      blade.rotateX(0.28); // cada brizna, vencida…
      blade.rotateY(a); // …hacia un tercio del abanico
      blade.translate(Math.cos(a) * TUFT.spread, 0, Math.sin(a) * TUFT.spread);
      tuftParts.push(blade);
    }
    const tuftGeo = merge(tuftParts);
    for (const part of tuftParts) part.dispose();
    instanced(
      tuftGeo,
      mat(ENV_COLORS.stem),
      tuftSpots,
      (d, p, i) => {
        d.position.set(p.x, groundY(p), p.z);
        d.rotation.y = hashUnit(seed, 9800 + i) * Math.PI * 2;
        d.scale.setScalar(0.8 + hashUnit(seed, 9801 + i) * 0.6);
      },
      false,
    );

    // Rocas: icosaedros a escala NO uniforme (cada roca es distinta sin
    // deformar vértices: barato y determinista).
    instanced(new THREE.IcosahedronGeometry(0.65, 0), mat(ENV_COLORS.rock), rocks, (d, p, i) => {
      d.position.set(p.x, groundY(p) - 0.1, p.z);
      d.rotation.y = hashUnit(seed, 8000 + i * 4) * Math.PI * 2;
      d.scale.set(
        0.6 + hashUnit(seed, 8001 + i * 4),
        0.45 + hashUnit(seed, 8002 + i * 4) * 0.8,
        0.6 + hashUnit(seed, 8003 + i * 4),
      );
    });

    // Flores/matas junto a las casas: 2-3 por ciudad en un anillo fuera del
    // radio de colisión (no estorban la marcha), mitad coral, mitad cálidas.
    /** @type {{x: number, z: number}[]} */
    const flowers = [];
    this._walkCities.forEach((c, ci) => {
      const n = 2 + (hashId(c.id) & 1);
      for (let f = 0; f < n; f += 1) {
        const angle = hashUnit(seed, 9000 + ci * 16 + f * 3) * Math.PI * 2;
        const rr = CITY_COLLIDER_RADIUS + 0.5 + hashUnit(seed, 9001 + ci * 16 + f * 3) * 1.6;
        const x = c.wx + Math.cos(angle) * rr;
        const z = c.wz + Math.sin(angle) * rr;
        if (Math.hypot(x, z) > maxR) continue;
        flowers.push({ x, z });
      }
    });
    const flowerPlace = (d, p, i) => {
      d.position.set(p.x, groundY(p), p.z);
      d.scale.setScalar(0.8 + hashUnit(seed, 9500 + i) * 0.5);
    };
    const stemGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.32, 4);
    stemGeo.translate(0, 0.16, 0);
    const headGeo = new THREE.SphereGeometry(0.12, 6, 4);
    headGeo.translate(0, 0.36, 0);
    const coralFlowers = flowers.filter((_, i) => i % 2 === 0);
    const warmFlowers = flowers.filter((_, i) => i % 2 === 1);
    instanced(stemGeo, mat(ENV_COLORS.stem), flowers, flowerPlace, false);
    instanced(headGeo, mat(ENV_COLORS.flowerCoral), coralFlowers, flowerPlace, false);
    instanced(headGeo, mat(ENV_COLORS.flowerWarm), warmFlowers, flowerPlace, false);

    return group;
  }

  // ---- Avatar en vista aérea (MC-10) --------------------------------------------

  /**
   * Geometrías del personajillo low-poly, con los pivotes horneados (translate)
   * para que la animación procedural sea un simple rotation.x. Se crean por
   * build y se COMPARTEN entre todas las figuras de ese build (avatar propio o
   * compañeros, MC-12); _disposeSubtree las libera con su grupo.
   */
  _makeFigureAssets() {
    const THREE = this._THREE;
    const legGeo = new THREE.BoxGeometry(AVATAR.legW, AVATAR.legH, AVATAR.legW);
    legGeo.translate(0, -AVATAR.legH / 2, 0); // pivote en la cadera
    const bodyGeo = new THREE.BoxGeometry(AVATAR.bodyW, AVATAR.bodyH, AVATAR.bodyD);
    const armGeo = new THREE.BoxGeometry(AVATAR.armW, AVATAR.armH, AVATAR.armW);
    armGeo.translate(0, -AVATAR.armH / 2 + 0.06, 0); // pivote en el hombro
    const headGeo = new THREE.BoxGeometry(AVATAR.headS, AVATAR.headS, AVATAR.headS);
    const capGeo = new THREE.BoxGeometry(AVATAR.headS + 0.08, 0.16, AVATAR.headS + 0.08);
    return { legGeo, bodyGeo, armGeo, headGeo, capGeo };
  }

  /**
   * Figura low-poly del personajillo (estilo noventero): piernas con pivote en
   * la cadera, cuerpo, brazos con pivote en el hombro, cabeza y gorra.
   * userData.limbs guarda las referencias que animan _tickAvatar (zancada) y
   * _tickTeammates (idle). La fachada de la figura es +z local (la misma
   * convención que las casas): rotation.y = yaw.
   * @param {{ legGeo: object, bodyGeo: object, armGeo: object, headGeo: object, capGeo: object }} assets
   * @param {(color: number) => object} materialFor Cache de materiales del build.
   * @param {{ body: number, legs: number, skin: number, cap: number }} colors
   */
  _buildFigure(assets, materialFor, colors) {
    const THREE = this._THREE;
    const group = new THREE.Group();
    const add = (mesh) => {
      mesh.castShadow = SHADOWS.enabled;
      group.add(mesh);
      return mesh;
    };
    const legMat = materialFor(colors.legs);
    const legL = add(new THREE.Mesh(assets.legGeo, legMat));
    legL.position.set(-AVATAR.hipGap, AVATAR.legH, 0);
    const legR = add(new THREE.Mesh(assets.legGeo, legMat));
    legR.position.set(AVATAR.hipGap, AVATAR.legH, 0);
    const bodyMat = materialFor(colors.body);
    const body = add(new THREE.Mesh(assets.bodyGeo, bodyMat));
    body.position.y = AVATAR.legH + AVATAR.bodyH / 2;
    const shoulderY = AVATAR.legH + AVATAR.bodyH - 0.06;
    const armX = AVATAR.bodyW / 2 + AVATAR.armW / 2 + 0.02;
    const armL = add(new THREE.Mesh(assets.armGeo, bodyMat));
    armL.position.set(-armX, shoulderY, 0);
    const armR = add(new THREE.Mesh(assets.armGeo, bodyMat));
    armR.position.set(armX, shoulderY, 0);
    const head = add(new THREE.Mesh(assets.headGeo, materialFor(colors.skin)));
    head.position.y = AVATAR.legH + AVATAR.bodyH + AVATAR.headS / 2 + 0.04;
    const cap = add(new THREE.Mesh(assets.capGeo, materialFor(colors.cap)));
    cap.position.y = head.position.y + AVATAR.headS / 2 + 0.06;
    group.userData.limbs = { legL, legR, armL, armR };
    return group;
  }

  /** Cache de materiales Lambert planos por color para un build de figuras. */
  static _figureMaterialCache(THREE) {
    const materials = new Map();
    return (color) => {
      let m = materials.get(color);
      if (!m) {
        m = new THREE.MeshLambertMaterial({ color, flatShading: true });
        materials.set(color, m);
      }
      return m;
    };
  }

  /**
   * Avatar PROPIO de la vista aérea (MC-10): la figura compartida con los
   * colores GREBLA (piernas navy, cuerpo teal y gorra coral — la gorra coral
   * es exclusiva del propio; los compañeros visten teammateTint).
   */
  _buildAvatar() {
    return this._buildFigure(
      this._makeFigureAssets(),
      CareerIsland3D._figureMaterialCache(this._THREE),
      AVATAR_COLORS,
    );
  }

  /**
   * Recoloca el avatar en su spawn (la ciudad actual del journey o el puerto,
   * el MISMO criterio que el modo a pie: _fpsSpawn) mirando a su objetivo.
   * Se usa al cambiar de isla; en el resto de casos el avatar conserva su sitio.
   */
  _resetAvatar() {
    if (!this._avatar || !this.map) return;
    const spawn = this._fpsSpawn();
    this._avatarPos = { x: spawn.x, z: spawn.z };
    this._avatarYaw = Math.atan2(spawn.lookX - spawn.x, spawn.lookZ - spawn.z);
    this._avatarPhase = 0;
    this._avatarSwing = 0;
    this._avatarStepCount = 0;
    this._placeAvatar();
  }

  /**
   * Aplica la posición (pegada al MISMO suelo del fps: groundHeightAt, más el
   * rebote de zancada) y el yaw al grupo del avatar.
   * @param {number} [bob] Rebote vertical (unidades).
   */
  _placeAvatar(bob = 0) {
    const avatar = this._avatar;
    if (!avatar) return;
    avatar.position.set(
      this._avatarPos.x,
      groundHeightAt(this._avatarPos.x, this._avatarPos.z, { radius: this._islandR }) + bob,
      this._avatarPos.z,
    );
    avatar.rotation.y = this._avatarYaw;
  }

  /** Muestra/oculta el avatar (a pie se oculta: la cámara ES el avatar). @param {boolean} visible */
  _setAvatarVisible(visible) {
    if (this._avatar) this._avatar.visible = visible;
  }

  /**
   * Un frame del avatar en vista aérea (MC-10): dirección relativa a la CÁMARA
   * proyectada al suelo (W aleja de la vista, A/D lateral — lo natural en
   * tercera persona), paso acotado a la isla (stepPosition: desliza por la
   * costa) y colisión con las casas (collideWithCities: desliza por el
   * contorno; el empuje FRONTAL «entra», mismo flujo que a pie). El avatar
   * rota hacia su dirección de marcha (yawToward) y la zancada se anima por
   * fase ∝ distancia (piernas/brazos a contrapié + rebote), con un peso que
   * sube/baja suavemente al arrancar y parar. Mientras se mueve, el target de
   * los OrbitControls y la cámara lo siguen con un lerp — salvo que haya una
   * animación de foco en curso (ella manda; el follow vuelve al mover de nuevo).
   * @param {DOMHighResTimeStamp} now
   */
  _tickAvatar(now) {
    const avatar = this._avatar;
    const dt = Math.min((now - (this._lastAvatarTs || now)) / 1000, 0.05);
    this._lastAvatarTs = now;
    if (!avatar || !avatar.visible) return;
    let moved = 0;
    if (this._insideCityId === null && this._keys.size > 0) {
      const key = (code) => (this._keys.has(code) ? 1 : 0);
      const fwd = key('KeyW') + key('ArrowUp') - key('KeyS') - key('ArrowDown');
      const strafe = key('KeyD') + key('ArrowRight') - key('KeyA') - key('ArrowLeft');
      if (fwd !== 0 || strafe !== 0) {
        // Forward de la cámara proyectado al plano del suelo; si la cámara
        // mira en picado puro (proyección degenerada), vale el yaw del avatar.
        const look = this._camera.getWorldDirection(this._walkDirScratch);
        const flen = Math.hypot(look.x, look.z);
        const fx = flen > 1e-6 ? look.x / flen : Math.sin(this._avatarYaw);
        const fz = flen > 1e-6 ? look.z / flen : Math.cos(this._avatarYaw);
        // right = forward × up (mundo y-arriba) = (-fz, fx).
        const dir = { x: fx * fwd - fz * strafe, z: fz * fwd + fx * strafe };
        const running = this._keys.has('ShiftLeft') || this._keys.has('ShiftRight');
        const next = stepPosition(
          this._avatarPos,
          dir,
          dt,
          WALK_SPEED * (running ? RUN_MULTIPLIER : 1),
          { radius: this._walkRadius },
        );
        const colCities = collideWithCities(this._avatarPos, next, this._walkCities, CITY_COLLIDER_RADIUS);
        // La cabaña del brujo tampoco se atraviesa (MC-22); el choque frontal
        // del avatar abre su panel, como el de las casas.
        const col = this._collideWizard(this._avatarPos, colCities);
        moved = Math.hypot(col.x - this._avatarPos.x, col.z - this._avatarPos.z);
        this._avatarPos = { x: col.x, z: col.z };
        // Rota hacia la dirección de marcha DESEADA (aunque esté deslizando
        // por un borde): el personaje siempre encara hacia donde empuja.
        this._avatarYaw = yawToward(
          this._avatarYaw,
          Math.atan2(dir.x, dir.z),
          dt,
          AVATAR.turnSpeed,
        );
        if (colCities.hitCityId !== null) this._enterCity(colCities.hitCityId);
        else if (col.hitWizard) this._openWizard();
      }
    }
    // Zancada procedural: fase ∝ distancia recorrida, peso con fundido al
    // arrancar/parar (sin cortes secos de brazos y piernas).
    if (moved > 1e-6) {
      this._avatarPhase += moved * AVATAR.stepFreq;
      this._avatarSwing = Math.min(this._avatarSwing + dt * 6, 1);
      // Un tick de paso por ZANCADA (media onda de la fase, MC-11): al ir la
      // fase ∝ distancia, el rate del sonido sigue solo a la velocidad.
      const steps = Math.floor(this._avatarPhase / Math.PI);
      if (steps > this._avatarStepCount) this._audio.step();
      this._avatarStepCount = steps;
    } else {
      this._avatarSwing = Math.max(this._avatarSwing - dt * 6, 0);
    }
    const swing = Math.sin(this._avatarPhase) * AVATAR.swingAmp * this._avatarSwing;
    const { legL, legR, armL, armR } = avatar.userData.limbs;
    legL.rotation.x = swing;
    legR.rotation.x = -swing;
    armL.rotation.x = -swing * 0.8;
    armR.rotation.x = swing * 0.8;
    const bob = Math.abs(Math.sin(this._avatarPhase)) * AVATAR.bobAmp * this._avatarSwing;
    this._placeAvatar(bob);
    // Follow de cámara: solo mientras el avatar se mueve y no hay una
    // animación de foco en curso (focusCity/focusArea/focusOverview mandan).
    if (moved > 1e-6 && this._camAnim === null) {
      const target = this._controls.target;
      const k = Math.min(dt * AVATAR.followRate, 1);
      const dx = (this._avatarPos.x - target.x) * k;
      const dz = (this._avatarPos.z - target.z) * k;
      target.x += dx;
      target.z += dz;
      this._camera.position.x += dx;
      this._camera.position.z += dz;
    }
  }

  // ---- Compañeros del equipo (MC-12) --------------------------------------------

  _rebuildTeammates() {
    if (!this.map) return;
    this._replaceGroup('_teammatesGroup', this._buildTeammates());
    this._updateLabels(); // etiquetas nuevas: ni un frame sin escala/declutter (MC-17)
  }

  /**
   * Grupo de compañeros (MC-12): una figura por compañero con `currentCity`
   * válida (las ciudades retiradas del mapa se omiten, como en
   * journeyPathPoints), colocada en arco frente a la fachada de su casa
   * (teammateOffsets: varios en la misma ciudad no se solapan) y mirando hacia
   * fuera. La variación es determinista por personId (teammateTint: camiseta y
   * gorra del hash, nunca la gorra coral del avatar propio) igual que la fase
   * del idle. El nombre va en un sprite pequeño sobre la cabeza que
   * _updateLabels funde por distancia y desconflictúa (MC-17). Geometrías y
   * materiales se comparten dentro del build; _disposeSubtree los libera con
   * el grupo.
   */
  _buildTeammates() {
    const THREE = this._THREE;
    const group = new THREE.Group();
    this._teammateFigures = [];
    this._teammateLabels = [];
    this._teammateSpots = []; // posiciones para los puntitos del minimapa (MC-13)
    const list = this.teammates ?? [];
    if (list.length === 0) return group;

    const byId = new Map((this.map.cities ?? []).map((c) => [c.id, c]));
    const portW = this.map.startPort
      ? worldFromMap(this.map.startPort.x, this.map.startPort.y)
      : null;
    const assets = this._makeFigureAssets();
    const materialFor = CareerIsland3D._figureMaterialCache(THREE);

    // Agrupados por ciudad y ordenados por personId DENTRO de cada ciudad: el
    // offset de cada compañero no depende del orden de llegada de la prop.
    const byCity = Object.groupBy(
      list.filter((t) => byId.has(t.currentCity)),
      (t) => t.currentCity,
    );
    for (const [cityId, mates] of Object.entries(byCity)) {
      const city = byId.get(cityId);
      const { wx, wz } = worldFromMap(city.x, city.y);
      // MISMA orientación que la casa en _buildCities: fachada hacia el puerto
      // con el jitter determinista de cityVariant.
      const v = cityVariant(city.id);
      const d = Math.hypot(wx, wz);
      const baseYaw = portW
        ? facadeYawToward({ wx, wz }, portW)
        : d > 0.001
          ? Math.atan2(-wx, -wz)
          : 0;
      const houseYaw = baseYaw + v.rotation * FACADE_JITTER;
      const cosY = Math.cos(houseYaw);
      const sinY = Math.sin(houseYaw);
      const sorted = [...mates].sort((a, b) => a.personId.localeCompare(b.personId));
      const offsets = teammateOffsets(sorted.length);
      sorted.forEach((mate, i) => {
        const o = offsets[i];
        // Offset local de la casa rotado a mundo (misma matriz que los postes del muelle).
        const x = wx + o.lx * cosY + o.lz * sinY;
        const z = wz - o.lx * sinY + o.lz * cosY;
        const tint = teammateTint(mate.personId);
        const figure = this._buildFigure(assets, materialFor, {
          body: tint.body,
          legs: AVATAR_COLORS.legs,
          skin: AVATAR_COLORS.skin,
          cap: tint.cap,
        });
        figure.position.set(x, groundHeightAt(x, z, { radius: this._islandR }), z);
        figure.rotation.y = houseYaw + o.yaw; // de espaldas a su casa, mirando hacia fuera
        figure.userData.personId = mate.personId;
        // Idle con fase y velocidad deterministas por persona (nada de RNG).
        const seed = hashId(mate.personId);
        figure.userData.sway = {
          phase: hashUnit(seed, 1) * Math.PI * 2,
          speed: TEAMMATE.swaySpeedBase + hashUnit(seed, 2) * TEAMMATE.swaySpeedJitter,
        };
        const label = this._makeLabel(mate.name, {
          x: 0,
          y: TEAMMATE.labelY,
          z: 0,
          scale: TEAMMATE.labelScale,
          color: '#1e3a5f',
          id: `mate:${mate.personId}`,
          kind: 'teammate',
          targetPx: LABEL_PX.teammate,
          priority: LABEL_PRIORITY.teammate,
        });
        label.material.opacity = 0; // el fundido por distancia lo enciende de cerca
        label.visible = false;
        figure.add(label);
        this._teammateLabels.push(label);
        this._teammateFigures.push(figure);
        this._teammateSpots.push({ x, z });
        group.add(figure);
      });
    }
    return group;
  }

  /**
   * Un frame del idle de los compañeros (MC-12), en cualquier modo de cámara:
   * balanceo sutil de brazos a contrapié y una inclinación leve del cuerpo,
   * con fase/velocidad deterministas por persona — se sienten vivos sin
   * caminar. Sus nombres (fundido por distancia, tamaño y declutter) los
   * muestrea _updateLabels con el resto de etiquetas (MC-17).
   * @param {DOMHighResTimeStamp} now
   */
  _tickTeammates(now) {
    if (this._teammateFigures.length === 0) return;
    const t = now / 1000;
    for (const figure of this._teammateFigures) {
      const { phase, speed } = figure.userData.sway;
      const s = Math.sin(t * speed + phase);
      const { armL, armR } = figure.userData.limbs;
      armL.rotation.x = s * TEAMMATE.swayArm;
      armR.rotation.x = -s * TEAMMATE.swayArm;
      figure.rotation.z = s * TEAMMATE.swayLean;
    }
  }

  /**
   * Compañero bajo la mira en modo fps (raycast desde el centro de la
   * pantalla, alcance acotado), o null.
   * @returns {string|null} personId del compañero apuntado.
   */
  _pickTeammateFromCenter() {
    if (!this._teammatesGroup || this._teammatesGroup.children.length === 0) return null;
    const THREE = this._THREE;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this._camera);
    raycaster.far = TEAMMATE.fpsPickRange;
    return CareerIsland3D._teammateFromHits(
      raycaster.intersectObjects(this._teammatesGroup.children, true),
    );
  }

  /** personId del primer impacto de raycast que pertenezca a una figura de compañero. */
  static _teammateFromHits(hits) {
    for (const hit of hits) {
      let obj = hit.object;
      while (obj && obj.userData.personId === undefined) obj = obj.parent;
      if (obj?.userData.personId) return obj.userData.personId;
    }
    return null;
  }

  /**
   * Abre el mini-resumen de un compañero apuntado desde el modo inmersivo:
   * suelta el pointer lock (JG-3: se vuelve al modo libre) para que el ratón
   * pueda usar el popover.
   * @param {string} personId
   */
  _openTeammate(personId) {
    if (this._fpsLocked) document.exitPointerLock();
    const canvas = this.renderRoot.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    this._emitTeammate(personId, rect.width / 2, rect.height / 2);
  }

  /**
   * Notifica el clic sobre un compañero. x/y son píxeles RELATIVOS al canvas
   * (ancla del popover del contenedor). El detalle lleva SOLO el personId: los
   * datos del resumen ya los tiene <career-app> (privacidad en un único sitio).
   * @param {string} personId @param {number} x @param {number} y
   */
  _emitTeammate(personId, x, y) {
    this.dispatchEvent(
      new CustomEvent('select-teammate', {
        detail: { personId, x, y },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Ambiente animado (MC-10), en TODOS los modos: ondulación senoidal de los
   * vértices del agua (con renormalizado barato: la malla es gruesa), deriva
   * lentísima de las nubes con envoltura en los bordes del mundo, y el ondeo
   * de la bandera pirata (JG-7): seno sobre las posiciones BASE del paño con
   * amplitud creciente hacia el borde libre (el lado del mástil, quieto).
   * @param {DOMHighResTimeStamp} now
   */
  _tickEnvironment(now) {
    const dt = Math.min((now - (this._lastEnvTs || now)) / 1000, 0.1);
    this._lastEnvTs = now;
    const water = this._waterMesh;
    if (water) {
      const t = (now / 1000) * WATER.speed;
      const pos = water.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 1) {
        // El plano es XY local (rotado -90° a suelo): z local = altura de mundo.
        const x = pos.getX(i);
        const y = pos.getY(i);
        pos.setZ(i, Math.sin(x * WATER.freq + t) * Math.cos(y * WATER.freq * 0.85 + t * 0.8) * WATER.amp);
      }
      pos.needsUpdate = true;
      water.geometry.computeVertexNormals();
    }
    const wrap = (this._islandR || 50) * 3.5;
    for (const cloud of this._clouds) {
      cloud.position.x += cloud.userData.drift * dt;
      if (cloud.position.x > wrap) cloud.position.x = -wrap;
    }
    // Bandera pirata (JG-7): ondeo por vértices desde las posiciones base.
    const flagT = (now / 1000) * PIRATE_FLAG.waveSpeed;
    for (const flag of this._flags) {
      const pos = flag.geometry.attributes.position;
      const base = flag.userData.basePos;
      for (let i = 0; i < pos.count; i += 1) {
        const x = base[i * 3];
        const k = x / PIRATE_FLAG.w; // 0 en el mástil, 1 en el borde libre
        pos.setZ(i, Math.sin(x * PIRATE_FLAG.waveFreq + flagT) * PIRATE_FLAG.waveAmp * k);
      }
      pos.needsUpdate = true;
    }
  }

  // ---- Minimapa a pie (MC-13) ----------------------------------------------------

  /**
   * Radio de mundo que mapea al borde del disco del minimapa: cubre la playa
   * completa (falda máxima con la costa más expandida) más un respiro, de modo
   * que TODO lo caminable y la línea de costa caben siempre en el disco.
   */
  _minimapWorldRadius() {
    return (
      (this._islandR + TERRAIN.beach.bottomPad) * (1 + 1.6 * TERRAIN.beach.amount) +
      MINIMAP.worldPad
    );
  }

  /** Escala del backing store de los canvas del minimapa (nitidez en HiDPI). */
  static _minimapDpr() {
    return Math.min(globalThis.devicePixelRatio ?? 1, 2);
  }

  /**
   * Pre-pinta la capa ESTÁTICA del minimapa en el canvas offscreen (MC-13):
   * agua, silueta de la isla (la MISMA línea de costa que pintan las mallas y
   * pisa el caminante: coastFactor + TERRAIN, como la espuma), meseta de
   * hierba, senda de visitadas, puerto y casas como puntos con su color de
   * estado (la ciudad actual con aro coral). Se repinta solo cuando
   * _minimapDirty lo pide (cambio de journey/estados/mapa), no por frame.
   */
  _paintMinimapBase() {
    const size = MINIMAP.size;
    const dpr = CareerIsland3D._minimapDpr();
    let base = this._minimapBase;
    if (!base) {
      base = document.createElement('canvas');
      base.width = size * dpr;
      base.height = size * dpr;
      this._minimapBase = base;
    }
    const ctx = base.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const R = this._islandR;
    const worldR = this._minimapWorldRadius();
    const project = (x, z) => minimapProject(x, z, worldR, size);

    // Agua: disco de fondo (el recorte circular del overlay lo hace el CSS,
    // pero pintar un círculo deja limpias las esquinas del canvas).
    ctx.fillStyle = MINIMAP.water;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Contorno polar → polígono proyectado (96 segmentos, como la espuma).
    const coastPoly = (radiusAt) => {
      const SEGS = 96;
      ctx.beginPath();
      for (let i = 0; i <= SEGS; i += 1) {
        const angle = (i / SEGS) * Math.PI * 2 - Math.PI;
        const r = radiusAt(angle);
        const p = project(Math.cos(angle) * r, Math.sin(angle) * r);
        if (i === 0) ctx.moveTo(p.px, p.py);
        else ctx.lineTo(p.px, p.py);
      }
      ctx.closePath();
    };

    // Silueta de la isla: el radio donde la falda de la playa cruza el nivel
    // del agua (idéntico a _buildFoam: mismo perfil de walk.js).
    const top = TERRAIN.baseY + TERRAIN.beach.height / 2;
    const bottom = TERRAIN.baseY - TERRAIN.beach.height / 2;
    const waterFrac = (TERRAIN.waterY - top) / (bottom - top);
    coastPoly((angle) => {
      const k = coastFactor(angle, TERRAIN.beach.amount);
      const topR = (R + TERRAIN.beach.topPad) * k;
      const bottomR = (R + TERRAIN.beach.bottomPad) * k;
      return topR + waterFrac * (bottomR - topR);
    });
    ctx.fillStyle = MINIMAP.sand;
    ctx.fill();

    // Meseta de hierba (borde superior de su capa, con su propia irregularidad).
    coastPoly((angle) => (R + TERRAIN.grass.topPad) * coastFactor(angle, TERRAIN.grass.amount));
    ctx.fillStyle = MINIMAP.grass;
    ctx.fill();

    // Senda del camino recorrido: polilínea teal (misma fuente que la cinta 3D).
    const visitedPts = journeyPathPoints(this.map, this.journey?.visitedCities ?? []);
    if (visitedPts.length >= 2) {
      ctx.beginPath();
      for (const [i, p] of visitedPts.entries()) {
        const q = project(p.wx, p.wz);
        if (i === 0) ctx.moveTo(q.px, q.py);
        else ctx.lineTo(q.px, q.py);
      }
      ctx.strokeStyle = MINIMAP.path;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Puerto: punto navy con aro blanco (el punto de llegada).
    if (this.map.startPort) {
      const p = worldFromMap(this.map.startPort.x, this.map.startPort.y);
      const q = project(p.wx, p.wz);
      ctx.beginPath();
      ctx.arc(q.px, q.py, MINIMAP.portDot, 0, Math.PI * 2);
      ctx.fillStyle = MINIMAP.port;
      ctx.fill();
      ctx.strokeStyle = MINIMAP.outline;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // La cabaña del brujo (MC-22): punto púrpura con aro blanco.
    if (this._wizardSpotW) {
      const q = project(this._wizardSpotW.wx, this._wizardSpotW.wz);
      ctx.beginPath();
      ctx.arc(q.px, q.py, MINIMAP.cityDot, 0, Math.PI * 2);
      ctx.fillStyle = '#5b3d8f';
      ctx.fill();
      ctx.strokeStyle = MINIMAP.outline;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Casas: un punto por ciudad con su color de estado; la actual, aro coral.
    const current = this.journey?.currentCity ?? null;
    for (const city of this.map.cities ?? []) {
      const st = cityStatus(this.map, city.id, this.journey);
      const status = st === 'unknown' ? 'blocked' : st;
      const { wx, wz } = worldFromMap(city.x, city.y);
      const q = project(wx, wz);
      ctx.beginPath();
      ctx.arc(q.px, q.py, MINIMAP.cityDot, 0, Math.PI * 2);
      ctx.fillStyle = `#${cityStatusColor(status).toString(16).padStart(6, '0')}`;
      ctx.fill();
      ctx.strokeStyle = MINIMAP.outline;
      ctx.lineWidth = 1;
      ctx.stroke();
      if (city.id === current) {
        ctx.beginPath();
        ctx.arc(q.px, q.py, MINIMAP.currentRing, 0, Math.PI * 2);
        ctx.strokeStyle = MINIMAP.currentAccent;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  /**
   * Compone el minimapa (MC-13) en su canvas overlay: capa estática (repintada
   * solo si está sucia) + compañeros como puntitos neutros + TU posición como
   * flecha coral orientada con el yaw de la cámara (norte fijo: rota la
   * flecha, no el mapa — minimapHeading, puro). Se llama desde el loop con
   * cadencia MINIMAP.redrawMs y solo en modo fps.
   */
  _drawMinimap() {
    if (!this.map || !this._camera) return;
    const canvas = this.renderRoot.querySelector('canvas.minimap');
    if (!canvas) return; // el overlay aún no está en el DOM (primer render del modo)
    const size = MINIMAP.size;
    const dpr = CareerIsland3D._minimapDpr();
    if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
      canvas.width = size * dpr;
      canvas.height = size * dpr;
    }
    if (this._minimapDirty || !this._minimapBase) {
      this._paintMinimapBase();
      this._minimapDirty = false;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(this._minimapBase, 0, 0, size, size);
    const worldR = this._minimapWorldRadius();

    // Compañeros visibles: puntitos neutros (sin nombre: el minimapa orienta).
    for (const spot of this._teammateSpots) {
      const q = minimapProject(spot.x, spot.z, worldR, size);
      ctx.beginPath();
      ctx.arc(q.px, q.py, MINIMAP.mateDot, 0, Math.PI * 2);
      ctx.fillStyle = MINIMAP.mate;
      ctx.fill();
    }

    // Tu posición: flecha coral con el rumbo del forward de la cámara.
    const cam = this._camera.position;
    const look = this._camera.getWorldDirection(this._walkDirScratch);
    const q = minimapProject(cam.x, cam.z, worldR, size);
    ctx.save();
    ctx.translate(q.px, q.py);
    ctx.rotate(minimapHeading(look.x, look.z));
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fillStyle = MINIMAP.player;
    ctx.fill();
    ctx.strokeStyle = MINIMAP.outline;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // ---- Celebración de ciudadanía y audio (MC-11) --------------------------------

  /**
   * Silencia/activa el sonido de la isla (API pública para el botón HUD de
   * <career-app>). La preferencia persiste en localStorage; activar cuenta
   * como gesto (clic del botón) y desbloquea el AudioContext si hace falta.
   * @param {boolean} muted
   * @returns {boolean} El estado aplicado.
   */
  setAudioMuted(muted) {
    return this._audio.setMuted(muted);
  }

  /** Estado actual de silencio del audio de la isla. */
  get audioMuted() {
    return this._audio.muted;
  }

  /**
   * Celebración MAYOR de CIUDADANÍA DE ISLA (MC-20), pública para el
   * contenedor: <career-app> la invoca cuando el certificado recién obtenido
   * cruza el % objetivo de la isla. Corta la celebración de certificado que
   * este componente ya arrancó por su cuenta (mismo diff) y la sustituye por
   * la variante 'island': más confeti, más duración y fanfarria larga.
   * @param {string} cityId Ciudad cuyo certificado otorgó la ciudadanía.
   */
  celebrateCitizenship(cityId) {
    this._celebrate(cityId, 'island');
  }

  /**
   * Dispara la celebración sobre la casa de una ciudad: pulso emisivo dorado
   * en las paredes, confeti instanciado (trayectorias DETERMINISTAS de
   * hash+índice, celebration.js) y fanfarria. Variantes (MC-20): 'city'
   * celebra el CERTIFICADO (MC-11, por defecto) e 'island' es la celebración
   * MAYOR de la ciudadanía de la isla. El confeti vive en un grupo propio de
   * la ESCENA (no del grupo de ciudades): sobrevive a los rebuilds; el
   * material de pulso se re-aplica en cada rebuild (_buildCities). Una
   * celebración nueva corta la anterior.
   * @param {string} cityId
   * @param {'city'|'island'} [variant]
   */
  _celebrate(cityId, variant = 'city') {
    if (this._phase !== 'ready' || !this._citiesGroup) return;
    this._endCelebration();
    const node = this._citiesGroup.children.find((c) => c.userData.cityId === cityId);
    if (!node) return;
    const THREE = this._THREE;
    const cfg = CELEBRATION_VARIANTS[variant];

    // Confeti: planos instanciados con color por instancia (paleta GREBLA).
    const params = confettiParticles(hashId(`celebration:${variant}:${cityId}`), cfg.count);
    const mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(CONFETTI_SIZE.w, CONFETTI_SIZE.h),
      new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      }),
      params.length,
    );
    const color = new THREE.Color();
    params.forEach((p, i) => {
      mesh.setColorAt(i, color.setHex(CONFETTI_COLORS[p.colorIndex % CONFETTI_COLOR_COUNT]));
    });
    mesh.instanceColor.needsUpdate = true;
    const group = new THREE.Group();
    group.position.copy(node.position); // pie de la casa (wx, GROUND_Y, wz)
    group.add(mesh);
    this._scene.add(group);

    this._celebration = {
      cityId,
      cfg,
      start: performance.now(),
      group,
      mesh,
      params,
      topY: node.userData.topY,
      bodyMat: null,
      intensity: 0,
    };
    // El material de pulso lo aplica el MISMO camino que usan los rebuilds
    // (así no hay dos variantes que mantener): un rebuild inmediato lo monta.
    this._rebuildCities();
    this._audio.fanfare(variant);
  }

  /**
   * Un frame de la celebración (MC-11/MC-20), en cualquier modo de cámara:
   * anima el pulso emisivo dorado de las paredes (destellos con fundido de
   * salida) y el confeti (posición balística pura + giro; fundido al final)
   * según la variante en curso (c.cfg). Al agotar la duración se limpia sola.
   * @param {DOMHighResTimeStamp} now
   */
  _tickCelebration(now) {
    const c = this._celebration;
    if (!c) return;
    const t = (now - c.start) / 1000;
    if (t >= c.cfg.durationS) {
      this._endCelebration();
      return;
    }
    const fade = 1 - t / c.cfg.durationS;
    c.intensity = CELEBRATION_PULSE_PEAK * Math.abs(Math.sin(t * Math.PI * CELEBRATION_PULSE_HZ)) * fade;
    if (c.bodyMat) c.bodyMat.emissiveIntensity = c.intensity;
    const dummy = this._confettiDummy;
    for (const [i, p] of c.params.entries()) {
      const pos = confettiPosition(p, t, c.topY);
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.set(p.tilt, p.spin * t, p.tilt * 0.5);
      dummy.updateMatrix();
      c.mesh.setMatrixAt(i, dummy.matrix);
    }
    c.mesh.instanceMatrix.needsUpdate = true;
    // Fundido de salida del confeti en los últimos c.cfg.fadeS segundos.
    const fadeStart = c.cfg.durationS - c.cfg.fadeS;
    c.mesh.material.opacity = t <= fadeStart ? 1 : (c.cfg.durationS - t) / c.cfg.fadeS;
  }

  /** Corta y limpia la celebración en curso (fin, otra nueva o teardown). */
  _endCelebration() {
    const c = this._celebration;
    if (!c) return;
    this._scene.remove(c.group);
    CareerIsland3D._disposeSubtree(c.group);
    // El material de pulso queda en la casa (se libera con su grupo en el
    // siguiente rebuild): basta apagar la emisión.
    if (c.bodyMat) c.bodyMat.emissiveIntensity = 0;
    this._celebration = null;
  }

  /**
   * Etiqueta flotante: sprite con el texto pintado en un CanvasTexture (siempre
   * de cara a la cámara). El halo blanco garantiza el contraste sobre la escena.
   * `scale` es solo el alto INICIAL (unidades de mundo): el muestreo MC-17
   * (_updateLabels) re-escala el sprite por distancia para mantener `targetPx`
   * px en pantalla y decide su visibilidad con el declutter según `priority`.
   * @param {string} text
   * @param {{x:number,y:number,z:number,scale:number,color:string,strike?:boolean,
   *   id:string,kind:'area'|'city'|'teammate',targetPx:number,priority:number}} opts
   *   id: identidad para el declutter; kind: elige el fundido por distancia.
   */
  _makeLabel(text, { x, y, z, scale, color, strike = false, id, kind, targetPx, priority }) {
    const THREE = this._THREE;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const fs = 44;
    ctx.font = `700 ${fs}px system-ui, sans-serif`;
    const w = Math.ceil(ctx.measureText(text).width) + 24;
    canvas.width = w;
    canvas.height = fs + 24;
    // Cambiar el tamaño del canvas resetea el contexto: se reconfigura la fuente.
    ctx.font = `700 ${fs}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 8;
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = color;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    if (strike) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(12, canvas.height / 2);
      ctx.lineTo(canvas.width - 12, canvas.height / 2);
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true }),
    );
    sprite.position.set(x, y, z);
    sprite.scale.set((scale * canvas.width) / canvas.height, scale, 1);
    // Metadatos del muestreo de etiquetas (MC-17): identidad y prioridad para
    // el declutter, alto objetivo en px y proporción de la caja pintada.
    sprite.userData.label = { id, kind, targetPx, priority, aspect: canvas.width / canvas.height };
    return sprite;
  }

  /**
   * Badge circular con el NÚMERO de parada de la ruta de reto (JG-5): círculo
   * relleno con anillo blanco y el número (o ✓ en las paradas ya
   * certificadas) en el centro. Entra en el sistema de etiquetas (MC-17) con
   * kind 'challenge': tamaño aparente constante, prioridad máxima en el
   * declutter y SIN fundido por distancia — el camino se lee a cualquier zoom
   * mientras la casa esté a la vista.
   * @param {number} stopNumber Número de parada (1-based).
   * @param {'next'|'pending'|'done'} state Estado de la parada en el camino.
   * @param {{ y: number, id: string }} opts Altura sobre la casa e identidad declutter.
   * @returns {import('three').Sprite}
   */
  _makeChallengeBadge(stopNumber, state, { y, id }) {
    return this._makeStopBadge(state === 'done' ? '✓' : String(stopNumber), {
      fill: CHALLENGE_BADGE.colors[state],
      ink: '#ffffff',
      y,
      id,
      kind: 'challenge',
      targetPx: CHALLENGE_BADGE.targetPx,
      priority: LABEL_PRIORITY.challenge,
    });
  }

  /**
   * Badge circular con el NÚMERO de parada de la RUTA LIBRE (JG-9): el
   * hermano ámbar del badge de reto — fondo ámbar (claro con ✓ en las ya
   * certificadas) y tinta navy, para que la ruta personal no se confunda con
   * un reto. Mismo sistema de etiquetas: kind 'route' (sin fundido por
   * distancia) y prioridad máxima — nunca convive con los números de reto
   * (career-app oculta la numeración libre con reto activo).
   * @param {number} stopNumber Número GLOBAL de parada en la ruta (1-based).
   * @param {'pending'|'done'} state Estado de la parada.
   * @param {{ y: number, id: string }} opts Altura sobre la casa e identidad declutter.
   * @returns {import('three').Sprite}
   */
  _makeRouteBadge(stopNumber, state, { y, id }) {
    return this._makeStopBadge(state === 'done' ? '✓' : String(stopNumber), {
      fill: ROUTE_BADGE.colors[state],
      ink: ROUTE_BADGE.ink,
      y,
      id,
      kind: 'route',
      targetPx: ROUTE_BADGE.targetPx,
      priority: LABEL_PRIORITY.route,
    });
  }

  /**
   * Sprite de badge circular de parada, compartido por la ruta de reto (JG-5)
   * y la ruta libre (JG-9): círculo `fill` con anillo blanco (el halo que lo
   * separa del paisaje) y el texto (número o ✓) en tinta `ink`. Entra en el
   * sistema de etiquetas (MC-17) con tamaño aparente constante y sin fundido
   * por distancia — el camino se lee a cualquier zoom mientras la casa esté a
   * la vista.
   * @param {string} text Número de parada o ✓.
   * @param {{ fill: string, ink: string, y: number, id: string, kind: string,
   *   targetPx: number, priority: number }} opts
   * @returns {import('three').Sprite}
   */
  _makeStopBadge(text, { fill, ink, y, id, kind, targetPx, priority }) {
    const THREE = this._THREE;
    const canvas = document.createElement('canvas');
    const size = CHALLENGE_BADGE.canvasPx;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const center = size / 2;
    const radius = center - 6;
    // Círculo de estado con anillo blanco (el halo que lo separa del paisaje).
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.stroke();
    // El número de parada (✓ en las ya certificadas: parada superada).
    ctx.font = `800 ${text.length > 2 ? 38 : 48}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ink;
    ctx.fillText(text, center, center + 2);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    sprite.position.set(0, y, 0);
    sprite.scale.set(2.2, 2.2, 1);
    sprite.userData.label = { id, kind, targetPx, priority, aspect: 1 };
    return sprite;
  }

  /**
   * Textura del número de ruta SOBRE LA PUERTA (JG-25): mismo disco que el
   * badge aéreo, pero como textura para un plano de tamaño FIJO en el mundo —
   * así se ve también a pie (los badges-sprite de la capa de etiquetas se
   * ocultan en primera persona). Cacheada por texto+color.
   * @param {string} text @param {string} fill @param {string} ink
   */
  _doorNumberTexture(text, fill, ink) {
    const key = `${text}:${fill}:${ink}`;
    const cached = this._doorNumTextures.get(key);
    if (cached) return cached;
    const THREE = this._THREE;
    const size = CHALLENGE_BADGE.canvasPx;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const center = size / 2;
    ctx.beginPath();
    ctx.arc(center, center, center - 6, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.stroke();
    ctx.font = `800 ${text.length > 2 ? 38 : 48}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ink;
    ctx.fillText(text, center, center + 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.userData.shared = true;
    this._doorNumTextures.set(key, texture);
    return texture;
  }

  /**
   * Badge FIJO con el número de ruta sobre la puerta (JG-25): un plano pequeño
   * con la textura del número, visible en aérea y a pie (no vive en la capa de
   * etiquetas ocultable). Se orienta como la placa (frente de la casa).
   * @param {string} text @param {string} fill @param {string} ink
   */
  _doorNumberBadge(text, fill, ink) {
    const THREE = this._THREE;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.62),
      new THREE.MeshBasicMaterial({ map: this._doorNumberTexture(text, fill, ink), transparent: true }),
    );
    return mesh;
  }

  // ---- Picking (MC-6) ---------------------------------------------------------

  /**
   * Clic (no arrastre de órbita) → raycast en dos pasadas:
   *  1. Ciudades: emite `select-city` Y anima el zoom hasta la ciudad (el zoom
   *     lo hace este componente; el contenedor NO debe volver a animar).
   *  2. Plataformas de comarca: zoom a la comarca (sin evento de selección).
   * Agua/vacío: nada — no se deselecciona de forma agresiva.
   *
   * En modo primera persona (JG-3) el clic depende del modo del ratón: en el
   * modo LIBRE (default), un clic corto y quieto raycastea desde el CURSOR
   * (como en aérea) y un arrastre jamás abre nada; en el modo inmersivo (lock)
   * dispara lo que hay bajo la mira. Durante las transiciones de modo no hace
   * nada.
   */
  _onPick(event) {
    if (this._mode !== 'aerial') {
      this._pointerDownAt = null;
      if (this._mode !== 'fps') {
        this._endFpsDrag();
        return;
      }
      if (this._fpsLocked) {
        // 🎮 Inmersivo: el clic dispara lo que hay bajo la mira — un compañero
        // (MC-12, su mini-resumen), la ciudad cercana (tecla E), la cabaña del
        // brujo (MC-22) o la barca para zarpar (MC-14).
        const mateId = this._pickTeammateFromCenter();
        if (mateId) this._openTeammate(mateId);
        else if (this._nearCityId) this._openNearCity();
        else if (this._nearWizard) this._openWizard();
        else if (this._nearBoat) this._openArchipelago();
        return;
      }
      // Modo LIBRE (JG-3): solo interactúa el CLIC de verdad — corto
      // (< FPS_CLICK_MAX_MS) y quieto (< DRAG_THRESHOLD). Un arrastre de
      // mirada (moved) o un gesto largo terminan aquí sin abrir nada.
      const drag = this._fpsDrag;
      this._endFpsDrag();
      if (!drag || drag.moved) return;
      const total = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (total > DRAG_THRESHOLD || event.timeStamp - drag.t > FPS_CLICK_MAX_MS) return;
      this._pickOnFoot(event);
      return;
    }
    if (!this._pointerDownAt || !this._citiesGroup) return;
    const moved = Math.hypot(
      event.clientX - this._pointerDownAt.x,
      event.clientY - this._pointerDownAt.y,
    );
    this._pointerDownAt = null;
    if (moved > DRAG_THRESHOLD) return;

    const THREE = this._THREE;
    const rect = event.currentTarget.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this._camera);

    // Compañeros primero (MC-12): son pequeños y están pegados a las casas —
    // si el clic los toca, esa es la intención. Sin zoom: solo el mini-resumen.
    const mateId = CareerIsland3D._teammateFromHits(
      this._teammatesGroup ? raycaster.intersectObjects(this._teammatesGroup.children, true) : [],
    );
    if (mateId) {
      this._emitTeammate(mateId, event.clientX - rect.left, event.clientY - rect.top);
      return;
    }

    // Barca del muelle (MC-14): clicable como las casas — zarpar. Va antes que
    // las ciudades (nunca se solapan: la barca flota fuera de la costa).
    if (
      this._boatGroup &&
      raycaster.intersectObjects(this._boatGroup.children, true).length > 0
    ) {
      this._openArchipelago();
      return;
    }

    // La cabaña del brujo (MC-22): clicable como las casas — abre su panel.
    // Antes que las ciudades (wizardSpot ya garantiza que no se solapan).
    if (
      this._wizardGroup &&
      raycaster.intersectObjects(this._wizardGroup.children, true).length > 0
    ) {
      this._openWizard();
      return;
    }

    const hits = raycaster.intersectObjects(this._citiesGroup.children, true);
    for (const hit of hits) {
      let obj = hit.object;
      while (obj && !obj.userData.cityId) obj = obj.parent;
      if (obj?.userData.cityId) {
        this.focusCity(obj.userData.cityId);
        this.dispatchEvent(
          new CustomEvent('select-city', {
            detail: { cityId: obj.userData.cityId },
            bubbles: true,
            composed: true,
          }),
        );
        return;
      }
    }

    // Sin ciudad bajo el cursor: ¿plataforma de comarca? (raycast barato: solo
    // los parches circulares, sin descender por el grupo estático completo).
    const areaHit = raycaster.intersectObjects(this._areaPatches, false)[0];
    if (areaHit) this.focusArea(areaHit.object.userData.areaId);
  }

  /**
   * Interacción por CLIC en el modo a pie libre (JG-3): raycast desde la
   * posición del cursor (no desde la mira), con el MISMO orden de prioridad
   * que la vista aérea — compañeros (alcance corto, como la mira del modo
   * inmersivo), barca, cabaña del brujo y casas — pero disparando las acciones
   * del modo a pie (abrir tarjeta / zarpar, sin zoom de cámara). Agua/vacío:
   * nada.
   * @param {PointerEvent} event pointerup ya validado como clic corto y quieto.
   */
  _pickOnFoot(event) {
    if (!this._citiesGroup) return;
    const THREE = this._THREE;
    const canvas = this.renderRoot.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this._camera);

    // Compañeros primero (MC-12): pequeños y pegados a las casas — si el clic
    // los toca, esa es la intención. Mismo alcance corto que la mira (fps).
    raycaster.far = TEAMMATE.fpsPickRange;
    const mateId = CareerIsland3D._teammateFromHits(
      this._teammatesGroup ? raycaster.intersectObjects(this._teammatesGroup.children, true) : [],
    );
    if (mateId) {
      this._emitTeammate(mateId, event.clientX - rect.left, event.clientY - rect.top);
      return;
    }
    raycaster.far = Infinity;

    // Barca del muelle (MC-14): zarpar. Antes que las ciudades (no se solapan).
    if (
      this._boatGroup &&
      raycaster.intersectObjects(this._boatGroup.children, true).length > 0
    ) {
      this._openArchipelago();
      return;
    }

    // La cabaña del brujo (MC-22): abre su panel.
    if (
      this._wizardGroup &&
      raycaster.intersectObjects(this._wizardGroup.children, true).length > 0
    ) {
      this._openWizard();
      return;
    }

    // Casas: abrir la tarjeta de ciudadanía SIN mover la cámara (a pie el
    // jugador sigue donde está; nada de focusCity).
    const hits = raycaster.intersectObjects(this._citiesGroup.children, true);
    for (const hit of hits) {
      let obj = hit.object;
      while (obj && !obj.userData.cityId) obj = obj.parent;
      if (obj?.userData.cityId) {
        this._openCityPanel(obj.userData.cityId);
        return;
      }
    }
  }

  // ---- Limpieza ---------------------------------------------------------------

  /**
   * Libera geometrías, materiales y texturas de un subárbol de la escena.
   * Las texturas marcadas como compartidas (userData.shared: las placas de
   * puerta cacheadas) NO se liberan aquí: su ciclo de vida lo lleva la caché.
   */
  static _disposeSubtree(root) {
    root.traverse((obj) => {
      if (obj.isInstancedMesh) obj.dispose(); // libera los atributos de instancia
      obj.geometry?.dispose?.();
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      for (const m of mats) {
        if (m.map && m.map.userData?.shared !== true) m.map.dispose?.();
        m.dispose();
      }
    });
  }

  /** Detiene el bucle, desconecta observers y libera todos los recursos GPU. */
  _teardown() {
    this._stopLoop();
    // Celebración y audio (MC-11): confeti fuera de la escena y AudioContext
    // cerrado con todos sus nodos parados. IslandAudio queda reutilizable: si
    // el componente se re-monta, el siguiente gesto vuelve a desbloquearlo.
    this._endCelebration();
    this._pendingCelebration = null;
    this._audio.dispose();
    this._avatarStepCount = 0;
    this._fpsPhase = 0;
    this._fpsStepCount = 0;
    // El modo primera persona no sobrevive al teardown: se suelta el lock y se
    // desconectan los PointerLockControls (sus listeners de documento incluidos).
    if (this.renderRoot.pointerLockElement) document.exitPointerLock();
    this._plc?.dispose();
    this._plc = null;
    this._mode = 'aerial';
    this._fpsLocked = false;
    this._endFpsDrag();
    this._keys.clear();
    this._nearCityId = null;
    this._insideCityId = null;
    this._nearBoat = false;
    this._boatGroup = null;
    this._boatSpot = null;
    // La cabaña del brujo (MC-22) vive en la escena: se libera con ella.
    this._wizardGroup = null;
    this._wizardSpotW = null;
    this._nearWizard = false;
    this._wizardLantern = null;
    this._wizardSparkle = null;
    this._wizardSmoke = [];
    this._wizardLabels = [];
    this._abort?.abort();
    this._abort = null;
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    if (this._scene) CareerIsland3D._disposeSubtree(this._scene);
    this._clearPlateCache();
    this._clearEnvTextures();
    this._cityLabels = [];
    this._areaLabels = [];
    this._teammatesGroup = null;
    this._teammateFigures = [];
    this._teammateLabels = [];
    this._teammateSpots = [];
    // Minimapa (MC-13): los canvas 2D no tienen dispose; basta soltar las
    // referencias para que el GC los recoja. Sucio para el próximo montaje.
    this._beacons = [];
    this._minimapBase = null;
    this._minimapDirty = true;
    this._controls?.dispose();
    this._renderer?.dispose();
    this._scene = null;
    this._camera = null;
    this._controls = null;
    this._renderer = null;
    this._staticGroup = null;
    this._citiesGroup = null;
    this._lastMapId = null;
    this._camAnim = null;
    this._areaPatches = [];
    // El avatar y el ambiente viven en la escena (ya liberados con ella).
    this._avatar = null;
    this._sun = null;
    this._waterMesh = null;
    this._clouds = [];
    this._flags = [];
    this._areaSignSpots = new Map();
  }

  render() {
    // Cursor del modo a pie libre (JG-3): grab en reposo, grabbing arrastrando.
    const wrapClass = `wrap${this._mode === 'fps' && !this._fpsLocked ? ' fps-free' : ''}${
      this._fpsDragging ? ' dragging' : ''
    }`;
    return html`
      <div class=${wrapClass}>
        <canvas aria-label="Isla de carrera en 3D. Arrastra para orbitar, rueda para hacer zoom y haz clic en una casa para abrir su tarjeta. En la vista aérea tu avatar camina con WASD o las flechas (Shift corre) y la cámara lo sigue. En modo a pie el cursor queda libre: mantén pulsado el botón izquierdo y arrastra para mirar alrededor, y haz un clic corto sobre una casa para abrir su tarjeta. Con el teclado: flechas arriba/abajo o W/S para avanzar y retroceder, flechas izquierda/derecha para girar, A/D para desplazarte en lateral, Q/E o Re Pág/Av Pág para mirar arriba y abajo, Shift para correr y E para entrar en la casa cercana — todo el modo a pie se puede jugar solo con el teclado. El botón «🎮 Inmersivo» captura el ratón para mirar moviéndolo sin arrastrar; Escape lo suelta y vuelve al cursor libre. Chocar de frente contra una casa te hace entrar en ella; con su tarjeta abierta, flecha abajo o S salen de nuevo a la isla. Los compañeros del equipo aparecen como avatares junto a su casa actual: haz clic sobre uno para ver su mini-resumen. La barca del muelle abre el mapa del archipiélago para viajar a otra isla (clic, o E al acercarte a pie). La cabaña del brujo, la torre púrpura cerca del puerto, recoge tus consultas para tu manager: clic sobre ella, o E al acercarte a pie; su farol indica si hay consultas pendientes (ámbar) o una respuesta lista (turquesa)."></canvas>
        ${this._mode === 'fps' && this._fpsLocked
          ? html`<div class="crosshair" aria-hidden="true"></div>`
          : null}
        ${this._mode === 'fps'
          ? html`<canvas class="minimap" aria-hidden="true"></canvas>`
          : null}
        ${this._mode === 'fps'
          ? html`<div class="guide" hidden aria-hidden="true">
              <span class="guide-arrow">▲</span>
              <span class="guide-label"><span class="gname"></span><span class="dist"></span></span>
            </div>`
          : null}
        ${this._renderFpsHint()}
        ${this._renderAerialHint()}
        ${this._phase === 'loading' ? html`<div class="overlay">Cargando isla 3D…</div>` : null}
        ${this._phase === 'unsupported'
          ? html`<div class="overlay">Tu navegador no soporta WebGL. Usa la vista plana.</div>`
          : null}
        ${this._phase === 'error'
          ? html`<div class="overlay error">No se pudo cargar el motor 3D. Recarga la página o usa la vista plana.</div>`
          : null}
      </div>
    `;
  }
}

if (!customElements.get('career-island-3d')) {
  customElements.define('career-island-3d', CareerIsland3D);
}
