import { Document, Page, View, Text } from '@react-pdf/renderer';
import { styles, colors } from './pdfStyles';
import type { PDFData } from '@/lib/pdf';
import type { PitchDeckContent, MarketSizing, UnitEconomics } from '@/types/validation';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatMarket(sizing: MarketSizing | null | undefined): string {
  if (!sizing) return 'Pendiente de análisis';
  const { tam, sam, som } = sizing;
  const fmt = (v: number) => v >= 1_000_000_000
    ? `${(v / 1_000_000_000).toFixed(1)}B`
    : `${(v / 1_000_000).toFixed(0)}M`;
  return `TAM ${fmt(tam.value_high)} · SAM ${fmt(sam.value_high)} · SOM ${fmt(som.value_high)} ${tam.currency}`;
}

function formatUnitEcon(ue: UnitEconomics | null | undefined): string {
  if (!ue) return 'Pendiente de análisis';
  const cac = `CAC $${ue.cac.min}–${ue.cac.max} ${ue.cac.currency}`;
  const ltv = `LTV $${ue.ltv.min}–${ue.ltv.max} ${ue.ltv.currency}`;
  return `${cac} · ${ltv} · Ratio ${ue.ltvCacRatio.value.toFixed(1)}x`;
}

// ── Slide shell ────────────────────────────────────────────────────────────────

function Slide({
  number,
  label,
  children,
}: {
  number: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Page size="A4" orientation="landscape" style={styles.page}>
      {/* Slide number badge */}
      <View style={{ position: 'absolute', top: 18, right: 32, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 7, color: colors.muted, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, textTransform: 'uppercase' }}>
          {label}
        </Text>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 9, color: colors.white, fontFamily: 'Helvetica-Bold' }}>{number}</Text>
        </View>
      </View>

      {/* Content area */}
      <View style={{ flex: 1, paddingTop: 40, paddingHorizontal: 48, paddingBottom: 36 }}>
        {children}
      </View>

      {/* Footer */}
      <View style={[styles.footer, { left: 48, right: 48 }]}>
        <Text style={styles.footerText}>ValidateAI · Pitch Deck</Text>
        <Text style={styles.footerText}>Confidencial — Pre-Seed/Seed</Text>
      </View>
    </Page>
  );
}

function SlideTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: colors.accent, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
      {children}
    </Text>
  );
}

