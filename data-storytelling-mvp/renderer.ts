import puppeteer from 'puppeteer';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();
import { fetchAllPosts, PostData } from './data-fetcher';

// ─── Dataset fallback (solo si las APIs fallan) ───────────────────────────────
const FALLBACK: PostData[] = [
    {
        id: 1,
        tag_sistema: "/SYS/METRICS/2026",
        titulo: "La crisis de retención B2B en LatAm",
        subtitulo: "Por qué el crecimiento a cualquier costo ya no sirve y los VCs exigen eficiencia pura.",
        metrica: "LTV:CAC Ratio Promedio",
        benchmark: "4.5x",
        saludable: "> 3x",
        peligro: "< 2x",
        insight: "El 60% de las startups Serie A en LatAm están quemando caja intentando adquirir clientes. En 2026, si tu cliente no te deja al menos el triple de lo que costó traerlo, estás financiando tu propia quiebra.",
        chartLabels: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026'],
        chartData: [1.5, 2.1, 2.8, 3.4, 4.5],
        chartType: 'line' as const,
        fuente: 'DataShield Benchmarks 2026',
    },
    {
        id: 2,
        tag_sistema: "/SYS/GROWTH/ACQUISITION",
        titulo: "El verdadero costo de adquirir un cliente",
        subtitulo: "Las startups están abandonando los canales tradicionales por la venta conversacional.",
        metrica: "CAC Promedio (USD)",
        benchmark: "$20",
        saludable: "WhatsApp API",
        peligro: "LinkedIn Ads",
        insight: "Meta y Google Ads se han vuelto prohibitivos para startups B2B tempranas. WhatsApp API no solo reduce el CAC a $20, sino que triplica la tasa de respuesta inicial comparado con el Cold Email tradicional.",
        chartLabels: ['LinkedIn Ads', 'Google Ads', 'Cold Email', 'WhatsApp API'],
        chartData: [150, 120, 75, 20],
        chartType: 'bar' as const,
        fuente: 'DataShield Benchmarks 2026',
    },
] as PostData[];

// ─── System Prompt Maestro ───────────────────────────────────────────────────
const SYSTEM_PROMPT = `Actúa como un experto en Growth Marketing B2B y redactor especializado en LinkedIn para el ecosistema de startups y Venture Capital en LatAm.

Tu objetivo es escribir un post de LinkedIn altamente persuasivo basado en los datos de una infografía generada automáticamente.

El post NO debe simplemente repetir los datos de la imagen, sino expandir el "por qué esto es importante" (el insight) y generar debate en los comentarios.

Tono: Profesional, analítico, directo (sin jerga innecesaria), y con un toque provocador que rete el status quo de los founders.

Reglas de formato:
1. Primera línea: Un gancho (hook) impactante, idealmente usando una estadística o afirmación fuerte. Debe ir separado por un salto de línea.
2. Cuerpo: Párrafos cortos (máximo 2-3 líneas por párrafo) para facilitar la lectura en móviles (scannability).
3. Transición: Una línea que invite al usuario a mirar el gráfico o infografía adjunta.
4. Cierre (Call to Action): Una pregunta abierta y específica dirigida a founders, operadores o inversionistas para fomentar comentarios.
5. Hashtags: Máximo 5 hashtags relevantes (ej. #StartupsLatAm #SaaS). No uses emojis en exceso, máximo 2 o 3 en todo el post.

Responde SOLO con el texto del post, sin explicaciones adicionales.`;

