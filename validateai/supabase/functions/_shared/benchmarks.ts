// Benchmarks sectoriales y multiplicadores de CAC, extraídos de ai-validate (#5 W1).
// Datos puros (byte-identical, verificado por golden hash).

export const CAC_MULTIPLIERS_BY_CHANNEL: Record<string, {
  multiplier_vs_benchmark: number;
  note: string;
}> = {
  outbound_linkedin: { multiplier_vs_benchmark: 1.4, note: 'Outbound B2B — CAC alto, leads calificados, ciclos 30-90 días' },
  ads_meta:          { multiplier_vs_benchmark: 1.1, note: 'Publicidad pagada — CAC moderado, escalable, sensible al CPM' },
  comunidades_organico: { multiplier_vs_benchmark: 0.4, note: 'Comunidades orgánicas — CAC muy bajo, lento, difícil de escalar' },
  referidos:         { multiplier_vs_benchmark: 0.3, note: 'Referidos/WOM — CAC más bajo, requiere NPS>50' },
  alianzas:          { multiplier_vs_benchmark: 0.7, note: 'Alianzas — CAC compartido con el socio, margen reducido' },
  contenido_seo:     { multiplier_vs_benchmark: 0.5, note: 'Contenido/SEO — CAC bajo a largo plazo, ramp-up 6-18 meses' },
  eventos_presencial: { multiplier_vs_benchmark: 1.2, note: 'Eventos presenciales — efectivo B2B complejo, CAC moderado-alto' },
};

