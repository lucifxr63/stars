"""
api/licitus.py — Integración con Licitus (Inteligencia de Mercado Público).

Router proxy read-only (`/licitus/*`): backend-to-backend. El gateway api-v1 de
Validus (y cualquier host app) consume la API B2B /v1 de Licitus sin manejar su
secreto: el LICITUS_API_KEY vive solo en el env de BralidusPY. Todo pasa por
`require_api_key` (auth de Bralidus). Si el cliente degrada a None → 503 con un
mensaje que NO afirma causa raíz (config vs outage vs 404 aguas abajo).

Fase 2 (futura): build_procurement_context() para inyectar señales de compras
públicas en el contexto GraphRAG de /query, análogo a build_relationship_context
de S-Pulse. Ver docs/LICITUS_BRALIDUS_INTEGRATION_PLAN.md §5.
"""
from __future__ import annotations
import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from api.auth import require_api_key
from src.clients.licitus_client import licitus

log = logging.getLogger(__name__)

router = APIRouter(prefix="/licitus", tags=["licitus"], dependencies=[Depends(require_api_key)])

# Mensaje único para degradación — deliberadamente NO afirma la causa (config vs
# outage vs RUT sin actividad vs filtros sin datos).
_UNAVAILABLE = "Licitus no disponible o sin datos para este recurso."


def _or_503(data: object) -> object:
    if data is None:
        raise HTTPException(status_code=503, detail=_UNAVAILABLE)
    return data


@router.get("/health", summary="Liveness de Licitus visto desde Bralidus")
async def licitus_health() -> dict:
    return {"enabled": licitus.is_enabled(), "ok": licitus.health()}


@router.get("/proveedor/{rut}", summary="Actividad de un proveedor en Mercado Público (OCs, buyer intelligence)")
async def licitus_proveedor(
    rut: str,
    periodo_meses: int = Query(12, ge=1, le=24),
) -> dict:
    return {"data": _or_503(licitus.get_proveedor(rut, periodo_meses=periodo_meses))}


@router.get("/mercado/benchmarks", summary="Benchmarks de mercado por rubro UNSPSC / región")
async def licitus_benchmarks(
    unspsc: str | None = Query(None, min_length=1),
    region: str | None = Query(None, min_length=1),
    periodo_meses: int = Query(12, ge=1, le=24),
) -> dict:
    return {
        "data": _or_503(
            licitus.get_benchmarks(unspsc=unspsc, region=region, periodo_meses=periodo_meses)
        )
    }


@router.get("/mercado/activas", summary="Licitaciones activas filtrables (rubro/región/monto/cierre)")
async def licitus_activas(
    unspsc: str | None = Query(None, min_length=1),
    region: str | None = Query(None, min_length=1),
    monto_min: float | None = Query(None, ge=0),
    cierre_desde_horas: int = Query(168, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict:
    return {
        "data": _or_503(
            licitus.get_activas(
                unspsc=unspsc,
                region=region,
                monto_min=monto_min,
                cierre_desde_horas=cierre_desde_horas,
                limit=limit,
            )
        )
    }