function Headline({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: 28, fontFamily: 'Helvetica-Bold', color: colors.white, lineHeight: 1.2, marginBottom: 16 }}>
      {children}
    </Text>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.6 }}>
      {children}
    </Text>
  );
}

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ backgroundColor: color + '22', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 8 }}>
      <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color }}>{text}</Text>
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={{ marginTop: 8 }}>
      {items.map((item, i) => (
        <View key={i} style={[styles.listItem, { marginBottom: 8 }]}>
          <Text style={[styles.bullet, { fontSize: 11 }]}>›</Text>
          <Text style={[styles.listText, { fontSize: 11 }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  data: PDFData;
}

export function PitchDeckOutline({ data }: Props) {
  const deck = data.pitch_deck_content as PitchDeckContent | undefined;
  const name = data.idea_name ?? 'Mi Startup';
  const score = data.validation_score ?? 0;

  const slides = [
    // 1 — Title & Hook
    <Slide key={1} number={1} label="Title">
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Pill text={data.idea_industry?.toUpperCase() ?? 'STARTUP'} color={colors.accent} />
        <Headline>{name}</Headline>
        <Body>{deck?.hook ?? data.value_proposition ?? '—'}</Body>
        <View style={{ flexDirection: 'row', gap: 24, marginTop: 28 }}>
          {data.target_country && (
            <View>
              <Text style={{ fontSize: 8, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Mercado</Text>
              <Text style={{ fontSize: 12, color: colors.white, fontFamily: 'Helvetica-Bold', marginTop: 3 }}>{data.target_country}</Text>
            </View>
          )}
          {data.business_model && (
            <View>
              <Text style={{ fontSize: 8, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Modelo</Text>
              <Text style={{ fontSize: 12, color: colors.white, fontFamily: 'Helvetica-Bold', marginTop: 3 }}>{data.business_model.toUpperCase()}</Text>
            </View>
          )}
          {score > 0 && (
            <View>
              <Text style={{ fontSize: 8, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Score ValidateAI</Text>
              <Text style={{ fontSize: 12, color: score >= 70 ? colors.green : score >= 40 ? colors.amber : colors.red, fontFamily: 'Helvetica-Bold', marginTop: 3 }}>{score}/100</Text>
            </View>
          )}
        </View>
      </View>
    </Slide>,

    // 2 — The Problem
    <Slide key={2} number={2} label="Problem">
      <SlideTitle>El Problema</SlideTitle>
      <View style={{ flexDirection: 'row', gap: 32 }}>
        <View style={{ flex: 1 }}>
          <Body>{deck?.problem_statement ?? '—'}</Body>
        </View>
        {(data.customer_pain_points?.length ?? 0) > 0 && (
          <View style={{ flex: 1, backgroundColor: '#1E2B3E', borderRadius: 8, padding: 16, borderLeftWidth: 3, borderLeftColor: colors.red }}>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: colors.red, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Pain Points</Text>
            <BulletList items={(data.customer_pain_points ?? []).slice(0, 4)} />
          </View>
        )}
      </View>
    </Slide>,

    // 3 — The Solution
    <Slide key={3} number={3} label="Solution">
      <SlideTitle>La Solución</SlideTitle>
      <View style={{ flexDirection: 'row', gap: 32, marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <Body>{deck?.solution_statement ?? data.idea_description ?? '—'}</Body>
          {data.differentiator && (
            <View style={{ marginTop: 16, backgroundColor: colors.accent + '18', borderRadius: 8, padding: 12, borderLeftWidth: 3, borderLeftColor: colors.accent }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: colors.accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Diferenciador</Text>
              <Text style={{ fontSize: 10, color: '#CBD5E1', lineHeight: 1.5 }}>{data.differentiator}</Text>
            </View>
          )}
        </View>
        {data.mvp_features && data.mvp_features.length > 0 && (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Funcionalidades MVP</Text>
            {data.mvp_features.slice(0, 4).map((f, i) => (
              <View key={i} style={{ backgroundColor: '#1E2B3E', borderRadius: 6, padding: 10, marginBottom: 8 }}>
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: colors.white, marginBottom: 3 }}>{f.name}</Text>
                <Text style={{ fontSize: 9, color: colors.muted, lineHeight: 1.4 }}>{f.description}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Slide>,

    // 4 — Market Size
    <Slide key={4} number={4} label="Market">
      <SlideTitle>Tamaño de Mercado</SlideTitle>
      <Body>{deck?.market_size_narrative ?? '—'}</Body>
      {data.market_sizing && (
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 24 }}>
          {[
            { label: 'TAM', tier: data.market_sizing.tam, color: colors.blue },
            { label: 'SAM', tier: data.market_sizing.sam, color: colors.accent },
            { label: 'SOM', tier: data.market_sizing.som, color: colors.green },
          ].map(({ label, tier, color }) => (
            <View key={label} style={{ flex: 1, backgroundColor: '#1E2B3E', borderRadius: 8, padding: 16, borderTopWidth: 3, borderTopColor: color }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>{label}</Text>
              <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: colors.white, marginBottom: 4 }}>
                {tier.currency} {(tier.value_high / 1_000_000).toFixed(0)}M
              </Text>
              <Text style={{ fontSize: 8.5, color: colors.muted, lineHeight: 1.4 }}>{tier.description}</Text>
            </View>
          ))}
        </View>
      )}
      {!data.market_sizing && (
        <Text style={{ fontSize: 10, color: colors.muted, marginTop: 12 }}>{formatMarket(data.market_sizing)}</Text>
      )}
    </Slide>,

    // 5 — Business Model
    <Slide key={5} number={5} label="Business Model">
      <SlideTitle>Modelo de Negocio</SlideTitle>
      <View style={{ flexDirection: 'row', gap: 32 }}>
        <View style={{ flex: 1 }}>
          <Body>{deck?.business_model_narrative ?? '—'}</Body>
          <View style={{ marginTop: 16 }}>
            {data.pricing_range && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#2A3A52', paddingVertical: 8 }}>
                <Text style={{ fontSize: 10, color: colors.muted }}>Precio</Text>
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: colors.white }}>{data.pricing_range}</Text>
              </View>
            )}
            {data.business_model && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#2A3A52', paddingVertical: 8 }}>
                <Text style={{ fontSize: 10, color: colors.muted }}>Modelo</Text>
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: colors.white }}>{data.business_model.toUpperCase()}</Text>
              </View>
            )}
          </View>
        </View>
        {data.unit_economics && (
          <View style={{ flex: 1, backgroundColor: '#1E2B3E', borderRadius: 8, padding: 16 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: colors.amber, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Unit Economics</Text>
            <Text style={{ fontSize: 10, color: colors.muted, marginBottom: 4 }}>CAC: <Text style={{ color: colors.white, fontFamily: 'Helvetica-Bold' }}>${data.unit_economics.cac.min}–{data.unit_economics.cac.max} {data.unit_economics.cac.currency}</Text></Text>
            <Text style={{ fontSize: 10, color: colors.muted, marginBottom: 4 }}>LTV: <Text style={{ color: colors.white, fontFamily: 'Helvetica-Bold' }}>${data.unit_economics.ltv.min}–{data.unit_economics.ltv.max} {data.unit_economics.ltv.currency}</Text></Text>
            <Text style={{ fontSize: 10, color: colors.muted, marginBottom: 4 }}>Ratio LTV/CAC: <Text style={{ color: data.unit_economics.ltvCacRatio.assessment === 'viable' ? colors.green : colors.amber, fontFamily: 'Helvetica-Bold' }}>{data.unit_economics.ltvCacRatio.value.toFixed(1)}x</Text></Text>
            <Text style={{ fontSize: 10, color: colors.muted }}>Payback: <Text style={{ color: colors.white, fontFamily: 'Helvetica-Bold' }}>{data.unit_economics.paybackMonths.min}–{data.unit_economics.paybackMonths.max} meses</Text></Text>
          </View>
        )}
        {!data.unit_economics && (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, color: colors.muted }}>{formatUnitEcon(data.unit_economics)}</Text>
          </View>
        )}
      </View>
    </Slide>,

    // 6 — Unfair Advantage
    <Slide key={6} number={6} label="Moat">
      <SlideTitle>Ventaja Competitiva</SlideTitle>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ backgroundColor: colors.accent + '15', borderRadius: 12, padding: 24, borderWidth: 1, borderColor: colors.accent + '40', marginBottom: 20 }}>
          <Body>{deck?.unfair_advantage ?? data.differentiator ?? '—'}</Body>
        </View>
        {data.competitive_analysis?.competitive_advantage_suggestion && (
          <View style={{ backgroundColor: '#1E2B3E', borderRadius: 8, padding: 16 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Oportunidad de Mercado</Text>
            <Text style={{ fontSize: 10, color: '#CBD5E1', lineHeight: 1.5 }}>{data.competitive_analysis.competitive_advantage_suggestion}</Text>
          </View>
        )}
      </View>
    </Slide>,

    // 7 — Traction & Roadmap
    <Slide key={7} number={7} label="Traction">
      <SlideTitle>Tracción & Roadmap</SlideTitle>
      <View style={{ flexDirection: 'row', gap: 32 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: colors.white, marginBottom: 12 }}>Hitos</Text>
          {(deck?.traction_milestones?.length ?? 0) > 0
            ? <BulletList items={deck!.traction_milestones} />
            : <Text style={{ fontSize: 10, color: colors.muted }}>Design Partners · LOIs · Beta users</Text>
          }
        </View>
        {data.fundraising_roadmap?.next_milestones && data.fundraising_roadmap.next_milestones.length > 0 && (
          <View style={{ flex: 1, backgroundColor: '#1E2B3E', borderRadius: 8, padding: 16 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: colors.green, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Próximos Hitos</Text>
            <BulletList items={data.fundraising_roadmap.next_milestones.slice(0, 4)} />
          </View>
        )}
      </View>
    </Slide>,

    // 8 — The Ask
    <Slide key={8} number={8} label="The Ask">
      <SlideTitle>La Solicitud</SlideTitle>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ backgroundColor: '#1E2B3E', borderRadius: 12, padding: 28, borderWidth: 1, borderColor: colors.accent + '40', marginBottom: 20 }}>
          <Body>{deck?.the_ask ?? '—'}</Body>
        </View>
        {data.fundraising_roadmap && (
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 1, backgroundColor: colors.accent + '15', borderRadius: 8, padding: 14, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Instrumento</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: colors.white }}>
                {data.fundraising_roadmap.recommended_instrument?.replace(/_/g, ' ').toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.accent + '15', borderRadius: 8, padding: 14, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Ticket</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: colors.white }}>
                ${(data.fundraising_roadmap.suggested_ticket_size.min / 1000).toFixed(0)}K–${(data.fundraising_roadmap.suggested_ticket_size.max / 1000).toFixed(0)}K {data.fundraising_roadmap.suggested_ticket_size.currency}
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.accent + '15', borderRadius: 8, padding: 14, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Readiness</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: data.fundraising_roadmap.readiness_score >= 60 ? colors.green : colors.amber }}>
                {data.fundraising_roadmap.readiness_score}/100
              </Text>
            </View>
          </View>
        )}
      </View>
    </Slide>,
  ];

  return (
    <Document
      title={`Pitch Deck — ${name}`}
      author="ValidateAI"
      subject="Investor Pitch Deck"
    >
      {slides}
    </Document>
  );
}
