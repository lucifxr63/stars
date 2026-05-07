# 📝 DIRECTRIZ TÉCNICA: ACTUALIZACIÓN ESTÉTICA V4.0 (Storytelling & Copy Automation)

**De:** Mesa Directiva
**Para:** Claude Code / Equipo de Desarrollo
**Contexto del Negocio:** La versión 3.0 logró el impacto visual correcto (Dark Mode/Ciberpunk), pero carecía de narrativa ("Storytelling"). En redes sociales B2B, un gráfico sin contexto es ignorado. Necesitamos que cada imagen sea autocontenida: debe incluir el "Gancho" (Título), el "Contexto" (Subtítulo) y la "Conclusión" (Insight). Además, necesitamos estandarizar la generación de los *copies* para LinkedIn.

## 1. Objetivos del Sprint
1. **Modificar la base de datos (JSON/Array):** Añadir los campos `subtitulo` e `insight` a la estructura de datos.
2. **Actualizar el HTML/Tailwind en Puppeteer:** Inyectar estos nuevos campos en el diseño visual sin romper el layout cuadrado (1080x1080).
3. **Automatizar el Output de Texto:** Hacer que el script, además de generar el `.png`, genere automáticamente un archivo `.txt` con el *System Prompt* inyectado con las variables correspondientes, listo para pasarlo por un LLM (o para que el LLM lo genere directamente si está conectado a la API).

## 2. Código a Implementar (`renderer.ts`)
Por favor, sobrescribe el contenido actual del archivo `renderer.ts` con el siguiente código que incluye el pipeline visual y la generación de archivos de texto:

