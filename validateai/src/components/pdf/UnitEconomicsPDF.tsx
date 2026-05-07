import { Document, Page, View, Text, Svg, Polyline, Circle, Line } from '@react-pdf/renderer';
import { styles, colors } from './pdfStyles';
import type { PDFData } from '@/lib/pdf';
import type { FinancialProjection, UnitEconomics } from '@/types/validation';

// ── Helpers ────────────────────────────────────────────────────────────────────

function verdictColor(v: FinancialProjection['model_verdict']): string {
  if (v === 'strong')   return colors.green;
  if (v === 'moderate') return colors.amber;
  return colors.red;
}

function verdictLabel(v: FinancialProjection['model_verdict']): string {
  if (v === 'strong')   return 'MODELO SÓLIDO';
  if (v === 'moderate') return 'POTENCIAL MODERADO';
  return 'RIESGO ALTO';
}

function strategyLabel(s: FinancialProjection['growth_strategy']): string {
  if (s === 'plg')       return 'Product-Led Growth (PLG)';
  if (s === 'sales_led') return 'Sales-Led Growth';
  return 'Modelo Híbrido PLG + Sales';
}

function assessmentColor(a: UnitEconomics['ltvCacRatio']['assessment']): string {
  if (a === 'viable')  return colors.green;
  if (a === 'warning') return colors.amber;
  return colors.red;
}

// ── MRR Chart (SVG line chart) ────────────────────────────────────────────────

function MrrChart({ projection }: { projection: FinancialProjection['monthly_projection'] }) {
  const W = 460, H = 100;
  const PAD = { top: 10, right: 10, bottom: 20, left: 40 };
  const maxMrr = Math.max(...projection.map((p) => p.mrr_usd), 1);

  const toX = (m: number) => PAD.left + ((m - 1) / 11) * (W - PAD.left - PAD.right);
  const toY = (v: number) => PAD.top + (1 - v / maxMrr) * (H - PAD.top - PAD.bottom);

  const points = projection.map((p) => `${toX(p.month)},${toY(p.mrr_usd)}`).join(' ');

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
        Proyección MRR — 12 meses (USD)
      </Text>
      <Svg width={W} height={H}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((lvl) => {
          const y = toY(maxMrr * lvl);
          return (
            <Line key={lvl} x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke="#2A3A52" strokeWidth={0.5} />
          );
        })}
        {/* Line */}
        <Polyline points={points} fill="none" stroke={colors.accent} strokeWidth={2} />
        {/* Dots */}
        {projection.map((p) => (
          <Circle key={p.month} cx={toX(p.month)} cy={toY(p.mrr_usd)}
            r={3} fill={colors.accent} />
        ))}
      </Svg>
    </View>
  );
}

// ── CAC/LTV Bar chart ─────────────────────────────────────────────────────────

