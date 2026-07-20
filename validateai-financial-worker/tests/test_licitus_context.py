"""
tests/test_licitus_context.py — Unit tests de build_procurement_context (Fase 2).

Sin red: se mockea el singleton `licitus` dentro de api.licitus.
"""
from __future__ import annotations
from unittest.mock import patch

from api.licitus import build_procurement_context

RUT = "76086428-5"

PROVEEDOR = {
    "rut": "76086428-5",
    "nombre_empresa": "Insumos Médicos SpA",
    "periodo_meses": 12,
    "calculado_al": "2026-07-20",
    "actividad_ocs": {
        "ocs_ganadas_12m": 42,
        "monto_total_adjudicado_clp": 380_000_000,
        "ticket_promedio_clp": 9_047_619,
        "ticket_maximo_clp": 45_000_000,
        "compradores_distintos": 7,
    },
    "buyer_intelligence": {
        "top_compradores": [
            {
                "codigo_organismo": "1057",
                "nombre_organismo": "Hospital Regional",
                "ocs_count": 12,
                "monto_clp": 95_000_000,
                "pct_del_total": 25.0,
                "reputacion_pago": "buena",
            }
        ],
        "concentracion_top1_pct": 25.0,
    },
    "categorias": {"unspsc_principales": ["42131600"], "region_principal": "Metropolitana"},
    "data_quality": {"fuente_montos": "purchase_orders"},
}

BENCHMARKS = {
    "filtros": {"unspsc_prefix": "42131600", "region": None, "periodo_meses": 12},
    "calculado_al": "2026-07-20",
    "volumen": {
        "licitaciones_publicadas": 843,
        "monto_total_ocs_clp": 12_500_000_000,
        "tendencia_vs_periodo_anterior_pct": 19.4,
    },
    "proveedores": {
        "activos_en_periodo": 1889,
        "monto_p25_clp": 772_420,
        "monto_mediana_clp": 6_800_000,
        "monto_p75_clp": 19_500_000,
        "concentracion_top5_pct": 41.0,
    },
    "contratos": {
        "ticket_promedio_clp": 4_100_000,
        "ticket_mediana_clp": 2_100_000,
        "ticket_p90_clp": 15_000_000,
    },
    "top_compradores": [{"nombre": "MINSAL", "monto_clp": 2_400_000_000, "pct_del_total": 19.2}],
}


def _ctx(enabled=True, proveedor=None, benchmarks=None) -> str | None:
    with patch("api.licitus.licitus") as m:
        m.is_enabled.return_value = enabled
        m.get_proveedor.return_value = proveedor
        m.get_benchmarks.return_value = benchmarks
        return build_procurement_context(RUT)


def test_con_actividad_incluye_ocs_buyer_y_benchmark_del_rubro():
    block = _ctx(proveedor=PROVEEDOR, benchmarks=BENCHMARKS)
    assert block is not None
    assert "Actividad en Compras Públicas" in block
    assert "Insumos Médicos SpA" in block
    assert "OCs adjudicadas: 42" in block
    assert "$380.000.000" in block          # separador de miles chileno
    assert "Hospital Regional" in block
    assert "reputación de pago: buena" in block
    assert "UNSPSC 42131600" in block       # benchmark dirigido al rubro principal
    assert "MINSAL" in block
    assert "calculado al 2026-07-20" in block


def test_con_actividad_usa_unspsc_principal_para_el_benchmark():
    with patch("api.licitus.licitus") as m:
        m.is_enabled.return_value = True
        m.get_proveedor.return_value = PROVEEDOR
        m.get_benchmarks.return_value = BENCHMARKS
        build_procurement_context(RUT)
        m.get_benchmarks.assert_called_once_with(unspsc="42131600", region=None)


def test_sin_actividad_dice_sin_historia_y_da_panorama_nacional():
    block = _ctx(proveedor=None, benchmarks=BENCHMARKS)
    assert block is not None
    assert "Sin órdenes de compra registradas" in block
    assert "Panorama nacional" in block
    assert "$12.500.000.000" in block


def test_degrada_a_none_sin_configuracion():
    assert _ctx(enabled=False) is None


def test_degrada_a_none_sin_actividad_ni_benchmarks():
    assert _ctx(proveedor=None, benchmarks=None) is None


def test_campos_faltantes_no_crashean():
    """Payload mínimo/degenerado: el builder es defensivo con .get()."""
    block = _ctx(proveedor={"rut": RUT}, benchmarks=None)
    assert block is not None
    assert RUT in block
