/**
 * Isla «Software Architect» (doc /careerMap/software-architect) — MC-16, oleada 2.
 *
 * Sigue la convención de contenido de islas descrita en ./bases.js: ids de
 * ciudad prefijados por la disciplina ('software-architect/'), prereqs solo
 * intra-isla y sin ciclos, posiciones 0..100 separadas, pesos 1..3 y cada
 * ciudad con keyPoints, aiFocus y recursos reales. Basada en el roadmap de
 * software architect de roadmap.sh, adaptada a la era IA: cuando la IA genera
 * implementaciones enteras, el arquitecto es quien pone los límites, los
 * trade-offs y las funciones de verificación que mantienen el sistema sano.
 *
 * @typedef {import('../../domain/types.js').CareerMap} CareerMap
 */

/** @type {CareerMap} */
export const SOFTWARE_ARCHITECT_ISLAND = {
  id: 'software-architect',
  name: 'Isla Software Architect',
  startPort: { x: 50, y: 88 },
  areas: [
    { id: 'pensamiento', name: 'Pensamiento sistémico' },
    { id: 'estilos', name: 'Estilos y acoplamiento' },
    { id: 'datos', name: 'Datos y contratos' },
    { id: 'calidad', name: 'Decisiones y evolución' },
    { id: 'plataforma', name: 'Plataforma y liderazgo' },
    { id: 'arquitectura-ia', name: 'Arquitectura en la era IA' },
  ],
  cities: [
    // ── Pensamiento sistémico (comarca de entrada, junto al puerto) ──────────
    {
      id: 'software-architect/rol-del-arquitecto',
      name: 'El rol del arquitecto',
      kind: 'skill',
      area: 'pensamiento',
      x: 50,
      y: 72,
      weight: 3,
      prereqs: [],
      keyPoints: [
        'Arquitectura es lo caro de cambiar: tu trabajo es decidir tarde lo reversible y pronto lo irreversible.',
        'El arquitecto de torre de marfil ha muerto: diseña con el equipo y cerca del código.',
        'Amplía tu anchura técnica: mejor conocer diez enfoques al 70% que uno al 100%.',
        'Tu entregable no son diagramas, son decisiones comunicadas y entendidas.',
        'Aprende el negocio: una arquitectura excelente para el problema equivocado es un fracaso caro.',
      ],
      aiFocus:
        'La IA implementa; el arquitecto decide QUÉ se construye, con qué límites y qué es aceptable. Cuanto más código genera la máquina, más valor tiene quien define la estructura donde ese código no degenera. Profundiza en juicio sobre reversibilidad y coste de cambio: es tu moneda.',
      resources: [
        { kind: 'libro', label: 'Fundamentals of Software Architecture (Richards y Ford)', format: 'papel' },
        { kind: 'doc', label: 'roadmap.sh — Software Architect', url: 'https://roadmap.sh/software-architect' },
        { kind: 'post', label: 'martinfowler.com — arquitectura de software', url: 'https://martinfowler.com' },
      ],
    },
    {
      id: 'software-architect/pensamiento-sistemico',
      name: 'Pensamiento sistémico',
      kind: 'skill',
      area: 'pensamiento',
      x: 36,
      y: 64,
      weight: 3,
      prereqs: ['software-architect/rol-del-arquitecto'],
      keyPoints: [
        'Piensa en flujos, cuellos de botella y bucles de realimentación, no en cajas aisladas.',
        'Todo sistema tiene comportamiento emergente: pregúntate qué pasa bajo carga, con fallos y con el tiempo.',
        'Dibuja el sistema completo (personas incluidas): la arquitectura también son equipos y procesos.',
        'Busca los efectos de segundo orden de cada decisión: la solución de hoy es el problema de mañana.',
        'Practica análisis post-incidente: los fallos reales son la mejor radiografía de tu sistema.',
      ],
      aiFocus:
        'La IA razona bien sobre componentes aislados y mal sobre propiedades emergentes de sistemas completos: latencias acumuladas, fallos en cascada, incentivos de equipos. Profundiza en ver el todo — es la capa de razonamiento donde el humano sigue marcando la diferencia.',
      resources: [
        { kind: 'libro', label: 'Thinking in Systems (Donella Meadows)', format: 'papel' },
        { kind: 'libro', label: 'Release It! (Michael Nygard)', format: 'papel' },
      ],
    },
    {
      id: 'software-architect/trade-offs',
      name: 'Todo es un trade-off',
      kind: 'skill',
      area: 'pensamiento',
      x: 64,
      y: 64,
      weight: 3,
      prereqs: ['software-architect/rol-del-arquitecto'],
      keyPoints: [
        'Primera ley de la arquitectura: todo es un trade-off; si no lo ves, aún no lo has encontrado.',
        'Analiza cada opción en varios ejes: rendimiento, coste, operabilidad, seguridad, time-to-market.',
        'No hay «mejor práctica» sin contexto: pregunta siempre «¿para qué caso y con qué restricciones?».',
        'Cuantifica cuando puedas: un número aproximado gana a un adjetivo rotundo.',
        'Comunica lo que se sacrifica, no solo lo que se gana: esa es la parte honesta de la propuesta.',
      ],
      aiFocus:
        'Pídele a la IA la tabla de pros y contras: la genera al instante y es un gran punto de partida. Lo que no puede es ponderarla con TU contexto — presupuesto, equipo, deadlines, historia. Profundiza en el arte de sopesar: elegir qué sacrificar es la firma del arquitecto.',
      resources: [
        { kind: 'libro', label: 'Software Architecture: The Hard Parts (Ford, Richards et al.)', format: 'papel' },
        { kind: 'post', label: 'martinfowler.com — arquitectura de software', url: 'https://martinfowler.com' },
      ],
    },
    {
      id: 'software-architect/requisitos-no-funcionales',
      name: 'Atributos de calidad',
      kind: 'skill',
      area: 'pensamiento',
      x: 50,
      y: 56,
      weight: 2,
      prereqs: ['software-architect/pensamiento-sistemico'],
      keyPoints: [
        'Extrae los -ilities que importan (disponibilidad, latencia, escalabilidad, seguridad) y priorízalos: no puedes tenerlos todos.',
        'Convierte cada atributo en un escenario medible: «p99 < 200ms con 1000 usuarios concurrentes».',
        'Los requisitos implícitos matan proyectos: pregunta por picos, datos sensibles y crecimiento esperado.',
        'Presupuesta la fiabilidad con SLOs y error budgets, no con «lo más disponible posible».',
        'Revisa los atributos cuando cambie el negocio: los -ilities caducan.',
      ],
      aiFocus:
        'La IA convierte escenarios de calidad en tests y configuraciones (carga, chaos, alertas) con poco esfuerzo, así que ya no hay excusa para dejarlos en prosa. Profundiza en descubrir y negociar los atributos con stakeholders: extraer el requisito no escrito sigue siendo trabajo de humanos que preguntan bien.',
      resources: [
        { kind: 'libro', label: 'Software Architecture in Practice (Bass, Clements y Kazman)', format: 'papel' },
        { kind: 'doc', label: 'Google SRE — libros y recursos', url: 'https://sre.google' },
      ],
    },

    // ── Estilos y acoplamiento (oeste) ───────────────────────────────────────
    {
      id: 'software-architect/monolito-modular',
      name: 'Monolito modular',
      kind: 'tech',
      area: 'estilos',
      x: 24,
      y: 52,
      weight: 3,
      prereqs: ['software-architect/pensamiento-sistemico'],
      keyPoints: [
        'Empieza monolítico y modular: un despliegue, límites internos claros, dolor de red cero.',
        'Define módulos por capacidad de negocio (bounded contexts), no por capas técnicas.',
        'Haz cumplir los límites con tooling (reglas de import, módulos, tests de arquitectura).',
        'Un buen monolito modular se trocea después si hace falta; un distribuido mal cortado no se pega.',
        'La modularidad se mide: dependencias entre módulos y ciclos son tus métricas de salud.',
      ],
      aiFocus:
        'La IA rellena módulos a gran velocidad, y sin límites explícitos rellena TODO con dependencias cruzadas: el monolito modular es la jaula que la mantiene ordenada. Profundiza en definir límites ejecutables (lint de arquitectura, contratos entre módulos) que ni humanos ni máquinas puedan saltarse sin ruido.',
      resources: [
        { kind: 'post', label: 'martinfowler.com — MonolithFirst y modularidad', url: 'https://martinfowler.com' },
        { kind: 'libro', label: 'Balancing Coupling in Software Design (Vlad Khononov)', format: 'papel' },
      ],
    },
    {
      id: 'software-architect/microservicios',
      name: 'Microservicios',
      kind: 'tech',
      area: 'estilos',
      x: 12,
      y: 40,
      weight: 2,
      prereqs: ['software-architect/monolito-modular'],
      keyPoints: [
        'Microservicios compran autonomía organizativa a cambio de complejidad operacional: paga solo si la necesitas.',
        'Corta por capacidades de negocio con datos propios; compartir base de datos es un monolito distribuido.',
        'Diseña para el fallo: timeouts, retries con backoff, circuit breakers e idempotencia no son opcionales.',
        'Necesitas la plataforma antes que los servicios: CI/CD, observabilidad y despliegue automatizado.',
        'La falacia nº1 del distribuido: la red no es fiable, ni rápida, ni gratis.',
      ],
      aiFocus:
        'La IA genera un servicio nuevo en minutos, lo que convierte «crear otro microservicio» en la tentación por defecto — y en tu principal riesgo de sprawl. Profundiza en el criterio de corte y en la operación distribuida: el coste de un servicio no es escribirlo, es vivir con él años.',
      resources: [
        { kind: 'libro', label: 'Building Microservices (Sam Newman)', format: 'papel' },
        { kind: 'doc', label: 'microservices.io — patrones de microservicios', url: 'https://microservices.io' },
      ],
    },
    {
      id: 'software-architect/event-driven',
      name: 'Arquitectura event-driven',
      kind: 'tech',
      area: 'estilos',
      x: 26,
      y: 36,
      weight: 2,
      prereqs: ['software-architect/monolito-modular'],
      keyPoints: [
        'Eventos desacoplan en el tiempo: el productor no espera y el consumidor procesa a su ritmo.',
        'Distingue evento (hecho pasado), comando (orden) y query: mezclarlos es la fuente clásica de líos.',
        'Garantías de entrega (at-least-once, exactly-once) y orden: conócelas antes de prometer nada.',
        'Diseña consumidores idempotentes y piensa el manejo de eventos duplicados o tardíos desde el día uno.',
        'El acoplamiento no desaparece, se esconde en los esquemas de los eventos: versiónalos.',
      ],
      aiFocus:
        'La IA escribe productores y consumidores correctos «en pequeño», pero el diseño del flujo de eventos — qué es un evento, quién es dueño del esquema, qué pasa con los duplicados — es donde los sistemas event-driven viven o mueren. Profundiza en razonar sobre consistencia eventual de punta a punta.',
      resources: [
        { kind: 'libro', label: 'Enterprise Integration Patterns (Hohpe y Woolf)', format: 'papel' },
        { kind: 'doc', label: 'Apache Kafka — documentación', url: 'https://kafka.apache.org' },
      ],
    },
    {
      id: 'software-architect/acoplamiento-cohesion',
      name: 'Acoplamiento y cohesión',
      kind: 'skill',
      area: 'estilos',
      x: 38,
      y: 44,
      weight: 3,
      prereqs: ['software-architect/monolito-modular'],
      keyPoints: [
        'Alta cohesión dentro, bajo acoplamiento fuera: la regla que sobrevive a todas las modas.',
        'Distingue tipos de acoplamiento (estático, dinámico, temporal, de datos) y cuál estás comprando.',
        'Lo que cambia junto debe vivir junto: agrupa por razón de cambio, no por tipo de fichero.',
        'El acoplamiento a terceros también cuenta: aísla vendors y APIs externas tras tus propias interfaces.',
        'Mide el blast radius: ¿cuántos módulos tocas para un cambio típico de negocio?',
      ],
      aiFocus:
        'El código generado por IA tiende al acoplamiento silencioso: importa lo que tiene a mano y duplica lo que no encuentra. Profundiza en detectar acoplamiento en review y en darle a la IA interfaces claras como contexto — un sistema bien desacoplado es también más fácil de «promptear» pieza a pieza.',
      resources: [
        { kind: 'libro', label: 'A Philosophy of Software Design (John Ousterhout)', format: 'papel' },
        { kind: 'libro', label: 'Balancing Coupling in Software Design (Vlad Khononov)', format: 'papel' },
      ],
    },

    // ── Datos y contratos (este) ─────────────────────────────────────────────
    {
      id: 'software-architect/modelado-de-datos',
      name: 'Modelado de datos',
      kind: 'skill',
      area: 'datos',
      x: 62,
      y: 46,
      weight: 3,
      prereqs: ['software-architect/requisitos-no-funcionales'],
      keyPoints: [
        'El modelo de datos sobrevive al código: equivócate en la app y lo arreglas; en el modelo, lo pagas años.',
        'Modela primero el dominio (entidades, invariantes, ciclo de vida) y después elige el almacén.',
        'Conoce los paradigmas — relacional, documental, clave-valor, grafo, columnar — y sus casos de uso reales.',
        'Piensa en los patrones de acceso: cómo se lee y se escribe decide índices, particiones y esquema.',
        'Planifica la evolución del esquema desde el inicio: las migraciones son parte del diseño, no un accidente.',
      ],
      aiFocus:
        'La IA propone esquemas razonables al instante, pero optimiza para el enunciado que le diste, no para los patrones de acceso que descubrirás en producción. Profundiza en modelar el dominio y sus invariantes: es la decisión de mayor coste de cambio de todo el sistema y la peor para delegar a ciegas.',
      resources: [
        { kind: 'libro', label: 'Designing Data-Intensive Applications (Martin Kleppmann)', format: 'papel' },
        { kind: 'libro', label: 'Domain-Driven Design (Eric Evans)', format: 'papel' },
      ],
    },
    {
      id: 'software-architect/consistencia-cap',
      name: 'Consistencia y CAP',
      kind: 'skill',
      area: 'datos',
      x: 74,
      y: 54,
      weight: 3,
      prereqs: ['software-architect/modelado-de-datos'],
      keyPoints: [
        'CAP en la práctica: ante una partición eliges consistencia o disponibilidad — y las particiones ocurren.',
        'Conoce la escala de gris: consistencia fuerte, causal, read-your-writes, eventual… no es binario.',
        'Pregunta al negocio qué inconsistencia tolera: un carrito no es una cuenta bancaria.',
        'Transacciones distribuidas son el último recurso: prefiere sagas, outbox e idempotencia.',
        'PACELC completa el cuadro: sin partición, sigues eligiendo entre latencia y consistencia.',
      ],
      aiFocus:
        'Los bugs de consistencia no se ven en la demo: la IA genera código que funciona en el caso feliz y falla bajo concurrencia y particiones. Profundiza en razonar sobre garantías — qué promete cada almacén y cada patrón — porque verificar esto exige entender, no solo ejecutar tests.',
      resources: [
        { kind: 'libro', label: 'Designing Data-Intensive Applications (Martin Kleppmann)', format: 'papel' },
        { kind: 'doc', label: 'Jepsen — análisis de sistemas distribuidos', url: 'https://jepsen.io' },
      ],
    },
    {
      id: 'software-architect/sistemas-intensivos-datos',
      name: 'Sistemas intensivos en datos',
      kind: 'tech',
      area: 'datos',
      x: 76,
      y: 38,
      weight: 2,
      prereqs: ['software-architect/modelado-de-datos'],
      keyPoints: [
        'Separa OLTP de OLAP: el sistema que atiende usuarios no es el que responde analítica.',
        'Domina las piezas de la cadena: réplicas, particionado, caches, colas, batch y streaming.',
        'Caches: invalidación, TTLs y estampidas son el precio de la velocidad; diséñalos, no los sufras.',
        'Los pipelines de datos también son producto: contratos, calidad y linaje de datos importan.',
        'Estima números de servilleta (volumen, QPS, tamaño de fila): el orden de magnitud guía el diseño.',
      ],
      aiFocus:
        'Los sistemas de IA son consumidores voraces de datos: pipelines de features, embeddings y contexto para RAG se apoyan exactamente en estas piezas. Profundiza en DDIA a fondo — quien entiende réplicas, particiones y streams diseña también la infraestructura que alimenta a los modelos.',
      resources: [
        { kind: 'libro', label: 'Designing Data-Intensive Applications (Martin Kleppmann)', format: 'papel' },
        { kind: 'post', label: 'The Morning Paper — papers comentados', url: 'https://blog.acolyer.org' },
      ],
    },
    {
      id: 'software-architect/apis-y-contratos',
      name: 'APIs y contratos',
      kind: 'skill',
      area: 'datos',
      x: 88,
      y: 46,
      weight: 2,
      prereqs: ['software-architect/modelado-de-datos'],
      keyPoints: [
        'Una API es una promesa: diseña contract-first y trata el contrato como código (versionado y testeado).',
        'Elige el estilo por el caso: REST para recursos, gRPC para interno de baja latencia, eventos para desacoplar.',
        'Compatibilidad hacia atrás por defecto: añade campos, no los cambies; deprecia con calendario.',
        'Los errores son parte del contrato: códigos, formatos y semántica de reintento documentados.',
        'Piensa en el consumidor que no conoces: docs, ejemplos y sandbox son parte de la API.',
      ],
      aiFocus:
        'Los contratos claros son oro con IA: un OpenAPI bien escrito le permite generar clientes, mocks y tests correctos a la primera — y pronto tus consumidores serán también agentes. Profundiza en diseñar APIs no ambiguas y evolucionables: el contrato es el prompt permanente de tu sistema.',
      resources: [
        { kind: 'doc', label: 'OpenAPI Initiative — especificación', url: 'https://www.openapis.org' },
        { kind: 'post', label: 'Stripe — blog de ingeniería y diseño de APIs', url: 'https://stripe.com/blog' },
      ],
    },

    // ── Decisiones y evolución (centro-norte) ────────────────────────────────
    {
      id: 'software-architect/adrs',
      name: 'ADRs: decidir por escrito',
      kind: 'skill',
      area: 'calidad',
      x: 44,
      y: 30,
      weight: 3,
      prereqs: ['software-architect/acoplamiento-cohesion'],
      keyPoints: [
        'Un ADR por decisión significativa: contexto, opciones, decisión y consecuencias — una página basta.',
        'Escribe el porqué, no solo el qué: dentro de dos años nadie recordará el contexto.',
        'Los ADRs son inmutables: una decisión nueva supersede a la vieja, no la reescribe.',
        'Guárdalos junto al código y revísalos en el PR: decisión que no se ve, decisión que no existe.',
        'Complementa con diagramas C4 o arc42 para comunicar la estructura a distintas audiencias.',
      ],
      aiFocus:
        'Los ADRs son contexto de primera para la IA: un asistente que conoce tus decisiones genera código alineado con ellas en vez de reinventar la arquitectura en cada prompt. Profundiza en escribir decisiones claras y localizables — ahora también documentas para lectores máquina.',
      resources: [
        { kind: 'doc', label: 'ADR GitHub — architecture decision records', url: 'https://adr.github.io' },
        { kind: 'doc', label: 'C4 model — diagramas de arquitectura', url: 'https://c4model.com' },
        { kind: 'doc', label: 'arc42 — plantilla de documentación', url: 'https://arc42.org' },
      ],
    },
    {
      id: 'software-architect/fitness-functions',
      name: 'Fitness functions',
      kind: 'skill',
      area: 'calidad',
      x: 56,
      y: 24,
      weight: 2,
      prereqs: ['software-architect/adrs'],
      keyPoints: [
        'Una fitness function verifica automáticamente una característica arquitectónica: convierte intención en test.',
        'Ejemplos: ciclos de dependencias prohibidos, presupuesto de latencia, ningún import de X en Y.',
        'Ejecuta las que puedas en CI: la arquitectura que no se comprueba se erosiona commit a commit.',
        'Empieza por las tres reglas que más te duelen hoy, no por un framework exhaustivo.',
        'Usa herramientas de test de arquitectura (ArchUnit, dependency-cruiser…) en vez de reviews heroicas.',
      ],
      aiFocus:
        'Cuando gran parte del código lo escriben máquinas, la gobernanza no puede depender de que un humano se fije: las fitness functions son el guardarraíl ejecutable que revisa cada línea, venga de quien venga. Profundiza en codificar tus reglas de arquitectura como tests — es la skill que escala tu criterio.',
      resources: [
        { kind: 'libro', label: 'Building Evolutionary Architectures (Ford, Parsons y Kua)', format: 'papel' },
        { kind: 'doc', label: 'ArchUnit — tests de arquitectura', url: 'https://www.archunit.org' },
      ],
    },
    {
      id: 'software-architect/arquitectura-evolutiva',
      name: 'Arquitectura evolutiva',
      kind: 'skill',
      area: 'calidad',
      x: 32,
      y: 22,
      weight: 2,
      prereqs: ['software-architect/adrs'],
      keyPoints: [
        'Diseña para el cambio, no para el futuro imaginado: YAGNI también aplica a la arquitectura.',
        'Migra con strangler fig: la pieza nueva crece alrededor de la vieja hasta sustituirla, sin big bang.',
        'Cambios incrementales y reversibles: feature flags, expand-contract y despliegues canary.',
        'Gestiona la deuda técnica como cartera: visible, priorizada y con presupuesto recurrente.',
        'Cada época deja sedimento: mantén un mapa honesto de qué partes del sistema son de qué era.',
      ],
      aiFocus:
        'La IA abarata las migraciones mecánicas (reescrituras, cambios de API repetitivos) que antes hacían inviable evolucionar: aprovéchalo para saldar deuda que llevaba años parada. Profundiza en secuenciar la evolución — qué migrar, en qué orden y cómo verificar cada paso — porque el plan sigue siendo tuyo.',
      resources: [
        { kind: 'libro', label: 'Building Evolutionary Architectures (Ford, Parsons y Kua)', format: 'papel' },
        { kind: 'libro', label: 'Working Effectively with Legacy Code (Michael Feathers)', format: 'papel' },
      ],
    },
    {
      id: 'software-architect/observabilidad',
      name: 'Observabilidad',
      kind: 'tech',
      area: 'calidad',
      x: 68,
      y: 30,
      weight: 2,
      prereqs: ['software-architect/sistemas-intensivos-datos'],
      keyPoints: [
        'Tres señales — logs, métricas y trazas — correlacionadas por contexto de petición.',
        'Diseña la observabilidad con el sistema, no después del primer incidente a oscuras.',
        'SLOs y error budgets convierten «va lento» en una conversación con números.',
        'Alertas accionables: si una alerta no exige acción humana, es spam que entrena a ignorar.',
        'Instrumenta también el coste: en la nube, un bug de rendimiento es una factura.',
      ],
      aiFocus:
        'La IA es excelente triando incidentes sobre buena telemetría: resume trazas, correlaciona despliegues y sugiere hipótesis de causa raíz. Sin datos, no hay magia. Profundiza en diseñar qué se instrumenta y con qué contexto — la calidad del diagnóstico asistido depende de la señal que TÚ decidiste emitir.',
      resources: [
        { kind: 'doc', label: 'OpenTelemetry — estándar de observabilidad', url: 'https://opentelemetry.io' },
        { kind: 'libro', label: 'Observability Engineering (Majors, Fong-Jones y Miranda)', format: 'papel' },
      ],
    },

    // ── Plataforma y liderazgo (suroeste-norte) ──────────────────────────────
    {
      id: 'software-architect/platform-engineering',
      name: 'Platform engineering',
      kind: 'tech',
      area: 'plataforma',
      x: 14,
      y: 24,
      weight: 2,
      prereqs: ['software-architect/event-driven'],
      keyPoints: [
        'La plataforma interna es un producto: sus clientes son los equipos y se mide en adopción, no en features.',
        'Golden paths: el camino recomendado (plantillas, CI/CD, despliegue) debe ser el más fácil de seguir.',
        'Autoservicio sobre tickets: si crear un servicio exige abrir tres tickets, la plataforma ha fallado.',
        'Abstrae sin secuestrar: ofrece defaults potentes con puertas de escape documentadas.',
        'Equilibra estandarización y autonomía según la madurez y el tamaño de la organización.',
      ],
      aiFocus:
        'La plataforma es donde el uso de IA se vuelve seguro y repetible: plantillas con guardarraíles, contexto organizacional para los asistentes y verificación automática integrada en el golden path. Profundiza en diseñar la plataforma pensando en que sus usuarios ya no son solo humanos: también agentes que crean y despliegan servicios.',
      resources: [
        { kind: 'libro', label: 'Team Topologies (Skelton y Pais)', format: 'papel' },
        { kind: 'doc', label: 'platformengineering.org — comunidad y recursos', url: 'https://platformengineering.org' },
      ],
    },
    {
      id: 'software-architect/devex',
      name: 'Developer experience',
      kind: 'skill',
      area: 'plataforma',
      x: 22,
      y: 12,
      weight: 2,
      prereqs: ['software-architect/platform-engineering'],
      keyPoints: [
        'DevEx son tres cosas: velocidad de feedback, carga cognitiva y estado de flow — mide las tres.',
        'El build lento y el entorno frágil son impuestos que pagas en cada iteración: priorízalos como features.',
        'Reduce fricción de onboarding: del clone al primer despliegue en menos de un día.',
        'Escucha a los equipos con encuestas y datos de uso: la fricción real rara vez es la que imaginas.',
        'Documentación ejecutable (scripts, devcontainers) envejece mejor que wikis heroicas.',
      ],
      aiFocus:
        'Los bucles de feedback rápidos valen doble con IA: un agente que ejecuta tests en segundos itera solo; uno que espera un build de 20 minutos, no. Profundiza en optimizar el harness de desarrollo — tests, builds y entornos reproducibles son ahora también la experiencia de desarrollo DE la IA.',
      resources: [
        { kind: 'doc', label: 'DX / DORA — investigación sobre developer experience', url: 'https://dora.dev' },
        { kind: 'post', label: 'The Pragmatic Engineer — newsletter', url: 'https://newsletter.pragmaticengineer.com' },
      ],
    },
    {
      id: 'software-architect/liderazgo-tecnico',
      name: 'Liderazgo e influencia',
      kind: 'skill',
      area: 'plataforma',
      x: 10,
      y: 10,
      weight: 2,
      prereqs: ['software-architect/adrs'],
      keyPoints: [
        'El arquitecto lidera sin autoridad: convences con contexto, datos y prototipos, no con jerarquía.',
        'Comunica la misma arquitectura en tres idiomas: negocio, producto e ingeniería.',
        'Mentoriza a los seniors del equipo: escalar tu criterio vale más que escalar tus decisiones.',
        'Facilita las revisiones de diseño para que decida el grupo informado, no el que más grita.',
        'Sé el termostato, no el termómetro: marca el estándar de calidad en vez de solo medirlo.',
      ],
      aiFocus:
        'Tu criterio escala mejor que nunca: escrito en ADRs, guías y reglas, lo consumen personas Y asistentes de código de toda la organización. Profundiza en comunicación asíncrona de calidad — el arquitecto que escribe claro multiplica su influencia sin estar en todas las salas.',
      resources: [
        { kind: 'libro', label: 'Staff Engineer (Will Larson)', format: 'papel' },
        { kind: 'post', label: 'LeadDev — StaffPlus y liderazgo técnico', url: 'https://leaddev.com' },
      ],
    },

    // ── Arquitectura en la era IA (norte-este) ───────────────────────────────
    {
      id: 'software-architect/disenar-con-llms',
      name: 'Diseñar sistemas con LLMs',
      kind: 'skill',
      area: 'arquitectura-ia',
      x: 46,
      y: 12,
      weight: 3,
      prereqs: ['software-architect/apis-y-contratos'],
      keyPoints: [
        'Trata el LLM como un componente no determinista: latencia variable, salida probabilística, coste por token.',
        'Diseña el contorno: validación de salidas, fallbacks, timeouts y humanos en el loop donde el error duele.',
        'Conoce los patrones — RAG, tool use, agentes, cachés semánticas — y cuándo NO usar un LLM.',
        'Evalúa como parte del sistema: golden sets y evals automáticas en CI, no «parece que responde bien».',
        'Seguridad específica: prompt injection, fuga de datos al contexto y permisos de las herramientas del agente.',
      ],
      aiFocus:
        'Integrar LLMs es el nuevo examen de arquitectura: todo lo aprendido (trade-offs, contratos, fallos parciales) aplicado a un componente que además alucina. Profundiza en diseñar la verificación alrededor del modelo — el sistema es tan fiable como el contorno que tú construyes, no como la demo del modelo.',
      resources: [
        { kind: 'doc', label: 'OWASP Top 10 para aplicaciones LLM', url: 'https://owasp.org/www-project-top-10-for-large-language-model-applications/' },
        { kind: 'post', label: 'Simon Willison — IA aplicada al desarrollo', url: 'https://simonwillison.net' },
        { kind: 'doc', label: 'roadmap.sh — AI Engineer', url: 'https://roadmap.sh/ai-engineer' },
      ],
    },
    {
      id: 'software-architect/revisar-arquitecturas-ia',
      name: 'Revisar diseño generado por IA',
      kind: 'skill',
      area: 'arquitectura-ia',
      x: 60,
      y: 10,
      weight: 2,
      prereqs: ['software-architect/disenar-con-llms'],
      keyPoints: [
        'La IA propone arquitecturas plausibles y genéricas: revisa contra TU contexto, no contra el manual.',
        'Busca sus sesgos típicos: sobreingeniería, tecnología de moda y componentes que nadie pidió.',
        'Exige el porqué de cada pieza: si una caja del diagrama no defiende su existencia, fuera.',
        'Verifica los números: capacidades, límites y costes que cita un modelo se comprueban siempre.',
        'Usa a la IA como abogado del diablo de tu propio diseño: pídele que lo ataque antes que producción.',
      ],
      aiFocus:
        'Revisar diseños generados es distinto de revisarlos humanos: no hay autor a quien preguntar la intención, solo texto convincente. Profundiza en interrogar diseños sistemáticamente — escenarios de fallo, límites de escala, coste total — hasta que el diagrama confiese lo que no aguanta.',
      resources: [
        { kind: 'libro', label: 'The Software Architect Elevator (Gregor Hohpe)', format: 'papel' },
        { kind: 'post', label: 'martinfowler.com — arquitectura de software', url: 'https://martinfowler.com' },
      ],
    },
    {
      id: 'software-architect/coste-y-riesgo-llm',
      name: 'Coste, riesgo y gobernanza de IA',
      kind: 'skill',
      area: 'arquitectura-ia',
      x: 74,
      y: 16,
      weight: 2,
      prereqs: ['software-architect/disenar-con-llms'],
      keyPoints: [
        'El coste por token es una decisión de arquitectura: caché, modelos por tier y presupuestos por feature.',
        'Decide qué datos pueden salir hacia qué modelos: clasificación de datos antes que integración.',
        'Evita el lock-in casual: abstrae el proveedor de modelo como abstraes cualquier vendor crítico.',
        'Degradación elegante: qué hace tu producto cuando el modelo está caído, lento o desafinado.',
        'Cumple el marco regulatorio de tu sector (privacidad, IA Act): la gobernanza también se diseña.',
      ],
      aiFocus:
        'Un LLM en producción es un centro de coste y un vector de riesgo que escala con el éxito del producto: la factura y la superficie de ataque crecen con cada usuario. Profundiza en FinOps y gobernanza de modelos — el arquitecto responde por el sistema también cuando el componente es una API de IA ajena.',
      resources: [
        { kind: 'doc', label: 'FinOps Foundation — gestión de coste cloud', url: 'https://www.finops.org' },
        { kind: 'doc', label: 'NIST AI Risk Management Framework', url: 'https://www.nist.gov/itl/ai-risk-management-framework' },
      ],
    },
    {
      id: 'software-architect/arquitecto-era-ia',
      name: 'Arquitecto de la era IA',
      kind: 'milestone',
      area: 'arquitectura-ia',
      x: 88,
      y: 24,
      weight: 3,
      prereqs: ['software-architect/revisar-arquitecturas-ia', 'software-architect/fitness-functions'],
      keyPoints: [
        'Diseñas sistemas donde humanos e IA producen código dentro de límites verificados automáticamente.',
        'Tus decisiones viven por escrito (ADRs, contratos, fitness functions) y las consumen personas y agentes.',
        'Evalúas cualquier componente — incluido un LLM — por sus trade-offs, garantías y coste total.',
        'Tu arquitectura evoluciona en pasos reversibles y tu sistema cuenta su estado (observabilidad).',
        'Multiplicas criterio: los equipos deciden bien sin ti porque los límites y el porqué están claros.',
      ],
      aiFocus:
        'El milestone del arquitecto: un sistema que se mantiene sano aunque la mayoría del código lo generen máquinas, porque la estructura, la verificación y las decisiones son tuyas. Profundiza sin miedo — cuanto más barata la implementación, más cara y valiosa es la buena arquitectura.',
      resources: [
        { kind: 'libro', label: 'Fundamentals of Software Architecture (Richards y Ford)', format: 'papel' },
        { kind: 'libro', label: 'Designing Data-Intensive Applications (Martin Kleppmann)', format: 'papel' },
      ],
    },
  ],
};
