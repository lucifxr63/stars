"""
src/clients/spulse_client.py — Cliente REST de S-Pulse (B2B Relationship Intelligence).

Bralidus actúa como la "host app" para la que S-Pulse fue construido: autentica al
usuario final (vía Validus, que forwardea el tenant_id) y llama a S-Pulse con un
secreto compartido `X-Internal-Api-Key`.

Filosofía de degradación (alineada con S-Pulse §8 y el patrón de Bralidus con la
integración de DueDiligence): CUALQUIER fallo — S-Pulse no configurado, timeout,
4xx/5xx, JSON malformado — degrada a `None`. El llamador nunca crashea; a lo sumo
pierde la capa de relaciones societarias. NO se infiere causa raíz desde el mensaje
de un 503 (S-Pulse mapea cualquier error de query al mismo 503 genérico).

Contrato consumido (ver pulse.md §4):
  GET /companies/search?q=            GET /companies/:rut/profile
  GET /companies/:rut/network         GET /companies/:rut/shortest-path
  GET /entities/:rut                  GET /relationships/:id/source
  GET /opportunities?tenant_id=       GET /health
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

# Errores transitorios que ameritan reintento. Un 4xx (RUT inválido, no existe) NO
# se reintenta: es determinista.
_RETRYABLE = (requests.Timeout, requests.ConnectionError)


class SPulseClient:
    """Cliente stateless de la API REST de S-Pulse. Thread-safe (requests es seguro)."""

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        timeout: float | None = None,
    ) -> None:
        self.base_url = (base_url if base_url is not None else config.SPULSE_BASE_URL).rstrip("/")
        self.api_key = api_key if api_key is not None else config.SPULSE_INTERNAL_API_KEY
        self.timeout = timeout if timeout is not None else config.SPULSE_TIMEOUT_S

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
            headers["X-Internal-Api-Key"] = self.api_key
        return requests.get(
            f"{self.base_url}{path}",
            params=params,
            headers=headers,
            timeout=self.timeout,
        )

    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict | None:
        """
        GET que degrada a None ante cualquier problema. Devuelve el objeto `data`
        de la envoltura `{ success, data }` de S-Pulse, o None.
        """
        if not self.is_enabled():
            return None
        try:
            resp = self._raw_get(path, params)
        except Exception as exc:  # timeout/conexión tras agotar reintentos, o cualquier otro
            log.warning("[spulse] GET %s falló (%s) — degradando a None.", path, exc)
            return None

        if resp.status_code == 404:
            log.info("[spulse] GET %s → 404 (no existe).", path)
            return None
        if resp.status_code >= 400:
            log.warning("[spulse] GET %s → %d — degradando a None.", path, resp.status_code)
            return None

        try:
            payload = resp.json()
        except ValueError:
            log.warning("[spulse] GET %s → JSON malformado — degradando a None.", path)
            return None

        if not isinstance(payload, dict) or not payload.get("success"):
            return None
        return payload.get("data")

    # ── Health ────────────────────────────────────────────────────────────────
    def health(self) -> bool:
        """True si /health responde 200. No usa auth (endpoint público en S-Pulse)."""
        if not self.is_enabled():
            return False
        try:
            resp = self._raw_get("/health")
            return resp.status_code == 200
        except Exception:
            return False

    # ── Companies ───────────────────────────────────────────────────────────────
    def search_companies(self, q: str) -> list[dict] | None:
        if not q or len(q.strip()) < 2:
            return None
        data = self._get("/companies/search", {"q": q.strip()})
        return data if isinstance(data, list) else None

    def get_company_profile(self, rut: str) -> dict | None:
        """Ficha 360° de una empresa: datos + socios/reps + triggers recientes."""
        canonical = self._canonical_or_none(rut)
        if canonical is None:
            return None
        return self._get(f"/companies/{canonical}/profile")

    def get_network(self, rut: str) -> dict | None:
        """Grafo de relaciones listo para render: {nodes:[...], edges:[...]}."""
        canonical = self._canonical_or_none(rut)
        if canonical is None:
            return None
        return self._get(f"/companies/{canonical}/network")

    def get_shortest_path(self, rut: str, target_rut: str, tenant_id: str) -> dict | None:
        src = self._canonical_or_none(rut)
        tgt = self._canonical_or_none(target_rut)
        if src is None or tgt is None or not tenant_id:
            return None
        return self._get(
            f"/companies/{src}/shortest-path",
            {"target_rut": tgt, "tenant_id": tenant_id},
        )

    # ── Entities ────────────────────────────────────────────────────────────────
    def get_entity(self, rut: str) -> dict | None:
        """Lookup genérico por RUT: Empresa o PersonaNatural + sus relaciones."""
        canonical = self._canonical_or_none(rut)
        if canonical is None:
            return None
        return self._get(f"/entities/{canonical}")

    # ── Relationships (trazabilidad legal) ───────────────────────────────────────
    def get_relationship_source(self, rel_id: str) -> dict | None:
        """Fuente auditable de una relación (sourceUrl, sourceType, documentHash)."""
        if not rel_id or not rel_id.startswith("rel_"):
            return None
        return self._get(f"/relationships/{rel_id}/source")

    # ── Opportunities (señales de compra materializadas) ─────────────────────────
    def get_opportunities(self, tenant_id: str) -> list[dict] | None:
        """Oportunidades del tenant, ordenadas por matched_at desc."""
        if not tenant_id:
            return None
        data = self._get("/opportunities", {"tenant_id": tenant_id})
        return data if isinstance(data, list) else None

    # ── Helpers ─────────────────────────────────────────────────────────────────
    @staticmethod
    def _canonical_or_none(rut: str) -> str | None:
        """Normaliza + valida Módulo 11. None si el RUT es inválido (evita round-trip)."""
        if not rut or not is_valid_rut(rut):
            return None
        return normalize_rut(rut)


# Singleton perezoso — refleja el patrón de get_db()/signal_cache en el proyecto.
spulse = SPulseClient()
