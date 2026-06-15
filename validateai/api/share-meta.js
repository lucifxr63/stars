// Open Graph para reportes compartidos (/shared/:token).
// vercel.json routea aquí SOLO a crawlers (por user-agent); los humanos van al SPA.
// Esta función lee la validación por share_token y devuelve HTML con meta-tags
// específicos (idea + score) para que LinkedIn/WhatsApp/etc. muestren una tarjeta rica.
// Si falta la anon key o el token no existe, degrada a meta genérica (nunca crashea).

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://fcdhcntyvsydnvjwopfe.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const SITE = 'https://validus.scouttech.lat';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const pageUrl = `${SITE}/shared/${token}`;
  const image = `${SITE}/og-image.png`;

  let title = 'Validus — Reporte de validación';
  let description = 'Análisis de viabilidad de una idea de startup, validado con IA.';

  try {
    if (token && SUPABASE_ANON_KEY) {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/validations?share_token=eq.${encodeURIComponent(token)}` +
          `&select=idea_name,idea_description,validation_score,idea_industry,ai_feedback&limit=1`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } },
      );
      const rows = await r.json();
      const v = Array.isArray(rows) ? rows[0] : null;
      if (v) {
        const name = v.idea_name || 'Una startup';
        const score = v.validation_score;
        title = score != null ? `${name} — Score ${score}/100 · Validus` : `${name} · Validus`;
        const raw = String(v.ai_feedback || v.idea_description || '').replace(/\s+/g, ' ').trim();
        if (raw) description = raw.length > 180 ? `${raw.slice(0, 177).trimEnd()}…` : raw;
      }
    }
  } catch {
    // degradación silenciosa → meta genérica
  }

  const html = `<!doctype html><html lang="es"><head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(pageUrl)}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="Validus" />
<meta property="og:url" content="${esc(pageUrl)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${esc(image)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />
<script>location.replace(${JSON.stringify(`${pageUrl}?r=1`)});</script>
</head><body>
<p>Redirigiendo al reporte… <a href="${esc(pageUrl)}">Ver reporte de validación</a></p>
</body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(html);
}
