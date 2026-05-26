// Tipos compartidos del pipeline de privacidad
// Usados por los módulos de algoritmos y sus tests.

export type Severity = 'tolerable' | 'critico' | 'paralizante';
export type FrictionBucket = 'baja' | 'media' | 'alta';

export interface PrivacyRecord {
  id: string;
  // Cuasi-identificadores generalizados
  generalized_industry: string | null;
  generalized_role: string | null;
  friction_bucket: FrictionBucket;
  willingness_to_pay: boolean;
  // Atributo sensible
  severity: Severity;
  // Payload analítico (preservado en el data lake)
  central_problem: string;
  current_solutions: string[];
  key_quotes: string[];
  mom_test_signals: Record<string, boolean>;
  week_bucket: string;
}

export interface KAnonymityResult {
  passed: PrivacyRecord[];
  // Tamaño de la clase de equivalencia por record id
  kClassSizes: Map<string, number>;
  // Records suprimidos (excluidos del data lake por no alcanzar k)
  suppressed: PrivacyRecord[];
  // Records en los que se suprimió solo el atributo industry (supresión selectiva)
  attributeSuppressed: PrivacyRecord[];
}

export interface LDiversityResult {
  passed: PrivacyRecord[];
  // Clases excluidas por homogeneidad de severity
  homogeneousClasses: Array<{ key: string; severity: Severity; count: number }>;
  lScoreByClass: Map<string, number>;
}

export interface TClosenessResult {
  passed: PrivacyRecord[];
  // Clases excluidas por sesgo de distribución respecto a la global
  violatingClasses: Array<{ key: string; emd: number; tBound: number; count: number }>;
  // EMD de la clase de equivalencia por record id
  tScoreByClass: Map<string, number>;
}
