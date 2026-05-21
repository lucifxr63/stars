Evolución a RAG-as-a-Service (RaaS) para ValidateAI
1. Resumen Ejecutivo
Se ha detectado la necesidad estratégica de evolucionar ValidateAI desde una aplicación monolítica (SPA) orientada a consumidores finales hacia una infraestructura modular B2B de validación como servicio (RAG-as-a-Service o RaaS). La solución propuesta orquesta la ingesta de bases de datos vectoriales propietarias (Supabase pgvector) con un enjambre de integraciones de APIs gubernamentales y financieras chilenas (SII, CMF, Fintoc, INAPI, PJUD), inyectando contexto empírico estructurado en los modelos de lenguaje (Claude 3.5 Sonnet) para eliminar alucinaciones y emitir diagnósticos de viabilidad con grado de inversión, habilitando una nueva línea de monetización mediante consumo de API.
2. Análisis por Agentes
👨‍💼 Product Owner (PO): Definición del "QUÉ" y Valor de Negocio
Objetivo de Negocio:
Transformar la propiedad intelectual algorítmica de ValidateAI en un activo monetizable a través de una API RESTful (RaaS). Al integrar datos duros del ecosistema chileno, la plataforma pasará de emitir "consejos genéricos" a "auditorías de viabilidad de grado institucional". Esto permite abrir el mercado B2B: fondos de Venture Capital, aceleradoras (ej. Start-Up Chile, Platanus Ventures) e incubadoras universitarias podrán consumir nuestra API para hacer un due diligence automatizado de sus postulantes.
Usuarios Objetivos:
Desarrolladores Externos / Partners B2B: Consumen el endpoint /api/v1/validate para integrar la validación en sus propios embudos de postulación o herramientas SaaS.
Emprendedores B2C (ValidateAI SPA): Usuarios directos del wizard web que experimentarán reportes sustancialmente más precisos, con alertas legales reales y proyecciones económicas basadas en la Unidad de Fomento (UF) e inflación al día.
Backlog de Historias de Usuario (Épica: RaaS & Data Governance):
ID
Historia de Usuario (Como / Quiero / Para)
Criterios de Aceptación (DoD específico)
US-01
Como sistema orquestador, quiero consultar la API del SII mediante el RUT para validar la existencia, rubro y riesgo fiscal de la empresa evaluada.
1. El endpoint sii-risk-evaluator debe recibir un RUT validado.

2. Debe retornar un JSON estructurado con razon_social y estado_tributario.

3. Si el estado es "Sin Inicio de Actividades", el LLM debe clasificar el Riesgo Regulatorio como "Alto".
US-02
Como motor de cálculo económico, quiero sincronizar datos de la CMF para proyectar Unit Economics reales.
1. La Edge Function sync-economic-data se ejecuta vía CRON diario.

2. Almacena UF, IPC y Dólar en caché local (tabla market_bde_data).

3. El LLM recibe el valor exacto de la UF para calcular el TAM y SAM.
US-03
Como analista de riesgo, quiero consultar la API del Poder Judicial (PJUD) para detectar contingencias legales del equipo fundador.
1. El sistema envía un POST asíncrono a la API (ej. Boostr).

2. Se expone un Webhook para recibir el payload de respuesta.

3. Si causas_activas > 0, se reduce el score de "Founder-Market Fit".
US-04
Como validador de marca, quiero conectarme a INAPI para advertir sobre colisiones de propiedad intelectual.
1. La consulta se realiza enviando el idea_name.

2. Si retorna estado "Concedida" para una marca idéntica en la misma clase Niza, el sistema sugiere un pivote de nombre en el paso de "Próximos Pasos".
US-05
Como motor RAG, quiero extraer contexto de la base de datos vectorial competitors para generar el análisis FODA y de brechas.
1. El input del usuario genera un embedding usando text-embedding-3-small.

2. Se ejecuta la función RPC search_competitors con un threshold mínimo de 0.65.

3. Inyecta el top 5 de competidores en el mega-prompt.
US-06
Como desarrollador externo, quiero autenticarme en la API RaaS para consumir los modelos de validación.
1. Generación de API Keys en el dashboard de usuario.

2. Rate limiting implementado por API Key (ej. 100 req/min).

