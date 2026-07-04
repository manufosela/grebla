/**
 * Isla «iOS» (doc /careerMap/ios) — contenido curado MC-16, oleada 2.
 *
 * Sigue la convención de contenido de islas (ver cabecera de ./bases.js):
 * ids de ciudad prefijados 'ios/', prereqs internos sin ciclos, posiciones
 * 0..100 separadas, pesos 1..3 y contenido en español con lente era-IA.
 * Referencia temática: roadmap.sh/ios, adaptado — la IA escribe Swift y
 * SwiftUI con soltura; el mapa pone el peso en concurrencia, datos, el
 * proceso de release de Apple y el criterio para revisar lo generado.
 *
 * @typedef {import('../../domain/types.js').CareerMap} CareerMap
 */

/** @type {CareerMap} */
export const IOS_ISLAND = {
  id: 'ios',
  name: 'Isla iOS',
  startPort: { x: 50, y: 88 },
  areas: [
    { id: 'entorno', name: 'Lenguaje y entorno' },
    { id: 'ui', name: 'UI con SwiftUI' },
    { id: 'arquitectura', name: 'Arquitectura y testing' },
    { id: 'datos', name: 'Datos y red' },
    { id: 'release', name: 'Release y rendimiento' },
    { id: 'ia', name: 'iOS con IA' },
  ],
  cities: [
    // ── Lenguaje y entorno (sur, comarca de entrada) ────────────────────────
    {
      id: 'ios/swift',
      name: 'Swift',
      kind: 'tech',
      area: 'entorno',
      x: 54,
      y: 76,
      weight: 3,
      prereqs: [],
      keyPoints: [
        'Optionals a fondo: if let, guard let y por qué el force unwrap (!) es una alarma.',
        'Value types primero: structs y enums con valores asociados para modelar estados sin casos imposibles.',
        'Protocolos y extensiones: el estilo de diseño idiomático de Swift.',
        'Closures, genéricos básicos y manejo de errores con throws/Result.',
        'ARC e inmutabilidad: let por defecto, referencias débiles donde toca.',
      ],
      aiFocus:
        'La IA escribe Swift correcto y moderno casi siempre, pero mezcla épocas: completion handlers donde ya hay async/await, clases donde bastaba un struct. Profundiza en el sistema de tipos (optionals, value types, protocolos): es tu vara para medir si lo generado modela bien o solo compila.',
      resources: [
        { kind: 'libro', label: 'The Swift Programming Language (Apple)', url: 'https://docs.swift.org/swift-book/', format: 'online' },
        { kind: 'doc', label: 'Swift.org — sitio oficial', url: 'https://www.swift.org' },
        { kind: 'curso', label: 'Hacking with Swift (Paul Hudson)', url: 'https://www.hackingwithswift.com' },
      ],
    },
    {
      id: 'ios/xcode',
      name: 'Xcode y simulador',
      kind: 'tech',
      area: 'entorno',
      x: 42,
      y: 76,
      weight: 2,
      prereqs: [],
      keyPoints: [
        'Anatomía del proyecto: targets, schemes, Info.plist y configuraciones de build.',
        'Simulador y dispositivo real: cuándo usar cada uno y qué solo se prueba en hardware.',
        'Depurador y consola: breakpoints, LLDB básico, view hierarchy debugger.',
        'Previews de SwiftUI: iterar la UI sin lanzar el simulador.',
        'Atajos y navegación: saltar a definición, buscar en el proyecto, refactors del IDE.',
      ],
      aiFocus:
        'La IA explica cualquier error críptico de Xcode (firmas, provisioning, builds) mejor que Stack Overflow, pero no puede pulsar los botones por ti: aprende dónde vive cada ajuste. Profundiza en el depurador y el view hierarchy: son la evidencia real contra la que contrastar sus hipótesis.',
      resources: [
        { kind: 'doc', label: 'Xcode — página oficial', url: 'https://developer.apple.com/xcode/' },
        { kind: 'doc', label: 'Documentación de Xcode', url: 'https://developer.apple.com/documentation/xcode' },
      ],
    },
    {
      id: 'ios/spm',
      name: 'Swift Package Manager',
      kind: 'tech',
      area: 'entorno',
      x: 66,
      y: 76,
      weight: 1,
      prereqs: ['ios/xcode'],
      keyPoints: [
        'Añadir dependencias: versionado semántico, resolución y el Package.resolved en git.',
        'Crear tu propio paquete: Package.swift, targets y productos.',
        'Dependencias con criterio: cada paquete es código ajeno que mantener y auditar.',
        'Paquetes locales como semilla de modularización del proyecto.',
      ],
      aiFocus:
        'La IA sugiere paquetes para todo, incluidos los abandonados o innecesarios: media comunidad iOS resuelve con Foundation lo que otros importan. Profundiza en evaluar dependencias — mantenimiento, tamaño, alternativa nativa — antes de aceptar el import que te propone.',
      resources: [
        { kind: 'doc', label: 'Swift Package Manager (Swift.org)', url: 'https://www.swift.org/documentation/package-manager/' },
        { kind: 'post', label: 'Swift by Sundell', url: 'https://www.swiftbysundell.com' },
      ],
    },
    {
      id: 'ios/concurrencia',
      name: 'Concurrencia con async/await',
      kind: 'tech',
      area: 'entorno',
      x: 54,
      y: 66,
      weight: 3,
      prereqs: ['ios/swift'],
      keyPoints: [
        'async/await y Task: structured concurrency, cancelación y jerarquía de tareas.',
        'Actors y @MainActor: quién puede tocar qué, y por qué la UI vive en el main.',
        'Sendable y el chequeo estricto: los data races se cazan en compilación, no en producción.',
        'AsyncSequence para streams de valores; puentes desde APIs con callbacks.',
        'Errores y timeouts en código asíncrono: cancelar bien es parte del contrato.',
      ],
      aiFocus:
        'El modelo mezcla tres eras de concurrencia iOS — GCD, Combine y async/await — a veces en la misma función. Profundiza en structured concurrency y en los errores de aislamiento de actores: entender qué exige el compilador es lo que te permite arreglar lo generado en vez de pelearte con él.',
      resources: [
        { kind: 'doc', label: 'Concurrencia en Swift — documentación', url: 'https://developer.apple.com/documentation/swift' },
        { kind: 'post', label: 'Swift by Sundell — concurrencia', url: 'https://www.swiftbysundell.com' },
      ],
    },
    {
      id: 'ios/ciclo-vida-app',
      name: 'Ciclo de vida de la app',
      kind: 'tech',
      area: 'entorno',
      x: 66,
      y: 66,
      weight: 2,
      prereqs: ['ios/swift'],
      keyPoints: [
        'Estados de la app: activa, inactiva, en background, suspendida — y qué puedes hacer en cada uno.',
        'ScenePhase en SwiftUI: reaccionar a ir a background sin AppDelegate.',
        'El sistema suspende y mata: guarda estado al salir, restáuralo al volver.',
        'Background tasks: lo poco que iOS permite en segundo plano y cómo pedirlo bien.',
        'Notificaciones push y locales como puntos de entrada a la app.',
      ],
      aiFocus:
        'La IA genera apps que funcionan mientras están en primer plano; los bugs de suspensión, restauración de estado y background son los que no ve porque no ejecuta. Profundiza en el ciclo de vida real de iOS — es el contexto de plataforma que convierte tu revisión en algo que el modelo no puede hacer.',
      resources: [
        { kind: 'doc', label: 'Documentación de Apple Developer', url: 'https://developer.apple.com/documentation/' },
        { kind: 'post', label: 'Hacking with Swift — artículos', url: 'https://www.hackingwithswift.com/articles' },
      ],
    },

    // ── UI con SwiftUI (este) ───────────────────────────────────────────────
    {
      id: 'ios/swiftui',
      name: 'SwiftUI',
      kind: 'tech',
      area: 'ui',
      x: 78,
      y: 66,
      weight: 3,
      prereqs: ['ios/swift'],
      keyPoints: [
        'UI declarativa: la vista es función del estado; modificas datos, no vistas.',
        'Layout con VStack, HStack, ZStack, List y los modifiers esenciales.',
        'El orden de los modifiers importa: cada uno envuelve a la vista anterior.',
        'Previews con estados variados: cargando, vacío, error, texto largo.',
        'Animaciones básicas: withAnimation y transiciones sin tocar Core Animation.',
      ],
      aiFocus:
        'SwiftUI es donde la IA más produce: describe la pantalla y aparece. Su firma son vistas monolíticas de 200 líneas y modifiers en orden erróneo que «casi» se ven bien. Profundiza en descomponer vistas y en el sistema de layout: dirigir con vocabulario preciso rinde más que iterar a ciegas.',
      resources: [
        { kind: 'doc', label: 'SwiftUI — documentación oficial', url: 'https://developer.apple.com/documentation/swiftui' },
        { kind: 'curso', label: 'SwiftUI Tutorials (Apple)', url: 'https://developer.apple.com/tutorials/swiftui' },
        { kind: 'curso', label: '100 Days of SwiftUI (Hacking with Swift)', url: 'https://www.hackingwithswift.com/100/swiftui' },
      ],
    },
    {
      id: 'ios/estado-swiftui',
      name: 'Estado y flujo de datos',
      kind: 'skill',
      area: 'ui',
      x: 78,
      y: 56,
      weight: 3,
      prereqs: ['ios/swiftui'],
      keyPoints: [
        '@State para estado local y efímero; @Binding para compartirlo hacia abajo.',
        '@Observable y el framework Observation: modelos que la vista observa con precisión.',
        'Environment para dependencias transversales: tema, servicios, configuración.',
        'El dueño del estado: súbelo al ancestro común mínimo, ni más arriba ni más abajo.',
        'Fuente única de verdad: estado duplicado entre vistas es un bug esperando fecha.',
      ],
      aiFocus:
        'Los property wrappers son la zona donde el modelo más confunde épocas: @ObservedObject donde va @Observable, @State para lo que debía ser @Binding. Profundiza en el flujo de datos de SwiftUI — quién posee cada estado y quién lo observa — para corregir de un vistazo lo que la IA reparte al azar.',
      resources: [
        { kind: 'doc', label: 'SwiftUI — documentación oficial', url: 'https://developer.apple.com/documentation/swiftui' },
        { kind: 'post', label: 'Swift with Majid — SwiftUI', url: 'https://swiftwithmajid.com' },
      ],
    },
    {
      id: 'ios/navegacion',
      name: 'Navegación',
      kind: 'tech',
      area: 'ui',
      x: 90,
      y: 56,
      weight: 2,
      prereqs: ['ios/swiftui'],
      keyPoints: [
        'NavigationStack y rutas tipadas: el path como estado navegable y restaurable.',
        'Presentaciones: sheets, fullScreenCover, alerts y confirmationDialogs con su semántica.',
        'TabView y navegación anidada sin duplicar stacks.',
        'Deep links y universal links: entrar a cualquier pantalla desde fuera de la app.',
        'La navegación es estado: se decide en el modelo, la vista solo la pinta.',
      ],
      aiFocus:
        'La IA todavía propone NavigationView deprecado y APIs de navegación de hace tres iOS: es de lo más caducado de su entrenamiento. Profundiza en NavigationStack y en modelar la navegación como estado — así detectas al vuelo cuándo te está colando el patrón viejo.',
      resources: [
        { kind: 'doc', label: 'Human Interface Guidelines (Apple)', url: 'https://developer.apple.com/design/human-interface-guidelines' },
        { kind: 'post', label: 'Hacking with Swift — artículos', url: 'https://www.hackingwithswift.com/articles' },
      ],
    },
    {
      id: 'ios/uikit-interop',
      name: 'UIKit e interoperabilidad',
      kind: 'tech',
      area: 'ui',
      x: 90,
      y: 66,
      weight: 2,
      prereqs: ['ios/swiftui'],
      keyPoints: [
        'UIKit sigue vivo: casi todo proyecto real tiene capas de UIViewController.',
        'UIViewRepresentable y UIHostingController: los dos puentes entre mundos.',
        'Ciclo de vida de UIKit (viewDidLoad, viewWillAppear) para leer código existente.',
        'Cuándo bajar a UIKit: controles que SwiftUI aún no cubre, rendimiento fino en listas.',
        'Auto Layout básico: suficiente para tocar pantallas legacy sin romperlas.',
      ],
      aiFocus:
        'El corpus de UIKit es enorme, así que la IA lo domina — y por eso mismo te lo ofrece cuando SwiftUI ya tiene solución nativa. Profundiza en los puentes entre frameworks y en decidir el lado correcto de cada pantalla: en las bases de código mixtas es donde más criterio hace falta.',
      resources: [
        { kind: 'doc', label: 'UIKit — documentación oficial', url: 'https://developer.apple.com/documentation/uikit' },
        { kind: 'post', label: 'objc.io — artículos y libros', url: 'https://www.objc.io' },
      ],
    },
    {
      id: 'ios/accesibilidad',
      name: 'Accesibilidad',
      kind: 'skill',
      area: 'ui',
      x: 90,
      y: 46,
      weight: 2,
      prereqs: ['ios/swiftui'],
      keyPoints: [
        'VoiceOver: recorre tu app sin mirar la pantalla al menos una vez por release.',
        'Labels, hints y traits en SwiftUI: describir lo que importa, silenciar lo decorativo.',
        'Dynamic Type: tu layout debe sobrevivir a la letra gigante sin cortar textos.',
        'Contraste, Reduce Motion y transparencias: respeta los ajustes del sistema.',
        'La accesibilidad pesa en la review de Apple y en las valoraciones: es calidad, no extra.',
      ],
      aiFocus:
        'La IA añade accessibilityLabel de compromiso que pasan el linter y no ayudan a nadie. Profundiza en probar con VoiceOver y Dynamic Type reales: la experiencia de un usuario con discapacidad visual no se verifica leyendo el diff, solo usándola — y ese hábito no se delega.',
      resources: [
        { kind: 'doc', label: 'Accesibilidad — Apple Developer', url: 'https://developer.apple.com/accessibility/' },
        { kind: 'doc', label: 'Human Interface Guidelines (Apple)', url: 'https://developer.apple.com/design/human-interface-guidelines' },
      ],
    },

    // ── Arquitectura y testing (centro) ─────────────────────────────────────
    {
      id: 'ios/arquitectura-mvvm',
      name: 'Arquitectura y MVVM',
      kind: 'skill',
      area: 'arquitectura',
      x: 66,
      y: 46,
      weight: 3,
      prereqs: ['ios/estado-swiftui', 'ios/ciclo-vida-app'],
      keyPoints: [
        'Capas con frontera: vista, modelo observable y servicios/repositorios detrás de protocolos.',
        'El estado de pantalla como tipo: cargando, datos y error en un enum, sin flags sueltos.',
        'Dependencias inyectadas por init o Environment: nada de singletons a mano por todas partes.',
        'SwiftUI ya trae parte del patrón: no calques el MVVM de otras plataformas sin adaptarlo.',
        'Consistencia sobre pureza: el mejor patrón es el que todo el equipo aplica igual.',
      ],
      aiFocus:
        'Pídele una feature sin contexto y la IA meterá la llamada de red en la vista o inventará un ViewModel por pantalla aunque sobre. Profundiza en definir y documentar TU arquitectura: con las fronteras explícitas en el proyecto, lo generado cae en su sitio y lo desviado canta a la primera lectura.',
      resources: [
        { kind: 'post', label: 'Swift with Majid — arquitectura SwiftUI', url: 'https://swiftwithmajid.com' },
        { kind: 'libro', label: 'Thinking in SwiftUI (objc.io)', url: 'https://www.objc.io', format: 'online' },
        { kind: 'doc', label: 'roadmap.sh — iOS', url: 'https://roadmap.sh/ios' },
      ],
    },
    {
      id: 'ios/testing',
      name: 'Testing en iOS',
      kind: 'skill',
      area: 'arquitectura',
      x: 54,
      y: 46,
      weight: 3,
      prereqs: ['ios/arquitectura-mvvm'],
      keyPoints: [
        'Tests unitarios de modelos y servicios con Swift Testing o XCTest: rápidos y sin simulador.',
        'Testear async/await: expectativas, tiempo controlado y cancelación.',
        'Dobles en la frontera: protocolos + fakes de servicio mejor que mocks de media app.',
        'UI tests con criterio: pocos, sobre flujos críticos, porque son lentos y frágiles.',
        'Si cuesta testear, el diseño avisa: la testabilidad es feedback de arquitectura.',
      ],
      aiFocus:
        'La IA genera la suite entera de tu servicio en un minuto — incluidos tests acoplados a la implementación que estallan con cada refactor y asserts que no comprueban nada. Tú decides qué comportamiento merece test y detectas los vacíos. Profundiza en diseñar casos: son tu red frente al propio código generado.',
      resources: [
        { kind: 'doc', label: 'XCTest — documentación', url: 'https://developer.apple.com/documentation/xctest' },
        { kind: 'curso', label: 'Hacking with Swift — testing', url: 'https://www.hackingwithswift.com' },
      ],
    },
    {
      id: 'ios/modularizacion',
      name: 'Modularización',
      kind: 'skill',
      area: 'arquitectura',
      x: 42,
      y: 46,
      weight: 1,
      prereqs: ['ios/arquitectura-mvvm', 'ios/spm'],
      keyPoints: [
        'Paquetes SPM locales para cortar el proyecto: features, core, diseño.',
        'Reglas de dependencia: las features no se conocen entre sí, todas conocen core.',
        'Qué gana el equipo: builds más rápidas, previews aisladas, fronteras que el compilador vigila.',
        'El coste real: más Package.swift que mantener; no trocees una app de dos pantallas.',
      ],
      aiFocus:
        'La IA replica la estructura de paquetes que encuentre, pero decidir los cortes (por feature, por capa, cuándo) es una decisión de coste de cambio alto que te pertenece. Profundiza en fronteras: un módulo bien cortado también limita el radio de acción de un agente que edita por ti.',
      resources: [
        { kind: 'doc', label: 'Swift Package Manager (Swift.org)', url: 'https://www.swift.org/documentation/package-manager/' },
        { kind: 'post', label: 'Swift by Sundell', url: 'https://www.swiftbysundell.com' },
      ],
    },

    // ── Datos y red (oeste) ─────────────────────────────────────────────────
    {
      id: 'ios/redes',
      name: 'Red y APIs',
      kind: 'tech',
      area: 'datos',
      x: 30,
      y: 66,
      weight: 3,
      prereqs: ['ios/concurrencia'],
      keyPoints: [
        'URLSession con async/await: peticiones, subidas y descargas sin dependencias externas.',
        'Codable a fondo: keys personalizadas, fechas, valores opcionales y decodificación tolerante.',
        'El móvil vive sin red: timeouts, reintentos con backoff y errores tipados por caso.',
        'Mapea DTOs a modelos de dominio en la frontera: el JSON del backend no manda en tu app.',
        'Inspecciona el tráfico real (proxy o Instruments) antes de culpar al backend.',
      ],
      aiFocus:
        'Dale el JSON a la IA y te devuelve los Codable y el cliente entero: trabajo mecánico puro. Lo que no conoce es cómo falla TU red — metro, modo avión, backends que devuelven null donde prometían valor. Profundiza en la política de errores y reintentos: es decisión de producto, no de sintaxis.',
      resources: [
        { kind: 'doc', label: 'URLSession — documentación', url: 'https://developer.apple.com/documentation/foundation/urlsession' },
        { kind: 'post', label: 'Swift by Sundell — redes y Codable', url: 'https://www.swiftbysundell.com' },
      ],
    },
    {
      id: 'ios/swiftdata',
      name: 'SwiftData y persistencia',
      kind: 'tech',
      area: 'datos',
      x: 30,
      y: 56,
      weight: 3,
      prereqs: ['ios/concurrencia'],
      keyPoints: [
        'SwiftData: @Model, queries y su integración natural con SwiftUI.',
        'Core Data sigue ahí: léelo en proyectos existentes y conoce la relación entre ambos.',
        'Migraciones de esquema versionadas: una migración rota borra los datos del usuario.',
        'Qué va en cada sitio: UserDefaults para preferencias, Keychain para secretos, base de datos para lo demás.',
        'Offline-first: lo local como fuente de verdad; la red solo sincroniza.',
      ],
      aiFocus:
        'SwiftData es reciente y Core Data inmenso: la IA los mezcla o te da la API que ya cambió. Verifica cada snippet contra la doc de TU versión mínima de iOS. Profundiza en modelado y migraciones: el esquema que tus usuarios llevan instalado es un contrato que el modelo no conoce.',
      resources: [
        { kind: 'doc', label: 'SwiftData — documentación', url: 'https://developer.apple.com/documentation/swiftdata' },
        { kind: 'doc', label: 'Core Data — documentación', url: 'https://developer.apple.com/documentation/coredata' },
        { kind: 'curso', label: 'Hacking with Swift — persistencia', url: 'https://www.hackingwithswift.com' },
      ],
    },

    // ── Release y rendimiento (norte) ───────────────────────────────────────
    {
      id: 'ios/instruments',
      name: 'Instruments y rendimiento',
      kind: 'tech',
      area: 'release',
      x: 42,
      y: 36,
      weight: 2,
      prereqs: ['ios/arquitectura-mvvm'],
      keyPoints: [
        'Mide antes de tocar: Time Profiler para CPU, Allocations y Leaks para memoria.',
        'Hangs y scroll: detectar trabajo en el main thread que congela la UI.',
        'Ciclos de retención: el memory leak clásico de closures que capturan self.',
        'Arranque en frío: qué corre antes del primer frame y qué puede esperar.',
        'Perfila en dispositivo real y build de release: el simulador miente sobre rendimiento.',
      ],
      aiFocus:
        'La IA propone optimizaciones plausibles sin haber medido tu app, y optimizar sin medir es superstición. Tu flujo: traza con Instruments, localiza el cuello real y entonces pide el arreglo concreto. Profundiza en leer trazas y grafos de memoria — la evidencia manda sobre las corazonadas del modelo.',
      resources: [
        { kind: 'doc', label: 'Xcode e Instruments — documentación', url: 'https://developer.apple.com/documentation/xcode' },
        { kind: 'curso', label: 'WWDC — vídeos de sesiones (Apple)', url: 'https://developer.apple.com/videos/' },
      ],
    },
    {
      id: 'ios/firmas-certificados',
      name: 'Firmas y provisioning',
      kind: 'tech',
      area: 'release',
      x: 54,
      y: 36,
      weight: 2,
      prereqs: ['ios/xcode'],
      keyPoints: [
        'El triángulo: certificados, identificadores y provisioning profiles — qué firma qué.',
        'Cuenta del Apple Developer Program: roles, dispositivos de prueba y renovaciones anuales.',
        'Firma automática vs manual: cuándo dejar que Xcode gestione y cuándo tomar el control.',
        'Entitlements y capabilities: push, App Groups, Keychain compartido.',
        'Los errores de firma se leen: aprende a interpretar el mensaje antes de borrar certificados a lo loco.',
      ],
      aiFocus:
        'Las firmas son el purgatorio de iOS y la IA es un buen guía para descifrar cada error, pero los certificados y accesos son responsabilidad tuya: revocar el equivocado rompe la app de todo el equipo. Profundiza en el modelo (quién firma qué y por qué) para no aplicar recetas destructivas a ciegas.',
      resources: [
        { kind: 'doc', label: 'Apple Developer Program', url: 'https://developer.apple.com/programs/' },
        { kind: 'doc', label: 'Documentación de Xcode — firmas', url: 'https://developer.apple.com/documentation/xcode' },
      ],
    },
    {
      id: 'ios/testflight',
      name: 'TestFlight y App Store',
      kind: 'tech',
      area: 'release',
      x: 66,
      y: 36,
      weight: 3,
      prereqs: ['ios/firmas-certificados', 'ios/testing'],
      keyPoints: [
        'TestFlight: builds internas y externas, grupos de testers y feedback integrado.',
        'App Store Connect: ficha, capturas, metadatos y privacy nutrition labels.',
        'Las review guidelines de Apple: léelas antes de diseñar, no después del rechazo.',
        'Versionado y build numbers: qué exige Apple en cada subida.',
        'La revisión tarda y a veces rechaza: planifica releases con margen y plan B.',
      ],
      aiFocus:
        'La IA redacta la ficha, las notas de versión y hasta la respuesta al rechazo de Apple, pero no conoce las guidelines vigentes ni la jurisprudencia real del review. Profundiza en el proceso completo — hazlo a mano al menos una vez — y verifica contra la doc actual todo lo que el modelo afirme sobre políticas.',
      resources: [
        { kind: 'doc', label: 'TestFlight — página oficial', url: 'https://developer.apple.com/testflight/' },
        { kind: 'doc', label: 'App Store Review Guidelines', url: 'https://developer.apple.com/app-store/review/guidelines/' },
      ],
    },
    {
      id: 'ios/crash-observabilidad',
      name: 'Crashes y observabilidad',
      kind: 'skill',
      area: 'release',
      x: 78,
      y: 36,
      weight: 2,
      prereqs: ['ios/testflight'],
      keyPoints: [
        'Crash reporting desde el primer release: Xcode Organizer, MetricKit o un tercero.',
        'Symbolication: sin los dSYM subidos, las trazas son ruido ilegible.',
        'MetricKit: hangs, consumo de batería y métricas de arranque de usuarios reales.',
        'Agrupa y prioriza: el crash del 2% de sesiones antes que el exótico de un modelo de iPhone.',
        'Logs con criterio: contexto para reproducir, jamás datos personales.',
      ],
      aiFocus:
        'Pega una traza simbolicada a la IA y tendrás hipótesis ordenadas al momento — con evidencia de calidad, no antes. Profundiza en montar el circuito (dSYMs, MetricKit, alertas): la IA razona sobre los datos que tú captures de producción; sin ellos, solo especula contigo.',
      resources: [
        { kind: 'doc', label: 'MetricKit — documentación', url: 'https://developer.apple.com/documentation/metrickit' },
        { kind: 'doc', label: 'Firebase Crashlytics — documentación', url: 'https://firebase.google.com/docs/crashlytics' },
      ],
    },
    {
      id: 'ios/app-en-store',
      name: 'App en la App Store',
      kind: 'milestone',
      area: 'release',
      x: 54,
      y: 26,
      weight: 3,
      prereqs: ['ios/testflight', 'ios/redes', 'ios/swiftdata', 'ios/instruments'],
      keyPoints: [
        'Cierra el ciclo: idea → app → review de Apple → usuarios reales → siguiente versión.',
        'Mantener es el examen de verdad: cada iOS nuevo rompe algo; cada abril, requisitos nuevos.',
        'Lee producción antes de decidir: crashes, reviews y métricas mandan sobre la intuición.',
        'Releases pequeños y regulares ganan al release épico semestral.',
      ],
      aiFocus:
        'Con IA, el prototipo de una app iOS sale en un fin de semana; pasar la review de Apple y sostener releases durante años es lo que te hace profesional de la plataforma. Profundiza en el ciclo completo — publicar, medir, iterar — porque el criterio de «esto está listo para la Store» no se delega.',
      resources: [
        { kind: 'doc', label: 'roadmap.sh — iOS', url: 'https://roadmap.sh/ios' },
        { kind: 'doc', label: 'App Store — recursos para developers', url: 'https://developer.apple.com/app-store/' },
      ],
    },

    // ── iOS con IA (oeste) ──────────────────────────────────────────────────
    {
      id: 'ios/ia-flujo-trabajo',
      name: 'Desarrollar iOS con IA',
      kind: 'skill',
      area: 'ia',
      x: 18,
      y: 56,
      weight: 2,
      prereqs: ['ios/arquitectura-mvvm'],
      keyPoints: [
        'Asistentes con contexto del proyecto: arquitectura, convenciones y versión mínima de iOS en las reglas.',
        'Genera vistas SwiftUI y tests como borrador; revisa estado, concurrencia y ciclo de vida a mano.',
        'Pide siempre la versión objetivo: «iOS 17+, Observation, NavigationStack» filtra el código de eras pasadas.',
        'Úsala para migrar (UIKit a SwiftUI, Combine a async/await) con diffs pequeños y tests vigilando.',
        'Las APIs de Apple cambian cada junio: contrasta lo generado con la doc y las sesiones de la WWDC.',
      ],
      aiFocus:
        'En iOS el modelo arrastra más código antiguo que en ninguna otra plataforma: sin versión objetivo en el prompt te dará patrones de hace tres sistemas. Profundiza en fijar contexto (target, frameworks, arquitectura) y en oler API deprecada a primera vista — es tu filtro diario.',
      resources: [
        { kind: 'doc', label: 'Prompt Engineering Guide', url: 'https://www.promptingguide.ai' },
        { kind: 'post', label: 'Swift by Sundell', url: 'https://www.swiftbysundell.com' },
      ],
    },
    {
      id: 'ios/ml-on-device',
      name: 'IA en el dispositivo',
      kind: 'tech',
      area: 'ia',
      x: 18,
      y: 46,
      weight: 2,
      prereqs: ['ios/ia-flujo-trabajo'],
      keyPoints: [
        'On-device vs nube: privacidad, latencia y coste deciden dónde corre cada inferencia.',
        'Core ML y Vision para lo resuelto: OCR, clasificación, detección sin entrenar nada.',
        'Modelos del sistema (Apple Intelligence y frameworks asociados) y sus requisitos de hardware.',
        'Diseña la degradación: qué hace tu app en dispositivos sin soporte o sin red.',
        'Mide el impacto: tamaño de la app, memoria y batería de cada modelo que embarques.',
      ],
      aiFocus:
        'Aquí no usas IA para programar: la embarcas como funcionalidad, y las preguntas cambian — privacidad de los datos del usuario (el argumento central de Apple), tamaño del modelo, comportamiento sin red. Profundiza en decidir on-device vs nube por caso de uso: es decisión de producto, no de moda.',
      resources: [
        { kind: 'doc', label: 'Core ML — documentación', url: 'https://developer.apple.com/documentation/coreml' },
        { kind: 'doc', label: 'Machine Learning — Apple Developer', url: 'https://developer.apple.com/machine-learning/' },
      ],
    },
  ],
};
