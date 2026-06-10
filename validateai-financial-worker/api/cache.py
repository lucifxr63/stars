"""
cache.py — LRU cache para embeddings de queries.

Cada llamada a POST /query genera un embedding via OpenAI (~$0.0001).
Queries repetidas o similares (misma sesión de usuario) no deben re-embeddear.

Implementación: dict en memoria, TTL de 1 hora, max 512 entradas.
En producción se puede upgradear a Redis cambiando solo este módulo.
"""
from __future__ import annotations
import hashlib
import time
import logging
from threading import Lock

log = logging.getLogger(__name__)

_MAX_ENTRIES = 512
_TTL_SECONDS = 3600  # 1 hora

_cache: dict[str, tuple[list[float], float]] = {}  # key → (vector, expires_at)
_lock = Lock()
_hits = 0
_misses = 0


def _make_key(text: str) -> str:
    return hashlib.sha256(text.strip().lower().encode()).hexdigest()


def get(text: str) -> list[float] | None:
    global _hits, _misses
    key = _make_key(text)
    with _lock:
        entry = _cache.get(key)
        if entry is None:
            _misses += 1
            return None
        vec, expires_at = entry
        if time.monotonic() > expires_at:
            del _cache[key]
            _misses += 1
            return None
        _hits += 1
        return vec


def set(text: str, vector: list[float]) -> None:
    key = _make_key(text)
    expires_at = time.monotonic() + _TTL_SECONDS
    with _lock:
        if len(_cache) >= _MAX_ENTRIES:
            # Evict oldest entry
            oldest_key = next(iter(_cache))
            del _cache[oldest_key]
        _cache[key] = (vector, expires_at)


def stats() -> dict:
    total = _hits + _misses
    return {
        "entries": len(_cache),
        "hits": _hits,
        "misses": _misses,
        "hit_rate": round(_hits / total, 3) if total > 0 else 0.0,
        "max_entries": _MAX_ENTRIES,
        "ttl_seconds": _TTL_SECONDS,
    }
