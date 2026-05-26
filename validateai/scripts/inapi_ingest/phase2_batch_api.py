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
    print('Exportando brand_name/title desde la DB...')
    page, total = 0, 0

    with open(JSONL_FILE, 'w', encoding='utf-8') as out:
        while True:
            resp = req.get(
                f'{SUPABASE_URL}/rest/v1/{TABLE}',
                headers={'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}'},
                params={
                    'select': 'id,application_number,brand_name,title',
                    'brand_name_embedding': 'is.null',
                    'limit':  '1000',
                    'offset': str(page * 1000),
                },
                timeout=30,
            )
            records = resp.json()
            if not records:
                break

            for r in records:
                text = ' '.join(filter(None, [r.get('brand_name') or '', r.get('title') or ''])).strip()
                if not text:
                    text = 'sin_nombre'   # placeholder para no perder el id

                line = {
                    'custom_id': f"{r['id']}|{r['application_number']}",
                    'method':    'POST',
                    'url':       '/v1/embeddings',
                    'body': {
                        'model': MODEL,
                        'input': text,
                    }
                }
                out.write(json.dumps(line) + '\n')
                total += 1

            page += 1
            print(f'  {total:,} registros exportados...', end='\r', flush=True)

    print(f'\n  Total exportados: {total:,}  →  {JSONL_FILE}')

    if total == 0:
        print('  Nada que procesar — todos los registros ya tienen embedding.')
        return

    # Subir el JSONL a OpenAI
    print('\nSubiendo archivo a OpenAI...')
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
    print(f'\nEjecuta cuando termine:')
    print(f'  py phase2_batch_api.py status   ← revisar estado')
    print(f'  py phase2_batch_api.py import   ← importar resultados')


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
