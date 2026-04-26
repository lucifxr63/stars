/**
 * Seed script: inserts known competitors into Supabase with OpenAI embeddings.
 * Run with: npx tsx scripts/seedCompetitors.ts
 * Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY in .env.local
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

const COMPETITORS = [
  {
    name: 'Preuve AI',
    url: 'https://preuve.ai',
    description: 'Plataforma de validación de ideas de negocio con IA para emprendedores latinoamericanos.',
    market: 'Validación de startups LATAM',
    pricing: 'Freemium',
    strengths: ['Contexto latinoamericano', 'Análisis rápido', 'Precio accesible'],
    weaknesses: ['Sin análisis de riesgos', 'No genera PDF', 'Sin unit economics'],
    industries: ['saas', 'validacion', 'emprendimiento'],
    geography: ['latam', 'chile'],
  },
  {
    name: 'DimeADozen',
    url: 'https://dimeadozen.ai',
    description: 'AI tool that validates business ideas in minutes with market research and SWOT analysis.',
    market: 'Business idea validation global',
    pricing: '$19/report',
    strengths: ['Rápido', 'Interfaz simple', 'SWOT automatizado'],
    weaknesses: ['Solo inglés', 'Sin contexto local', 'Sin unit economics'],
    industries: ['saas', 'validacion'],
    geography: ['global', 'us'],
  },
  {
    name: 'FounderPal',
    url: 'https://founderpal.ai',
    description: 'AI co-founder tools including persona generator, market research, and business strategy.',
    market: 'AI tools for founders',
    pricing: 'Free + Pro $20/mo',
    strengths: ['Suite completa', 'Freemium generoso', 'Personas detalladas'],
    weaknesses: ['No específico para validación', 'Sin análisis financiero', 'Muy genérico'],
    industries: ['saas', 'herramientas-fundadores'],
    geography: ['global'],
  },
  {
    name: 'ValidatorAI',
    url: 'https://validatorai.com',
    description: 'AI-powered business idea validator with market size estimation and competitor analysis.',
    market: 'Startup idea validation',
    pricing: 'Free',
    strengths: ['Gratuito', 'Análisis de mercado', 'Fácil de usar'],
    weaknesses: ['Análisis superficial', 'Sin PDF', 'Sin datos LATAM'],
    industries: ['saas', 'validacion'],
    geography: ['global'],
  },
  {
    name: 'IdeaProof',
    url: null,
    description: 'Validates startup ideas using AI with focus on problem-solution fit and market sizing.',
    market: 'Startup validation',
    pricing: null,
    strengths: ['Problem-solution fit focus', 'Métricas claras'],
    weaknesses: ['Sin contexto regional', 'Sin integración'],
    industries: ['saas', 'validacion'],
    geography: ['global'],
  },
];

async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings error: ${res.status}`);
  const data = await res.json();
  return data.data[0].embedding as number[];
}

async function seed() {
  console.log(`Seeding ${COMPETITORS.length} competitors...`);
  let inserted = 0;

  for (const comp of COMPETITORS) {
    const embeddingText = [comp.name, comp.description, comp.market, ...(comp.industries ?? [])].join(' ');
    const embedding = await generateEmbedding(embeddingText);

    const { error } = await supabase.from('competitors').upsert(
      { ...comp, embedding },
      { onConflict: 'name' },
    );

    if (error) {
      console.error(`Error inserting ${comp.name}:`, error.message);
    } else {
      console.log(`✓ ${comp.name}`);
      inserted++;
    }
  }

  console.log(`\nDone. ${inserted}/${COMPETITORS.length} competitors seeded.`);
}

seed().catch(console.error);
