"""
src/clients/licitus_client.py — Cliente REST de Licitus (Inteligencia de Mercado Público).

Bralidus consume la API B2B `/v1` de Licitus (api.licitus.scouttech.lat): actividad
real de un proveedor en compras públicas (OCs de `purchase_orders`), benchmarks de
mercado por rubro UNSPSC/región, y licitaciones activas. Auth por secreto compartido
`Authorization: Bearer <LICITUS_API_KEY>` (Licitus también acepta x-api-key).

Filosofía de degradación: CUALQUIER fallo — Licitus no
configurado, timeout, 4xx/5xx, JSON malformado — degrada a `None`. El llamador
nunca crashea; a lo sumo pierde la capa de inteligencia de compras públicas.

⚠️ El contrato /v1 de Licitus devuelve JSON PLANO, SIN la envoltura
`{success, data}`. `_get` retorna `resp.json()` directo — NO hay
`payload.get("data")` ni validación de `payload["success"]`. (Es la diferencia
que costó un bug cuando convivía con un cliente que sí venía envuelto.)

Contrato consumido (ver docs/LICITUS_BRALIDUS_INTEGRATION_PLAN.md §1):
  GET /proveedor/:rut?periodo_meses=            (404 si el RUT no tiene actividad)
  GET /mercado/benchmarks?unspsc&region&periodo_meses
  GET /mercado/activas?unspsc&region&monto_min&cierre_desde_horas&limit
"""
from __future__ import annotations
import logging
from typing import Any

import requests
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from src import config
from src.utils.rut import is_valid_rut, normalize_rut

log = logging.getLogger(__name__)

# Errores transitorios que ameritan reintento. Un 4xx (RUT inválido, sin datos) NO
# se reintenta: es determinista.
_RETRYABLE = (requests.Timeout, requests.ConnectionError)


class LicitusClient:
    """Cliente stateless de la API /v1 de Licitus. Thread-safe (requests es seguro)."""

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        timeout: float | None = None,
    ) -> None:
        self.base_url = (base_url if base_url is not None else config.LICITUS_BASE_URL).rstrip("/")
        self.api_key = api_key if api_key is not None else config.LICITUS_API_KEY
        self.timeout = timeout if timeout is not None else config.LICITUS_TIMEOUT_S

    # ── Estado ────────────────────────────────────────────────────────────────
    def is_enabled(self) -> bool:
        """True si hay una BASE_URL configurada. Sin ella, toda llamada degrada a None."""
        return bool(self.base_url)

    # ── HTTP interno ────────────────────────────────────────────────────────────
    @retry(
        retry=retry_if_exception_type(_RETRYABLE),
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=0.5, max=2),
        reraise=True,
    )
    def _raw_get(self, path: str, params: dict[str, Any] | None = None) -> requests.Response:
        headers = {"Accept": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return requests.get(
            f"{self.base_url}{path}",
            params=params,
            headers=headers,
            timeout=self.timeout,
        )

    def _get(self, path: str, params: dict[str, Any] | None = None) -> Any | None:
        """
        GET que degrada a None ante cualquier problema. Devuelve el JSON PLANO de
        Licitus tal cual (dict o list) — sin desenvolver nada.
        """
        if not self.is_enabled():
            return None
        try:
            resp = self._raw_get(path, params)
        except Exception as exc:  # timeout/conexión tras agotar reintentos, o cualquier otro
            log.warning("[licitus] GET %s falló (%s) — degradando a None.", path, exc)
            return None

        if resp.status_code == 404:
            log.info("[licitus] GET %s → 404 (sin datos/actividad).", path)
            return None
        if resp.status_code >= 400:
            log.warning("[licitus] GET %s → %d — degradando a None.", path, resp.status_code)
            return None

        try:
            return resp.json()
        except ValueError:
            log.warning("[licitus] GET %s → JSON malformado — degradando a None.", path)
            return None

    # ── Health ────────────────────────────────────────────────────────────────
    def health(self) -> bool:
        """
        Licitus no expone /v1/health: se usa la llamada más barata del contrato
        (/mercado/activas?limit=1) y se considera vivo si responde < 500 (un 404
        "sin datos" sigue siendo un servicio sano; el rate-limit 429 también).
        """
        if not self.is_enabled():
            return False
        try:
            resp = self._raw_get("/mercado/activas", {"limit": 1})
            return resp.status_code < 500
        except Exception:
            return False

    # ── Proveedor ───────────────────────────────────────────────────────────────
    def get_proveedor(self, rut: str, periodo_meses: int = 12) -> dict | None:
        """Actividad de un proveedor en Mercado Público: OCs, buyer_intelligence, categorías."""
        canonical = self._canonical_or_none(rut)
        if canonical is None:
            return None
        data = self._get(f"/proveedor/{canonical}", {"periodo_meses": periodo_meses})
        return data if isinstance(data, dict) else None

    # ── Mercado ─────────────────────────────────────────────────────────────────
    def get_benchmarks(
        self,
        unspsc: str | None = None,
        region: str | None = None,
        periodo_meses: int = 12,
    ) -> dict | None:
        """Benchmarks de mercado: volumen, percentiles p25/mediana/p75, top compradores."""
        params: dict[str, Any] = {"periodo_meses": periodo_meses}
        if unspsc:
            params["unspsc"] = unspsc
        if region:
            params["region"] = region
        data = self._get("/mercado/benchmarks", params)
        return data if isinstance(data, dict) else None

    def get_activas(
        self,
        unspsc: str | None = None,
        region: str | None = None,
        monto_min: float | None = None,
        cierre_desde_horas: int = 168,
        limit: int = 20,
    ) -> list[dict] | dict | None:
        """Licitaciones activas filtrables por rubro/región/monto/ventana de cierre."""
        params: dict[str, Any] = {"cierre_desde_horas": cierre_desde_horas, "limit": limit}
        if unspsc:
            params["unspsc"] = unspsc
        if region:
            params["region"] = region
        if monto_min is not None:
            params["monto_min"] = monto_min
        return self._get("/mercado/activas", params)

    # ── Helpers ─────────────────────────────────────────────────────────────────
    @staticmethod
    def _canonical_or_none(rut: str) -> str | None:
        """Normaliza + valida Módulo 11. None si el RUT es inválido (evita round-trip)."""
        if not rut or not is_valid_rut(rut):
            return None
        return normalize_rut(rut)


# Singleton perezoso — refleja el patrón de spulse/get_db() en el proyecto.
licitus = LicitusClient()
