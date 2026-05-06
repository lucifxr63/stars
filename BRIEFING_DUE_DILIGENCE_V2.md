# MEMORÁNDUM ESTRATÉGICO: INICIATIVA "DUE DILIGENCE" AUTOMATIZADO
**De:** Mesa Directiva
**Para:** Equipo de Producto y Desarrollo (Previo a ejecución con Claude Code)
**Fecha:** 6 de Mayo, 2026
**Estado:** APROBADO PARA DESARROLLO INMEDIATO

---

## 1. VISIÓN Y CONTEXTO DEL PIVOTE (EL "POR QUÉ")
Hasta hoy, **ValidateAI** ha sido una herramienta excepcional para validar *ideas* en etapa cero. Sin embargo, el Directorio ha aprobado una expansión masiva de nuestro Mercado Total Dirigible (TAM). 

Vamos a evolucionar el flujo Premium para permitir la carga de **PDFs (Pitch Decks, Business Plans) y JSONs**. Esto transforma nuestra plataforma de un simple "validador de ideas" a un **Auditor de Due Diligence** automatizado para startups operativas que preparan rondas de inversión (Pre-Seed / Seed / Serie A).

**Objetivos de Negocio:**
* **Reducir Fricción de Entrada:** Reemplazar los formularios largos por "Drag & Drop" de documentos que los founders ya tienen.
* **Aumentar el Ticket Promedio:** Justificar un modelo "Premium Pro" o "Enterprise" al auditar métricas reales de tracción financiera y cumplimiento legal chileno/LATAM.

---

## 2. ARQUITECTURA DE LA NUEVA EXPERIENCIA (EL "QUÉ")
El equipo debe instruir a Claude Code para construir este flujo en tres fases estrictas. La experiencia del usuario debe sentirse como una auditoría de un fondo de Venture Capital de primer nivel.

### FASE 1: Ingesta y Extracción Silenciosa
* **Componente:** Crear `StepUpload.tsx` permitiendo arrastrar archivos (`.pdf`, `.json`).
* **Backend:** Implementar una Edge Function (`parse-project`) que utilice modelos multimodales (GPT-4o o Claude 3.5 Sonnet) para extraer texto/imágenes.
* **Misión de la IA:** Rellenar automáticamente nuestro `validationStore.ts`.
* **UX:** Mientras esto ocurre, mostrar *Task Cards* dinámicas ("Extrayendo modelo de ingresos...", "Mapeando estructura societaria...").

### FASE 2: Motor de "Gap Analysis" (Detección de Vacíos)
La plataforma no debe pedir lo que ya sabe. Debe comparar los datos extraídos contra nuestro marco de validación estricto:
* *Mom Test:* ¿Hay evidencia de pago real o solo promesas?
* *Unit Economics:* ¿Están definidos el LTV, CAC y Payback Period?
* *Legal Chile:* ¿Se menciona el cumplimiento de la Ley 21.719 (Datos) o la Ley Fintech 21.521?
* **Resultado:** Generar una cola de preguntas pendientes (`pendingQuestions`).

###