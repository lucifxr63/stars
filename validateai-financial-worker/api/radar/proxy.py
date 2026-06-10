"""
api/radar/proxy.py — Proxy rotation via ScraperAPI.

Si SCRAPERAPI_KEY está configurado, las peticiones RSS se enrutan a través
de ScraperAPI, que maneja rotación de IPs, headers anti-bot y reintentos.
Sin key: requests directos (comportamiento original, sin costo).

Créditos estimados (plan Hobby, 250k/mes):
  ~10 feeds × 48 ciclos/día × 30 días ≈ 14.400 req/mes — holgura cómoda.

Uso:
  content = fetch_feed_content(url)
  feed = feedparser.parse(content)
"""
from __future__ import annotations
import logging
import os

import requests
from tenacity import (
    retry, stop_after_attempt, wait_exponential,
    retry_if_exception_type, before_sleep_log,
)

log = logging.getLogger(__name__)

_SCRAPERAPI_KEY: str = os.getenv("SCRAPERAPI_KEY", "")
_SCRAPERAPI_ENDPOINT = "https://api.scraperapi.com"
_TIMEOUT = 25


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=15),
    retry=retry_if_exception_type(
        (requests.HTTPError, requests.ConnectionError, requests.Timeout)
    ),
    before_sleep=before_sleep_log(log, logging.DEBUG),
)
def fetch_feed_content(url: str) -> str:
    """
    Descarga el contenido de un feed RSS/Atom.
    Usa ScraperAPI si SCRAPERAPI_KEY está configurado; directo si no.
    Retorna el contenido como string para feedparser.parse().
    """
    if _SCRAPERAPI_KEY:
        resp = requests.get(
            _SCRAPERAPI_ENDPOINT,
            params={"api_key": _SCRAPERAPI_KEY, "url": url},
            timeout=_TIMEOUT,
        )
    else:
        resp = requests.get(url, timeout=_TIMEOUT, headers={
            "User-Agent": "Mozilla/5.0 (compatible; BralidusBot/1.0)",
        })

    resp.raise_for_status()
    return resp.text


def proxy_active() -> bool:
    return bool(_SCRAPERAPI_KEY)