3. Documentación Swagger accesible en /developers.

Priorización MoSCoW (Para el lanzamiento del RaaS):
Must Have: Integración RAG con base vectorial de competitors y market_context, Integración SII y CMF (esenciales para el Unit Economics), API Gateway seguro con tokens JWT/API Keys, Documentación OpenAPI/Swagger.
Should Have: Búsqueda INAPI para marcas, Caché semántico (cached_analyses) para reducir costos de LLM.
Could Have: Fintoc API para análisis de runway financiero (requiere un flujo UX complejo de consentimiento OAuth), PJUD (por la latencia de consultas asíncronas).
Won't Have (por ahora): Análisis predictivo de facturación a futuro con integraciones a ERPs contables (ej. Nubox, Defontana).
⏱️ Project Manager / Scrum Master (PM): Definición del "CUÁNDO" y Riesgos
Para ejecutar esta transición de manera controlada y sin romper la actual experiencia B2C (SPA en React), la ejecución se estructurará en un Roadmap de 4 Fases (Sprints de 2 semanas cada uno), adoptando una mentalidad MVP estricta.
Roadmap de Ejecución:
Fase 1: Infraestructura de Datos y RAG Core (Semanas 1-2)
Objetivo: Consolidar el cerebro del sistema.
Tareas: Migraciones en Supabase para asegurar la extensión pgvector. Poblar las tablas competitors, rag_playbooks, economic_knowledge, y market_context. Desarrollar las funciones RPC en SQL (search_competitors, search_cached_analyses).
Hito: El motor RAG funciona internamente y retorna el JSONB correcto.
Fase 2: Integraciones Gubernamentales Síncronas (Semanas 3-4)
Objetivo: Conectar los Data Fetchers de baja latencia.
Tareas: Creación de Edge Functions en Deno para sii-proxy (SII), sync-economic-data (CMF), y inapi-fetch (INAPI). Implementación de la validación estricta con Zod para los payloads de respuesta de estas APIs.
Hito: Las llamadas a la IA se enriquecen con datos duros en tiempo real.
Fase 3: Integraciones Asíncronas y Open Finance (Semanas 5-6)
Objetivo: Manejar la complejidad del PJUD y Fintoc.
Tareas: Implementar el endpoint webhook-pjud para recibir notificaciones de causas legales. Desarrollar el flujo OAuth fintoc-link en el frontend y el procesador de transacciones en el backend. Modificar la UX para incluir un estado de "Análisis en Progreso (Esperando antecedentes legales)".
Hito: El sistema es capaz de emitir reportes diferidos basados en el polling o webhooks de servicios lentos.
Fase 4: RaaS API Gateway y Documentación (Semanas 7-8)
Objetivo: Empaquetar y comercializar la tecnología.
Tareas: Generar el archivo swagger.yaml. Exponer endpoints públicos autenticados mediante API Keys. Configurar el portal para desarrolladores. Establecer políticas de facturación (Stripe metered billing) por llamada a la API.
Hito: Lanzamiento de la beta privada de ValidateAI RaaS.
Matriz de Riesgos y Bloqueos:
Riesgo Detectado
Probabilidad
Impacto
Plan de Mitigación (Contingencia)
Latencia extrema o timeout en API del PJUD
Alta
Alto
Separar la consulta del PJUD del flujo síncrono. Emitir el reporte inicial sin el apartado legal, y actualizar asíncronamente (vía WebSocket/Email) cuando el webhook de PJUD responda.
Caída de APIs gubernamentales (SII/CMF)
Media
Alto
Mantener una caché local con vigencia de 24-48 hrs en la tabla economic_knowledge. Si la API del SII falla, proveer un análisis general sin la penalización de riesgo regulatorio y notificar al usuario.
Sobrecarga de costos en llamadas al LLM (Claude/OpenAI)
Media
Crítico
Configurar estrictamente Prompt Caching en Anthropic. Implementar la tabla cached_analyses con búsqueda vectorial para reutilizar respuestas de ideas similares (similitud > 0.92) sin invocar al LLM.
Inconsistencia en el output JSON del LLM
Baja
Crítico
Utilizar la característica Structured Outputs de OpenAI/Anthropic acoplada con validación profunda de Zod en la Edge Function antes de devolver el payload al cliente.

