# Brief: Bralidus MCP Server — `@bralidus/mcp`
**Fecha**: Julio 2026  
**Equipo**: Producto, Ingeniería, GTM  
**Estado**: En evaluación — pendiente aprobación para ejecución

---

## ¿Qué es esto?

Un **servidor MCP (Model Context Protocol)** es un paquete NPM que expone las capacidades de Bralidus como **herramientas nativas** dentro de cualquier cliente de IA compatible: Claude Desktop, Cursor IDE, Windsurf, n8n, y otros.

En lugar de que un desarrollador acceda al portal web o llame la API manualmente, **el LLM lo hace solo** — entiende cuándo y cómo usar Bralidus en el contexto de una conversación.

---

## El Problema que Resuelve

Hoy, integrar Bralidus requiere:
1. Abrir el Developer Portal
2. Copiar la API key
3. Leer la documentación
4. Escribir el `fetch()` manualmente

Con `@bralidus/mcp`, el desarrollador escribe en lenguaje natural y el LLM de su entorno **consume Bralidus directamente**, sin intermediarios.

---

## ¿Quién se Beneficia?

| Perfil | Cómo lo usa |
|---|---|
| **Desarrolladores usando Cursor IDE** | Piden análisis de mercado o datos macro directamente en el editor mientras codean |
| **Analistas con Claude Desktop** | Consultan S-Pulse, Licitus y Economy sin abrir ningún portal |
| **Equipos con n8n / Zapier AI** | Automatizan flujos de inteligencia B2G sin escribir código |
| **Clientes Enterprise de Bralidus** | Integran las capacidades en sus propios agentes de IA internos |

---

## Las 9 Herramientas (Tools MCP)

| Tool | Qué hace |
|---|---|
| `bralidus_intel_query` | GraphRAG unificado: macro + doctrina + S-Pulse + Licitus en una sola consulta |
| `bralidus_intel_moe_query` | Variante Mixture-of-Experts con routing explícito |
| `bralidus_economic_data` | Snapshot macro Chile: UF, IPC, TPM, USD/CLP, UTM, IPSA |
| `bralidus_licitus_proveedor` | Historial B2G de una empresa por RUT en Mercado Público |
| `bralidus_licitus_mercado_benchmarks` | Benchmarks de mercado público por rubro UNSPSC + región |
| `bralidus_licitus_activas` | Licitaciones abiertas ahora, filtradas por rubro/región/monto |
| `bralidus_spulse_search` | Buscar empresa en grafo societario chileno |
| `bralidus_spulse_profile` | Ficha 360° de empresa: socios, % participación, señales de riesgo |
| `bralidus_rag_query` | Consulta semántica al Knowledge Base (687 nodos) |

---

## Análisis de Costos

| Ítem | Costo |
|---|---|
| Infraestructura del MCP | **$0** — corre localmente en el cliente (stdio) |
| Publicación en NPM público | **$0** |
| Supabase Edge Functions | Incluido en plan actual |
| Motor BralidusPY (Railway) | Incluido en plan actual hasta ~500 req/día |
| **Total incremental para lanzar v0.1** | **$0** |

> El MCP es simplemente otro consumidor del RaaS Gateway que ya opera. El costo escala **con el revenue**, no antes.

---

## Fases de Implementación

| Fase | Contenido | Tiempo estimado |
|---|---|---|
| 1 | Scaffolding del repo, `package.json`, cliente HTTP hacia RaaS | 2–3 hs |
| 2 | MCP Server base + transport stdio + health check | 2–3 hs |
| 3 | Tools: Intel (MoE + query) + Economy | 3–4 hs |
| 4 | Tools: Licitus (3) + S-Pulse (3) + RAG (2) | 4–5 hs |
| 5 | Resource `bralidus://docs/api-reference` + README de integración | 1–2 hs |
| 6 | Tests unitarios + validación end-to-end con Claude Desktop | 2–3 hs |
| 7 | Publicación en NPM + documentación en Developer Portal | 1 hs |
| **Total** | | **~1.5–2 días de desarrollo** |

---

## Decisiones Pendientes del Equipo

| # | Decisión | Opciones |
|---|---|---|
| 1 | **¿Repositorio público o privado?** | Público (recomendado — el código no expone secrets) / Privado |
| 2 | **¿Nombre del paquete NPM?** | `bralidus-mcp` (simple) / `@bralidus/mcp` (org pública, gratis en NPM) |
| 3 | **¿Transport en v1?** | Solo `stdio` (Claude Desktop + Cursor) — recomendado para inicio / Incluir también `HTTP/SSE` (n8n, Zapier) |
| 4 | **¿Cuándo lo ejecutamos?** | ¿Próximo sprint? ¿Después del beta con usuarios reales? |

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El motor BralidusPY en Railway no soporta picos de uso si hay adopción masiva | Rate limiting ya implementado en `rateLimitMiddleware`; escalar Railway es inmediato |
| Uso no autorizado de la API vía MCP | El usuario necesita una Developer API Key válida — misma autenticación que el portal |
| Fragmentación de versiones si la API cambia | El MCP tendrá versionado semántico + changelog |

---

## Próximo Paso Recomendado

Una vez que el equipo apruebe las decisiones de la tabla anterior, la implementación toma **1–2 días de ingeniería** y el resultado es un paquete instalable con:

```bash
npx -y @bralidus/mcp
```

que cualquier usuario de Claude Desktop configura en 5 minutos.

---

*Preparado por: Antigravity (AI Dev Partner) · Bralidus Developer Portal · Sprint 8 · 2026*
