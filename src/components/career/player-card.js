/**
 * <player-card>
 * Ficha de CIUDADANÍA del jugador (MC-21) con arte de PASAPORTE DE PIRATA
 * (JG-10): presentacional y compartida — la usan el overlay «🏅 Ficha» del
 * juego (career-app) y el bloque «Mi ficha de ciudadanía» de mi-espacio
 * (engineer-space). Solo pinta LOGROS (nunca la ruta ni el detalle de visitas,
 * por ADR). El papel es PROPIO (tokens --pc-* que leen los --parch-* de JG-7
 * cuando existen y caen a los mismos valores cuando no): el pasaporte se
 * auto-contiene visualmente sea cual sea el fondo del host.
 *
 *  - Portada: «Pasaporte del Archipiélago», nombre del jugador en tinta
 *    caligráfica, los badges como MEDALLAS con relieve y cinta
 *    (⭐ Super-ciudadano / 👑 Leyenda con su fecha) y los totales como fila
 *    de sellos pequeños (ciudadanías, islas pisadas, certificados, avalados).
 *  - Páginas de sellos (una tarjeta-visado por isla, orden del índice): sello
 *    de ciudadanía ESTAMPADO con su fecha (SVG inline con tinta irregular y
 *    rotación determinista ±8° por hashId del islandId), cuerda de progreso
 *    con el nudo del objetivo y certificados X/Y como cuentas. Sin ciudadanía
 *    queda el hueco punteado del tampón («—»); las islas sin pisar van
 *    atenuadas y marcadas «Por descubrir».
 *  - «Consultas al brujo» (MC-22): las Q&A del jugador en TODAS las islas —
 *    isla, fecha, estado, texto y la respuesta con su crédito («respondida por
 *    {answeredBy/creditedTo}»). Solo lectura: preguntar y marcar como vista se
 *    hace en el panel del brujo del juego.
 *
 * Todo llega derivado/cargado por el contenedor: `progress` sale de
 * archipelagoProgress (MC-20) y `achievements` del doc de logros (MC-21). Un
 * logro cumplido SIN registro (pre-MC-21) se muestra con «(fecha no
 * registrada)»; un logro REGISTRADO se muestra aunque el progreso actual haya
 * bajado del umbral (retirar certificados no borra la historia).
 *
 * Propiedades:
 *  - playerName: string                       nombre a pintar en la cabecera
 *  - progress: ArchipelagoProgress|null       progresión derivada del journey
 *  - achievements: Achievements|null          logros registrados (fechas)
 *  - endorsements: Endorsements|null          avales del manager (JG-6): el contador «N avalados ✓»
 *  - visitedIslands: string[]                 ids de islas pisadas (journey)
 *  - questions: WizardQuestion[]              consultas al brujo (MC-22, ya ordenadas)
 *
 * La ficha lista islas (no certificados individuales, por ADR): del aval solo
 * cabe el CONTADOR en los totales — el sello casa a casa vive en la tarjeta
 * de cada casa del juego.
 *
 * @typedef {import('../../tools/career/domain/citizenship.js').ArchipelagoProgress} ArchipelagoProgress
 * @typedef {import('../../tools/career/domain/achievements.js').Achievements} Achievements
 * @typedef {import('../../tools/career/domain/endorsements.js').Endorsements} Endorsements
 * @typedef {import('../../tools/career/domain/wizard.js').WizardQuestion} WizardQuestion
 */
import { LitElement, html, css, svg } from 'lit';
import { formatAchievedAt } from '../../tools/career/domain/achievements.js';
import { endorsedCount } from '../../tools/career/domain/endorsements.js';
import { hashId } from '../../tools/career/domain/islandLayout.js';
import { sortQuestionsByDateDesc } from '../../tools/career/domain/wizard.js';

/** Etiquetas de estado de una consulta al brujo (MC-22). */
const QUESTION_BADGES = Object.freeze({
  pending: 'Esperando al brujo',
  answered: 'Respuesta lista',
  seen: 'Vista',
});

/** Formato de fechas de las consultas (misma localización que los logros). */
const questionDateFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' });

/** Fecha legible de una consulta, o '—' si no la trae. @param {string} iso */
function formatQuestionDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : questionDateFmt.format(d);
}

/** Metadatos de los badges de la cabecera (MC-20/21). */
const BADGES = Object.freeze([
  { id: /** @type {const} */ ('superCitizen'), icon: '⭐', label: 'Super-ciudadano' },
  { id: /** @type {const} */ ('legend'), icon: '👑', label: 'Leyenda del archipiélago' },
]);

/** Fecha corta para la tinta del sello estampado («05 jul 2026»). */
const stampDateFmt = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * Fecha corta del centro del sello, o null si el registro no la trae
 * (logros pre-MC-21): el sello estampa estrellas en su lugar.
 * @param {string|null|undefined} iso
 * @returns {string|null}
 */
