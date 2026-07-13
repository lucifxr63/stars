# VALIDUS — Informe de Auditoría para Due Diligence

> **Producto:** Validus (SaaS de validación de startups)
> **Empresa:** Scouttech
> **Producción:** https://validus.scouttech.lat
> **Repositorio auditado:** `validateai/` (React 19 + Vite + TypeScript + Supabase + Vercel)
> **Fecha:** 2026-06-28
> **Alcance:** Marca, landing, data room, producto/IA, arquitectura técnica, fricciones.
> **Naturaleza:** Pre-revenue (0 usuarios pagos a la fecha). MVP funcional en producción.

---

## 1. Resumen ejecutivo

Validus es un **MVP funcional y maduro a nivel de producto**, pero **inmaduro como sujeto de due diligence**. La distancia a un data room básico presentable es **moderada y abordable en 30–60 días**; no hay obstáculos estructurales.

Tres conclusiones que un inversionista debe escuchar sin rodeos:

1. **La marca pública ya es coherente como "Validus"**, pero la **capa técnica interna sigue siendo "validateai"** (nombre del repo, claves de almacenamiento, eventos, documentación). Un VC que mire la web no lo nota; uno que abra el repo o el DevTools, sí. Es deuda de coherencia, no un defecto de producto.
2. **El mayor riesgo no es la marca: son los datos mock presentados como evidencia.** La función `premium-validate` usa `fetchRedditMock()` / `fetchTrendsMock()` y `EvidenceWall.tsx` muestra datos ficticios. Vender "evidencia de mercado" simulada sin etiquetar es un riesgo legal y reputacional directo.
3. **Falta toda la capa documental institucional** (resumen ejecutivo, one-pager, pitch deck, modelo financiero, T&C, política de uso de IA, IP, competencia formal). El producto existe; el "paquete de inversión" no.

**Nivel de preparación para DD: ~20–25%.** El producto está; el envoltorio institucional, legal y de confianza no.

---

## 2. Estado actual del proyecto

### Producto (sólido)
- Wizard de validación en 4 pasos (Idea, Mercado, Fundador, Generación).
- Score de 5 dimensiones (problem / market / competition / solution / execution) — núcleo del producto, no debe modificarse.
- 4 tiers (free / basic / pro / premium) con rate limiting por tier ya implementado (`usage_counters` + RPC atómica).
- ~18 prompt types en la Edge Function `ai-validate`, incluyendo `governance_assessment`, `fundraising_roadmap`, `competitive_analysis` (con RAG), `unit_economics`, `market_sizing`.
- Dashboard con múltiples tabs, mapa 3D de Chile (Three.js), export PDF.
- Página de due diligence para VCs (`VCDiligence.tsx`) — un activo notable y poco común.

### Infraestructura
- Stack: React 19 + Vite + TS + Tailwind v4 + shadcn/ui + Supabase (Postgres + Edge Functions Deno) + Vercel.
- Auth Supabase PKCE + Google OAuth.
- Privacidad avanzada (Ley 21.719): hashing de RUT, IP truncada /24, separación de auditoría.
- Checkout (LemonSqueezy) con código deployado, pendiente de secrets.

### Comercial
- **Pre-revenue. 0 usuarios pagos.** Unit economics de plataforma estimados (≈$1 USD/reporte, margen >90%, objetivo LTV/CAC >3x) — son proyecciones, no métricas medidas.

### Documentación
- Abundante documentación **técnica/operativa** interna (`CLAUDE.md`, `docs/ESTADO_PRODUCTO.md`, `docs/FRONTEND_GUIDE.md`, caso de estudio fintech).
- **Cero documentación institucional/de inversión.**

---

## 3. Hallazgos principales