function CacLtvBars({ ue }: { ue: UnitEconomics }) {
  const maxVal = Math.max(ue.ltv.max, ue.cac.max);
  const cacPct = (ue.cac.max / maxVal) * 100;
  const ltvPct = (ue.ltv.max / maxVal) * 100;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        Relación CAC / LTV
      </Text>
      {[
        { label: 'CAC (max)', val: ue.cac.max, pct: cacPct, color: colors.red, currency: ue.cac.currency },
        { label: 'LTV (max)', val: ue.ltv.max, pct: ltvPct, color: colors.green, currency: ue.ltv.currency },
      ].map(({ label, val, pct, color, currency }) => (
        <View key={label} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
            <Text style={{ fontSize: 9, color: colors.muted }}>{label}</Text>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color }}>{currency} {val.toLocaleString('es-CL')}</Text>
          </View>
          <View style={{ height: 8, backgroundColor: '#2A3A52', borderRadius: 4 }}>
            <View style={{ width: `${pct}%` as never, height: 8, backgroundColor: color, borderRadius: 4 }} />
          </View>
        </View>
      ))}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ fontSize: 9, color: colors.muted }}>Ratio LTV/CAC</Text>
        <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: assessmentColor(ue.ltvCacRatio.assessment) }}>
          {ue.ltvCacRatio.value.toFixed(1)}x — {ue.ltvCacRatio.assessment.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

// ── Cash flow table ───────────────────────────────────────────────────────────

function CashFlowTable({ projection, breakEven }: { projection: FinancialProjection['monthly_projection']; breakEven: number }) {
  return (
    <View>
      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        Tabla de Flujo de Caja — 12 Meses
      </Text>
      {/* Header */}
      <View style={{ flexDirection: 'row', backgroundColor: '#0F1728', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, marginBottom: 2 }}>
        {['Mes', 'MRR (USD)', 'Usuarios', 'CAC Spend', 'Balance'].map((h) => (
          <Text key={h} style={{ flex: 1, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: colors.muted, textTransform: 'uppercase' }}>{h}</Text>
        ))}
      </View>
      {projection.map((p, i) => {
        const cumRevenue = projection.slice(0, i + 1).reduce((s, r) => s + r.mrr_usd, 0);
        const cumCost    = projection.slice(0, i + 1).reduce((s, r) => s + r.cac_spend_usd, 0);
        const balance    = cumRevenue - cumCost;
        const isBreakEven = p.month === breakEven;
        return (
          <View key={p.month} style={{
            flexDirection: 'row',
            paddingVertical: 5, paddingHorizontal: 10,
            backgroundColor: isBreakEven ? colors.green + '22' : i % 2 === 0 ? '#1E2B3E' : '#0F1728',
            borderRadius: isBreakEven ? 4 : 0,
            marginBottom: 1,
          }}>
            <Text style={{ flex: 1, fontSize: 8.5, color: isBreakEven ? colors.green : colors.white, fontFamily: isBreakEven ? 'Helvetica-Bold' : 'Helvetica' }}>
              M{p.month}{isBreakEven ? ' ✓' : ''}
            </Text>
            <Text style={{ flex: 1, fontSize: 8.5, color: '#CBD5E1' }}>${p.mrr_usd.toLocaleString()}</Text>
            <Text style={{ flex: 1, fontSize: 8.5, color: '#CBD5E1' }}>{p.users}</Text>
            <Text style={{ flex: 1, fontSize: 8.5, color: '#CBD5E1' }}>${p.cac_spend_usd.toLocaleString()}</Text>
            <Text style={{ flex: 1, fontSize: 8.5, color: balance >= 0 ? colors.green : colors.red, fontFamily: 'Helvetica-Bold' }}>
              {balance >= 0 ? '+' : ''}${balance.toLocaleString()}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Page footer ───────────────────────────────────────────────────────────────

function PageFooter({ name }: { name: string }) {
  return (
    <View style={[styles.footer, { left: 40, right: 40 }]}>
      <Text style={styles.footerText}>ValidateAI · Reporte de Viabilidad Financiera — {name}</Text>
      <Text style={styles.footerText}>Unit Economics & Growth Projection</Text>
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props { data: PDFData }

export function UnitEconomicsPDF({ data }: Props) {
  const fp   = data.financial_projection as FinancialProjection | undefined;
  const ue   = data.unit_economics;
  const name = data.idea_name ?? 'Mi Startup';

  return (
    <Document title={`Viabilidad Financiera — ${name}`} author="ValidateAI" subject="Unit Economics & Growth">
      {/* ── Page 1: Cover + Unit Economics ──────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={[styles.coverHero, { paddingTop: 44, paddingBottom: 36 }]}>
          <View style={styles.coverBadge}>
            <Text>Reporte de Viabilidad Financiera</Text>
          </View>
          <Text style={[styles.coverTitle, { fontSize: 26 }]}>{name}</Text>
          <Text style={styles.coverSubtitle}>Unit Economics · Proyección 12 Meses · Estrategia de Crecimiento</Text>

          <View style={{ flexDirection: 'row', gap: 28, marginTop: 8 }}>
            {fp && (
              <>
                <View>
                  <Text style={styles.coverMetaLabel}>Veredicto</Text>
                  <Text style={[styles.coverMetaValue, { color: verdictColor(fp.model_verdict) }]}>{verdictLabel(fp.model_verdict)}</Text>
                </View>
                <View>
                  <Text style={styles.coverMetaLabel}>Break-even</Text>
                  <Text style={styles.coverMetaValue}>Mes {fp.break_even_month}</Text>
                </View>
                <View>
                  <Text style={styles.coverMetaLabel}>Revenue Año 1</Text>
                  <Text style={styles.coverMetaValue}>${fp.year1_revenue_usd.toLocaleString()} USD</Text>
                </View>
              </>
            )}
            <View>
              <Text style={styles.coverMetaLabel}>Modelo</Text>
              <Text style={styles.coverMetaValue}>{data.business_model?.toUpperCase() ?? '—'}</Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 40, paddingTop: 24 }}>
          {/* Growth strategy */}
          {fp && (
            <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: verdictColor(fp.model_verdict), marginBottom: 16 }]}>
              <Text style={[styles.cardTitle, { color: verdictColor(fp.model_verdict) }]}>
                Estrategia de Crecimiento: {strategyLabel(fp.growth_strategy)}
              </Text>
              <Text style={styles.cardBody}>{fp.strategy_rationale}</Text>
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: colors.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Supuestos clave</Text>
                {fp.key_assumptions.map((a, i) => (
                  <View key={i} style={styles.listItem}>
                    <Text style={[styles.bullet, { color: colors.accent }]}>›</Text>
                    <Text style={[styles.listText, { fontSize: 9 }]}>{a}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Unit Economics cards */}
          {ue && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {[
                { label: 'CAC', val: `$${ue.cac.min}–${ue.cac.max}`, sub: ue.cac.currency, color: colors.red },
                { label: 'LTV', val: `$${ue.ltv.min}–${ue.ltv.max}`, sub: ue.ltv.currency, color: colors.green },
                { label: 'LTV/CAC', val: `${ue.ltvCacRatio.value.toFixed(1)}x`, sub: ue.ltvCacRatio.assessment, color: assessmentColor(ue.ltvCacRatio.assessment) },
                { label: 'Payback', val: `${ue.paybackMonths.min}–${ue.paybackMonths.max}`, sub: 'meses', color: colors.amber },
                { label: 'Break-even', val: `${ue.breakEvenUsers}`, sub: 'usuarios', color: colors.blue },
              ].map(({ label, val, sub, color }) => (
                <View key={label} style={{ flex: 1, backgroundColor: '#1E2B3E', borderRadius: 8, padding: 12, borderTopWidth: 3, borderTopColor: color, alignItems: 'center' }}>
                  <Text style={{ fontSize: 7, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color }}>{val}</Text>
                  <Text style={{ fontSize: 7.5, color: colors.muted, marginTop: 2 }}>{sub}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <PageFooter name={name} />
      </Page>

      {/* ── Page 2: Projection + Charts ──────────────────────────────────────── */}
      {(fp || ue) && (
        <Page size="A4" style={styles.contentPage}>
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>Proyección Financiera</Text>
            <Text style={styles.pageLabel}>12 Meses</Text>
          </View>

          {fp && fp.monthly_projection.length > 0 && (
            <MrrChart projection={fp.monthly_projection} />
          )}

          <View style={{ flexDirection: 'row', gap: 20 }}>
            {ue && (
              <View style={{ flex: 1 }}>
                <CacLtvBars ue={ue} />
                {ue.assumptions.length > 0 && (
                  <View style={{ backgroundColor: '#1E2B3E', borderRadius: 8, padding: 12 }}>
                    <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Supuestos Unit Economics</Text>
                    {ue.assumptions.slice(0, 4).map((a, i) => (
                      <View key={i} style={styles.listItem}>
                        <Text style={[styles.bullet, { color: colors.muted }]}>·</Text>
                        <Text style={[styles.listText, { fontSize: 8.5, color: colors.muted }]}>{a}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {fp && (
              <View style={{ flex: 1 }}>
                <View style={{ backgroundColor: fp.model_verdict === 'strong' ? colors.green + '15' : fp.model_verdict === 'moderate' ? colors.amber + '15' : colors.red + '15', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: verdictColor(fp.model_verdict) + '40' }}>
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: verdictColor(fp.model_verdict), textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Veredicto del Modelo</Text>
                  <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: verdictColor(fp.model_verdict), marginBottom: 8 }}>{verdictLabel(fp.model_verdict)}</Text>
                  <Text style={{ fontSize: 9.5, color: '#CBD5E1', lineHeight: 1.5 }}>{fp.model_verdict_reason}</Text>
                </View>
              </View>
            )}
          </View>

          {fp && fp.monthly_projection.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <CashFlowTable projection={fp.monthly_projection} breakEven={fp.break_even_month} />
            </View>
          )}

          {/* Disclaimer */}
          <View style={{ backgroundColor: '#1A2538', borderRadius: 6, padding: 10, marginTop: 12, borderWidth: 1, borderColor: '#2A3A52' }}>
            <Text style={{ fontSize: 7.5, color: colors.muted, lineHeight: 1.5, textAlign: 'center' }}>
              ⚠ Proyecciones generadas por IA basadas en benchmarks sectoriales 2024. No constituyen una garantía de resultados. Los valores reales dependerán de la ejecución, el mercado y factores externos.
            </Text>
          </View>

          <PageFooter name={name} />
        </Page>
      )}
    </Document>
  );
}
