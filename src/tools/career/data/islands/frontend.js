/**
 * Isla «Frontend» (doc /careerMap/frontend) — contenido curado MC-16, oleada 2.
 *
 * Sigue la CONVENCIÓN DE CONTENIDO DE ISLAS descrita en la cabecera de
 * ./bases.js (ids prefijados por disciplina, prereqs intra-isla sin ciclos,
 * posiciones separadas, keyPoints/aiFocus/resources por ciudad). Basada en
 * roadmap.sh/frontend pero adaptada a la era IA: menos memorización de APIs
 * y frameworks, más criterio de diseño, accesibilidad, rendimiento y revisión
 * crítica de la UI que genera la IA.
 *
 * @typedef {import('../../domain/types.js').CareerMap} CareerMap
 */

/** @type {CareerMap} */
export const FRONTEND_ISLAND = {
  id: 'frontend',
  name: 'Frontend',
  startPort: { x: 50, y: 88 },
  areas: [
    { id: 'fundamentos-web', name: 'Fundamentos de la web' },
    { id: 'framework-estado', name: 'Framework y estado' },
    { id: 'calidad', name: 'Calidad: a11y, vitals y testing' },
    { id: 'tooling', name: 'Tooling y design systems' },
    { id: 'frontend-ia', name: 'Frontend con IA' },
  ],
  cities: [
    // ── Fundamentos de la web (sur, junto al puerto) ────────────────────────
    {
      id: 'frontend/html-semantico',
      name: 'HTML semántico',
      kind: 'tech',
      area: 'fundamentos-web',
      x: 50,
      y: 74,
      weight: 3,
      prereqs: [],
      keyPoints: [
        'Usa el elemento correcto para cada cosa: nav, main, article, button, form — no todo es un div.',
        'Estructura el documento con jerarquía de encabezados (h1-h6) coherente y única.',
        'Formularios nativos con label, fieldset y tipos de input adecuados: el navegador hace gratis media validación.',
        'Entiende qué aporta la semántica: accesibilidad, SEO y CSS/JS más simples.',
        'Valida tu HTML y revisa el árbol de accesibilidad en las DevTools, no solo el visual.',
      ],
      aiFocus:
        'La IA genera maquetas funcionales en segundos, pero tiende al div-soup: divs anidados con onClick donde iba un button. Profundiza en semántica para detectar y corregir ese patrón — es el error número uno de la UI generada y arruina la accesibilidad.',
      resources: [
        { kind: 'doc', label: 'MDN — HTML', url: 'https://developer.mozilla.org/es/docs/Web/HTML' },
        { kind: 'doc', label: 'roadmap.sh — Frontend', url: 'https://roadmap.sh/frontend' },
        { kind: 'curso', label: 'web.dev — Learn HTML', url: 'https://web.dev/learn/html' },
      ],
    },
    {
      id: 'frontend/css-moderno',
      name: 'CSS moderno',
      kind: 'tech',
      area: 'fundamentos-web',
      x: 38,
      y: 66,
      weight: 3,
      prereqs: ['frontend/html-semantico'],
      keyPoints: [
        'Domina el modelo mental: cascada, especificidad, herencia y box model — sin esto todo CSS es prueba y error.',
        'Layout moderno con Flexbox y Grid: elige por intención (una dimensión vs dos), no por costumbre.',
        'Custom properties (variables CSS) para temas y design tokens.',
        'Selectores y capas modernas: :has(), nesting nativo, @layer para domar la especificidad.',
        'Aprende a depurar CSS con las DevTools: inspector de layout, computed styles, overrides.',
      ],
      aiFocus:
        'La IA escribe CSS que «se ve bien» en la demo pero acumula especificidad, !important y valores mágicos. Profundiza en el modelo de cascada y layout: es lo que te permite pedir a la IA la versión simple y detectar cuándo un fix generado es un parche encima de otro parche.',
      resources: [
        { kind: 'doc', label: 'MDN — CSS', url: 'https://developer.mozilla.org/es/docs/Web/CSS' },
        { kind: 'curso', label: 'web.dev — Learn CSS', url: 'https://web.dev/learn/css' },
        { kind: 'libro', label: 'Every Layout (Bell y Pickering)', url: 'https://every-layout.dev', format: 'online' },
      ],
    },
    {
      id: 'frontend/javascript-moderno',
      name: 'JavaScript moderno',
      kind: 'tech',
      area: 'fundamentos-web',
      x: 62,
      y: 66,
      weight: 3,
      prereqs: [],
      keyPoints: [
        'El lenguaje de verdad: closures, this, prototipos, módulos ES — no solo la sintaxis que autocompleta el editor.',
        'Asincronía con criterio: promesas, async/await, y qué pasa en el event loop cuando algo «va lento».',
        'Manipula datos con los métodos modernos: map/filter/reduce, destructuring, spread, optional chaining.',
        'Maneja errores de forma explícita: try/catch en async, errores tipados, nada de fallos silenciosos.',
        'Conoce el runtime del navegador: qué es caro (layout, red) y qué es barato (cálculo en memoria).',
      ],
      aiFocus:
        'La IA escribe JavaScript correcto casi siempre — el problema es cuando no, y el fallo es sutil: un await olvidado, una closure que captura la variable equivocada. Profundiza en el modelo de ejecución (event loop, scope): es lo que te permite leer código generado y ver el bug antes que producción.',
      resources: [
        { kind: 'doc', label: 'MDN — JavaScript', url: 'https://developer.mozilla.org/es/docs/Web/JavaScript' },
        { kind: 'libro', label: 'javascript.info — el tutorial moderno', url: 'https://es.javascript.info', format: 'online' },
        { kind: 'libro', label: 'Eloquent JavaScript (Marijn Haverbeke)', url: 'https://eloquentjavascript.net', format: 'online' },
      ],
    },
    {
      id: 'frontend/typescript',
      name: 'TypeScript',
      kind: 'tech',
      area: 'fundamentos-web',
      x: 50,
      y: 58,
      weight: 2,
      prereqs: ['frontend/javascript-moderno'],
      keyPoints: [
        'Tipa las fronteras: props, respuestas de API y estado — es donde los tipos pagan el peaje.',
        'Evita any; usa unknown y estrecha con guards cuando no conoces la forma.',
        'Modela con uniones discriminadas: estados imposibles que no compilan valen más que mil tests.',
        'Aprende a leer errores del compilador: el mensaje largo casi siempre dice exactamente qué falta.',
        'Configura strict desde el día uno; relajar después es fácil, endurecer es una migración.',
      ],
      aiFocus:
        'La IA genera tipos y resuelve errores de TypeScript con soltura, pero tiende a «resolver» silenciando: any, as, ts-ignore. Profundiza en modelar dominios con tipos: un buen tipo es un contrato que además guía a la IA hacia código correcto en todo el proyecto.',
      resources: [
        { kind: 'doc', label: 'TypeScript — Handbook oficial', url: 'https://www.typescriptlang.org/docs/' },
        { kind: 'doc', label: 'roadmap.sh — TypeScript', url: 'https://roadmap.sh/typescript' },
        { kind: 'curso', label: 'Total TypeScript (Matt Pocock)', url: 'https://www.totaltypescript.com' },
      ],
    },
    {
      id: 'frontend/dom-web-apis',
      name: 'DOM y Web APIs',
      kind: 'tech',
      area: 'fundamentos-web',
      x: 70,
      y: 76,
      weight: 2,
      prereqs: ['frontend/javascript-moderno'],
      keyPoints: [
        'Eventos de verdad: burbujeo, delegación, preventDefault — la base de toda interacción.',
        'Manipula el DOM con criterio: crear nodos, medir, y saber qué operaciones fuerzan reflow.',
        'fetch y sus alrededores: AbortController, cabeceras, streaming, manejo de errores de red.',
        'Almacenamiento y contexto del navegador: localStorage, cookies, historia, URL como estado.',
        'Conoce las APIs que sustituyen librerías: IntersectionObserver, dialog, Clipboard, View Transitions.',
      ],
      aiFocus:
        'La IA propone por defecto la librería que vio mil veces en su entrenamiento, aunque el navegador ya traiga la API nativa. Profundiza en la plataforma web: saber que existe IntersectionObserver o dialog te ahorra dependencias enteras y te permite exigir a la IA soluciones sin equipaje.',
      resources: [
        { kind: 'doc', label: 'MDN — referencia de Web APIs', url: 'https://developer.mozilla.org/es/docs/Web/API' },
        { kind: 'post', label: 'web.dev — novedades de la plataforma web', url: 'https://web.dev' },
      ],
    },
    {
      id: 'frontend/responsive',
      name: 'Diseño responsive',
      kind: 'skill',
      area: 'fundamentos-web',
      x: 68,
      y: 54,
      weight: 2,
      prereqs: ['frontend/css-moderno'],
      keyPoints: [
        'Mobile-first: diseña para la pantalla pequeña y añade complejidad hacia arriba.',
        'Prefiere layouts intrínsecos (grid auto-fit, clamp, unidades fluidas) a colecciones de media queries.',
        'Container queries para componentes que se adaptan a su hueco, no a la ventana.',
        'Prueba en dispositivos y condiciones reales: táctil, zoom al 200%, conexión lenta.',
        'Las imágenes también son responsive: srcset, sizes y formatos modernos.',
      ],
      aiFocus:
        'La IA genera media queries a puñados, pero el resultado suele ser tres layouts cosidos en vez de uno fluido. Profundiza en diseño intrínseco (clamp, minmax, container queries): pedir «que funcione a cualquier ancho» y saber evaluarlo es criterio tuyo, no del modelo.',
      resources: [
        { kind: 'curso', label: 'web.dev — Learn Responsive Design', url: 'https://web.dev/learn/design' },
        { kind: 'post', label: 'Ahmad Shadeed — CSS y layouts explicados visualmente', url: 'https://ishadeed.com' },
      ],
    },

    // ── Framework y estado (oeste) ──────────────────────────────────────────
    {
      id: 'frontend/componentes',
      name: 'Pensar en componentes',
      kind: 'skill',
      area: 'framework-estado',
      x: 28,
      y: 74,
      weight: 3,
      prereqs: ['frontend/html-semantico', 'frontend/javascript-moderno'],
      keyPoints: [
        'Divide la UI en piezas con una responsabilidad: props hacia abajo, eventos hacia arriba.',
        'Distingue componentes de presentación (tontos, reutilizables) de contenedores (con lógica y datos).',
        'Diseña la API del componente como si fuera pública: nombres claros, defaults sensatos, mínimo necesario.',
        'La composición gana a la configuración: slots/children antes que veinte props booleanas.',
        'Este modelo es transversal: Web Components, React, Vue o Svelte comparten la misma idea.',
      ],
      aiFocus:
        'La IA escupe componentes enteros a la primera, pero decide mal los cortes: monolitos de 400 líneas o fragmentación absurda. Profundiza en diseñar límites y contratos de componentes — con el corte correcto, cualquier framework (y cualquier IA) rellena el interior.',
      resources: [
        { kind: 'doc', label: 'React — Pensar en React', url: 'https://es.react.dev/learn/thinking-in-react' },
        { kind: 'libro', label: 'Atomic Design (Brad Frost)', url: 'https://atomicdesign.bradfrost.com', format: 'online' },
      ],
    },
    {
      id: 'frontend/react',
      name: 'React (o tu framework)',
      kind: 'tech',
      area: 'framework-estado',
      x: 16,
      y: 64,
      weight: 3,
      prereqs: ['frontend/componentes'],
      keyPoints: [
        'Domina UN framework a fondo (React como referencia del mercado; Vue/Svelte valen igual).',
        'Entiende el modelo de render: cuándo se re-renderiza un componente y qué lo provoca.',
        'Hooks con criterio: useState para estado local, useEffect solo para sincronizar con el exterior.',
        'Levanta el estado solo hasta donde haga falta: el estado global prematuro es deuda.',
        'Aprende los patrones, no la API: los frameworks cambian, el modelo de UI declarativa permanece.',
      ],
      aiFocus:
        'La IA conoce la API de React mejor que tú y siempre la conocerá: deja de memorizar hooks. Profundiza en el modelo de render y el flujo de datos — es lo que necesitas para diagnosticar el useEffect infinito o el re-render en cascada que la IA introduce sin inmutarse.',
      resources: [
        { kind: 'doc', label: 'React — documentación oficial en español', url: 'https://es.react.dev' },
        { kind: 'doc', label: 'Vue.js — documentación oficial', url: 'https://vuejs.org' },
        { kind: 'doc', label: 'roadmap.sh — React', url: 'https://roadmap.sh/react' },
      ],
    },
    {
      id: 'frontend/gestion-estado',
      name: 'Gestión de estado',
      kind: 'skill',
      area: 'framework-estado',
      x: 6,
      y: 54,
      weight: 2,
      prereqs: ['frontend/react'],
      keyPoints: [
        'Clasifica antes de elegir herramienta: estado de UI, de servidor, de formulario y de URL son problemas distintos.',
        'El mejor estado es el que no existe: deriva valores en vez de duplicarlos.',
        'Estado de servidor con su librería (TanStack Query o similar): caché, revalidación y reintentos resueltos.',
        'Estado global solo para lo genuinamente global (sesión, tema); empieza pequeño (Zustand, context).',
        'La URL es estado compartible: filtros, pestañas y búsquedas viven mejor ahí.',
      ],
      aiFocus:
        'Pide un carrito a la IA y te montará Redux con boilerplate de 2019 o meterá todo en un context gigante. Profundiza en clasificar el estado y elegir la herramienta mínima: esa decisión de arquitectura es tuya, y es la diferencia entre una app mantenible y un nudo.',
      resources: [
        { kind: 'doc', label: 'TanStack Query — estado de servidor', url: 'https://tanstack.com/query' },
        { kind: 'post', label: 'TkDodo — React Query y gestión de estado', url: 'https://tkdodo.eu' },
      ],
    },
    {
      id: 'frontend/reactividad-signals',
      name: 'Reactividad y signals',
      kind: 'skill',
      area: 'framework-estado',
      x: 20,
      y: 48,
      weight: 1,
      prereqs: ['frontend/componentes'],
      keyPoints: [
        'Entiende el espectro: re-render por árbol (React) vs reactividad fina con signals (Solid, Vue, Svelte 5, Angular).',
        'Un signal es un valor que sabe quién lo lee: los efectos se actualizan solos, sin diffing.',
        'Valores derivados (computed) en vez de sincronizar estados a mano.',
        'Reconoce el mismo patrón en todos los frameworks modernos: aprenderlo una vez te sirve en todos.',
      ],
      aiFocus:
        'La IA mezcla alegremente idioms de React en código Vue o Svelte porque en su entrenamiento todo convive. Profundiza en el modelo reactivo de TU framework: distinguir «esto es reactividad fina» de «esto re-renderiza el árbol» te deja revisar código generado sin tragarte patrones de otro paradigma.',
      resources: [
        { kind: 'doc', label: 'Vue — Reactivity in Depth', url: 'https://vuejs.org/guide/extras/reactivity-in-depth.html' },
        { kind: 'doc', label: 'Solid — introducción a signals', url: 'https://www.solidjs.com' },
      ],
    },
    {
      id: 'frontend/datos-remotos',
      name: 'Datos remotos y formularios',
      kind: 'skill',
      area: 'framework-estado',
      x: 30,
      y: 40,
      weight: 2,
      prereqs: ['frontend/react'],
      keyPoints: [
        'Todo fetch tiene tres estados como mínimo: cargando, error y éxito — diséñalos los tres.',
        'Caché y revalidación: no vuelvas a pedir lo que ya tienes fresco; invalida al mutar.',
        'Formularios con validación en cliente Y servidor: la del cliente es UX, la del servidor es la de verdad.',
        'Estados optimistas con vuelta atrás: la UI responde ya, y se corrige si el servidor dice que no.',
        'Errores de red con mensaje útil y reintento: «algo salió mal» a secas es un bug de UX.',
      ],
      aiFocus:
        'La IA genera el happy path del formulario y del fetch en un minuto; los estados de error, carga y conflicto los omite salvo que los exijas. Profundiza en enumerar estados y casos borde: tu checklist de «¿y si falla la red a mitad?» es lo que convierte la demo generada en producto.',
      resources: [
        { kind: 'doc', label: 'MDN — Fetch API', url: 'https://developer.mozilla.org/es/docs/Web/API/Fetch_API' },
        { kind: 'doc', label: 'TanStack Query — guía oficial', url: 'https://tanstack.com/query' },
        { kind: 'post', label: 'Kent C. Dodds — patrones de React y formularios', url: 'https://kentcdodds.com' },
      ],
    },

    // ── Calidad: a11y, vitals y testing (norte-centro) ──────────────────────
    {
      id: 'frontend/accesibilidad',
      name: 'Accesibilidad (a11y)',
      kind: 'skill',
      area: 'calidad',
      x: 42,
      y: 36,
      weight: 3,
      prereqs: ['frontend/componentes'],
      keyPoints: [
        'La base es gratis: HTML semántico, labels, alt, orden de foco lógico y contraste suficiente.',
        'Navega tu app solo con teclado: si no puedes, un porcentaje de tus usuarios tampoco.',
        'ARIA es el último recurso: primero el elemento nativo; mal ARIA es peor que ningún ARIA.',
        'Gestiona el foco en interacciones ricas: modales, menús y notificaciones deben anunciarse.',
        'Audita con herramientas (axe, Lighthouse) Y con un lector de pantalla real al menos una vez.',
      ],
      aiFocus:
        'La IA genera atributos ARIA con la misma seguridad cuando aciertan que cuando rompen el lector de pantalla — y las herramientas automáticas solo cazan un tercio de los problemas. Profundiza en probar con teclado y lector de pantalla: la verificación humana aquí no tiene sustituto.',
      resources: [
        { kind: 'doc', label: 'W3C WAI — fundamentos de accesibilidad', url: 'https://www.w3.org/WAI/' },
        { kind: 'curso', label: 'web.dev — Learn Accessibility', url: 'https://web.dev/learn/accessibility' },
        { kind: 'doc', label: 'The A11y Project — checklist práctica', url: 'https://www.a11yproject.com' },
      ],
    },
    {
      id: 'frontend/core-web-vitals',
      name: 'Rendimiento y Core Web Vitals',
      kind: 'skill',
      area: 'calidad',
      x: 62,
      y: 36,
      weight: 2,
      prereqs: ['frontend/dom-web-apis'],
      keyPoints: [
        'Conoce las tres métricas y qué miden: LCP (carga), INP (respuesta), CLS (estabilidad visual).',
        'El peso manda: menos JavaScript enviado es la optimización que más paga (code splitting, lazy).',
        'Imágenes y fuentes bien servidas: dimensiones declaradas, formatos modernos, preload de lo crítico.',
        'Mide en campo, no solo en tu máquina: datos reales de usuarios (CrUX) sobre Lighthouse de laboratorio.',
        'Perfila antes de optimizar: la pestaña Performance te dice dónde se va el tiempo de verdad.',
      ],
      aiFocus:
        'La IA sugiere optimizaciones genéricas de listicle (memoiza todo, lazy-load todo) sin haber medido nada. Profundiza en perfilar y leer trazas: con un diagnóstico real en la mano, la IA implementa el fix concreto muy bien; sin él, optimiza a ciegas lo que no era el problema.',
      resources: [
        { kind: 'doc', label: 'web.dev — Core Web Vitals', url: 'https://web.dev/articles/vitals' },
        { kind: 'doc', label: 'Chrome DevTools — panel Performance', url: 'https://developer.chrome.com/docs/devtools' },
        { kind: 'doc', label: 'Lighthouse — auditoría de rendimiento', url: 'https://developer.chrome.com/docs/lighthouse' },
      ],
    },
    {
      id: 'frontend/testing-frontend',
      name: 'Testing frontend',
      kind: 'skill',
      area: 'calidad',
      x: 50,
      y: 28,
      weight: 3,
      prereqs: ['frontend/componentes'],
      keyPoints: [
        'Testea comportamiento visible, no implementación: como interactúa el usuario, no como renderiza el framework.',
        'Testing Library como filosofía: busca por rol y texto accesible — de paso vigilas la a11y.',
        'Unos pocos E2E (Playwright) para los flujos que pagan las facturas; unitarios para la lógica.',
        'Los tests de UI frágiles son peores que no tener tests: nada de asserts sobre clases CSS o snapshots gigantes.',
        'Testea también los estados feos: error de red, lista vacía, carga lenta.',
      ],
      aiFocus:
        'La IA genera suites enteras de tests de componente — incluidos snapshots inútiles y asserts que pasan siempre. Tu criterio decide QUÉ merece test y a qué nivel. Profundiza en diseñar los casos: un test que tú especificas es además tu contrato para revisar la UI que la IA genere mañana.',
      resources: [
        { kind: 'doc', label: 'Testing Library — documentación oficial', url: 'https://testing-library.com' },
        { kind: 'doc', label: 'Playwright — tests end-to-end', url: 'https://playwright.dev' },
        { kind: 'doc', label: 'Vitest — documentación oficial', url: 'https://vitest.dev' },
      ],
    },
    {
      id: 'frontend/seguridad-frontend',
      name: 'Seguridad en el navegador',
      kind: 'skill',
      area: 'calidad',
      x: 66,
      y: 22,
      weight: 2,
      prereqs: ['frontend/dom-web-apis'],
      keyPoints: [
        'XSS es EL riesgo frontend: nunca interpoles entrada de usuario en HTML sin escapar/sanear.',
        'Entiende same-origin, CORS y por qué existen: abrirlos «para que funcione» es abrir la puerta.',
        'Tokens y sesión: dónde guardar credenciales (cookies httpOnly vs storage) y qué expone cada opción.',
        'Content Security Policy como red de seguridad contra scripts inyectados.',
        'Todo lo que llega del cliente es hostil para el servidor: la validación en frontend es solo cortesía.',
      ],
      aiFocus:
        'La IA reproduce los ejemplos inseguros de su entrenamiento: innerHTML con datos del usuario, tokens en localStorage, CORS con asterisco. Nunca asumas que la salida es segura por defecto. Profundiza en el modelo de amenazas del navegador y revisa el código generado con el OWASP en mente.',
      resources: [
        { kind: 'doc', label: 'MDN — seguridad web', url: 'https://developer.mozilla.org/es/docs/Web/Security' },
        { kind: 'doc', label: 'OWASP Cheat Sheet Series (XSS, CSP)', url: 'https://cheatsheetseries.owasp.org' },
      ],
    },
    {
      id: 'frontend/interfaz-produccion',
      name: 'Interfaz en producción',
      kind: 'milestone',
      area: 'calidad',
      x: 52,
      y: 12,
      weight: 3,
      prereqs: ['frontend/testing-frontend', 'frontend/accesibilidad', 'frontend/core-web-vitals'],
      keyPoints: [
        'Cierra el círculo: una interfaz real desplegada, accesible, medida y con tests que la protegen.',
        'Vitals verdes con datos de usuarios reales, no solo en tu portátil con caché caliente.',
        'Errores de frontend monitorizados: si un usuario ve una pantalla rota, tú te enteras.',
        'La UI aguanta lo feo: red lenta, datos vacíos, textos largos, zoom 200%, teclado.',
      ],
      aiFocus:
        'Generar una UI vistosa cuesta una tarde con IA; que aguante usuarios reales es lo que te hace profesional. Profundiza en el último 20% — accesibilidad verificada, rendimiento medido, errores observados — porque es justo la parte que la IA no puede comprobar por ti.',
      resources: [
        { kind: 'doc', label: 'web.dev — guías de calidad web', url: 'https://web.dev' },
        { kind: 'doc', label: 'roadmap.sh — Frontend (revisa qué te falta)', url: 'https://roadmap.sh/frontend' },
      ],
    },

    // ── Tooling y design systems (este) ─────────────────────────────────────
    {
      id: 'frontend/vite-bundlers',
      name: 'Vite y el build',
      kind: 'tech',
      area: 'tooling',
      x: 80,
      y: 66,
      weight: 2,
      prereqs: ['frontend/javascript-moderno'],
      keyPoints: [
        'Entiende qué hace el build: transformar (TS, JSX), resolver módulos, trocear (code splitting) y minificar.',
        'Vite como referencia actual: dev server con ESM nativo y build de producción con Rollup.',
        'Variables de entorno y modos: qué se incrusta en el bundle (¡y qué NUNCA debe incrustarse!).',
        'Analiza el bundle de vez en cuando: las dependencias engordan en silencio.',
        'Source maps y builds reproducibles: poder depurar producción no es opcional.',
      ],
      aiFocus:
        'La IA resuelve errores de configuración de build copiando recetas — a veces de versiones incompatibles entre sí. Profundiza en QUÉ hace cada pieza del pipeline: con ese mapa mental detectas cuándo la receta generada añade un plugin que no necesitas o rompe el tree-shaking.',
      resources: [
        { kind: 'doc', label: 'Vite — documentación oficial', url: 'https://vite.dev' },
        { kind: 'doc', label: 'MDN — módulos JavaScript', url: 'https://developer.mozilla.org/es/docs/Web/JavaScript/Guide/Modules' },
      ],
    },
    {
      id: 'frontend/npm-dependencias',
      name: 'npm y dependencias',
      kind: 'tech',
      area: 'tooling',
      x: 92,
      y: 58,
      weight: 2,
      prereqs: ['frontend/javascript-moderno'],
      keyPoints: [
        'package.json a fondo: dependencies vs devDependencies, scripts, versionado semántico y lockfile.',
        'Cada dependencia es un contrato de mantenimiento: evalúa tamaño, actividad y alternativa nativa antes de instalar.',
        'Audita y actualiza con proceso: npm audit, renovate/dependabot, y leer el changelog antes de subir de major.',
        'Conoce el riesgo de la cadena de suministro: typosquatting y paquetes comprometidos existen.',
        'Monorepos y workspaces cuando el proyecto crece: compartir código sin publicar paquetes.',
      ],
      aiFocus:
        'La IA sugiere paquetes con nombres plausibles que a veces NO existen (y los squatters lo saben) o que llevan años abandonados. Verifica cada dependencia sugerida en npm antes de instalar. Profundiza en evaluar dependencias: es una decisión de riesgo, no de conveniencia.',
      resources: [
        { kind: 'doc', label: 'npm — documentación oficial', url: 'https://docs.npmjs.com' },
        { kind: 'doc', label: 'OWASP — riesgos de la cadena de suministro', url: 'https://owasp.org' },
      ],
    },
    {
      id: 'frontend/design-systems',
      name: 'Design systems',
      kind: 'skill',
      area: 'tooling',
      x: 82,
      y: 46,
      weight: 2,
      prereqs: ['frontend/componentes', 'frontend/css-moderno'],
      keyPoints: [
        'Tokens primero: colores, espaciado, tipografía y radios como variables con nombre, no valores sueltos.',
        'Componentes base documentados con sus estados: hover, focus, disabled, error, loading.',
        'Storybook (o similar) como catálogo vivo: cada componente visible y probable de forma aislada.',
        'La consistencia es el producto: un botón nuevo cuando ya hay botón es un bug de sistema.',
        'Apóyate en primitivas accesibles (Radix, headless UI) y pon tú la capa visual.',
      ],
      aiFocus:
        'Sin sistema, cada componente que genera la IA inventa sus propios grises y espaciados y la app deriva en collage. Un design system con tokens es también el contexto que le das al modelo para que genere UI consistente. Profundiza en definir y vigilar el sistema: eres su editor, la IA es su rellenador.',
      resources: [
        { kind: 'doc', label: 'Storybook — documentación oficial', url: 'https://storybook.js.org' },
        { kind: 'libro', label: 'Atomic Design (Brad Frost)', url: 'https://atomicdesign.bradfrost.com', format: 'online' },
        { kind: 'libro', label: 'Refactoring UI (Wathan y Schoger)', url: 'https://www.refactoringui.com', format: 'online' },
      ],
    },

    // ── Frontend con IA (noroeste) ──────────────────────────────────────────
    {
      id: 'frontend/generar-ui-con-ia',
      name: 'Generar UI con IA',
      kind: 'skill',
      area: 'frontend-ia',
      x: 22,
      y: 28,
      weight: 3,
      prereqs: ['frontend/componentes'],
      keyPoints: [
        'Da contexto de diseño en el prompt: tokens, componentes existentes, framework y ejemplos del proyecto.',
        'Genera por piezas (un componente, un estado) y compón tú: pedir «la página entera» produce monolitos.',
        'Revisa SIEMPRE lo generado contra tu checklist: semántica, a11y, estados de error, consistencia con el sistema.',
        'Itera con capturas: enseñar a la IA el resultado renderizado mejora la siguiente vuelta.',
        'Herramientas de UI generativa (v0 y similares) para explorar; el código que integras pasa por tu revisión.',
      ],
      aiFocus:
        'Esta es la nueva habilidad núcleo del frontend: dirigir a la IA para producir UI y auditar el resultado con ojo de profesional. Profundiza en tu checklist de revisión (semántica, a11y, estados, tokens) — la velocidad la pone el modelo, el estándar de calidad lo pones tú.',
      resources: [
        { kind: 'doc', label: 'v0 by Vercel — UI generativa', url: 'https://v0.dev' },
        { kind: 'post', label: 'Addy Osmani — desarrollo asistido por IA', url: 'https://addyosmani.com' },
      ],
    },
    {
      id: 'frontend/prototipado-ia',
      name: 'Prototipado rápido',
      kind: 'skill',
      area: 'frontend-ia',
      x: 10,
      y: 20,
      weight: 2,
      prereqs: ['frontend/generar-ui-con-ia'],
      keyPoints: [
        'Usa la IA para materializar ideas en minutos: tres variantes navegables valen más que un documento.',
        'Prototipa para decidir, no para entregar: el objetivo es aprender del usuario, no acumular código.',
        'Sé explícito con el descarte: el prototipo se tira o se reescribe con calidad, nunca «se aprovecha tal cual».',
        'Datos falsos realistas: textos largos, listas vacías y nombres reales enseñan más que lorem ipsum.',
        'Enseña el prototipo pronto: feedback sobre algo clicable llega el triple de rápido.',
      ],
      aiFocus:
        'La IA ha vuelto casi gratis el prototipado: la tentación nueva es que el prototipo acabe en producción sin pasar por calidad. Profundiza en separar los dos modos — explorar rápido y sucio, consolidar lento y limpio — y en comunicar al equipo en cuál estás.',
      resources: [
        { kind: 'libro', label: 'Shape Up (Basecamp) — gratis en la web', url: 'https://basecamp.com/shapeup', format: 'online' },
        { kind: 'post', label: 'Nielsen Norman Group — prototipado y UX', url: 'https://www.nngroup.com' },
      ],
    },
    {
      id: 'frontend/css-generado-revision',
      name: 'Domar el CSS generado',
      kind: 'skill',
      area: 'frontend-ia',
      x: 6,
      y: 36,
      weight: 2,
      prereqs: ['frontend/generar-ui-con-ia', 'frontend/css-moderno'],
      keyPoints: [
        'Reconoce el CSS-espagueti de IA: valores mágicos, estilos duplicados, !important y utilidades mezcladas con CSS a mano.',
        'Exige que use tus tokens y tu convención (utility-first O componentes, no ambas a la vez).',
        'Pide siempre la versión simple: si un layout generado usa position absolute y cálculos, casi seguro hay un grid mejor.',
        'Borra el CSS muerto en cada revisión: lo generado acumula reglas que ya no aplican a nada.',
        'Ancla los estilos base con el design system para que cada generación no reinvente la rueda.',
      ],
      aiFocus:
        'El CSS es donde peor envejece el código generado: cada iteración parchea la anterior hasta que nadie sabe qué regla gana. Profundiza en cascada y arquitectura CSS (capas, tokens, convención única) — con esa vara mides cada bloque generado y mantienes la hoja de estilos podada.',
      resources: [
        { kind: 'doc', label: 'MDN — cascada, especificidad y capas', url: 'https://developer.mozilla.org/es/docs/Web/CSS' },
        { kind: 'doc', label: 'CUBE CSS — una convención para domar el CSS', url: 'https://cube.fyi' },
      ],
    },
    {
      id: 'frontend/mantener-ui-ia',
      name: 'Mantener UI generada',
      kind: 'skill',
      area: 'frontend-ia',
      x: 18,
      y: 10,
      weight: 2,
      prereqs: ['frontend/prototipado-ia', 'frontend/testing-frontend'],
      keyPoints: [
        'Refactoriza lo generado hacia tus patrones antes de que eche raíces: nombres, extracción de componentes, tokens.',
        'Tests de comportamiento como arnés: te permiten regenerar o refactorizar UI sin miedo.',
        'Detecta duplicación entre generaciones: la IA reescribe componentes casi iguales en vez de reutilizar los tuyos.',
        'Documenta las decisiones de diseño en el repo: es el contexto que hará mejores las generaciones futuras.',
        'Presupuesta la poda: cada sprint con mucha generación necesita su rato de consolidación.',
      ],
      aiFocus:
        'El coste de la UI generada no está en escribirla sino en vivir con ella: duplicación, deriva visual y componentes huérfanos. Profundiza en refactoring continuo y en convertir tu proyecto en buen contexto (patrones claros, ejemplos canónicos) — así cada generación sale mejor que la anterior.',
      resources: [
        { kind: 'libro', label: 'Refactoring (Martin Fowler)', format: 'papel' },
        { kind: 'post', label: 'Simon Willison — trabajar con código generado', url: 'https://simonwillison.net' },
      ],
    },
    {
      id: 'frontend/frontend-era-ia',
      name: 'Frontend en la era IA',
      kind: 'milestone',
      area: 'frontend-ia',
      x: 34,
      y: 6,
      weight: 3,
      prereqs: ['frontend/interfaz-produccion', 'frontend/css-generado-revision', 'frontend/mantener-ui-ia'],
      keyPoints: [
        'Integras el ciclo completo: generas UI con IA, la auditas (a11y, vitals, seguridad) y la mantienes consistente.',
        'Tu valor ya no es maquetar rápido: es criterio de diseño, calidad verificada y arquitectura de frontend.',
        'El design system y los tests son tu contrato con la IA: lo que no encaja, no entra.',
        'Sigues aprendiendo la plataforma web: cada API nativa que dominas es una dependencia menos.',
      ],
      aiFocus:
        'Milestone final: la IA produce interfaz a demanda y tú respondes por lo que llega al usuario — accesible, rápido y coherente. A partir de aquí tu crecimiento va por diseño de sistemas de UI y por el criterio de producto que ningún modelo trae de serie.',
      resources: [
        { kind: 'doc', label: 'web.dev — mantente al día de la plataforma', url: 'https://web.dev' },
        { kind: 'post', label: 'Frontend Masters Blog — tendencias frontend', url: 'https://frontendmasters.com/blog/' },
      ],
    },
  ],
};
