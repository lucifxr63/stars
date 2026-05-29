"""
Fase 2 via OpenAI Batch API.
Paso A (export): lee brand_name/title de la DB → archivo JSONL → sube a OpenAI → guarda batch_id.
Paso B (import): descarga resultados del batch → upsert embeddings a la DB en bloques.

Uso:
  py phase2_batch_api.py export   # crea el job en OpenAI (esperar 1-2 horas)
  py phase2_batch_api.py status   # ver si terminó
  py phase2_batch_api.py import   # descargar e insertar embeddings

El batch_id se guarda en C:\\INAPI\\batch_id.txt para retomar entre pasos.
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

OPENAI_KEY    = os.environ.get('OPENAI_API_KEY', '')
client  = OpenAI(api_key=OPENAI_KEY)
MODEL   = 'text-embedding-3-small'
TABLE   = 'inapi_records'
BATCH_ID_FILE = Path(r'C:\INAPI\batch_id.txt')
JSONL_FILE    = Path(r'C:\INAPI\embeddings_input.jsonl')
RESULT_FILE   = Path(r'C:\INAPI\embeddings_output.jsonl')
DB_BATCH      = 25   # filas por upsert (sin ivfflat el timeout no debería ocurrir)

# Alertas de degradación de latencia (opcionales; dejar vacíos para deshabilitar)
# Soporta Slack (https://hooks.slack.com/...) y Discord (https://discord.com/api/webhooks/...)
WEBHOOK_URL          = os.environ.get('SLACK_WEBHOOK_URL', '') or os.environ.get('DISCORD_WEBHOOK_URL', '')
SUPABASE_ACCESS_TOKEN = os.environ.get('SUPABASE_ACCESS_TOKEN', '')
SUPABASE_PROJECT_REF  = os.environ.get('SUPABASE_PROJECT_REF', '')

SB_HEADERS = {
    'apikey':        SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type':  'application/json',
    'Prefer':        'resolution=merge-duplicates,return=minimal',
}


# ── Helpers de diagnóstico ────────────────────────────────────────────────────

def run_explain_analyze(cursor_id: str) -> str:
    """
    Ejecuta EXPLAIN (ANALYZE, BUFFERS) de la query de cursor contra la página
    más lenta, usando la Supabase Management API.
    Devuelve el plan como texto plano, o un mensaje de error si no está configurado.
    """
    if not SUPABASE_ACCESS_TOKEN or not SUPABASE_PROJECT_REF:
        return '(SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF no configurados — EXPLAIN omitido)'

    sql = f"""
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, application_number, brand_name, title
FROM {TABLE}
WHERE brand_name_embedding IS NULL
  AND id > '{cursor_id}'
