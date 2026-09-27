/**
 * Logo de la INSTANCIA (RMR-TSK-0598 · F2 de la identidad).
 *
 * GREBLA se despliega una vez por organización, y la cabecera es lo primero que
 * se ve: una casa que se llama de otra forma quiere su marca ahí, no la nuestra.
 *
 * El logo se guarda en `/config/org` como data URI, no en Storage. Es un dato de
 * configuración diminuto —un logo de cabecera son unos pocos KB— y ponerlo junto
 * al resto de la identidad significa cero reglas nuevas, cero Cloud Functions y
 * una lectura menos: la cabecera ya lee ese documento. El precio es el tope de
 * tamaño, que para un logo no es un precio.
 *
 * Se pinta SIEMPRE como `<img src>`, nunca incrustando el SVG en el documento.
 * Un SVG lo sube una persona y puede traer `<script>` dentro: dentro de un `img`
 * no se ejecuta; pegado al DOM, sí.
 *
 * Módulo PURO: valida y describe. Leerlo y escribirlo es cosa de
 * `lib/orgConfig.js`, y quién puede, de las reglas.
 */

/** Formatos que se aceptan: vectorial para que escale, PNG para quien no tenga SVG. */
export const LOGO_TYPES = Object.freeze(['image/svg+xml', 'image/png']);

/**
 * Tope del fichero ORIGINAL. En base64 crece un tercio, así que 96 KB acaban en
 * unos 128 KB dentro del documento — lejísimos del límite de 1 MiB de Firestore,
 * que además comparte con el resto de la configuración.
 */
export const LOGO_MAX_BYTES = 96 * 1024;

/** Alto al que se pinta en la cabecera; el ancho lo decide la proporción. */
export const LOGO_HEIGHT_PX = 32;

/** @param {number} bytes */
const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

/**
 * ¿Sirve este fichero como logo? Devuelve el motivo cuando no, porque «archivo
 * no válido» obliga a adivinar: se dice qué formato trae y cuáles valen, o
 * cuánto pesa y cuánto cabe.
 * @param {{ type?: string, size?: number, name?: string }|null|undefined} file
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function checkLogoFile(file) {
  if (!file) return { ok: false, error: 'No has elegido ningún archivo.' };
  if (!LOGO_TYPES.includes(file.type)) {
    return {
      ok: false,
      error: `El logo tiene que ser SVG o PNG. Este es ${file.type || 'de un tipo que el navegador no reconoce'}.`,
    };
  }
  // El tamaño se exige NÚMERO finito y positivo, no «no menor que cero». Sin
  // `size` las comparaciones dan NaN, y NaN no es ni mayor ni menor que nada:
  // un archivo así se colaría por las dos puertas, la del vacío y la del tope.
  // Y se comprueba el TIPO en vez de convertir: un «1024» en texto no es un
  // tamaño, es una señal de que lo que llega no es un File.
  const size = file.size;
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
    return { ok: false, error: 'El archivo está vacío.' };
  }
  if (size > LOGO_MAX_BYTES) {
    return {
      ok: false,
      error: `El logo pesa ${kb(size)} y el tope son ${kb(LOGO_MAX_BYTES)}. Un logo de cabecera suele bajar de 20 KB.`,
    };
  }
  return { ok: true };
}

/** Base64 canónico: solo su alfabeto, en bloques de 4 y con el relleno al final. */
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * ¿Es este payload base64 que de verdad lleva algo dentro? La comprobación del
 * prefijo no basta: `data:image/png;base64,` a secas lo pasa, y lo que se pinta
 * entonces es un icono roto.
 * @param {string} payload
 */
function base64Ok(payload) {
  if (payload.length < 8 || payload.length % 4 !== 0 || !BASE64.test(payload)) return false;
  // Bytes reales del original: cada 4 caracteres son 3 bytes, menos el relleno.
  const bytes = (payload.length / 4) * 3 - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0);
  return bytes <= LOGO_MAX_BYTES;
}

/**
 * El data URI guardado, si de verdad lo es, es de un formato aceptado y trae
 * contenido. Un valor que no lo sea no se pinta: la cabecera se queda con la
 * marca de GREBLA, que es mejor que un icono roto.
 *
 * Se comprueba el CONTENIDO y no solo el prefijo porque esto viene de un
 * documento de configuración que se puede editar a mano.
 * @param {{ logo?: unknown }|null|undefined} orgConfig
 * @returns {string|null}
 */
export function logoSrcFrom(orgConfig) {
  const raw = orgConfig?.logo;
  if (typeof raw !== 'string' || raw === '') return null;
  const type = LOGO_TYPES.find((t) => raw.startsWith(`data:${t};base64,`));
  if (!type) return null;
  return base64Ok(raw.slice(`data:${type};base64,`.length)) ? raw : null;
}

/**
 * Texto alternativo de la cabecera. Con el nombre de la casa configurado, el
 * logo dice de quién es; sin él, se dice que es el logo de la organización —
 * nunca un alt vacío, que para quien usa lector de pantalla es un hueco.
 * @param {{ orgName?: string }|null|undefined} identity
 * @returns {string}
 */
export function logoAltFrom(identity) {
  const name = String(identity?.orgName ?? '').trim();
  return name ? `Logo de ${name}` : 'Logo de la organización';
}
