import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  classifyCollisionRisk,
  ACTIVE_STATUSES,
  type INAPIRecord,
} from '../inapiClassifier';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeRecord(
  denominacion: string,
  estado: string = 'Registrada',
): INAPIRecord {
  return { denominacion, estado, titular: 'EMPRESA S.A.', clases: '35' };
}

// ── normalizeText ─────────────────────────────────────────────────────────────

describe('normalizeText', () => {
  it('convierte a mayúsculas', () => {
    expect(normalizeText('Validus')).toBe('Validus');
  });

  it('elimina tildes', () => {
    expect(normalizeText('café')).toBe('CAFE');
    expect(normalizeText('validación')).toBe('VALIDACION');
    expect(normalizeText('SEÑAL')).toBe('SENAL');
  });

  it('colapsa múltiples espacios internos en uno', () => {
    expect(normalizeText('MARCA  NUEVA')).toBe('MARCA NUEVA');
    expect(normalizeText('TRES   PALABRAS')).toBe('TRES PALABRAS');
  });

  it('elimina espacios al inicio y al final', () => {
    expect(normalizeText('  espacios  al inicio y fin  ')).toBe('ESPACIOS AL INICIO Y FIN');
  });

  it('trata string vacío sin lanzar', () => {
    expect(normalizeText('')).toBe('');
  });

  it('es idempotente — aplicarlo dos veces da el mismo resultado', () => {
    const once  = normalizeText('Café Árabe Ñoño');
    const twice = normalizeText(once);
    expect(once).toBe(twice);
  });

  it('normaliza ñ correctamente (no la elimina)', () => {
    // NFD de ñ = n + combining tilde (U+0303) → solo elimina el combining → 'N'
    expect(normalizeText('NIÑO')).toBe('NINO');
  });

  it('normaliza nombres de marcas reales del corpus', () => {
    expect(normalizeText('Colún')).toBe('COLUN');
    expect(normalizeText('EcoBío')).toBe('ECOBIO');
  });
});

// ── ACTIVE_STATUSES ───────────────────────────────────────────────────────────

describe('ACTIVE_STATUSES', () => {
  it('contiene exactamente los 4 estados activos del corpus INAPI', () => {
    expect(ACTIVE_STATUSES).toContain('Registrada');
    expect(ACTIVE_STATUSES).toContain('En Trámite');
    expect(ACTIVE_STATUSES).toContain('En trámite');
    expect(ACTIVE_STATUSES).toContain('Esperando renovación');
    expect(ACTIVE_STATUSES).toHaveLength(4);
  });
});

// ── classifyCollisionRisk ─────────────────────────────────────────────────────

describe('classifyCollisionRisk — sin registros', () => {
  it('corpus vacío → none', () => {
    const r = classifyCollisionRisk([], 'Validus');
    expect(r.risk_level).toBe('none');
    expect(r.colisiones).toHaveLength(0);
  });
});

describe('classifyCollisionRisk — riesgo none', () => {
  it('marca completamente diferente → none', () => {
    const records = [makeRecord('ZENITH'), makeRecord('AURORA')];
    const r = classifyCollisionRisk(records, 'Validus');
    expect(r.risk_level).toBe('none');
    expect(r.colisiones).toHaveLength(0);
  });

  it('marca similar pero estado inactivo → none', () => {
    const records = [makeRecord('Validus', 'Caducada')];
    const r = classifyCollisionRisk(records, 'Validus');
    expect(r.risk_level).toBe('none');
  });

  it('marca "Abandonada" no activa → none', () => {
    const records = [makeRecord('Validus', 'Abandonada')];
    const r = classifyCollisionRisk(records, 'Validus');
    expect(r.risk_level).toBe('none');
  });
});

