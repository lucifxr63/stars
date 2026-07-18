"""
tests/test_licitus_client.py — Unit tests del cliente Licitus.

Cubre lo específico de Licitus (docs/LICITUS_BRALIDUS_INTEGRATION_PLAN.md §3.2.6):
  - Parseo de respuesta PLANA (sin wrapper {success, data} — diferencia vs S-Pulse).
  - Degradación a None en 4xx/5xx/timeout/JSON malformado.
  - RUT inválido corta ANTES del round-trip HTTP.
  - health() usa /mercado/activas?limit=1 y tolera 404/429 (status < 500).

Sin red: se mockea requests.get.
"""
from __future__ import annotations
from unittest.mock import MagicMock, patch

import pytest
import requests

from src.clients.licitus_client import LicitusClient

BASE = "https://api.licitus.test/v1"
RUT_OK = "76086428-5"       # DV válido Módulo 11
RUT_BAD = "76086428-9"      # DV inválido


def make_client() -> LicitusClient:
    return LicitusClient(base_url=BASE, api_key="test-key", timeout=1)


def mock_response(status: int = 200, json_data=None, malformed: bool = False) -> MagicMock:
    resp = MagicMock()
    resp.status_code = status
    if malformed:
        resp.json.side_effect = ValueError("not json")
    else:
        resp.json.return_value = json_data
    return resp


# ── Respuesta plana (sin wrapper) ─────────────────────────────────────────────

def test_get_proveedor_devuelve_json_plano_sin_desenvolver():
    """Licitus NO envuelve en {success, data}: el dict raíz ES el payload."""
    plano = {"rut": "76086428-5", "actividad": {"total_ocs": 42}, "buyer_intelligence": []}
    client = make_client()
    with patch("src.clients.licitus_client.requests.get", return_value=mock_response(200, plano)) as m:
        result = client.get_proveedor(RUT_OK)
    assert result == plano  # tal cual, sin .get("data")
    called_url = m.call_args.args[0] if m.call_args.args else m.call_args.kwargs["url"]
    assert called_url == f"{BASE}/proveedor/76086428-5"


def test_get_activas_devuelve_lista_plana():
    activas = [{"codigo": "1234-56-LE26"}, {"codigo": "7890-12-LP26"}]
    client = make_client()
    with patch("src.clients.licitus_client.requests.get", return_value=mock_response(200, activas)):
        result = client.get_activas(limit=2)
    assert result == activas


def test_wrapper_estilo_spulse_no_se_desenvuelve():
    """Si algún día Licitus envolviera, el cliente NO debe extraer 'data' mágicamente."""
    envuelto = {"success": True, "data": {"x": 1}}
    client = make_client()
    with patch("src.clients.licitus_client.requests.get", return_value=mock_response(200, envuelto)):
        result = client.get_benchmarks(unspsc="4321")
    assert result == envuelto  # el wrapper llega tal cual al llamador


# ── Degradación a None ────────────────────────────────────────────────────────

@pytest.mark.parametrize("status", [404, 400, 429, 500, 503])
def test_degrada_a_none_en_http_error(status):
    client = make_client()
    with patch("src.clients.licitus_client.requests.get", return_value=mock_response(status, {"error": "x"})):
        assert client.get_proveedor(RUT_OK) is None


def test_degrada_a_none_en_timeout():
    client = make_client()
    with patch("src.clients.licitus_client.requests.get", side_effect=requests.Timeout("boom")):
        assert client.get_benchmarks() is None


def test_degrada_a_none_en_json_malformado():
    client = make_client()
    with patch("src.clients.licitus_client.requests.get", return_value=mock_response(200, malformed=True)):
        assert client.get_activas() is None


def test_deshabilitado_sin_base_url():
    client = LicitusClient(base_url="", api_key="", timeout=1)
    assert client.is_enabled() is False
    with patch("src.clients.licitus_client.requests.get") as m:
        assert client.get_proveedor(RUT_OK) is None
        m.assert_not_called()


# ── Validación de RUT local ───────────────────────────────────────────────────

def test_rut_invalido_corta_antes_del_round_trip():
    client = make_client()
    with patch("src.clients.licitus_client.requests.get") as m:
        assert client.get_proveedor(RUT_BAD) is None
        m.assert_not_called()


def test_rut_se_normaliza_a_canonico():
    client = make_client()
    with patch("src.clients.licitus_client.requests.get", return_value=mock_response(200, {"ok": 1})) as m:
        client.get_proveedor("76.086.428-5")
    called_url = m.call_args.args[0] if m.call_args.args else m.call_args.kwargs["url"]
    assert "/proveedor/76086428-5" in called_url


# ── Health ────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("status,expected", [(200, True), (404, True), (429, True), (500, False)])
def test_health_usa_activas_y_tolera_menores_a_500(status, expected):
    client = make_client()
    with patch("src.clients.licitus_client.requests.get", return_value=mock_response(status, [])) as m:
        assert client.health() is expected
    called_url = m.call_args.args[0] if m.call_args.args else m.call_args.kwargs["url"]
    assert "/mercado/activas" in called_url


def test_health_false_si_deshabilitado():
    assert LicitusClient(base_url="", api_key="", timeout=1).health() is False


# ── Auth header ───────────────────────────────────────────────────────────────

def test_manda_bearer_token():
    client = make_client()
    with patch("src.clients.licitus_client.requests.get", return_value=mock_response(200, {})) as m:
        client.get_benchmarks()
    headers = m.call_args.kwargs["headers"]
    assert headers["Authorization"] == "Bearer test-key"