| # | Hallazgo | Severidad |
|---|---|---|
| H1 | Datos premium son mock sin etiquetar (`fetchRedditMock`, `fetchTrendsMock`, `EvidenceWall.tsx`) | **Crítica** |
| H2 | Incoherencia de marca en capa técnica: 214 ocurrencias de `validateai` en 60 archivos | Alta |
| H3 | Sin documentos institucionales para data room (exec summary, one-pager, deck, modelo financiero) | Alta |
| H4 | Sin T&C ni Política de uso de IA (solo existe Política de Privacidad) | Alta |
| H5 | Sin "Trust Layer": el usuario no distingue qué es dato real, qué es IA y qué es inferencia | Alta |
| H6 | Landing sin sección de confianza ni FAQ; narrativa anti-"otro chatbot" ausente | Media |
| H7 | Tracción inexistente (0 pagos) — inevitable en pre-revenue, debe enmarcarse honestamente | Media |
| H8 | Deuda técnica conocida: generación síncrona bloquea UI; admin sin paginación total | Media-Baja |
| H9 | Riesgo de marca/IP: conviene confirmar registro INAPI de "Validus" antes de invertir en branding | Media |

---

## 4. Inconsistencias detectadas

### 4.1 Marca Validus vs. ValidateAI (estratificada)

**Capa pública → ya es "Validus" (coherente):**
- `index.html`: title, description, OG, Twitter card, canonical, author — todo "Validus".
- Componentes de UI (`VCDiligence.tsx`, wizard `StepGenerating.tsx`, dashboard) dicen "Validus".

**Capa técnica → sigue siendo "validateai" (incoherente):**
- Nombre del repositorio: `validateai/`.
- Claves de almacenamiento y eventos: `validateai-session`, `validateai_preview_tier`, `validateai:tier-preview`, `validateai:paywall-hit`, `validateai_store`, `validateai-carousel`, `validateai_pdf_theme`, `validateai_onboarded`, etc.
- Documentación: `CLAUDE.md`, casi todo `docs/`.

> **Implicación para DD:** la inconsistencia es invisible al usuario final pero visible en cualquier revisión técnica de código. Señala "rebranding a medio camino". No es bloqueante, pero resta puntos de madurez.

> **Trampa de migración:** renombrar las claves de `localStorage` sin shim de migración **rompe sesiones persistidas de usuarios actuales**. El renombre debe leer la clave vieja y escribir la nueva durante una ventana de transición.

### 4.2 Evidencia simulada vs. evidencia real
`EvidenceWall.tsx` presenta como "evidencia de mercado" datos generados por mocks. Esto es una inconsistencia entre **lo que el producto promete** (evidencia) y **lo que entrega** (simulación). Es el hallazgo más delicado en términos de confianza.

---

## 5. Elementos faltantes para due diligence

### Documentos institucionales (ninguno existe)
- Resumen ejecutivo (1 página)
- One-pager
- Pitch deck
- Modelo financiero (18–36 meses)
- Métricas SaaS (MRR, churn, CAC/LTV medidos — hoy proyecciones)
- Go-to-market formal
- Análisis de competencia formal
- Propiedad intelectual / cap table / estructura societaria de Scouttech
- Roadmap de producto presentable (existe disperso en `CLAUDE.md`)
- Documento de riesgos y limitaciones del modelo de IA

### Legal (faltan)
- Términos y Condiciones
- Política de uso de IA (crítica para un producto de IA)
- *(Política de Privacidad ✅ ya existe)*

### Producto / Confianza (faltan o incompletos)
- Datos premium reales (Reddit OAuth, SerpApi/Google Trends)
- Trust Layer: fuentes, supuestos y nivel de confianza por output
- Tests y analítica de producto completos

### Coherencia técnica
- Renombre integral `validateai → validus` (repo, namespace, claves, docs)

---

## 6. Friction Check

