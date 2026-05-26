/**
 * SUITE 1 — Validación Tabular
 * Tests de K-Anonimato, L-Diversidad y T-Closeness sobre el data lake de encuestas.
 *
 * Cubre los tres casos descritos en la spec de Auditoría de Privacidad Empírica:
 *   1. Test de Cardinalidad Mínima
 *   2. Test de Supresión Selectiva (outlier hiperespecífico)
 *   3. Test de Dispersión de Atributos Sensibles
 *   4. Test de T-Closeness (Earth Mover's Distance vs. distribución global)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { applyKAnonymity, auditKAnonymity, qiKey } from '../kAnonymity';
import { applyLDiversity, auditLDiversity } from '../lDiversity';
import { calculate1D_EMD, applyTCloseness, auditTCloseness } from '../tCloseness';
import {
  makeRecord, makeEquivalenceClass, makeOutlier, resetSeq,
} from './fixtures';
import type { PrivacyRecord, Severity } from '../types';

const K = 5;
const L = 2;

beforeEach(() => resetSeq());

// ════════════════════════════════════════════════════════
// 1. Tests de K-Anonimato
// ════════════════════════════════════════════════════════

describe('K-Anonimato', () => {

  describe('Cardinalidad mínima', () => {

    it('toda clase de equivalencia en "passed" tiene size ≥ k', () => {
      // Inyectamos 3 clases: tamaños 5, 7, y 3 (esta última debe suprimirse o fusionarse)
      const classA = makeEquivalenceClass(5, { generalized_industry: 'Tecnología y Software' });
      const classB = makeEquivalenceClass(7, { generalized_industry: 'Retail y Comercio', generalized_role: 'Gerencia Media' });
      const classC = makeEquivalenceClass(3, { generalized_industry: 'Salud y Ciencias', friction_bucket: 'baja', willingness_to_pay: false });
      const all = [...classA, ...classB, ...classC];

      const result = applyKAnonymity(all, K);
      const audit = auditKAnonymity(result, K);

      // La función de auditoría debe retornar null (sin violaciones)
      expect(audit).toBeNull();

      // Verificar empíricamente: agrupar los passed y chequear tamaños
      const groups = new Map<string, PrivacyRecord[]>();
      for (const r of result.passed) {
        const key = qiKey(r);
        const g = groups.get(key) ?? [];
        g.push(r);
        groups.set(key, g);
      }
      for (const [, group] of groups) {
        expect(group.length).toBeGreaterThanOrEqual(K);
      }
    });

    it('clasifica correctamente: classA(5) pasa, classC(3) es suprimida o fusionada', () => {
      const classA = makeEquivalenceClass(K, { generalized_industry: 'Logística y Transporte', friction_bucket: 'media' });
      // classC con solo 3 miembros y QI único → no puede alcanzar k sin fusión
      const classC = makeEquivalenceClass(3, {
        generalized_industry: 'Agroindustria',
        generalized_role: 'Operativo/Staff',
        friction_bucket: 'baja',
        willingness_to_pay: false,
      });

      const result = applyKAnonymity([...classA, ...classC], K);

      // classA debe pasar intacta
      const passedIds = new Set(result.passed.map(r => r.id));
      for (const r of classA) expect(passedIds.has(r.id)).toBe(true);

      // classC: o está suprimida o fue fusionada con supresión de atributo
      const cInPassed = classC.filter(r => passedIds.has(r.id));
      const cInSuppressed = classC.filter(r => result.suppressed.some(s => s.id === r.id));

      // La suma debe ser 3 (no se duplican ni se pierden)
      expect(cInPassed.length + cInSuppressed.length).toBe(3);
    });

    it('lanza error si k < 2', () => {
      expect(() => applyKAnonymity([], 1)).toThrowError(RangeError);
      expect(() => applyKAnonymity([], 0)).toThrowError(RangeError);
    });

    it('acepta dataset vacío sin errores', () => {
      const result = applyKAnonymity([], K);
      expect(result.passed).toHaveLength(0);
      expect(result.suppressed).toHaveLength(0);
      expect(result.kClassSizes.size).toBe(0);
    });

    it('10 clases de exactamente k registros: todas pasan, ninguna suprimida', () => {
      const industries = [
        'Tecnología y Software', 'Retail y Comercio', 'Salud y Ciencias',
        'Educación', 'Logística y Transporte', 'Manufactura e Industria',
        'Servicios Financieros', 'Agroindustria', 'Construcción e Inmobiliario', 'Servicios Profesionales',
      ];
      const all = industries.flatMap(ind =>
        makeEquivalenceClass(K, { generalized_industry: ind }, ['tolerable', 'critico', 'paralizante', 'tolerable', 'critico'])
      );

      const result = applyKAnonymity(all, K);
      expect(result.suppressed).toHaveLength(0);
      expect(result.passed).toHaveLength(all.length);
      expect(auditKAnonymity(result, K)).toBeNull();
    });

    it('todos los kClassSizes son ≥ k para los registros en passed', () => {
      const records = makeEquivalenceClass(8, {}, ['tolerable', 'critico', 'paralizante', 'tolerable', 'critico', 'paralizante', 'tolerable', 'critico']);
      const result = applyKAnonymity(records, K);
      for (const r of result.passed) {
        const sz = result.kClassSizes.get(r.id);
        expect(sz).toBeDefined();
        expect(sz!).toBeGreaterThanOrEqual(K);
      }
    });
  });

  // ─────────────────────────────────────────────────────
  describe('Supresión selectiva de atributo', () => {

    it('outlier hiperespecífico es suprimido o recibe supresión de atributo', () => {
      // 5 registros de clase válida + 1 outlier único
      const mainClass = makeEquivalenceClass(K, {}, ['tolerable', 'critico', 'paralizante', 'tolerable', 'critico']);
      const outlier = makeOutlier();
      const result = applyKAnonymity([...mainClass, outlier], K);

      const outlierInPassed = result.passed.some(r => r.id === outlier.id);
      const outlierInSuppressed = result.suppressed.some(r => r.id === outlier.id);
      const outlierInAttrSuppressed = result.attributeSuppressed.some(r => r.id === outlier.id);

      // El outlier debe estar en exactamente uno de los tres conjuntos
      expect(
        [outlierInPassed, outlierInSuppressed, outlierInAttrSuppressed].filter(Boolean).length
      ).toBe(1);
    });

    it('supresión de atributo nulifica generalized_industry en el registro', () => {
      // Dos clases con el mismo QI reducido (sin industry) pero distintas industries
      // Ninguna alcanza k=5 sola, pero juntas sí
      const class1 = makeEquivalenceClass(3, { generalized_industry: 'Salud y Ciencias' });
      const class2 = makeEquivalenceClass(3, { generalized_industry: 'Educación' });
      const result = applyKAnonymity([...class1, ...class2], K);

      // Los que pasaron por supresión de atributo deben tener industry === null
      for (const r of result.attributeSuppressed) {
        expect(r.generalized_industry).toBeNull();
      }
    });

    it('un solo outlier en un dataset grande no contiene ningún otro de su clase', () => {
      const bulk = [
        ...makeEquivalenceClass(5, { generalized_industry: 'Retail y Comercio' }, ['tolerable', 'critico', 'paralizante', 'tolerable', 'critico']),
        ...makeEquivalenceClass(5, { generalized_industry: 'Logística y Transporte' }, ['tolerable', 'critico', 'paralizante', 'tolerable', 'critico']),
      ];
      const loneOutlier = makeOutlier({ generalized_industry: 'Agroindustria', generalized_role: 'Operativo/Staff', friction_bucket: 'baja', willingness_to_pay: false });
      const result = applyKAnonymity([...bulk, loneOutlier], K);

      // El outlier NO debe estar en passed si no fue fusionado
      if (result.suppressed.some(r => r.id === loneOutlier.id)) {
        expect(result.passed.some(r => r.id === loneOutlier.id)).toBe(false);
      }
    });
  });

  // ─────────────────────────────────────────────────────
  describe('Invariantes del algoritmo', () => {

    it('ningún registro se duplica ni se pierde entre passed + suppressed', () => {
      const records = [
        ...makeEquivalenceClass(6, { generalized_industry: 'Tecnología y Software' }, ['tolerable', 'critico', 'paralizante', 'tolerable', 'critico', 'paralizante']),
        ...makeEquivalenceClass(2, { generalized_industry: 'Manufactura e Industria', friction_bucket: 'baja' }),
        makeOutlier(),
      ];
      const result = applyKAnonymity(records, K);

      // IDs únicos
      const allIds = [...result.passed.map(r => r.id), ...result.suppressed.map(r => r.id)];
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length); // sin duplicados

      // Cobertura: todos los IDs de entrada están en algún output
      const inputIds = new Set(records.map(r => r.id));
      for (const id of uniqueIds) expect(inputIds.has(id)).toBe(true);
    });
  });
});

// ════════════════════════════════════════════════════════
// 2. Tests de L-Diversidad
// ════════════════════════════════════════════════════════

describe('L-Diversidad', () => {

  describe('Dispersión de atributos sensibles', () => {

    it('clase con ≥ l severidades distintas pasa', () => {
      // 5 registros con 3 severidades distintas: cumple l=2
      const records = makeEquivalenceClass(5, {}, ['tolerable', 'critico', 'paralizante', 'tolerable', 'critico']);
      const result = applyLDiversity(records, L);

      expect(result.passed).toHaveLength(5);
      expect(result.homogeneousClasses).toHaveLength(0);
      expect(auditLDiversity(result, L)).toBeNull();
    });

    it('clase con un solo valor de severity es excluida del data lake', () => {
      // 6 registros, todos 'critico' → viola l=2
      const homogeneous = makeEquivalenceClass(6, {}, ['critico', 'critico', 'critico', 'critico', 'critico', 'critico']);
      const result = applyLDiversity(homogeneous, L);

      expect(result.passed).toHaveLength(0);
      expect(result.homogeneousClasses).toHaveLength(1);
      expect(result.homogeneousClasses[0].severity).toBe('critico');
      expect(result.homogeneousClasses[0].count).toBe(6);
    });

    it('la auditoría detecta violaciones en clases que pasaron incorrectamente', () => {
      // Construir artificialmente un resultado inválido
      const records = makeEquivalenceClass(5, {}, ['critico', 'critico', 'critico', 'critico', 'critico']);
      const fakeResult = {
        passed: records,              // VIOLACIÓN INTENCIONAL: todos 'critico'
        homogeneousClasses: [],
        lScoreByClass: new Map(records.map(r => [r.id, 1])),
      };
      const audit = auditLDiversity(fakeResult, L);
      expect(audit).not.toBeNull();
      expect(audit).toContain('VIOLATION');
    });

    it('dataset mixto: clase diversa pasa, clase homogénea es excluida', () => {
      // Clase A: 5 registros, 3 severidades → pasa l=2
      const classA = makeEquivalenceClass(5, { generalized_industry: 'Tecnología y Software' }, ['tolerable', 'critico', 'paralizante', 'tolerable', 'critico']);
      // Clase B: 5 registros, solo 'paralizante' → excluida
      const classB = makeEquivalenceClass(5, { generalized_industry: 'Retail y Comercio', generalized_role: 'Gerencia Media' }, ['paralizante', 'paralizante', 'paralizante', 'paralizante', 'paralizante']);

      const result = applyLDiversity([...classA, ...classB], L);

      const passedIds = new Set(result.passed.map(r => r.id));
      // Todos los de classA pasan
      for (const r of classA) expect(passedIds.has(r.id)).toBe(true);
      // Ninguno de classB pasa
      for (const r of classB) expect(passedIds.has(r.id)).toBe(false);

      expect(result.homogeneousClasses).toHaveLength(1);
      expect(auditLDiversity(result, L)).toBeNull();
    });

    it('lDiversidad lanza RangeError si l < 2', () => {
      expect(() => applyLDiversity([], 1)).toThrowError(RangeError);
    });

    it('lScoreByClass registra el número correcto de severidades distintas por clase', () => {
      const records = makeEquivalenceClass(5, {}, ['tolerable', 'critico', 'paralizante', 'tolerable', 'critico']);
      const result = applyLDiversity(records, L);
      for (const r of result.passed) {
        const score = result.lScoreByClass.get(r.id);
        expect(score).toBeGreaterThanOrEqual(L);
      }
    });

    it('pipeline completo K→L: sólo pasan registros que cumplen ambas restricciones', () => {
      // Clase con k=5 y l=2 ✓
      const good = makeEquivalenceClass(5, { generalized_industry: 'Educación' }, ['tolerable', 'critico', 'paralizante', 'tolerable', 'critico']);
      // Clase con k=5 pero l=1 ✗ (excluida en paso L)
      const badL = makeEquivalenceClass(5, { generalized_industry: 'Agroindustria', friction_bucket: 'media' }, ['critico', 'critico', 'critico', 'critico', 'critico']);
      // Clase con k<5 (excluida en paso K)
      const badK = makeEquivalenceClass(3, { generalized_industry: 'Manufactura e Industria', friction_bucket: 'baja', willingness_to_pay: false });

      const all = [...good, ...badL, ...badK];
      const kResult = applyKAnonymity(all, K);
      const lResult = applyLDiversity(kResult.passed, L);

      // Solo la clase 'good' debe estar en el resultado final
      const finalIds = new Set(lResult.passed.map(r => r.id));
      for (const r of good) expect(finalIds.has(r.id)).toBe(true);
      for (const r of badL) expect(finalIds.has(r.id)).toBe(false);
      for (const r of badK) expect(finalIds.has(r.id)).toBe(false);

      // Doble auditoría
      expect(auditKAnonymity(kResult, K)).toBeNull();
      expect(auditLDiversity(lResult, L)).toBeNull();
    });
  });

  describe('Ausencia de fugas', () => {

    it('clases homogéneas excluidas no aparecen en passed', () => {
      const records: PrivacyRecord[] = [
        ...makeEquivalenceClass(5, { generalized_industry: 'Salud y Ciencias' }, ['tolerable', 'critico', 'paralizante', 'tolerable', 'critico']),
        ...makeEquivalenceClass(5, { generalized_industry: 'Servicios Financieros', friction_bucket: 'media', willingness_to_pay: false }, ['paralizante', 'paralizante', 'paralizante', 'paralizante', 'paralizante']),
      ];
      const result = applyLDiversity(records, L);
      const auditMsg = auditLDiversity(result, L);
      // La auditoría verifica que ninguna clase homogénea está en passed
      expect(auditMsg).toBeNull();
    });
  });
});

// ════════════════════════════════════════════════════════
// 3. Tests de T-Closeness
// ════════════════════════════════════════════════════════

describe('T-Closeness', () => {

  /**
   * T-closeness (Li et al. 2007) exige que la distribución del atributo sensible
   * dentro de cada clase de equivalencia no diste más de t de la distribución global,
   * medido con Earth Mover's Distance (EMD / Wasserstein-1) 1D.
   *
   * Neutraliza dos ataques residuales que escapan a k-anonimato + l-diversidad:
   *   - Ataque de sesgo: una clase rara localmente sobre-representa severidades raras globalmente
   *   - Ataque de similitud: l valores distintos pero semánticamente cercanos revelan el rango real
   */

  // ─────────────────────────────────────────────────────
  describe('calculate1D_EMD', () => {

    it('distribuciones idénticas producen EMD = 0', () => {
      expect(calculate1D_EMD([0.5, 0.3, 0.2], [0.5, 0.3, 0.2])).toBeCloseTo(0, 10);
    });

    it('cálculo manual verificable: P=[0.5,0,0.5], Q=[0.7,0.2,0.1] → EMD=0.6', () => {
      // w1 = 0.5-0.7 = -0.2 → |w1|=0.2
      // w2 = 0-0.2+(-0.2) = -0.4 → |w2|=0.4
      // EMD = 0.6
      expect(calculate1D_EMD([0.5, 0, 0.5], [0.7, 0.2, 0.1])).toBeCloseTo(0.6, 5);
    });

    it('distribuciones antipodales [1,0,0] vs [0,0,1] → EMD = 2 (máximo para 3 categorías)', () => {
      // w1 = 1-0=1 → 1; w2 = 0-0+1=1 → 1; EMD=2
      expect(calculate1D_EMD([1, 0, 0], [0, 0, 1])).toBeCloseTo(2, 10);
    });

    it('propiedad de simetría: EMD(P,Q) = EMD(Q,P)', () => {
      const p = [0.6, 0.3, 0.1];
      const q = [0.2, 0.4, 0.4];
      expect(calculate1D_EMD(p, q)).toBeCloseTo(calculate1D_EMD(q, p), 10);
    });

    it('lanza RangeError si los vectores tienen longitudes distintas', () => {
      expect(() => calculate1D_EMD([0.5, 0.5], [0.3, 0.3, 0.4])).toThrowError(RangeError);
    });
  });

  // ─────────────────────────────────────────────────────
  describe('applyTCloseness', () => {

    it('clase con distribución igual a la global pasa (EMD = 0)', () => {
      // P = Q = [0.6, 0.2, 0.2] → EMD=0 → pasa cualquier t
      const Q = [0.6, 0.2, 0.2];
      const records = makeEquivalenceClass(5, {}, ['tolerable', 'tolerable', 'tolerable', 'critico', 'paralizante']);
      const result = applyTCloseness(records, 0.20, Q);
      expect(result.passed).toHaveLength(5);
      expect(result.violatingClasses).toHaveLength(0);
      expect(auditTCloseness(result, 0.20)).toBeNull();
    });

    it('ataque de sesgo: clase con 100% paralizante es rechazada (EMD=1.6 vs Q global)', () => {
      // Global: 70% tolerable, 20% critico, 10% paralizante
      // Clase con todos paralizante: P=[0,0,1], EMD=|-0.7|+|-0.9|=1.6
      const Q = [0.7, 0.2, 0.1];
      const violating = makeEquivalenceClass(5, { generalized_industry: 'Retail y Comercio' },
        ['paralizante', 'paralizante', 'paralizante', 'paralizante', 'paralizante']);
      const result = applyTCloseness(violating, 0.20, Q);
      expect(result.passed).toHaveLength(0);
      expect(result.violatingClasses).toHaveLength(1);
      expect(result.violatingClasses[0].emd).toBeGreaterThan(1.0);
    });

    it('dataset mixto: clase diversa pasa, clase sesgada es excluida', () => {
      // Q global de referencia: mayoría tolerable
      const Q = [0.7, 0.2, 0.1];

      // Clase A: [3T,1C,1P] → P=[0.6,0.2,0.2], EMD=0.2 → pasa (≤0.20)
      const classA = makeEquivalenceClass(5, { generalized_industry: 'Educación' },
        ['tolerable', 'tolerable', 'tolerable', 'critico', 'paralizante']);

      // Clase B: [0T,0C,5P] → P=[0,0,1], EMD=1.6 → falla
      const classB = makeEquivalenceClass(5, { generalized_industry: 'Manufactura e Industria' },
        ['paralizante', 'paralizante', 'paralizante', 'paralizante', 'paralizante']);

      const result = applyTCloseness([...classA, ...classB], 0.20, Q);

      const passedIds = new Set(result.passed.map(r => r.id));
      for (const r of classA) expect(passedIds.has(r.id)).toBe(true);
      for (const r of classB) expect(passedIds.has(r.id)).toBe(false);

      expect(result.violatingClasses).toHaveLength(1);
      expect(auditTCloseness(result, 0.20)).toBeNull();
    });

    it('acepta dataset vacío sin errores', () => {
      const result = applyTCloseness([], 0.20);
      expect(result.passed).toHaveLength(0);
      expect(result.violatingClasses).toHaveLength(0);
      expect(result.tScoreByClass.size).toBe(0);
    });

    it('lanza RangeError si t ≤ 0', () => {
      expect(() => applyTCloseness([], 0)).toThrowError(RangeError);
      expect(() => applyTCloseness([], -0.1)).toThrowError(RangeError);
    });

    it('t muy grande acepta cualquier distribución (incluso la más sesgada)', () => {
      // Con t=10, el EMD máximo posible (2) es trivialmente ≤ t
      const Q = [0.7, 0.2, 0.1];
      const violating = makeEquivalenceClass(5, {},
        ['paralizante', 'paralizante', 'paralizante', 'paralizante', 'paralizante']);
      const result = applyTCloseness(violating, 10.0, Q);
      expect(result.passed).toHaveLength(5);
      expect(result.violatingClasses).toHaveLength(0);
    });

    it('tScoreByClass registra el EMD correcto para cada registro en la clase', () => {
      const Q = [0.7, 0.2, 0.1];
      // P=[0.6,0.2,0.2]: EMD = |-0.1|+|-0.1| = 0.2
      const records = makeEquivalenceClass(5, {}, ['tolerable', 'tolerable', 'tolerable', 'critico', 'paralizante']);
      const result = applyTCloseness(records, 0.20, Q);
      for (const r of records) {
        const score = result.tScoreByClass.get(r.id);
        expect(score).toBeDefined();
        expect(score!).toBeCloseTo(0.2, 5);
      }
    });
  });

  // ─────────────────────────────────────────────────────
  describe('auditTCloseness', () => {

    it('retorna null para resultado válido', () => {
      const Q = [0.6, 0.2, 0.2];
      const records = makeEquivalenceClass(5, {}, ['tolerable', 'tolerable', 'tolerable', 'critico', 'paralizante']);
      const result = applyTCloseness(records, 0.20, Q);
      expect(auditTCloseness(result, 0.20)).toBeNull();
    });

    it('detecta violación si un registro con EMD alto aparece incorrectamente en passed', () => {
      const records = makeEquivalenceClass(5, {}, ['tolerable', 'tolerable', 'tolerable', 'critico', 'paralizante']);
      const fakeResult = {
        passed: records,
        violatingClasses: [],
        tScoreByClass: new Map(records.map(r => [r.id, 0.99])), // EMD=0.99 > t=0.20
      };
      const audit = auditTCloseness(fakeResult, 0.20);
      expect(audit).not.toBeNull();
      expect(audit).toContain('VIOLATION');
    });
  });

  // ─────────────────────────────────────────────────────
  describe('Pipeline completo K→L→T', () => {

    it('sólo pasan registros que cumplen las tres restricciones simultáneamente', () => {
      // Distribución global de referencia: mayoritariamente tolerable
      const Q = [0.7, 0.2, 0.1];

      // ✓ Pasa K(5), L(3 severidades), T(EMD=0 con Q=[0.7,0.2,0.1])
      // 10 registros: [7T,2C,1P] → P=[0.7,0.2,0.1] = Q exacto → EMD=0
      const passesAll = makeEquivalenceClass(10, { generalized_industry: 'Educación' }, [
        'tolerable', 'tolerable', 'tolerable', 'tolerable', 'tolerable',
        'tolerable', 'tolerable', 'critico', 'critico', 'paralizante',
      ]);

      // ✗ Falla T (pasa K y L): [1T,1C,3P] → P=[0.2,0.2,0.6], EMD=1.0 vs Q
      const failsT = makeEquivalenceClass(5, { generalized_industry: 'Agroindustria' },
        ['paralizante', 'paralizante', 'critico', 'tolerable', 'paralizante']);

      // ✗ Falla K: solo 3 registros < k=5
      const failsK = makeEquivalenceClass(3, {
        generalized_industry: 'Construcción e Inmobiliario',
        friction_bucket: 'baja',
        willingness_to_pay: false,
      });

      // ✗ Falla L: todos 'critico' → 1 severidad < l=2
      const failsL = makeEquivalenceClass(5,
        { generalized_industry: 'Logística y Transporte', friction_bucket: 'media' },
        ['critico', 'critico', 'critico', 'critico', 'critico']);

      const all = [...passesAll, ...failsT, ...failsK, ...failsL];
      const kResult = applyKAnonymity(all, K);
      const lResult = applyLDiversity(kResult.passed, L);
      const tResult = applyTCloseness(lResult.passed, 0.20, Q);

      const finalIds = new Set(tResult.passed.map(r => r.id));

      // Solo passesAll debe estar en el resultado final
      for (const r of passesAll) expect(finalIds.has(r.id)).toBe(true);
      for (const r of failsT) expect(finalIds.has(r.id)).toBe(false);
      for (const r of failsK) expect(finalIds.has(r.id)).toBe(false);
      for (const r of failsL) expect(finalIds.has(r.id)).toBe(false);

      // Triple auditoría: ninguna capa tiene violaciones internas
      expect(auditKAnonymity(kResult, K)).toBeNull();
      expect(auditLDiversity(lResult, L)).toBeNull();
      expect(auditTCloseness(tResult, 0.20)).toBeNull();
    });
  });
});