function stampDate(iso) {
  if (typeof iso !== 'string' || iso.trim() === '') return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : stampDateFmt.format(d);
}

/**
 * Rotación determinista del sello de una isla: ±8° a partir del hash del id
 * (misma fuente de variación aparente que la escena 3D — nada de
 * Math.random(): el mismo id estampa siempre con el mismo giro).
 * @param {string} islandId
 * @returns {number} Grados en [-8, 8].
 */
function stampRotation(islandId) {
  return ((hashId(islandId) >>> 3) % 17) - 8;
}

/**
 * Sello de ciudadanía ESTAMPADO (JG-10): tampón circular de tinta con
 * «CIUDADANÍA» en arco, la fecha en el centro y estrellas al pie. La tinta
 * irregular sale de feTurbulence + feDisplacementMap (semilla determinista
 * por isla); los ids de filtro/arco llevan sufijo por isla para no colisionar
 * dentro del mismo shadow root. Decorativo (aria-hidden): el texto real para
 * AT lo pone el caller en un span solo-lectores.
 * @param {string} islandId
 * @param {string|null} dateLabel Fecha corta, o null (pre-MC-21: estrellas).
 * @returns {import('lit').TemplateResult}
 */
function citizenshipStamp(islandId, dateLabel) {
  const uid = hashId(islandId).toString(36);
  const seed = hashId(islandId) % 97;
  return svg`<svg class="ink" viewBox="0 0 120 120" aria-hidden="true">
    <defs>
      <filter id="r${uid}" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed}" result="grain"></feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="grain" scale="2.8"></feDisplacementMap>
      </filter>
      <path id="a${uid}" d="M 21 63 A 39 39 0 1 1 99 63" fill="none"></path>
    </defs>
    <g filter="url(#r${uid})">
      <circle cx="60" cy="60" r="55" fill="none" stroke="currentColor" stroke-width="3.6"></circle>
      <circle cx="60" cy="60" r="45" fill="none" stroke="currentColor" stroke-width="1.4"></circle>
      <text class="arc" text-anchor="middle"><textPath href="#a${uid}" startOffset="50%">CIUDADANÍA</textPath></text>
      <text class="cdate" x="60" y="65" text-anchor="middle">${dateLabel ?? '★ ★ ★'}</text>
      <text class="cstars" x="60" y="93" text-anchor="middle">★ ★ ★</text>
    </g>
  </svg>`;
}

export class PlayerCard extends LitElement {
  static properties = {
    playerName: { attribute: false },
    progress: { attribute: false },
    achievements: { attribute: false },
    endorsements: { attribute: false },
    visitedIslands: { attribute: false },
    questions: { attribute: false },
    carpools: { attribute: false },
    coins: { attribute: false },
  };

