import os
from dotenv import load_dotenv

load_dotenv()


def _require(key: str) -> str:
    value = os.getenv(key)
    if not value:
        raise EnvironmentError(f"Variable de entorno requerida no encontrada: {key}")
    return value


# Accept SUPABASE_URL (Railway/prod standard) or VITE_SUPABASE_URL (local dev / Vite legacy)
SUPABASE_URL: str = os.getenv("SUPABASE_URL") or _require("VITE_SUPABASE_URL")
SUPABASE_SERVICE_KEY: str = _require("SUPABASE_SERVICE_ROLE_KEY")
FRED_API_KEY: str = _require("FRED_API_KEY")
OPENAI_API_KEY: str = _require("OPENAI_API_KEY")
