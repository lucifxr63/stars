"""
Fase 1: Inserción masiva de registros INAPI en inapi_records.
Sin embeddings — solo datos estructurados. Idempotente (upsert por application_number).
"""
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from toon_parser import stream_records
from supabase_client import upsert

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / '.env')

TOON_FILES = [
    r'C:\INAPI\marcas_presentadas.toon',
    r'C:\INAPI\marcas_registradas.toon',
    r'C:\INAPI\patentes_presentadas.toon',
    r'C:\INAPI\patentes_registradas.toon',
]

BATCH_SIZE = 300   # registros por request POST — Supabase acepta hasta ~1000

TABLE = 'inapi_records'


def dedup(batch: list[dict]) -> list[dict]:
    """Elimina duplicados de application_number dentro del batch, queda el último."""
    seen = {}
    for r in batch:
        seen[r['application_number']] = r
    return list(seen.values())


def process_file(filepath: str) -> tuple[int, int]:
    """Retorna (insertados, errores)."""
    name = Path(filepath).name
    buffer: list[dict] = []
    total = 0
    errors = 0

    for record in stream_records(filepath):
        buffer.append(record)

        if len(buffer) >= BATCH_SIZE:
            clean = dedup(buffer)
            try:
                upsert(TABLE, clean)
                total += len(clean)
            except Exception as e:
                print(f'\n  [ERROR] batch en {name}: {e}')
                errors += len(clean)
            buffer = []
            print(f'  {total:,} registros...', end='\r', flush=True)

    if buffer:
        clean = dedup(buffer)
        try:
            upsert(TABLE, clean)
            total += len(clean)
        except Exception as e:
            print(f'\n  [ERROR] último batch: {e}')
            errors += len(clean)

    return total, errors


def main():
    grand_total = 0
    grand_errors = 0
    start = time.time()

    for filepath in TOON_FILES:
        if not Path(filepath).exists():
            print(f'[SKIP] No encontrado: {filepath}')
            continue

        size_mb = Path(filepath).stat().st_size / 1_048_576
        print(f'\n{"="*55}')
        print(f'Procesando: {Path(filepath).name}  ({size_mb:.0f} MB)')
        t0 = time.time()

        inserted, errs = process_file(filepath)
        elapsed = time.time() - t0

        grand_total  += inserted
        grand_errors += errs
        print(f'  Completado: {inserted:,} registros en {elapsed:.0f}s  ({errs} errores)')

    elapsed_total = time.time() - start
    print(f'\n{"="*55}')
    print(f'FASE 1 COMPLETA')
    print(f'  Total insertados: {grand_total:,}')
    print(f'  Total errores:    {grand_errors:,}')
    print(f'  Tiempo total:     {elapsed_total/60:.1f} min')


if __name__ == '__main__':
    main()
