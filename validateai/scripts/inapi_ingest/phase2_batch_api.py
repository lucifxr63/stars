"""
Fase 2 via OpenAI Batch API.
Paso A (export): lee brand_name/title de la DB → archivo JSONL → sube a OpenAI → guarda batch_id.
Paso B (import): descarga resultados del batch → upsert embeddings a la DB en bloques.

Uso:
  py phase2_batch_api.py export   # crea el job en OpenAI (esperar 1-2 horas)
  py phase2_batch_api.py status   # ver si terminó
  py phase2_batch_api.py import   # descargar e insertar embeddings

El batch_id se guarda en C:\INAPI\batch_id.txt para retomar entre pasos.
"""
import os
import sys
import json
import time
import requests as req
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / '.env')
sys.path.insert(0, str(Path(__file__).parent))
from supabase_client import SUPABASE_URL, SERVICE_KEY

OPENAI_KEY = os.environ.get('OPENAI_API_KEY', '')
client  = OpenAI(api_key=OPENAI_KEY)
MODEL   = 'text-embedding-3-small'
TABLE   = 'inapi_records'
BATCH_ID_FILE = Path(r'C:\INAPI\batch_id.txt')
JSONL_FILE    = Path(r'C:\INAPI\embeddings_input.jsonl')
RESULT_FILE   = Path(r'C:\INAPI\embeddings_output.jsonl')
DB_BATCH      = 25   # filas por upsert (sin ivfflat el timeout no debería ocurrir)

SB_HEADERS = {
    'apikey':        SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type':  'application/json',
    'Prefer':        'resolution=merge-duplicates,return=minimal',
}


# ── PASO A: EXPORT ────────────────────────────────────────────────────────────

