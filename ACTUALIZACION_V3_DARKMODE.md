# 📝 DIRECTRIZ TÉCNICA: ACTUALIZACIÓN ESTÉTICA V3.0 (Dark Mode & Chart.js)

**De:** Mesa Directiva
**Para:** Claude Code / Equipo de Desarrollo
**Contexto del Negocio:** El MVP anterior (V2.0) validó la arquitectura (Node + Puppeteer), pero la estética "clásica" no resuena con nuestra audiencia objetivo (Founders B2B y Developers). Necesitamos pivotar a un diseño "Developer-First / Ciberpunk" de alto contraste, integrando gráficos reales dinámicos.

## 1. Objetivos del Sprint
1. Descartar el diseño claro/básico anterior.
2. Inyectar **Chart.js** directamente en la plantilla HTML para generar gráficos de líneas y barras basados en datos reales.
3. Usar **Tailwind CSS** para crear una estética Dark Mode con efectos de "glow" de neón, emulando consolas de terminal.
4. Usar tipografías de Google Fonts: `Inter` para lectura y `JetBrains Mono` para los datos duros.

## 2. Requerimientos Técnicos Críticos
* Mantener **Puppeteer** como motor de renderizado.
* Mantener resolución cuadrada de alta definición para redes sociales (`1080x1080`, `deviceScaleFactor: 2`).
* **CRÍTICO PARA CHART.JS:** La opción `animation: false` debe estar estrictamente configurada en la instancia de Chart.js. Si los gráficos se animan, Puppeteer tomará la captura de pantalla antes de que se terminen de dibujar y saldrán en blanco.

## 3. Código a Implementar (`renderer.ts`)
Por favor, sobrescribe el contenido actual del archivo `renderer.ts` con el siguiente código:

