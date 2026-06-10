"""
auth.py — Bearer token authentication.

Configura BRALIDUS_API_KEY en .env para activar auth.
Sin la variable, el servidor corre en modo abierto (desarrollo local).

Endpoints públicos (sin auth): GET /health, GET /entities, GET /docs, GET /openapi.json
Endpoints protegidos: POST /query, POST /ingest
"""
from __future__ import annotations
import os
import logging
from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Security

log = logging.getLogger(__name__)
_bearer = HTTPBearer(auto_error=False)


async def require_api_key(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Security(_bearer),
) -> None:
    """
    Dependency inyectable en endpoints protegidos.

    Si BRALIDUS_API_KEY no está configurada → pasa (modo dev).
    Si está configurada → valida Bearer token exacto.
    """
    api_key = os.getenv("BRALIDUS_API_KEY", "")
    if not api_key:
        return  # auth deshabilitado en dev

    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Falta Authorization header. Usa: Authorization: Bearer <key>",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if credentials.credentials != api_key:
        raise HTTPException(
            status_code=403,
            detail="API key inválida.",
            headers={"WWW-Authenticate": "Bearer"},
        )
