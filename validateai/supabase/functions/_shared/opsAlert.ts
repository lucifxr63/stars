// Alerting de operaciones para las Edge Functions.
//
// Port del helper de mp-sync (services/mercado-publico/src/infrastructure/
// ops-alert). Mismos canales y mismo formato de embed, para que la sala de
// control se lea igual venga de donde venga el aviso.
//
// POR QUÉ ESTE ARCHIVO EXISTE
// ---------------------------
// Hasta ahora sólo la ingesta de Mercado Público hablaba a Discord. El motor de
// IA y el gateway público —donde vive el producto que se le cobra a alguien—
// eran completamente mudos: si `ai-validate` degradaba o `api-v1` empezaba a
// devolver 500, no había ninguna señal fuera de los logs.
//
// Los canales se separan por QUÉ HACER al ver el mensaje:
//   incidentes   → algo está roto AHORA. Sólo rojo.
//   latido       → corridas programadas que terminaron bien.
//   degradacion  → lo que "funciona" mientras miente (RAG sin corpus, mocks,
//                  fallbacks sirviendo en lugar del dato real).
//   negocio      → señal de producto: cuotas agotadas, tiers, leads.
//
// Nunca lanza y nunca bloquea: un fallo de alerting no debe romper el flujo que
// lo emitió. Todos los llamadores deben usar `void sendOpsAlert(...)`.

export type OpsLevel = 'info' | 'warn' | 'error';
export type OpsChannel = 'incidentes' | 'latido' | 'degradacion' | 'negocio';

export interface OpsField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface OpsAlert {
  level: OpsLevel;
  title: string;
  detail?: string;
  fields?: OpsField[];
  /** Contexto de origen al pie. Por convención: el nombre de la función. */
  footer?: string;
  channel?: OpsChannel;
  dedupeKey?: string;
}

const EMOJI: Record<OpsLevel, string> = { error: '🔴', warn: '🟡', info: '🟢' };

/** Color de la barra lateral: la señal que se lee sin leer. */
const COLOR: Record<OpsLevel, number> = {
  error: 0xe04f5f,
  warn: 0xe0a44f,
  info: 0x4fe08a,
};

const NOMBRE_CANAL: Record<OpsChannel, string> = {
  incidentes: 'Incidentes',
  latido: 'Latido',
  degradacion: 'Degradación',
  negocio: 'Negocio',
};

function urlDeCanal(channel: OpsChannel): string | undefined {
  const incidentes = Deno.env.get('OPS_WEBHOOK_URL');
  const porCanal: Record<OpsChannel, string | undefined> = {
    incidentes,
    latido: Deno.env.get('OPS_WEBHOOK_LATIDO'),
    degradacion: Deno.env.get('OPS_WEBHOOK_DEGRADACION'),
    negocio: Deno.env.get('OPS_WEBHOOK_NEGOCIO'),
  };
  // Sin canal propio cae a incidentes: preferible un canal mezclado a un aviso
  // mudo.
  return porCanal[channel] ?? incidentes;
}

/**
 * Dedupe en memoria del isolate. Las Edge Functions se reciclan seguido, así
 * que esto NO es un dedupe distribuido: sólo corta la repetición dentro de una
 * misma invocación o de invocaciones cercanas en el mismo isolate. Alcanza para
 * el caso real (el mismo aviso disparándose en un bucle) sin infraestructura.
 */
const DEDUPE_MS = 30 * 60 * 1000;
const ultimoEnvio = new Map<string, number>();

function debeEnviar(key: string): boolean {
  const ahora = Date.now();
  const previo = ultimoEnvio.get(key);
  if (previo != null && ahora - previo < DEDUPE_MS) return false;
  ultimoEnvio.set(key, ahora);
  if (ultimoEnvio.size > 100) {
    for (const [k, t] of ultimoEnvio) {
      if (ahora - t >= DEDUPE_MS) ultimoEnvio.delete(k);
    }
  }
  return true;
}

function textoPlano(a: OpsAlert): string {
  const partes = [`${EMOJI[a.level]} **${a.title}**`];
  if (a.detail) partes.push(a.detail);
  if (a.fields?.length) partes.push(a.fields.map((f) => `${f.name}: ${f.value}`).join(' · '));
  return partes.join('\n');
}

export async function sendOpsAlert(alert: OpsAlert): Promise<void> {
  const channel = alert.channel ?? (alert.level === 'error' ? 'incidentes' : 'latido');

  // Siempre al log, haya webhook o no.
  const linea = `[ops-alert:${channel}] ${alert.title}${alert.detail ? ` — ${alert.detail}` : ''}`;
  if (alert.level === 'error') console.error(linea);
  else console.warn(linea);

  const url = urlDeCanal(channel);
  if (!url) return;
  if (!debeEnviar(`${channel}:${alert.dedupeKey ?? alert.title}`)) return;

  const plano = textoPlano(alert);
  const embed = {
    title: `${EMOJI[alert.level]}  ${alert.title}`.slice(0, 256),
    ...(alert.detail ? { description: alert.detail.slice(0, 4096) } : {}),
    color: COLOR[alert.level],
    ...(alert.fields?.length
      ? {
          fields: alert.fields.slice(0, 25).map((f) => ({
            name: f.name.slice(0, 256),
            value: (f.value || '—').slice(0, 1024),
            inline: f.inline ?? true,
          })),
        }
      : {}),
    footer: {
      text: `${alert.footer ?? 'edge'} · ${NOMBRE_CANAL[channel]}`.slice(0, 2048),
    },
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ embeds: [embed], text: plano }),
    });
    if (!res.ok) {
      // Un embed mal formado da 400 y el aviso se perdería. Mejor feo que mudo.
      await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: plano, text: plano }),
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('[ops-alert] fallo al enviar webhook:', err);
  }
}