| Tipo | Problema | Por qué importa | Impacto | Solución | Prioridad |
|---|---|---|---|---|---|
| **Confianza** | Datos premium mock sin etiquetar | Evidencia simulada = riesgo legal/reputacional | Alto | Etiquetar "demo" ahora; activar APIs reales después | **Alta** |
| **Marca** | `validateai` en capa técnica | DD técnica percibe rebranding inacabado | Medio-Alto | Renombre por capas con migración de claves | **Alta** |
| **Legal** | Sin T&C ni Política de uso de IA | Bloquea cliente enterprise y DD legal | Alto | Redactar ambos documentos | **Alta** |
| **Due diligence** | Sin data room ni artefacto de auditoría | Sin esto no hay conversación seria con inversionistas | Alto | Crear `/dataroom` + documentos | **Alta** |
| **Producto** | Sin Trust Layer (dato vs IA vs inferencia) | Diferenciador clave vs "otro chatbot" | Alto | Badges de fuente + nivel de confianza | **Alta** |
| **Comercial** | 0 usuarios pagos; métricas = proyecciones | DD exige tracción | Alto | Enmarcar pre-revenue + pipeline/LOIs honestos | Media |
| **Técnica** | Generación síncrona bloquea UI | Escalabilidad y UX | Media | Migrar a queue async | Media |
| **Escalabilidad** | Admin sin paginación total; INAPI 1.28GB pendiente | Costo/performance a escala | Baja-Media | Migraciones ya planificadas | Baja |

---

## 7. Recomendaciones por prioridad

### Prioridad Alta (afectan confianza, marca, legal, DD)
1. **Etiquetar datos mock como "Demo / datos simulados"** en `EvidenceWall.tsx` y `premium-validate` (mitiga H1 sin esperar APIs reales).
2. **Redactar Términos y Condiciones + Política de uso de IA** (nuevas rutas, patrón `PrivacyPolicy.tsx`).
3. **Producir el data room** (carpeta `/dataroom` + documentos institucionales mínimos).
4. **Trust Layer v1**: badge de fuente y nivel de confianza por output del análisis.
5. **Verificar registro de marca "Validus"** en INAPI antes de invertir en branding.

### Prioridad Media
6. **Renombre `validateai → validus`** por capas, con migración segura de claves de almacenamiento.
7. **Activar datos premium reales** (Reddit OAuth + SerpApi).
8. **Añadir secciones de confianza y FAQ** a la landing.
9. **Enmarcar tracción honestamente** (pre-revenue + pipeline).

### Prioridad Baja
10. Queue async para generación, paginación total en admin, tests/analítica completos, migración INAPI Fase 2.

---

## 8. Quick wins implementables

| Quick win | Esfuerzo | Impacto | Dónde |
|---|---|---|---|
| Etiquetar datos mock como demo | Horas | Crítico (riesgo legal) | `EvidenceWall.tsx`, `premium-validate` |
| Crear T&C + Política de uso de IA | 1 día | Alto | nuevas rutas + footer legal |
| One-pager + Resumen ejecutivo | 1 día | Alto | `/dataroom` (contenido ya disperso en docs) |
| Confirmar marca visible 100% "Validus" | Horas | Medio | sweep de UI/SEO (ya casi limpio) |
| Carpeta `/dataroom` con índice y placeholders | Horas | Medio | repo |
| Sección "Cómo Validus evita inventar información" en landing | Medio día | Alto (anti-chatbot) | `Landing.tsx` |

---

## 9. Cambios sugeridos en landing page

Estado actual de `Landing.tsx`: Hero → barra social proof → "Cómo funciona" (`#how`) → Features (`#features`) → banda de stats → Pricing (`#pricing`) → CTA.

**Faltan y se recomiendan:**
1. **Sección de Confianza / Trust** — explicar fuentes de datos, uso responsable de IA, y el Trust Layer. Es el diferenciador anti-"otro chatbot".
2. **FAQ** — preguntas frecuentes (¿qué datos entrego? ¿es IA o dato real? ¿quién ve mi idea? ¿cómo se calcula el score?).
3. **Footer legal** — enlaces a Privacidad, T&C y Política de uso de IA (los dos últimos por crear).
4. **Bloque "Cómo Validus evita inventar información"** — fuentes, supuestos y nivel de confianza visibles.
5. **Casos de uso / segmentos** — founders, equipos de innovación, aceleradoras (refuerza "para quién es").

---

## 10. Documentos que debemos crear

Ubicación sugerida: `/dataroom/` (o `docs/dataroom/`).