```typescript
import puppeteer from 'puppeteer';
import * as fs from 'fs';

// 1. Data Base V4: Incluye Storytelling
const datosProcesados = [
    { 
        id: 1, 
        tag_sistema: "/SYS/METRICS/2026",
        titulo: "La crisis de retención B2B en LatAm", 
        subtitulo: "Por qué el crecimiento a cualquier costo ya no sirve y los VCs exigen eficiencia pura.",
        metrica: "LTV:CAC Ratio Promedio", 
        benchmark: "4.5x", 
        saludable: "> 3x", 
        peligro: "< 2x",
        chartLabels: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026'],
        chartData: [1.5, 2.1, 2.8, 3.4, 4.5],
        insight: "El 60% de las startups Serie A en LatAm están quemando caja intentando adquirir clientes. En 2026, si tu cliente no te deja al menos el triple de lo que costó traerlo, estás financiando tu propia quiebra."
    },
    { 
        id: 2, 
        tag_sistema: "/SYS/GROWTH/ACQUISITION",
        titulo: "El verdadero costo de adquirir un cliente", 
        subtitulo: "Las startups están abandonando los canales tradicionales por la venta conversacional.",
        metrica: "CAC Promedio (USD)", 
        benchmark: "$20", 
        saludable: "WhatsApp", 
        peligro: "Cold Email",
        chartLabels: ['LinkedIn Ads', 'Google Ads', 'Cold Email', 'WhatsApp API'],
        chartData: [150, 120, 75, 20],
        insight: "Meta y Google Ads se han vuelto prohibitivos para startups B2B tempranas. WhatsApp API no solo reduce el CAC a $20, sino que triplica la tasa de respuesta inicial comparado con el Cold Email tradicional."
    }
];

async function generarPipelineCompleto() {
    console.log("🚀 Iniciando la fábrica visual (V4 Storytelling Mode)...");
    
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 });

    if (!fs.existsSync('./outputs')){
        fs.mkdirSync('./outputs');
    }

    for (const dato of datosProcesados) {
        // --- 1. GENERACIÓN DE LA IMAGEN ---
        const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <script src="[https://cdn.tailwindcss.com](https://cdn.tailwindcss.com)"></script>
            <script src="[https://cdn.jsdelivr.net/npm/chart.js](https://cdn.jsdelivr.net/npm/chart.js)"></script>
            <link rel="preconnect" href="[https://fonts.googleapis.com](https://fonts.googleapis.com)">
            <link rel="preconnect" href="[https://fonts.gstatic.com](https://fonts.gstatic.com)" crossorigin>
            <link href="[https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&family=JetBrains+Mono:wght@400;700;800&family=Playfair+Display:ital,wght@1,600&display=swap](https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&family=JetBrains+Mono:wght@400;700;800&family=Playfair+Display:ital,wght@1,600&display=swap)" rel="stylesheet">
            <style>
                body { background-color: #09090b; font-family: 'Inter', sans-serif; }
                .font-mono { font-family: 'JetBrains Mono', monospace; }
                .font-serif { font-family: 'Playfair Display', serif; }
                
                .bg-glow {
                    position: absolute;
                    width: 600px;
                    height: 600px;
                    background: radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, rgba(0,0,0,0) 70%);
                    top: -200px;
                    right: -200px;
                    border-radius: 50%;
                    z-index: 0;
                }
            </style>
        </head>
        <body class="flex items-center justify-center h-screen w-screen p-10 m-0 box-border text-white">
            <div class="relative bg-[#0f0f13] border border-white/10 rounded-2xl p-10 w-full h-full flex flex-col justify-between shadow-2xl overflow-hidden">
                <div class="bg-glow"></div>
                
                <div class="relative z-10">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="h-3 w-3 rounded-full bg-red-500"></div>
                        <div class="h-3 w-3 rounded-full bg-yellow-500"></div>
                        <div class="h-3 w-3 rounded-full bg-green-500"></div>
                        <span class="font-mono text-[#00f0ff] text-xs ml-2 tracking-widest">${dato.tag_sistema}</span>
                    </div>
                    <h1 class="text-white text-4xl font-extrabold leading-tight tracking-tight w-11/12">${dato.titulo}</h1>
                    <p class="font-serif text-gray-400 text-xl mt-3 leading-snug w-11/12 italic">"${dato.subtitulo}"</p>
                </div>

                <div class="relative z-10 w-full h-[320px] bg-[#09090b]/80 border border-white/5 rounded-xl p-5 mt-4 shadow-inner backdrop-blur-sm">
                    <div class="flex justify-between items-center mb-2">
                        <h3 class="font-mono text-gray-400 text-sm uppercase tracking-wider">${dato.metrica}</h3>
                        <span class="font-mono text-2xl font-black text-[#b829ff]">${dato.benchmark}</span>
                    </div>
                    <div class="relative h-[220px] w-full">
                        <canvas id="chartCanvas"></canvas>
                    </div>
                </div>

                <div class="relative z-10 mt-4 bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-5 backdrop-blur-md flex gap-4 items-start">
                    <div class="text-3xl">💡</div>
                    <div>
                        <p class="font-mono text-indigo-400 text-xs uppercase tracking-widest mb-2">Key Takeaway</p>
                        <p class="text-gray-200 text-base leading-relaxed font-medium">${dato.insight}</p>
                    </div>
                </div>

                <div class="relative z-10 flex justify-between items-end border-t border-white/10 pt-4 mt-2">
                    <p class="font-mono text-gray-600 text-xs">SOURCE: DATA_ENGINE_2026</p>
                    <div class="text-right flex items-center gap-3">
                        <p class="font-mono text-white text-xl font-bold tracking-tighter">DataShield_</p>
                    </div>
                </div>
            </div>

            <script>
                const ctx = document.getElementById('chartCanvas').getContext('2d');
                const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                gradient.addColorStop(0, 'rgba(0, 240, 255, 0.5)');
                gradient.addColorStop(1, 'rgba(0, 240, 255, 0.0)');

                new Chart(ctx, {
                    type: '${dato.id === 1 ? 'line' : 'bar'}',
                    data: {
                        labels: ${JSON.stringify(dato.chartLabels)},
                        datasets: [{
                            data: ${JSON.stringify(dato.chartData)},
                            borderColor: '#00f0ff',
                            backgroundColor: '${dato.id === 1 ? "rgba(0, 240, 255, 0.1)" : "#b829ff"}',
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
                            y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#888', font: { family: 'JetBrains Mono', size: 10 } } },
                            x: { grid: { display: false }, ticks: { color: '#888', font: { family: 'JetBrains Mono', size: 10 } } }
                        }
                    }
                });
            </script>
        </body>
        </html>
        `;

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const imagePath = `./outputs/post_v4_${dato.id}.png`;
        await page.screenshot({ path: imagePath, type: 'png' });
        console.log(`✅ Imagen generada: ${imagePath}`);

        // --- 2. GENERACIÓN DEL PROMPT PARA EL COPY (.txt) ---
        const promptText = `Actúa como un experto en Growth Marketing B2B y redactor especializado en LinkedIn para el ecosistema de startups y Venture Capital en LatAm. 

Tu objetivo es escribir un post de LinkedIn altamente persuasivo basado en los datos de la infografía que generamos. El post NO debe simplemente repetir los datos de la imagen, sino expandir el "por qué esto es importante" y generar debate.

Tono: Profesional, analítico, directo, provocador.

Reglas:
1. Primera línea: Un gancho (hook) impactante.
2. Párrafos cortos (máximo 2-3 líneas).
3. Transición: Invitar a mirar el gráfico.
4. Cierre (CTA): Pregunta abierta y específica a founders/operadores.
5. Hashtags: Máximo 5. No uses emojis en exceso.

DATOS DE LA INFOGRAFÍA:
- Título: ${dato.titulo}
- Subtítulo: ${dato.subtitulo}
- Métrica Principal: ${dato.metrica} (${dato.benchmark})
- Insight: ${dato.insight}

Redacta el post ahora:`;

        const txtPath = `./outputs/post_v4_${dato.id}_linkedin_prompt.txt`;
        fs.writeFileSync(txtPath, promptText, 'utf8');
        console.log(`📝 Prompt guardado en: ${txtPath}`);
    }

    await browser.close();
    console.log("🏁 Pipeline V4 completado con éxito.");
}

generarPipelineCompleto();