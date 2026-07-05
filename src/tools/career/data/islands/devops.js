/**
 * Isla «DevOps» (doc /careerMap/devops) — contenido curado MC-16, oleada 2.
 *
 * Sigue la convención de contenido de islas (ver cabecera de ./bases.js):
 * ids de ciudad prefijados 'devops/', prereqs internos sin ciclos, posiciones
 * 0..100 separadas, pesos 1..3 y contenido en español con lente era-IA.
 * Referencia temática: roadmap.sh/devops, adaptado — la IA genera IaC,
 * pipelines y manifests en segundos; el mapa pone el peso en entender el
 * sistema, revisar antes de aplicar y operar con cabeza: el blast radius
 * de un `apply` no perdona.
 *
 * @typedef {import('../../domain/types.js').CareerMap} CareerMap
 */

/** @type {CareerMap} */
export const DEVOPS_ISLAND = {
  id: 'devops',
  name: 'Isla DevOps',
  startPort: { x: 50, y: 88 },
  areas: [
    { id: 'sistema', name: 'Sistema y red' },
    { id: 'contenedores', name: 'Contenedores y orquestación' },
    { id: 'entrega', name: 'Automatización y entrega' },
    { id: 'observabilidad', name: 'Observabilidad' },
    { id: 'fiabilidad', name: 'Fiabilidad y coste' },
    { id: 'ia', name: 'DevOps con IA' },
  ],
  cities: [
    // ── Sistema y red (sur, comarca de entrada) ─────────────────────────────
    {
      id: 'devops/linux',
      name: 'Linux',
      kind: 'tech',
      area: 'sistema',
      x: 42,
      y: 76,
      weight: 3,
      summary: 'Linux es el sistema donde vive casi todo el software del mundo: servidores, contenedores y la nube. Consiste en moverte por el sistema de ficheros, procesos, permisos y servicios. Te capacita para operar los entornos donde tu código realmente se ejecuta.',
      prereqs: [],
      keyPoints: [
        'Procesos, señales y systemd: qué corre, quién lo lanzó y cómo pararlo con elegancia.',
        'Sistema de ficheros, permisos y usuarios: la mitad de los incidentes son un permiso mal puesto.',
        'Diagnóstico con lo que hay: top, df, ss, journalctl — en el servidor roto no hay dashboards.',
        'Gestión de paquetes y actualizaciones de seguridad sin romper el servicio.',
        'SSH a fondo: claves, agentes, túneles y config por host.',
      ],
      aiFocus:
        'La IA te da el comando exacto para casi cualquier tarea de administración, y lo ejecutarás con permisos de root: entender qué hace ANTES de pulsar Enter es tu cinturón de seguridad. Profundiza en el modelo del sistema (procesos, ficheros, permisos) — sin él no puedes juzgar recetas ajenas.',
      resources: [
        { kind: 'curso', label: 'The Missing Semester of Your CS Education (MIT)', url: 'https://missing.csail.mit.edu' },
        { kind: 'libro', label: 'How Linux Works (Brian Ward)', format: 'papel' },
        { kind: 'doc', label: 'roadmap.sh — DevOps', url: 'https://roadmap.sh/devops' },
      ],
    },
    {
      id: 'devops/shell-scripting',
      name: 'Shell y scripting',
      kind: 'tech',
      area: 'sistema',
      x: 30,
      y: 76,
      weight: 2,
      summary: 'El shell y el scripting son automatizar tareas encadenando comandos en scripts repetibles. Consiste en escribir bash robusto que hace lo mismo cada vez. Te capacita para eliminar el trabajo manual que se olvida o se hace mal a las tres de la mañana.',
      prereqs: ['devops/linux'],
      keyPoints: [
        'Pipes, redirecciones y exit codes: la shell como pegamento de todo lo demás.',
        'Scripts robustos: set -euo pipefail, comillas correctas y manejo de errores.',
        'Las herramientas de siempre: grep, sed, awk, jq, curl — el 80% del trabajo diario.',
        'Idempotencia: un script que se puede ejecutar dos veces sin romper nada.',
        'Cuándo abandonar bash: pasado cierto tamaño, Python o Go pagan el cambio.',
      ],
      aiFocus:
        'La IA escribe one-liners y scripts mejor que la mayoría de humanos, incluidos los que borran lo que no debían. Léelos línea a línea antes de ejecutarlos con privilegios: profundiza en quoting, globbing y exit codes — los tres sitios donde un script generado «correcto» arrasa un directorio.',
      resources: [
        { kind: 'doc', label: 'Manual de GNU Bash', url: 'https://www.gnu.org/software/bash/manual/' },
        { kind: 'doc', label: 'ShellCheck — linter de shell', url: 'https://www.shellcheck.net' },
        { kind: 'post', label: 'Julia Evans — zines de sistemas', url: 'https://jvns.ca' },
      ],
    },
    {
      id: 'devops/redes',
      name: 'Redes',
      kind: 'tech',
      area: 'sistema',
      x: 54,
      y: 76,
      weight: 2,
      summary: 'Las redes son entender cómo se comunican las máquinas: IPs, puertos, DNS, TLS y firewalls. Consiste en saber por dónde va el tráfico y por qué a veces no llega. Te capacita para diagnosticar los problemas de conectividad que bloquean cualquier despliegue.',
      prereqs: ['devops/linux'],
      keyPoints: [
        'DNS de verdad: resolución, TTLs, registros — está detrás de la mitad de los «está caído».',
        'TCP/IP y HTTP en la práctica: puertos, handshakes, códigos de estado, keep-alive.',
        'TLS y certificados: qué se firma, qué caduca y cómo renovarlo sin sustos.',
        'Balanceadores, proxies inversos y firewalls: por dónde pasa una petición hasta tu servicio.',
        'Depura con evidencia: dig, curl -v, traceroute, tcpdump básico.',
      ],
      aiFocus:
        'La IA explica cualquier concepto de red y sugiere diagnósticos, pero no puede ver TU red: qué DNS responde, qué firewall corta, qué certificado caducó anoche. Profundiza en capturar evidencia (dig, curl, tcpdump) — con datos reales, sus hipótesis valen; sin ellos, especuláis los dos.',
      resources: [
        { kind: 'doc', label: 'Cloudflare Learning Center', url: 'https://www.cloudflare.com/learning/' },
        { kind: 'doc', label: 'MDN — HTTP', url: 'https://developer.mozilla.org/es/docs/Web/HTTP' },
      ],
    },

    // ── Contenedores y orquestación (oeste) ─────────────────────────────────
    {
      id: 'devops/docker',
      name: 'Docker y contenedores',
      kind: 'tech',
      area: 'contenedores',
      x: 30,
      y: 66,
      weight: 3,
      summary: 'Docker y los contenedores son empaquetar tu app con todo lo que necesita para que corra igual en cualquier sitio. Consiste en construir imágenes y ejecutar contenedores reproducibles. Te capacita para acabar con el «en mi máquina funciona» de una vez.',
      prereqs: ['devops/linux'],
      keyPoints: [
        'Qué es un contenedor de verdad: namespaces y cgroups, no una VM ligera.',
        'Dockerfiles bien hechos: capas, caché, multi-stage y usuarios no-root.',
        'Imágenes mínimas: menos superficie de ataque y despliegues más rápidos.',
        'Volúmenes y redes: dónde viven los datos y cómo se hablan los contenedores.',
        'Docker Compose para entornos locales reproducibles.',
      ],
      aiFocus:
        'La IA escribe Dockerfiles funcionales al primer intento — con root, imágenes gordas y secretos copiados dentro si no la vigilas. Profundiza en el modelo de capas y en seguridad de imágenes: revisar un Dockerfile generado exige saber qué acaba dentro de la imagen y quién puede leerla.',
      resources: [
        { kind: 'doc', label: 'Docker — documentación oficial', url: 'https://docs.docker.com' },
        { kind: 'curso', label: 'Play with Docker — laboratorio', url: 'https://labs.play-with-docker.com' },
      ],
    },
    {
      id: 'devops/registro-artefactos',
      name: 'Imágenes y registros',
      kind: 'skill',
      area: 'contenedores',
      x: 18,
      y: 66,
      weight: 1,
      summary: 'Las imágenes y los registros son construir bien tus contenedores y guardarlos donde el resto los pueda usar. Consiste en optimizar imágenes, etiquetarlas y versionarlas. Te capacita para distribuir tus builds de forma ordenada y segura por todo el pipeline.',
      prereqs: ['devops/docker'],
      keyPoints: [
        'Registros de imágenes: publicar, versionar y limpiar (las imágenes viejas cuestan dinero).',
        'Tags con criterio: inmutables por versión; «latest» en producción es una apuesta.',
        'Escaneo de vulnerabilidades en la imagen antes de desplegarla, no después del incidente.',
        'Firmas y procedencia (SBOM, sigstore): saber qué contiene lo que ejecutas.',
      ],
      aiFocus:
        'La IA genera los pipelines de build y push en segundos, y con la misma soltura te deja «latest» en producción y CVEs sin escanear. Profundiza en la cadena de suministro: qué imagen corre exactamente en producción y de dónde salió es una pregunta que debes poder responder siempre.',
      resources: [
        { kind: 'doc', label: 'Open Container Initiative', url: 'https://opencontainers.org' },
        { kind: 'doc', label: 'Docker — documentación oficial', url: 'https://docs.docker.com' },
      ],
    },
    {
      id: 'devops/kubernetes',
      name: 'Kubernetes',
      kind: 'tech',
      area: 'contenedores',
      x: 30,
      y: 56,
      weight: 3,
      summary: 'Kubernetes es el orquestador que gestiona contenedores a escala: los despliega, los reinicia y los escala solo. Consiste en describir el estado deseado y dejar que él lo mantenga. Te capacita para operar aplicaciones grandes y resilientes sin hacerlo todo a mano.',
      prereqs: ['devops/docker'],
      keyPoints: [
        'El modelo declarativo: describes el estado deseado y los controladores reconcilian.',
        'Objetos esenciales: Pod, Deployment, Service, Ingress, ConfigMap y Secret.',
        'Requests, limits y probes: sin ellos el scheduler y los reinicios juegan en tu contra.',
        'kubectl como lupa: describe, logs, events, exec — depurar es leer el estado real.',
        'Namespaces y RBAC básico: quién puede tocar qué dentro del clúster.',
      ],
      aiFocus:
        'La IA escupe manifests YAML correctos de sintaxis y alegres de recursos: sin limits, sin probes, con privilegios de más. Profundiza en el bucle de reconciliación y en leer el estado real con kubectl — revisar YAML generado sin entender qué hará el clúster con él es firmar cheques en blanco.',
      resources: [
        { kind: 'doc', label: 'Kubernetes — documentación en español', url: 'https://kubernetes.io/es/docs/' },
        { kind: 'curso', label: 'Kubernetes the Hard Way (Kelsey Hightower)', url: 'https://github.com/kelseyhightower/kubernetes-the-hard-way' },
        { kind: 'libro', label: 'Kubernetes in Action (Marko Lukša)', format: 'papel' },
      ],
    },
    {
      id: 'devops/helm',
      name: 'Helm y empaquetado',
      kind: 'tech',
      area: 'contenedores',
      x: 18,
      y: 56,
      weight: 2,
      summary: 'Helm y el empaquetado son plantillas para desplegar aplicaciones en Kubernetes sin repetir YAML. Consiste en parametrizar despliegues reutilizables (charts). Te capacita para instalar y versionar aplicaciones complejas en el clúster de forma limpia.',
      prereqs: ['devops/kubernetes'],
      keyPoints: [
        'Charts: empaquetar una app con sus valores por entorno (dev, staging, prod).',
        'helm template y diff: mira SIEMPRE el YAML final antes de instalar.',
        'Charts de terceros: léelos antes de desplegarlos; instalan lo que ellos quieren.',
        'Kustomize como alternativa sin plantillas: overlays sobre manifests base.',
        'Versiona los values en git: el chart sin sus valores no reproduce nada.',
      ],
      aiFocus:
        'Las plantillas de Helm (Go templates sobre YAML) son ilegibles para humanos y cómodas para la IA: deja que las escriba ella. Tu control de calidad es «helm template» — profundiza en revisar el YAML renderizado final, porque es lo único que el clúster verá de verdad.',
      resources: [
        { kind: 'doc', label: 'Helm — documentación oficial', url: 'https://helm.sh' },
        { kind: 'doc', label: 'Kustomize', url: 'https://kustomize.io' },
      ],
    },

    // ── Automatización y entrega (centro-este) ──────────────────────────────
    {
      id: 'devops/ci',
      name: 'Integración continua',
      kind: 'skill',
      area: 'entrega',
      x: 54,
      y: 66,
      weight: 3,
      summary: 'La integración continua es que cada cambio se compile y pase los tests automáticamente al subirlo. Consiste en montar pipelines que validan antes de fusionar. Te capacita para detectar los fallos en minutos en vez de descubrirlos en producción.',
      prereqs: ['devops/shell-scripting'],
      keyPoints: [
        'Pipeline mínimo en cada push: build, lint, tests — rápido o el equipo lo ignorará.',
        'Pipelines como código versionado, con pasos reproducibles en local.',
        'Caché de dependencias y paralelización: un CI de 40 minutos es un CI muerto.',
        'Secretos en el CI: variables protegidas u OIDC, jamás en el YAML.',
        'El pipeline es el contrato del equipo: si está rojo, no se mergea.',
      ],
      aiFocus:
        'Los YAML de CI son el territorio favorito de la IA: te monta el pipeline entero con caché y matrices en un prompt. Revísalo como código con privilegios que es — profundiza en permisos de tokens, secretos expuestos en logs y triggers de terceros: un pipeline es superficie de ataque, no solo automatización.',
      resources: [
        { kind: 'doc', label: 'GitHub Actions — documentación', url: 'https://docs.github.com/actions' },
        { kind: 'post', label: 'Continuous Integration (Martin Fowler)', url: 'https://martinfowler.com/articles/continuousIntegration.html' },
      ],
    },
    {
      id: 'devops/cd-estrategias',
      name: 'Despliegue continuo',
      kind: 'skill',
      area: 'entrega',
      x: 54,
      y: 56,
      weight: 2,
      summary: 'El despliegue continuo y sus estrategias son llevar los cambios a producción de forma segura y frecuente. Consiste en automatizar releases con canary, blue-green o rolling. Te capacita para desplegar varias veces al día sin miedo y con marcha atrás si algo falla.',
      prereqs: ['devops/ci', 'devops/docker'],
      keyPoints: [
        'Estrategias de despliegue: rolling, blue/green y canary — y qué problema resuelve cada una.',
        'Feature flags: separar desplegar de publicar; el código llega apagado.',
        'Rollback ensayado: si volver atrás no es un botón, no tienes rollback.',
        'Migraciones de base de datos compatibles hacia atrás: expandir, migrar, contraer.',
        'Desplegar en viernes es legítimo justo cuando todo lo anterior funciona.',
      ],
      aiFocus:
        'La IA te configura el canary o el blue/green del tirón, pero elegir estrategia depende de lo que ella no ve: tu tráfico, tu coste de error, tu capacidad de rollback. Profundiza en los trade-offs de cada patrón y en ensayar la vuelta atrás — el despliegue perfecto es el que puedes deshacer.',
      resources: [
        { kind: 'libro', label: 'Continuous Delivery (Humble y Farley)', format: 'papel' },
        { kind: 'post', label: 'BlueGreenDeployment (Martin Fowler)', url: 'https://martinfowler.com/bliki/BlueGreenDeployment.html' },
      ],
    },
    {
      id: 'devops/gitops',
      name: 'GitOps',
      kind: 'tech',
      area: 'entrega',
      x: 42,
      y: 56,
      weight: 2,
      summary: 'GitOps es operar la infraestructura declarando su estado en Git como fuente de verdad. Consiste en que un cambio en el repo se aplique solo al clúster. Te capacita para tener despliegues auditables, reproducibles y con historial completo.',
      prereqs: ['devops/kubernetes', 'devops/ci'],
      keyPoints: [
        'Git como fuente de verdad: lo desplegado es lo que dice el repo, nada más.',
        'Reconciliación continua (Argo CD, Flux): el drift se detecta y corrige solo.',
        'Todo cambio de infra pasa por PR: revisión y auditoría gratis.',
        'Estructura de repos por entorno: promocionar es un merge, no un script.',
        'El clúster se reconstruye desde git: ese es el test de que haces GitOps de verdad.',
      ],
      aiFocus:
        'GitOps convierte la operación en PRs, y las PRs son justo lo que sabes revisar — también las que genera un agente. Profundiza en el modelo de reconciliación y en estructurar los repos: con GitOps, el «deja que la IA lo despliegue» se vuelve auditable en vez de terrorífico.',
      resources: [
        { kind: 'doc', label: 'Argo CD — documentación', url: 'https://argo-cd.readthedocs.io' },
        { kind: 'doc', label: 'OpenGitOps — principios', url: 'https://opengitops.dev' },
      ],
    },
    {
      id: 'devops/cloud',
      name: 'Un proveedor cloud',
      kind: 'tech',
      area: 'entrega',
      x: 66,
      y: 66,
      weight: 3,
      summary: 'Dominar un proveedor cloud es saber usar de verdad AWS, GCP o Azure: cómputo, redes, almacenamiento e identidad. Consiste en montar infraestructura con sus servicios en vez de a mano. Te capacita para construir sistemas que escalan sin comprar servidores.',
      prereqs: ['devops/redes'],
      keyPoints: [
        'Domina UNO (AWS, GCP o Azure): los conceptos se transfieren, el detalle no.',
        'Los básicos de cualquier nube: cómputo, almacenamiento de objetos, redes (VPC), base de datos gestionada.',
        'IAM antes que nada: identidades, roles y mínimo privilegio — es la seguridad real del cloud.',
        'El modelo de responsabilidad compartida: qué asegura el proveedor y qué te toca a ti.',
        'Presupuestos y alertas de gasto desde el día uno, no tras la primera factura sorpresa.',
      ],
      aiFocus:
        'La IA conoce las APIs de los tres grandes mejor que tú y te da el comando o la consola exacta al momento — también el que abre un bucket al mundo. Profundiza en IAM y en el modelo de costes: son las dos áreas donde un error generado y aplicado sin criterio sale carísimo.',
      resources: [
        { kind: 'doc', label: 'AWS — documentación', url: 'https://docs.aws.amazon.com' },
        { kind: 'doc', label: 'Google Cloud — documentación', url: 'https://cloud.google.com/docs' },
      ],
    },
    {
      id: 'devops/terraform',
      name: 'Terraform e IaC',
      kind: 'tech',
      area: 'entrega',
      x: 66,
      y: 56,
      weight: 3,
      summary: 'Terraform y la IaC son definir tu infraestructura como código versionado en vez de clicando en consolas. Consiste en describir recursos y aplicarlos de forma repetible. Te capacita para levantar y reproducir entornos enteros con un comando.',
      prereqs: ['devops/cloud'],
      keyPoints: [
        'Infraestructura declarativa: recursos, variables, módulos y outputs.',
        'El estado es sagrado: remoto, con lock, y jamás editado a mano.',
        'terraform plan es tu code review con la realidad: léelo entero antes de aplicar.',
        'Módulos reutilizables con moderación: la indirección también es deuda.',
        'Importar lo que ya existe y detectar drift: la infra de verdad nunca parte de cero.',
      ],
      aiFocus:
        'La IA genera módulos de Terraform enteros y suelen funcionar — el peligro es que «funcionar» incluya recrear una base de datos con datos dentro. El plan es tu frontera: profundiza en leer plans (destroy, replace, cambios en cadena) porque es el último control antes de que lo generado toque el mundo real.',
      resources: [
        { kind: 'doc', label: 'Terraform — documentación oficial', url: 'https://developer.hashicorp.com/terraform' },
        { kind: 'doc', label: 'OpenTofu', url: 'https://opentofu.org' },
        { kind: 'libro', label: 'Terraform: Up & Running (Yevgeniy Brikman)', format: 'papel' },
      ],
    },
    {
      id: 'devops/configuracion',
      name: 'Gestión de configuración',
      kind: 'tech',
      area: 'entrega',
      x: 78,
      y: 66,
      weight: 1,
      summary: 'La gestión de configuración es separar los ajustes del código para que la misma app corra en dev, staging y producción. Consiste en variables de entorno y configuración por entorno. Te capacita para desplegar el mismo build en todas partes cambiando solo la config.',
      prereqs: ['devops/shell-scripting'],
      keyPoints: [
        'Ansible básico: inventarios, playbooks y roles para configurar máquinas en serie.',
        'Idempotencia como contrato: ejecutar dos veces deja el mismo resultado.',
        'cloud-init para el arranque de máquinas en cloud.',
        'Cuándo NO usarlo: si todo son contenedores e imágenes, quizá no necesitas Ansible.',
      ],
      aiFocus:
        'Los playbooks son otro YAML que la IA borda, y otra vía de ejecutar cambios masivos en decenas de máquinas de golpe. Profundiza en idempotencia y en --check/--diff antes de lanzar: el modo de ensayo es a Ansible lo que el plan a Terraform — tu último vistazo antes del blast radius.',
      resources: [
        { kind: 'doc', label: 'Ansible — documentación oficial', url: 'https://docs.ansible.com' },
        { kind: 'doc', label: 'cloud-init — documentación', url: 'https://cloudinit.readthedocs.io' },
      ],
    },
    {
      id: 'devops/secretos',
      name: 'Gestión de secretos',
      kind: 'skill',
      area: 'entrega',
      x: 78,
      y: 56,
      weight: 2,
      summary: 'La gestión de secretos es guardar contraseñas, claves y tokens sin que acaben en el código ni en un chat. Consiste en usar un gestor de secretos y rotarlos. Te capacita para operar de forma segura y no ser la próxima filtración de credenciales.',
      prereqs: ['devops/cloud'],
      keyPoints: [
        'Los secretos nunca en git ni en la imagen: gestor de secretos o secretos del proveedor.',
        'Rotación: un secreto que no puedes rotar en minutos es un incidente en diferido.',
        'Identidades efímeras (OIDC, roles) mejor que claves estáticas de larga vida.',
        'Mínimo privilegio por servicio: cada app lee SOLO sus secretos.',
        'Auditoría: quién leyó qué secreto y cuándo debe quedar registrado.',
      ],
      aiFocus:
        'Los ejemplos con los que se entrenó la IA están llenos de claves hardcodeadas, y los reproduce; además, cada secreto que pegas en un prompt sale de tu perímetro. Profundiza en identidades efímeras y rotación — y trata a tus propios asistentes como un actor más al que aplicar mínimo privilegio.',
      resources: [
        { kind: 'doc', label: 'Vault — documentación', url: 'https://developer.hashicorp.com/vault' },
        { kind: 'doc', label: 'OWASP Cheat Sheet Series', url: 'https://cheatsheetseries.owasp.org' },
      ],
    },

    // ── Observabilidad (este) ───────────────────────────────────────────────
    {
      id: 'devops/logs',
      name: 'Logs centralizados',
      kind: 'tech',
      area: 'observabilidad',
      x: 90,
      y: 56,
      weight: 2,
      summary: 'Los logs centralizados son recoger lo que escupen todos tus servicios en un solo sitio consultable. Consiste en enviar, estructurar y buscar logs sin entrar máquina por máquina. Te capacita para diagnosticar un problema en segundos en vez de en horas.',
      prereqs: ['devops/kubernetes'],
      keyPoints: [
        'Logs a stdout y un agente los recoge: la app no gestiona ficheros de log.',
        'Logs estructurados (JSON) con niveles y contexto: request id, servicio, versión.',
        'Centralización consultable (Loki, Elastic, CloudWatch): grep no escala a veinte pods.',
        'Retención con cabeza: los logs infinitos son una factura infinita.',
        'Nunca datos personales ni secretos en los logs: es fuga y es sanción.',
      ],
      aiFocus:
        'Pega un log criptico a la IA y te lo traduce; dale acceso a los logs centralizados y te resume el incidente. Para eso los logs deben existir y ser estructurados: profundiza en diseñar QUÉ loguear — el contexto que tú emitas hoy es la materia prima del diagnóstico asistido de mañana.',
      resources: [
        { kind: 'doc', label: 'Grafana Loki', url: 'https://grafana.com/oss/loki/' },
        { kind: 'doc', label: 'The Twelve-Factor App', url: 'https://12factor.net' },
      ],
    },
    {
      id: 'devops/metricas',
      name: 'Métricas y dashboards',
      kind: 'tech',
      area: 'observabilidad',
      x: 78,
      y: 46,
      weight: 3,
      summary: 'Las métricas y los dashboards son medir cómo va tu sistema en números: latencia, errores, uso. Consiste en instrumentar, recoger y visualizar lo que importa. Te capacita para ver la salud del sistema de un vistazo y detectar problemas antes de que exploten.',
      prereqs: ['devops/kubernetes'],
      keyPoints: [
        'Prometheus y el modelo pull: exporters, series temporales y PromQL básico.',
        'Las cuatro señales doradas: latencia, tráfico, errores y saturación.',
        'Percentiles, no medias: el p99 es donde viven tus usuarios enfadados.',
        'Dashboards que responden preguntas concretas, no wallpapers de líneas.',
        'Instrumenta tu app: las métricas de negocio valen más que las de CPU.',
      ],
      aiFocus:
        'La IA escribe PromQL y genera dashboards de Grafana por descripción — se acabó pelearse con la sintaxis. Decidir QUÉ medir sigue siendo tuyo: profundiza en las señales doradas y percentiles, porque un dashboard generado sobre métricas irrelevantes es ruido con buena pinta.',
      resources: [
        { kind: 'doc', label: 'Prometheus — documentación', url: 'https://prometheus.io' },
        { kind: 'doc', label: 'Grafana — documentación', url: 'https://grafana.com' },
      ],
    },
    {
      id: 'devops/trazas',
      name: 'Trazas distribuidas',
      kind: 'tech',
      area: 'observabilidad',
      x: 90,
      y: 46,
      weight: 2,
      summary: 'Las trazas distribuidas son seguir una petición a través de todos los servicios por los que pasa. Consiste en propagar contexto y ver el recorrido completo. Te capacita para encontrar dónde se pierde el tiempo en un sistema con muchas piezas.',
      prereqs: ['devops/metricas'],
      keyPoints: [
        'Una petición, muchos servicios: la traza reconstruye el viaje completo.',
        'OpenTelemetry como estándar: instrumenta una vez, exporta a donde quieras.',
        'Spans, contexto propagado y atributos: qué anotar para que la traza cuente algo.',
        'Sampling: trazar todo es caro; trazar lo interesante es un arte.',
        'La traza responde el «dónde se fue el tiempo» que logs y métricas no ven.',
      ],
      aiFocus:
        'Instrumentar con OpenTelemetry es boilerplate que la IA genera bien; interpretar una traza de 40 spans para encontrar el cuello real ya es análisis compartido: ella resume, tú contrastas con lo que sabes del sistema. Profundiza en propagación de contexto — donde se corta la traza, se corta el diagnóstico.',
      resources: [
        { kind: 'doc', label: 'OpenTelemetry', url: 'https://opentelemetry.io' },
        { kind: 'doc', label: 'Jaeger — tracing distribuido', url: 'https://www.jaegertracing.io' },
      ],
    },
    {
      id: 'devops/alertas',
      name: 'Alertas accionables',
      kind: 'skill',
      area: 'observabilidad',
      x: 66,
      y: 46,
      weight: 2,
      summary: 'Las alertas accionables son avisar cuando algo va mal, pero solo cuando de verdad importa y con qué hacer. Consiste en alertar sobre síntomas del usuario, no sobre ruido. Te capacita para enterarte de los problemas reales sin morir de fatiga de alertas.',
      prereqs: ['devops/metricas'],
      keyPoints: [
        'Alerta = alguien debe actuar YA; lo demás es un dashboard o un ticket.',
        'Alerta sobre síntomas (usuarios afectados), no sobre causas (CPU alta).',
        'Cada alerta con su runbook: qué mirar y qué hacer, escrito antes del incidente.',
        'La fatiga de alertas es real: cada falso positivo entrena al equipo a ignorar la siguiente.',
        'Revisa las alertas cada mes: las que nadie atendió, se ajustan o se borran.',
      ],
      aiFocus:
        'La IA redacta reglas de alerta y runbooks en un momento, y con la misma facilidad te llena el canal de avisos que nadie leerá. Profundiza en el criterio síntoma-vs-causa y en la disciplina de podar: decidir qué merece despertar a alguien a las 4:00 es juicio humano puro.',
      resources: [
        { kind: 'libro', label: 'Site Reliability Engineering (Google)', url: 'https://sre.google/books/', format: 'online' },
        { kind: 'doc', label: 'Prometheus — alerting', url: 'https://prometheus.io' },
      ],
    },

    // ── Fiabilidad y coste (norte) ──────────────────────────────────────────
    {
      id: 'devops/slos',
      name: 'SLOs y presupuestos de error',
      kind: 'skill',
      area: 'fiabilidad',
      x: 54,
      y: 36,
      weight: 3,
      summary: 'Los SLOs y los presupuestos de error son definir cuánta fiabilidad prometes y cuánto fallo te puedes permitir. Consiste en poner objetivos medibles y gestionar el margen. Te capacita para equilibrar entregar rápido y mantener el servicio estable con datos, no opiniones.',
      prereqs: ['devops/alertas'],
      keyPoints: [
        'SLI: qué mides (disponibilidad, latencia). SLO: el objetivo. SLA: el contrato con penalización.',
        'El 100% no existe: cada nueve extra multiplica el coste y frena el producto.',
        'Presupuesto de error: mientras queda, se despliega; agotado, se para y se estabiliza.',
        'SLOs desde la experiencia del usuario, no desde la infraestructura.',
        'El SLO alinea a producto y operaciones con un número que ambos entienden.',
      ],
      aiFocus:
        'La IA calcula burn rates y redacta la definición del SLO, pero elegir el objetivo es una negociación entre coste, riesgo y producto que no se delega. Profundiza en presupuestos de error: son además tu marco para decidir cuánta automatización con IA tolera tu fiabilidad.',
      resources: [
        { kind: 'doc', label: 'Google SRE — recursos y libros', url: 'https://sre.google' },
        { kind: 'libro', label: 'Implementing Service Level Objectives (Alex Hidalgo)', format: 'papel' },
      ],
    },
    {
      id: 'devops/incidentes',
      name: 'Gestión de incidentes',
      kind: 'skill',
      area: 'fiabilidad',
      x: 66,
      y: 36,
      weight: 2,
      summary: 'La gestión de incidentes es responder cuando algo se rompe en producción sin que cunda el pánico. Consiste en detectar, mitigar, comunicar y aprender con un postmortem. Te capacita para convertir un desastre en una crisis controlada de la que el sistema sale más fuerte.',
      prereqs: ['devops/slos'],
      keyPoints: [
        'Roles claros durante el incidente: quién manda, quién comunica, quién teclea.',
        'Primero mitigar, luego entender: el análisis profundo viene después del servicio restaurado.',
        'Comunica estado a intervalos regulares aunque no haya novedades.',
        'Postmortems sin culpables: el fallo es del sistema, la lección es de todos.',
        'Los action items del postmortem se hacen, o el próximo incidente será el mismo.',
      ],
      aiFocus:
        'En pleno incidente la IA acelera lo mecánico: correlaciona logs, resume cambios recientes, redacta las actualizaciones de estado. Las decisiones bajo presión — rollback o parche, a quién escalar — son tuyas. Profundiza en el rol de incident commander: coordinar humanos nerviosos no se automatiza.',
      resources: [
        { kind: 'post', label: 'PagerDuty — guía de incident response', url: 'https://response.pagerduty.com' },
        { kind: 'doc', label: 'Google SRE — postmortems', url: 'https://sre.google' },
      ],
    },
    {
      id: 'devops/finops',
      name: 'FinOps básico',
      kind: 'skill',
      area: 'fiabilidad',
      x: 78,
      y: 36,
      weight: 2,
      summary: 'El FinOps básico es controlar lo que gasta la nube antes de que la factura te dé un susto. Consiste en medir el coste por servicio y optimizar lo que sobra. Te capacita para operar de forma responsable y defender que la infraestructura no se dispara.',
      prereqs: ['devops/cloud', 'devops/metricas'],
      keyPoints: [
        'Visibilidad primero: etiquetas de coste por equipo/servicio o la factura es una caja negra.',
        'Los sospechosos habituales: instancias sobredimensionadas, discos huérfanos, tráfico entre zonas.',
        'Reservas y spot: pagar menos por lo predecible y por lo interrumpible.',
        'El coste es una métrica más: dashboards y alertas de gasto como las de latencia.',
        'Coste por unidad de negocio (por petición, por cliente): la cifra que entiende dirección.',
      ],
      aiFocus:
        'La IA analiza la factura del cloud y sugiere ahorros concretos en minutos — auditor incansable. Las recomendaciones con riesgo (reservar un año, apagar «lo que no se usa») exigen el contexto de negocio que solo tú tienes. Profundiza en atribución de costes: sin etiquetas, ni la IA sabe quién gasta.',
      resources: [
        { kind: 'doc', label: 'FinOps Foundation', url: 'https://www.finops.org' },
        { kind: 'doc', label: 'AWS Well-Architected', url: 'https://aws.amazon.com/architecture/well-architected/' },
      ],
    },
    {
      id: 'devops/plataforma-fiable',
      name: 'Plataforma fiable en producción',
      kind: 'milestone',
      area: 'fiabilidad',
      x: 54,
      y: 26,
      weight: 3,
      summary: 'Una plataforma fiable en producción es el hito de operar un sistema que aguanta, se recupera solo y se observa. Consiste en juntar todo lo de la isla en algo que la gente confía. Te capacita para demostrar que sabes sostener servicios reales, no solo montarlos.',
      prereqs: ['devops/terraform', 'devops/cd-estrategias', 'devops/slos', 'devops/incidentes'],
      keyPoints: [
        'Integras el ciclo completo: commit → pipeline → despliegue → observabilidad → incidente → mejora.',
        'La infraestructura se reconstruye desde git; el conocimiento no vive en la cabeza de nadie.',
        'Mides lo que importa: DORA metrics y SLOs como cuadro de mando del equipo.',
        'Tu valor ya no es ejecutar comandos: es diseñar sistemas que fallan con elegancia.',
      ],
      aiFocus:
        'Has cerrado el bucle DevOps con la IA como copiloto: genera la infraestructura y los pipelines, tú pones los límites, los planes revisados y los SLOs que vigilan el resultado. Profundiza en plataformas para otros equipos — multiplicar a los demás es el siguiente nivel del oficio.',
      resources: [
        { kind: 'doc', label: 'DORA — investigación y métricas', url: 'https://dora.dev' },
        { kind: 'libro', label: 'Accelerate (Forsgren, Humble y Kim)', format: 'papel' },
        { kind: 'doc', label: 'roadmap.sh — DevOps', url: 'https://roadmap.sh/devops' },
      ],
    },

    // ── DevOps con IA (centro-oeste) ────────────────────────────────────────
    {
      id: 'devops/ia-infra',
      name: 'IaC y pipelines con IA',
      kind: 'skill',
      area: 'ia',
      x: 42,
      y: 46,
      weight: 3,
      summary: 'La IaC y los pipelines con IA son usar el modelo para generar y revisar configuración de infraestructura y CI. Consiste en dirigir a la IA y verificar cada cambio, que aquí rompe fuerte. Te capacita para acelerar el trabajo de plataforma sin meter agujeros de seguridad.',
      prereqs: ['devops/terraform', 'devops/ci'],
      keyPoints: [
        'Genera Terraform, manifests y pipelines con IA: es el boilerplate perfecto para delegar.',
        'La regla de oro: todo lo generado pasa por plan/diff/dry-run ANTES de aplicar. Sin excepciones.',
        'El blast radius manda: no es lo mismo un typo en una web que un destroy en la base de datos.',
        'Dale contexto real: versiones de providers, convenciones de naming, módulos existentes.',
        'Policy as code (OPA, checkov) como red: las reglas frenan lo que tu revisión no vio.',
      ],
      aiFocus:
        'Esta es la ciudad que resume la isla: la IA escribe infraestructura más rápido de lo que tú puedes revisarla, y en infra un error no lanza una excepción — borra producción. Profundiza en tus fronteras de verificación (plan, diff, políticas, entornos de prueba): tu oficio es que nada generado llegue al mundo sin pasar por ellas.',
      resources: [
        { kind: 'doc', label: 'GitHub Copilot — documentación', url: 'https://docs.github.com/copilot' },
        { kind: 'post', label: 'Simon Willison — IA aplicada al desarrollo', url: 'https://simonwillison.net' },
        { kind: 'doc', label: 'OWASP Top 10 para aplicaciones LLM', url: 'https://owasp.org/www-project-top-10-for-large-language-model-applications/' },
      ],
    },
    {
      id: 'devops/ia-operaciones',
      name: 'IA en operaciones',
      kind: 'skill',
      area: 'ia',
      x: 30,
      y: 46,
      weight: 2,
      summary: 'La IA en operaciones es apoyarte en el modelo para diagnosticar incidentes, resumir logs y proponer soluciones. Consiste en usarla como copiloto de guardia sin delegarle el criterio. Te capacita para responder más rápido a los problemas sin dejar de ser tú quien decide.',
      prereqs: ['devops/ia-infra'],
      keyPoints: [
        'Diagnóstico asistido: la IA correlaciona logs, métricas y cambios recientes durante un incidente.',
        'Asistentes sobre el clúster (k8sgpt y similares): explican el estado, no lo cambian sin ti.',
        'Runbooks ejecutados por agentes: empieza por los de solo-lectura, gradúa la autonomía.',
        'Todo agente con acceso a producción: identidad propia, mínimo privilegio y auditoría.',
        'Mantén el músculo manual: cuando la IA no esté (o sea el problema), operas tú.',
      ],
      aiFocus:
        'Operar con IA es delegar diagnóstico sin delegar el control de cambios: los agentes leen y proponen, las acciones con blast radius llevan tu aprobación. Profundiza en diseñar esa frontera de permisos — decidir qué puede hacer un agente en producción es la pregunta de seguridad de esta década.',
      resources: [
        { kind: 'doc', label: 'k8sgpt — diagnóstico de Kubernetes con IA', url: 'https://k8sgpt.ai' },
        { kind: 'post', label: 'Honeycomb — blog de observabilidad', url: 'https://www.honeycomb.io/blog' },
      ],
    },
  ],
};
