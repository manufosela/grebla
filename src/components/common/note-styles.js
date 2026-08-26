/**
 * Estilo compartido de los AVISOS (RMR-TSK-0457).
 *
 * Un aviso no es texto secundario. En gris se lee como mobiliario —parte del
 * decorado— y la gente no lo ve: eso pasaba con el aviso de quién puede ver una
 * retro, que es justo lo que hay que leer antes de escribir dentro.
 *
 * Cada componente Lit tiene su propio shadow DOM, así que una clase global no
 * llega: se importa este bloque y se añade a `static styles`. Los colores salen
 * de los tokens del tema (`--rm-info*`), que sí atraviesan el shadow DOM, así
 * que el aviso se adapta solo al modo claro y al oscuro.
 *
 *   import { noteStyles } from '../common/note-styles.js';
 *   static styles = [noteStyles, css`…lo propio del componente…`];
 *
 * Clases: `.info-note` (aviso) y `.info-note.strong` (el que no se puede pasar
 * por alto, con barra lateral). `.ro-note` es alias, por el nombre que ya usaba
 * el panel.
 *
 * NO se llama `.note` a secas a propósito: en el tablero de retro esa clase es
 * el post-it, y un nombre compartido convertiría las notas de la gente en cajas
 * de aviso.
 */
import { css } from 'lit';

export const noteStyles = css`
  .info-note,
  .ro-note {
    margin: 0 0 0.9rem;
    padding: 0.6rem 0.8rem;
    border-radius: 10px;
    background: var(--rm-info-soft, #eff5ff);
    border: 1px solid var(--rm-info-border, #bfd6fb);
    color: var(--rm-info-text, #1e3a8a);
    font-size: 0.88rem;
    line-height: 1.5;
  }

  /* El aviso que no se puede pasar por alto lleva barra lateral. */
  .info-note.strong,
  .ro-note.strong {
    border-left: 4px solid var(--rm-info, #2563eb);
  }

  /* Lo que va dentro del aviso hereda su color: si un <strong> se quedara con
     el color del texto normal, el aviso volvería a parecer un párrafo más. */
  .info-note strong,
  .ro-note strong,
  .info-note b,
  .ro-note b {
    color: inherit;
  }

  .info-note a,
  .ro-note a {
    color: inherit;
    text-decoration: underline;
  }
`;
