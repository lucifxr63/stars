import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Polygon,
  Line,
  Circle,
  G,
} from '@react-pdf/renderer';
// react-pdf's SVGTextProps types are incomplete (no fontSize/fontFamily).
// This wrapper isolates the `any` cast to one controlled place.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SvgText(props: Record<string, any>) {
  return <Text {...props} />;
}
import { styles, colors } from './pdfStyles';
import type { PDFData } from '@/lib/pdf';
import type {
  MarketSizingTier,
  CompetitorEntry,
  ScoreBreakdown,
} from '@/types/validation';

// ── Helpers ────────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 70) return colors.green;
  if (score >= 40) return colors.amber;
  return colors.red;
}

function scoreLabel(score: number): string {
  if (score >= 70) return 'VIABLE';
  if (score >= 40) return 'POTENCIAL';
  return 'RIESGO ALTO';
}

function formatTier(tier: MarketSizingTier): string {
  const lo = tier.value_low.toLocaleString('es-CL');
  const hi = tier.value_high.toLocaleString('es-CL');
  return `${tier.currency} ${lo} – ${hi}`;
}

// ── Radar Chart (SVG) ─────────────────────────────────────────────────────────

const RADAR_KEYS: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: 'problem',     label: 'Problema' },
  { key: 'market',      label: 'Mercado' },
  { key: 'competition', label: 'Competencia' },
  { key: 'solution',    label: 'Solución' },
  { key: 'execution',   label: 'Ejecución' },
];

const CX = 80;
const CY = 80;
const R  = 58; // max radius for data polygon
const RL = 72; // radius for label placement (beyond grid)
const N  = 5;
const ANGLE_OFFSET = -Math.PI / 2; // start from top

function radarAngle(i: number) {
  return ANGLE_OFFSET + (i * 2 * Math.PI) / N;
}

