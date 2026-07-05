/**
 * Tests del dominio de TRIBBU-COINS (CP-2): contratos, canónico estable,
 * cadena de hashes, contratos por apunte, saldos, checkpoint y firma.
 *
 * Las firmas de prueba se generan con node:crypto (EC P-256 + DER, el mismo
 * formato que Cloud KMS) — NUNCA se llama a GCP desde los tests.
 */
import { describe, it, expect } from 'vitest';
import { createSign, generateKeyPairSync } from 'node:crypto';
import {
  RULE_VERSION,
  GENESIS_HASH,
  CONTRACTS_V1,
  cityKey,
  certEntryId,
  citizenshipEntryId,
  badgeEntryId,
  carpoolEntryId,
  canonicalJson,
  canonicalEntry,
  entryHash,
  verifyChain,
  expectedDelta,
  verifyEntryAgainstRule,
  computeBalances,
  diffBalances,
  verifyCheckpoint,
  importCoinsPublicKey,
  verifyEntrySignature,
  verifyLedger,
  entryLabel,
  coinsFillLevel,
} from './coins.js';

/**
 * Construye un ledger encadenado válido a partir de borradores (espejo del
 * emisor de functions/): seq contiguo, prevHash enlazado y hash recomputado.
 * @param {Array<Record<string, unknown>>} drafts
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function buildLedger(drafts) {
  const entries = [];
  let prevHash = GENESIS_HASH;
  let seq = 0;
  for (const draft of drafts) {
    seq += 1;
    const entry = { ruleVersion: RULE_VERSION, ts: '2026-07-04T10:00:00.000Z', ...draft, seq, prevHash };
    entry.hash = await entryHash(entry);
    prevHash = entry.hash;
    entries.push(entry);
  }
  return entries;
}

/** Borrador de un apunte de certificado válido. */
function certDraft(personId = 'p1', cityId = 'bases/git', weight = 1) {
  return {
    id: certEntryId(personId, cityId),
    personId,
    delta: CONTRACTS_V1.certificate(weight),
    reason: `Certificado de ${cityId}`,
    ruleId: 'certificate',
    refs: { cityId, cityName: cityId, islandId: 'island', weight },
  };
}

/** Borrador de un apunte de ciudadanía válido. */
function citzDraft(personId = 'p1', islandId = 'island') {
  return {
    id: citizenshipEntryId(personId, islandId),
    personId,
    delta: CONTRACTS_V1.citizenship,
    reason: `Ciudadanía de ${islandId}`,
    ruleId: 'citizenship',
    refs: { islandId, islandName: islandId },
  };
}

describe('CONTRACTS_V1', () => {
  it('certificado = peso × 10 (pesos 1-3 → 10/20/30)', () => {
    expect(CONTRACTS_V1.certificate(1)).toBe(10);
    expect(CONTRACTS_V1.certificate(2)).toBe(20);
    expect(CONTRACTS_V1.certificate(3)).toBe(30);
  });
  it('ciudadanía 100, super-ciudadano 500, leyenda 1000', () => {
    expect(CONTRACTS_V1.citizenship).toBe(100);
    expect(CONTRACTS_V1.superCitizen).toBe(500);
    expect(CONTRACTS_V1.legend).toBe(1000);
  });
  it('carpool completado = paradas × 2 (el «+20%»: 2 = 20% de 10)', () => {
    expect(CONTRACTS_V1.carpoolCompleted(5)).toBe(10);
    expect(CONTRACTS_V1.carpoolCompleted(1)).toBe(2);
  });
});

