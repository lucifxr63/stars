"""
api/licitus.py — Integración con Licitus (Inteligencia de Mercado Público).

Router proxy read-only (`/licitus/*`): backend-to-backend. El gateway api-v1 de
Validus (y cualquier host app) consume la API B2B /v1 de Licitus sin manejar su
secreto: el LICITUS_API_KEY vive solo en el env de BralidusPY. Todo pasa por
`require_api_key` (auth de Bralidus). Si el cliente degrada a None → 503 con un
mensaje que NO afirma causa raíz (config vs outage vs 404 aguas abajo).

Fase 2: build_procurement_context() inyecta señales de compras públicas en el
contexto GraphRAG de /query, análogo a build_relationship_context de S-Pulse.
Ver docs/LICITUS_BRALIDUS_INTEGRATION_PLAN.md §5.
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


# ── Context builder para GraphRAG (Fase 2) ────────────────────────────────────

def _fmt_clp(value: object) -> str:
    """$12.345.678 — separador de miles chileno. '?' si el valor no es numérico."""
    try:
        return "$" + f"{float(value):,.0f}".replace(",", ".")
    except (TypeError, ValueError):
        return "?"


def _fmt_pct(value: object) -> str:
    try:
        return f"{float(value):+.1f}%" if float(value) < 0 or float(value) > 0 else "0%"
    except (TypeError, ValueError):
        return "s/d"


def _benchmark_lines(bench: dict, label: str) -> list[str]:
    """Líneas Markdown del benchmark de mercado. `bench` es el JSON plano de Licitus."""
    vol = bench.get("volumen") or {}
    prov = bench.get("proveedores") or {}
    contr = bench.get("contratos") or {}
    top = bench.get("top_compradores") or []
    lines = [f"\n**{label}** (últimos {(bench.get('filtros') or {}).get('periodo_meses', 12)} meses):"]
    tendencia = vol.get("tendencia_vs_periodo_anterior_pct")
    tendencia_str = f" · Tendencia: {_fmt_pct(tendencia)}" if tendencia is not None else ""
    lines.append(
        f"- Licitaciones publicadas: {vol.get('licitaciones_publicadas', 's/d')} · "
        f"Monto total en OCs: {_fmt_clp(vol.get('monto_total_ocs_clp'))} CLP{tendencia_str}"
    )
    lines.append(
        f"- Proveedores activos: {prov.get('activos_en_periodo', 's/d')} · "
        f"Ingreso mediano por proveedor: {_fmt_clp(prov.get('monto_mediana_clp'))} "
        f"(p25 {_fmt_clp(prov.get('monto_p25_clp'))} / p75 {_fmt_clp(prov.get('monto_p75_clp'))})"
    )
    lines.append(
        f"- Ticket mediano por contrato: {_fmt_clp(contr.get('ticket_mediana_clp'))} · "
        f"Concentración top-5 proveedores: {prov.get('concentracion_top5_pct', 's/d')}%"
    )
    if top:
        compradores = ", ".join(
            f"{c.get('nombre', '?')} ({_fmt_clp(c.get('monto_clp'))}, {c.get('pct_del_total', '?')}%)"
            for c in top[:3]
        )
        lines.append(f"- Top compradores: {compradores}")
    return lines


def build_procurement_context(rut: str) -> str | None:
    """
    Arma un bloque Markdown de actividad en compras públicas para una empresa.

    Degrada a None si: Licitus no está configurado, o no hay ni actividad del
    RUT ni benchmarks de mercado. El llamador simplemente no anexa nada.

    Con actividad: OCs reales + buyer intelligence + benchmark del rubro
    principal de la empresa. Sin actividad: se dice explícitamente (señal en sí
    misma para una idea B2G) + panorama nacional. Datos fechados y citables —
    coherente con BRALIDUS_CITE_DIRECTIVE en Validus.
    """
    if not licitus.is_enabled():
        return None

    prof = licitus.get_proveedor(rut)

    lines: list[str] = ["## Actividad en Compras Públicas (Licitus — Mercado Público)\n"]

    if prof:
        act = prof.get("actividad_ocs") or {}
        buyer = prof.get("buyer_intelligence") or {}
        cats = prof.get("categorias") or {}
        nombre = prof.get("nombre_empresa") or rut

        lines.append(
            f"**{nombre}** (RUT {prof.get('rut', rut)}) — "
            f"últimos {prof.get('periodo_meses', 12)} meses como proveedor del Estado:"
        )
        lines.append(
            f"- OCs adjudicadas: {act.get('ocs_ganadas_12m', 's/d')} · "
            f"Monto total: {_fmt_clp(act.get('monto_total_adjudicado_clp'))} CLP · "
            f"Ticket promedio: {_fmt_clp(act.get('ticket_promedio_clp'))}"
        )
        conc = buyer.get("concentracion_top1_pct")
        conc_str = f" · Concentración en el top-1: {conc}%" if conc is not None else ""
        lines.append(
            f"- Compradores distintos: {act.get('compradores_distintos', 's/d')}{conc_str}"
        )

        top = buyer.get("top_compradores") or []
        if top:
            lines.append("\n**Principales compradores públicos:**")
            for c in top[:3]:
                pago = f", reputación de pago: {c['reputacion_pago']}" if c.get("reputacion_pago") else ""
                lines.append(
                    f"- {c.get('nombre_organismo', '?')} "
                    f"({c.get('ocs_count', '?')} OCs, {_fmt_clp(c.get('monto_clp'))}, "
                    f"{c.get('pct_del_total', '?')}% del total{pago})"
                )

        unspsc = (cats.get("unspsc_principales") or [None])[0]
        region = cats.get("region_principal")
        bench = licitus.get_benchmarks(unspsc=unspsc, region=None)
        if bench:
            label = f"Benchmark del rubro UNSPSC {unspsc}" if unspsc else "Benchmark de mercado público"
            if region:
                label += f" (región principal: {region})"
            lines.extend(_benchmark_lines(bench, label))
    else:
        bench = licitus.get_benchmarks()
        if not bench:
            return None  # ni actividad ni mercado — no hay nada citable
        lines.append(
            f"Sin órdenes de compra registradas para el RUT {rut} en los últimos 12 meses "
            "(la empresa no tiene historia como proveedor del Estado — dato relevante si el "
            "modelo de negocio contempla venderle al sector público)."
        )
        lines.extend(_benchmark_lines(bench, "Panorama nacional de compras públicas"))

    calculado = (prof or bench or {}).get("calculado_al", "")
    fecha = f", calculado al {calculado}" if calculado else ""
    lines.append(
        f"\n_Fuente: Licitus — órdenes de compra reales de Mercado Público{fecha}. "
        "Cita estos montos y fechas al evaluar tamaño de mercado, tracción o riesgo de "
        "concentración en análisis B2G._"
    )
    return "\n".join(lines)


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