function radarPoint(r: number, i: number): { x: number; y: number } {
  const a = radarAngle(i);
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

function polygonPoints(values: number[]): string {
  return values
    .map((v, i) => {
      const { x, y } = radarPoint(R * Math.min(v, 1), i);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function gridPoints(level: number): string {
  return Array.from({ length: N }, (_, i) => {
    const { x, y } = radarPoint(R * level, i);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

// react-pdf SVG Text doesn't support textAnchor fully in all versions;
// we nudge x manually based on which side of center the label lands.
function labelAnchor(i: number): { anchor: string; dx: number } {
  const a = radarAngle(i);
  const cos = Math.cos(a);
  if (cos > 0.15)  return { anchor: 'start',  dx:  3 };
  if (cos < -0.15) return { anchor: 'end',    dx: -3 };
  return             { anchor: 'middle', dx:  0 };
}

function RadarChart({ sb }: { sb: ScoreBreakdown }) {
  const values = RADAR_KEYS.map(({ key }) => sb[key]);
  const dataPolygon = polygonPoints(values);
  const GRID_LEVELS = [0.25, 0.5, 0.75, 1];

  return (
    <Svg viewBox="0 0 160 160" width={160} height={160}>
      {/* Grid pentagons */}
      {GRID_LEVELS.map((lvl) => (
        <Polygon
          key={lvl}
          points={gridPoints(lvl)}
          fill="none"
          stroke={lvl === 1 ? '#3A4E68' : '#2A3A52'}
          strokeWidth={lvl === 1 ? 0.8 : 0.5}
        />
      ))}

      {/* Axis spokes */}
      {RADAR_KEYS.map((_, i) => {
        const tip = radarPoint(R, i);
        return (
          <Line
            key={i}
            x1={CX}
            y1={CY}
            x2={tip.x}
            y2={tip.y}
            stroke="#2A3A52"
            strokeWidth={0.5}
          />
        );
      })}

      {/* Data polygon — filled area */}
      <Polygon
        points={dataPolygon}
        fill={`${colors.accent}33`}
        stroke={colors.accent}
        strokeWidth={1.5}
      />

      {/* Data vertices */}
      {values.map((v, i) => {
        const { x, y } = radarPoint(R * Math.min(v, 1), i);
        return (
          <G key={i}>
            <Circle cx={x} cy={y} r={3} fill={colors.accent} />
            <Circle cx={x} cy={y} r={1.5} fill={colors.white} />
          </G>
        );
      })}

      {/* Center dot */}
      <Circle cx={CX} cy={CY} r={2} fill="#2A3A52" />

      {/* Labels */}
      {RADAR_KEYS.map(({ label }, i) => {
        const { x, y } = radarPoint(RL, i);
        const { anchor, dx } = labelAnchor(i);
        // Nudge label above/below based on vertical position
        const a = radarAngle(i);
        const dy = Math.sin(a) < -0.15 ? -3 : Math.sin(a) > 0.15 ? 5 : 1;
        return (
          <SvgText
            key={i}
            x={x + dx}
            y={y + dy}
            fontSize={6.5}
            fill={colors.muted}
            textAnchor={anchor as 'start' | 'middle' | 'end'}
            fontFamily="Helvetica"
          >
            {label}
          </SvgText>
        );
      })}

      {/* Score value near each vertex */}
      {values.map((v, i) => {
        const { x, y } = radarPoint(R * Math.min(v, 1) + 8, i);
        return (
          <SvgText
            key={i}
            x={x}
            y={y}
            fontSize={6}
            fill={colors.accent}
            textAnchor="middle"
            fontFamily="Helvetica-Bold"
          >
            {Math.round(v * 100)}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Footer({ pageLabel }: { pageLabel: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>ValidateAI · Investment Dossier</Text>
      <Text style={styles.footerText}>{pageLabel}</Text>
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={styles.listItem}>
          <Text style={styles.bullet}>›</Text>
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  // ScoreBreakdown values are 0–1 fractions
  const pct = Math.min(value, 1);
  const display = Math.round(pct * 100);
  const color = scoreColor(display);
  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <View style={styles.scoreBar}>
        <View
          style={[styles.scoreBarFill, { width: `${pct * 100}%`, backgroundColor: color }]}
        />
      </View>
      <Text style={[styles.scoreValue, { color }]}>{display}</Text>
    </View>
  );
}

// ── Cover Page ─────────────────────────────────────────────────────────────────

function CoverPage({ data }: { data: PDFData }) {
  const score = data.validation_score ?? 0;
  const color = scoreColor(score);
  const label = scoreLabel(score);
  const date  = new Date().toLocaleDateString('es-CL', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <Page size="A4" style={styles.coverPage}>
      {/* Hero banner */}
      <View style={styles.coverHero}>
        <Text style={styles.coverBadge}>Investment Dossier · ValidateAI</Text>

        <Text style={styles.coverTitle}>{data.idea_name ?? 'Startup Report'}</Text>

        {data.idea_description && (
          <Text style={styles.coverSubtitle}>
            {data.idea_description}
          </Text>
        )}

        {/* Score block */}
        <View style={styles.coverScoreContainer}>
          <Text style={[styles.coverScoreBig, { color }]}>{score}</Text>
          <View>
            <Text style={styles.coverScoreLabel}>Score de Viabilidad</Text>
            <Text style={[styles.pill, { backgroundColor: color + '22', color }]}>
              {label}
            </Text>
            <View style={styles.coverScoreBar}>
              <View
                style={[
                  styles.coverScoreBarFill,
                  { width: `${score}%`, backgroundColor: color },
                ]}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Meta row */}
      <View style={styles.coverMeta}>
        {data.idea_industry && (
          <View style={styles.coverMetaItem}>
            <Text style={styles.coverMetaLabel}>Industria</Text>
            <Text style={styles.coverMetaValue}>{data.idea_industry}</Text>
          </View>
        )}
        {data.target_country && (
          <View style={styles.coverMetaItem}>
            <Text style={styles.coverMetaLabel}>Mercado</Text>
            <Text style={styles.coverMetaValue}>
              {data.target_country}{data.target_region ? ` · ${data.target_region}` : ''}
            </Text>
          </View>
        )}
        {data.business_model && (
          <View style={styles.coverMetaItem}>
            <Text style={styles.coverMetaLabel}>Modelo</Text>
            <Text style={styles.coverMetaValue}>
              {data.business_model.replace(/_/g, ' ').toUpperCase()}
            </Text>
          </View>
        )}
        {data.business_stage && (
          <View style={styles.coverMetaItem}>
            <Text style={styles.coverMetaLabel}>Etapa</Text>
            <Text style={styles.coverMetaValue}>{data.business_stage}</Text>
          </View>
        )}
        <View style={styles.coverMetaItem}>
          <Text style={styles.coverMetaLabel}>Generado</Text>
          <Text style={styles.coverMetaValue}>{date}</Text>
        </View>
      </View>
    </Page>
  );
}

// ── Executive Summary Page ─────────────────────────────────────────────────────

function ExecutiveSummaryPage({ data }: { data: PDFData }) {
  const summary    = data.summary as Record<string, unknown> | undefined;
  const feedback   = (summary?.feedback   as string) ?? '';
  const strengths  = (summary?.strengths  as string[]) ?? [];
  const weaknesses = (summary?.weaknesses as string[]) ?? [];
  const nextSteps  = (summary?.next_steps as string[]) ?? [];
  const sb         = data.score_breakdown;

  return (
    <Page size="A4" style={styles.contentPage}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Resumen Ejecutivo</Text>
        <Text style={styles.pageLabel}>01 · Executive Summary</Text>
      </View>

      {/* Score Breakdown — radar + bars side by side */}
      <View style={[styles.card, { marginBottom: 16 }]} wrap={false}>
        <Text style={styles.cardTitle}>Score Breakdown</Text>
        {sb ? (
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            {/* Radar */}
            <View style={{ alignItems: 'center' }}>
              <RadarChart sb={sb} />
            </View>
            {/* Bars */}
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <ScoreBar label="Problema"    value={sb.problem} />
              <ScoreBar label="Mercado"     value={sb.market} />
              <ScoreBar label="Competencia" value={sb.competition} />
              <ScoreBar label="Solución"    value={sb.solution} />
              <ScoreBar label="Ejecución"   value={sb.execution} />
            </View>
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Score breakdown no disponible</Text>
          </View>
        )}
      </View>

      {/* Feedback */}
      {feedback ? (
        <View style={styles.card} wrap={false}>
          <Text style={styles.cardTitle}>Evaluación General</Text>
          <Text style={styles.cardBody}>{feedback}</Text>
        </View>
      ) : null}

      {/* Strengths + Weaknesses */}
      <View style={styles.twoCol}>
        {strengths.length > 0 && (
          <View style={[styles.card, styles.col]} wrap={false}>
            <Text style={[styles.cardTitle, { color: colors.green }]}>Fortalezas</Text>
            <BulletList items={strengths} />
          </View>
        )}
        {weaknesses.length > 0 && (
          <View style={[styles.card, styles.col]} wrap={false}>
            <Text style={[styles.cardTitle, { color: colors.amber }]}>Debilidades</Text>
            <BulletList items={weaknesses} />
          </View>
        )}
      </View>

      {nextSteps.length > 0 && (
        <View style={styles.card} wrap={false}>
          <Text style={styles.cardTitle}>Próximos Pasos</Text>
          <BulletList items={nextSteps} />
        </View>
      )}

      <Footer pageLabel="01 · Resumen Ejecutivo" />
    </Page>
  );
}

// ── Market & Competition Page ──────────────────────────────────────────────────

function MarketPage({ data }: { data: PDFData }) {
  const ms = data.market_sizing;
  const ca = data.competitive_analysis;

  return (
    <Page size="A4" style={styles.contentPage}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Mercado y Competencia</Text>
        <Text style={styles.pageLabel}>02 · Market & Competition</Text>
      </View>

      <View style={styles.twoCol}>
        {/* Market Sizing */}
        <View style={styles.col}>
          <Text style={styles.sectionTitle}>Tamaño de Mercado</Text>
          {ms ? (
            <>
              {[
                { label: 'TAM', tier: ms.tam, color: colors.white,  size: 14 },
                { label: 'SAM', tier: ms.sam, color: colors.accent, size: 12 },
                { label: 'SOM', tier: ms.som, color: colors.green,  size: 11 },
              ].map(({ label, tier, color, size }) => (
                <View key={label} style={styles.card} wrap={false}>
                  <Text style={styles.cardTitle}>{label}</Text>
                  <Text style={{ fontSize: size, fontFamily: 'Helvetica-Bold', color, marginBottom: 4 }}>
                    {formatTier(tier)}
                  </Text>
                  <Text style={styles.cardBody}>{tier.description}</Text>
                </View>
              ))}
            </>
          ) : (
            <View style={styles.card}>
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>Market sizing no disponible</Text>
              </View>
            </View>
          )}
        </View>

        {/* Competitive Analysis */}
        <View style={styles.col}>
          <Text style={styles.sectionTitle}>Análisis Competitivo</Text>
          {ca ? (
            <>
              {ca.competitors?.slice(0, 3).map((c: CompetitorEntry, i: number) => (
                <View key={i} style={styles.card} wrap={false}>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: colors.white, marginBottom: 3 }}>
                    {c.name}
                  </Text>
                  <Text style={styles.cardBody}>{c.description}</Text>
                  {c.strengths?.length > 0 && (
                    <Text style={[styles.cardBody, { color: colors.green, marginTop: 4 }]}>
                      + {c.strengths.join(' · ')}
                    </Text>
                  )}
                </View>
              ))}
              {ca.competitive_advantage_suggestion && (
                <View style={styles.card} wrap={false}>
                  <Text style={styles.cardTitle}>Ventaja Competitiva</Text>
                  <Text style={styles.cardBody}>{ca.competitive_advantage_suggestion}</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.card}>
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>Análisis competitivo no disponible</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Unmet pains */}
      {(ca?.unmet_pains?.length ?? 0) > 0 && (
        <View style={styles.card} wrap={false}>
          <Text style={styles.cardTitle}>Dolores No Atendidos</Text>
          <BulletList items={ca!.unmet_pains} />
        </View>
      )}

      <Footer pageLabel="02 · Mercado y Competencia" />
    </Page>
  );
}

// ── Financials Page ────────────────────────────────────────────────────────────

function FinancialsPage({ data }: { data: PDFData }) {
  const ue = data.unit_economics;
  const ra = data.risk_analysis;

  if (!ue && !ra) return null;

  return (
    <Page size="A4" style={styles.contentPage}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Finanzas y Riesgos</Text>
        <Text style={styles.pageLabel}>03 · Financials & Risk</Text>
      </View>

      <View style={styles.twoCol}>
        {/* Unit Economics */}
        {ue && (
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Unit Economics</Text>
            <View style={styles.card} wrap={false}>
              {[
                ['CAC',          `${ue.cac.currency} ${ue.cac.min.toLocaleString()} – ${ue.cac.max.toLocaleString()}`],
                ['LTV',          `${ue.ltv.currency} ${ue.ltv.min.toLocaleString()} – ${ue.ltv.max.toLocaleString()}`],
                ['LTV/CAC',      `${ue.ltvCacRatio.value.toFixed(1)}x (${ue.ltvCacRatio.assessment})`],
                ['Payback',      `${ue.paybackMonths.min}–${ue.paybackMonths.max} meses`],
                ['Break-even',   `${ue.breakEvenUsers.toLocaleString()} usuarios`],
                ['Churn mensual',`${(ue.monthlyChurnEstimate * 100).toFixed(1)}%`],
              ].map(([label, val], i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 9, color: colors.muted }}>{label}</Text>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: colors.white }}>{val}</Text>
                </View>
              ))}
            </View>
            {ue.assumptions?.length > 0 && (
              <View style={styles.card} wrap={false}>
                <Text style={styles.cardTitle}>Supuestos</Text>
                <BulletList items={ue.assumptions} />
              </View>
            )}
          </View>
        )}

        {/* Risk Analysis */}
        {ra && (
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Riesgos</Text>
            <View style={styles.card} wrap={false}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ fontSize: 9, color: colors.muted }}>Score Global de Riesgo</Text>
                <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: scoreColor(100 - ra.overallRiskScore) }}>
                  {ra.overallRiskScore}/100
                </Text>
              </View>
              {Object.entries(ra.dimensions).map(([key, dim]) => (
                <View key={key} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                    <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: colors.white }}>{dim.label}</Text>
                    <Text style={{ fontSize: 9, color: colors.muted }}>{dim.score}/100</Text>
                  </View>
                  <Text style={styles.cardBody}>{dim.description}</Text>
                </View>
              ))}
            </View>
            {ra.mitigations?.length > 0 && (
              <View style={styles.card} wrap={false}>
                <Text style={styles.cardTitle}>Mitigaciones</Text>
                <BulletList items={ra.mitigations} />
              </View>
            )}
          </View>
        )}
      </View>

      <Footer pageLabel="03 · Finanzas y Riesgos" />
    </Page>
  );
}

// ── Investment Strategy Page ───────────────────────────────────────────────────

function InvestmentPage({ data }: { data: PDFData }) {
  const fr = data.fundraising_roadmap;
  const ff = data.founder_fit;
  const pa = data.playbook_analysis;

  if (!fr && !ff && !pa?.funding_verdict) return null;

  return (
    <Page size="A4" style={styles.contentPage}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Estrategia de Inversión</Text>
        <Text style={styles.pageLabel}>04 · Investment Strategy</Text>
      </View>

      {pa?.funding_verdict && (
        <View style={[styles.card, { borderColor: colors.green + '44', borderWidth: 1.5 }]} wrap={false}>
          <Text style={[styles.cardTitle, { color: colors.green }]}>Veredicto de Inversión</Text>
          <Text style={styles.cardBody}>{pa.funding_verdict}</Text>
        </View>
      )}

      <View style={styles.twoCol}>
        {/* Fundraising Roadmap */}
        {fr && (
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Fundraising</Text>
            <View style={styles.card} wrap={false}>
              <Text style={styles.cardTitle}>Instrumento</Text>
              <Text style={[styles.cardBody, { fontSize: 13, fontFamily: 'Helvetica-Bold', color: colors.accent, marginBottom: 6 }]}>
                {fr.recommended_instrument.replace(/_/g, ' ').toUpperCase()}
              </Text>
              <Text style={styles.cardTitle}>Ticket Size</Text>
              <Text style={[styles.cardBody, { fontFamily: 'Helvetica-Bold', color: colors.white }]}>
                {fr.suggested_ticket_size.currency} {fr.suggested_ticket_size.min.toLocaleString()} – {fr.suggested_ticket_size.max.toLocaleString()}
              </Text>
            </View>
            {fr.pitch_narrative && (
              <View style={styles.card} wrap={false}>
                <Text style={styles.cardTitle}>Narrative del Pitch</Text>
                <Text style={styles.cardBody}>{fr.pitch_narrative}</Text>
              </View>
            )}
            {fr.blockers?.length > 0 && (
              <View style={styles.card} wrap={false}>
                <Text style={[styles.cardTitle, { color: colors.amber }]}>Blockers</Text>
                <BulletList items={fr.blockers} />
              </View>
            )}
          </View>
        )}

        {/* Founder Fit */}
        {ff && (
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Founder-Market Fit</Text>
            <View style={styles.card} wrap={false}>
              <Text style={styles.cardTitle}>Score Global</Text>
              <Text style={[styles.cardBody, { fontSize: 20, fontFamily: 'Helvetica-Bold', color: scoreColor(ff.score), marginBottom: 8 }]}>
                {ff.score}/100
              </Text>
              {ff.assessment && <Text style={styles.cardBody}>{ff.assessment}</Text>}
            </View>
            {Object.entries(ff.dimensions).length > 0 && (
              <View style={styles.card} wrap={false}>
                <Text style={styles.cardTitle}>Dimensiones</Text>
                {Object.entries(ff.dimensions).map(([key, val]) => (
                  <View key={key} style={styles.scoreRow}>
                    <Text style={[styles.scoreLabel, { width: 90, fontSize: 8 }]}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </Text>
                    <View style={styles.scoreBar}>
                      <View style={[styles.scoreBarFill, { width: `${val}%`, backgroundColor: scoreColor(val) }]} />
                    </View>
                    <Text style={[styles.scoreValue, { color: scoreColor(val) }]}>{val}</Text>
                  </View>
                ))}
              </View>
            )}
            {ff.gaps?.length > 0 && (
              <View style={styles.card} wrap={false}>
                <Text style={[styles.cardTitle, { color: colors.amber }]}>Gaps a Cerrar</Text>
                <BulletList items={ff.gaps} />
              </View>
            )}
          </View>
        )}
      </View>

      <Footer pageLabel="04 · Inversión" />
    </Page>
  );
}

// ── Root Document ──────────────────────────────────────────────────────────────

export function InvestmentDossier({ data }: { data: PDFData }) {
  return (
    <Document
      title={data.idea_name ?? 'Investment Dossier'}
      author="ValidateAI"
      subject="Startup Validation Report"
      keywords="startup, investment, validation"
    >
      <CoverPage data={data} />
      <ExecutiveSummaryPage data={data} />
      <MarketPage data={data} />
      <FinancialsPage data={data} />
      <InvestmentPage data={data} />
    </Document>
  );
}
