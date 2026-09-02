/**
 * Estilo compartido de las TABLAS (RMR-BUG-0106).
 *
 * Una tabla ancha sin caja que la contenga no se recorta: se sale del panel y lo
 * que queda a la derecha es INALCANZABLE — ni cabe, ni se puede arrastrar. Con
 * `.table-wrap` alrededor, si no cabe al menos se llega.
 *
 * El orden importa: primero que quepa (repartiendo el ancho, como en la tabla de
 * personas del panel) y el desplazamiento como red de seguridad, para la pantalla
 * estrecha o el dato inesperadamente largo. Nunca al revés: el scroll horizontal
 * es la última salida, no el diseño.
 *
 * Cada componente Lit tiene su propio shadow DOM, así que una clase global no
 * llega: se importa este bloque y se añade a `static styles`.
 *
 *   import { tableStyles } from '../common/table-styles.js';
 *   static styles = [tableStyles, css`…lo propio del componente…`];
 *
 * Y en la plantilla, la tabla va dentro de su caja:
 *
 *   html`<div class="table-wrap"><table>…</table></div>`
 */
import { css } from 'lit';

export const tableStyles = css`
  .table-wrap {
    overflow-x: auto;
    /* La barra vertical solo cuando de verdad hay que desplazar: auto en los
       dos ejes saca una barra horizontal fantasma en algunos navegadores. */
    overflow-y: visible;
    max-width: 100%;
  }

  /* Que la barra sea visible también en macOS, donde por defecto se esconde
     hasta que alguien ya está desplazando —justo cuando ya no hace falta. */
  .table-wrap { scrollbar-width: thin; }
`;