  static styles = css`
    /* ═══ PASAPORTE DE PIRATA (JG-10): papel propio + tokens locales. Los
       --pc-* leen los --parch-* del juego (JG-7) cuando el host los hereda y
       caen a los MISMOS valores cuando no (mi-espacio, fondo claro): el
       pasaporte trae su papel, su tinta y sus sellos a cualquier fondo. Sin
       animaciones ni transiciones: es un documento impreso — reduced-motion
       de serie, nada esencial se mueve. ═══ */
    :host {
      /* Papel y tintas del documento. */
      --pc-paper: var(--parch-bg, #f3e6c8);
      --pc-paper-2: var(--parch-bg-2, #ead6a8);
      --pc-ink: var(--parch-ink, #33240f);
      --pc-muted: var(--parch-muted, #6b5433);
      --pc-edge: var(--parch-edge, #b98f56);
      --pc-title: var(--parch-title, Georgia, 'Palatino Linotype', 'Book Antiqua', 'Times New Roman', serif);
      /* Tinta de tampón (verdigris oscuro: AA sobre el papel), lacre del
         brujo y oro de medallas y monedas. */
      --pc-stamp: #175f54;
      --pc-wax: #6742d6;
      display: block;
      box-sizing: border-box;
      padding: clamp(0.85rem, 2.5vw, 1.4rem);
      font-family: var(--rm-font, system-ui, sans-serif);
      color: var(--pc-ink);
      background:
        radial-gradient(ellipse at 10% 6%, rgba(122, 90, 51, 0.12), transparent 40%),
        radial-gradient(ellipse at 92% 94%, rgba(122, 90, 51, 0.14), transparent 38%),
        linear-gradient(165deg, #f8efd7 0%, var(--pc-paper) 52%, var(--pc-paper-2) 100%);
      border: 1px solid var(--pc-edge);
      /* Pliego de esquinas irregulares, familia del arte JG-7. */
      border-radius: 14px 9px 16px 8px / 10px 15px 8px 13px;
      box-shadow: inset 0 0 16px rgba(92, 58, 20, 0.2), 0 6px 20px rgba(17, 24, 39, 0.16);
    }
    /* Página interior con doble filete, como la primera página del pasaporte. */
    .page {
      border: 3px double color-mix(in srgb, var(--pc-edge) 80%, transparent);
      border-radius: 10px 6px 12px 7px / 8px 11px 6px 10px;
      padding: clamp(0.7rem, 2vw, 1.1rem);
    }
    /* Solo lectores de pantalla (la tinta del sello es SVG decorativo). */
    .sr {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    /* ── PORTADA: título del documento, nombre en tinta caligráfica con
       rúbrica, medallas con cinta y la fila de sellos de totales. ── */
    .cover { text-align: center; padding-bottom: 1rem; }
    .ptitle {
      display: flex; align-items: center; gap: 0.6rem;
      margin: 0 0 0.4rem;
      font-family: var(--pc-title);
      font-variant: small-caps;
      letter-spacing: 0.16em;
      font-size: 0.85rem; font-weight: 700;
      color: var(--pc-muted);
    }
    .ptitle::before { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, transparent, var(--pc-edge)); }
    .ptitle::after { content: ''; flex: 1; height: 1px; background: linear-gradient(270deg, transparent, var(--pc-edge)); }
    .pname {
      margin: 0;
      font-family: 'Segoe Script', 'Lucida Handwriting', 'Apple Chancery', 'URW Chancery L', cursive, var(--pc-title);
      font-style: italic;
      font-weight: 600;
      font-size: clamp(1.5rem, 4.5vw, 1.9rem);
      line-height: 1.15;
      color: var(--pc-ink);
      text-shadow: 0 1px 0 rgba(255, 250, 232, 0.5);
    }
    /* Rúbrica bajo la firma (decorativa). */
    .flourish { display: block; width: min(170px, 60%); height: auto; margin: 0.1rem auto 0; color: var(--pc-ink); opacity: 0.8; }
    /* Medallas con relieve: cinta plegada + disco acuñado (radial + sombras
       internas); la etiqueta y la fecha son texto real bajo la pieza. */
    .medals { display: flex; gap: 0.8rem 1.7rem; flex-wrap: wrap; justify-content: center; margin: 1rem 0 0; }
    .medal { display: grid; justify-items: center; gap: 0.35rem; max-width: 11rem; }
    .medal .hang { position: relative; width: 66px; height: 82px; }
    .medal .band {
      position: absolute; top: 0; left: 50%; translate: -50% 0;
      width: 30px; height: 36px;
      background: linear-gradient(90deg, #14483f 0 7px, #2a9d8f 7px 23px, #14483f 23px 30px);
      clip-path: polygon(16% 0, 84% 0, 100% 100%, 50% 80%, 0 100%);
      box-shadow: 0 1px 2px rgba(40, 25, 5, 0.35);
    }
    .medal.legend .band { background: linear-gradient(90deg, #3d2a85 0 7px, #7f5af0 7px 23px, #3d2a85 23px 30px); }
    .medal .disc {
      position: absolute; bottom: 0; left: 50%; translate: -50% 0;
      width: 58px; height: 58px; border-radius: 50%;
      display: grid; place-items: center;
      font-size: 1.5rem;
      background: radial-gradient(circle at 32% 28%, #ffedb0 0%, #ecc959 38%, #d3a52e 68%, #96700d 100%);
      box-shadow:
        inset 0 2px 3px rgba(255, 255, 255, 0.65),
        inset 0 -4px 7px rgba(90, 60, 0, 0.5),
        inset 0 0 0 3px rgba(122, 90, 20, 0.4),
        0 3px 7px rgba(40, 25, 5, 0.35);
    }
    .medal.legend .disc {
      background: radial-gradient(circle at 32% 28%, #f3ecff 0%, #c9b2ff 38%, #8f6df0 70%, #4b2f9d 100%);
      box-shadow:
        inset 0 2px 3px rgba(255, 255, 255, 0.6),
        inset 0 -4px 7px rgba(35, 15, 95, 0.55),
        inset 0 0 0 3px rgba(70, 45, 150, 0.45),
        0 3px 7px rgba(40, 25, 5, 0.35);
    }
    .medal .icon { text-shadow: 0 1px 0 rgba(255, 244, 200, 0.8), 0 -1px 1px rgba(90, 60, 0, 0.45); }
    .medal .mlabel {
      font-family: var(--pc-title); font-variant: small-caps;
      font-weight: 700; font-size: 0.88rem; line-height: 1.2;
      color: var(--pc-ink);
    }
    .medal .when { display: block; font-variant: normal; font-size: 0.7rem; font-weight: 600; color: var(--pc-muted); }
    .nobadges { margin: 0.8rem 0 0; font-family: var(--pc-title); font-style: italic; font-size: 0.85rem; color: var(--pc-muted); }
    /* Totales como fila de sellos pequeños: doble filete de tinta con giro
       leve alterno (determinista: paridad de la posición). */
    .totals { display: flex; gap: 0.65rem 0.8rem; flex-wrap: wrap; justify-content: center; margin: 1rem 0 0; padding: 0.15rem 0 0; list-style: none; }
    .totals li {
      padding: 0.28rem 0.6rem;
      border: 1px solid currentColor;
      outline: 1px solid currentColor;
      outline-offset: 2px;
      color: var(--pc-stamp);
      font-family: var(--pc-title); font-variant: small-caps;
      font-size: 0.82rem; font-weight: 700;
      font-variant-numeric: tabular-nums;
      mix-blend-mode: multiply;
    }
    .totals li:nth-child(odd) { transform: rotate(-1.6deg); }
    .totals li:nth-child(even) { transform: rotate(1.2deg); }
    /* Certificados avalados por el manager (JG-6): tinta dorada, familia del sello. */
    .totals li.endorsed { color: #8a6400; }
    .totals li.endorsed .tick { font-weight: 900; }
    /* Títulos de sección: serif small-caps con filete a la derecha. */
    .sub {
      display: flex; align-items: center; gap: 0.55rem;
      margin: 1.5rem 0 0.7rem;
      font-family: var(--pc-title); font-variant: small-caps;
      letter-spacing: 0.1em; font-size: 0.98rem; font-weight: 700;
      color: var(--pc-ink);
    }
    /* Rombo decorativo con texto alternativo vacío: no llega a los lectores. */
    .sub::before { content: '◆' / ''; font-size: 0.55em; color: var(--pc-muted); }
    .sub::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, var(--pc-edge), transparent); }
    /* ── PÁGINAS DE SELLOS: un visado por isla (sustituye a la tabla). ── */
    .visas {
      list-style: none; margin: 0; padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(215px, 1fr));
      gap: 0.7rem;
    }
    .visa {
      display: flex; flex-direction: column; gap: 0.5rem;
      padding: 0.65rem 0.75rem 0.7rem;
      background: color-mix(in srgb, var(--pc-paper) 58%, #fffaf0);
      border: 1px solid var(--pc-edge);
      border-radius: 10px 6px 11px 7px / 7px 10px 6px 9px;
      box-shadow: inset 0 0 10px rgba(92, 58, 20, 0.12);
    }
    .visa .vname {
      font-family: var(--pc-title); font-variant: small-caps;
      font-weight: 700; letter-spacing: 0.05em;
      text-align: center; font-size: 0.98rem;
      color: var(--pc-ink);
    }
    /* Isla sin pisar: silueta atenuada, «Por descubrir» en el hueco del
       tampón (el objetivo sigue legible a la vista). */
    .visa.unvisited { opacity: 0.55; }
    .visa.unvisited .vname { color: var(--pc-muted); }
    /* Hueco del tampón: sello estampado, o el círculo punteado en espera. */
    .vstamp { display: grid; place-items: center; min-height: 98px; }
    .stamp { position: relative; width: 94px; height: 94px; color: var(--pc-stamp); transform: rotate(var(--rot, -4deg)); }
    .stamp .ink { width: 100%; height: 100%; mix-blend-mode: multiply; opacity: 0.85; }
    .ink text { fill: currentColor; font-family: var(--pc-title); font-weight: 700; }
    .ink .arc { font-size: 14.5px; letter-spacing: 2.5px; }
    .ink .cdate { font-size: 12.5px; letter-spacing: 0.5px; }
    .ink .cstars { font-size: 10px; }
    .pend {
      width: 84px; height: 84px; border-radius: 50%;
      border: 2px dashed color-mix(in srgb, var(--pc-muted) 55%, transparent);
      display: grid; place-items: center;
      padding: 0.35rem; box-sizing: border-box;
      font-family: var(--pc-title); font-style: italic;
      font-size: 0.78rem; text-align: center; line-height: 1.2;
      color: var(--pc-muted);
    }
    /* Cuerda de progreso: regla de lápiz con marcas cada 10 %, trenza de
       cáñamo como avance y el NUDO del objetivo. */
    .rope {
      position: relative; height: 10px; border-radius: 6px;
      background:
        repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), rgba(107, 84, 51, 0.4) calc(10% - 1px) 10%),
        linear-gradient(180deg, #ecdcb2 0%, #e2cf9d 100%);
      box-shadow: inset 0 1px 2px rgba(70, 42, 12, 0.3);
    }
    .rope .fill {
      display: block; height: 100%; max-width: 100%;
      background: repeating-linear-gradient(-55deg, #a67c44 0 4px, #85602f 4px 8px);
      border-radius: 6px;
      box-shadow: 0 1px 1px rgba(70, 42, 12, 0.35);
    }
    .rope .goal {
      position: absolute; top: 50%; width: 9px; height: 9px;
      translate: -50% -50%;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #6d4a20, #3a2712 75%);
      box-shadow: 0 0 0 2px rgba(246, 238, 214, 0.55), 0 1px 2px rgba(40, 25, 5, 0.4);
    }
    .visa .vcerts { text-align: center; font-size: 0.78rem; color: var(--pc-muted); font-variant-numeric: tabular-nums; }
    .empty { margin: 0.4rem 0 0; font-family: var(--pc-title); font-style: italic; font-size: 0.87rem; color: var(--pc-muted); }
    /* Carpools del jugador (CP-1): líneas de bitácora con la misma cuerda. */
    .cps { list-style: none; margin: 0; padding: 0; }
    .cp {
      display: grid;
      grid-template-columns: minmax(120px, 1.2fr) auto minmax(90px, 1fr) auto;
      gap: 0.35rem 0.75rem;
      align-items: center;
      padding: 0.5rem 0;
      border-top: 1px dotted var(--pc-edge);
      font-size: 0.85rem;
    }
    .cp .name { font-family: var(--pc-title); font-weight: 700; color: var(--pc-ink); }
    .cp .certs { color: var(--pc-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .cpstatus {
      font-size: 0.66rem; font-weight: 800; padding: 0.14rem 0.5rem;
      border-radius: 3px 6px 4px 6px / 6px 3px 6px 4px;
      white-space: nowrap; text-transform: uppercase; letter-spacing: 0.03em;
    }
    .cpstatus.open { background: var(--pc-stamp); color: #f6eed6; }
    .cpstatus.full { background: var(--wood-2, #55391c); color: var(--wood-text, #f6e8c9); }
    .cpstatus.completed { background: linear-gradient(135deg, #f6d365 0%, #e8b931 100%); color: #5b4300; }
    .cpstatus.closed { background: transparent; border: 1px solid var(--pc-muted); color: var(--pc-muted); }
    @media (max-width: 560px) {
      .cp { grid-template-columns: 1fr auto; }
      .cp .rope { grid-column: 1 / -1; }
    }
    /* ── TRIBBU-COINS (CP-2): moneda dorada acuñada (radial + canto de
       repeating-conic) y las transacciones como libro de cuentas. ── */
    .coinsbar { display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap; margin: 0.2rem 0 0.2rem; }
    .bigcoin {
      position: relative; width: 58px; height: 58px; border-radius: 50%;
      display: grid; place-items: center; flex: 0 0 auto;
      background: radial-gradient(circle at 32% 28%, #ffedb0 0%, #ecc959 38%, #cf9d28 70%, #966d0e 100%);
      box-shadow:
        inset 0 2px 3px rgba(255, 255, 255, 0.65),
        inset 0 -4px 7px rgba(90, 60, 0, 0.5),
        0 2px 6px rgba(40, 25, 5, 0.35);
    }
    /* Canto acuñado: anillo de muescas radiales enmascarado al borde. */
    .bigcoin::before {
      content: ''; position: absolute; inset: 1px; border-radius: 50%;
      background: repeating-conic-gradient(rgba(112, 78, 8, 0.5) 0deg 3deg, rgba(255, 236, 170, 0.4) 3deg 6deg);
      -webkit-mask: radial-gradient(circle, transparent 0 60%, #000 62%);
      mask: radial-gradient(circle, transparent 0 60%, #000 62%);
    }
    .bigcoin .face {
      font-family: var(--pc-title); font-weight: 800; font-size: 1.55rem;
      color: #6d4c08;
      text-shadow: 0 1px 0 rgba(255, 242, 195, 0.85), 0 -1px 1px rgba(80, 55, 5, 0.4);
    }
    .coinsbal { font-family: var(--pc-title); font-size: 1.45rem; font-weight: 800; color: var(--pc-ink); font-variant-numeric: tabular-nums; }
    .coinsbal .unit { font-size: 0.8rem; font-weight: 700; font-variant: small-caps; letter-spacing: 0.05em; color: var(--pc-muted); }
    .coinshint { margin: 0 0 0.4rem; font-size: 0.72rem; font-style: italic; color: var(--pc-muted); }
    .coinstx { list-style: none; margin: 0; padding: 0; }
    .coinstx li {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 0.35rem 0.75rem;
      align-items: baseline;
      padding: 0.4rem 0;
      border-top: 1px dotted var(--pc-edge);
      font-size: 0.83rem;
    }
    .coinstx .what { color: var(--pc-ink); }
    .coinstx .when { font-size: 0.72rem; font-style: italic; color: var(--pc-muted); white-space: nowrap; }
    .coinstx .delta { font-weight: 800; color: var(--pc-stamp); font-variant-numeric: tabular-nums; white-space: nowrap; }
    /* ── CONSULTAS AL BRUJO (MC-22): notas clavadas al tablón, con lacre
       violeta cuando hay respuesta. ── */
    .wizqs { list-style: none; margin: 0; padding: 0.35rem 0 0; display: flex; flex-direction: column; gap: 0.85rem; }
    .wizq {
      position: relative;
      padding: 0.85rem 0.8rem 0.6rem;
      background: color-mix(in srgb, var(--pc-paper) 52%, #fffdf4);
      border: 1px solid color-mix(in srgb, var(--pc-edge) 75%, transparent);
      border-radius: 3px 8px 4px 9px / 8px 3px 9px 4px;
      box-shadow: 0 2px 5px rgba(40, 25, 5, 0.18);
    }
    .wizq:nth-child(odd) { transform: rotate(-0.5deg); }
    .wizq:nth-child(even) { transform: rotate(0.45deg); }
    /* El clavo que sujeta la nota. */
    .wizq::before {
      content: ''; position: absolute; top: -5px; left: 50%; translate: -50% 0;
      width: 11px; height: 11px; border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #8d8d94, #4a4a52 60%, #2c2c33 100%);
      box-shadow: 0 1px 2px rgba(20, 10, 2, 0.55);
    }
    /* Lacre violeta del brujo: solo cuando la consulta tiene respuesta. */
    .wax {
      position: absolute; top: -9px; right: -7px;
      width: 30px; height: 30px;
      border-radius: 46% 54% 50% 50% / 52% 48% 55% 45%;
      background: radial-gradient(circle at 34% 30%, #a98df5, #7f5af0 55%, #4e2fae 100%);
      box-shadow:
        inset 0 2px 3px rgba(255, 255, 255, 0.35),
        inset 0 -3px 5px rgba(38, 15, 105, 0.55),
        0 2px 4px rgba(40, 25, 5, 0.35);
      display: grid; place-items: center;
      color: #efe9ff; font-size: 0.85rem; font-weight: 900;
    }
    .wmeta { display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; }
    .wisle { font-family: var(--pc-title); font-size: 0.8rem; font-weight: 700; color: var(--pc-ink); }
    .wmeta .when { font-size: 0.72rem; font-style: italic; color: var(--pc-muted); }
    .wstatus {
      font-size: 0.66rem; font-weight: 800; padding: 0.14rem 0.5rem;
      border-radius: 3px 6px 4px 6px / 6px 3px 6px 4px;
      white-space: nowrap; text-transform: uppercase; letter-spacing: 0.03em;
    }
    .wstatus.pending { background: #f3dfae; color: #6b4a00; }
    .wstatus.answered { background: var(--pc-wax); color: #f4efff; }
    .wstatus.seen { background: transparent; border: 1px solid var(--pc-muted); color: var(--pc-muted); }
    .wtext { margin: 0.35rem 0 0; font-size: 0.83rem; color: var(--pc-ink); white-space: pre-wrap; }
    .wizanswer {
      margin-top: 0.5rem;
      border-left: 3px solid var(--pc-wax);
      background: color-mix(in srgb, var(--pc-wax) 8%, transparent);
      border-radius: 0 8px 8px 0;
      padding: 0.4rem 0.6rem;
    }
    .wizanswer .wtext { margin: 0; }
    .wby { margin: 0.3rem 0 0; font-size: 0.72rem; font-style: italic; color: var(--pc-muted); }
  `;

