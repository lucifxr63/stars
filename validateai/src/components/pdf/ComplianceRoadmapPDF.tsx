import { Document, Page, View, Text } from '@react-pdf/renderer';
import { styles, colors } from './pdfStyles';
import type { PDFData } from '@/lib/pdf';
import type { ComplianceRoadmap, ComplianceLaw } from '@/types/validation';

// ── Helpers ────────────────────────────────────────────────────────────────────

function riskColor(r: 'high' | 'medium' | 'low'): string {
  if (r === 'high')   return colors.red;
  if (r === 'medium') return colors.amber;
  return colors.green;
}

function riskLabel(r: 'high' | 'medium' | 'low'): string {
  if (r === 'high')   return 'RIESGO ALTO';
  if (r === 'medium') return 'RIESGO MEDIO';
  return 'RIESGO BAJO';
}

function priorityColor(p: 'critical' | 'important' | 'nice_to_have'): string {
  if (p === 'critical')  return colors.red;
  if (p === 'important') return colors.amber;
  return colors.muted;
}

function priorityLabel(p: 'critical' | 'important' | 'nice_to_have'): string {
  if (p === 'critical')  return 'CRÍTICO';
  if (p === 'important') return 'IMPORTANTE';
  return 'OPCIONAL';
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PageFooter({ name }: { name: string }) {
  return (
    <View style={[styles.footer, { left: 40, right: 40 }]}>
      <Text style={styles.footerText}>ValidateAI · Roadmap Regulatorio — {name}</Text>
      <Text style={styles.footerText}>Chile · Legal &amp; Compliance</Text>
    </View>
  );
}

function SectionHeader({ number, title, color }: { number: string; title: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, marginTop: 4 }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#fff' }}>{number}</Text>
      </View>
      <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: colors.white }}>{title}</Text>
    </View>
  );
}

