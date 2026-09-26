/**
 * Cómo se llama la herramienta de Equipo según A QUIÉN estás viendo
 * (RMR-TSK-0585).
 *
 * Se llamaba «Tu equipo» siempre, y eso hacía dos cosas malas a la vez: no decía
 * lo que había dentro —había que abrirla para saberlo— y la mitad de las veces
 * era falso, porque quien gobierna la instancia abría «Tu equipo» y le salía la
 * organización entera. El nombre tiene que decir lo que hay, y lo que hay depende
 * del alcance con el que se entra.
 *
 * Función PURA: el alcance lo resuelve el glue (mismo que construye el container),
 * aquí solo se traduce a palabras.
 */

/** Alcances con los que se puede entrar. Lista cerrada a propósito. */
export const TEAM_SCOPES = Object.freeze(['mine', 'all']);

/**
 * La entradilla es de UNA línea a propósito: la que había ocupaba tres, decía
 * cuatro cosas y una de ellas («solo tú los ves») había dejado de ser verdad para
 * quien mira toda la organización. Lo que cuenta cada sección lo cuenta cada
 * sección.
 */
const HEADINGS = Object.freeze({
  mine: Object.freeze({
    title: 'Mi equipo',
    lead: 'Las personas que sostienes: tus ingenieros, TLs, EMs y heads.',
  }),
  all: Object.freeze({
    title: 'Toda la organización',
    lead: 'Todas las personas activas, no solo las de tu equipo.',
  }),
});

/**
 * Nombre neutro para cuando el alcance no se ha resuelto. No es un fallback
 * silencioso: es el único rótulo que es VERDAD en los dos casos, y se prefiere a
 * adivinar uno de los dos y acertar la mitad de las veces.
 */
const SIN_RESOLVER = Object.freeze({
  title: 'Equipo',
  lead: 'Las personas activas y su seguimiento.',
});

/**
 * Rótulo de la herramienta para el alcance dado.
 *
 * `everyoneLabel` es cómo llama esta casa a mirar más allá de un equipo
 * (RMR-TSK-0597): se configura en Administración › Organización › Identidad, y
 * si está vacío manda el del producto. Solo afecta al alcance `all`: «Mi equipo»
 * es tuyo lo llame como lo llame la organización.
 *
 * @param {'mine'|'all'|null|undefined} scope
 * @param {{ everyoneLabel?: string }} [identity]
 * @returns {{ title: string, lead: string }}
 */
export function teamHeading(scope, identity) {
  const base = HEADINGS[scope] ?? SIN_RESOLVER;
  if (scope !== 'all') return base;
  const propio = (identity?.everyoneLabel ?? '').toString().trim();
  return propio ? { ...base, title: propio } : base;
}
