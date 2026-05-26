// Edge Function: cron-tier-health
// Ejecutar semanalmente (cron: "0 9 * * 1" — lunes a las 09:00 UTC).
//
// Calcula el downgrade rate de los últimos 7 días:
//   downgrade_rate = downgrades_7d / max(paid_users_7d_ago, 1)
//
// Si downgrade_rate > ALERT_THRESHOLD (15%), emite:
//   - console.error (capturado por Supabase Edge Logs → visible en dashboard)
//   - Evento PostHog server-side "tier_health_alert" para el dashboard de producto
//
// Siempre retorna un JSON con las métricas para auditoría manual.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SRK  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const POSTHOG_KEY   = Deno.env.get('POSTHOG_API_KEY') ?? '';
const ALERT_THRESHOLD = 0.15; // 15 %

interface TierHealthReport {
  period_start: string;
  period_end: string;
  paid_users_at_period_start: number;
  upgrades_7d: number;
  downgrades_expired_7d: number;
  downgrades_manual_7d: number;
  total_downgrades_7d: number;
  downgrade_rate: number;
  alert_triggered: boolean;
}

/** Dispara un evento server-side a PostHog para alertas de tier health. */
async function emitPostHogAlert(report: TierHealthReport) {
  if (!POSTHOG_KEY) return;
  try {
    await fetch('https://app.posthog.com/capture/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event: 'tier_health_alert',
        distinct_id: 'system_cron',
        properties: {
          ...report,
          alert_level: report.downgrade_rate >= 0.30 ? 'critical' : 'warning',
        },
      }),
    });
  } catch (err) {
    console.warn('[cron-tier-health] PostHog emit failed:', err);
  }
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SRK);

  const now      = new Date();
  const weekAgo  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const periodEnd   = now.toISOString();
  const periodStart = weekAgo.toISOString();

  // ── Usuarios en tier pago al inicio del período (proxy: paid_users_now - upgrades + downgrades)
  // Aproximación: contamos usuarios que siguen en tier != 'free' hoy
  const { count: paidNow } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .neq('tier', 'free');

  // ── Eventos de la última semana desde tier_events
  const { data: events } = await supabase
    .from('tier_events')
    .select('event_type')
    .gte('created_at', periodStart);

  const upgrades          = events?.filter(e => e.event_type === 'upgrade').length ?? 0;
  const downgradesExpired = events?.filter(e => e.event_type === 'downgrade_expired').length ?? 0;
  const downgradesManual  = events?.filter(e => e.event_type === 'downgrade_manual').length ?? 0;
  const totalDowngrades   = downgradesExpired + downgradesManual;

  // Estimación del pool de usuarios pagos al inicio del período
  // (usuarios pagos actuales + downgrades ocurridos - upgrades ocurridos en la semana)
  const paidAtPeriodStart = Math.max((paidNow ?? 0) + totalDowngrades - upgrades, 1);
  const downgradeRate     = totalDowngrades / paidAtPeriodStart;
  const alertTriggered    = downgradeRate > ALERT_THRESHOLD;

  const report: TierHealthReport = {
    period_start:               periodStart,
    period_end:                 periodEnd,
    paid_users_at_period_start: paidAtPeriodStart,
    upgrades_7d:                upgrades,
    downgrades_expired_7d:      downgradesExpired,
    downgrades_manual_7d:       downgradesManual,
    total_downgrades_7d:        totalDowngrades,
    downgrade_rate:             Math.round(downgradeRate * 10000) / 10000, // 4 decimales
    alert_triggered:            alertTriggered,
  };

  if (alertTriggered) {
    // console.error es capturado por Supabase Edge Logs y puede generar alertas en el dashboard
    console.error(
      `[TIER HEALTH ALERT] downgrade_rate=${(downgradeRate * 100).toFixed(1)}% > threshold=${ALERT_THRESHOLD * 100}%`,
      JSON.stringify(report),
    );
    await emitPostHogAlert(report);
  } else {
    console.log(
      `[cron-tier-health] OK — downgrade_rate=${(downgradeRate * 100).toFixed(1)}%`,
      JSON.stringify(report),
    );
  }

  return new Response(JSON.stringify(report), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
