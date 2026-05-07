import { Document, Page, View, Text, Svg, Rect } from '@react-pdf/renderer';
import { styles, colors } from './pdfStyles';
import type { PDFData } from '@/lib/pdf';
import type { LeanRoadmap, LeanSprint } from '@/types/validation';

// ── Helpers ────────────────────────────────────────────────────────────────────

function approachLabel(a: LeanRoadmap['architecture_approach']): { label: string; color: string } {
  if (a === 'no_code')  return { label: 'No-Code',  color: colors.green };
  if (a === 'low_code') return { label: 'Low-Code', color: colors.amber };
  return                       { label: 'Full Code', color: colors.blue };
}

function priorityColor(i: number): string {
  return [colors.red, colors.amber, colors.blue][i % 3];
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PageFooter({ name }: { name: string }) {
  return (
    <View style={[styles.footer, { left: 40, right: 40 }]}>
      <Text style={styles.footerText}>ValidateAI · Lean Roadmap — {name}</Text>
      <Text style={styles.footerText}>Documento táctico de ejecución MVP</Text>
    </View>
  );
}

function SprintCard({ sprint, index }: { sprint: LeanSprint; index: number }) {
  const accent = priorityColor(index);
  return (
    <View style={{ backgroundColor: '#1E2B3E', borderRadius: 8, borderLeftWidth: 4, borderLeftColor: accent, padding: 16, marginBottom: 14 }}>
      {/* Header row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#fff' }}>{index + 1}</Text>
          </View>
          <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: colors.white }}>{sprint.name}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ backgroundColor: accent + '22', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: accent }}>{sprint.duration_weeks} sem.</Text>
          </View>
          <View style={{ backgroundColor: '#2A3A52', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontSize: 8, color: colors.muted }}>{sprint.stack}</Text>
          </View>
        </View>
      </View>

      {/* Goal */}
      <View style={{ backgroundColor: '#0F1728', borderRadius: 6, padding: 8, marginBottom: 10 }}>
        <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>Objetivo del Sprint</Text>
        <Text style={{ fontSize: 9.5, color: '#CBD5E1', lineHeight: 1.5 }}>{sprint.goal}</Text>
      </View>

      {/* Two columns */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: colors.green, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Must Have</Text>
          {sprint.must_haves.map((f, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={[styles.bullet, { color: colors.green }]}>✓</Text>
              <Text style={[styles.listText, { fontSize: 9 }]}>{f}</Text>
            </View>
          ))}
        </View>
        {sprint.nice_to_haves.length > 0 && (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Nice to Have</Text>
            {sprint.nice_to_haves.map((f, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={[styles.bullet, { color: colors.muted }]}>○</Text>
                <Text style={[styles.listText, { fontSize: 9, color: colors.muted }]}>{f}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ── Progress bar (SVG) ────────────────────────────────────────────────────────

function TimelineBar({ sprints, total }: { sprints: LeanSprint[]; total: number }) {
  const W = 460;
  const H = 28;
  const barColors = [colors.red, colors.amber, colors.blue];
  let x = 0;
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
        Timeline — {total} semanas totales
      </Text>
      <Svg width={W} height={H}>
        {sprints.map((s, i) => {
          const w = (s.duration_weeks / total) * W;
          const bar = (
            <Rect key={i} x={x} y={0} width={w - 2} height={H} rx={4} fill={barColors[i % 3]} fillOpacity={0.85} />
          );
          x += w;
          return bar;
        })}
      </Svg>
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        {sprints.map((s, i) => (
          <View key={i} style={{ flex: s.duration_weeks, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: barColors[i % 3] }} />
            <Text style={{ fontSize: 7.5, color: colors.muted }}>{s.name.split('—')[0].trim()}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props { data: PDFData }

export function LeanRoadmapPDF({ data }: Props) {
  const roadmap = data.lean_roadmap as LeanRoadmap | undefined;
  const name    = data.idea_name ?? 'Mi Startup';

  if (!roadmap) return (
    <Document title={`Lean Roadmap — ${name}`} author="ValidateAI">
      <Page size="A4" style={styles.contentPage}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>No hay datos de Lean Roadmap disponibles.</Text>
        <PageFooter name={name} />
      </Page>
    </Document>
  );

  const approach = approachLabel(roadmap.architecture_approach);

  return (
    <Document title={`Lean Roadmap — ${name}`} author="ValidateAI" subject="Plan de Ejecución MVP">
      {/* ── Page 1: Cover + Context ─────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        {/* Hero */}
        <View style={[styles.coverHero, { paddingTop: 44, paddingBottom: 36 }]}>
          <View style={[styles.coverBadge, { backgroundColor: approach.color }]}>
            <Text>Lean Roadmap · {approach.label}</Text>
          </View>
          <Text style={[styles.coverTitle, { fontSize: 26 }]}>{name}</Text>
          <Text style={styles.coverSubtitle}>Plan táctico de ejecución MVP · {roadmap.total_weeks} semanas estimadas</Text>

          <View style={{ flexDirection: 'row', gap: 28, marginTop: 8 }}>
            <View>
              <Text style={styles.coverMetaLabel}>Arquitectura</Text>
              <Text style={[styles.coverMetaValue, { color: approach.color }]}>{approach.label}</Text>
            </View>
            <View>
              <Text style={styles.coverMetaLabel}>Sprints</Text>
              <Text style={styles.coverMetaValue}>{roadmap.sprints.length}</Text>
            </View>
            <View>
              <Text style={styles.coverMetaLabel}>Costo estimado MVP</Text>
              <Text style={styles.coverMetaValue}>${roadmap.mvp_cost_usd.min}–${roadmap.mvp_cost_usd.max} USD</Text>
            </View>
            <View>
              <Text style={styles.coverMetaLabel}>Industria</Text>
              <Text style={styles.coverMetaValue}>{data.idea_industry ?? '—'}</Text>
            </View>
          </View>
        </View>

        {/* Rationale */}
        <View style={{ paddingHorizontal: 40, paddingTop: 24 }}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Justificación Arquitectónica</Text>
            <Text style={styles.cardBody}>{roadmap.rationale}</Text>
          </View>

          {/* Tools */}
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Stack & Herramientas Recomendadas</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {roadmap.recommended_tools.map((t, i) => (
                <View key={i} style={{ backgroundColor: colors.accent + '22', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: colors.accent }}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <PageFooter name={name} />
      </Page>

      {/* ── Page 2: Sprints ─────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.contentPage}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Plan de Ejecución por Sprints</Text>
          <Text style={styles.pageLabel}>Lean Roadmap</Text>
        </View>

        <TimelineBar sprints={roadmap.sprints} total={roadmap.total_weeks} />

        {roadmap.sprints.map((sprint, i) => (
          <SprintCard key={i} sprint={sprint} index={i} />
        ))}

        {/* Disclaimer */}
        <View style={{ backgroundColor: '#1A2538', borderRadius: 6, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#2A3A52' }}>
          <Text style={{ fontSize: 7.5, color: colors.muted, lineHeight: 1.5, textAlign: 'center' }}>
            ⚠ Plan generado por IA como referencia estratégica. Los tiempos y costos son estimaciones sujetas al contexto específico del equipo. No constituye un compromiso contractual.
          </Text>
        </View>

        <PageFooter name={name} />
      </Page>
    </Document>
  );
}
