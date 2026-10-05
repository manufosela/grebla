/**
 * Pinta la hoja de los colores de marca (RMR-TSK-0599) y la recuerda en
 * localStorage para que la próxima carga la pinte desde el principio
 * (Base.astro). Una cadena vacía vuelve a la marca de GREBLA. La usan el
 * layout al cargar y el editor al guardar, para que el cambio se vea al momento.
 * @param {string} css salida de brandStyleSheet (vacía = marca de GREBLA)
 */
export function applyBrandStyle(css) {
  let style = document.getElementById('brand-colors');
  if (!style) {
    style = document.createElement('style');
    style.id = 'brand-colors';
    document.head.append(style);
  }
  style.textContent = css;
  try {
    if (css) localStorage.setItem('grebla-brand-css', css);
    else localStorage.removeItem('grebla-brand-css');
  } catch {
    /* sin almacenamiento: solo se pierde el pintado temprano */
  }
}
