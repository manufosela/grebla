/**
 * Isla «Android» (doc /careerMap/android) — contenido curado MC-16, oleada 2.
 *
 * Sigue la convención de contenido de islas (ver cabecera de ./bases.js):
 * ids de ciudad prefijados 'android/', prereqs internos sin ciclos, posiciones
 * 0..100 separadas, pesos 1..3 y contenido en español con lente era-IA.
 * Referencia temática: roadmap.sh/android, adaptado — la IA genera el
 * boilerplate de Kotlin y Compose; el mapa pone el peso en el ciclo de vida,
 * la arquitectura, el release y el criterio para revisar lo generado.
 *
 * @typedef {import('../../domain/types.js').CareerMap} CareerMap
 */

/** @type {CareerMap} */
export const ANDROID_ISLAND = {
  id: 'android',
  name: 'Isla Android',
  startPort: { x: 50, y: 88 },
  areas: [
    { id: 'entorno', name: 'Lenguaje y entorno' },
    { id: 'ui', name: 'UI con Compose' },
    { id: 'arquitectura', name: 'Arquitectura' },
    { id: 'datos', name: 'Datos y red' },
    { id: 'release', name: 'Release y calidad' },
    { id: 'ia', name: 'Android con IA' },
  ],
  cities: [
    // ── Lenguaje y entorno (sur, comarca de entrada) ────────────────────────
    {
      id: 'android/kotlin',
      name: 'Kotlin idiomático',
      kind: 'tech',
      area: 'entorno',
      x: 42,
      y: 76,
      weight: 3,
      prereqs: [],
      keyPoints: [
        'Null-safety de verdad: tipos anulables, ?. y ?:, y por qué !! es una alarma en el code review.',
        'Data classes, sealed classes y enums para modelar estados sin casos imposibles.',
        'Colecciones con map/filter/groupBy y lambdas: el estilo funcional que verás en cualquier codebase.',
        'Funciones de extensión y scope functions (let, apply, run) con criterio, no por moda.',
        'Inmutabilidad por defecto: val sobre var, listas de solo lectura.',
      ],
      aiFocus:
        'La IA traduce Java a Kotlin y genera funciones idiomáticas al instante, pero tiende a abusar de scope functions y cadenas ilegibles. Profundiza en el sistema de tipos (nulabilidad, sealed): es lo que te permite juzgar si el código generado modela bien los estados o solo compila.',
      resources: [
        { kind: 'doc', label: 'Kotlin — documentación oficial', url: 'https://kotlinlang.org' },
        { kind: 'libro', label: 'Kotlin in Action (Jemerov e Isakova)', format: 'papel' },
        { kind: 'doc', label: 'roadmap.sh — Android', url: 'https://roadmap.sh/android' },
      ],
    },
    {
      id: 'android/android-studio',
      name: 'Android Studio y emulador',
      kind: 'tech',
      area: 'entorno',
      x: 54,
      y: 76,
      weight: 2,
      prereqs: [],
      keyPoints: [
        'Anatomía de un proyecto: módulos, manifest, resources y dónde vive cada cosa.',
        'Emulador y dispositivo real por USB/WiFi: cuándo usar cada uno.',
        'Depurador y Logcat con filtros: tu primera línea de diagnóstico.',
        'Layout Inspector y Profiler básico para ver qué pasa de verdad en pantalla y en memoria.',
        'Atajos y refactors del IDE: renombrar, extraer función, buscar usos.',
      ],
      aiFocus:
        'El asistente integrado en el IDE explica errores de build y genera código en contexto, pero no sustituye saber leer Logcat ni inspeccionar la jerarquía de vistas en ejecución. Profundiza en las herramientas de diagnóstico del IDE: son tu evidencia contra las hipótesis de la IA.',
      resources: [
        { kind: 'doc', label: 'Android Studio — guía oficial', url: 'https://developer.android.com/studio' },
        { kind: 'curso', label: 'Android Basics with Compose (Google)', url: 'https://developer.android.com/courses' },
      ],
    },
    {
      id: 'android/gradle',
      name: 'Gradle y builds',
      kind: 'tech',
      area: 'entorno',
      x: 66,
      y: 76,
      weight: 2,
      prereqs: ['android/android-studio'],
      keyPoints: [
        'Qué hace cada build.gradle.kts: plugins, dependencias, configuración por módulo.',
        'Version catalogs (libs.versions.toml) para centralizar versiones.',
        'Build types y flavors: debug vs release, y qué cambia en cada uno.',
        'minSdk, targetSdk y compileSdk: qué significa cada uno y cómo se decide.',
        'Diagnosticar builds lentas: caché, configuración on demand, qué módulo recompila.',
      ],
      aiFocus:
        'La IA escribe y arregla scripts de Gradle mejor que la mayoría de devs Android, porque nadie los disfruta. Tu parte es entender el modelo (módulos, configuraciones, tareas) para detectar cuándo la solución generada duplica dependencias o rompe la build de release sin que lo notes hasta publicar.',
      resources: [
        { kind: 'doc', label: 'Gradle — documentación oficial', url: 'https://docs.gradle.org' },
        { kind: 'doc', label: 'Configurar la build de Android', url: 'https://developer.android.com/build' },
      ],
    },
    {
      id: 'android/corrutinas-flow',
      name: 'Corrutinas y Flow',
      kind: 'tech',
      area: 'entorno',
      x: 42,
      y: 66,
      weight: 3,
      prereqs: ['android/kotlin'],
      keyPoints: [
        'suspend y structured concurrency: los scopes cancelan a sus hijos, no hay tareas huérfanas.',
        'Dispatchers (Main, IO, Default) y por qué bloquear el hilo principal congela la UI.',
        'Flow para streams: operadores básicos, cold vs hot, StateFlow y SharedFlow.',
        'Cancelación cooperativa: qué pasa cuando el usuario abandona la pantalla a mitad de una carga.',
        'Manejo de errores: try/catch en suspend, CoroutineExceptionHandler, reintentos.',
      ],
      aiFocus:
        'La IA genera corrutinas que funcionan en el caso feliz, pero los bugs de concurrencia (scope mal elegido, cancelación ignorada, colección de Flow duplicada) son justo lo que no ve. Profundiza en structured concurrency y ciclo de vida: revisar código asíncrono generado sin ese modelo mental es firmar a ciegas.',
      resources: [
        { kind: 'doc', label: 'Corrutinas en Android — guía oficial', url: 'https://developer.android.com/kotlin/coroutines' },
        { kind: 'doc', label: 'Kotlin Coroutines — documentación', url: 'https://kotlinlang.org/docs/coroutines-overview.html' },
      ],
    },
    {
      id: 'android/ciclo-vida',
      name: 'Ciclo de vida y componentes',
      kind: 'tech',
      area: 'entorno',
      x: 54,
      y: 66,
      weight: 3,
      prereqs: ['android/kotlin'],
      keyPoints: [
        'Ciclo de vida de Activity: created, started, resumed — y qué se pierde en cada rotación.',
        'El sistema mata tu proceso cuando quiere: diseña para la muerte de proceso, no contra ella.',
        'Intents para navegar entre apps y compartir datos; deep links básicos.',
        'Permisos en tiempo de ejecución: pedir en contexto, degradar con elegancia si te los niegan.',
        'Context: cuál usar (Activity vs Application) y por qué guardarlo mal produce memory leaks.',
      ],
      aiFocus:
        'Este es el conocimiento que la IA más estropea: genera código que funciona hasta que el usuario rota la pantalla o Android mata el proceso en segundo plano. Profundiza en el ciclo de vida real del sistema — es el contexto que el modelo no tiene y la causa raíz de media isla de bugs.',
      resources: [
        { kind: 'doc', label: 'Guía de desarrollo Android', url: 'https://developer.android.com/guide' },
        { kind: 'doc', label: 'Ciclo de vida — Android Developers', url: 'https://developer.android.com/topic/libraries/architecture/lifecycle' },
      ],
    },

    // ── UI con Compose (oeste) ──────────────────────────────────────────────
    {
      id: 'android/compose',
      name: 'Jetpack Compose',
      kind: 'tech',
      area: 'ui',
      x: 30,
      y: 66,
      weight: 3,
      prereqs: ['android/kotlin'],
      keyPoints: [
        'UI declarativa: la pantalla es una función del estado, no un árbol que mutas.',
        'Composables, modifiers y layouts básicos (Column, Row, Box, LazyColumn).',
        'Preview en el IDE: itera la UI sin desplegar en el emulador.',
        'Theming con Material: colores, tipografía y formas desde un único sitio.',
        'Interoperabilidad con Views: conviven en la misma app durante la migración.',
      ],
      aiFocus:
        'Compose es el terreno donde la IA más brilla: describe la pantalla y obtienes un composable decente. El criterio que no te da es la descomposición (qué extraer a componente, qué estado sube y cuál baja) y detectar modifiers en orden incorrecto. Profundiza en pensar en estado y no en píxeles.',
      resources: [
        { kind: 'doc', label: 'Jetpack Compose — documentación oficial', url: 'https://developer.android.com/jetpack/compose' },
        { kind: 'libro', label: 'Jetpack Compose Internals (Jorge Castillo)', url: 'https://jorgecastillo.dev', format: 'online' },
      ],
    },
    {
      id: 'android/estado-compose',
      name: 'Estado y recomposición',
      kind: 'skill',
      area: 'ui',
      x: 18,
      y: 66,
      weight: 3,
      prereqs: ['android/compose'],
      keyPoints: [
        'remember y mutableStateOf: qué sobrevive a la recomposición y qué no.',
        'State hoisting: el estado sube al dueño natural, los composables quedan tontos y testables.',
        'Unidirectional data flow: eventos hacia arriba, estado hacia abajo.',
        'rememberSaveable y la rotación: qué estado debe sobrevivir a la recreación.',
        'Recomposiciones de más: estabilidad de tipos, claves en listas, cuándo importa de verdad.',
      ],
      aiFocus:
        'La IA coloca remember donde calle el compilador, no donde lo pide el diseño: estados duplicados y hoisting a medias son su firma. Profundiza en el modelo de recomposición y en decidir quién es el dueño de cada estado — es la diferencia entre una UI declarativa y un nido de bugs visuales.',
      resources: [
        { kind: 'doc', label: 'Estado en Compose — guía oficial', url: 'https://developer.android.com/jetpack/compose/state' },
        { kind: 'post', label: 'Blog de Android Developers', url: 'https://android-developers.googleblog.com' },
      ],
    },
    {
      id: 'android/navegacion',
      name: 'Navegación',
      kind: 'tech',
      area: 'ui',
      x: 18,
      y: 56,
      weight: 2,
      prereqs: ['android/compose'],
      keyPoints: [
        'Navigation Compose: grafo de destinos, rutas tipadas y paso de argumentos.',
        'Back stack: qué apila cada navegación y qué hace el botón atrás en cada pantalla.',
        'Deep links: entrar a cualquier pantalla desde una notificación o una URL.',
        'Navegación anidada y bottom navigation sin duplicar back stacks.',
        'Dónde NO poner lógica: la navegación se decide en el ViewModel, se ejecuta en la UI.',
      ],
      aiFocus:
        'La IA monta el grafo de navegación y las rutas tipadas en un momento; donde falla es en el back stack — pantallas duplicadas, atrás que sale de la app, deep links que rompen la jerarquía. Profundiza en el comportamiento del botón atrás: es lo primero que prueba un usuario y lo último que prueba un modelo.',
      resources: [
        { kind: 'doc', label: 'Navigation — Android Developers', url: 'https://developer.android.com/guide/navigation' },
        { kind: 'doc', label: 'Navigation Compose — guía', url: 'https://developer.android.com/jetpack/compose/navigation' },
      ],
    },
    {
      id: 'android/material',
      name: 'Material Design 3',
      kind: 'tech',
      area: 'ui',
      x: 30,
      y: 56,
      weight: 2,
      prereqs: ['android/compose'],
      keyPoints: [
        'El sistema de diseño de Android: componentes, elevación, movimiento y cuándo desviarse.',
        'Color scheme dinámico (Material You) y tema claro/oscuro sin duplicar pantallas.',
        'Tipografía y escalas: jerarquía visual consistente en toda la app.',
        'Componentes clave con su semántica: scaffold, top bar, FAB, snackbar, sheets.',
        'Adaptar el layout a tablets y plegables: window size classes.',
      ],
      aiFocus:
        'La IA aplica Material de libro: pantallas correctas pero clónicas. Tu criterio está en la identidad (cuándo el branding pisa al sistema) y en la coherencia entre pantallas que se generaron en conversaciones distintas. Profundiza en el lenguaje del sistema de diseño para dirigir a la IA con vocabulario preciso.',
      resources: [
        { kind: 'doc', label: 'Material Design 3', url: 'https://m3.material.io' },
        { kind: 'doc', label: 'Compose + Material 3 — guía', url: 'https://developer.android.com/jetpack/compose/designsystems/material3' },
      ],
    },
    {
      id: 'android/accesibilidad',
      name: 'Accesibilidad',
      kind: 'skill',
      area: 'ui',
      x: 6,
      y: 56,
      weight: 2,
      prereqs: ['android/compose'],
      keyPoints: [
        'TalkBack: navega tu app con los ojos cerrados al menos una vez por release.',
        'contentDescription con sentido: qué describir, qué marcar como decorativo.',
        'Tamaños táctiles mínimos (48dp), contraste suficiente y texto escalable.',
        'Semántica en Compose: merge de nodos, roles y estados para lectores de pantalla.',
        'La accesibilidad es requisito de calidad (y legal en muchos mercados), no un extra.',
      ],
      aiFocus:
        'La IA añade contentDescription genéricos que cumplen el linter y no ayudan a nadie: «imagen», «botón». Profundiza en probar con TalkBack real y en la semántica de Compose — la experiencia de un usuario ciego no se puede verificar leyendo el diff, solo usándola.',
      resources: [
        { kind: 'doc', label: 'Accesibilidad en Android', url: 'https://developer.android.com/guide/topics/ui/accessibility' },
        { kind: 'doc', label: 'W3C — Web Accessibility Initiative', url: 'https://www.w3.org/WAI/' },
      ],
    },

    // ── Arquitectura (centro) ───────────────────────────────────────────────
    {
      id: 'android/mvvm',
      name: 'MVVM y capas',
      kind: 'skill',
      area: 'arquitectura',
      x: 42,
      y: 46,
      weight: 3,
      prereqs: ['android/ciclo-vida', 'android/estado-compose'],
      keyPoints: [
        'Capas con frontera clara: UI, ViewModel, dominio (opcional) y datos con repositorios.',
        'ViewModel: sobrevive a la rotación, expone StateFlow, no conoce la UI.',
        'UiState como data class inmutable: loading, datos y error en un solo tipo, sin flags sueltos.',
        'Los eventos suben (callbacks), el estado baja: nunca lógica de negocio en el composable.',
        'La guía oficial de arquitectura como base común: desvíate solo con motivo escrito.',
      ],
      aiFocus:
        'Pídele una feature a la IA y te mezclará las capas si el proyecto no las hace evidentes: llamadas de red en el composable, Context en el ViewModel. Profundiza en las fronteras y en explicitarlas (estructura, convenciones, reglas del asistente): una arquitectura clara es también el mejor prompt.',
      resources: [
        { kind: 'doc', label: 'Guía de arquitectura de apps (Google)', url: 'https://developer.android.com/topic/architecture' },
        { kind: 'doc', label: 'Now in Android — app de referencia', url: 'https://github.com/android/nowinandroid' },
      ],
    },
    {
      id: 'android/inyeccion-dependencias',
      name: 'Inyección de dependencias',
      kind: 'tech',
      area: 'arquitectura',
      x: 30,
      y: 46,
      weight: 2,
      prereqs: ['android/mvvm'],
      keyPoints: [
        'Por qué DI: dependencias explícitas, sustituibles en tests, sin singletons a mano.',
        'Hilt en la práctica: módulos, scopes (Singleton, ViewModelScoped) y @Inject.',
        'Qué inyectar y qué no: colaboradores sí, data classes y valores no.',
        'Interfaces en la frontera: el ViewModel depende del contrato del repositorio, no de Retrofit.',
        'Alternativas ligeras (Koin, DI manual) y cuándo bastan.',
      ],
      aiFocus:
        'La IA configura Hilt sin quejarse, y también inyecta cosas que no lo necesitan hasta convertir el grafo en un laberinto. Profundiza en el porqué de la DI — testabilidad y sustitución — para podar la sobreingeniería: si un test no lo necesita dobrar, quizá no había que inyectarlo.',
      resources: [
        { kind: 'doc', label: 'Inyección de dependencias en Android', url: 'https://developer.android.com/training/dependency-injection' },
        { kind: 'doc', label: 'Hilt — documentación', url: 'https://dagger.dev/hilt/' },
      ],
    },
    {
      id: 'android/modularizacion',
      name: 'Modularización',
      kind: 'skill',
      area: 'arquitectura',
      x: 18,
      y: 46,
      weight: 1,
      prereqs: ['android/mvvm'],
      keyPoints: [
        'Cuándo modularizar: builds lentas, equipos que pisan los mismos ficheros, features aislables.',
        'Tipos de módulo: app, feature, core/común — y las reglas de quién depende de quién.',
        'API vs implementación: qué expone cada módulo y qué esconde.',
        'El coste real: más Gradle, más fronteras; no modularices un proyecto de dos pantallas.',
      ],
      aiFocus:
        'La IA replica la estructura de módulos que le enseñes, pero la decisión de cortar (por feature, por capa, cuándo) es de coste de cambio alto y es tuya. Profundiza en grafos de dependencias entre módulos: un corte bien hecho también acota lo que el asistente puede romper de una sentada.',
      resources: [
        { kind: 'doc', label: 'Modularización — guía oficial', url: 'https://developer.android.com/topic/modularization' },
        { kind: 'post', label: 'Blog de Android Developers', url: 'https://android-developers.googleblog.com' },
      ],
    },
    {
      id: 'android/testing',
      name: 'Testing en Android',
      kind: 'skill',
      area: 'arquitectura',
      x: 54,
      y: 46,
      weight: 3,
      prereqs: ['android/mvvm'],
      keyPoints: [
        'Tests unitarios de ViewModels y repositorios en JVM: rápidos, sin emulador.',
        'Testear corrutinas y Flow: dispatcher de test, Turbine, control del tiempo virtual.',
        'Tests de UI en Compose: semántica y assertions sin fragilidad de píxeles.',
        'Dobles en la frontera: fakes de repositorio mejor que mocks de media app.',
        'La arquitectura decide la testabilidad: si cuesta testear, el diseño avisa.',
      ],
      aiFocus:
        'La IA genera suites completas para tu ViewModel en segundos — incluidos tests que fijan la implementación y estallan con cada refactor. Tú defines qué comportamiento merece test y detectas los asserts que no comprueban nada. Profundiza en diseñar casos: son tu red frente al propio código generado.',
      resources: [
        { kind: 'doc', label: 'Testing en Android — guía oficial', url: 'https://developer.android.com/training/testing' },
        { kind: 'doc', label: 'Testing en Compose', url: 'https://developer.android.com/jetpack/compose/testing' },
      ],
    },

    // ── Datos y red (este) ──────────────────────────────────────────────────
    {
      id: 'android/red',
      name: 'Red y APIs',
      kind: 'tech',
      area: 'datos',
      x: 66,
      y: 56,
      weight: 3,
      prereqs: ['android/corrutinas-flow'],
      keyPoints: [
        'Cliente HTTP con Retrofit o Ktor: definición del API, serialización con kotlinx.serialization.',
        'El móvil vive sin red: timeouts, reintentos con backoff y errores tipados, no excepciones sueltas.',
        'Mapea DTOs a modelos de dominio en la frontera: el JSON del backend no manda en tu app.',
        'Interceptores: auth, logging y cabeceras comunes en un solo sitio.',
        'Inspecciona el tráfico real (Network Inspector) antes de culpar al backend.',
      ],
      aiFocus:
        'Dale el JSON a la IA y te devuelve DTOs, cliente y repositorio enteros: puro trabajo mecánico. Lo que no sabe es cómo falla TU red en el mundo real — metro, modo avión, respuestas a medias. Profundiza en diseñar la política de errores y reintentos: es decisión de producto, no de sintaxis.',
      resources: [
        { kind: 'doc', label: 'Retrofit — documentación', url: 'https://square.github.io/retrofit/' },
        { kind: 'doc', label: 'Ktor — documentación oficial', url: 'https://ktor.io' },
      ],
    },
    {
      id: 'android/persistencia',
      name: 'Persistencia local',
      kind: 'tech',
      area: 'datos',
      x: 78,
      y: 66,
      weight: 3,
      prereqs: ['android/corrutinas-flow'],
      keyPoints: [
        'Room: entidades, DAOs con Flow y migraciones que no pierden datos del usuario.',
        'DataStore para preferencias: qué va ahí y qué merece base de datos.',
        'Offline-first: la base de datos local como única fuente de verdad, la red solo sincroniza.',
        'Qué NO persistir en claro: tokens y datos sensibles van cifrados o en el Keystore.',
        'Migra esquemas con tests: una migración rota borra la app de la noche a la mañana.',
      ],
      aiFocus:
        'Room es territorio cómodo para la IA: entidades, DAOs y queries salen solas. Las migraciones no — el modelo no conoce el esquema que tus usuarios llevan instalado desde hace dos años. Profundiza en estrategia offline-first y en migraciones testeadas: ahí se pierde o se conserva la confianza del usuario.',
      resources: [
        { kind: 'doc', label: 'Room — guía oficial', url: 'https://developer.android.com/training/data-storage/room' },
        { kind: 'doc', label: 'DataStore — guía oficial', url: 'https://developer.android.com/topic/libraries/architecture/datastore' },
      ],
    },
    {
      id: 'android/segundo-plano',
      name: 'Trabajo en segundo plano',
      kind: 'tech',
      area: 'datos',
      x: 78,
      y: 56,
      weight: 2,
      prereqs: ['android/corrutinas-flow', 'android/ciclo-vida'],
      keyPoints: [
        'WorkManager para trabajo diferible y garantizado: sincronizaciones, subidas, limpieza.',
        'Restricciones y política de reintentos: solo con WiFi, con batería, backoff exponencial.',
        'Foreground services: cuándo son obligatorios y qué exige el sistema a cambio.',
        'Doze y optimización de batería: el sistema aplaza tu trabajo, diseña asumiéndolo.',
        'Notificaciones push (FCM) como disparador: el servidor despierta a la app, no al revés.',
      ],
      aiFocus:
        'La IA sugiere soluciones de segundo plano de hace tres versiones de Android: services que el sistema ya no permite, alarmas que Doze ignora. Profundiza en las restricciones actuales de la plataforma — cambian cada año y son exactamente el tipo de conocimiento caducado que el modelo arrastra.',
      resources: [
        { kind: 'doc', label: 'Trabajo en segundo plano — guía', url: 'https://developer.android.com/guide/background' },
        { kind: 'doc', label: 'WorkManager — documentación', url: 'https://developer.android.com/topic/libraries/architecture/workmanager' },
      ],
    },

    // ── Release y calidad (norte) ───────────────────────────────────────────
    {
      id: 'android/rendimiento',
      name: 'Rendimiento y batería',
      kind: 'skill',
      area: 'release',
      x: 66,
      y: 36,
      weight: 2,
      prereqs: ['android/estado-compose', 'android/segundo-plano'],
      keyPoints: [
        'Mide antes de tocar: Profiler, Macrobenchmark y Perfetto sobre build de release.',
        'Arranque en frío: qué se inicializa antes del primer frame y qué puede esperar.',
        'Jank: frames perdidos en listas y animaciones; recomposiciones y trabajo en el hilo principal.',
        'Batería: wakelocks, ubicación y red son los tres sospechosos de siempre.',
        'Baseline Profiles y R8: rendimiento gratis en release si los configuras una vez.',
      ],
      aiFocus:
        'La IA propone optimizaciones plausibles sin haber medido tu app, y optimizar sin medir es superstición. Tu flujo: perfila, localiza el cuello real, y entonces sí — pide a la IA el arreglo concreto. Profundiza en leer trazas de Profiler y Perfetto: los datos mandan sobre las corazonadas del modelo.',
      resources: [
        { kind: 'doc', label: 'Rendimiento en Android — guía', url: 'https://developer.android.com/topic/performance' },
        { kind: 'doc', label: 'Perfetto — tracing del sistema', url: 'https://perfetto.dev' },
      ],
    },
    {
      id: 'android/firmas-play',
      name: 'Firmas y Play Console',
      kind: 'tech',
      area: 'release',
      x: 54,
      y: 26,
      weight: 3,
      prereqs: ['android/gradle', 'android/testing'],
      keyPoints: [
        'Firma de apps y Play App Signing: qué clave guarda Google y cuál no puedes perder jamás.',
        'App Bundles (AAB), versionCode y versionName: qué sube a Play y cómo se versiona.',
        'Tracks de release: interno, cerrado, abierto y producción con despliegue gradual.',
        'Requisitos de la tienda: target API mínimo anual, data safety, políticas que cambian.',
        'La revisión tarda: planifica los releases con margen, no el viernes por la tarde.',
      ],
      aiFocus:
        'La IA explica cada paso del proceso de publicación, pero las claves de firma y los accesos a Play Console son responsabilidad tuya e irreversibles: una clave de subida perdida o filtrada no la arregla ningún prompt. Profundiza en el proceso completo de release — hazlo a mano al menos una vez antes de automatizarlo.',
      resources: [
        { kind: 'doc', label: 'Publicar tu app — guía oficial', url: 'https://developer.android.com/studio/publish' },
        { kind: 'doc', label: 'Play Console — documentación', url: 'https://support.google.com/googleplay/android-developer' },
      ],
    },
    {
      id: 'android/crash-observabilidad',
      name: 'Crashes y observabilidad',
      kind: 'skill',
      area: 'release',
      x: 66,
      y: 26,
      weight: 2,
      prereqs: ['android/firmas-play'],
      keyPoints: [
        'Crash reporting (Crashlytics o similar) desde el primer release: sin datos estás ciego.',
        'Android vitals: ANRs, crashes y batería afectan al ranking en Play, no solo al usuario.',
        'Lee un stack trace ofuscado: mapping de R8 subido en cada release.',
        'Agrupa y prioriza: el crash que afecta al 2% de sesiones antes que el exótico de un dispositivo.',
        'Logs y breadcrumbs con criterio: contexto para reproducir, sin datos personales.',
      ],
      aiFocus:
        'Pega el stack trace a la IA y tendrás hipótesis ordenadas al instante — con la traza desofuscada y el contexto del crash, no antes. Profundiza en montar el circuito de observabilidad (mapping, vitals, alertas): la IA razona sobre la evidencia que tú captures; sin ella, alucináis los dos.',
      resources: [
        { kind: 'doc', label: 'Firebase Crashlytics — documentación', url: 'https://firebase.google.com/docs/crashlytics' },
        { kind: 'doc', label: 'Android vitals — guía', url: 'https://developer.android.com/topic/performance/vitals' },
      ],
    },
    {
      id: 'android/app-publicada',
      name: 'App publicada y mantenida',
      kind: 'milestone',
      area: 'release',
      x: 54,
      y: 16,
      weight: 3,
      prereqs: ['android/firmas-play', 'android/red', 'android/persistencia', 'android/rendimiento'],
      keyPoints: [
        'Cierra el ciclo: idea → app → Play Store → usuarios reales → siguiente versión.',
        'Mantener es el verdadero examen: target API que sube, librerías que rompen, políticas nuevas.',
        'Lee los datos de producción (vitals, reviews, analytics) antes de decidir la siguiente feature.',
        'Un release regular y pequeño gana a un release épico cada seis meses.',
      ],
      aiFocus:
        'Con IA, la primera versión de una app sale en un fin de semana; sostenerla releases y años es lo que te hace profesional de Android. Profundiza en el ciclo completo — publicar, medir, iterar — porque el criterio de qué mantener y qué reescribir no se delega.',
      resources: [
        { kind: 'doc', label: 'roadmap.sh — Android', url: 'https://roadmap.sh/android' },
        { kind: 'post', label: 'Blog de Android Developers', url: 'https://android-developers.googleblog.com' },
      ],
    },

    // ── Android con IA (noroeste) ───────────────────────────────────────────
    {
      id: 'android/ia-flujo-trabajo',
      name: 'Desarrollar Android con IA',
      kind: 'skill',
      area: 'ia',
      x: 30,
      y: 36,
      weight: 2,
      prereqs: ['android/mvvm'],
      keyPoints: [
        'Asistentes en el IDE (Gemini en Android Studio y similares): generar, explicar y refactorizar en contexto.',
        'Dale contexto de proyecto: arquitectura, convenciones y ficheros clave en las reglas del asistente.',
        'Genera pantallas Compose y tests de ViewModel como borrador; revisa ciclo de vida y estado a mano.',
        'Úsala para migrar (Views a Compose, Java a Kotlin) con diffs pequeños y tests que vigilan.',
        'Verifica contra la versión: el modelo mezcla APIs de versiones distintas de Compose sin avisar.',
      ],
      aiFocus:
        'En Android la IA rinde más cuanto más contexto de plataforma le das: versión de Compose, minSdk, arquitectura del proyecto. Profundiza en preparar ese contexto y en revisar lo generado contra el ciclo de vida real — el modelo no sabe qué pasa cuando el sistema mata tu proceso, tú sí.',
      resources: [
        { kind: 'doc', label: 'IA para desarrolladores Android', url: 'https://developer.android.com/ai' },
        { kind: 'doc', label: 'Prompt Engineering Guide', url: 'https://www.promptingguide.ai' },
      ],
    },
    {
      id: 'android/ml-on-device',
      name: 'IA en el dispositivo',
      kind: 'tech',
      area: 'ia',
      x: 18,
      y: 36,
      weight: 2,
      prereqs: ['android/ia-flujo-trabajo'],
      keyPoints: [
        'On-device vs nube: latencia, privacidad y coste deciden dónde corre cada inferencia.',
        'ML Kit para lo resuelto: OCR, códigos de barras, detección de caras sin entrenar nada.',
        'Modelos generativos en el dispositivo (Gemini Nano y similares) y sus límites de hardware.',
        'Diseña la degradación: qué hace tu app en dispositivos sin soporte o sin red.',
        'Mide el impacto: tamaño del APK, memoria y batería de cada modelo que embarques.',
      ],
      aiFocus:
        'Aquí no usas IA para programar: embarcas IA como funcionalidad, y eso cambia las preguntas — privacidad de los datos del usuario, tamaño del modelo, comportamiento sin red. Profundiza en decidir on-device vs nube por caso de uso: es una decisión de producto y coste, no de moda.',
      resources: [
        { kind: 'doc', label: 'ML Kit — documentación', url: 'https://developers.google.com/ml-kit' },
        { kind: 'doc', label: 'Google AI for Developers', url: 'https://ai.google.dev' },
      ],
    },
  ],
};