  constructor() {
    super();
    this.playerName = '';
    /** @type {ArchipelagoProgress|null} */
    this.progress = null;
    /** @type {Achievements|null} */
    this.achievements = null;
    /**
     * Avales del manager (JG-6): alimenta el contador «N avalados ✓» de los
     * totales. null = el contenedor no los aporta y el contador no se pinta.
     * @type {Endorsements|null}
     */
    this.endorsements = null;
    /** @type {string[]} */
    this.visitedIslands = [];
    /** @type {WizardQuestion[]} */
    this.questions = [];
    /**
     * Carpools del jugador con su avance (CP-1), derivados por el contenedor
     * (career-app: sus carpools + su propio journey — sin lecturas extra).
     * null = el contenedor no los aporta (p. ej. mi-espacio): la sección no
     * se pinta. [] = aporta y no participa en ninguno.
     * @type {{ id: string, name: string, status: string, completed: number, total: number, pct: number }[]|null}
     */
    this.carpools = null;
    /**
     * Tribbu-coins del jugador (CP-2), derivados por el contenedor del ledger
     * verificable: saldo materializado y las últimas transacciones legibles
     * (razón + delta + fecha ISO). null = el contenedor no los aporta (p. ej.
     * mi-espacio): la sección no se pinta.
     * @type {{ balance: number, recent: { label: string, delta: number, ts: string }[] }|null}
     */
    this.coins = null;
  }