describe('classifyCollisionRisk — riesgo high (coincidencia exacta)', () => {
  it('coincidencia exacta con marca Registrada → high', () => {
    const records = [makeRecord('Validus', 'Registrada')];
    const r = classifyCollisionRisk(records, 'Validus');
    expect(r.risk_level).toBe('high');
    expect(r.colisiones.length).toBeGreaterThanOrEqual(1);
  });

  it('normalización: "Validus" coincide con "Validus" registrada', () => {
    const records = [makeRecord('Validus', 'Registrada')];
    const r = classifyCollisionRisk(records, 'Validus');
    expect(r.risk_level).toBe('high');
  });

  it('normalización: tildes ignoradas — "Válidos" = "VALIDOS"', () => {
    const records = [makeRecord('Válidos', 'Registrada')];
    const r = classifyCollisionRisk(records, 'Validos');
    expect(r.risk_level).toBe('high');
  });

  it('coincidencia exacta con "En Trámite" → high', () => {
    const records = [makeRecord('TECHPAY', 'En Trámite')];
    const r = classifyCollisionRisk(records, 'TechPay');
    expect(r.risk_level).toBe('high');
  });

  it('coincidencia exacta con "Esperando renovación" → high', () => {
    const records = [makeRecord('ECOMARKET', 'Esperando renovación')];
    const r = classifyCollisionRisk(records, 'ECOMARKET');
    expect(r.risk_level).toBe('high');
  });

  it('colisiones incluye las exactas y también las parciales que haya', () => {
    const records = [
      makeRecord('Validus',    'Registrada'),  // exacta
      makeRecord('Validus PRO','Registrada'),  // parcial (contiene Validus)
    ];
    const r = classifyCollisionRisk(records, 'Validus');
    expect(r.risk_level).toBe('high');
    expect(r.colisiones.length).toBe(2);
  });

  it('rationale menciona la cantidad de exactas', () => {
    const records = [makeRecord('ZENITH', 'Registrada'), makeRecord('ZENITH', 'En Trámite')];
    const r = classifyCollisionRisk(records, 'ZENITH');
    expect(r.risk_rationale).toContain('2');
  });
});

describe('classifyCollisionRisk — riesgo medium (coincidencia parcial)', () => {
  it('denominación registrada contiene la marca buscada → medium', () => {
    const records = [makeRecord('Validus PRO', 'Registrada')];
    const r = classifyCollisionRisk(records, 'Validus');
    expect(r.risk_level).toBe('medium');
    expect(r.colisiones).toHaveLength(1);
  });

  it('denominación buscada contiene la marca registrada → medium', () => {
    const records = [makeRecord('ECO', 'Registrada')];
    const r = classifyCollisionRisk(records, 'ECOMARKET');
    expect(r.risk_level).toBe('medium');
  });

  it('parcial inactiva no cuenta → none', () => {
    const records = [makeRecord('Validus PRO', 'Caducada')];
    const r = classifyCollisionRisk(records, 'Validus');
    expect(r.risk_level).toBe('none');
  });

  it('rationale menciona la cantidad de parciales', () => {
    const records = [
      makeRecord('Validus BASIC',   'Registrada'),
      makeRecord('Validus PREMIUM', 'En trámite'),
    ];
    const r = classifyCollisionRisk(records, 'Validus');
    expect(r.risk_level).toBe('medium');
    expect(r.risk_rationale).toContain('2');
  });
});

describe('classifyCollisionRisk — prioridad de riesgo', () => {
  it('exacta + parcial → siempre high (no medium)', () => {
    const records = [
      makeRecord('AURORA',     'Registrada'),  // exacta
      makeRecord('AURORA PLUS','Registrada'),  // parcial
    ];
    const r = classifyCollisionRisk(records, 'AURORA');
    expect(r.risk_level).toBe('high');
  });

  it('exacta inactiva + parcial activa → medium (no high)', () => {
    const records = [
      makeRecord('NEXUS',     'Caducada'),    // inactiva, no cuenta
      makeRecord('NEXUS PRO', 'Registrada'),  // parcial activa
    ];
    const r = classifyCollisionRisk(records, 'NEXUS');
    expect(r.risk_level).toBe('medium');
  });
});
