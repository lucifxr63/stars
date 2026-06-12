Plan de Ejecución Estratégico: Transición a Arquitectura GraphRAG y Mitigación de Alucinaciones en Validus1. Resumen EjecutivoEl análisis exhaustivo de la infraestructura actual de la plataforma Validus revela que la dependencia exclusiva de la similitud vectorial (embeddings) para la recuperación de información está introduciendo ruido semántico crítico en los reportes de validación. La utilización de un umbral de coincidencia (match_threshold) permisivo de 0.45 en las funciones de base de datos de Supabase permite la inyección de fragmentos irrelevantes en el contexto de los Modelos de Lenguaje Grande (LLMs), específicamente Claude Sonnet y Haiku, forzándolos a extrapolar o "alucinar" conexiones lógicas inexistentes. Para erradicar este problema y preservar la confianza del usuario final, la solución técnica exige una transición arquitectónica escalonada hacia un modelo híbrido de Recuperación Aumentada (GraphRAG). La ejecución comprende un parche inmediato en las funciones perimetrales (Edge Functions) para forzar una degradación elegante del modelo ante la falta de datos, la adopción de un sistema de gestión de contenido estructurado basado en la sintaxis de Obsidian (enlaces bidireccionales en Markdown), y la implementación final de un motor de travesía de grafos mediante Expresiones de Tabla Comunes (CTEs) recursivas en PostgreSQL combinadas con pgvector. El resultado proporcionará respuestas deterministas para datos duros y regulatorios, manteniendo la flexibilidad semántica para evaluaciones cualitativas.2. Análisis por AgentesProduct Owner (PO): Definición de Valor y Priorización EstratégicaLa iniciativa de transformar el motor de conocimiento subyacente de Validus se fundamenta en la necesidad imperativa de proteger el activo más valioso de la plataforma de validación de startups: la exactitud y confiabilidad del "Score de Validación" y de los entregables estratégicos (ej. hoja de ruta regulatoria, análisis de riesgos). Las alucinaciones en recomendaciones legales, como normativas de la Comisión para el Mercado Financiero (CMF) o la Ley 21.719 de Protección de Datos Personales , representan un riesgo reputacional severo. El desarrollo se estructura bajo una mentalidad estricta de Producto Mínimo Viable (MVP), priorizando la precisión factual inmediata y escalando hacia una infraestructura de grafo relacional.Objetivo de Negocio: Erradicar el 100% de las alucinaciones factuales del motor de IA para incrementar la retención de usuarios en los planes de pago (Pro/Premium), reducir la tasa de rebote por análisis incoherentes y construir un foso defensivo (moat) basado en un corpus de datos estructurados e interconectados del ecosistema emprendedor chileno.Usuarios Objetivo:Emprendedor (Usuario Final): Requiere que los entregables generados (análisis competitivo, tamaño de mercado, estructuración legal) contengan datos exactos, referenciados y libres de extrapolaciones algorítmicas.Equipo Legal y de Contenidos (Usuario Interno): Requiere una interfaz de escritura sin fricción (Obsidian) para actualizar normativas, playbooks y directrices sin depender de despliegues de ingeniería ni de gestores de contenido complejos.Priorización MoSCoWLa siguiente tabla detalla la priorización de los requerimientos para asegurar la entrega continua de valor sin interrumpir la operación de la Single Page Application (SPA) basada en React 19 y Vite.PrioridadRequerimiento (Épica)Justificación de NegocioImpacto en Arquitectura ActualMust HaveAjuste de umbrales RPC (match_threshold a 0.75) y manejo de fallos elegantes en el System Prompt.Detiene la hemorragia de confianza actual. Evita que la IA invente datos al carecer de vectores altamente similares.Modificación directa en supabase/functions/ai-validate/index.ts y en los RPC de Supabase.Must HaveRepositorio Obsidian Vault sincronizado vía CI/CD con Supabase.Permite al equipo de contenido curar la base de conocimientos con referencias cruzadas reales (]) sin un CMS a medida.Creación de flujos de GitHub Actions y un nuevo endpoint en Deno para ingesta de Abstract Syntax Trees (AST).Must HaveMigración a esquema de Grafo (Nodos y Aristas) en PostgreSQL.Sustituye la inferencia probabilística por recuperación determinista para entidades exactas y jerárquicas.Migración SQL para crear tablas knowledge_nodes y knowledge_edges.Should HaveMotor de Búsqueda Híbrido (Vector + Grafo) en Supabase.Maximiza la tasa de respuesta útil al usar pgvector como respaldo cuando el grafo no posee conexiones directas.Función SQL avanzada combinando CTEs recursivas y operadores de distancia coseno.Could HaveVisualización del Grafo de Conocimiento en el panel de Administración.Proporciona herramientas internas para identificar "nodos huérfanos", pero no bloquea la entrega de valor al cliente.Nueva ruta en src/app/routes/Admin.tsx consumiendo datos de agregación con Recharts/Three.js.Won't HaveDespliegue de un servidor Obsidian Publish o base de datos Neo4j externa.Mantener la arquitectura nativa en Supabase (PostgreSQL) evita latencias de sincronización y reduce drásticamente los costos de infraestructura.Sin impacto, se restringe el stack a las tecnologías actuales.Backlog Accionable (Historias de Usuario y Criterios de Aceptación)Las siguientes historias de usuario están formateadas para importación directa en herramientas de gestión ágil (Jira, Linear).ID TicketÉpicaDescripción (Como/Quiero/Para)Criterios de Aceptación (DoD)VAL-101Hotfix Anti-AlucinacionesComo administrador del sistema, quiero que las funciones de búsqueda vectorial exijan una alta similitud semántica, para evitar inyectar contexto irrelevante en el prompt de la IA.1. Las funciones SQL search_knowledge_base, search_rag_playbooks requieren match_threshold ≥ 0.75.2. Si ninguna coincidencia supera el umbral, la base de datos devuelve un arreglo vacío.3. Despliegue completado sin afectar el wizard de StepGenerating.tsx.VAL-102Degradación EleganteComo usuario emprendedor, quiero que la IA admita cuando no tiene información específica, para no recibir datos inventados que perjudiquen mi validación.1. El System Prompt instruye a Claude a responder: "No tengo información en mis fuentes sobre este punto".2. La UI en ValidationDetail.tsx detecta esta cadena y renderiza un componente EmptyStateAI en lugar de un error.VAL-103Repositorio ObsidianComo experto legal, quiero redactar normativas usando sintaxis de Obsidian (enlaces [[ ]]), para mapear las relaciones lógicas de forma intuitiva.1. Repositorio en GitHub configurado como bóveda Obsidian.2. Uso estricto de sintaxis Markdown para documentos normativos (ej. Ley Fintec).VAL-104Pipeline AST Node.jsComo desarrollador, quiero que los cambios en la bóveda se procesen mediante chunking semántico, para poblar la base de datos de nodos automáticamente.1. GitHub Action configurada al hacer push a main.2. Script TypeScript utiliza remark o mdast para extraer encabezados y wikilinks.3. Payload enviado a Supabase Edge Function mediante autenticación de servicio.VAL-105Esquema GraphRAG PostgresComo arquitecto de datos, quiero almacenar entidades y relaciones en Supabase, para permitir consultas transversales deterministas mediante SQL.1. Migración SQL ejecutada creando knowledge_nodes (con pgvector) y knowledge_edges.2. Restricciones de integridad referencial aplicadas entre nodos y aristas.VAL-106Motor Híbrido CTEComo sistema de IA, quiero extraer entidades de la consulta del usuario y navegar el grafo, para recuperar el contexto exacto junto con un respaldo vectorial.1. Implementación de una consulta recursiva CTE en Postgres (profundidad máxima = 2).2. Fusión de resultados (Grafo + Vector) priorizando coincidencias de aristas exactas sobre proximidad de cosenos.Project Manager / Scrum Master (PM): Planificación, Riesgos y EjecuciónLa evolución de una arquitectura basada exclusivamente en RAG vectorial hacia una infraestructura GraphRAG presenta desafíos significativos de concurrencia y disponibilidad, especialmente dado que la plataforma Validus se encuentra activa procesando pagos y sesiones de validación a través del flujo de Validate.tsx. El plan maestro se estructura en tres Sprints de dos semanas cada uno, garantizando que el parche inmediato (Sprint 1) financie la estabilidad necesaria para ejecutar la reingeniería profunda de datos (Sprints 2 y 3).Roadmap de Ejecución por SprintsFase temporalSemanaObjetivo PrincipalTareas Críticas y Componentes AfectadosDependenciasSPRINT 1: Hotfix y ContenciónSem 1Erradicación inmediata de alucinaciones en el entorno de producción.- Modificación de las RPCs en Supabase mediante el editor SQL o una migración urgente.- Actualización de supabase/functions/ai-validate/index.ts para capturar arreglos vacíos.- Actualización en frontend para manejar la respuesta estructurada de fallo.Ninguna. Ejecución prioritaria y bloqueo de otros features.SPRINT 1: Hotfix y ContenciónSem 2Monitoreo de impacto y métricas de rechazo.- Monitoreo de logs en la tabla ai_interactions para identificar qué porcentaje de consultas están cayendo en la respuesta de fallback.- Ajuste fino del umbral de 0.70 a 0.80 según los resultados del mundo real.Despliegue de las tareas de la Semana 1.SPRINT 2: Ingesta "Headless"Sem 3Estandarización de la curación de conocimiento mediante Obsidian.- Creación del repositorio validateai-knowledge-vault.- Capacitación del equipo de operaciones en la sintaxis de Markdown y resolución de enlaces bidireccionales ].Disponibilidad del equipo de expertos de dominio.SPRINT 2: Ingesta "Headless"Sem 4Automatización del canal de integración continua (CI/CD).- Desarrollo del script sync_obsidian_ast.ts usando el ecosistema unified/remark.- Configuración de GitHub Actions.- Creación de Edge Function api-v1/routes/ingest para recibir el payload estructurado.Finalización de la Semana 3.SPRINT 3: GraphRAG y PostgresSem 5Evolución del esquema de base de datos relacional.- Desarrollo de la migración 019_graphrag.sql (tablas de nodos y aristas).- Backfill de datos desde la bóveda de Obsidian hacia el nuevo modelo relacional.- Generación masiva de embeddings de 1536 dimensiones para los nuevos nodos usando OpenAI.Éxito en la validación del parser AST de la Semana 4.SPRINT 3: GraphRAG y PostgresSem 6Implementación de las consultas CTE y RAG Híbrido.- Desarrollo de la función SQL de travesía de grafos y unión con similitud de cosenos.- Refactorización profunda de ai-validate/index.ts para invocar el motor híbrido en lugar del RAG vectorial estándar.- Pruebas de estrés y despliegue final.Migración 019_graphrag.sql operando exitosamente en el entorno de Staging.Matriz de Riesgos Arquitectónicos e InfraestructuralesLa introducción de lógica de grafos en una base de datos relacional y el parseo de Árboles de Sintaxis Abstracta (AST) introducen vectores de riesgo que deben mitigarse proactivamente.ID RiesgoDescripción del RiesgoProbabilidadImpacto (Severidad)Estrategia de Mitigación y Plan de ContingenciaRSK-01Degradación severa del servicio de validación: El incremento abrupto del match_threshold provocará que un volumen significativo de reportes carezcan de datos complementarios, frustrando a los usuarios de pago.AltaCríticoMitigación: Implementar un estado visual en el frontend (EmptyStateAI) que transforme la carencia de datos en una validación positiva de innovación ("Tu idea es tan pionera que carece de referencias históricas directas"). Contingencia: Reducir temporalmente el umbral a 0.65 si la tasa de finalización del wizard cae por debajo del 40%.RSK-02Sobrecarga computacional en PostgreSQL: Las consultas recursivas (CTEs) utilizadas para explorar las relaciones del grafo en la tabla knowledge_edges pueden generar bucles infinitos o cuellos de botella en la CPU de Supabase.MediaAltoMitigación: Limitar la profundidad de la consulta CTE a un máximo de 2 o 3 saltos (hops). Asegurar la creación de índices B-Tree en las columnas source_title y target_title. Contingencia: Utilizar un límite de tiempo de ejecución (statement_timeout) estricto en el bloque de la función SQL.RSK-03Fallos de resolución en el AST Parser: Errores tipográficos en los archivos Markdown de Obsidian (ej. nombres de enlaces que no coinciden exactamente con los títulos de los documentos) corromperán la integridad del grafo relacional.AltaMedioMitigación: El flujo de GitHub Actions debe incluir un paso de validación (linting) que verifique la integridad referencial de todos los ] antes de enviar el payload a Supabase. Si hay enlaces huérfanos, el pipeline falla y alerta al autor.RSK-04Agotamiento del límite de tokens (Token Exhaustion): La combinación de contextos recuperados a través del grafo y de la búsqueda vectorial podría exceder la ventana de contexto óptima o incrementar exponencialmente los costos de la API de Anthropic/OpenAI.BajaAltoMitigación: Configurar un match_count estricto y un truncamiento de caracteres a nivel de función SQL. Priorizar siempre el contexto del grafo y descartar el contexto vectorial si se excede el límite máximo de 4000 tokens especificado en los estándares técnicos del proyecto.Tech Lead: Diseño de Arquitectura, Viabilidad y Modelado de DatosEl salto desde una base de datos vectorial plana hacia un sistema GraphRAG alojado nativamente en PostgreSQL representa una ventaja competitiva fundamental. Las soluciones típicas exigen mantener ecosistemas fragmentados (ej. PostgreSQL para metadatos, Qdrant/Pinecone para vectores, y Neo4j para relaciones lógicas). La arquitectura propuesta para Validus consolida estas tres dimensiones en Supabase, utilizando pgvector para la similitud semántica y Common Table Expressions (CTEs) para la travesía de grafos, asegurando transacciones ACID (Atomicidad, Consistencia, Aislamiento, Durabilidad) atómicas sin lag de sincronización.1. Arquitectura de Sistemas y Flujo de IngestaEl flujo de procesamiento (Data Pipeline) se divide en dos fases asíncronas: Ingesta de Conocimiento (Backoffice) y Recuperación Híbrida (Runtime Frontend).A. Pipeline de Ingesta de Conocimiento (Obsidian → GitHub Actions → Supabase)
El equipo de dominio redacta documentos en una bóveda de Obsidian utilizando enlaces como [[Normativa CMF 461]]. Al fusionar cambios en el repositorio, GitHub Actions ejecuta un script en Node.js/TypeScript. Este script no realiza un particionado (chunking) basado en caracteres (que destruye el contexto), sino un Chunking Semántico basado en AST (Abstract Syntax Tree).
El script analiza el árbol Markdown, agrupa párrafos bajo sus respectivos encabezados y detecta nodos wikiLink para construir relaciones explícitas, enviando un payload estructurado a una nueva Supabase Edge Function (api-v1/routes/ingest).B. Pipeline de Recuperación Híbrida (Usuario → Edge Function → LLM)
Cuando el componente StepGenerating.tsx  llama a ai-validate, el sistema primero realiza una extracción de entidades (Entity Extraction) usando un modelo rápido y económico (ej. Claude Haiku). Las entidades extraídas se pasan a la función híbrida en Postgres, la cual:Navega el grafo usando CTEs buscando coincidencias directas.Simultáneamente ejecuta una búsqueda de similitud coseno (<=>) mediante pgvector.Dedúplica y concatena los resultados antes de ensamblar el System Prompt final para Claude Sonnet.2. Esquema de Base de Datos y Endpoints (Documentación Accionable)El siguiente código proporciona las migraciones SQL exactas y el código TypeScript necesarios para la implementación, diseñados para ser copiados directamente a la infraestructura de Validus.Archivo de Migración SQL: supabase/migrations/019_graphrag_schema.sql
Este esquema reemplaza las tablas vectoriales monolíticas por un modelo de grafo relacional, permitiendo consultas deterministas y búsqueda híbrida.SQL-- ============================================================
-- Validus — Migración 019: Arquitectura GraphRAG
-- Requisito previo: Migración 001 con pgvector activado
-- ============================================================