💻 Tech Lead: Definición de la "VIABILIDAD" y Arquitectura
La transición hacia un ecosistema RaaS demanda una arquitectura serverless resistente, inmutable y estrictamente tipada. El esquema propuesto se asienta sobre Supabase, utilizando Deno Edge Functions como middleware orquestador.
Tech Stack Recomendado:
Base de Datos: PostgreSQL con extensión pgvector (almacenamiento de embeddings) y tipos nativos JSONB para metadatos jerárquicos.
Backend / Orquestador: Supabase Edge Functions (Deno / TypeScript).
Validación de Esquemas: zod para validación estricta de variables de entorno, payloads de entrada, respuestas de APIs externas y salidas del LLM.
Inteligencia Artificial: OpenAI text-embedding-3-small para vectorización. Anthropic claude-3-5-sonnet-20241022 para razonamiento profundo e inyección de contexto.
Documentación API: OpenAPI 3.0 (swagger.yaml).
Visualización Arquitectónica para Desarrolladores (Mermaid):



Fragmento de código
sequenceDiagram
    participant Dev as External Dev / Frontend
    participant Gateway as Supabase Edge Functions (API Gateway)
    participant APIs as Gov/Fin APIs (SII, CMF, INAPI, PJUD)
    participant DB as Postgres (pgvector + JSONB)
    participant Embed as OpenAI (Embeddings)
    participant LLM as Claude 3.5 Sonnet

    Dev->>Gateway: POST /api/v1/validate { rut, idea_desc, industry }
    
    Gateway->>Embed: Generar Vector(idea_desc)
    Embed-->>Gateway: retorna vector(1536)
    
    par Recolección de Datos Duros
        Gateway->>APIs: Fetch SII (Status Tributario)
        Gateway->>APIs: Fetch CMF (Valor UF Actual)
        Gateway->>APIs: Fetch INAPI (Disponibilidad de Marca)
    end
    
    par Búsqueda Vectorial (RAG)
        Gateway->>DB: rpc('search_competitors', vector)
        DB-->>Gateway: Competidores Similares (JSONB)
        Gateway->>DB: rpc('search_playbooks', vector)
        DB-->>Gateway: Fragmentos metodológicos (Text)
    end
    
    Gateway->>Gateway: Validar inputs y APIs con Zod
    Gateway->>LLM: Ensambla Mega-Prompt (Contexto RAG + Datos APIs + Idea)
    LLM-->>Gateway: Retorna Análisis Estructurado (Structured Output JSON)
    Gateway->>Gateway: Parsear y tipar respuesta del LLM (Zod)
    Gateway-->>Dev: Response 200 OK (Score, Riesgos, Recomendaciones, Unit Economics)


Esquemas Estrictos y Documentación (Zod & OpenAPI):
Para asegurar que los desarrolladores que consuman nuestro RaaS confíen en el servicio, implementaremos validaciones rígidas dentro de las Edge Functions usando zod. Esto asegura que el LLM jamás alucine una estructura inesperada.
1. Definición Zod en el Backend (Deno Edge Function):



TypeScript
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Validación de la fuente SII
export const SiiPayloadSchema = z.object({
  rut: z.string().regex(/^\d{7,8}-[0-9Kk]$/),
  razon_social: z.string(),
  inicio_actividades: z.string().datetime().nullable(),
  actividades_economicas: z.array(z.object({
    codigo: z.string(),
    descripcion: z.string()
  })),
  estado_tributario: z.enum(),
  anotaciones_vigentes: z.boolean()
});

// Validación de la fuente CMF
export const CmfPayloadSchema = z.object({
  UFs: z.array(z.object({
    Fecha: z.string(),
    Valor: z.string().transform(val => parseFloat(val))
  })).min(1)
});

// Esquema Estructurado forzado para el LLM (Claude)
export const LlmValidationResponseSchema = z.object({
  viability_score: z.number().min(0).max(100),
  regulatory_risk: z.object({
    level: z.enum(),
    reason: z.string(),
    sii_warnings: z.array(z.string()).optional()
  }),
  market_analysis: z.object({
    tam_clp: z.number(),
    sam_clp: z.number(),
    competitors_detected: z.array(z.string())
  }),
  unit_economics: z.object({
    estimated_cac_uf: z.number(),
    estimated_ltv_uf: z.number(),
    runway_months_estimate: z.number().optional()
  }),
  executive_summary: z.string()
});

