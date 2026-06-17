// Builders de contexto de prompt + extractJSON, extraídos de ai-validate (#5 W1).
// Funciones puras (byte-identical, verificado por golden hash).
import type { PromptType } from './prompts.ts';

export function buildMarketContext(ctx: Record<string, unknown>): string {
  return `Contexto de mercado:
- País objetivo: ${ctx.target_country ?? 'No especificado'}
- Región: ${ctx.target_region ?? 'No especificada'}
- Modelo de negocio: ${ctx.business_model ?? 'No especificado'}
- Etapa: ${ctx.business_stage ?? 'No especificada'}
- Rango de precio: ${ctx.pricing_range ?? 'No especificado'}
- Competidores conocidos por el usuario: ${
    Array.isArray(ctx.known_competitors) && ctx.known_competitors.length
      ? (ctx.known_competitors as string[]).join(', ')
      : 'Ninguno'
  }
- PROBLEMA DECLARADO (usar como fuente primaria para evaluar dimensión problem): ${ctx.idea_problem ?? 'No especificado'}
- SOLUCIÓN ACTUAL DE INCUMBENTES (herramientas/métodos que usa el cliente hoy): ${ctx.current_solution ?? 'No especificado'}
- Canal de adquisición principal: ${ctx.acquisition_channel ?? 'No especificado'}
- Composición del equipo fundador: ${ctx.team_composition ?? 'No especificado'}
- Estado de tracción actual: ${ctx.traction_status ?? 'No especificado'}
- Dedicación del founder al proyecto: ${(ctx.founder_context as Record<string,unknown>)?.commitment_level ?? 'No especificado'}
- Entrevistas con clientes realizadas: ${(ctx.founder_context as Record<string,unknown>)?.customer_interviews ?? 'No especificado'}
- Ventaja diferencial del founder (unfair advantage): ${(ctx.founder_context as Record<string,unknown>)?.unfair_advantage ?? 'No especificado'}`;
}

// Bloque dedicado para founder_fit (modelo HÍBRIDO). Surface explícito de dos
// fuentes complementarias:
//  1) PERFIL DEL FUNDADOR (nivel usuario, founder_profiles): identidad persistente
//     del fundador — experiencia, red, track record. Vía LinkedIn o carga manual.
//     Es la ÚNICA señal disponible en el flujo premium (sin Paso Fundador).
//  2) DATOS DE ESTA IDEA (wizard, solo flujo detallado): equipo, tracción y
//     problem-fit específicos de la startup que se está validando.
export function buildFounderContext(ctx: Record<string, unknown>): string {
  const fc = (ctx.founder_context ?? {}) as Record<string, unknown>;
  const pick = (...vals: unknown[]) =>
    vals.find((v) => v !== undefined && v !== null && v !== '') ?? 'No especificado';

  const hasProfile =
    ctx.founder_linkedin_url || ctx.founder_full_name || ctx.founder_competency_scores ||
    ctx.founder_industry_years;
  const hasWizard =
    fc.personallyFacedProblem !== undefined || fc.yearsInIndustry !== undefined ||
    ctx.team_composition || ctx.traction_status;

  const lines: string[] = [];

  // ── Fuente 1: perfil del fundador a nivel usuario ──────────────────────────
  if (hasProfile) {
    const src = ctx.founder_linkedin_url ? 'LinkedIn verificado' : 'carga manual';
    lines.push(
      `PERFIL DEL FUNDADOR (nivel usuario — fuente: ${src}; identidad estable, válida para CUALQUIER idea):`,
      `- Nombre: ${ctx.founder_full_name ?? 'No disponible'}`,
      `- Headline: ${ctx.founder_headline ?? 'No disponible'}`,
      `- Bio: ${ctx.founder_summary_bio ?? 'No disponible'}`,
      `- Años en la industria: ${ctx.founder_industry_years ?? 'No disponible'}`,
    );
    if (Array.isArray(ctx.founder_skills) && ctx.founder_skills.length) {
      lines.push(`- Skills: ${(ctx.founder_skills as string[]).join(', ')}`);
    }
    if (Array.isArray(ctx.founder_work_experience) && ctx.founder_work_experience.length) {
      lines.push(`- Experiencia laboral: ${JSON.stringify(ctx.founder_work_experience)}`);
    }
    if (ctx.founder_competency_scores) {
      lines.push(
        `- Competency scores pre-calculados (0-100): ${JSON.stringify(ctx.founder_competency_scores)}.`,
        '  Úsalos como ancla: visionComercial≈networkStrength, capacidadTecnica≈technicalCapability,',
        '  liderazgo+resilienciaOperativa≈trackRecord, experienciaIndustria≈industryExperience.',
      );
    }
    lines.push('');
  }

  // ── Fuente 2: datos específicos de esta idea (wizard) ──────────────────────
  lines.push('DATOS DE ESTA IDEA (autoreporte del wizard — específicos de la startup validada):');
  lines.push(
    `- ¿Vivió el problema en carne propia? (personallyFacedProblem): ${pick(fc.personallyFacedProblem, ctx.personallyFacedProblem)}`,
    `- Años de experiencia en la industria (yearsInIndustry): ${pick(fc.yearsInIndustry, ctx.yearsInIndustry)}`,
    `- Composición del equipo (team_composition): ${pick(ctx.team_composition, fc.team_composition)}`,
    `- Nivel técnico del equipo (tech_level): ${pick(ctx.tech_level, fc.tech_level)}`,
    `- Estado de tracción (traction_status): ${pick(ctx.traction_status, fc.traction_status)}`,
    `- Dedicación al proyecto (commitment_level): ${pick(fc.commitment_level, ctx.commitment_level)}`,
    `- Entrevistas con clientes (customer_interviews): ${pick(fc.customer_interviews, ctx.customer_interviews)}`,
    `- Ventaja diferencial (unfair_advantage): ${pick(fc.unfair_advantage, ctx.unfair_advantage)}`,
  );

  // ── Guía de fusión híbrida ─────────────────────────────────────────────────
  lines.push('');
  if (hasProfile && hasWizard) {
    lines.push(
      'FUSIÓN: combina ambas fuentes. El PERFIL define la identidad del fundador (industryExperience,',
      'networkStrength, technicalCapability, trackRecord de carrera); los DATOS DE ESTA IDEA ajustan',
      'problemKnowledge, technicalCapability del equipo y trackRecord de tracción de esta startup.',
    );
  } else if (hasProfile && !hasWizard) {
    lines.push(
      'FUSIÓN: NO hay datos del wizard (flujo premium). Evalúa con el PERFIL del fundador como fuente',
      'principal — usa los competency scores y la experiencia laboral para estimar las 5 dimensiones.',
    );
  } else {
    lines.push(
      'FUSIÓN: NO hay perfil de fundador a nivel usuario. Evalúa solo con los DATOS DE ESTA IDEA del wizard.',
    );
  }

  return lines.join('\n');
}

// Construye el contenido del mensaje de usuario. Para founder_fit antepone el
// bloque explícito de fundador; el resto de prompts mantienen el comportamiento previo.
export function buildUserContent(promptType: PromptType, context: Record<string, unknown>): string {
  const base = `${buildMarketContext(context)}\n\n${JSON.stringify(context)}`;
  return promptType === 'founder_fit'
    ? `${buildFounderContext(context)}\n\n${base}`
    : base;
}

export function extractJSON(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return trimmed;
  const jsonBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlock) return jsonBlock[1].trim();
  const start = trimmed.search(/[{[]/);
  const end = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'));
  if (start !== -1 && end !== -1) return trimmed.slice(start, end + 1);
  return trimmed;
}
