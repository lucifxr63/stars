# 📄 Brief Estratégico y MVP: Motor de Data Storytelling para Redes Sociales

## 1. Contexto y Visión Estratégica
**Objetivo:** Generar autoridad, viralidad y confianza en redes sociales (LinkedIn, Instagram) mediante contenido basado en *Data Storytelling* (inspirado en el modelo Latinometrics).
**Hipótesis:** Los founders y tomadores de decisión no leen bloques de texto largos; consumen *insights* digeridos en tablas y gráficas atractivas. El valor real no está solo en el diseño, sino en la historia y curaduría del dato.

## 2. Focos de Contenido y Nichos (LatAm & Chile)
Basado en los recursos y documentación actual del ecosistema, el contenido se enfocará en:
* **Métricas SaaS y Unit Economics:** Benchmarks de LTV/CAC, Payback Period, Churn (Saludable vs. Peligro).
* **Tech Stack y No-Code:** Comparativas de herramientas para MVPs (ej. Bubble vs. FlutterFlow vs. Softr) en costos y tiempos.
* **Regulación y Legaltech:** Matrices de impacto visual sobre la Ley Fintech 2025 y la Ley de Protección de Datos 2026 en Chile.
* **Psicología de Ventas y Growth:** Tasas de conversión reales de canales de adquisición B2B en LatAm (Email frío vs. WhatsApp API).

## 3. Fuentes de Datos (APIs y Extracción)
* **Económicos:** Banco Central de Chile (UF, IPC, Tasas), Banco Mundial.
* **Startups:** Crunchbase API, Dealroom, reportes LAVCA.
* **Tendencias:** Google Trends API, Statista.

---

## 4. Arquitectura Técnica: El MVP Híbrido
Para evitar el *over-engineering* y validar tracción rápido, la Mesa Directiva aprobó la siguiente arquitectura inicial: **Código (TypeScript) + Canva (Bulk Create)**.

### A. El Motor de Extracción (TypeScript / Node.js)
Script encargado de conectarse a las bases de datos/APIs, limpiar la información y estructurarla en un formato digerible para herramientas de diseño masivo.

**Stack:** `ts-node`, `axios`, `csv-writer`, `dotenv`.

**Código Base (`script-generador.ts`):**
```typescript
import { createObjectCsvWriter } from 'csv-writer';
import axios from 'axios';

// 1. Definimos la estructura exacta que Canva va a leer
interface CanvaRow {
    titulo_post: string;
    metrica_nombre: string;
    benchmark_latam: string;
    estado_saludable: string;
    estado_peligro: string;
}

async function generarDatosParaCanva() {
    try {
        console.log("Iniciando extracción de datos estratégicos...");

        // Llamada a API real o Base de Datos
        // const response = await axios.get('[https://api.fuente-datos.com/metricas](https://api.fuente-datos.com/metricas)');
        
        // Mock de data procesada para el MVP
        const datosProcesados: CanvaRow[] = [
            {
                titulo_post: "El estándar de retención B2B en LatAm 2026",
                metrica_nombre: "LTV:CAC Ratio",
                benchmark_latam: "3:1 a 5:1",
                estado_saludable: "Mayor a 3x (Eficiente)",
                estado_peligro: "Menor a 2x (Quemando caja)"
            },
            {
                titulo_post: "El estándar de retención B2B en LatAm 2026",
                metrica_nombre: "Payback Period",
                benchmark_latam: "12 - 15 meses",
                estado_saludable: "Menos de 12 meses",
                estado_peligro: "Más de 18 meses"
            }
        ];

        // 2. Configuración del exportador a CSV
        const csvWriter = createObjectCsvWriter({
            path: './canva_bulk_data.csv',
            header: [
                { id: 'titulo_post', title: 'Titulo' },
                { id: 'metrica_nombre', title: 'Metrica' },
                { id: 'benchmark_latam', title: 'Benchmark' },
                { id: 'estado_saludable', title: 'Saludable' },
                { id: 'estado_peligro', title: 'Peligro' }
            ]
        });

        // 3. Generación del archivo final
        await csvWriter.writeRecords(datosProcesados);
        console.log("¡Éxito! Archivo 'canva_bulk_data.csv' generado y listo para inyectar en Canva.");

    } catch (error) {
        console.error("Error en la línea de ensamblaje de datos:", error);
    }
}

generarDatosParaCanva();