export type ValidationResponse = z.infer<typeof LlmValidationResponseSchema>;


2. Fragmento de OpenAPI (swagger.yaml) para el Portal de Desarrolladores:



YAML
openapi: 3.0.3
info:
  title: ValidateAI RaaS API
  version: "1.0.0"
  description: API de Validación de Ideas de Negocio enriquecida con RAG y datos gubernamentales chilenos (SII, CMF, INAPI).
servers:
  - url: https://api.validateai.cl/v1
paths:
  /validate:
    post:
      summary: Ejecuta un análisis de viabilidad algorítmica
      security:
        - BearerAuth:
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - idea_description
                - industry
              properties:
                idea_description:
                  type: string
                  description: Descripción detallada del modelo de negocio.
                industry:
                  type: string
                  example: "fintech"
                rut_empresa:
                  type: string
                  description: RUT chileno para ingesta de datos SII y PJUD.
                  example: "76.123.456-7"
      responses:
        '200':
          description: Análisis estructurado completado con éxito.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ValidationResponse'
components:
  schemas:
    ValidationResponse:
      type: object
      properties:
        viability_score:
          type: integer
          example: 85
        regulatory_risk:
          type: object
          properties:
            level:
              type: string
              example: "Alto"
            reason:
              type: string
              example: "Operación financiera detectada sin inicio de actividades vigente en SII."


🎨 UX/UI Designer: Definición de la "EXPERIENCIA"
Al transformarnos en un modelo RaaS, la plataforma atiende a dos perfiles con necesidades de experiencia de usuario completamente distintas: el Emprendedor (B2C) y el Desarrollador/Agencia (B2B).
Flujo 1: Portal B2C (El "Wizard" Enriquecido)
La introducción de validaciones legales y bancarias añade fricción. El diseño debe convertir esta fricción en confianza ("Trust Signals").
Paso de Contexto Legal (Nuevo): Tras describir la idea, se solicita opcionalmente el RUT de la empresa y una conexión segura.
Componente FintocConnectBtn: Un botón diseñado con estándares de Open Finance para conectar la cuenta bancaria. Debe incluir un modal explicativo claro: "Solo leeremos los saldos y categorización de gastos para calcular tu Runway financiero. Operación segura y encriptada".
Estados de Carga Informativos (LoadingAI.tsx): Puesto que ahora consultamos APIs externas (INAPI, SII) y corremos búsquedas vectoriales, el tiempo de carga puede subir de 3s a 10s. La pantalla de carga debe mostrar un stepper dinámico:
Consultando disponibilidad de marca en INAPI...
Evaluando riesgo tributario en SII...
Cruzando vectores de competidores locales...
Generando tu reporte...
Componentes Críticos de Resultado:
RiskAnalysisCard: Se debe expandir para incorporar insignias verificadas. Ej. "Tributario: Vigente (Fuente: SII)".
UnitEconomicsCard: Mostrar los valores expresados nativamente en UF y CLP con una nota al pie dinámica: "UF calculada a $38.500,5 según CMF al [Fecha]".
Flujo 2: Portal para Desarrolladores B2B (Dashboard RaaS)
Pantalla de Gestión de API Keys: Tabla simple para crear, rotar o revocar claves API.
Pantalla de Métricas de Consumo: Gráficos (usando Recharts) que muestren el volumen de llamadas, tiempos de respuesta promedio y costos acumulados.
Consola Interactiva (Playground): Un componente integrado en la web (estilo Stripe o Supabase) que permita hacer solicitudes POST de prueba a /api/v1/validate viendo el JSON de respuesta en tiempo real, con snippets copiables en cURL, Node.js y Python.
Accesibilidad (A11y):
Uso estricto de roles ARIA para los estados de carga, asegurando que los lectores de pantalla notifiquen al usuario cuando la información del SII o PJUD haya terminado de resolverse.
Contraste de color AA (mínimo 4.5:1) en los badges de riesgo (Rojo para PJUD/Demandas, Verde para marcas disponibles).
🕵️ QA Engineer: Definición de la "CALIDAD"
El modelo RaaS impone una política de cero tolerancia frente a caídas de servicio o respuestas inconsistentes, dado que clientes B2B automatizarán procesos críticos apoyándose en nuestra API. La estrategia de calidad muta de "asegurar que la web se vea bien" a "asegurar el contrato de la API en todas sus dimensiones".
Checklist de Validación y Casos de Prueba:
Categoría
Caso de Prueba
Input / Precondición
Resultado Esperado (Criterio de Aceptación)
Integración SII
Validación RUT Correcto
rut: "76.123.456-7" (Empresa real)
Proxys parsean la respuesta; JSON RaaS incluye estado tributario y actividades. El LLM ajusta el contexto.
Integración SII
Caída de servicio origen
El proxy del SII devuelve HTTP 500 o Timeout.
El RaaS no debe caer. La Edge Function captura el error, asigna un estado "Not Verified" y procesa el reporte asumiendo riesgo por defecto. Se loggea en Sentry.
RAG Competitors
Búsqueda sin match evidente
Idea innovadora sin mercado aparente. Búsqueda vectorial falla umbral.
La RPC search_competitors retorna un arreglo vacío. El prompt al LLM se ensambla indicando "Mercado naciente sin competidores mapeados".
API CMF
Parsing de UF y conversión
Consulta CMF exitosa con valor UF actual.
El UnitEconomicsCard en B2C y el JSON RaaS muestran proyecciones financieras precisas (ej. TAM = X UF * Valor_CLP). La validación Zod asegura que el tipo de dato no sea NaN.
Async PJUD
Webhook no responde
Startup consulta causas y el webhook de Boostr/PJUD demora > 2 min.
El RaaS síncrono finaliza y retorna pjud_status: "pending_async_resolution". La UI no se bloquea.
LLM Output
Hallucination Guard
El modelo LLM responde un JSON mal formado o con llaves faltantes.
La validación de Zod (LlmValidationResponseSchema.parse) arroja error en la Edge Function, se activa un reintento automático (max 2 retries) antes de fallar.
Fintoc / PII
Data Leakage
Fintoc retorna el historial transaccional completo del fundador.
La Edge Function agrega saldos, extrae el "burn rate" y descarta / destruye los arrays de transacciones en memoria. Nada de información personal PII llega al log ni al prompt del LLM (Cumplimiento Ley 21.719).

