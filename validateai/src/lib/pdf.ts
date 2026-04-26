import type { MarketSizing, CompetitiveAnalysis, ScoreBreakdown, RiskAnalysis, UnitEconomics, FounderFit, MarketSignals } from '@/types/validation';

// ── Public API ────────────────────────────────────────────────────────────────
export interface PDFData {
  idea_name?: string;
  idea_description?: string;
  idea_industry?: string;
  target_country?: string;
  target_region?: string;
  business_model?: string;
  business_stage?: string;
  pricing_range?: string;
  known_competitors?: string[];
  questions_answers?: { question: string; answer: string; ai_followup?: string }[];
  customer_segment?: string;
  customer_pain_points?: string[];
  customer_context?: string;
  value_proposition?: string;
  differentiator?: string;
  mvp_type?: string;
  mvp_features?: { name: string; description: string; priority: string }[];
  mvp_user_flow?: string;
  summary?: Record<string, unknown>;
  market_sizing?: MarketSizing | null;
  competitive_analysis?: CompetitiveAnalysis | null;
  score_breakdown?: ScoreBreakdown | null;
  risk_analysis?: RiskAnalysis | null;
  unit_economics?: UnitEconomics | null;
  founder_fit?: FounderFit | null;
  market_signals?: MarketSignals | null;
  from_cache?: boolean;
}

export type PDFTheme = 'dark' | 'clean' | 'gradient';

export const PDF_THEMES: { id: PDFTheme; label: string; desc: string }[] = [
  { id: 'dark',     label: 'Dark Executive',   desc: 'Oscuro y premium. Ideal para inversores.' },
  { id: 'clean',    label: 'Clean SaaS',        desc: 'Blanco minimalista. Estilo Notion/Linear.' },
  { id: 'gradient', label: 'Gradient Startup',  desc: 'Colores vivos. Estilo Figma/Loom.' },
];

// ── Layout constants ───────────────────────────────────────────────────────────
const PAGE_W = 210;
const MARGIN  = 16;
const CON_W   = PAGE_W - MARGIN * 2;

// ── Base colours (shared) ─────────────────────────────────────────────────────
const C = {
  teal:       [13,  148, 136] as [number,number,number],
  tealDark:   [15,  118, 110] as [number,number,number],
  tealLight:  [204, 251, 241] as [number,number,number],
  dark:       [17,  24,  39]  as [number,number,number],
  slate:      [30,  41,  59]  as [number,number,number],
  gray:       [107, 114, 128] as [number,number,number],
  lightGray:  [229, 231, 235] as [number,number,number],
  midGray:    [71,  85,  105] as [number,number,number],
  white:      [255, 255, 255] as [number,number,number],
  green:      [16,  185, 129] as [number,number,number],
  greenLight: [209, 250, 229] as [number,number,number],
  greenDark:  [6,   95,  70]  as [number,number,number],
  amber:      [245, 158, 11]  as [number,number,number],
  amberLight: [254, 243, 199] as [number,number,number],
  amberDark:  [146, 64,  14]  as [number,number,number],
  red:        [239, 68,  68]  as [number,number,number],
  blue:       [59,  130, 246] as [number,number,number],
  blueLight:  [219, 234, 254] as [number,number,number],
  blueDark:   [30,  64,  175] as [number,number,number],
  indigo:     [99,  102, 241] as [number,number,number],
  purple:     [109, 40,  217] as [number,number,number],
  purpleLight:[245, 243, 255] as [number,number,number],
  purpleDark: [88,  28,  135] as [number,number,number],
  // Dark theme extras
  darkBg:     [15,  23,  42]  as [number,number,number],
  darkCard:   [30,  41,  59]  as [number,number,number],
  darkBorder: [51,  65,  85]  as [number,number,number],
  darkMid:    [148, 163, 184] as [number,number,number],
  // Gradient theme extras
  navy:       [15,  45,  74]  as [number,number,number],
  violet:     [139, 92,  246] as [number,number,number],
};