// ─── HTML Template V4 (Storytelling layout) ──────────────────────────────────
function buildHTML(dato: PostData): string {
    const bgColor = dato.chartType === 'line' ? 'rgba(0, 240, 255, 0.1)' : '#b829ff';

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&family=JetBrains+Mono:wght@400;700;800&family=Playfair+Display:ital,wght@0,600;1,600&display=swap" rel="stylesheet">
    <style>
        body { background-color: #09090b; font-family: 'Inter', sans-serif; }
        .bg-glow {
            position: absolute; width: 600px; height: 600px;
            background: radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, rgba(0,0,0,0) 70%);
            top: -200px; right: -200px; border-radius: 50%; z-index: 0;
        }
    </style>
</head>
<body class="flex items-center justify-center h-screen w-screen p-10 m-0 box-border text-white">
    <div class="relative bg-[#0f0f13] border border-white/10 rounded-2xl p-10 w-full h-full flex flex-col justify-between shadow-2xl overflow-hidden">
        <div class="bg-glow"></div>

        <!-- ZONA 1: Header + Título + Subtítulo -->
        <div class="relative z-10">
            <div class="flex items-center gap-3 mb-3">
                <div class="h-3 w-3 rounded-full bg-red-500"></div>
                <div class="h-3 w-3 rounded-full bg-yellow-500"></div>
                <div class="h-3 w-3 rounded-full bg-green-500"></div>
                <span style="font-family:'JetBrains Mono',monospace" class="text-[#00f0ff] text-xs ml-2 tracking-widest">${dato.tag_sistema}</span>
            </div>
            <h1 class="text-white text-4xl font-extrabold leading-tight tracking-tight w-11/12">${dato.titulo}</h1>
            <p style="font-family:'Playfair Display',serif" class="text-gray-400 text-lg mt-2 leading-snug w-11/12 italic">"${dato.subtitulo}"</p>
        </div>

        <!-- ZONA 2: Gráfico -->
        <div class="relative z-10 w-full bg-[#09090b]/80 border border-white/5 rounded-xl p-5 shadow-inner" style="height:300px">
            <div class="flex justify-between items-center mb-2">
                <h3 style="font-family:'JetBrains Mono',monospace" class="text-gray-400 text-sm uppercase tracking-wider">${dato.metrica}</h3>
                <span style="font-family:'JetBrains Mono',monospace" class="text-2xl font-black text-[#b829ff]">${dato.benchmark}</span>
            </div>
            <div style="position:relative;height:220px;width:100%">
                <canvas id="chartCanvas"></canvas>
            </div>
        </div>

        <!-- ZONA 3: Key Takeaway (insight) -->
        <div class="relative z-10 bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-4 flex gap-3 items-start">
            <div class="text-2xl leading-none mt-0.5">💡</div>
            <div>
                <p style="font-family:'JetBrains Mono',monospace" class="text-indigo-400 text-xs uppercase tracking-widest mb-1">Key Takeaway</p>
                <p class="text-gray-200 text-sm leading-relaxed font-medium">${dato.insight}</p>
            </div>
        </div>

        <!-- ZONA 4: Badges OK / Warning -->
        <div class="relative z-10 grid grid-cols-2 gap-4">
            <div class="bg-gradient-to-br from-emerald-900/40 to-transparent border border-emerald-500/30 rounded-xl p-4">
                <p style="font-family:'JetBrains Mono',monospace" class="text-emerald-400 text-xs uppercase tracking-widest mb-1">Status: OK</p>
                <p class="text-white text-xl font-bold">${dato.saludable}</p>
            </div>
            <div class="bg-gradient-to-br from-rose-900/40 to-transparent border border-rose-500/30 rounded-xl p-4">
                <p style="font-family:'JetBrains Mono',monospace" class="text-rose-400 text-xs uppercase tracking-widest mb-1">Status: Warning</p>
                <p class="text-white text-xl font-bold">${dato.peligro}</p>
            </div>
        </div>

        <!-- ZONA 5: Footer -->
        <div class="relative z-10 flex justify-between items-center border-t border-white/10 pt-3">
            <p style="font-family:'JetBrains Mono',monospace" class="text-gray-600 text-xs">SOURCE: DATA_ENGINE_2026</p>
            <p style="font-family:'JetBrains Mono',monospace" class="text-white text-xl font-bold tracking-tighter">DataShield_</p>
        </div>
    </div>

    <script>
        const ctx = document.getElementById('chartCanvas').getContext('2d');
        new Chart(ctx, {
            type: '${dato.chartType}',
            data: {
                labels: ${JSON.stringify(dato.chartLabels)},
                datasets: [{
                    data: ${JSON.stringify(dato.chartData)},
                    borderColor: '#00f0ff',
                    backgroundColor: '${bgColor}',
                    borderWidth: 3,
                    pointBackgroundColor: '#b829ff',
                    pointBorderColor: '#fff',
                    pointRadius: 5,
                    fill: true,
                    tension: 0.4,
                    borderRadius: 4
                }]
            },
            options: {
                animation: false,
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888', font: { family: 'JetBrains Mono', size: 10 } } },
                    x: { grid: { display: false }, ticks: { color: '#888', font: { family: 'JetBrains Mono', size: 10 } } }
                }
            }
        });
    </script>
</body>
</html>`;
}

// ─── Main Pipeline ───────────────────────────────────────────────────────────
async function generarPipeline() {
    console.log("🚀 Iniciando pipeline V5 — datos reales: BCCH + INE + World Bank\n");

    const outputDir = './outputs';
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    // Intentar datos reales; caer en fallback si falla todo
    let datosProcesados: PostData[];
    try {
        datosProcesados = await fetchAllPosts();
        if (datosProcesados.length === 0) throw new Error('Sin datos');
    } catch (e) {
        console.warn('⚠️  Usando datos fallback (APIs no disponibles)\n');
        datosProcesados = FALLBACK;
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });

    for (const dato of datosProcesados) {
        console.log(`📊 [${dato.id}/${datosProcesados.length}] Procesando: "${dato.titulo}"`);

        // 1. Generar imagen
        const page = await browser.newPage();
        await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 });
        await page.setContent(buildHTML(dato), { waitUntil: 'networkidle0', timeout: 60000 });
        const fecha = new Date().toISOString().slice(0, 10);
        const slug = dato.titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
        const imgPath = `${outputDir}/${fecha}_${dato.id}_${slug}.png`;
        await page.screenshot({ path: imgPath as `${string}.png`, type: 'png' });
        await page.close();
        console.log(`   ✅ Imagen → ${imgPath}`);

        // 2. Generar copy LinkedIn via Claude
        const userMessage = `Aquí tienes los datos REALES de la infografía de hoy:
- Título: ${dato.titulo}
- Subtítulo: ${dato.subtitulo}
- Métrica Principal: ${dato.metrica} — Benchmark actual: ${dato.benchmark}
- Zona saludable: ${dato.saludable} | Zona peligro: ${dato.peligro}
- El Insight / Conclusión clave: ${dato.insight}
- Fuente de datos: ${(dato as any).fuente ?? 'DataShield'}
- Fecha del dato: ${new Date().toLocaleDateString('es-CL')}

Los datos son REALES y actualizados al día de hoy. Úsalos con precisión. Redacta el post ahora.`;

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 600,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userMessage }],
        });

        const copy = (response.content[0] as { type: string; text: string }).text;
        const copyPath = `${outputDir}/${fecha}_${dato.id}_${slug}_linkedin.txt`;
        fs.writeFileSync(copyPath, copy, 'utf-8');
        console.log(`   ✅ Copy  → ${copyPath}`);
        console.log(`\n${'─'.repeat(60)}`);
        console.log(copy);
        console.log(`${'─'.repeat(60)}\n`);
    }

    await browser.close();
    console.log(`🏁 Pipeline V4 Storytelling completo. ${datosProcesados.length * 2} archivos en ./outputs/`);
    console.log("📱 Abrir LinkedIn → subir PNG + pegar el .txt correspondiente.");
}

generarPipeline().catch(console.error);
