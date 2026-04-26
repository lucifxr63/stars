/**
 * Seed script: adds embeddings to existing mentors in Supabase.
 * Run with: npx tsx scripts/seedMentors.ts
 * Requires VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY in .env.local
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

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
  console.log('Fetching mentors without embeddings...');
  // Ojo: podemos forzar o solo actualizar los que tienen embedding en null
  const { data: mentors, error: fetchError } = await supabase
    .from('mentors')
    .select('*')
    .is('embedding', null);

  if (fetchError) {
    console.error('Error fetching mentors:', fetchError.message);
    return;
  }

  if (!mentors || mentors.length === 0) {
    console.log('No mentors found or all mentors already have embeddings.');
    return;
  }

  console.log(`Generating embeddings for ${mentors.length} mentors...`);
  let updated = 0;

  for (const mentor of mentors) {
    // Texto semántico clave para el matching
    const embeddingText = [
      mentor.name,
      mentor.bio,
      ...(mentor.expertise ?? []),
      ...(mentor.languages ?? [])
    ].join(' ');

    const embedding = await generateEmbedding(embeddingText);

    const { error } = await supabase
      .from('mentors')
      .update({ embedding })
      .eq('id', mentor.id);

    if (error) {
      console.error(`Error updating ${mentor.name}:`, error.message);
    } else {
      console.log(`✓ ${mentor.name}`);
      updated++;
    }
  }

  console.log(`\nDone. ${updated}/${mentors.length} mentors updated with embeddings.`);
}

seed().catch(console.error);
