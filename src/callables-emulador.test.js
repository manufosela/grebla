/**
 * Guard: ningún módulo pide Cloud Functions por su cuenta (RMR-BUG-0102).
 *
 * `getFunctions(app, 'europe-west1')` devuelve una instancia que apunta SIEMPRE
 * a producción. Con los emuladores levantados, la llamada sale hacia el proyecto
 * real y no llega nunca — y si quien llama se traga la excepción, no se ve nada:
 * así estuvo `sealInvite` meses, sellando invitaciones que nadie sellaba en los
 * tests. Es el peor tipo de fallo: verde en local, roto de verdad.
 *
 * `getRegionalFunctions()` (src/lib/firebase.js) es el único sitio que decide a
 * dónde apuntan los callables, igual que ya pasaba con auth y Firestore.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('.', import.meta.url).pathname;
/** El único módulo autorizado a construir la instancia. */
const FUENTE = 'lib/firebase.js';

function ficheros(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return ficheros(full);
    return entry.name.endsWith('.js') && !entry.name.endsWith('.test.js') ? [full] : [];
  });
}

/** Llamadas a getFunctions(...), en cualquiera de sus formas. */
const PIDE_FUNCTIONS = /\bgetFunctions\s*\(/;

describe('los callables pasan por getRegionalFunctions', () => {
  const modulos = ficheros(SRC)
    .map((file) => ({ rel: file.replace(SRC, ''), texto: readFileSync(file, 'utf8') }));

  it('hay módulos que revisar', () => {
    expect(modulos.length).toBeGreaterThan(50);
  });

  it('solo firebase.js construye la instancia de Functions', () => {
    const infractores = modulos
      .filter(({ rel, texto }) => rel !== FUENTE && PIDE_FUNCTIONS.test(texto))
      .map(({ rel }) => `src/${rel} llama a getFunctions() en vez de getRegionalFunctions(): sus callables no verán el emulador`);
    expect(infractores).toEqual([]);
  });

  it('y ahí sí se conecta al emulador cuando toca', () => {
    const fuente = modulos.find(({ rel }) => rel === FUENTE)?.texto ?? '';
    // Si esto desapareciera, el guard de arriba seguiría en verde mientras todos
    // los callables vuelven a salir hacia producción.
    expect(fuente).toContain('connectFunctionsEmulator');
  });
});
