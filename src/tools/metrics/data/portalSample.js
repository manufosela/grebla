/**
 * Respuesta REAL del portal (schemaVersion 1), recortada, como fixture de test.
 *
 * No es un ejemplo inventado: son filas que devolvió el endpoint en producción el
 * 26-sep-2026, elegidas porque cada una ejercita una regla del contrato. Un
 * fixture escrito a mano acaba pareciéndose a lo que el autor cree que pasa; este
 * se parece a lo que pasa.
 *
 * Qué ejercita cada fila:
 *  - 2026-07-06: primera de la ventana. SIN `deployFailureRate`, porque ninguno
 *    de sus 2 despliegues trae señal de estado: ausencia REAL, y el caso que
 *    prueba la regla.
 *
 *    También le falta `throughput`, pero eso era un ARTEFACTO del portal, no un
 *    dato: recortaba a 12 semanas y calculaba después, así que la primera fila
 *    publicada se quedaba sin la anterior con la que restar. El hueco se movía
 *    solo —la fila que hoy es la segunda lo habría perdido la semana siguiente—.
 *    Ya está corregido allí (se calculan 13 y se publican 12); el fixture
 *    conserva la fila porque sigue siendo un buen ejemplo de campo ausente, que
 *    es lo único que el test comprueba.
 *  - 2026-09-14: `deployFailureRate` 0 sobre UN solo despliegue con señal. Es un
 *    cero correcto y con base ridícula: sirve para probar el mínimo de base.
 *  - 2026-09-21: semana en curso, `parcial`, con `days` menor que la granularidad.
 *  - `data-team`: 23 PRs mergeadas y 0 revisadas, así que el lead time se OMITE en
 *    vez de mandarse a cero.
 */
export const PORTAL_SAMPLE = Object.freeze({
  schemaVersion: 1,
  granularity: 'weekly',
  timezone: 'UTC',
  weekStart: 'monday',
  dataUpdatedAt: '2026-09-26T04:34:21.144Z',
  calculatedAt: '2026-09-26T20:14:24.405Z',
  noMedible: ['changeFailureRate', 'timeToRestore'],
  global: {
    series: [
      {
        periodStart: '2026-07-06', periodEnd: '2026-07-12', days: 7,
        deploys: 2, deploysConEstado: 0, deploysFallidos: 0,
        mergedPRs: 118, noReviewPRs: 40, wip: 201,
      },
      {
        periodStart: '2026-09-14', periodEnd: '2026-09-20', days: 7,
        deploys: 4, deploysConEstado: 1, deploysFallidos: 0, deployFailureRate: 0,
        mergedPRs: 176, noReviewPRs: 92, wip: 221, throughput: 116,
      },
      {
        periodStart: '2026-09-21', periodEnd: '2026-09-27', days: 5, parcial: true,
        deploys: 10, deploysConEstado: 9, deploysFallidos: 1, deployFailureRate: 0.111,
        mergedPRs: 159, noReviewPRs: 74, wip: 234, throughput: 69,
      },
    ],
    coberturaDespliegues: {
      repos: ['hoop-carpool/hoop-api', 'hoop-carpool/tribbu-deployments'],
      conEstado: ['hoop-carpool/tribbu-deployments'],
      sinEstado: ['hoop-carpool/hoop-api'],
    },
    fueraDeCobertura: [
      { repo: 'hoop-carpool/new-app-ios', motivo: 'no etiqueta releases desde feb-2025; la subida a la App Store es manual' },
      { repo: 'hoop-carpool/hoop-admin', motivo: "su environment 'production' etiqueta el build de imagen, no un despliegue" },
    ],
  },
  repos: [
    {
      repo: 'hoop-carpool/data-team',
      series: [
        {
          periodStart: '2026-09-21', periodEnd: '2026-09-27', parcial: true,
          mergedPRs: 23, reviewedPRs: 0,
        },
      ],
    },
    {
      repo: 'hoop-carpool/hoop-api',
      series: [
        {
          periodStart: '2026-09-21', periodEnd: '2026-09-27', parcial: true,
          mergedPRs: 23, reviewedPRs: 23, leadTimeMedianH: 146.8, leadTimeP85H: 313.6,
        },
      ],
    },
  ],
});