  /**
   * Etiqueta de la fecha de un registro: la fecha larga, o «fecha no
   * registrada» para logros pre-MC-21 (registro con achievedAt null o logro
   * cumplido aún sin registro).
   * @param {import('../../tools/career/domain/achievements.js').AchievementRecord|undefined} record
   * @returns {string}
   */
  _whenLabel(record) {
    return formatAchievedAt(record?.achievedAt) ?? '(fecha no registrada)';
  }

  /**
   * Badges de la portada como MEDALLAS con relieve (los logrados, por registro
   * o progreso actual): cinta plegada + disco acuñado; etiqueta y fecha son
   * texto real bajo la pieza (la pieza es decorativa).
   */
  _renderBadges() {
    const badges = this.achievements?.badges ?? {};
    const earned = BADGES.filter(
      (b) =>
        b.id in badges ||
        (b.id === 'superCitizen' ? this.progress?.superCitizen === true : this.progress?.legend === true),
    );
    if (earned.length === 0) {
      return html`<p class="nobadges">Sin badges todavía: consigue 3 ciudadanías (con Bases de software) para ser ⭐ Super-ciudadano.</p>`;
    }
    return html`<div class="medals">
      ${earned.map(
        (b) => html`<span class="medal ${b.id === 'legend' ? 'legend' : ''}">
          <span class="hang" aria-hidden="true">
            <span class="band"></span>
            <span class="disc"><span class="icon">${b.icon}</span></span>
          </span>
          <span class="mlabel">${b.label}
            <span class="when">${this._whenLabel(badges[b.id])}</span>
          </span>
        </span>`,
      )}
    </div>`;
  }

