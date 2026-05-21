# Corpus Baseline — v1.0.0-rc1

**Fecha de corte:** 2026-05-21  
**Tag:** `v1.0.0-rc1`  
**Audit run:** `7ff2aa85-bec2-4f83-a7e9-4a408fe06175`

## Estado del knowledge_base

| Categoría   | Chunks | Documentos fuente |
|-------------|-------:|-------------------|
| regulatory  |     26 | Ley 21.521 (Cap I, III, IV, VIII), CMF NCG-502, CMF RPSF |
| methodology |     21 | LTV/CAC, Lean Startup, Cohort Analysis, Pitch Deck, Unit Economics, Retención/Churn |
| gtm         |      4 | CAC, pricing APIs, ICP, funnel, distribución LATAM |
| market      |      1 | Ecosistema fintech Chile/LATAM |
| **Total**   | **52** | |

## Resultados de auditoría (evaluador v2 con LEMMA_MAP)

| Categoría   | Precisión | Queries | Estado |
|-------------|----------:|--------:|--------|
| Legal       |     100%  |       7 | ✅ PASS |
| GTM         |     100%  |       6 | ✅ PASS |
| Methodology |     100%  |       7 | ✅ PASS |
| Market      |     100%  |       5 | ✅ PASS |
| Edge        |     100%  |       5 | ✅ PASS |
| **Global**  | **100%**  |  **30** | ✅ **CERTIFIED** |

- Keyword hits: 26/25 (lemma matching activo)
- Avg latency: 6550ms
- Errors: 0

## Configuración del pipeline (frozen para beta)

```
Embedding model : text-embedding-3-small (OpenAI, 1536d nativo)
LLM synthesis   : claude-haiku-4-5-20251001 (Anthropic)
Vector index    : HNSW (m=16, ef_construction=64, cosine)
Similarity thresholds:
  knowledge_base   : 0.45
  rag_playbooks    : 0.50
  tenant_vectors   : 0.45
Max chunks returned: 8 (top-k after parallel merge)
Max tokens synthesis: 1024
```

## Code freeze

Cambios bloqueados en `knowledge_base` hasta completar pruebas de carga con usuarios beta.  
Para agregar documentos post-RC: crear PR con script `seed-*.ts` + re-ejecución de `audit-rag.ts`.  
Threshold mínimo de aprobación para merge: **≥ 97% precision global**.