| Documento | Tipo | Fuente de contenido |
|---|---|---|
| `EXECUTIVE_SUMMARY.md` | Institucional | `ESTADO_PRODUCTO.md` + `CLAUDE.md` |
| `ONE_PAGER.md` | Institucional | resumen ejecutivo |
| `PITCH_DECK` (outline) | Inversión | propuesta de valor + tracción |
| `FINANCIAL_MODEL` | Inversión | unit economics existentes |
| `GTM.md` | Comercial | CAC objetivo, canales Meta/LinkedIn |
| `COMPETITION.md` | Comercial | `competitive_analysis` / RAG |
| `IP_AND_CAPTABLE.md` | Legal/Societario | Scouttech |
| `AI_USAGE_POLICY` (ruta + doc) | Legal | nuevo |
| `TERMS_AND_CONDITIONS` (ruta + doc) | Legal | nuevo |
| `RISKS_AND_LIMITATIONS.md` | Producto/IA | límites del modelo |
| `SECURITY_AND_PRIVACY.md` | Técnico | privacy sprint (Ley 21.719) |
| `ARCHITECTURE.md` | Técnico | `CLAUDE.md` (extraer versión presentable) |

---

## 11. Roadmap recomendado 30 / 60 / 90 días

### 30 días — Confianza y blindaje
- Etiquetar/neutralizar datos mock premium.
- T&C + Política de uso de IA (rutas + footer legal).
- `VALIDUS_DUE_DILIGENCE_AUDIT.md` (este documento) + Exec Summary + One-pager.
- Verificar marca "Validus" en INAPI.
- Trust Layer v1 (badges de fuente/confianza).

### 60 días — Data room y narrativa
- Estructura `/dataroom` completa con plantillas (deck, modelo financiero, GTM, competencia, IP).
- Secciones de Confianza + FAQ en landing.
- Renombre `validateai → validus` por capas (con migración de claves).
- Activar datos premium reales (Reddit + SerpApi).

### 90 días — Madurez y escala
- Queue async para generación.
- Tests + analítica de producto completos.
- Métricas SaaS reales (una vez exista revenue).
- Migración INAPI Fase 2 y paginación total en admin.

---

## Próximos pasos sugeridos para implementación

### Fase 1 — Correcciones críticas
- Etiquetar datos mock como "demo" (`EvidenceWall.tsx`, `premium-validate`).
- Auditar y cerrar coherencia de marca visible (UI/SEO/metadata).
- Corregir CTAs, títulos y copy menores que aún digan o impliquen ValidateAI.
- Redactar T&C + Política de uso de IA y enlazarlos en footer.

### Fase 2 — Mejora de landing
- Añadir sección de Confianza/Trust, FAQ, footer legal completo.
- Bloque "Cómo Validus evita inventar información".
- Casos de uso por segmento + métricas/entregables visibles.

### Fase 3 — Due diligence / data room
- Crear carpeta `/dataroom` con índice.
- Generar documentos institucionales (exec summary, one-pager, deck, modelo financiero, GTM, competencia, IP, riesgos, seguridad, arquitectura).
- Plantillas y assets reutilizables.

### Fase 4 — Producto y confianza
- Trust Layer completo: fuentes, supuestos, nivel de confianza por output.
- Activar fuentes de datos reales (Reddit, Trends, BCCh para SOM).
- Renombre técnico integral `validateai → validus` con migración de claves de almacenamiento (cambio no destructivo, requiere plan previo).

---

### Reglas operativas de implementación
- **No hacer cambios destructivos sin explicar impacto primero.** El renombre y el cambio de claves de `localStorage` son exactamente ese tipo de cambio: requieren plan y shim de migración, no edición directa.
- **Orden seguro del renombre:** (1) repo/docs → (2) namespace de código no persistido → (3) claves de almacenamiento con shim de migración (leer clave vieja → escribir nueva durante una ventana de transición).
- **El score de 5 dimensiones no se toca** — es el núcleo del producto y ya está correctamente implementado.

---

*Documento generado como auditoría inicial. Es un punto de partida para el data room, no un sustituto de revisión legal/contable profesional para las secciones de IP, societario y modelo financiero.*