```typescript
import puppeteer from 'puppeteer';
import * as fs from 'fs';

// 1. Data Base (Actualizada con arrays para Chart.js)
const datosProcesados = [
    { 
        id: 1, 
        tag_sistema: "/SYS/METRICS/2026",
        titulo: "El estándar de retención B2B en LatAm", 
        metrica: "LTV:CAC Ratio", 
        benchmark: "4.5x", 
        saludable: "> 3x", 
        peligro: "< 2x",
        chartLabels: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026'],
        chartData: [1.5, 2.1, 2.8, 3.4, 4.5]
    },
    { 
        id: 2, 
        tag_sistema: "/SYS/GROWTH/ACQUISITION",
        titulo: "¿Cuánto cuesta adquirir un cliente B2B?", 
        metrica: "CAC Promedio (USD)", 
        benchmark: "$20", 
        saludable: "WhatsApp", 
        peligro: "Cold Email",
        chartLabels: ['LinkedIn Ads', 'Google Ads', 'Cold Email', 'WhatsApp API'],
        chartData: [150, 120, 75, 20]
    }
];

async function generarImagenes() {
    console.log("🚀 Iniciando la fábrica visual (Dark Mode + Chart.js)...");
    
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Resolución para RRSS en alta definición
    await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 });

    if (!fs.existsSync('./outputs')){
        fs.mkdirSync('./outputs');
    }

    for (const dato of datosProcesados) {
        const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <script src="[https://cdn.tailwindcss.com](https://cdn.tailwindcss.com)"></script>
            <script src="[https://cdn.jsdelivr.net/npm/chart.js](https://cdn.jsdelivr.net/npm/chart.js)"></script>
            <link rel="preconnect" href="[https://fonts.googleapis.com](https://fonts.googleapis.com)">
            <link rel="preconnect" href="[https://fonts.gstatic.com](https://fonts.gstatic.com)" crossorigin>
            <link href="[https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@400;700;800&display=swap](https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@400;700;800&display=swap)" rel="stylesheet">
            <style>
                body { background-color: #09090b; font-family: 'Inter', sans-serif; }
                .font-mono { font-family: 'JetBrains Mono', monospace; }
                
                /* Fondo Ciberpunk */
                .bg-glow {
                    position: absolute;
                    width: 600px;
                    height: 600px;
                    background: radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(0,0,0,0) 70%);
                    top: -200px;
                    right: -200px;
                    border-radius: 50%;
                    z-index: 0;
                }
            </style>
        </head>
        <body class="flex items-center justify-center h-screen w-screen p-12 m-0 box-border text-white">
            
            <div class="relative bg-[#0f0f13] border border-white/10 rounded-2xl p-12 w-full h-full flex flex-col justify-between shadow-2xl overflow-hidden">
                <div class="bg-glow"></div>
                
                <div class="relative z-10">
                    <div class="flex items-center gap-3 mb-4">
                        <div class="h-3 w-3 rounded-full bg-red-500"></div>
                        <div class="h-3 w-3 rounded-full bg-yellow-500"></div>
                        <div class="h-3 w-3 rounded-full bg-green-500"></div>
                        <span class="font-mono text-[#00f0ff] text-sm ml-2 tracking-widest">${dato.tag_sistema}</span>
                    </div>
                    <h1 class="text-white text-5xl font-extrabold leading-tight tracking-tight w-11/12">${dato.titulo}</h1>
                </div>

                <div class="relative z-10 w-full h-[380px] bg-[#09090b]/80 border border-white/5 rounded-xl p-6 mt-6 shadow-inner backdrop-blur-sm">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="font-mono text-gray-400 text-lg uppercase tracking-wider">${dato.metrica}</h3>
                        <span class="font-mono text-3xl font-black text-[#b829ff]">${dato.benchmark}</span>
                    </div>
                    <div class="relative h-[250px] w-full">
                        <canvas id="chartCanvas"></canvas>
                    </div>
                </div>

                <div class="relative z-10 grid grid-cols-2 gap-6 mt-6">
                    <div class="bg-gradient-to-br from-emerald-900/40 to-transparent border border-emerald-500/30 rounded-xl p-5 backdrop-blur-md">
                        <p class="font-mono text-emerald-400 text-xs uppercase tracking-widest mb-1">Status: OK</p>
                        <p class="text-white text-2xl font-bold">${dato.saludable}</p>
                    </div>
                    <div class="bg-gradient-to-br from-rose-900/40 to-transparent border border-rose-500/30 rounded-xl p-5 backdrop-blur-md">
                        <p class="font-mono text-rose-400 text-xs uppercase tracking-widest mb-1">Status: Warning</p>
                        <p class="text-white text-2xl font-bold">${dato.peligro}</p>
                    </div>
                </div>

                <div class="relative z-10 flex justify-between items-end border-t border-white/10 pt-6 mt-4">
                    <p class="font-mono text-gray-500 text-sm">SOURCE: DATA_ENGINE_2026</p>
                    <div class="text-right flex items-center gap-3">
                        <p class="font-mono text-white text-2xl font-bold tracking-tighter">DataShield_</p>
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
                            pointRadius: 6,
                            fill: true,
                            tension: 0.4,
                            borderRadius: 6
                        }]
                    },
                    options: {
                        animation: false, // MANDATORIO PARA PUPPETEER
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { 
                                grid: { color: 'rgba(255, 255, 255, 0.05)' }, 
                                ticks: { color: '#888', font: { family: 'JetBrains Mono' } } 
                            },
                            x: { 
                                grid: { display: false }, 
                                ticks: { color: '#888', font: { family: 'JetBrains Mono' } } 
                            }
                        }
                    }
                });
            </script>
        </body>
        </html>
        `;

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const fileName = `./outputs/post_v3_${dato.id}.png`;
        await page.screenshot({ path: fileName, type: 'png' });
        
        console.log(`✅ Gráfico Ciberpunk generado: ${fileName}`);
    }

    await browser.close();
    console.log("🏁 Actualización completada.");
}

generarImagenes();