-- 1. TABLA DE NODOS (Fragmentos Semánticos)
CREATE TABLE IF NOT EXISTS public.knowledge_nodes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    document_title text NOT NULL,        -- Ej: 'Ley Fintec 2024'
    header_path text NOT NULL,           -- Jerarquía de encabezados, Ej: 'Requisitos > Capital'
    content text NOT NULL,               -- El bloque de texto semántico
    embedding vector(1536),              -- Representación vectorial de OpenAI text-embedding-3-small
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    -- Restricción para evitar duplicados en la ingesta
    CONSTRAINT unique_chunk_identity UNIQUE (document_title, header_path)
);

-- Índices para optimización de consultas y similitud vectorial
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_title ON public.knowledge_nodes(document_title);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_embedding 
ON public.knowledge_nodes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 2. TABLA DE ARISTAS (Relaciones direccionales)
CREATE TABLE IF NOT EXISTS public.knowledge_edges (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    source_title text NOT NULL,          -- Documento de origen
    target_title text NOT NULL,          -- Documento referenciado (WikiLink)
    relation_type text DEFAULT 'MENTIONS', -- Tipología de la relación
    created_at timestamptz DEFAULT now(),
    CONSTRAINT fk_source FOREIGN KEY (source_title) REFERENCES public.knowledge_nodes(document_title) ON DELETE CASCADE,
    CONSTRAINT unique_edge UNIQUE (source_title, target_title, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON public.knowledge_edges(source_title);
CREATE INDEX IF NOT EXISTS idx_edges_target ON public.knowledge_edges(target_title);

-- 3. FUNCIÓN RPC: Motor de Búsqueda Híbrida (Grafo + Vectorial)
-- Combina travesía de relaciones con búsqueda semántica 
CREATE OR REPLACE FUNCTION search_hybrid_graphrag(
    query_embedding vector(1536),
    extracted_entities text,           -- Array de nombres de entidades extraídas de la consulta
    match_threshold float DEFAULT 0.75,  -- Umbral estricto para mitigar alucinaciones
    match_count int DEFAULT 5
)
RETURNS TABLE (
    source_type text,                    -- Identificador visual: 'GRAPH' o 'VECTOR'
    document_title text,
    content text,
    relevance float
)
LANGUAGE sql STABLE
AS $$
    -- A. Travesía del Grafo: Encontrar nodos referenciados directamente por las entidades
    WITH graph_matches AS (
        SELECT DISTINCT 
            kn.document_title, 
            kn.content, 
            1.0 AS relevance -- Exactitud determinista
        FROM public.knowledge_nodes kn
        INNER JOIN public.knowledge_edges ke ON kn.document_title = ke.target_title
        WHERE ke.source_title = ANY(extracted_entities)
           OR kn.document_title = ANY(extracted_entities)
        LIMIT match_count
    ),
    -- B. Búsqueda Vectorial: Fallback para descubrir contexto semántico similar
    vector_matches AS (
        SELECT 
            document_title, 
            content, 
            1 - (embedding <=> query_embedding) AS relevance
        FROM public.knowledge_nodes
        WHERE 1 - (embedding <=> query_embedding) > match_threshold
          -- Excluir resultados ya encontrados por el grafo para evitar duplicación de tokens
          AND document_title NOT IN (SELECT document_title FROM graph_matches)
        ORDER BY embedding <=> query_embedding
        LIMIT match_count
    )
    -- C. Fusión y priorización de resultados
    SELECT 'GRAPH' AS source_type, document_title, content, relevance FROM graph_matches
    UNION ALL
    SELECT 'VECTOR' AS source_type, document_title, content, relevance FROM vector_matches
    ORDER BY relevance DESC
    LIMIT match_count;
$$;
Refactorización Edge Function: supabase/functions/ai-validate/index.ts
Se debe modificar la orquestación actual para integrar el procesamiento híbrido y el fallo elegante, garantizando que el modelo no intente generar información sin un respaldo fundamentado.TypeScriptimport { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Configuración CORS estándar de Validus
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { validation_id, step, prompt_type, context, query_embedding, extracted_entities } = await req.json();

    // 1. Invocación del Motor Híbrido GraphRAG
    const { data: chunks, error: rpcError } = await supabase.rpc('search_hybrid_graphrag', {
      query_embedding: query_embedding,
      extracted_entities: extracted_entities ||,
      match_threshold: 0.75, // Ajuste estricto requerido en el Sprint 1
      match_count: 5
    });

    if (rpcError) throw rpcError;

    // 2. Lógica de Fallo Elegante (Graceful Degradation)
    let ragContext = "";
    if (!chunks || chunks.length === 0) {
      ragContext = "INSTRUCCIÓN CRÍTICA DE SISTEMA: No se ha recuperado ninguna fuente verificada de la base de datos de grafos ni del espacio vectorial. BAJO NINGUNA CIRCUNSTANCIA debes intentar predecir, inferir o generar una respuesta relacionada a normativas, leyes, datos financieros o competidores. Debes responder textualmente con la siguiente cadena exacta: 'FALLO_ELEGANTE_SIN_DATOS: No tengo información en mis fuentes sobre este punto.' Detén tu generación inmediatamente después de esa frase.";
    } else {
      // Ensamblaje del contexto rico, priorizando nodos del grafo
      ragContext = chunks.map((c: any) => 
        ` ${c.content}`
      ).join("\n\n");
    }

    // 3. Llamada final al modelo de Anthropic (simulada)
    // El prompt final se construye concatenando el ragContext con las instrucciones base
    const finalPrompt = `Contexto Recuperado:\n${ragContext}\n\nConsulta del Usuario: ${JSON.stringify(context)}`;
    
    // (Ejecución de fetch hacia api.anthropic.com u OpenAI según AI_PROVIDER)
    
    return new Response(JSON.stringify({ success: true, prompt_used: finalPrompt }), {
      headers: {...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
Script AST de Ingesta (CI/CD con Node.js):
El procesamiento del árbol de sintaxis abstracta (AST) asegura un particionado semántico preciso, evitando cortar oraciones por la mitad o perder las dependencias referenciales de Obsidian.TypeScript// scripts/sync_obsidian_ast.ts (Ejecutado vía GitHub Actions)
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import wikiLinkPlugin from 'remark-wiki-link'; // Analizador fundamental para]
import { visit } from 'unist-util-visit';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function processMarkdownFile(filePath: string, documentTitle: string) {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Configuración del procesador AST con soporte para WikiLinks
    const processor = unified().use(remarkParse).use(wikiLinkPlugin, { aliasDivider: '|' });
    const ast = processor.parse(content);

    const nodes: any =;
    const edges: any =;
    let currentHeaderPath = 'Raíz';

    // Travesía del árbol de sintaxis abstracta
    visit(ast, (node: any) => {
        // 1. Detección de Jerarquías de Encabezados
        if (node.type === 'heading') {
            const headerText = node.children.map((c: any) => c.value).join('');
            currentHeaderPath = headerText;
        }
        
        // 2. Fragmentación Semántica y Empaquetado
        if (node.type === 'paragraph' || node.type === 'list') {
            // (Lógica simplificada de extracción de texto para el AST)
            const textContent = node.children? node.children.map((c: any) => c.value || '').join('') : '';
            if (textContent.trim().length > 10) {
                nodes.push({
                    document_title: documentTitle,
                    header_path: currentHeaderPath,
                    content: textContent
                });
            }
        }

        // 3. Extracción de Aristas (Grafo Relacional)
        if (node.type === 'wikiLink') {
            edges.push({
                source_title: documentTitle,
                target_title: node.value, // El nombre del archivo enlazado
                relation_type: 'MENTIONS'
            });
        }
    });

    return { nodes, edges };
}
// El payload resultante se envía mediante HTTP POST al endpoint /ingest
UX/UI Designer: Experiencia de Usuario e Integración de InterfazLa adopción de umbrales semánticos más altos implica que un porcentaje de las validaciones de los emprendedores retornarán con la directiva de fallo estructurado ("No tengo información..."). En el contexto de un software SaaS de pago, presentar un campo en blanco, un error de sistema genérico o una confesión textual de ignorancia por parte de la IA degrada la percepción de valor. La interfaz de usuario debe anticipar esta respuesta de la Edge Function en componentes como StepGenerating.tsx  y los visualizadores de resultados en ValidationDetail.tsx.Flujo Principal de Experiencia y Resiliencia (Graceful Degradation)Cuando el Zustand store (src/stores/validationStore.ts ) recibe el estado mitigado desde el backend, la lógica de presentación se actualiza en lugar de mostrar un error 500.Componentes Críticos e Implementación de Interfaz:Ruta / ComponenteAcción de UsuarioLógica de Renderizado y ModificaciónComportamiento en Escenario de Fallo (Umbral 0.75 no superado)src/app/routes/ValidationDetail.tsx El usuario revisa la validación de una normativa legal o análisis de mercado chileno.La respuesta estructurada del JSON contiene el flag visual del fallo elegante detectado en el string.Reemplazo condicional: Renderización del nuevo componente EmptyStateAI.tsx en la pestaña de RegulatoryRoadmap.tsx o CorfoFunds.tsx.src/components/shared/EmptyStateAI.tsx (NUEVO)Visualización pasiva de una categoría de validación sin datos.Utiliza íconos de la librería lucide-react (ej. Compass o Telescope)  con colores semánticos tenues (escala de grises o ámbar bg-amber-50 ).Muestra un texto persuasivo orientado al valor: "Validación Pionera: Tu idea opera en un espacio de mercado tan emergente que requiere exploración manual profunda. Las bases de datos estandarizadas aún no reflejan este nicho. Te recomendamos proceder con entrevistas cualitativas directas."src/app/routes/Admin.tsx El Product Owner o Administrador revisa el desempeño del motor.Incorporación de una nueva pestaña de navegación 'knowledge_graph'. Utiliza métricas de la librería recharts  para reportes.Se muestran métricas vitales: Total de Nodos (Documentos), Total de Aristas (Conexiones), Nodos Huérfanos, y Tasa de respuestas bloqueadas por el umbral del 0.75, permitiendo priorizar qué documentación agregar en Obsidian.src/components/wizard/StepGenerating.tsx El usuario espera la resolución de las tareas asíncronas de la IA.La matriz de estados (pending, loading, success, error) maneja las respuestas parciales.Si la Edge Function devuelve un código de éxito 200 pero un contenido vacío, la tarea se marca como success visualmente (check verde), asegurando que el flujo de redirección no se bloquee ni cause fricción.QA Engineer: Estrategia de Calidad, Validación y Casos de PruebaValidar el comportamiento de un sistema probabilístico (LLMs y bases de datos vectoriales) frente a uno determinista (grafos CTE en SQL) requiere un marco de pruebas híbrido que contemple Boundary Value Analysis (Análisis de Valores Límite) para la coincidencia de vectores y pruebas de grafos cíclicos.Checklist de Validación (Definition of Done - DoD)[ ] Se han modificado las llamadas de los RPC en las Edge Functions y superan las validaciones locales.[ ] El script sync_obsidian_ast.ts maneja correctamente caracteres especiales, espacios y capitalización irregular en los enlaces ].[ ] Las migraciones SQL (019_graphrag_schema.sql) se han probado de forma no destructiva en una base de datos secundaria para garantizar que no haya bloqueos en las tablas existentes validations o profiles.[ ] Las consultas recursivas CTE han sido indexadas correctamente y se ha demostrado que no causan timeouts (ejecución menor a 500ms bajo carga simulada).[ ] El System Prompt no es susceptible de ataques de inyección orientados a eludir la restricción del fallo elegante.Casos de Prueba CríticosLa siguiente tabla resume los vectores de prueba de automatización y regresión diseñados para el framework actual (Playwright/k6).IDTipo de PruebaComponenteEscenario (BDD)Resultado EsperadoTC-01Negative Testingai-validate Edge FunctionDado una consulta completamente ficticia (ej. "Normativa de naves espaciales del SII"),Cuando se ejecuta la extracción y búsqueda vectorial con umbral 0.75,Entonces el motor de búsqueda de Supabase no debe retornar ningún chunk.La API responde con el código 200 y el campo prompt_used contiene estrictamente el string "FALLO_ELEGANTE_SIN_DATOS" sin ninguna respuesta formativa extra.TC-02Boundary ValueRPC search_hybrid_graphragDado un vector con distancia coseno exacta de 0.749 respecto a la consulta,Cuando se ejecuta la consulta a la base de datos SQL,Entonces el nodo vectorial debe ser descartado del conjunto de resultados final.La tabla retornada por el RPC tiene longitud 0 (asumiendo que no existen coincidencias de aristas en el grafo).TC-03Integration (AST Parser)sync_obsidian_ast.tsDado un archivo Markdown de Obsidian con un bucle de enlaces infinitos (Doc A -> Doc B -> Doc A),Cuando el pipeline de GitHub Actions procesa el árbol de sintaxis,Entonces el script no debe colapsar por un desbordamiento de pila.Las aristas se registran en knowledge_edges como direcciones unidireccionales únicas e independientes; el upsert a Supabase se completa en un tiempo determinista.TC-04Graph RetrievalRPC search_hybrid_graphragDado que la entidad documentada "Capital Semilla" tiene un WikiLink a "CORFO",Cuando el usuario consulta sobre requerimientos de financiamiento y la IA extrae "Capital Semilla",Entonces la CTE recursiva debe recuperar inmediatamente el nodo de "CORFO".El resultado de la función SQL debe incluir el nodo "CORFO" marcado con source_type = 'GRAPH' y un valor de relevancia absoluta de 1.0.TC-05E2E UI ResilienceValidationDetail.tsxDado que el store de Zustand recibe un JSON parcial con la cadena de fallo,Cuando el usuario visualiza la pestaña de Análisis Regulatorio,Entonces la pantalla no debe romperse ni renderizar texto sin formato.Se renderiza exitosamente el componente EmptyStateAI manteniendo la paleta y los estilos del design system actual de Tailwind v4 y shadcn/ui.3. Recomendación Final del EquipoEl ecosistema competitivo de herramientas globales de validación (como DimeADozen o FounderPal) sufre inherentemente del problema del "Flatland": sus sistemas de Retrieval-Augmented Generation recuperan bloques de texto basados puramente en su proximidad matemática de vocabulario, pero carecen de una comprensión fundamental de las relaciones de causalidad, dependencias legales e interacciones de la estructura de mercado.Al realizar la transición de Validus hacia un modelo de base de datos impulsado por grafos —aprovechando los cimientos existentes de PostgreSQL mediante expresiones de tabla comunes recursivas y curación basada en el flujo AST de Obsidian— el sistema transformará los datos de un formato probabilístico a un repositorio rígidamente estructurado y determinista. Esta capacidad de conectar explícitamente entidades, sin abandonar la versatilidad semántica del respaldo de la extensión pgvector , construirá la base para el Foso Defensivo (Moat) operativo de la Fase 6.Siguiente Paso Crítico para Iniciar la Ejecución:
La ejecución del Sprint 1 (Hotfix Inmediato) tiene prioridad absoluta sobre cualquier otro desarrollo en curso. El Tech Lead y el Database Administrator deben generar e implementar inmediatamente el script de anulación de la RPC en la base de datos de producción (match_threshold = 0.75), procediendo en paralelo con la actualización del System Prompt en la Edge Function ai-validate/index.ts. A su vez, el equipo de contenidos y marco regulatorio debe comenzar de inmediato a migrar y vincular normativas utilizando la sintaxis de WikiLinks ([[ ]]) en directorios de pruebas locales, preparando así el terreno analítico para el despliegue del pipeline CI/CD planificado para el Sprint 2.