describe('ids deterministas', () => {
  it('cityKey sustituye la barra (Firestore no la admite en ids de doc)', () => {
    expect(cityKey('bases/git')).toBe('bases~git');
    expect(cityKey('frontend/react')).toBe('frontend~react');
  });
  it('cada tipo de apunte tiene su id determinista', () => {
    expect(certEntryId('p1', 'bases/git')).toBe('cert:p1:bases~git');
    expect(citizenshipEntryId('p1', 'frontend')).toBe('citz:p1:frontend');
    expect(badgeEntryId('p1', 'superCitizen')).toBe('badge:p1:superCitizen');
    expect(badgeEntryId('p1', 'legend')).toBe('badge:p1:legend');
    expect(carpoolEntryId('cp9', 'p1')).toBe('carpool:cp9:p1');
  });
});

describe('canonicalJson / canonicalEntry', () => {
  it('ordena las claves en todos los niveles (canónico estable)', () => {
    const a = canonicalJson({ b: 1, a: { z: true, m: 'x' }, c: [3, 1] });
    const b = canonicalJson({ c: [3, 1], a: { m: 'x', z: true }, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":{"m":"x","z":true},"b":1,"c":[3,1]}');
  });
  it('descarta claves undefined y conserva el orden de los arrays', () => {
    expect(canonicalJson({ a: undefined, b: [2, 1] })).toBe('{"b":[2,1]}');
  });
  it('canonicalEntry excluye hash/sig/kid pero INCLUYE id y unsigned', () => {
    const entry = { id: 'x', seq: 1, unsigned: true, hash: 'h', sig: 's', kid: 'k' };
    expect(canonicalEntry(entry)).toBe('{"id":"x","seq":1,"unsigned":true}');
  });
});

describe('entryHash', () => {
  it('es determinista e independiente del orden de claves', async () => {
    const h1 = await entryHash({ seq: 1, personId: 'p1', delta: 10 });
    const h2 = await entryHash({ delta: 10, personId: 'p1', seq: 1 });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });
  it('cambia si cambia CUALQUIER campo hasheado (incluido unsigned)', async () => {
    const base = { seq: 1, personId: 'p1', delta: 10 };
    expect(await entryHash({ ...base, delta: 1000 })).not.toBe(await entryHash(base));
    expect(await entryHash({ ...base, unsigned: true })).not.toBe(await entryHash(base));
  });
  it('NO cambia por hash/sig/kid (se calculan después)', async () => {
    const base = { seq: 1, personId: 'p1', delta: 10 };
    expect(await entryHash({ ...base, hash: 'x', sig: 'y', kid: 'z' })).toBe(await entryHash(base));
  });
});

describe('verifyChain', () => {
  it('acepta el ledger vacío (cabeza = GENESIS)', async () => {
    expect(await verifyChain([])).toEqual({ ok: true, length: 0, headHash: GENESIS_HASH });
  });
  it('acepta una cadena bien construida', async () => {
    const entries = await buildLedger([certDraft(), citzDraft()]);
    const result = await verifyChain(entries);
    expect(result.ok).toBe(true);
    expect(result.length).toBe(2);
    expect(result.headHash).toBe(entries.at(-1).hash);
  });
  it('detecta un apunte alterado (el hash no coincide con el contenido)', async () => {
    const entries = await buildLedger([certDraft(), citzDraft()]);
    entries[0] = { ...entries[0], delta: 1000 }; // «me pongo 1000 puntos»
    const result = await verifyChain(entries);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(1);
    expect(result.reason).toContain('alterado');
  });
  it('detecta una cadena rota (prevHash que no enlaza)', async () => {
    const entries = await buildLedger([certDraft(), citzDraft()]);
    entries[1] = { ...entries[1], prevHash: 'f'.repeat(64) };
    const result = await verifyChain(entries);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(2);
  });
  it('detecta un hueco de seq (apunte borrado)', async () => {
    const entries = await buildLedger([certDraft(), citzDraft(), certDraft('p2', 'bases/css', 1)]);
    const result = await verifyChain([entries[0], entries[2]]);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(3);
    expect(result.reason).toContain('consecutivo');
  });
});

describe('expectedDelta / verifyEntryAgainstRule', () => {
  it('recomputa el delta de cada contrato', async () => {
    const [cert] = await buildLedger([certDraft('p1', 'frontend/react', 3)]);
    expect(expectedDelta(cert)).toBe(30);
    expect(verifyEntryAgainstRule(cert).ok).toBe(true);
    const [citz] = await buildLedger([citzDraft()]);
    expect(verifyEntryAgainstRule(citz).ok).toBe(true);
    const [badge] = await buildLedger([
      { id: badgeEntryId('p1', 'legend'), personId: 'p1', delta: 1000, reason: 'x', ruleId: 'legend', refs: {} },
    ]);
    expect(verifyEntryAgainstRule(badge).ok).toBe(true);
    const [cp] = await buildLedger([
      {
        id: carpoolEntryId('cp9', 'p1'),
        personId: 'p1',
        delta: 8,
        reason: 'x',
        ruleId: 'carpoolCompleted',
        refs: { carpoolId: 'cp9', stops: 4 },
      },
    ]);
    expect(verifyEntryAgainstRule(cp).ok).toBe(true);
  });
  it('rechaza un delta que no sale del contrato', async () => {
    const [entry] = await buildLedger([{ ...certDraft(), delta: 999 }]);
    const result = verifyEntryAgainstRule(entry);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('999');
  });
  it('rechaza refs inválidas (peso fuera de 1-3, paradas no enteras)', () => {
    expect(expectedDelta({ ruleVersion: 1, ruleId: 'certificate', refs: { weight: 4 } })).toBeNull();
    expect(expectedDelta({ ruleVersion: 1, ruleId: 'certificate', refs: { weight: 0 } })).toBeNull();
    expect(expectedDelta({ ruleVersion: 1, ruleId: 'carpoolCompleted', refs: { stops: 2.5 } })).toBeNull();
  });
  it('rechaza reglas desconocidas y versiones no vigentes', () => {
    expect(expectedDelta({ ruleVersion: 1, ruleId: 'invented', refs: {} })).toBeNull();
    expect(expectedDelta({ ruleVersion: 2, ruleId: 'citizenship', refs: {} })).toBeNull();
  });
  it('rechaza un apunte guardado bajo un id que no es el de su regla', async () => {
    const [entry] = await buildLedger([{ ...certDraft('p1', 'bases/git'), id: 'cert:p1:bases~css' }]);
    const result = verifyEntryAgainstRule(entry);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('id');
  });
});

describe('computeBalances / diffBalances', () => {
  it('suma los deltas por persona', async () => {
    const entries = await buildLedger([
      certDraft('p1', 'bases/git', 1),
      certDraft('p1', 'bases/css', 2),
      citzDraft('p2'),
    ]);
    expect(computeBalances(entries)).toEqual({ p1: 30, p2: 100 });
  });
  it('detecta discrepancias con los saldos materializados (en ambos sentidos)', () => {
    const computed = { p1: 30, p2: 100 };
    expect(diffBalances(computed, { p1: 30, p2: 100 }).ok).toBe(true);
    const bad = diffBalances(computed, { p1: 1030, p3: 500 });
    expect(bad.ok).toBe(false);
    expect(bad.mismatches).toContainEqual({ personId: 'p1', computed: 30, stored: 1030 });
    expect(bad.mismatches).toContainEqual({ personId: 'p2', computed: 100, stored: 0 });
    expect(bad.mismatches).toContainEqual({ personId: 'p3', computed: 0, stored: 500 });
  });
});

describe('verifyCheckpoint (historia vista)', () => {
  it('sin checkpoint no comprueba nada (primer arranque)', () => {
    expect(verifyCheckpoint([], null)).toEqual({ ok: true, checked: false });
  });
  it('acepta si el apunte visto sigue intacto aunque el ledger haya crecido', async () => {
    const entries = await buildLedger([certDraft(), citzDraft()]);
    const cp = { seq: 1, headHash: entries[0].hash };
    expect(verifyCheckpoint(entries, cp)).toEqual({ ok: true, checked: true });
  });
  it('ALERTA si la historia se acortó (la seq vista ya no existe)', async () => {
    const entries = await buildLedger([certDraft()]);
    const result = verifyCheckpoint(entries, { seq: 5, headHash: 'x'.repeat(64) });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('acortada');
  });
  it('ALERTA si la historia vista fue reescrita (mismo seq, otro hash)', async () => {
    const entries = await buildLedger([certDraft()]);
    const result = verifyCheckpoint(entries, { seq: 1, headHash: 'f'.repeat(64) });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('reescrita');
  });
});

describe('firma ECDSA P-256 (formato DER de Cloud KMS)', () => {
  /** Par de claves de PRUEBA (node:crypto, sin GCP) + firma DER del canónico. */
  function makeSigner() {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    /** @param {Record<string, unknown>} entry */
    const signEntry = (entry) => {
      const der = createSign('SHA256').update(canonicalEntry(entry)).sign(privateKey);
      return der.toString('base64');
    };
    return { pem, signEntry };
  }

  it('verifica una firma DER legítima y rechaza el apunte alterado', async () => {
    const { pem, signEntry } = makeSigner();
    const [entry] = await buildLedger([certDraft()]);
    const signed = { ...entry, sig: signEntry(entry), kid: 'test-key/1' };
    const key = await importCoinsPublicKey(pem);
    expect(await verifyEntrySignature(signed, key)).toBe(true);
    // Alterar el delta invalida la firma (el canónico cambia).
    expect(await verifyEntrySignature({ ...signed, delta: 1000 }, key)).toBe(false);
  });

  it('rechaza firmas de OTRA clave y firmas imparseables', async () => {
    const { signEntry } = makeSigner();
    const other = makeSigner();
    const [entry] = await buildLedger([certDraft()]);
    const signed = { ...entry, sig: signEntry(entry) };
    const otherKey = await importCoinsPublicKey(other.pem);
    expect(await verifyEntrySignature(signed, otherKey)).toBe(false);
    expect(await verifyEntrySignature({ ...entry, sig: 'no-es-base64-der!!' }, otherKey)).toBe(false);
    expect(await verifyEntrySignature({ ...entry }, otherKey)).toBe(false); // sin sig
  });
});

describe('verifyLedger (verificación completa)', () => {
  it('camino feliz: cadena + meta + contratos + saldos + checkpoint', async () => {
    const entries = await buildLedger([certDraft(), citzDraft(), certDraft('p2', 'frontend/react', 3)]);
    const head = entries.at(-1);
    const result = await verifyLedger({
      entries,
      meta: { seq: head.seq, headHash: head.hash },
      balances: { p1: 110, p2: 30 },
      publicKeyPem: null,
      checkpoint: { seq: 1, headHash: entries[0].hash },
    });
    expect(result.ok).toBe(true);
    expect(result.alert).toBe(false);
    // Sin clave pública: aviso de firmas sin comprobar (y apuntes sin firma).
    expect(result.warnings.join(' ')).toContain('Clave pública pendiente');
    expect(result.checks.signatures.checked).toBe(false);
  });

  it('un delta manipulado dispara la ALERTA (cadena rota) y falla contratos', async () => {
    const entries = await buildLedger([certDraft()]);
    entries[0] = { ...entries[0], delta: 1000 };
    const result = await verifyLedger({ entries, balances: { p1: 1000 } });
    expect(result.ok).toBe(false);
    expect(result.alert).toBe(true);
    expect(result.checks.chain.ok).toBe(false);
    expect(result.checks.rules.failures).toHaveLength(1);
  });

  it('un saldo materializado inflado se detecta aunque el ledger esté intacto', async () => {
    const entries = await buildLedger([certDraft()]);
    const result = await verifyLedger({ entries, balances: { p1: 1010 } });
    expect(result.ok).toBe(false);
    expect(result.alert).toBe(false); // discrepancia de saldo: fallo, pero no reescritura
    expect(result.checks.balances.mismatches).toEqual([{ personId: 'p1', computed: 10, stored: 1010 }]);
  });

  it('meta desincronizado (headHash viejo) se detecta', async () => {
    const entries = await buildLedger([certDraft(), citzDraft()]);
    const result = await verifyLedger({ entries, meta: { seq: 1, headHash: entries[0].hash } });
    expect(result.ok).toBe(false);
    expect(result.checks.meta.ok).toBe(false);
  });

  it('con clave pública verifica firmas y una firma inválida dispara la ALERTA', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const entries = await buildLedger([certDraft(), citzDraft()]);
    const signed = entries.map((e) => ({
      ...e,
      sig: createSign('SHA256').update(canonicalEntry(e)).sign(privateKey).toString('base64'),
      kid: 'test/1',
    }));
    const good = await verifyLedger({ entries: signed, publicKeyPem: pem });
    expect(good.ok).toBe(true);
    expect(good.checks.signatures).toMatchObject({ ok: true, checked: true, verified: 2, unsigned: 0 });

    // Firma intercambiada entre apuntes: inválida → alerta.
    const swapped = [signed[0], { ...signed[1], sig: signed[0].sig }];
    const bad = await verifyLedger({ entries: swapped, publicKeyPem: pem });
    expect(bad.ok).toBe(false);
    expect(bad.alert).toBe(true);
    expect(bad.checks.signatures.failures).toEqual([2]);
  });

  it('apuntes sin firma (degradación sin KMS) avisan pero no alertan', async () => {
    const entries = await buildLedger([{ ...certDraft(), unsigned: true }]);
    const result = await verifyLedger({ entries });
    expect(result.ok).toBe(true);
    expect(result.alert).toBe(false);
    expect(result.warnings.join(' ')).toContain('sin firma');
  });
});

describe('entryLabel', () => {
  it('etiquetas legibles en español por tipo de apunte', () => {
    expect(entryLabel({ ruleId: 'certificate', refs: { cityName: 'Git' } })).toBe('Certificado de Git');
    expect(entryLabel({ ruleId: 'citizenship', refs: { islandName: 'Isla Frontend' } })).toBe('Ciudadanía de Isla Frontend');
    expect(entryLabel({ ruleId: 'superCitizen', refs: {} })).toContain('Super-ciudadano');
    expect(entryLabel({ ruleId: 'legend', refs: {} })).toContain('Leyenda');
    expect(entryLabel({ ruleId: 'carpoolCompleted', refs: { carpoolName: 'Ruta JS' } })).toBe('Carpool «Ruta JS» completado');
  });
});

describe('coinsFillLevel', () => {
  it('saldo 0 (o inválido) es cofre vacío', () => {
    expect(coinsFillLevel(0)).toBe('empty');
    expect(coinsFillLevel(-10)).toBe('empty');
    expect(coinsFillLevel(NaN)).toBe('empty');
    expect(coinsFillLevel(undefined)).toBe('empty');
    expect(coinsFillLevel(null)).toBe('empty');
  });

  it('umbrales alineados con los contratos v1 (cert/ciudadanía/⭐/👑)', () => {
    expect(coinsFillLevel(1)).toBe('low'); // un certificado suelto
    expect(coinsFillLevel(30)).toBe('low');
    expect(coinsFillLevel(99)).toBe('low');
    expect(coinsFillLevel(100)).toBe('mid'); // primera ciudadanía
    expect(coinsFillLevel(499)).toBe('mid');
    expect(coinsFillLevel(500)).toBe('high'); // badge ⭐
    expect(coinsFillLevel(1499)).toBe('high');
    expect(coinsFillLevel(1500)).toBe('overflow'); // 👑 + ⭐: desborda
    expect(coinsFillLevel(9000)).toBe('overflow');
  });
});
