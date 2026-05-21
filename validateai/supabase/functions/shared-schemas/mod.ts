import { z } from 'npm:zod';

// ─── Input Schemas ────────────────────────────────────────────────────────────

export const RutSchema = z.string().regex(/^\d{7,8}-[0-9Kk]$/, 'RUT inválido. Formato esperado: 12345678-9');

export const ValidateRequestSchema = z.object({
  idea_description: z.string().min(20, 'La descripción debe tener al menos 20 caracteres').max(2000),
  industry: z.string().min(2).max(100),
  rut_empresa: RutSchema.optional(),
});

export type ValidateRequest = z.infer<typeof ValidateRequestSchema>;

// ─── Government API Response Schemas ─────────────────────────────────────────

export const SiiEmpresaSchema = z.object({
  rut: z.string(),
  razon_social: z.string(),
  inicio_actividades: z.string().datetime().nullable().optional(),
  actividades_economicas: z.array(z.object({
    codigo: z.string(),
    descripcion: z.string(),
  })).optional().default([]),
  estado_tributario: z.enum(['Vigente', 'Sin Inicio de Actividades', 'Bloqueado', 'No Existe', 'unknown']),
  anotaciones_vigentes: z.boolean().default(false),
});

export type SiiEmpresa = z.infer<typeof SiiEmpresaSchema>;

export const CmfUfSchema = z.object({
  fecha: z.string(),
  valor: z.number().positive(),
});

export type CmfUf = z.infer<typeof CmfUfSchema>;

export const InapiMarcaSchema = z.object({
  brand_searched: z.string(),
  matches_found: z.number().int().min(0),
  risk_level: z.enum(['low', 'medium', 'high']),
  observation: z.string(),
});

export type InapiMarca = z.infer<typeof InapiMarcaSchema>;

// ─── LLM Output Schema (enforced via structured output + Zod validation) ──────

export const LlmValidationResponseSchema = z.object({
  viability_score: z.number().min(0).max(100),
  regulatory_risk: z.object({
    level: z.enum(['Bajo', 'Medio', 'Alto']),
    reason: z.string(),
    sii_warnings: z.array(z.string()).optional(),
  }),
  market_analysis: z.object({
    tam_clp: z.number().nonnegative(),
    sam_clp: z.number().nonnegative(),
    competitors_detected: z.array(z.string()),
  }),
  unit_economics: z.object({
    estimated_cac_uf: z.number().nonnegative(),
    estimated_ltv_uf: z.number().nonnegative(),
    runway_months_estimate: z.number().nonnegative().optional(),
  }),
  swot: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    opportunities: z.array(z.string()),
    threats: z.array(z.string()),
  }),
  next_steps: z.array(z.string()).min(1).max(5),
  executive_summary: z.string().min(50),
});

export type ValidationResponse = z.infer<typeof LlmValidationResponseSchema>;

// ─── Enriched API Response (adds metadata) ────────────────────────────────────

export const RaasResponseSchema = LlmValidationResponseSchema.extend({
  metadata: z.object({
    model: z.string(),
    uf_value_clp: z.number().optional(),
    uf_date: z.string().optional(),
    sii_status: z.string().optional(),
    inapi_risk: z.string().optional(),
    pjud_status: z.enum(['clear', 'active_cases', 'pending_async_resolution']).optional(),
    rag_competitors_used: z.number().int().min(0),
    cached: z.boolean().default(false),
    processed_at: z.string().datetime(),
  }),
});

export type RaasResponse = z.infer<typeof RaasResponseSchema>;
