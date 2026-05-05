/**
 * Seed script: inserts RAG playbook documents into Supabase with OpenAI embeddings.
 * Run with: npx tsx scripts/seedRagPlaybooks.ts
 * Requires VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY in .env.local
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

const PLAYBOOKS = [
  {
    title: 'Playbook de Validación de Ideas',
    sourceFile: 'rag_01_validacion.md',
    tags: ['VALIDATION', 'MOM_TEST', 'JTBD', 'METHODOLOGY'],
  },
  {
    title: 'Playbook de Unit Economics y Finanzas',
    sourceFile: 'rag_02_economics.md',
    tags: ['UNIT_ECONOMICS', 'FINANCE', 'BENCHMARKS', 'LATAM'],
  },
  {
    title: 'Playbook Legal Chile (Fintech)',
    sourceFile: 'rag_03_legal_chile.md',
    tags: ['LEGAL', 'CHILE', 'FINTECH', 'COMPLIANCE'],
  },
  {
    title: 'Playbook de Tech Stack y MVP',
    sourceFile: 'rag_04_tech_stack.md',
    tags: ['TECH', 'NO_CODE', 'MVP', 'ARCHITECTURE'],
  },
  {
    title: 'Playbook de Estrategia GTM y Growth',
    sourceFile: 'rag_05_growth.md',
    tags: ['GROWTH', 'GTM', 'B2B_SALES', 'PLG'],
  },
  {
    title: 'Playbook de Fundraising y Capital',
    sourceFile: 'rag_06_funding.md',
    tags: ['FUNDING', 'VC', 'PITCH_DECK', 'LATAM'],
  },
  {
    title: 'Playbook de Estrategia de Producto e IA',
    sourceFile: 'rag_07_product_ai.md',
    tags: ['PRODUCT_STRATEGY', 'AI', 'BLUE_OCEAN', 'UX'],
  },
  {
    title: 'Playbook de Psicología del Fundador',
    sourceFile: 'rag_08_psychology.md',
    tags: ['PSYCHOLOGY', 'BIASES', 'FOUNDER_RISK', 'POST_MORTEM'],
  },
];

// Markdown files live one level above the validateai/ package
const DOCS_ROOT = path.resolve(__dirname, '../../');

async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding as number[];
}

async function seed() {
  console.log(`Seeding ${PLAYBOOKS.length} RAG playbooks...\n`);
  let inserted = 0;

  for (const playbook of PLAYBOOKS) {
    const filePath = path.join(DOCS_ROOT, playbook.sourceFile);

    if (!fs.existsSync(filePath)) {
      console.error(`✗ File not found: ${filePath}`);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    // Embed title + content so the vector captures both topic and detail
    const embeddingInput = `${playbook.title}\n\n${content}`;
    const embedding = await generateEmbedding(embeddingInput);

    const { error } = await supabase.from('rag_playbooks').upsert(
      {
        title: playbook.title,
        source_file: playbook.sourceFile,
        content,
        tags: playbook.tags,
        embedding,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'source_file' },
    );

    if (error) {
      console.error(`✗ ${playbook.sourceFile}:`, error.message);
    } else {
      console.log(`✓ ${playbook.title} [${playbook.tags.join(', ')}]`);
      inserted++;
    }
  }

  console.log(`\nDone. ${inserted}/${PLAYBOOKS.length} playbooks seeded.`);
}

seed().catch(console.error);