function LawCard({ law }: { law: ComplianceLaw }) {
  const c = riskColor(law.risk_level);
  return (
    <View style={{ backgroundColor: '#1E2B3E', borderRadius: 8, borderLeftWidth: 4, borderLeftColor: c, padding: 14, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <Text style={{ flex: 1, fontSize: 10, fontFamily: 'Helvetica-Bold', color: colors.white, marginRight: 8 }}>{law.law}</Text>
        <View style={{ backgroundColor: c + '22', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: c }}>{riskLabel(law.risk_level)}</Text>
        </View>
      </View>
      <Text style={{ fontSize: 9, color: '#CBD5E1', lineHeight: 1.5, marginBottom: 6 }}>{law.description}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
        <Text style={{ fontSize: 9, color: colors.accent, fontFamily: 'Helvetica-Bold' }}>→</Text>
        <Text style={{ fontSize: 9, color: colors.accent, flex: 1, lineHeight: 1.4 }}>{law.action_required}</Text>
      </View>
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props { data: PDFData }

export function ComplianceRoadmapPDF({ data }: Props) {
  const roadmap = data.compliance_roadmap as ComplianceRoadmap | undefined;
  const name    = data.idea_name ?? 'Mi Startup';

  if (!roadmap) return (
    <Document title={`Compliance Roadmap — ${name}`} author="ValidateAI">
      <Page size="A4" style={styles.contentPage}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>No hay datos de Compliance disponibles.</Text>
        <PageFooter name={name} />
      </Page>
    </Document>
  );

  const overallColor = riskColor(roadmap.overall_risk_level);

  return (
    <Document title={`Compliance Roadmap — ${name}`} author="ValidateAI" subject="Legal & Compliance Chile">
      {/* ── Page 1: Cover + Constitution ────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        {/* Hero */}
        <View style={[styles.coverHero, { paddingTop: 44, paddingBottom: 36 }]}>
          <View style={[styles.coverBadge, { backgroundColor: overallColor }]}>
            <Text>Roadmap Legal · Chile · {riskLabel(roadmap.overall_risk_level)}</Text>
          </View>
          <Text style={[styles.coverTitle, { fontSize: 26 }]}>{name}</Text>
          <Text style={styles.coverSubtitle}>Constitución Societaria · Normativas · Pacto de Accionistas</Text>

          <View style={{ flexDirection: 'row', gap: 28, marginTop: 8 }}>
            <View>
              <Text style={styles.coverMetaLabel}>Estructura recomendada</Text>
              <Text style={styles.coverMetaValue}>{roadmap.constitution.recommended_entity}</Text>
            </View>
            <View>
              <Text style={styles.coverMetaLabel}>Costo constitución</Text>
              <Text style={styles.coverMetaValue}>{roadmap.constitution.estimated_cost_clp === 0 ? 'Gratuito' : `$${roadmap.constitution.estimated_cost_clp.toLocaleString('es-CL')} CLP`}</Text>
            </View>
            <View>
              <Text style={styles.coverMetaLabel}>Leyes aplicables</Text>
              <Text style={styles.coverMetaValue}>{roadmap.regulatory.applicable_laws.length}</Text>
            </View>
            <View>
              <Text style={styles.coverMetaLabel}>Nivel de riesgo</Text>
              <Text style={[styles.coverMetaValue, { color: overallColor }]}>{roadmap.overall_risk_level.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 40, paddingTop: 24 }}>
          {/* Risk rationale */}
          <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: overallColor, marginBottom: 20 }]}>
            <Text style={[styles.cardTitle, { color: overallColor }]}>Evaluación de Riesgo Regulatorio</Text>
            <Text style={styles.cardBody}>{roadmap.risk_rationale}</Text>
          </View>

          {/* Section 1: Constitution */}
          <SectionHeader number="1" title="Constitución Societaria" color={colors.accent} />
          <View style={styles.card}>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: colors.white, marginBottom: 8 }}>
              {roadmap.constitution.recommended_entity}
            </Text>
            {roadmap.constitution.steps.map((step, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent + '33', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: colors.accent }}>{i + 1}</Text>
                </View>
                <Text style={{ flex: 1, fontSize: 9.5, color: '#CBD5E1', lineHeight: 1.5 }}>{step}</Text>
              </View>
            ))}
            {roadmap.constitution.notes && (
              <View style={{ backgroundColor: '#0F1728', borderRadius: 6, padding: 8, marginTop: 8 }}>
                <Text style={{ fontSize: 9, color: colors.muted, lineHeight: 1.4 }}>{roadmap.constitution.notes}</Text>
              </View>
            )}
          </View>
        </View>

        <PageFooter name={name} />
      </Page>

      {/* ── Page 2: Regulatory ──────────────────────────────────────────────── */}
      <Page size="A4" style={styles.contentPage}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Normativas Aplicables</Text>
          <Text style={styles.pageLabel}>Chile</Text>
        </View>

        <SectionHeader number="2" title="Marco Regulatorio" color={colors.amber} />

        {roadmap.regulatory.applicable_laws.map((law, i) => (
          <LawCard key={i} law={law} />
        ))}

        {/* Checklist */}
        {roadmap.regulatory.checklist.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Checklist de Cumplimiento
            </Text>
            {roadmap.regulatory.checklist.map((item, i) => {
              const pc = priorityColor(item.priority);
              return (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8, paddingBottom: 8, borderBottomWidth: i < roadmap.regulatory.checklist.length - 1 ? 1 : 0, borderBottomColor: '#2A3A52' }}>
                  <View style={{ backgroundColor: pc + '22', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 1 }}>
                    <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: pc }}>{priorityLabel(item.priority)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: colors.white, marginBottom: 2 }}>{item.item}</Text>
                    <Text style={{ fontSize: 9, color: '#CBD5E1', lineHeight: 1.4 }}>{item.description}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <PageFooter name={name} />
      </Page>

      {/* ── Page 3: Shareholders ────────────────────────────────────────────── */}
      <Page size="A4" style={styles.contentPage}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Pacto de Accionistas</Text>
          <Text style={styles.pageLabel}>Gobernanza</Text>
        </View>

        <SectionHeader number="3" title="Estructura de Equity y Vesting" color={colors.blue} />

        <View style={[styles.card, { marginBottom: 16 }]}>
          <Text style={styles.cardTitle}>Recomendación de Vesting</Text>
          <Text style={[styles.cardBody, { fontSize: 11, fontFamily: 'Helvetica-Bold', color: colors.white, marginBottom: 8 }]}>
            {roadmap.shareholders.vesting_recommendation}
          </Text>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
            <View style={{ flex: 1, backgroundColor: '#0F1728', borderRadius: 8, padding: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 8, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Cliff</Text>
              <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: colors.blue }}>{roadmap.shareholders.cliff_months}</Text>
              <Text style={{ fontSize: 8, color: colors.muted }}>meses</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#0F1728', borderRadius: 8, padding: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 8, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Drag-along</Text>
              <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: roadmap.shareholders.drag_along ? colors.green : colors.red }}>
                {roadmap.shareholders.drag_along ? 'SÍ' : 'NO'}
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#0F1728', borderRadius: 8, padding: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 8, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Tag-along</Text>
              <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: roadmap.shareholders.tag_along ? colors.green : colors.red }}>
                {roadmap.shareholders.tag_along ? 'SÍ' : 'NO'}
              </Text>
            </View>
          </View>
          {roadmap.shareholders.notes && (
            <View style={{ backgroundColor: '#0F1728', borderRadius: 6, padding: 10, marginTop: 12 }}>
              <Text style={{ fontSize: 9, color: colors.muted, lineHeight: 1.5 }}>{roadmap.shareholders.notes}</Text>
            </View>
          )}
        </View>

        {/* Legal disclaimer */}
        <View style={{ backgroundColor: colors.amber + '15', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: colors.amber + '40', marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Text style={{ fontSize: 14 }}>⚠️</Text>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: colors.amber }}>Aviso Legal Importante</Text>
          </View>
          <Text style={{ fontSize: 9, color: '#CBD5E1', lineHeight: 1.6 }}>
            Este documento es una <Text style={{ fontFamily: 'Helvetica-Bold', color: colors.white }}>recomendación estratégica generada por Inteligencia Artificial</Text> para orientar decisiones de planificación. No constituye asesoría legal formal ni reemplaza la consulta con un abogado especializado en derecho societario y regulatorio chileno. ValidateAI no asume responsabilidad por decisiones tomadas basándose exclusivamente en este reporte.
          </Text>
        </View>

        <PageFooter name={name} />
      </Page>
    </Document>
  );
}