  /**
   * Tarjeta-visado de una isla (página de sellos): nombre en small-caps, el
   * sello de ciudadanía estampado (o el hueco punteado del tampón), la cuerda
   * de progreso con el nudo del objetivo y los certificados X/Y como cuentas.
   */
  _renderIsle(isle) {
    const record = this.achievements?.citizenships?.[isle.id];
    // La ciudadanía registrada es historia: se muestra aunque el progreso
    // actual haya bajado del umbral (retirar certificados no la borra).
    const hasCitizenship = isle.achieved || record !== undefined;
    const visited = (this.visitedIslands ?? []).includes(isle.id);
    return html`<li class="visa ${visited ? '' : 'unvisited'}">
      <span class="vname">${isle.name}</span>
      <span class="vstamp">
        ${hasCitizenship
          ? html`<span class="stamp" style=${`--rot:${stampRotation(isle.id)}deg`}>
              ${citizenshipStamp(isle.id, stampDate(record?.achievedAt))}
              <span class="sr">Ciudadanía: ${this._whenLabel(record)}</span>
            </span>`
          : visited
            ? html`<span class="pend" aria-label="Sin ciudadanía todavía">—</span>`
            : html`<span class="pend">Por descubrir</span>`}
      </span>
      <span
        class="rope"
        role="progressbar"
        aria-valuenow=${isle.pct}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label=${`Certificados de ${isle.name}: ${isle.certificates} de ${isle.total} (${isle.pct}%, objetivo ${isle.targetPct}%)`}
      >
        <span class="fill" style=${`width:${isle.pct}%`}></span>
        <span class="goal" style=${`left:${isle.targetPct}%`}></span>
      </span>
      <span class="vcerts">${isle.certificates}/${isle.total} certificados</span>
    </li>`;
  }