ORDER BY id ASC
LIMIT 1000;
""".strip()

    try:
        r = req.post(
            f'https://api.supabase.com/v1/projects/{SUPABASE_PROJECT_REF}/database/query',
            headers={
                'Authorization': f'Bearer {SUPABASE_ACCESS_TOKEN}',
                'Content-Type':  'application/json',
            },
            json={'query': sql},
            timeout=60,
        )
        if r.ok:
            rows = r.json()
            # La API devuelve [{"QUERY PLAN": "..."}, ...] en formato texto
            lines = [row.get('QUERY PLAN', '') for row in rows if 'QUERY PLAN' in row]
            return '\n'.join(lines) if lines else r.text[:2000]
        return f'[HTTP {r.status_code}] {r.text[:500]}'
    except Exception as exc:
        return f'[Exception] {exc}'


def send_webhook_alert(summary: str, explain_plan: str) -> None:
    """
    Envía una alerta de degradación de latencia a Slack o Discord.
    Detecta el destino por el prefijo de la URL.
    No lanza excepciones — fallo silencioso para no interrumpir la ingesta.
    """
    if not WEBHOOK_URL:
        return

    body_text = (
        f'*[INAPI LATENCY ALERT]* p95 de cursor pagination superó 5 000 ms\n\n'
        f'{summary}\n\n'
        f'```\n{explain_plan[:1900]}\n```'
    )

    is_discord = 'discord.com' in WEBHOOK_URL
    payload = {'content': body_text} if is_discord else {'text': body_text}

    try:
        r = req.post(WEBHOOK_URL, json=payload, timeout=10)
        if not r.ok:
            print(f'\n  [WARN] Webhook alert falló: {r.status_code}')
    except Exception as exc:
        print(f'\n  [WARN] Webhook alert excepción: {exc}')


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
    # Cada entry: (elapsed_ms, cursor_id_usado_en_esa_página)
    # El cursor_id permite reproducir el EXPLAIN ANALYZE exacto de la página lenta.
    latencies: list[tuple[float, str]] = []

    with open(JSONL_FILE, 'w', encoding='utf-8') as out:
        while True:
            cursor_before = last_id   # capturar antes del request para el EXPLAIN
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

            latencies.append((elapsed_ms, cursor_before))
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
                window_ms = [ms for ms, _ in latencies[-10:]]
                avg_w     = sum(window_ms) / len(window_ms)
                print(
                    f'  {total:,} registros | pág {page_num} | '
                    f'p10-avg={avg_w:.0f}ms  última={elapsed_ms:.0f}ms',
                    end='\r', flush=True,
                )
            else:
                print(f'  {total:,} registros exportados...', end='\r', flush=True)

    # ── Resumen de latencia y diagnóstico automático ──────────────────────────
    if latencies:
        ms_values = [ms for ms, _ in latencies]
        s          = sorted(ms_values)
        avg_ms     = sum(ms_values) / len(ms_values)
        p50_ms     = s[len(s) // 2]
        p95_ms     = s[min(int(len(s) * 0.95), len(s) - 1)]

        print(f'\n  Total exportados: {total:,} en {page_num} páginas  →  {JSONL_FILE}')
        print(f'  Latencia cursor:  avg={avg_ms:.0f}ms  p50={p50_ms:.0f}ms  p95={p95_ms:.0f}ms')

        if p95_ms > 5_000:
            # Identificar la página más lenta para reproducir el EXPLAIN exacto
            slowest_ms, slowest_cursor = max(latencies, key=lambda t: t[0])
            summary = (
                f'• Ingesta: {total:,} registros en {page_num} páginas\n'
                f'• avg={avg_ms:.0f}ms  p50={p50_ms:.0f}ms  p95={p95_ms:.0f}ms\n'
                f'• Página más lenta: {slowest_ms:.0f}ms  (cursor id > {slowest_cursor})'
            )
            print(f'\n  [WARN] p95 > 5 000 ms — ejecutando EXPLAIN ANALYZE de la página más lenta...')
            explain = run_explain_analyze(slowest_cursor)
            print(f'\n--- EXPLAIN ANALYZE (cursor={slowest_cursor[:8]}...) ---')
            print(explain[:2000])
            print('---')
            send_webhook_alert(summary, explain)
    else:
        print(f'\n  Total exportados: {total:,}  ->  {JSONL_FILE}')

    if total == 0:
        print('  Nada que procesar -- todos los registros ya tienen embedding.')
        return

    _submit_jsonl()


BATCH_MAX = 50_000   # OpenAI hard limit: 50k requests per batch


def _submit_jsonl():
    """Divide el JSONL en chunks de BATCH_MAX y sube un batch por chunk."""
    total_lines = sum(1 for _ in open(JSONL_FILE, encoding='utf-8'))
    n_batches   = (total_lines + BATCH_MAX - 1) // BATCH_MAX
    size_mb     = JSONL_FILE.stat().st_size / 1_048_576

    print(f'\n{total_lines:,} registros ({size_mb:.0f} MB) -> {n_batches} batches de {BATCH_MAX:,} max')

    # Borrar archivo de IDs anterior y empezar limpio
    BATCH_ID_FILE.write_text('')

    with open(JSONL_FILE, encoding='utf-8') as src:
        for chunk_idx in range(n_batches):
            lines = []
            for _ in range(BATCH_MAX):
                line = src.readline()
                if not line:
                    break
                lines.append(line)

            if not lines:
                break

            chunk_bytes = ''.join(lines).encode('utf-8')
            chunk_name  = f'inapi_chunk_{chunk_idx + 1:02d}.jsonl'

            print(f'  Subiendo chunk {chunk_idx + 1}/{n_batches} ({len(lines):,} filas)...', end=' ', flush=True)
            uploaded = client.files.create(
                file=(chunk_name, chunk_bytes, 'application/jsonl'),
                purpose='batch',
            )
            batch = client.batches.create(
                input_file_id=uploaded.id,
                endpoint='/v1/embeddings',
                completion_window='24h',
            )
            # Añadir ID al archivo (una línea por batch)
            with open(BATCH_ID_FILE, 'a') as fid:
                fid.write(batch.id + '\n')
            print(f'{batch.id}  [{batch.status}]')

    ids = [l.strip() for l in BATCH_ID_FILE.read_text().splitlines() if l.strip()]
    print(f'\n{len(ids)} batches creados. Ejecuta cuando terminen:')
    print('  py phase2_batch_api.py status')
    print('  py phase2_batch_api.py import')


# ── PASO B: STATUS ────────────────────────────────────────────────────────────

def _load_batch_ids() -> list[str]:
    if not BATCH_ID_FILE.exists():
        return []
    return [l.strip() for l in BATCH_ID_FILE.read_text().splitlines() if l.strip()]


def check_status():
    ids = _load_batch_ids()
    if not ids:
        print('No hay batch_id.txt — ejecuta primero: py phase2_batch_api.py export')
        return

    done = failed = running = 0
    total_req = total_ok = total_err = 0

    for bid in ids:
        b = client.batches.retrieve(bid)
        rc = b.request_counts
        total_req += rc.total
        total_ok  += rc.completed
        total_err += rc.failed
        status_tag = b.status.upper()
        print(f'  {bid}  [{status_tag}]  {rc.completed:,}/{rc.total:,}')
        if b.status == 'completed':
            done += 1
        elif b.status in ('failed', 'expired', 'cancelled'):
            failed += 1
        else:
            running += 1

    print(f'\nTotal: {len(ids)} batches  |  completados={done}  en_progreso={running}  fallidos={failed}')
    print(f'Embeddings: {total_ok:,} OK  /  {total_err:,} errores  /  {total_req:,} total')

    if done == len(ids):
        print('\n[OK] Todos los batches completos. Ejecuta: py phase2_batch_api.py import')
    elif failed:
        print(f'\n[WARN] {failed} batch(es) fallaron. Revisa los IDs y considera re-exportar solo esos rangos.')


# ── PASO C: IMPORT ────────────────────────────────────────────────────────────

def _import_from_batch(bid: str, buffer: list, total_ref: list, errors_ref: list) -> None:
    """Descarga e importa un batch completado. Modifica buffer/total_ref/errors_ref in-place."""
    b = client.batches.retrieve(bid)
    if b.status != 'completed':
        print(f'  [SKIP] {bid} no completado ({b.status})')
        return

    print(f'  Descargando {bid} ({b.request_counts.completed:,} embeddings)...')
    content = None
    for dl_attempt in range(5):
        try:
            content = client.files.content(b.output_file_id).read()
            break
        except Exception as exc:
            print(f'\n  [WARN] descarga error intento {dl_attempt+1}: {type(exc).__name__}: {str(exc)[:80]}')
            time.sleep(15 * (dl_attempt + 1))
    if content is None:
        print(f'  [ERROR] no se pudo descargar {bid} tras 5 intentos — saltando')
        return

    for line in content.decode('utf-8').splitlines():
        line = line.strip()
        if not line:
            continue
        obj = json.loads(line)

        if obj.get('error'):
            errors_ref[0] += 1
            continue

        custom_id  = obj['custom_id']
        record_id, app_num = custom_id.split('|', 1)
        embedding  = obj['response']['body']['data'][0]['embedding']

        buffer.append({
            'id':                   record_id,
            'application_number':   app_num,
            'brand_name_embedding': embedding,
        })

        if len(buffer) >= DB_BATCH:
            _upsert_batch(buffer)
            total_ref[0] += len(buffer)
            buffer.clear()
            print(f'  {total_ref[0]:,} embeddings insertados...', end='\r', flush=True)


def import_results():
    ids = _load_batch_ids()
    if not ids:
        print('No hay batch_id.txt')
        return

    # Esperar a que los FINALIZING pasen a COMPLETED (max 10 min)
    for attempt in range(20):
        statuses = {bid: client.batches.retrieve(bid).status for bid in ids}
        finalizing = [bid for bid, st in statuses.items() if st == 'finalizing']
        not_ready  = [bid for bid, st in statuses.items()
                      if st not in ('completed', 'finalizing', 'failed', 'expired', 'cancelled')]
        if not finalizing and not not_ready:
            break
        if finalizing:
            print(f'  Esperando {len(finalizing)} batch(es) en FINALIZING...', end='\r', flush=True)
            time.sleep(30)
        else:
            break

    failed_ids = [bid for bid in ids if client.batches.retrieve(bid).status
                  in ('failed', 'expired', 'cancelled')]
    skipped_ids = [bid for bid in ids if client.batches.retrieve(bid).status != 'completed']
    if skipped_ids and skipped_ids != failed_ids:
        print(f'\nEstos batches aun no terminaron (seran omitidos):')
        for bid in skipped_ids:
            b = client.batches.retrieve(bid)
            print(f'  {bid}  [{b.status}]')
    if failed_ids:
        print(f'\n{len(failed_ids)} batch(es) fallados — sus registros no tendran embedding aun.')

    print(f'Importando {len(ids)} batches a la DB...')
    buffer   = []
    total    = [0]
    errors   = [0]

    for i, bid in enumerate(ids, 1):
        print(f'\n[{i}/{len(ids)}] {bid}')
        _import_from_batch(bid, buffer, total, errors)

    if buffer:
        _upsert_batch(buffer)
        total[0] += len(buffer)

    print(f'\n\nFASE 2 COMPLETA')
    print(f'  Embeddings insertados: {total[0]:,}')
    print(f'  Errores en batch:      {errors[0]:,}')

    if total[0] > 0:
        print('\nAhora crea el indice vectorial:')
        print('  py phase2_batch_api.py index')


def _upsert_batch(rows: list[dict]) -> None:
    resp = None
    for attempt in range(5):
        try:
            resp = req.post(
                f'{SUPABASE_URL}/rest/v1/{TABLE}',
                headers=SB_HEADERS,
                params={'on_conflict': 'id'},
                data=json.dumps(rows),
                timeout=90,
            )
            if resp.ok:
                return
            print(f'\n  [WARN] upsert HTTP {resp.status_code} intento {attempt+1}')
        except req.exceptions.RequestException as exc:
            print(f'\n  [WARN] conexion error intento {attempt+1}: {type(exc).__name__}')
        wait = 10 * (attempt + 1)   # 10s, 20s, 30s, 40s
        time.sleep(wait)
    status = resp.status_code if resp is not None else 'N/A'
    body   = resp.text[:100] if resp is not None else '(sin respuesta)'
    print(f'\n  [ERROR] upsert fallido tras 5 intentos: {status} {body}')


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
        print('[OK] Indice creado. La tabla esta lista para busquedas semanticas.')
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