// ─────────────────────────────────────────────────────────────────────────────
//  Theme token resolver
// ─────────────────────────────────────────────────────────────────────────────
function getThemeTokens(theme: PDFTheme) {
  switch (theme) {
    case 'dark':
      return {
        coverBg:         C.darkBg,
        coverFg:         C.white,
        coverAccent:     C.teal,
        coverSubFg:      C.darkMid,
        sectionBg:       C.darkCard,
        sectionFg:       C.teal,
        sectionBorder:   C.darkBorder,
        bodyBg:          C.white,
        bodyFg:          C.dark,
        bodyMid:         C.midGray,
        cardBg:          [248, 250, 252] as [number,number,number],
        cardBorder:      C.lightGray,
        accent:          C.teal,
        accentAlt:       C.indigo,
        footerBg:        C.darkCard,
        footerFg:        C.darkMid,
        scoreBarColor:   C.teal,
        dividerColor:    C.darkBorder,
        sectionStyle:    'dark' as const,
      };
    case 'gradient':
      return {
        coverBg:         C.teal,
        coverBg2:        C.navy,
        coverFg:         C.white,
        coverAccent:     C.white,
        coverSubFg:      [204, 251, 241] as [number,number,number],
        sectionBg:       C.teal,
        sectionFg:       C.white,
        sectionBorder:   C.lightGray,
        bodyBg:          C.white,
        bodyFg:          C.dark,
        bodyMid:         C.midGray,
        cardBg:          [248, 250, 252] as [number,number,number],
        cardBorder:      C.lightGray,
        accent:          C.teal,
        accentAlt:       C.violet,
        footerBg:        [15, 45, 74] as [number,number,number],
        footerFg:        C.darkMid,
        scoreBarColor:   C.teal,
        dividerColor:    C.lightGray,
        sectionStyle:    'gradient' as const,
      };
    default: // clean
      return {
        coverBg:         C.white,
        coverFg:         C.dark,
        coverAccent:     C.teal,
        coverSubFg:      C.gray,
        sectionBg:       C.white,
        sectionFg:       C.dark,
        sectionBorder:   C.lightGray,
        bodyBg:          C.white,
        bodyFg:          C.dark,
        bodyMid:         C.midGray,
        cardBg:          [248, 250, 252] as [number,number,number],
        cardBorder:      [226, 232, 240] as [number,number,number],
        accent:          C.teal,
        accentAlt:       C.blue,
        footerBg:        C.white,
        footerFg:        C.gray,
        scoreBarColor:   C.teal,
        dividerColor:    C.lightGray,
        sectionStyle:    'clean' as const,
      };
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
export async function generateValidationPDF(data: PDFData, theme: PDFTheme = 'clean'): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = MARGIN;
  const T = getThemeTokens(theme);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const checkPage = (needed = 16) => {
    if (y + needed > 276) { doc.addPage(); y = MARGIN; }
  };

  const wrapText = (
    text: string,
    x: number,
    maxW = CON_W,
    size = 9.5,
    color: [number,number,number] = T.bodyMid,
    bold = false,
  ): number => {
    if (!text) return 0;
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, maxW);
    checkPage(lines.length * 5 + 2);
    doc.text(lines, x, y);
    return lines.length;
  };

  const chip = (
    label: string,
    x: number,
    cy: number,
    bg: [number,number,number],
    fg: [number,number,number],
  ): number => {
    const tw = doc.getTextWidth(label);
    const w  = tw + 6;
    doc.setFillColor(...bg);
    doc.roundedRect(x, cy, w, 5.5, 1.5, 1.5, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...fg);
    doc.text(label, x + 3, cy + 4);
    return w + 2;
  };

  const progressBar = (
    val: number,
    x: number,
    by: number,
    w: number,
    color: [number,number,number],
    trackColor: [number,number,number] = C.lightGray,
  ) => {
    const fill = Math.max(Math.round((val / 100) * w), 2);
    doc.setFillColor(...trackColor);
    doc.roundedRect(x, by, w, 3.5, 1, 1, 'F');
    doc.setFillColor(...color);
    doc.roundedRect(x, by, fill, 3.5, 1, 1, 'F');
  };

  const divider = (extraY = 0) => {
    y += extraY;
    doc.setDrawColor(...T.dividerColor);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 4;
  };

  const drawRadarChart = (
    cx: number, cy: number, r: number,
    data: { label: string, value: number, color: [number,number,number] }[],
    fillHex: [number,number,number]
  ) => {
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    for (let loop = 1; loop <= 4; loop++) {
       const pr = r * (loop / 4);
       for (let i = 0; i < 5; i++) {
         const a1 = (Math.PI * 2 * i) / 5 - Math.PI / 2;
         const a2 = (Math.PI * 2 * ((i + 1) % 5)) / 5 - Math.PI / 2;
         doc.line(cx + pr * Math.cos(a1), cy + pr * Math.sin(a1), cx + pr * Math.cos(a2), cy + pr * Math.sin(a2));
       }
    }
    for (let i = 0; i < 5; i++) {
       const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
       doc.line(cx, cy, cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    }

    const dPts = data.map((d, i) => {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const val = d.value / 100;
      return { x: cx + (r * val) * Math.cos(angle), y: cy + (r * val) * Math.sin(angle) };
    });

    const mix = (c: number) => Math.round(255 * 0.82 + c * 0.18);
    doc.setFillColor(mix(fillHex[0]), mix(fillHex[1]), mix(fillHex[2]));
    for (let i = 0; i < 5; i++) {
       const p1 = dPts[i];
       const p2 = dPts[(i + 1) % 5];
       doc.triangle(cx, cy, p1.x, p1.y, p2.x, p2.y, 'F');
    }

    doc.setDrawColor(...fillHex);
    doc.setLineWidth(0.8);
    for (let i = 0; i < 5; i++) {
       const p1 = dPts[i];
       const p2 = dPts[(i + 1) % 5];
       doc.line(p1.x, p1.y, p2.x, p2.y);
    }

    for (let i = 0; i < 5; i++) {
       const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
       const lx = cx + (r + 4) * Math.cos(angle);
       const ly = cy + (r + 4) * Math.sin(angle);
       
       let align = 'center';
       if (Math.abs(Math.cos(angle)) > 0.1) {
         align = Math.cos(angle) > 0 ? 'left' : 'right';
       }
       
       doc.setFontSize(6.5);
       doc.setFont('helvetica', 'normal');
       doc.setTextColor(...T.bodyMid);
       
       const text = data[i].label;
       const tw = doc.getTextWidth(text);
       let fx = lx;
       if (align === 'center') fx -= tw / 2;
       if (align === 'right') fx -= tw;
       
       doc.text(text, fx, ly + (Math.sin(angle) > 0 ? 3 : -1));
       
       const vStr = String(data[i].value);
       const tw2 = doc.getTextWidth(vStr);
       let fx2 = lx;
       if (align === 'center') fx2 -= tw2 / 2;
       if (align === 'right') fx2 -= tw2;
       doc.setFontSize(7.5);
       doc.setFont('helvetica', 'bold');
       doc.setTextColor(...data[i].color);
       doc.text(vStr, fx2, ly + (Math.sin(angle) > 0 ? 6.5 : 2.5));
    }
  };

  // ── Section header — style varies by theme ────────────────────────────────
  const sectionHeader = (title: string, colorOverride?: [number,number,number]) => {
    checkPage(14);

    if (T.sectionStyle === 'clean') {
      // Borde izquierdo teal + título gris oscuro
      const accent = colorOverride ?? T.accent;
      doc.setFillColor(...accent);
      doc.rect(MARGIN, y + 0.5, 3.5, 7, 'F');
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...T.bodyFg);
      doc.text(title.toUpperCase(), MARGIN + 6, y + 6);
      y += 12;

    } else if (T.sectionStyle === 'dark') {
      // Fondo oscuro con pill
      doc.setFillColor(...C.darkCard);
      doc.roundedRect(MARGIN, y, CON_W, 8, 2, 2, 'F');
      doc.setFillColor(...C.teal);
      doc.roundedRect(MARGIN, y, 2, 8, 1, 1, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.teal);
      doc.text(title.toUpperCase(), MARGIN + 6, y + 5.5);
      y += 11;

    } else {
      // Gradient: pill teal sólido
      const accent = colorOverride ?? T.accent;
      doc.setFillColor(...accent);
      doc.roundedRect(MARGIN, y, CON_W, 8, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.white);
      doc.text(title.toUpperCase(), MARGIN + 4, y + 5.5);
      y += 11;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 1 · PORTADA
  // ═══════════════════════════════════════════════════════════════════════════

  if (theme === 'dark') {
    // Fondo oscuro completo + franja teal lateral
    doc.setFillColor(...C.darkBg);
    doc.rect(0, 0, PAGE_W, 55, 'F');
    doc.setFillColor(...C.teal);
    doc.rect(0, 0, 4, 55, 'F');

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.white);
    doc.text('ValidateAI', 10, 16);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.darkMid);
    doc.text('REPORTE DE VALIDACIÓN DE IDEA DE NEGOCIO', 10, 23);

    const dateStr = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.text(dateStr, PAGE_W - MARGIN - doc.getTextWidth(dateStr), 23);

    doc.setFillColor(...C.teal);
    doc.rect(0, 55, PAGE_W, 0.5, 'F');

    y = 64;
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.dark);
    doc.text(data.idea_name ?? 'Sin nombre', MARGIN, y);
    y += 10;

  } else if (theme === 'gradient') {
    // Header con doble banda: teal arriba, navy degradado simulado
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, PAGE_W, 48, 'F');
    doc.setFillColor(...C.teal);
    doc.rect(0, 0, PAGE_W, 28, 'F');

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.white);
    doc.text('ValidateAI', MARGIN, 14);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(204, 251, 241);
    doc.text('REPORTE DE VALIDACIÓN DE IDEA DE NEGOCIO', MARGIN, 21);

    const dateStr = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.setTextColor(204, 251, 241);
    doc.text(dateStr, PAGE_W - MARGIN - doc.getTextWidth(dateStr), 21);

    // Nombre en la banda naval
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.white);
    doc.text(data.idea_name ?? 'Sin nombre', MARGIN, 42);

    y = 54;

  } else {
    // CLEAN: franja teal clásica minimalista
    doc.setFillColor(...C.teal);
    doc.rect(0, 0, PAGE_W, 2, 'F'); // sólo línea superior fina
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 2, PAGE_W, 38, 'F');

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.teal);
    doc.text('ValidateAI', MARGIN, 16);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.gray);
    doc.text('REPORTE DE VALIDACIÓN DE IDEA DE NEGOCIO', MARGIN, 23);

    const dateStr = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.text(dateStr, PAGE_W - MARGIN - doc.getTextWidth(dateStr), 23);

    // Línea separadora teal al fondo del header
    doc.setFillColor(...C.teal);
    doc.rect(0, 40, PAGE_W, 1.5, 'F');

    y = 48;
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.dark);
    doc.text(data.idea_name ?? 'Sin nombre', MARGIN, y);
    y += 10;
  }

  // Chips de metadata (comunes a los 3 temas)
  const chipDefs: { label: string; bg: [number,number,number]; fg: [number,number,number] }[] = [
    ...(data.idea_industry  ? [{ label: data.idea_industry.toUpperCase(), bg: C.tealLight,   fg: C.tealDark   }] : []),
    ...(data.target_country ? [{ label: `\u{1F4CD} ${data.target_country}`, bg: C.blueLight, fg: C.blueDark  }] : []),
    ...(data.target_region  ? [{ label: data.target_region, bg: C.blueLight, fg: C.blueDark }] : []),
    ...(data.business_model ? [{ label: data.business_model.toUpperCase(), bg: C.purpleLight, fg: C.purple   }] : []),
    ...(data.business_stage ? [{ label: data.business_stage.toUpperCase(), bg: C.amberLight, fg: C.amberDark }] : []),
    ...(data.pricing_range  ? [{ label: data.pricing_range, bg: [240,253,244] as [number,number,number], fg: [22,101,52] as [number,number,number] }] : []),
  ];

  if (chipDefs.length) {
    let cx = MARGIN;
    for (const cd of chipDefs) {
      if (cx + 50 > PAGE_W - MARGIN) { y += 8; cx = MARGIN; }
      cx += chip(cd.label, cx, y, cd.bg, cd.fg);
    }
    y += 9;
  }

  if (data.known_competitors?.length) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.gray);
    doc.text('Competidores conocidos: ', MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.known_competitors.join(', '), MARGIN + doc.getTextWidth('Competidores conocidos: '), y);
    y += 7;
  }

  divider(2);

  if (data.idea_description) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...T.bodyFg);
    doc.text('Descripción de la idea', MARGIN, y);
    y += 5;
    const n = wrapText(data.idea_description, MARGIN, CON_W, 9.5, T.bodyMid);
    y += n * 5 + 6;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2 · SCORE PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════════
  const score = (data.summary?.score as number) ?? 0;
  const scoreColor: [number,number,number] = score >= 70 ? C.green : score >= 40 ? C.amber : C.red;
  const scoreLabel = score >= 70 ? 'Bien validada' : score >= 40 ? 'Validación parcial' : 'Necesita trabajo';

  checkPage(32);

  if (theme === 'dark') {
    // Score box oscuro con borde teal
    doc.setFillColor(...C.darkCard);
    doc.setDrawColor(...C.teal);
    doc.setLineWidth(0.5);
    doc.roundedRect(MARGIN, y, 54, 24, 3, 3, 'FD');
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...scoreColor);
    doc.text(`${score}`, MARGIN + 6, y + 17);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.darkMid);
    doc.text('/100', MARGIN + 32, y + 17);
    doc.setFontSize(7);
    doc.setTextColor(...C.darkMid);
    doc.text(scoreLabel, MARGIN + 3, y + 22);

  } else if (theme === 'gradient') {
    // Score box con acento gradient
    doc.setFillColor(...scoreColor);
    doc.roundedRect(MARGIN, y, 54, 24, 3, 3, 'F');
    // Línea accent
    doc.setFillColor(...C.navy);
    doc.roundedRect(MARGIN + 54 - 4, y, 4, 24, 0, 3, 'F');
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.white);
    doc.text(`${score}`, MARGIN + 6, y + 17);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('/100', MARGIN + 31, y + 17);
    doc.setFontSize(7);
    doc.text(scoreLabel, MARGIN + 3, y + 22);

  } else {
    // Clean: score pill simple con color semántico
    doc.setFillColor(...scoreColor);
    doc.roundedRect(MARGIN, y, 54, 24, 3, 3, 'F');
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.white);
    doc.text(`${score}`, MARGIN + 6, y + 17);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('/100', MARGIN + 31, y + 17);
    doc.setFontSize(7);
    doc.text(scoreLabel, MARGIN + 3, y + 22);
  }

  if (data.summary?.feedback) {
    const fbLines = doc.splitTextToSize(data.summary.feedback as string, CON_W - 60);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...T.bodyMid);
    doc.text(fbLines.slice(0, 6), MARGIN + 58, y + 6);
  }
  y += 30;

  // ═══════════════════════════════════════════════════════════════════════════
  // 3 · SCORE BREAKDOWN
  // ═══════════════════════════════════════════════════════════════════════════
  if (data.score_breakdown) {
    sectionHeader('Desglose del Score', theme === 'gradient' ? C.teal : C.teal);

    const dims = [
      { label: 'Problema (25%)', value: data.score_breakdown.problem ?? 0, color: C.red },
      { label: 'Mercado (20%)', value: data.score_breakdown.market ?? 0, color: C.blue },
      { label: 'Solución (25%)', value: data.score_breakdown.solution ?? 0, color: C.teal },
      { label: 'Ejecución (15%)', value: data.score_breakdown.execution ?? 0, color: C.purple },
      { label: 'Competencia (15%)', value: data.score_breakdown.competition ?? 0, color: C.amber },
    ];

    checkPage(50);
    drawRadarChart(MARGIN + 45, y + 23, 16, dims, C.teal);
    
    let ly = y + 2;
    for (const d of dims) {
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyFg);
      doc.text(d.label, MARGIN + 95, ly);
      
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...d.color);
      doc.text(String(d.value), MARGIN + 172 - doc.getTextWidth(String(d.value)), ly);
      
      const trackC: [number,number,number] = theme === 'dark' ? C.darkBorder : C.lightGray;
      progressBar(d.value, MARGIN + 95, ly + 2, 77, d.color, trackC);
      
      ly += 9;
    }
    
    y += 48;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4 · PREGUNTAS Y RESPUESTAS
  // ═══════════════════════════════════════════════════════════════════════════
  if (data.questions_answers?.length) {
    sectionHeader('Preguntas de Validación',
      theme === 'gradient' ? C.indigo :
      theme === 'dark'     ? undefined :
                             C.teal);

    for (const [i, qa] of data.questions_answers.entries()) {
      checkPage(22);
      doc.setFillColor(...T.accent);
      doc.circle(MARGIN + 3.5, y + 3.5, 3.5, 'F');
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.white);
      doc.text(String(i + 1), MARGIN + (i + 1 < 10 ? 2 : 1.5), y + 5);

      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyFg);
      const qLines = doc.splitTextToSize(qa.question, CON_W - 12);
      doc.text(qLines, MARGIN + 10, y + 4);
      y += qLines.length * 5 + 3;

      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...T.bodyMid);
      const aLines = doc.splitTextToSize(qa.answer, CON_W - 8);
      checkPage(aLines.length * 4.5 + 4);
      doc.text(aLines, MARGIN + 4, y);
      y += aLines.length * 4.5 + 6;
    }
    y += 2;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5 · CLIENTE OBJETIVO
  // ═══════════════════════════════════════════════════════════════════════════
  if (data.customer_segment || data.customer_pain_points?.length || data.customer_context) {
    sectionHeader('Cliente Objetivo',
      theme === 'gradient' ? C.teal :
      theme === 'dark'     ? undefined :
                             C.teal);

    if (data.customer_segment) {
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyFg);
      doc.text('Segmento:', MARGIN, y); y += 5;
      const n = wrapText(data.customer_segment, MARGIN, CON_W, 9.5, T.bodyMid);
      y += n * 5 + 5;
    }

    if (data.customer_context) {
      checkPage(14);
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyFg);
      doc.text('Contexto del problema:', MARGIN, y); y += 5;
      const n = wrapText(data.customer_context, MARGIN, CON_W, 9, T.bodyMid);
      y += n * 4.5 + 5;
    }

    if (data.customer_pain_points?.length) {
      checkPage(14);
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyFg);
      doc.text('Pain points:', MARGIN, y); y += 5;
      for (const pain of data.customer_pain_points) {
        checkPage(8);
        const pLines = doc.splitTextToSize(`• ${pain}`, CON_W - 4);
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...T.bodyMid);
        doc.text(pLines, MARGIN + 2, y);
        y += pLines.length * 4.5 + 1.5;
      }
      y += 3;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6 · PROPUESTA DE VALOR
  // ═══════════════════════════════════════════════════════════════════════════
  if (data.value_proposition || data.differentiator) {
    sectionHeader('Propuesta de Valor',
      theme === 'gradient' ? C.violet :
      theme === 'dark'     ? undefined :
                             C.purple);

    if (data.value_proposition) {
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyFg);
      doc.text('Propuesta:', MARGIN, y); y += 5;
      const n = wrapText(data.value_proposition, MARGIN, CON_W, 9.5, T.bodyMid);
      y += n * 5 + 5;
    }

    if (data.differentiator) {
      checkPage(14);
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyFg);
      doc.text('Diferenciador:', MARGIN, y); y += 5;
      const n = wrapText(data.differentiator, MARGIN, CON_W, 9.5, T.bodyMid);
      y += n * 5 + 4;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7 · PLAN DE MVP
  // ═══════════════════════════════════════════════════════════════════════════
  if (data.mvp_type || data.mvp_features?.length || data.mvp_user_flow) {
    sectionHeader('Plan de MVP',
      theme === 'gradient' ? C.amber :
      theme === 'dark'     ? undefined :
                             C.amber);

    if (data.mvp_type) {
      checkPage(10);
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyFg);
      doc.text('Tipo recomendado: ', MARGIN, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...T.bodyMid);
      doc.text(data.mvp_type.replace(/_/g, ' ').toUpperCase(), MARGIN + doc.getTextWidth('Tipo recomendado: '), y);
      y += 8;
    }

    if (data.mvp_features?.length) {
      const PLABEL: Record<string, string>  = { must: 'ESENCIAL', should: 'IMPORTANTE', could: 'DESEABLE' };
      const PCOLOR: Record<string, [number,number,number]> = { must: C.red, should: C.amber, could: C.blue };

      for (const f of data.mvp_features) {
        checkPage(16);
        const [r, g, b] = PCOLOR[f.priority] ?? [100, 100, 100];
        doc.setFillColor(r, g, b);
        doc.roundedRect(MARGIN, y + 1, 26, 5.5, 1.5, 1.5, 'F');
        doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.white);
        doc.text(PLABEL[f.priority] ?? f.priority, MARGIN + 1.5, y + 5);

        doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyFg);
        doc.text(f.name, MARGIN + 30, y + 5);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...C.gray);
        const fl = doc.splitTextToSize(f.description, CON_W - 32);
        doc.text(fl, MARGIN + 30, y + 10);
        y += 10 + fl.length * 4.5 + 4;
      }
    }

    if (data.mvp_user_flow) {
      checkPage(16);
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyFg);
      doc.text('Flujo de usuario principal:', MARGIN, y); y += 5;
      const n = wrapText(data.mvp_user_flow, MARGIN, CON_W, 9, T.bodyMid);
      y += n * 4.5 + 5;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8 · FORTALEZAS Y ÁREAS DE MEJORA (FODA)
  // ═══════════════════════════════════════════════════════════════════════════
  const strengths  = data.summary?.strengths  as string[] | undefined;
  const weaknesses = data.summary?.weaknesses as string[] | undefined;

  if (strengths?.length || weaknesses?.length) {
    sectionHeader('Análisis FODA',
      theme === 'gradient' ? C.green :
      theme === 'dark'     ? undefined :
                             C.green);

    const colW = (CON_W - 4) / 2;
    const startY = y;

    // Fortalezas — col izquierda
    if (theme === 'dark') {
      doc.setFillColor(...C.darkCard);
      doc.roundedRect(MARGIN, y, colW, 6.5, 1.5, 1.5, 'F');
      doc.setFillColor(...C.green);
      doc.roundedRect(MARGIN, y, 2, 6.5, 1, 1, 'F');
    } else if (theme === 'gradient') {
      doc.setFillColor(...C.green);
      doc.roundedRect(MARGIN, y, colW, 6.5, 1.5, 1.5, 'F');
    } else {
      doc.setFillColor(...C.greenLight);
      doc.roundedRect(MARGIN, y, colW, 6.5, 1.5, 1.5, 'F');
    }

    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.setTextColor(theme === 'gradient' ? 255 : theme === 'dark' ? C.green[0] : C.greenDark[0],
      theme === 'gradient' ? 255 : theme === 'dark' ? C.green[1] : C.greenDark[1],
      theme === 'gradient' ? 255 : theme === 'dark' ? C.green[2] : C.greenDark[2]);
    doc.text('✓  FORTALEZAS', MARGIN + (theme === 'dark' ? 5 : 3), y + 4.5);
    y += 8;

    for (const s of strengths ?? []) {
      checkPage(7);
      const sL = doc.splitTextToSize(`• ${s}`, colW - 3);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...T.bodyMid);
      doc.text(sL, MARGIN, y);
      y += sL.length * 4.5 + 1;
    }
    const leftEndY = y;

    // Debilidades — col derecha
    y = startY;
    const rx = MARGIN + colW + 4;

    if (theme === 'dark') {
      doc.setFillColor(...C.darkCard);
      doc.roundedRect(rx, y, colW, 6.5, 1.5, 1.5, 'F');
      doc.setFillColor(...C.amber);
      doc.roundedRect(rx, y, 2, 6.5, 1, 1, 'F');
    } else if (theme === 'gradient') {
      doc.setFillColor(...C.amber);
      doc.roundedRect(rx, y, colW, 6.5, 1.5, 1.5, 'F');
    } else {
      doc.setFillColor(...C.amberLight);
      doc.roundedRect(rx, y, colW, 6.5, 1.5, 1.5, 'F');
    }

    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.setTextColor(theme === 'gradient' ? 255 : theme === 'dark' ? C.amber[0] : C.amberDark[0],
      theme === 'gradient' ? 255 : theme === 'dark' ? C.amber[1] : C.amberDark[1],
      theme === 'gradient' ? 255 : theme === 'dark' ? C.amber[2] : C.amberDark[2]);
    doc.text('!  ÁREAS DE MEJORA', rx + (theme === 'dark' ? 5 : 3), y + 4.5);
    y += 8;

    for (const w of weaknesses ?? []) {
      const wL = doc.splitTextToSize(`• ${w}`, colW - 3);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...T.bodyMid);
      doc.text(wL, rx, y);
      y += wL.length * 4.5 + 1;
    }
    y = Math.max(leftEndY, y) + 5;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8.5 · ANÁLISIS DE RIESGOS
  // ═══════════════════════════════════════════════════════════════════════════
  if (data.risk_analysis) {
    const ra = data.risk_analysis;
    sectionHeader('Análisis de Riesgos', C.red);

    checkPage(20);
    const riskScore = ra.overallRiskScore;
    const riskColor: [number,number,number] = riskScore >= 70 ? C.red : riskScore >= 40 ? C.amber : C.green;
    const riskLabel = riskScore >= 70 ? 'Alto' : riskScore >= 40 ? 'Medio' : 'Bajo';

    doc.setFillColor(...riskColor);
    doc.circle(MARGIN + 8, y + 8, 8, 'F');
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.white);
    const scoreStr = String(riskScore);
    doc.text(scoreStr, MARGIN + 8 - doc.getTextWidth(scoreStr) / 2, y + 10);

    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyFg);
    doc.text(`Riesgo ${riskLabel}`, MARGIN + 20, y + 7);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...T.bodyMid);
    doc.text('Score general (0 = mínimo, 100 = máximo riesgo)', MARGIN + 20, y + 13);
    y += 22;

    const dimW = (CON_W - 4) / 2;
    const dims = [
      { label: 'Mercado', d: ra.dimensions.market },
      { label: 'Técnico', d: ra.dimensions.technical },
      { label: 'Regulatorio', d: ra.dimensions.regulatory },
      { label: 'Timing', d: ra.dimensions.timing },
    ];

    for (let i = 0; i < dims.length; i += 2) {
      checkPage(32);
      const rowY = y;

      for (let j = 0; j < 2 && i + j < dims.length; j++) {
        const { label, d } = dims[i + j];
        const xOff = j === 0 ? MARGIN : MARGIN + dimW + 4;
        const dimColor: [number,number,number] = d.score >= 70 ? C.red : d.score >= 40 ? C.amber : C.green;
        const cardBg: [number,number,number] = theme === 'dark' ? C.darkCard : [248, 250, 252];

        doc.setFillColor(...cardBg);
        doc.roundedRect(xOff, rowY, dimW, 30, 2, 2, 'F');

        const barW = dimW - 6;
        const trackColor: [number,number,number] = theme === 'dark' ? C.darkBorder : C.lightGray;
        doc.setFillColor(...trackColor);
        doc.roundedRect(xOff + 3, rowY + 2, barW, 3, 1, 1, 'F');
        const fillW = barW * (d.score / 100);
        doc.setFillColor(...dimColor);
        doc.roundedRect(xOff + 3 + barW - fillW, rowY + 2, Math.max(fillW, 2), 3, 1, 1, 'F');

        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyFg);
        doc.text(label, xOff + 3, rowY + 11);

        const badge = `${d.score} · ${d.label}`;
        const badgeW = doc.getTextWidth(badge) + 5;
        doc.setFillColor(...dimColor);
        doc.roundedRect(xOff + dimW - badgeW - 1, rowY + 7.5, badgeW, 5, 1.5, 1.5, 'F');
        doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.white);
        doc.text(badge, xOff + dimW - badgeW, rowY + 11.5);

        const descL = doc.splitTextToSize(d.description, dimW - 6);
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...T.bodyMid);
        doc.text(descL.slice(0, 2), xOff + 3, rowY + 17);
      }

      y = rowY + 34;
    }

    if (ra.mitigations?.length) {
      checkPage(20);
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.green);
      doc.text('Mitigaciones recomendadas', MARGIN, y);
      y += 6;

      for (const [i, mit] of ra.mitigations.entries()) {
        checkPage(9);
        doc.setFillColor(...C.green);
        doc.circle(MARGIN + 2.5, y + 2.5, 2.5, 'F');
        doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.white);
        doc.text(String(i + 1), MARGIN + 2.5 - doc.getTextWidth(String(i + 1)) / 2, y + 3.5);
        const mitL = doc.splitTextToSize(mit, CON_W - 10);
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...T.bodyMid);
        doc.text(mitL, MARGIN + 8, y + 3.5);
        y += mitL.length * 4.5 + 3;
      }
      y += 3;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 9 · PRÓXIMOS PASOS
  // ═══════════════════════════════════════════════════════════════════════════
  const nextSteps = data.summary?.next_steps as string[] | undefined;
  if (nextSteps?.length) {
    sectionHeader('Próximos Pasos Recomendados');

    for (const [i, step] of nextSteps.entries()) {
      checkPage(13);
      doc.setFillColor(...T.accent);
      doc.circle(MARGIN + 3.5, y + 3.5, 3.5, 'F');
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.white);
      doc.text(String(i + 1), MARGIN + (i + 1 < 10 ? 2 : 1.5), y + 5);
      doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...T.bodyMid);
      const sL = doc.splitTextToSize(step, CON_W - 12);
      doc.text(sL, MARGIN + 10, y + 4);
      y += sL.length * 5 + 5;
    }
    y += 2;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 9.5 · UNIT ECONOMICS
  // ═══════════════════════════════════════════════════════════════════════════
  if (data.unit_economics) {
    const ue = data.unit_economics;
    sectionHeader('Unit Economics', C.blue);

    const cur = ue.cac.currency === 'CLP' ? '$' : 'USD ';
    const fmtRange = (min: number, max: number) =>
      `${cur}${min.toLocaleString('es-CL')} – ${cur}${max.toLocaleString('es-CL')}`;

    const ratioColor: [number,number,number] = ue.ltvCacRatio.value >= 5 ? C.green : ue.ltvCacRatio.value >= 3 ? C.amber : C.red;
    const ratioLabel = ue.ltvCacRatio.value >= 5 ? 'Saludable' : ue.ltvCacRatio.value >= 3 ? 'Viable' : 'Crítico';

    const metrics = [
      { label: 'CAC', value: fmtRange(ue.cac.min, ue.cac.max), color: C.blue },
      { label: 'LTV', value: fmtRange(ue.ltv.min, ue.ltv.max), color: C.indigo },
      { label: `Ratio LTV/CAC  ${ue.ltvCacRatio.value.toFixed(1)}x`, value: ratioLabel, color: ratioColor },
      { label: 'Break-even', value: `${ue.breakEvenUsers} usuarios`, color: C.teal },
    ];

    checkPage(30);
    const mW = (CON_W - 6) / 4;
    for (let i = 0; i < metrics.length; i++) {
      const { label, value, color } = metrics[i];
      const xOff = MARGIN + i * (mW + 2);
      const cardBg: [number,number,number] = theme === 'dark' ? C.darkCard : [248, 250, 252];
      doc.setFillColor(...cardBg);
      doc.roundedRect(xOff, y, mW, 22, 2, 2, 'F');
      doc.setFillColor(...color);
      doc.roundedRect(xOff, y, mW, 3.5, 1, 1, 'F');
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyMid);
      const lL = doc.splitTextToSize(label, mW - 4);
      doc.text(lL, xOff + 2, y + 8.5);
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...color);
      doc.text(value, xOff + 2, y + 17);
    }
    y += 26;

    // BarChart CAC vs LTV
    checkPage(40);
    const avgCac = (ue.cac.min + ue.cac.max) / 2;
    const avgLtv = (ue.ltv.min + ue.ltv.max) / 2;
    const maxValBar = Math.max(avgCac, avgLtv, 1);
    
    const chartY = y;
    doc.setFillColor(...(theme === 'dark' ? C.darkCard : [248, 250, 252] as [number,number,number]));
    doc.roundedRect(MARGIN, chartY, CON_W, 30, 2, 2, 'F');
    
    const axisY = chartY + 22;
    doc.setDrawColor(...(theme === 'dark' ? C.darkBorder : C.lightGray));
    doc.setLineWidth(0.5);
    doc.line(MARGIN + 10, axisY, MARGIN + CON_W - 10, axisY);

    const maxBarHeight = 15;
    
    const cacH = (avgCac / maxValBar) * maxBarHeight;
    const cacX = MARGIN + CON_W / 2 - 30;
    doc.setFillColor(...C.blue);
    doc.rect(cacX, axisY - cacH, 20, cacH, 'F');
    
    const ltvH = (avgLtv / maxValBar) * maxBarHeight;
    const ltvX = MARGIN + CON_W / 2 + 10;
    doc.setFillColor(...C.indigo);
    doc.rect(ltvX, axisY - ltvH, 20, ltvH, 'F');
    
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyMid);
    doc.text('CAC Promedio', cacX + 10 - doc.getTextWidth('CAC Promedio') / 2, axisY + 5);
    doc.text('LTV Promedio', ltvX + 10 - doc.getTextWidth('LTV Promedio') / 2, axisY + 5);
    
    doc.setTextColor(...C.blue);
    doc.text(`~${cur}${Math.round(avgCac).toLocaleString('es-CL')}`, cacX + 10 - doc.getTextWidth(`~${cur}${Math.round(avgCac).toLocaleString('es-CL')}`) / 2, axisY - cacH - 2);
    
    doc.setTextColor(...C.indigo);
    doc.text(`~${cur}${Math.round(avgLtv).toLocaleString('es-CL')}`, ltvX + 10 - doc.getTextWidth(`~${cur}${Math.round(avgLtv).toLocaleString('es-CL')}`) / 2, axisY - ltvH - 2);

    y += 36;

    checkPage(12);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...T.bodyMid);
    const churnText = `Payback: ${ue.paybackMonths.min}–${ue.paybackMonths.max} meses  ·  Churn mensual estimado: ${ue.monthlyChurnEstimate}%`;
    doc.text(churnText, MARGIN, y); y += 8;

    if (ue.assumptions?.length) {
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyFg);
      doc.text('Supuestos clave:', MARGIN, y); y += 5;
      for (const a of ue.assumptions) {
        checkPage(7);
        const aL = doc.splitTextToSize(`• ${a}`, CON_W - 4);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...T.bodyMid);
        doc.text(aL, MARGIN + 2, y);
        y += aL.length * 4 + 1;
      }
    }
    y += 4;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 9.6 · FOUNDER-MARKET FIT
  // ═══════════════════════════════════════════════════════════════════════════
  if (data.founder_fit) {
    const ff = data.founder_fit;
    sectionHeader('Founder-Market Fit', C.purple);

    checkPage(20);
    const ffScore = ff.score;
    const ffColor: [number,number,number] = ffScore >= 70 ? C.green : ffScore >= 40 ? C.amber : C.red;

    doc.setFillColor(...ffColor);
    doc.circle(MARGIN + 8, y + 8, 8, 'F');
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.white);
    const ffStr = String(ffScore);
    doc.text(ffStr, MARGIN + 8 - doc.getTextWidth(ffStr) / 2, y + 10);

    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyFg);
    doc.text(`Fit ${ffScore >= 70 ? 'Alto' : ffScore >= 40 ? 'Medio' : 'Bajo'}`, MARGIN + 20, y + 7);
    const assL = doc.splitTextToSize(ff.assessment, CON_W - 25);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...T.bodyMid);
    doc.text(assL.slice(0, 2), MARGIN + 20, y + 13);
    y += 24;

    const dims5 = [
      { label: 'Conocimiento del problema', value: ff.dimensions.problemKnowledge },
      { label: 'Experiencia en industria',  value: ff.dimensions.industryExperience },
      { label: 'Capacidad técnica',         value: ff.dimensions.technicalCapability },
      { label: 'Red de contactos',          value: ff.dimensions.networkStrength },
      { label: 'Track record previo',       value: ff.dimensions.trackRecord },
    ].map(d => ({ ...d, color: (d.value >= 70 ? C.green : d.value >= 40 ? C.amber : C.red) as [number,number,number] }));

    checkPage(50);
    drawRadarChart(MARGIN + 45, y + 23, 16, dims5, ffColor);
    
    let ly = y + 2;
    for (const d of dims5) {
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyFg);
      doc.text(d.label, MARGIN + 95, ly);
      
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...d.color);
      doc.text(String(d.value), MARGIN + 172 - doc.getTextWidth(String(d.value)), ly);
      
      const trackC: [number,number,number] = theme === 'dark' ? C.darkBorder : C.lightGray;
      progressBar(d.value, MARGIN + 95, ly + 2, 77, d.color, trackC);
      
      ly += 9;
    }
    
    y += 48;

    if (ff.recommendations?.length) {
      checkPage(15);
      y += 3;
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.purple);
      doc.text('Recomendaciones para cerrar gaps', MARGIN, y); y += 6;
      for (const [i, rec] of ff.recommendations.entries()) {
        checkPage(9);
        const rL = doc.splitTextToSize(`${i + 1}. ${rec}`, CON_W - 4);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...T.bodyMid);
        doc.text(rL, MARGIN + 2, y);
        y += rL.length * 4.5 + 2;
      }
    }
    y += 4;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 10 · TAMAÑO DE MERCADO (TAM / SAM / SOM)
  // ═══════════════════════════════════════════════════════════════════════════
  if (data.market_sizing) {
    const ms = data.market_sizing;
    sectionHeader('Tamaño de Mercado (TAM / SAM / SOM)',
      theme === 'gradient' ? C.blue :
      theme === 'dark'     ? undefined :
                             C.blue);

    const fmtUSD = (v: number) =>
      v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B`
      : v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M`
      : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K`
      : `$${v}`;

    const CONF_LABEL: Record<string, string> = { high: 'Alta', medium: 'Media', low: 'Baja' };
    const CONF_COLOR: Record<string, [number,number,number]> = { high: C.green, medium: C.amber, low: C.red };
    const TIER_COLOR: Record<string, [number,number,number]> = { tam: C.blue, sam: C.indigo, som: C.teal };
    const maxVal = (ms.tam?.value_high || 1);

    for (const { key, label, tier } of [
      { key: 'tam', label: 'TAM', tier: ms.tam },
      { key: 'sam', label: 'SAM', tier: ms.sam },
      { key: 'som', label: 'SOM', tier: ms.som },
    ] as const) {
      if (!tier) continue;
      checkPage(30);
      const barW  = CON_W - 60;
      const pct   = Math.min(tier.value_high / maxVal, 1);
      const tc    = TIER_COLOR[key];
      const cc    = CONF_COLOR[tier.confidence] ?? [100,100,100];

      doc.setFillColor(...tc);
      doc.roundedRect(MARGIN, y, 14, 6.5, 1.5, 1.5, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.white);
      doc.text(label, MARGIN + 1.5, y + 4.8);

      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyFg);
      const rangeText = `${fmtUSD(tier.value_low)} – ${fmtUSD(tier.value_high)}`;
      doc.text(rangeText, MARGIN + 18, y + 5);

      const confX = MARGIN + 18 + doc.getTextWidth(rangeText) + 4;
      doc.setFillColor(...cc);
      doc.roundedRect(confX, y + 0.5, 18, 5, 1.5, 1.5, 'F');
      doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.white);
      doc.text(CONF_LABEL[tier.confidence] ?? tier.confidence, confX + 2, y + 4);
      y += 10;

      const trackColor: [number,number,number] = theme === 'dark' ? C.darkBorder : C.lightGray;
      doc.setFillColor(...trackColor);
      doc.roundedRect(MARGIN, y, barW, 4, 1, 1, 'F');
      doc.setFillColor(...tc);
      doc.roundedRect(MARGIN, y, Math.max(barW * pct, 3), 4, 1, 1, 'F');
      y += 7;

      const dL = doc.splitTextToSize(tier.description, CON_W);
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...T.bodyMid);
      doc.text(dL, MARGIN, y);
      y += dL.length * 4 + 2;

      if (tier.source_notes) {
        const snL = doc.splitTextToSize(`Fuente: ${tier.source_notes}`, CON_W);
        doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(160, 160, 170);
        doc.text(snL, MARGIN, y);
        y += snL.length * 3.5 + 2;
      }

      if (key === 'som' && tier.assumptions?.length) {
        checkPage(10);
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyFg);
        doc.text('Supuestos clave:', MARGIN, y); y += 5;
        for (const a of tier.assumptions) {
          checkPage(7);
          const aL = doc.splitTextToSize(`· ${a}`, CON_W - 4);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...T.bodyMid);
          doc.text(aL, MARGIN + 2, y);
          y += aL.length * 4 + 1;
        }
      }
      y += 5;
    }

    if (ms.methodology) {
      checkPage(10);
      const mL = doc.splitTextToSize(`Metodología: ${ms.methodology}`, CON_W);
      doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(160, 160, 170);
      doc.text(mL, MARGIN, y);
      y += mL.length * 4 + 4;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 10.5 · SEÑALES DE MERCADO
  // ═══════════════════════════════════════════════════════════════════════════
  if (data.market_signals) {
    const ms2 = data.market_signals;
    sectionHeader('Señales de Mercado', C.indigo);

    checkPage(20);
    const TREND_COLOR: Record<string, [number,number,number]> = { growing: C.green, stable: C.amber, declining: C.red };
    const TREND_LABEL: Record<string, string> = { growing: 'Creciendo', stable: 'Estable', declining: 'Declining' };
    const TIME_COLOR: Record<string, [number,number,number]> = { optimal: C.green, too_early: C.amber, late: C.red, uncertain: C.gray };
    const TIME_LABEL: Record<string, string> = { optimal: 'Timing óptimo', too_early: 'Demasiado temprano', late: 'Tarde', uncertain: 'Incierto' };

    const tc2 = TREND_COLOR[ms2.trendDirection] ?? C.gray;
    chip(TREND_LABEL[ms2.trendDirection] ?? ms2.trendDirection, MARGIN, y - 1, tc2, C.white);
    const trendLabelW = doc.getTextWidth(TREND_LABEL[ms2.trendDirection] ?? ms2.trendDirection) + 10;
    const timingC = TIME_COLOR[ms2.timingAssessment] ?? C.gray;
    chip(TIME_LABEL[ms2.timingAssessment] ?? ms2.timingAssessment, MARGIN + trendLabelW + 2, y - 1, timingC, C.white);
    y += 8;

    const tdL = doc.splitTextToSize(ms2.trendDescription, CON_W);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...T.bodyMid);
    doc.text(tdL, MARGIN, y); y += tdL.length * 4.5 + 4;

    if (ms2.timingRationale) {
      const trL = doc.splitTextToSize(`Timing: ${ms2.timingRationale}`, CON_W);
      doc.setFontSize(8.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(...T.bodyMid);
      doc.text(trL, MARGIN, y); y += trL.length * 4.5 + 4;
    }

    if (ms2.recentFunding?.length) {
      checkPage(12);
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyFg);
      doc.text('Rondas de inversión recientes', MARGIN, y); y += 6;
      for (const f of ms2.recentFunding) {
        checkPage(7);
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...T.bodyMid);
        doc.text(`• ${f.company} — ${f.amount} (${f.date})`, MARGIN + 2, y); y += 5;
      }
      y += 2;
    }

    if (ms2.relevantNews?.length) {
      checkPage(12);
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyFg);
      doc.text('Noticias relevantes', MARGIN, y); y += 6;
      const NEWS_C: Record<string, [number,number,number]> = { positive: C.green, negative: C.red, neutral: C.gray };
      for (const n of ms2.relevantNews) {
        checkPage(7);
        const nc = NEWS_C[n.impact] ?? C.gray;
        doc.setFillColor(...nc); doc.circle(MARGIN + 2, y + 1.5, 1.5, 'F');
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...T.bodyMid);
        const nL = doc.splitTextToSize(n.title, CON_W - 8);
        doc.text(nL, MARGIN + 6, y + 3); y += nL.length * 4.5 + 1;
      }
      y += 3;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 11 · ANÁLISIS DE COMPETENCIA
  // ═══════════════════════════════════════════════════════════════════════════
  if (data.competitive_analysis) {
    const ca = data.competitive_analysis;
    sectionHeader('Análisis de Competencia',
      theme === 'gradient' ? C.violet :
      theme === 'dark'     ? undefined :
                             C.purple);

    for (const c of ca.competitors ?? []) {
      checkPage(36);

      doc.setFontSize(10.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyFg);
      doc.text(c.name, MARGIN, y + 5);
      const nameW = doc.getTextWidth(c.name);

      if (c.url) {
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...T.bodyMid);
        doc.text(c.url, MARGIN + nameW + 3, y + 5);
      }

      const srcLabel = c.source === 'user_provided' ? 'Usuario' : 'IA';
      const srcBg: [number,number,number] = c.source === 'user_provided' ? C.blueLight : [240,253,244];
      const srcFg: [number,number,number] = c.source === 'user_provided' ? C.blueDark  : [22,101,52];
      chip(srcLabel, PAGE_W - MARGIN - 22, y + 1, srcBg, srcFg);
      y += 8;

      if (c.target_market) {
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyMid);
        doc.text('Mercado: ', MARGIN, y);
        doc.setFont('helvetica', 'normal');
        const tmL = doc.splitTextToSize(c.target_market, CON_W - doc.getTextWidth('Mercado: '));
        doc.text(tmL, MARGIN + doc.getTextWidth('Mercado: '), y);
        y += 5;
      }

      const dL = doc.splitTextToSize(c.description, CON_W);
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...T.bodyMid);
      doc.text(dL, MARGIN, y);
      y += dL.length * 4.5 + 3;

      if (c.pricing) {
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyFg);
        doc.text('Pricing: ', MARGIN, y);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...T.bodyMid);
        doc.text(c.pricing, MARGIN + doc.getTextWidth('Pricing: '), y);
        y += 5;
      }

      const cColW = (CON_W - 4) / 2;
      if (c.strengths?.length || c.weaknesses?.length) {
        checkPage(24);
        const syStart = y;

        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.greenDark);
        doc.text('✓ Fortalezas', MARGIN, y); y += 4.5;
        for (const s of c.strengths ?? []) {
          const sL = doc.splitTextToSize(`• ${s}`, cColW - 3);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...T.bodyMid);
          doc.text(sL, MARGIN, y);
          y += sL.length * 4 + 0.5;
        }
        const leftY = y;

        y = syStart;
        const rxx = MARGIN + cColW + 4;
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.amberDark);
        doc.text('✗ Debilidades', rxx, y); y += 4.5;
        for (const w of c.weaknesses ?? []) {
          const wL = doc.splitTextToSize(`• ${w}`, cColW - 3);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...T.bodyMid);
          doc.text(wL, rxx, y);
          y += wL.length * 4 + 0.5;
        }
        y = Math.max(leftY, y) + 3;
      }

      doc.setDrawColor(...T.dividerColor); doc.setLineWidth(0.2);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 5;
    }

    if (ca.unmet_pains?.length) {
      checkPage(16);
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.purpleDark);
      doc.text('Dolores no resueltos en el mercado', MARGIN, y); y += 6;
      for (const pain of ca.unmet_pains) {
        checkPage(8);
        doc.setFillColor(...C.red);
        doc.circle(MARGIN + 2.5, y + 2.5, 2.5, 'F');
        doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.white);
        doc.text('!', MARGIN + 1.5, y + 4);
        const pL = doc.splitTextToSize(pain, CON_W - 10);
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...T.bodyMid);
        doc.text(pL, MARGIN + 8, y + 4);
        y += pL.length * 4.5 + 3;
      }
      y += 3;
    }

    if (ca.market_gaps?.length) {
      checkPage(16);
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.purpleDark);
      doc.text('Gaps de mercado identificados', MARGIN, y); y += 6;

      const CONF_C: Record<string, [number,number,number]> = { high: C.green, medium: C.amber, low: C.red };
      const CONF_L: Record<string, string> = { high: 'Alta', medium: 'Media', low: 'Baja' };

      for (const gap of ca.market_gaps) {
        checkPage(14);
        const badgeW = chip(CONF_L[gap.confidence] ?? gap.confidence, MARGIN, y - 1, CONF_C[gap.confidence] ?? [100,100,100], C.white);
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...T.bodyFg);
        doc.text(gap.gap, MARGIN + badgeW + 2, y + 3);
        y += 8;
        if (gap.opportunity) {
          const oL = doc.splitTextToSize(`→ ${gap.opportunity}`, CON_W - 4);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...T.bodyMid);
          doc.text(oL, MARGIN + 2, y);
          y += oL.length * 4 + 3;
        }
      }
      y += 2;
    }

    if (ca.competitive_advantage_suggestion) {
      checkPage(18);
      doc.setFillColor(...C.purpleLight);
      doc.setDrawColor(216, 180, 254);
      doc.roundedRect(MARGIN, y, CON_W, 8.5, 2, 2, 'FD');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.purple);
      doc.text('Ventaja competitiva sugerida:', MARGIN + 3, y + 5.8);
      y += 12;
      const aL = doc.splitTextToSize(ca.competitive_advantage_suggestion, CON_W);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...T.bodyMid);
      doc.text(aL, MARGIN, y);
      y += aL.length * 4.5 + 6;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FOOTER EN TODAS LAS PÁGINAS
  // ═══════════════════════════════════════════════════════════════════════════
  const pageCount = (doc as unknown as { internal: { getNumberOfPages(): number } })
    .internal.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    if (theme === 'dark') {
      doc.setFillColor(...C.darkCard);
      doc.rect(0, 279, PAGE_W, 18, 'F');
      doc.setFillColor(...C.teal);
      doc.rect(0, 279, PAGE_W, 0.5, 'F');
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.darkMid);
      doc.text('ValidateAI · valida tu idea antes de construirla', MARGIN, 286);
      doc.text(`Página ${i} de ${pageCount}`, PAGE_W - MARGIN - doc.getTextWidth(`Página ${i} de ${pageCount}`), 286);

    } else if (theme === 'gradient') {
      doc.setFillColor(...C.navy);
      doc.rect(0, 279, PAGE_W, 18, 'F');
      doc.setFillColor(...C.teal);
      doc.rect(0, 279, PAGE_W, 0.8, 'F');
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.darkMid);
      doc.text('ValidateAI · valida tu idea antes de construirla', MARGIN, 286);
      doc.text(`Página ${i} de ${pageCount}`, PAGE_W - MARGIN - doc.getTextWidth(`Página ${i} de ${pageCount}`), 286);

    } else {
      // Clean: línea superior teal en el footer
      doc.setFillColor(...C.teal);
      doc.rect(0, 279, PAGE_W, 0.8, 'F');
      doc.setDrawColor(...C.lightGray);
      doc.setLineWidth(0.25);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.gray);
      doc.text('ValidateAI · valida tu idea antes de construirla', MARGIN, 285);
      doc.text(`Página ${i} de ${pageCount}`, PAGE_W - MARGIN - doc.getTextWidth(`Página ${i} de ${pageCount}`), 285);
    }
  }

  doc.save(`ValidateAI_${(data.idea_name ?? 'reporte').replace(/\s+/g, '_')}.pdf`);
}
