/**
 * Glue de la home: decide qué se ve según haya o no tenant en la URL.
 *  - Sin /{tenant} (raíz de plataforma): landing pública (presentación + login).
 *  - Dentro de /{tenant}: tarjetas de herramientas (layout.js ya prefija sus
 *    enlaces con /{tenant}).
 * Por defecto el HTML muestra la landing y oculta las tools; así la raíz nunca
 * expone herramientas sin un tenant concreto, aunque el JS no llegue a ejecutarse.
 */
const RESERVED = new Set(['', 'guia', 'login', 'tools', '_astro']);

const seg = location.pathname.split('/')[1] || '';
const tenant = seg && !RESERVED.has(seg) ? seg : null;

const landing = document.getElementById('platform-landing');
const tools = document.getElementById('tenant-tools');

if (tenant) {
  tools?.removeAttribute('hidden');
  landing?.setAttribute('hidden', '');
}
