import os
from dotenv import load_dotenv

load_dotenv()


def _require(key: str) -> str:
    value = os.getenv(key)
    if not value:
        raise EnvironmentError(f"Variable de entorno requerida no encontrada: {key}")
    return value


# Accept SUPABASE_URL (estándar en prod) or VITE_SUPABASE_URL (local dev / Vite legacy)
SUPABASE_URL: str = os.getenv("SUPABASE_URL") or _require("VITE_SUPABASE_URL")
SUPABASE_SERVICE_KEY: str = _require("SUPABASE_SERVICE_ROLE_KEY")
FRED_API_KEY: str = _require("FRED_API_KEY")
OPENAI_API_KEY: str = _require("OPENAI_API_KEY")

# Sprint 1 — CMF API (opcional: si no está configurada el extractor falla silenciosamente)
# Mercado Público: ingestado por proceso externo, no se necesita key aquí.
CMF_BEST_KEY: str = os.getenv("CMF_BEST_KEY", "")     # api.cmfchile.cl

# S-Pulse (grafo societario) quedó en stand-by: dejó de ser un servicio
# independiente, se movió dentro de Animus y no expone API ni frontend. Acá
# vivían SPULSE_BASE_URL / SPULSE_INTERNAL_API_KEY / SPULSE_TIMEOUT_S, que
# alimentaban un cliente HTTP hacia un host que ya no resuelve en DNS.
#
# Si vuelve a exponerse, el dato que costó descubrir: la URL lleva sufijo /api
# — sin él todas las llamadas devuelven 404.

# ── Licitus — Inteligencia de Mercado Público (host↔Licitus, opcional) ─────────
# Bralidus consume la API B2B /v1 de Licitus (actividad de proveedores en compras
# públicas, benchmarks de mercado, licitaciones activas). Mismo patrón que S-Pulse:
# sin BASE_URL la integración se desactiva por completo (degrada a None).
# ⚠️ A diferencia de S-Pulse, Licitus responde JSON PLANO (sin wrapper {success,data}).
LICITUS_BASE_URL: str = os.getenv("LICITUS_BASE_URL", "").rstrip("/")  # ej: https://api.licitus.scouttech.lat/v1
LICITUS_API_KEY: str = os.getenv("LICITUS_API_KEY", "")
LICITUS_TIMEOUT_S: float = float(os.getenv("LICITUS_TIMEOUT_S", "8"))  # timeout duro por request
