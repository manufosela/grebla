/**
 * El LECHO que sostiene (doc /careerMap/seabed) — RMR-PCS-0028 · F2.
 *
 * No es una isla del mar sino el FONDO que sostiene el archipiélago entero: el eje
 * transversal «Orquestación y juicio». Sus «arrecifes» son las competencias de
 * dirigir agentes de IA con criterio, verificar su output y decidir. Se marca en
 * el índice con seabed:true (archipelago.js) para reservarlo a la vista sumergida
 * (F3); por lo demás es un CareerMap normal, editable como cualquier isla.
 *
 * Sigue la CONVENCIÓN de ./bases.js: ids de ciudad prefijados por la disciplina
 * (orchestration/…), prereqs internos sin ciclos, posiciones separadas, y cada
 * ciudad con summary + keyPoints (4-6) + aiFocus + 2-4 recursos reales.
 *
 * @typedef {import('../../domain/types.js').CareerMap} CareerMap
 */

/** @type {CareerMap} */
export const SEABED_ISLAND = {
  id: 'seabed',
  name: 'El lecho que sostiene',
  startPort: { x: 50, y: 88 },
  areas: [
    { id: 'dirigir', name: 'Dirigir a los agentes' },
    { id: 'verificar', name: 'Desconfiar y verificar' },
    { id: 'juicio', name: 'Juicio y atención' },
    { id: 'sostener', name: 'Sostener el conjunto' },
  ],
  cities: [
    // ── Dirigir a los agentes (arrecifes de entrada) ────────────────────────
    {
      id: 'orchestration/dar-contexto',
      name: 'Dar contexto',
      kind: 'skill',
      area: 'dirigir',
      x: 30,
      y: 62,
      weight: 3,
      prereqs: [],
      summary: 'Un agente solo es tan bueno como el contexto que le das: el problema, las restricciones, los ejemplos y lo que NO debe hacer. Especificar bien es la primera competencia de la era de los agentes.',
      keyPoints: [
        'Enmarca el problema, no solo la tarea: objetivo, restricciones y criterios de «hecho».',
        'Aporta los ejemplos y el contexto del repo que el agente no puede adivinar.',
        'Di explícitamente lo que NO debe hacer y los límites del cambio.',
        'Itera el contexto cuando el resultado falla, antes de culpar al modelo.',
        'Reconoce cuándo un problema es demasiado ambiguo para delegarlo tal cual.',
      ],
      aiFocus: 'La IA rellena huecos con suposiciones plausibles; tu trabajo es cerrar esos huecos antes, no descubrir después que asumió lo que no era. El contexto es la palanca que más cambia el resultado.',
      resources: [
        { kind: 'doc', label: 'Anthropic — Prompt engineering (documentación)', url: 'https://docs.anthropic.com' },
        { kind: 'post', label: 'Prompt Engineering Guide', url: 'https://www.promptingguide.ai' },
      ],
    },
    {
      id: 'orchestration/descomponer',
      name: 'Descomponer y delegar',
      kind: 'skill',
      area: 'dirigir',
      x: 22,
      y: 44,
      weight: 2,
      prereqs: ['orchestration/dar-contexto'],
      summary: 'Los problemas grandes no se delegan de una pieza: se parten en trozos que un agente puede resolver bien y que tú puedes reintegrar. Descomponer es la mitad del oficio de orquestar.',
      keyPoints: [
        'Corta el trabajo en piezas con una responsabilidad clara y verificable.',
        'Decide qué hace un agente, qué haces tú y qué se hace en paralelo.',
        'Define las interfaces entre piezas para poder recomponerlas sin sorpresas.',
        'Secuencia lo que depende de otra cosa; paraleliza lo que no.',
        'Reintegra con criterio: el todo tiene que funcionar, no solo cada parte.',
      ],
      aiFocus: 'La IA resuelve bien piezas acotadas y se pierde en problemas enormes y difusos; el apalancamiento está en cómo tú cortas el trabajo, no en pedirle más de una vez lo imposible.',
      resources: [
        { kind: 'post', label: 'Anthropic Engineering — building effective agents', url: 'https://www.anthropic.com/engineering' },
        { kind: 'libro', label: 'Thinking in Systems — Donella Meadows', format: 'papel' },
      ],
    },
    // ── Desconfiar y verificar ──────────────────────────────────────────────
    {
      id: 'orchestration/verificar',
      name: 'Desconfiar y verificar',
      kind: 'skill',
      area: 'verificar',
      x: 40,
      y: 40,
      weight: 3,
      prereqs: ['orchestration/descomponer'],
      summary: 'El output de un agente es un borrador, no una verdad: hay que probarlo, leerlo con ojo crítico y no integrarlo hasta estar convencido. La verificación es lo que separa orquestar de delegar a ciegas.',
      keyPoints: [
        'Trata cada resultado como una propuesta a revisar, no como algo terminado.',
        'Verifica con tests, casos límite y lectura crítica, no con la primera impresión.',
        'Comprueba que resuelve el problema real, no solo que «compila y parece bien».',
        'Establece en el equipo qué se verifica, cómo y quién responde de lo generado.',
        'Desconfía especialmente de lo que confirma lo que ya esperabas.',
      ],
      aiFocus: 'La IA produce resultados seguros de sí mismos que suenan correctos aunque no lo sean; tu criterio de verificación es justo lo que ella no tiene, y es donde más valor aportas.',
      resources: [
        { kind: 'doc', label: 'Google Engineering Practices — Code Review', url: 'https://google.github.io/eng-practices/review/' },
        { kind: 'doc', label: 'OWASP — seguridad y revisión de código', url: 'https://owasp.org' },
      ],
    },
    {
      id: 'orchestration/error-sutil',
      name: 'Cazar el error sutil',
      kind: 'skill',
      area: 'verificar',
      x: 55,
      y: 52,
      weight: 2,
      prereqs: ['orchestration/verificar'],
      summary: 'El error peligroso no es el que rompe: es el que pasa los tests y parece correcto pero falla en el caso que no miraste. Detectarlo exige entender de verdad lo que hace el código, no solo que funcione.',
      keyPoints: [
        'Busca el fallo que «parece correcto»: off-by-one, condición de carrera, caso límite.',
        'Lee para entender la intención, no solo para confirmar que corre.',
        'Sospecha de los cambios que tocan más de lo que decían tocar.',
        'Reproduce el problema antes de aceptar la explicación de por qué ocurre.',
        'Cuando algo te chirría sin saber por qué, párate: suele haber algo.',
      ],
      aiFocus: 'La IA acierta en lo típico y falla justo en el matiz que hace especial a tu sistema; ese matiz solo lo ves tú, y ver el error sutil es una habilidad que se entrena mirando causas, no síntomas.',
      resources: [
        { kind: 'libro', label: 'The Pragmatic Programmer — Hunt & Thomas', format: 'papel' },
        { kind: 'doc', label: 'Google SRE — Postmortem culture', url: 'https://sre.google/sre-book/postmortem-culture/' },
      ],
    },
    // ── Juicio y atención ───────────────────────────────────────────────────
    {
      id: 'orchestration/decidir-incompleto',
      name: 'Decidir con información incompleta',
      kind: 'skill',
      area: 'juicio',
      x: 68,
      y: 38,
      weight: 2,
      prereqs: ['orchestration/error-sutil'],
      summary: 'Casi nunca tendrás todos los datos: orquestar es decidir con lo que hay, asumiendo la incertidumbre y sabiendo qué harías si te equivocas. El juicio importa más cuanto más barato es producir opciones.',
      keyPoints: [
        'Separa lo reversible (decide rápido) de lo irreversible (piénsalo).',
        'Decide en probabilidades, no en certezas; nombra tus supuestos.',
        'Ten claro el plan B antes de comprometerte con el A.',
        'Distingue una mala decisión de un mal resultado: revisa el proceso, no solo el desenlace.',
        'Cuando la IA te da muchas opciones baratas, el cuello de botella es elegir bien.',
      ],
      aiFocus: 'La IA multiplica las opciones y baja el coste de probar, pero no decide por ti cuál merece la pena; el juicio para elegir con información incompleta es la competencia que más se revaloriza.',
      resources: [
        { kind: 'libro', label: 'Thinking in Bets — Annie Duke', format: 'papel' },
        { kind: 'libro', label: 'Pensar rápido, pensar despacio — Daniel Kahneman', format: 'papel' },
      ],
    },
    {
      id: 'orchestration/proteger-atencion',
      name: 'Proteger la atención',
      kind: 'skill',
      area: 'juicio',
      x: 72,
      y: 62,
      weight: 3,
      prereqs: [],
      summary: 'Cuando la máquina produce sin descanso, el recurso escaso pasa a ser tu atención. Protegerla —bloques de foco, menos decisiones triviales, menos ruido— deja de ser bienestar y se vuelve una competencia profesional.',
      keyPoints: [
        'Reserva bloques de foco para el trabajo que solo tú puedes hacer.',
        'Reduce las decisiones de bajo valor: automatiza o delega lo mecánico.',
        'Gestiona tu energía, no solo tu tiempo: lo difícil, cuando estás fresco.',
        'Filtra el ruido de los agentes: no toda salida merece tu atención ahora.',
        'Diseña tu entorno para no depender de la fuerza de voluntad.',
      ],
      aiFocus: 'La IA puede llenarte el día de outputs que revisar hasta ahogar el juicio; saber a qué NO prestar atención, y cuándo, es lo que mantiene tu criterio afilado en vez de agotado.',
      resources: [
        { kind: 'libro', label: 'Deep Work — Cal Newport', format: 'papel' },
        { kind: 'post', label: "Maker's Schedule, Manager's Schedule — Paul Graham", url: 'https://www.paulgraham.com/makersschedule.html' },
      ],
    },
    // ── Sostener el conjunto (milestone que cierra el lecho) ─────────────────
    {
      id: 'orchestration/vision-conjunto',
      name: 'Sostener la visión del conjunto',
      kind: 'milestone',
      area: 'sostener',
      x: 50,
      y: 24,
      weight: 3,
      prereqs: ['orchestration/verificar', 'orchestration/decidir-incompleto', 'orchestration/proteger-atencion'],
      summary: 'La competencia que corona el lecho: mantener en la cabeza el sistema entero mientras varios agentes trabajan en trozos, para que las piezas encajen en algo coherente. Es lo que hace un director: sostener la partitura completa.',
      keyPoints: [
        'Mantén la coherencia del todo cuando el trabajo está repartido en piezas.',
        'Detecta cuándo dos partes correctas por separado no encajan juntas.',
        'Cuida las decisiones transversales que ningún agente ve desde su trozo.',
        'Sostienes el sistema para que el equipo construya sobre él, no mandas desde arriba.',
        'Sabes qué NO se delega: las decisiones que definen el conjunto son tuyas.',
      ],
      aiFocus: 'La IA optimiza cada pieza sin ver el conjunto; la visión global, la coherencia y las decisiones que atan todo son irreductiblemente humanas, y son las que sostienen el archipiélago desde el lecho.',
      resources: [
        { kind: 'libro', label: 'Thinking in Systems — Donella Meadows', format: 'papel' },
        { kind: 'libro', label: 'The Mythical Man-Month — Fred Brooks', format: 'papel' },
      ],
    },
  ],
};
