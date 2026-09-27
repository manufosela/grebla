import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guard del despliegue (RMR-BUG-0129).
 *
 * `deploy:all` desplegaba SOLO hosting, así que un cambio en `firestore.rules`
 * se quedaba en el repo y rompía producción: el 26-sep el orden de las tarjetas
 * se guardaba contra una regla que solo existía aquí, y el síntoma —un
 * permission-denied— no se explicaba mirando el código desplegado, porque la
 * causa era lo que NO se había desplegado.
 *
 * Es un test de texto sobre el script y no de su ejecución a propósito:
 * ejecutarlo despliega de verdad. Lo que hay que impedir es que alguien vuelva a
 * recortar el `--only`, y eso se ve leyéndolo.
 */
const script = readFileSync(join(process.cwd(), 'scripts/deploy-all.mjs'), 'utf8');

describe('qué despliega deploy:all', () => {
  it('las reglas de Firestore, que es lo que faltaba', () => {
    expect(script).toContain('firestore:rules');
  });

  it('y los índices: un índice que falta rompe la consulta en producción', () => {
    // El emulador crea índices al vuelo, así que los E2E pasan en verde con un
    // índice que en producción no existe.
    expect(script).toContain('firestore:indexes');
  });

  it('las reglas de Storage, por lo mismo', () => {
    expect(script).toContain('storage');
  });

  it('el hosting sigue estando', () => {
    expect(script).toContain('hosting');
  });

  it('las FUNCTIONS no, y es una decisión, no un olvido', () => {
    // Tardan minutos, arrastran secretos que no todas las instancias tienen y
    // pasan por su propio gate de release. Si algún día entran aquí, que sea
    // borrando este test y explicando por qué.
    const onlyArg = /'--only', '([^']+)'/.exec(script)?.[1] ?? '';
    expect(onlyArg).not.toContain('functions');
    expect(script).toMatch(/Cloud Functions NO/i);
  });
});