def export_and_submit():
    """
    Exporta usando paginación por cursor (id > last_id) en vez de OFFSET.
    OFFSET se vuelve O(n) en PostgreSQL — a 170K registros ya se congela.
    Con cursor cada página es O(1) gracias al índice del PK.

    Instrumentación de latencia: registra el tiempo de cada página para validar
    que el cursor mantiene latencia estable independiente del volumen acumulado.
    Una degradación creciente indicaría un índice caído o un plan de ejecución
    que volvió a escanear secuencialmente.
    """
    print('Exportando brand_name/title desde la DB (cursor pagination)...')
    total      = 0
    last_id    = '00000000-0000-0000-0000-000000000000'  # UUID mínimo como punto de partida
    PAGE       = 1000
    page_num   = 0
    latencies: list[float] = []

    with open(JSONL_FILE, 'w', encoding='utf-8') as out:
        while True:
            t0 = time.perf_counter()
            resp = req.get(
                f'{SUPABASE_URL}/rest/v1/{TABLE}',
                headers={'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}'},
                params={
                    'select':                 'id,application_number,brand_name,title',
                    'brand_name_embedding':   'is.null',
                    'id':                     f'gt.{last_id}',   # cursor
                    'order':                  'id.asc',
                    'limit':                  str(PAGE),
                },
                timeout=30,
            )
            elapsed_ms = (time.perf_counter() - t0) * 1000

            if not resp.ok:
                print(f'\n[ERROR] {resp.status_code}: {resp.text[:200]}')
                break

            records = resp.json()
            if not records:
                break

            latencies.append(elapsed_ms)
            page_num += 1

            for r in records:
                text = ' '.join(filter(None, [r.get('brand_name') or '', r.get('title') or ''])).strip()
                if not text:
                    text = 'sin_nombre'

                out.write(json.dumps({
                    'custom_id': f"{r['id']}|{r['application_number']}",
                    'method':    'POST',
                    'url':       '/v1/embeddings',
                    'body':      {'model': MODEL, 'input': text},
                }) + '\n')
                total += 1

            last_id = records[-1]['id']   # avanzar cursor al último id de la página

            # Imprimir latencia cada 10 páginas para detectar regresión O(n) residual
            if page_num % 10 == 0:
                window = latencies[-10:]
                avg_w  = sum(window) / len(window)
                print(
                    f'  {total:,} registros | pág {page_num} | '
                    f'p10-avg={avg_w:.0f}ms  última={elapsed_ms:.0f}ms',
                    end='\r', flush=True,
                )
            else:
                print(f'  {total:,} registros exportados...', end='\r', flush=True)

    # Resumen de latencia final
    if latencies:
        s = sorted(latencies)
        avg_ms = sum(latencies) / len(latencies)
        p50_ms = s[len(s) // 2]
        p95_ms = s[min(int(len(s) * 0.95), len(s) - 1)]
        print(f'\n  Total exportados: {total:,} en {page_num} páginas  →  {JSONL_FILE}')
        print(f'  Latencia cursor:  avg={avg_ms:.0f}ms  p50={p50_ms:.0f}ms  p95={p95_ms:.0f}ms')
        if p95_ms > 5_000:
            print('  [WARN] p95 > 5 000 ms — revisar índice PK o latencia de red al DB')
    else:
        print(f'\n  Total exportados: {total:,}  ->  {JSONL_FILE}')

    if total == 0:
        print('  Nada que procesar -- todos los registros ya tienen embedding.')
        return

    _submit_jsonl()


def _submit_jsonl():
    # Subir el JSONL a OpenAI
    print('\nSubiendo archivo a OpenAI ({:.0f} MB)...'.format(JSONL_FILE.stat().st_size / 1_048_576))
    with open(JSONL_FILE, 'rb') as f:
        uploaded = client.files.create(file=f, purpose='batch')
    print(f'  File ID: {uploaded.id}')

    # Crear el batch job
    batch = client.batches.create(
        input_file_id=uploaded.id,
        endpoint='/v1/embeddings',
        completion_window='24h',
    )
    BATCH_ID_FILE.write_text(batch.id)
    print(f'\nBatch creado: {batch.id}')
    print(f'Estado:       {batch.status}')
    print('\nEjecuta cuando termine:')
    print('  py phase2_batch_api.py status   <- revisar estado')
    print('  py phase2_batch_api.py import   <- importar resultados')


# ── PASO B: STATUS ────────────────────────────────────────────────────────────

def check_status():
    if not BATCH_ID_FILE.exists():
        print('No hay batch_id.txt — ejecuta primero: py phase2_batch_api.py export')
        return
    batch_id = BATCH_ID_FILE.read_text().strip()
    batch = client.batches.retrieve(batch_id)
    print(f'Batch ID:      {batch.id}')
    print(f'Estado:        {batch.status}')
    print(f'Total:         {batch.request_counts.total:,}')
    print(f'Completados:   {batch.request_counts.completed:,}')
    print(f'Fallidos:      {batch.request_counts.failed:,}')
    if batch.status == 'completed':
        print(f'\n✓ Listo. Ejecuta: py phase2_batch_api.py import')
    elif batch.status in ('failed', 'expired', 'cancelled'):
        print(f'\n✗ El batch falló. Vuelve a ejecutar export.')


# ── PASO C: IMPORT ────────────────────────────────────────────────────────────

def import_results():
    if not BATCH_ID_FILE.exists():
        print('No hay batch_id.txt')
        return

    batch_id = BATCH_ID_FILE.read_text().strip()
    batch = client.batches.retrieve(batch_id)

    if batch.status != 'completed':
        print(f'El batch aún no terminó. Estado: {batch.status}')
        return

    print(f'Descargando resultados ({batch.request_counts.completed:,} embeddings)...')
    content = client.files.content(batch.output_file_id)
    RESULT_FILE.write_bytes(content.read())
    print(f'  Guardado en {RESULT_FILE}')

    # Parsear y subir a DB
    print('Importando embeddings a la DB...')
    buffer = []
    total  = 0
    errors = 0

    with open(RESULT_FILE, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)

            if obj.get('error'):
                errors += 1
                continue

            custom_id  = obj['custom_id']           # "uuid|application_number"
            record_id, app_num = custom_id.split('|', 1)
            embedding  = obj['response']['body']['data'][0]['embedding']

            buffer.append({
                'id':                   record_id,
                'application_number':   app_num,
                'brand_name_embedding': embedding,
            })

            if len(buffer) >= DB_BATCH:
                _upsert_batch(buffer)
                total  += len(buffer)
                buffer  = []
                print(f'  {total:,} embeddings insertados...', end='\r', flush=True)

    if buffer:
        _upsert_batch(buffer)
        total += len(buffer)

    print(f'\n\nFASE 2 COMPLETA')
    print(f'  Embeddings insertados: {total:,}')
    print(f'  Errores en batch:      {errors:,}')

    if total > 0:
        print('\nAhora crea el índice vectorial:')
        print('  py phase2_batch_api.py index')


def _upsert_batch(rows: list[dict]) -> None:
    for attempt in range(3):
        resp = req.post(
            f'{SUPABASE_URL}/rest/v1/{TABLE}',
            headers=SB_HEADERS,
            params={'on_conflict': 'id'},
            data=json.dumps(rows),
            timeout=60,
        )
        if resp.ok:
            return
        if attempt < 2:
            time.sleep(3)
    print(f'\n  [WARN] upsert fallido: {resp.status_code} {resp.text[:100]}')


# ── PASO D: INDEX ─────────────────────────────────────────────────────────────

def create_index():
    print('Creando índice ivfflat (esto tarda 5-15 min)...')
    ACCESS_TOKEN = os.environ.get('SUPABASE_ACCESS_TOKEN', '')
    PROJECT_REF  = os.environ.get('SUPABASE_PROJECT_REF', '')

    sql = '''
    CREATE INDEX IF NOT EXISTS inapi_brand_vec_idx
      ON inapi_records USING ivfflat (brand_name_embedding vector_cosine_ops)
      WITH (lists = 1200);
    ANALYZE inapi_records;
    '''
    resp = req.post(
        f'https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query',
        headers={'Authorization': f'Bearer {ACCESS_TOKEN}', 'Content-Type': 'application/json'},
        json={'query': sql},
        timeout=120,
    )
    if resp.ok:
        print('✓ Índice creado. La tabla está lista para búsquedas semánticas.')
    else:
        print(f'Error: {resp.status_code} {resp.text[:200]}')


# ── MAIN ──────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'help'
    if cmd == 'export':
        export_and_submit()
    elif cmd == 'submit':
        _submit_jsonl()   # sube el JSONL ya existente sin re-exportar
    elif cmd == 'status':
        check_status()
    elif cmd == 'import':
        import_results()
    elif cmd == 'index':
        create_index()
    else:
        print('Uso:')
        print('  py phase2_batch_api.py export   # exportar y enviar a OpenAI Batch API')
        print('  py phase2_batch_api.py status   # ver estado del batch')
        print('  py phase2_batch_api.py import   # importar embeddings al terminar')
        print('  py phase2_batch_api.py index    # crear índice ivfflat final')
