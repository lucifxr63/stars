"""
api/spulse.py — Integración con S-Pulse (B2B Relationship Intelligence).

Dos responsabilidades:

1. **Router proxy read-only** (`/spulse/*`): backend-to-backend. Validus consume el
   grafo societario chileno sin tocar Neo4j directo ni manejar el secreto de S-Pulse.
   Todo pasa por `require_api_key` (auth de Bralidus). Si S-Pulse degrada a None →
   503 con un mensaje que NO afirma causa raíz (S-Pulse mapea todo a un 503 genérico).

2. **build_relationship_context()**: convierte el profile de una empresa en un bloque
   Markdown de "Inteligencia de Relaciones" con trazabilidad legal citable, para
   inyectar en el contexto GraphRAG (Fase 2). Es el diferencial de Bralidus: cada
   afirmación de relación es auditable hasta su documento fuente.
"""
from __future__ import annotations
import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from api.auth import require_api_key
from src.clients.spulse_client import spulse

log = logging.getLogger(__name__)

router = APIRouter(prefix="/spulse", tags=["spulse"], dependencies=[Depends(require_api_key)])

# Mensaje único para degradación — deliberadamente NO afirma la causa (config vs outage
# vs 4xx aguas abajo). Ver pulse.md §8: el 503 de S-Pulse es genérico.
_UNAVAILABLE = "S-Pulse no disponible o sin datos para este recurso."


def _or_503(data: object) -> object:
    if data is None:
        raise HTTPException(status_code=503, detail=_UNAVAILABLE)
    return data


# ── Proxy read-only (Fase 1) ──────────────────────────────────────────────────

@router.get("/health", summary="Liveness de S-Pulse visto desde Bralidus")
async def spulse_health() -> dict:
    return {"enabled": spulse.is_enabled(), "ok": spulse.health()}


@router.get("/companies/search", summary="Buscar empresas por nombre o RUT (mín 2 chars)")
async def spulse_search(q: str = Query(..., min_length=2)) -> dict:
    return {"data": _or_503(spulse.search_companies(q))}


@router.get("/companies/{rut}/profile", summary="Ficha 360° de una empresa")
async def spulse_profile(rut: str) -> dict:
    return {"data": _or_503(spulse.get_company_profile(rut))}


@router.get("/companies/{rut}/network", summary="Grafo de relaciones listo para render")
async def spulse_network(rut: str) -> dict:
    return {"data": _or_503(spulse.get_network(rut))}


@router.get("/entities/{rut}", summary="Lookup genérico por RUT (Empresa o PersonaNatural)")
async def spulse_entity(rut: str) -> dict:
    return {"data": _or_503(spulse.get_entity(rut))}


@router.get("/relationships/{rel_id}/source", summary="Fuente auditable de una relación")
async def spulse_rel_source(rel_id: str) -> dict:
    return {"data": _or_503(spulse.get_relationship_source(rel_id))}


@router.get("/opportunities", summary="Oportunidades (señales de compra) del tenant")
async def spulse_opportunities(tenant_id: str = Query(..., min_length=1)) -> dict:
    # tenant_id lo forwardea la host app (Validus). Bralidus nunca lo inventa.
    return {"data": _or_503(spulse.get_opportunities(tenant_id))}


# ── Context builder para GraphRAG (Fase 2) ──────────────────────────────────────

def build_relationship_context(rut: str, tenant_id: str | None = None) -> str | None:
    """
    Arma un bloque Markdown de inteligencia de relaciones para una empresa.

    Degrada a None si: S-Pulse no está configurado, el RUT es inválido, la empresa
    no existe, o S-Pulse no responde. El llamador simplemente no anexa nada.

    Formato pensado para inyectarse tras el contexto macro, con trazabilidad legal
    citable (sourceType) — coherente con BRALIDUS_CITE_DIRECTIVE en Validus.
    """
    if not spulse.is_enabled():
        return None

    profile = spulse.get_company_profile(rut)
    if not profile:
        return None

    company = profile.get("company") or {}
    members = profile.get("members") or []
    triggers = profile.get("recent_triggers") or []

    name = company.get("business_name") or company.get("razonSocial") or rut
    lines: list[str] = ["## Inteligencia de Relaciones B2B (S-Pulse)\n"]

    header_bits = [f"**{name}** (RUT {company.get('rut', rut)})"]
    if company.get("legal_type"):
        header_bits.append(str(company["legal_type"]))
    if company.get("status"):
        header_bits.append(str(company["status"]))
    lines.append(" · ".join(header_bits))

    if company.get("industry_tags"):
        tags = company["industry_tags"]
        lines.append(f"_Sectores:_ {', '.join(tags) if isinstance(tags, list) else tags}")
    if company.get("creation_date"):
        lines.append(f"_Constitución:_ {company['creation_date']}")

    if members:
        lines.append("\n**Socios y representantes legales:**")
        for m in members[:15]:
            roles = m.get("roles") or []
            role_str = ", ".join(roles) if isinstance(roles, list) else str(roles)
            equity = m.get("equity_percentage")
            equity_str = f" — {equity}%" if equity is not None else ""
            lines.append(f"- {m.get('name', '?')} ({role_str or 'vínculo'}{equity_str})")
    else:
        lines.append(
            "\n_Sin socios/representantes registrados (fuente de extractos notariales "
            "aún no conectada para esta empresa)._"
        )

    if triggers:
        lines.append("\n**Señales recientes:**")
        for t in triggers[:10]:
            lines.append(f"- {t}")

    # Oportunidades del tenant, solo si el tenant fue forwardeado.
    if tenant_id:
        opps = spulse.get_opportunities(tenant_id) or []
        matching = [o for o in opps if o.get("company_rut") == company.get("rut")]
        if matching:
            lines.append("\n**Oportunidades detectadas para este tenant:**")
            for o in matching[:5]:
                lines.append(
                    f"- {o.get('evento_tipo', 'evento')} ({o.get('evento_fecha', 's/f')})"
                )

    lines.append(
        "\n_Fuente: S-Pulse — grafo societario chileno con trazabilidad legal por relación. "
        "Cada vínculo es auditable hasta su documento fuente vía /relationships/:id/source._"
    )
    return "\n".join(lines)
