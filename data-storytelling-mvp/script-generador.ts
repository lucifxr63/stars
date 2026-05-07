import { createObjectCsvWriter } from 'csv-writer';
import axios from 'axios';

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

        // Mock de data procesada para el MVP (expandida con más métricas)
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
            },
            {
                titulo_post: "Churn que mata vs. churn que se tolera",
                metrica_nombre: "Monthly Churn Rate (MRR)",
                benchmark_latam: "2% - 5%",
                estado_saludable: "Menos de 2% mensual",
                estado_peligro: "Más de 5% mensual"
            },
            {
                titulo_post: "Churn que mata vs. churn que se tolera",
                metrica_nombre: "Net Revenue Retention",
                benchmark_latam: "100% - 120%",
                estado_saludable: "Mayor a 110% (expansion)",
                estado_peligro: "Menor a 90% (contracción)"
            },
            {
                titulo_post: "¿Cuánto cuesta adquirir un cliente B2B en LatAm?",
                metrica_nombre: "CAC por canal - Email Frío",
                benchmark_latam: "$80 - $200 USD",
                estado_saludable: "Menor a $150 USD",
                estado_peligro: "Mayor a $300 USD"
            },
            {
                titulo_post: "¿Cuánto cuesta adquirir un cliente B2B en LatAm?",
                metrica_nombre: "CAC por canal - WhatsApp API",
                benchmark_latam: "$40 - $120 USD",
                estado_saludable: "Menor a $80 USD",
                estado_peligro: "Mayor a $200 USD"
            },
            {
                titulo_post: "Benchmarks SaaS Chile 2026: ¿Dónde está tu startup?",
                metrica_nombre: "ARR Growth Rate (Seed)",
                benchmark_latam: "100% - 200% YoY",
                estado_saludable: "Mayor a 150% YoY",
                estado_peligro: "Menor a 50% YoY"
            },
            {
                titulo_post: "Benchmarks SaaS Chile 2026: ¿Dónde está tu startup?",
                metrica_nombre: "Gross Margin SaaS",
                benchmark_latam: "65% - 80%",
                estado_saludable: "Mayor a 70%",
                estado_peligro: "Menor a 50%"
            }
        ];

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

        await csvWriter.writeRecords(datosProcesados);
        console.log(`\n✅ Éxito! Archivo 'canva_bulk_data.csv' generado con ${datosProcesados.length} filas.`);
        console.log("📋 Próximo paso: importar este CSV en Canva → Bulk Create → conectar campos a la plantilla.");

    } catch (error) {
        console.error("Error en la línea de ensamblaje de datos:", error);
    }
}

generarDatosParaCanva();
