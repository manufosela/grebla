import { describe, expect, it } from 'vitest';
import { managesSurveys } from './surveyManager.js';

/** Firestore en memoria: solo existen los documentos de `paths`. */
const fakeDb = (...paths) => ({ doc: (p) => ({ get: async () => ({ exists: paths.includes(p) }) }) });

describe('managesSurveys (RMR-TSK-0637) — el servidor da el mismo permiso que las reglas', () => {
  it('gestiona quien tiene el permiso de la herramienta por política (toolManagers)', async () => {
    expect(await managesSurveys(fakeDb('toolManagers/surveys--u1'), 'u1')).toBe(true);
  });

  it('y quien sigue en la colección antigua surveyAdmins', async () => {
    expect(await managesSurveys(fakeDb('surveyAdmins/u1'), 'u1')).toBe(true);
  });

  it('el permiso de otra herramienta o de otra persona no vale', async () => {
    expect(await managesSurveys(fakeDb('toolManagers/docs--u1', 'toolManagers/surveys--u2'), 'u1')).toBe(false);
  });

  it('sin uid, nadie', async () => {
    expect(await managesSurveys(fakeDb('surveyAdmins/'), '')).toBe(false);
  });
});