// ── Sector benchmarks (CAC / LTV / churn medians by industry + model) ────────
// Source: Profitwell 2024, ChartMogul Benchmarks 2024, OpenView SaaS 2024
// All values in USD unless noted. Updated: 2026-05.
export const SECTOR_BENCHMARKS: Record<string, Record<string, {
  cac_usd: { min: number; max: number };
  ltv_usd: { min: number; max: number };
  monthly_churn_pct: { min: number; max: number };
  payback_months: { min: number; max: number };
  gross_margin_pct: number;
  note: string;
}>> = {
  saas: {
    b2b: { cac_usd: { min: 200, max: 800 }, ltv_usd: { min: 1500, max: 6000 }, monthly_churn_pct: { min: 1, max: 4 }, payback_months: { min: 6, max: 18 }, gross_margin_pct: 75, note: 'B2B SaaS mediana 2024 â€” ChartMogul' },
    b2c: { cac_usd: { min: 20, max: 80 }, ltv_usd: { min: 80, max: 400 }, monthly_churn_pct: { min: 3, max: 8 }, payback_months: { min: 3, max: 12 }, gross_margin_pct: 70, note: 'B2C SaaS mediana 2024 â€” Profitwell' },
    default: { cac_usd: { min: 100, max: 500 }, ltv_usd: { min: 500, max: 3000 }, monthly_churn_pct: { min: 2, max: 6 }, payback_months: { min: 4, max: 15 }, gross_margin_pct: 72, note: 'SaaS genÃ©rico â€” benchmark promedio 2024' },
  },
  fintech: {
    b2b: { cac_usd: { min: 400, max: 1200 }, ltv_usd: { min: 3000, max: 15000 }, monthly_churn_pct: { min: 0.5, max: 2 }, payback_months: { min: 8, max: 24 }, gross_margin_pct: 55, note: 'Fintech B2B â€” altos costos de compliance y onboarding' },
    b2c: { cac_usd: { min: 30, max: 120 }, ltv_usd: { min: 150, max: 800 }, monthly_churn_pct: { min: 2, max: 7 }, payback_months: { min: 4, max: 14 }, gross_margin_pct: 45, note: 'Fintech B2C LATAM â€” benchmark Kushki/Fintual 2023' },
    default: { cac_usd: { min: 100, max: 600 }, ltv_usd: { min: 500, max: 5000 }, monthly_churn_pct: { min: 1, max: 5 }, payback_months: { min: 6, max: 20 }, gross_margin_pct: 50, note: 'Fintech genÃ©rico LATAM' },
  },
  edtech: {
    b2b: { cac_usd: { min: 300, max: 900 }, ltv_usd: { min: 2000, max: 8000 }, monthly_churn_pct: { min: 1, max: 3 }, payback_months: { min: 6, max: 15 }, gross_margin_pct: 65, note: 'EdTech B2B â€” ventas institucionales (colegios, empresas)' },
    b2c: { cac_usd: { min: 15, max: 60 }, ltv_usd: { min: 60, max: 300 }, monthly_churn_pct: { min: 5, max: 12 }, payback_months: { min: 2, max: 8 }, gross_margin_pct: 68, note: 'EdTech B2C LATAM â€” churn alto en primeros 3 meses' },
    default: { cac_usd: { min: 50, max: 300 }, ltv_usd: { min: 200, max: 1500 }, monthly_churn_pct: { min: 3, max: 9 }, payback_months: { min: 3, max: 12 }, gross_margin_pct: 66, note: 'EdTech genÃ©rico' },
  },
  healthtech: {
    b2b: { cac_usd: { min: 500, max: 2000 }, ltv_usd: { min: 5000, max: 30000 }, monthly_churn_pct: { min: 0.5, max: 1.5 }, payback_months: { min: 12, max: 36 }, gross_margin_pct: 60, note: 'HealthTech B2B â€” ciclos de venta largos (6-18 meses)' },
    b2c: { cac_usd: { min: 40, max: 150 }, ltv_usd: { min: 200, max: 1000 }, monthly_churn_pct: { min: 3, max: 8 }, payback_months: { min: 5, max: 15 }, gross_margin_pct: 55, note: 'HealthTech B2C â€” retenciÃ³n alta si genera resultados' },
    default: { cac_usd: { min: 150, max: 800 }, ltv_usd: { min: 800, max: 8000 }, monthly_churn_pct: { min: 1, max: 6 }, payback_months: { min: 8, max: 24 }, gross_margin_pct: 57, note: 'HealthTech genÃ©rico' },
  },
  ecommerce: {
    b2c: { cac_usd: { min: 10, max: 50 }, ltv_usd: { min: 50, max: 350 }, monthly_churn_pct: { min: 5, max: 15 }, payback_months: { min: 1, max: 6 }, gross_margin_pct: 35, note: 'E-commerce B2C â€” mÃ¡rgenes bajos, volumen necesario' },
    marketplace: { cac_usd: { min: 20, max: 80 }, ltv_usd: { min: 100, max: 600 }, monthly_churn_pct: { min: 4, max: 10 }, payback_months: { min: 2, max: 8 }, gross_margin_pct: 30, note: 'Marketplace â€” take rate 10-20%' },
    default: { cac_usd: { min: 15, max: 60 }, ltv_usd: { min: 60, max: 400 }, monthly_churn_pct: { min: 5, max: 12 }, payback_months: { min: 2, max: 7 }, gross_margin_pct: 32, note: 'E-commerce genÃ©rico LATAM' },
  },
  marketplace: {
    default: { cac_usd: { min: 25, max: 100 }, ltv_usd: { min: 120, max: 700 }, monthly_churn_pct: { min: 3, max: 9 }, payback_months: { min: 3, max: 10 }, gross_margin_pct: 30, note: 'Marketplace â€” 2 lados del mercado (supply + demand)' },
  },
  logistics: {
    b2b: { cac_usd: { min: 300, max: 1000 }, ltv_usd: { min: 2500, max: 12000 }, monthly_churn_pct: { min: 1, max: 3 }, payback_months: { min: 8, max: 20 }, gross_margin_pct: 25, note: 'LogÃ­stica B2B â€” mÃ¡rgenes bajos, alto volumen' },
    default: { cac_usd: { min: 100, max: 500 }, ltv_usd: { min: 500, max: 5000 }, monthly_churn_pct: { min: 1.5, max: 4 }, payback_months: { min: 6, max: 18 }, gross_margin_pct: 25, note: 'LogÃ­stica genÃ©rico LATAM' },
  },
  foodtech: {
    b2c: { cac_usd: { min: 8, max: 30 }, ltv_usd: { min: 40, max: 200 }, monthly_churn_pct: { min: 8, max: 20 }, payback_months: { min: 1, max: 5 }, gross_margin_pct: 28, note: 'FoodTech B2C â€” altÃ­simo churn, retention es el reto' },
    b2b: { cac_usd: { min: 200, max: 700 }, ltv_usd: { min: 1500, max: 7000 }, monthly_churn_pct: { min: 1, max: 4 }, payback_months: { min: 5, max: 14 }, gross_margin_pct: 32, note: 'FoodTech B2B (restaurantes, dark kitchens)' },
    default: { cac_usd: { min: 20, max: 200 }, ltv_usd: { min: 80, max: 2000 }, monthly_churn_pct: { min: 4, max: 15 }, payback_months: { min: 2, max: 10 }, gross_margin_pct: 30, note: 'FoodTech genÃ©rico' },
  },
  proptech: {
    b2b: { cac_usd: { min: 400, max: 1500 }, ltv_usd: { min: 3000, max: 20000 }, monthly_churn_pct: { min: 0.5, max: 2 }, payback_months: { min: 10, max: 30 }, gross_margin_pct: 60, note: 'PropTech B2B â€” ciclos largos, alta retenciÃ³n' },
    default: { cac_usd: { min: 100, max: 800 }, ltv_usd: { min: 500, max: 8000 }, monthly_churn_pct: { min: 1, max: 4 }, payback_months: { min: 8, max: 24 }, gross_margin_pct: 55, note: 'PropTech genÃ©rico' },
  },
  social: {
    b2c: { cac_usd: { min: 1, max: 15 }, ltv_usd: { min: 5, max: 80 }, monthly_churn_pct: { min: 10, max: 25 }, payback_months: { min: 1, max: 6 }, gross_margin_pct: 70, note: 'Social B2C â€” monetizaciÃ³n por ads o freemium' },
    default: { cac_usd: { min: 2, max: 20 }, ltv_usd: { min: 10, max: 100 }, monthly_churn_pct: { min: 8, max: 20 }, payback_months: { min: 1, max: 6 }, gross_margin_pct: 65, note: 'Social genÃ©rico' },
  },
  other: {
    b2b: { cac_usd: { min: 200, max: 700 }, ltv_usd: { min: 1200, max: 6000 }, monthly_churn_pct: { min: 1.5, max: 5 }, payback_months: { min: 6, max: 18 }, gross_margin_pct: 55, note: 'B2B genÃ©rico â€” ajustar por sector especÃ­fico' },
    b2c: { cac_usd: { min: 15, max: 80 }, ltv_usd: { min: 60, max: 400 }, monthly_churn_pct: { min: 4, max: 10 }, payback_months: { min: 3, max: 10 }, gross_margin_pct: 50, note: 'B2C genÃ©rico â€” ajustar por producto y precio' },
    default: { cac_usd: { min: 50, max: 300 }, ltv_usd: { min: 200, max: 2000 }, monthly_churn_pct: { min: 2, max: 8 }, payback_months: { min: 4, max: 14 }, gross_margin_pct: 52, note: 'Benchmarks genÃ©ricos 2024' },
  },
};
