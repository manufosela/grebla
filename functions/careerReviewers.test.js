import { describe, it, expect } from 'vitest';
import { careerReviewersPatches } from './careerReviewers.js';

const level = (l) => ({ notion: { level: l }, orgBranch: 'engineering' });
const org = [
  { id: 'cto', uid: 'u-cto', ...level('C-level') },
  { id: 'head', uid: 'u-head', reportsToPersonId: 'cto', ...level('Head of') },
  { id: 'em', uid: 'u-em', reportsToPersonId: 'head', ...level('Manager') },
  { id: 'lead', uid: 'u-lead', reportsToPersonId: 'em', ...level('Lead') },
  { id: 'dev', uid: 'u-dev', reportsToPersonId: 'lead', ...level('Individual Contributor') },
];
const NOBODY = { firstUid: null, secondUid: null, arbiterUid: null };
const reviewersOf = (people, id) => careerReviewersPatches(people).find((p) => p.id === id)?.reviewers ?? NOBODY;

describe('careerReviewersPatches: quién acepta las expectativas de cada uno', () => {
  it('ingeniero y lead: su EM y el Head of; desempata el CTO', () => {
    expect(reviewersOf(org, 'dev')).toEqual({ firstUid: 'u-em', secondUid: 'u-head', arbiterUid: 'u-cto' });
    expect(reviewersOf(org, 'lead')).toEqual({ firstUid: 'u-em', secondUid: 'u-head', arbiterUid: 'u-cto' });
  });

  it('EM: el Head of y el CTO; Head of: solo el CTO; el CTO no tiene', () => {
    expect(reviewersOf(org, 'em')).toEqual({ firstUid: 'u-head', secondUid: 'u-cto', arbiterUid: 'u-cto' });
    expect(reviewersOf(org, 'head')).toEqual({ firstUid: 'u-cto', secondUid: null, arbiterUid: null });
    expect(reviewersOf(org, 'cto')).toEqual({ firstUid: null, secondUid: null, arbiterUid: null });
  });

  it('sin EM con cuenta, el CTO ocupa su lugar', () => {
    const noEm = org.map((p) => (p.id === 'em' ? { ...p, uid: null } : p));
    expect(reviewersOf(noEm, 'dev')).toEqual({ firstUid: 'u-cto', secondUid: 'u-head', arbiterUid: 'u-cto' });
  });

  it('si el mismo responsable cubre los dos huecos, queda un solo revisor', () => {
    const noHead = org.filter((p) => p.id !== 'head').map((p) => (p.id === 'em' ? { ...p, reportsToPersonId: 'cto' } : p));
    expect(reviewersOf(noHead, 'em')).toEqual({ firstUid: 'u-cto', secondUid: null, arbiterUid: null });
  });

  it('sin rangos de Notion (demo), revisan los dos jefes con cuenta más cercanos', () => {
    const plain = [
      { id: 'a', uid: 'u-a', orgBranch: 'engineering' },
      { id: 'b', uid: 'u-b', reportsToPersonId: 'a', orgBranch: 'engineering' },
      { id: 'c', uid: 'u-c', reportsToPersonId: 'b', orgBranch: 'engineering' },
    ];
    expect(reviewersOf(plain, 'c')).toEqual({ firstUid: 'u-b', secondUid: 'u-a', arbiterUid: null });
  });

  it('fuera de Tech nadie revisa, y en Tech solo revisan jefes de Tech', () => {
    const otraRama = [...org, { id: 'ops', uid: 'u-ops', reportsToPersonId: 'cto', notion: { level: 'Individual Contributor' }, orgBranch: 'people' }];
    expect(reviewersOf(otraRama, 'ops')).toEqual({ firstUid: null, secondUid: null, arbiterUid: null });
    const jefeDeFuera = [{ id: 'ceo', uid: 'u-ceo', orgBranch: 'executive' }, { id: 'dev', uid: 'u-dev', reportsToPersonId: 'ceo', orgBranch: 'engineering' }];
    expect(reviewersOf(jefeDeFuera, 'dev')).toEqual({ firstUid: null, secondUid: null, arbiterUid: null });
  });

  it('a quien no es de Tech y no tiene revisores no se le escribe nada', () => {
    const ops = [{ id: 'ops', uid: 'u-ops', orgBranch: 'people' }];
    expect(careerReviewersPatches(ops)).toEqual([]);
  });

  it('solo escribe las fichas que cambian', () => {
    const settled = org.map((p) => ({ ...p, careerReviewers: reviewersOf(org, p.id) }));
    expect(careerReviewersPatches(settled)).toEqual([]);
  });
});