  render() {
    const prog = this.progress;
    if (!prog || prog.islands.length === 0) {
      return html`<p class="empty">Aún no hay progreso que mostrar en el archipiélago.</p>`;
    }
    const certificates = prog.islands.reduce((sum, i) => sum + i.certificates, 0);
    return html`
      <div class="page">
        <header class="cover">
          <p class="ptitle">Pasaporte del Archipiélago</p>
          <h4 class="pname">${this.playerName}</h4>
          <svg class="flourish" viewBox="0 0 160 14" aria-hidden="true">
            <path
              d="M4 8 C 40 2, 60 13, 80 8 S 130 2, 156 7"
              fill="none"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
            ></path>
          </svg>
          ${this._renderBadges()}
          <ul class="totals" aria-label="Totales del archipiélago">
            <li title="Ciudadanías de isla conseguidas">🛂 ${prog.citizenships} ciudadanía${prog.citizenships === 1 ? '' : 's'}</li>
            <li title="Islas del archipiélago pisadas">🏝️ ${prog.islandsVisited}/${prog.islands.length} islas</li>
            <li title="Certificados conseguidos en total">📜 ${certificates} certificado${certificates === 1 ? '' : 's'}</li>
            ${this._renderEndorsedTotal()}
          </ul>
        </header>
        <p class="sub">Páginas de sellos · por isla</p>
        <ul class="visas">
          ${prog.islands.map((isle) => this._renderIsle(isle))}
        </ul>
        ${this._renderCoins()}
        ${this._renderCarpools()}
        <p class="sub">Consultas al brujo</p>
        ${this._renderQuestions()}
      </div>
    `;
  }

