-- ============================================================
-- ValidateAI — Fase 4.1: Sistema de Mentores
-- ============================================================

-- Tabla principal de mentores
create table if not exists public.mentors (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  bio             text,
  expertise       text[],          -- industrias/áreas de conocimiento
  linkedin_url    text,
  calendly_url    text,            -- link directo a agendar
  availability    text default 'available'
                  check (availability in ('available', 'waitlist', 'unavailable')),
  session_price_clp int,
  languages       text[] default array['es'],
  photo_url       text,
  embedding       vector(1536),    -- para matching semántico con ideas
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- RLS: cualquiera puede leer mentores, solo service_role puede escribir
alter table public.mentors enable row level security;

create policy "Public read mentors"
  on public.mentors for select
  using (true);

-- Índice vectorial
create index if not exists mentors_embedding_idx
  on public.mentors using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

-- Función de matching semántico mentor ↔ idea
create or replace function search_mentors(
  query_embedding vector(1536),
  match_threshold float  default 0.50,
  match_count     int    default 3
)
returns table (
  id                uuid,
  name              text,
  bio               text,
  expertise         text[],
  linkedin_url      text,
  calendly_url      text,
  availability      text,
  session_price_clp int,
  languages         text[],
  photo_url         text,
  similarity        float
)
language sql stable
as $$
  select
    id, name, bio, expertise, linkedin_url,
    calendly_url, availability, session_price_clp,
    languages, photo_url,
    1 - (embedding <=> query_embedding) as similarity
  from public.mentors
  where
    availability = 'available'
    and embedding is not null
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================
-- SEED — 6 mentores de ejemplo (sin embedding real, se puede
-- actualizar con el script seedMentors.ts)
-- ============================================================
insert into public.mentors
  (name, bio, expertise, linkedin_url, calendly_url, availability, session_price_clp, languages, photo_url)
values
  (
    'Valentina Rojas',
    'Ex-Product Manager en Cornershop y Betterfly. Especialista en validación de ideas y PMF en mercados latinoamericanos.',
    array['saas', 'marketplace', 'product-market-fit', 'growth'],
    'https://linkedin.com/in/valentina-rojas',
    'https://cal.com/valentinarojas',
    'available', 80000, array['es'], null
  ),
  (
    'Diego Muñoz',
    'Fundador de 2 startups fintech. Experto en modelos de negocio B2B, ventas enterprise y fundraising en LATAM.',
    array['fintech', 'b2b', 'fundraising', 'ventas'],
    'https://linkedin.com/in/diego-munoz',
    'https://cal.com/diegomunoz',
    'available', 100000, array['es', 'en'], null
  ),
  (
    'Camila Soto',
    'Directora de innovación en una corporación de salud. Conoce los mecanismos de compra en el sector público y privado.',
    array['healthtech', 'sector-publico', 'b2b', 'innovacion'],
    'https://linkedin.com/in/camila-soto',
    null,
    'waitlist', 70000, array['es'], null
  ),
  (
    'Matías Fernández',
    'CTO técnico con experiencia en escalar startups de 0 a 1M usuarios. Especialista en arquitectura cloud y equipos técnicos.',
    array['saas', 'arquitectura', 'equipo-tecnico', 'escalabilidad'],
    'https://linkedin.com/in/matias-fernandez',
    'https://cal.com/matiasfernandez',
    'available', 90000, array['es'], null
  ),
  (
    'Andrea Torres',
    'Experta en marketing digital y growth hacking para startups B2C. Ha escalado marcas en Chile, Colombia y México.',
    array['b2c', 'growth', 'marketing', 'ecommerce', 'foodtech'],
    'https://linkedin.com/in/andrea-torres',
    'https://cal.com/andreatorres',
    'available', 75000, array['es'], null
  ),
  (
    'Roberto Vega',
    'Abogado especializado en startups. Estructura societaria, contratos, propiedad intelectual y regulación en LATAM.',
    array['legal', 'regulatorio', 'propiedad-intelectual', 'fintech', 'healthtech'],
    'https://linkedin.com/in/roberto-vega',
    null,
    'available', 120000, array['es'], null
  )
on conflict do nothing;
