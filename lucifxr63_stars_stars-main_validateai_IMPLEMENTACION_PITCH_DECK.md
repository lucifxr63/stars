# Feature Blueprint: Generador de Pitch Deck en ValidateAI

**Contexto:** El usuario ha decidido que el **Pitch Deck** es el documento prioritario para generar dentro del ecosistema de `validateai/`. Este documento define la arquitectura para implementar un nuevo componente React-PDF que tome los datos de la idea validada y genere la estructura del Pitch Deck.

## 1. Nuevo Componente: `src/components/pdf/PitchDeckOutline.tsx`
Actualmente ValidateAI cuenta con `InvestmentDossier.tsx`. Debemos crear un componente hermano enfocado exclusivamente en la estructura visual de un Pitch Deck para levantar capital Pre-Seed/Seed.

### Estructura de Props
El componente debe recibir la misma `PDFData` pero mapear las respuestas de la IA a las 10 diapositivas estándar de Silicon Valley/Antler:

1. **Title & Hook:** Nombre de la startup (`idea.name`) + Elevator Pitch (generado por el LLM).
2. **The Problem:** El dolor validado (`marketAnalysis.painPoints`).
3. **The Solution:** Descripción de cómo la IA o el MVP resuelve el dolor.
4. **Market Size:** TAM, SAM, SOM (Extraído de `marketAnalysis.tamSamSom`).
5. **Business Model:** Unit Economics (`financials.revenueModel`, `financials.cac`, `financials.ltv`).
6. **Unfair Advantage:** Integración de barreras (Ej. Cumplimiento Ley Fintec).
7. **Traction/Roadmap:** Hitos (LOIs, Design Partners).
8. **The Ask:** Necesidades de capital según el `scoreBreakdown.execution`.

## 2. Integración en `src/app/routes/Results.tsx`
Agregar una nueva pestaña en el componente `<DeliverableTabs>` para descargar el Pitch Deck:

```tsx
<TabsContent value="pitch">
  <div className="flex justify-between items-center mb-4">
    <h3 className="text-lg font-semibold">Investor Pitch Deck (Outline)</h3>
    <ExportPDF data={pdfData} type="pitch_deck" />
  </div>
  <PitchDeckPreview data={validationData} />
</TabsContent>
```

## 3. Lógica del LLM (Prompt Update)
En `supabase/functions/ai-validate/index.ts`, debemos asegurarnos de que la respuesta JSON del asistente incluya un bloque específico para el "Pitch":

```typescript
"pitch_deck_content": {
  "hook": "Liquidez instantánea para PYMEs B2B sin burocracia.",
  "problem_statement": "Los corporativos pagan a 90 días, ahorcando a las PYMEs.",
  "solution_statement": "Evaluación tributaria con IA y transferencia en 10 mins.",
  "unfair_advantage": "Motor de IA conectado al SII."
}
```

## Próximos Pasos (Sprint para Claude Code)
1. Ejecutar la creación del archivo `PitchDeckOutline.tsx`.
2. Modificar el schema de Zod en `src/types/validation.ts` para aceptar los nuevos campos del Pitch Deck.
3. Actualizar la función Edge de Supabase para generar el contenido narrativo de las slides.