Definition of Done (DoD) para la Transición a RaaS:
Todo nuevo endpoint RaaS cuenta con esquemas de Request y Response tipados en TypeScript (Zod).
Las llamadas a las APIs externas (SII, CMF, INAPI) están resguardadas en bloques try/catch con mecanismos de fallback declarados.
El archivo swagger.yaml ha sido actualizado, verificado en Swagger Editor, y desplegado.
La base vectorial (pgvector) tiene sus índices HNSW o IVFFlat aplicados en producción para optimizar búsquedas.
El Prompt Caching de Anthropic está configurado para reutilizar perfiles económicos y regulaciones estáticas, verificando en logs una reducción del costo de tokens de entrada.
3. Recomendación Final del Equipo
La Mesa Directiva concluye que la evolución hacia un modelo RAG-as-a-Service (RaaS) es no solo viable, sino el único camino para generar un monopolio de validación (Moat) tecnológico inalcanzable para wrappers de IA genéricos. La combinación del razonamiento algorítmico (Claude) respaldado por datos inmutables y empíricos del entorno burocrático chileno (SII, CMF, INAPI) creará el estándar oro en due diligence automatizado.
🚀 Siguiente Paso Crítico para Iniciar la Ejecución:
El Tech Lead debe aislar e implementar el "API Gateway Edge Function" en Supabase. Esto implica definir un repositorio central de esquemas Zod compartidos (shared-schemas) y construir las tres primeras funciones proxy (sii-proxy, sync-economic-data, y inapi-fetch) que alimentarán el motor RAG. Simultáneamente, el equipo debe habilitar el portal para desarrolladores con el archivo swagger.yaml para comenzar la evangelización temprana con fondos de inversión locales (Beta Testing B2B).