  /**
   * Contador «N avalados ✓» de los totales (JG-6): certificados con el sello
   * del manager. Solo se pinta si el contenedor aporta los avales (null = la
   * sección de totales queda como estaba). La ficha lista islas, no
   * certificados individuales: el sello casa a casa vive en la tarjeta de
   * cada casa del juego.
   */
  _renderEndorsedTotal() {
    if (this.endorsements === null) return null;
    const n = endorsedCount(this.endorsements);
    return html`<li class="endorsed" title="Certificados avalados por el manager">
      <span class="tick" aria-hidden="true">✓</span> ${n} avalado${n === 1 ? '' : 's'}
    </li>`;
  }

  /**
   * Sección «Tribbu-coins» (CP-2): saldo del libro mayor y las últimas
   * transacciones legibles (razón + delta + fecha). Solo se pinta si el
   * contenedor la aporta (career-app la deriva del ledger verificable; en
   * mi-espacio no llega y la sección desaparece entera).
   */
  _renderCoins() {
    if (this.coins === null) return null;
    return html`
      <p class="sub">Tribbu-coins</p>
      <div class="coinsbar">
        <span class="bigcoin" aria-hidden="true"><span class="face">₮</span></span>
        <span class="coinsbal" title="Saldo de tribbu-coins según el libro mayor"
          >${this.coins.balance} <span class="unit">tribbu-coins</span></span
        >
      </div>
      <p class="coinshint">emitidos solo por contratos: libro mayor firmado y auditable</p>
      ${this.coins.recent.length === 0
        ? html`<p class="empty">Aún no hay transacciones: consigue certificados para ganar tribbu-coins.</p>`
        : html`<ul class="coinstx" aria-label="Últimas transacciones de tribbu-coins">
            ${this.coins.recent.map(
              (tx) => html`<li>
                <span class="what">${tx.label}</span>
                <span class="when">${formatQuestionDate(tx.ts)}</span>
                <span class="delta">+${tx.delta} 🪙</span>
              </li>`,
            )}
          </ul>`}
    `;
  }

  /**
   * Sección «Carpools» (CP-1): los grupos del jugador con su avance personal
   * (paradas X/Y y %). Solo se pinta si el contenedor aporta la lista (en
   * mi-espacio no llega y la sección desaparece entera).
   */
  _renderCarpools() {
    if (this.carpools === null) return null;
    return html`
      <p class="sub">Carpools</p>
      ${this.carpools.length === 0
        ? html`<p class="empty">Aún no participa en ningún carpool.</p>`
        : html`<ul class="cps">
            ${this.carpools.map(
              (cp) => html`<li class="cp">
                <span class="name">🚗 ${cp.name}</span>
                <span class="certs">${cp.completed}/${cp.total} paradas</span>
                <span
                  class="rope"
                  role="progressbar"
                  aria-valuenow=${cp.pct}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-label=${`Avance en el carpool ${cp.name}: ${cp.completed} de ${cp.total} paradas (${cp.pct}%)`}
                >
                  <span class="fill" style=${`width:${cp.pct}%`}></span>
                </span>
                <span class="cpstatus ${cp.status}">${PlayerCard.CARPOOL_STATUS_LABELS[cp.status] ?? cp.status}</span>
              </li>`,
            )}
          </ul>`}
    `;
  }

  /** Etiquetas legibles del estado de un carpool (CP-1). */
  static CARPOOL_STATUS_LABELS = Object.freeze({
    open: 'Abierto',
    full: 'Completo',
    completed: 'Terminado',
    closed: 'Cerrado',
  });

  /**
   * Las Q&A del brujo (MC-22), todas las islas, la más reciente primero
   * (ordenación defensiva en puro: el contenedor ya las manda ordenadas).
   * Cada entrada: isla, fecha, estado, la consulta y — si la hay — la
   * respuesta con su crédito (creditedTo releva a answeredBy).
   */
  _renderQuestions() {
    const questions = sortQuestionsByDateDesc(this.questions ?? []);
    if (questions.length === 0) {
      return html`<p class="empty">Aún no has hecho consultas.</p>`;
    }
    return html`<ul class="wizqs">
      ${questions.map((q) => {
        const credit = q.creditedTo ?? q.answeredBy?.name ?? '';
        return html`<li class="wizq">
          ${q.answer ? html`<span class="wax" aria-hidden="true">✶</span>` : null}
          <div class="wmeta">
            <span class="wisle">🏝️ ${q.islandName !== '' ? q.islandName : q.islandId}</span>
            <span class="wstatus ${q.status}">${QUESTION_BADGES[q.status]}</span>
            <span class="when">${formatQuestionDate(q.createdAt)}</span>
          </div>
          <p class="wtext">${q.text}</p>
          ${q.answer
            ? html`<div class="wizanswer">
                <p class="wtext">${q.answer}</p>
                <p class="wby">${credit ? `— respondida por ${credit}` : '— respuesta del brujo'}</p>
              </div>`
            : null}
        </li>`;
      })}
    </ul>`;
  }
}

if (!customElements.get('player-card')) {
  customElements.define('player-card', PlayerCard);
}
