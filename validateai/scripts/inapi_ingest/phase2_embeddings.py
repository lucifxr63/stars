"""
Fase 2: Embeddings de brand_name/title para todos los registros en inapi_records.
Estrategia: lee siempre WHERE embedding IS NULL (sin offset), procesa en batch,
upsert de vuelta con {id, brand_name_embedding}. Idempotente y reanudable.
"""
import os
import sys
import time
import json
import requests as req
from pathlib import Path
from openai import OpenAI

sys.path.insert(0, str(Path(__file__).parent))
from supabase_client import SUPABASE_URL, SERVICE_KEY

OPENAI_KEY = os.environ.get('OPENAI_API_KEY', '')

openai_client = OpenAI(api_key=OPENAI_KEY)

MODEL        = 'text-embedding-3-small'
PAGE_SIZE    = 500   # registros leídos de DB por vuelta
EMBED_BATCH  = 500   # textos por llamada a OpenAI
DB_BATCH     = 200   # filas por upsert a Supabase (sin ivfflat activo los UPDATEs son rápidos)
TABLE        = 'inapi_records'

HEADERS = {
    'apikey':        SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type':  'application/json',
    'Prefer':        'resolution=merge-duplicates,return=minimal',
}


def fetch_page() -> list[dict]:
    """Lee PAGE_SIZE registros sin embedding. Sin offset — siempre desde el inicio del set nulo."""
    resp = req.get(
        f'{SUPABASE_URL}/rest/v1/{TABLE}',
        headers={'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}'},
        params={
            'select':                 'id,application_number,brand_name,title',
            'brand_name_embedding':   'is.null',
            'limit':                  str(PAGE_SIZE),
        },
        timeout=30,
    )
    if not resp.ok:
        raise RuntimeError(f'Fetch error {resp.status_code}: {resp.text[:200]}')
    return resp.json()


def get_text(record: dict) -> str:
    parts = [record.get('brand_name') or '', record.get('title') or '']
    return ' '.join(p.strip() for p in parts if p.strip())


def get_embeddings(texts: list[str]) -> list[list[float]]:
    resp = openai_client.embeddings.create(model=MODEL, input=texts)
    return [item.embedding for item in resp.data]


def bulk_upsert_embeddings(rows: list[dict]) -> None:
    """Upsert batch de {id, brand_name_embedding} usando id como conflict key."""
    resp = req.post(
        f'{SUPABASE_URL}/rest/v1/{TABLE}',
        headers=HEADERS,
        params={'on_conflict': 'id'},
        data=json.dumps(rows),
        timeout=60,
    )
    if not resp.ok:
        raise RuntimeError(f'Upsert error {resp.status_code}: {resp.text[:300]}')


def main():
    total = 0
    cycles = 0
    start  = time.time()

    print('FASE 2: Generando embeddings...')
    print(f'  Batch OpenAI: {EMBED_BATCH} textos  |  Batch DB: {PAGE_SIZE} registros\n')

    while True:
        # 1. Leer página de registros sin embedding
        try:
            records = fetch_page()
        except Exception as e:
            print(f'\n[ERROR] fetch: {e}')
            time.sleep(5)
            continue

        if not records:
            break  # todos tienen embedding

        # 2. Filtrar los que tienen texto útil
        valid = [(r['id'], get_text(r)) for r in records if get_text(r)]
        if not valid:
            # Registros sin brand_name ni title — marcar con vector vacío para no quedar en bucle
            empty_rows = [{'id': r['id'], 'application_number': r['application_number'], 'brand_name_embedding': [0.0] * 1536} for r in records]
            bulk_upsert_embeddings(empty_rows)
            continue

        # 3. Generar embeddings en sub-batches de EMBED_BATCH
        upsert_rows = []
        for i in range(0, len(valid), EMBED_BATCH):
            sub = valid[i:i + EMBED_BATCH]
            ids   = [x[0] for x in sub]
            texts = [x[1] for x in sub]
            try:
                embeddings = get_embeddings(texts)
            except Exception as e:
                print(f'\n[ERROR] OpenAI: {e}')
                time.sleep(10)
                continue
            id_to_appnum = {r['id']: r['application_number'] for r in records}
            upsert_rows.extend(
                {'id': id_, 'application_number': id_to_appnum[id_], 'brand_name_embedding': emb}
                for id_, emb in zip(ids, embeddings)
            )

        # 4. Upsert en sub-batches de DB_BATCH para evitar statement timeout
        failed = 0
        for i in range(0, len(upsert_rows), DB_BATCH):
            sub = upsert_rows[i:i + DB_BATCH]
            try:
                bulk_upsert_embeddings(sub)
            except Exception as e:
                print(f'\n[ERROR] upsert sub-batch: {e}')
                failed += len(sub)
                time.sleep(3)
        if failed:
            continue

        total  += len(upsert_rows)
        cycles += 1
        elapsed = time.time() - start
        rate    = total / elapsed if elapsed > 0 else 0
        eta_min = ((1_438_027 - total) / rate / 60) if rate > 0 else 0

        print(
            f'  [{cycles:>4} ciclos]  {total:>9,} embeddings  |  '
            f'{rate:>5.0f} reg/s  |  '
            f'ETA ~{eta_min:.0f} min',
            end='\r', flush=True
        )

    elapsed = time.time() - start
    print(f'\n\nFASE 2 COMPLETA')
    print(f'  Embeddings generados: {total:,}')
    print(f'  Tiempo total:         {elapsed/60:.1f} min')


if __name__ == '__main__':
    main()
