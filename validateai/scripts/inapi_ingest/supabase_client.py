"""
Cliente HTTP minimalista para Supabase REST API.
Evita el paquete supabase-py que requiere compilación C++ en Windows.
"""
import os
import json
import requests
from typing import Any

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SERVICE_KEY  = os.environ.get('SUPABASE_SERVICE_KEY', '')

_HEADERS = {
    'apikey':          SERVICE_KEY,
    'Authorization':   f'Bearer {SERVICE_KEY}',
    'Content-Type':    'application/json',
    'Prefer':          'resolution=merge-duplicates,return=minimal',
}


def upsert(table: str, rows: list[dict], conflict_col: str = 'application_number') -> int:
    """
    Upsert en bloque. Retorna cantidad de filas afectadas.
    conflict_col: columna UNIQUE usada para detectar duplicados (PostgREST requiere on_conflict en URL).
    """
    resp = requests.post(
        f'{SUPABASE_URL}/rest/v1/{table}',
        headers={**_HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal'},
        params={'on_conflict': conflict_col},
        data=json.dumps(rows, default=str),
        timeout=60,
    )
    if not resp.ok:
        raise RuntimeError(f'Supabase upsert error {resp.status_code}: {resp.text[:300]}')
    return len(rows)


def select(table: str, columns: str, filters: dict | None = None,
           limit: int = 1000, offset: int = 0) -> list[dict]:
    """Select con filtros simples (campo=valor exacto)."""
    params: dict[str, Any] = {'select': columns, 'limit': limit, 'offset': offset}
    if filters:
        for k, v in filters.items():
            params[k] = f'eq.{v}'

    resp = requests.get(
        f'{SUPABASE_URL}/rest/v1/{table}',
        headers=_HEADERS,
        params=params,
        timeout=60,
    )
    if not resp.ok:
        raise RuntimeError(f'Supabase select error {resp.status_code}: {resp.text[:300]}')
    return resp.json()


def update_embedding(table: str, record_id: str, embedding: list[float]) -> None:
    """Actualiza solo la columna brand_name_embedding para un registro."""
    resp = requests.patch(
        f'{SUPABASE_URL}/rest/v1/{table}',
        headers={**_HEADERS, 'Prefer': 'return=minimal'},
        params={'id': f'eq.{record_id}'},
        data=json.dumps({'brand_name_embedding': embedding}),
        timeout=30,
    )
    if not resp.ok:
        raise RuntimeError(f'Supabase update error {resp.status_code}: {resp.text[:200]}')


def run_sql(sql: str, access_token: str) -> dict:
    """
    Ejecuta SQL arbitrario vía Supabase Management API.
    Requiere SUPABASE_ACCESS_TOKEN (sbp_...), no la service key.
    """
    project_ref = SUPABASE_URL.split('//')[1].split('.')[0]
    resp = requests.post(
        f'https://api.supabase.com/v1/projects/{project_ref}/database/query',
        headers={
            'Authorization': f'Bearer {access_token}',
            'Content-Type':  'application/json',
        },
        json={'query': sql},
        timeout=30,
    )
    if not resp.ok:
        raise RuntimeError(f'SQL error {resp.status_code}: {resp.text[:300]}')
    return resp.json()
