"""
api/radar/scraper.py — Scraper multi-fuente del Radar Forense.

Fuentes configuradas (todas via env vars con defaults razonables):
  RSS — Diario Financiero:   RADAR_RSS_DF    (feeds RSS públicos de df.cl)
  RSS — Emol Economía:       RADAR_RSS_EMOL  (feeds RSS de emol.com/economia)
  API — Marketaux:           RADAR_MARKETAUX_KEY (free tier: 100 req/día)

Los feeds RSS son scrapeados con feedparser. No se usan sesiones persistentes
ni cookies — solo GET al URL del feed. Si el feed no responde, se loguea y
continúa con las otras fuentes (fail-safe).

Marketaux cubre noticias de Reuters/Bloomberg en inglés con filtro por
entidades financieras (Chile, copper, lithium, fintech). Se usa como
complemento internacional de las fuentes locales chilenas.
"""
from __future__ import annotations
import logging
import os
from dataclasses import dataclass
from typing import Iterator

log = logging.getLogger(__name__)

# ── Configuración de fuentes (env vars con defaults) ─────────────────────────

_RSS_SOURCES: list[tuple[str, str]] = [
    # (url, source_label)
    # Diario Financiero — economía y finanzas Chile
    (
        os.getenv("RADAR_RSS_DF", "https://www.df.cl/rss"),
        "df.cl",
    ),
    # Emol Economía — macro Chile + LATAM
    (
        os.getenv("RADAR_RSS_EMOL", "https://www.emol.com/rss/Noticias/rsss_economia.xml"),
        "emol.com",
    ),
]

_MARKETAUX_KEY: str = os.getenv("RADAR_MARKETAUX_KEY", "")
_MARKETAUX_URL = "https://api.marketaux.com/v1/news/all"

# Tags de búsqueda para Marketaux (sectores relevantes para el portafolio chileno)
_MARKETAUX_SYMBOLS = "IPSA.SN,CMPC.SN"     # Tickers del IPSA como proxy Chile
_MARKETAUX_SEARCH = "chile fintech regulation lithium copper"

# Máximo de titulares a procesar por ciclo (evita llamadas Haiku excesivas)
MAX_HEADLINES_PER_CYCLE = 40


@dataclass
class Headline:
    text: str
    source: str
    url: str = ""


def fetch_all_headlines() -> list[Headline]:
    """
    Punto de entrada: obtiene titulares de todas las fuentes configuradas.
    Falla silenciosamente por fuente — una fuente caída no para el ciclo.
    """
    headlines: list[Headline] = []

    # RSS feeds
    for rss_url, label in _RSS_SOURCES:
        try:
            batch = list(_fetch_rss(rss_url, label))
            log.info("[radar.scraper] %s: %d titulares", label, len(batch))
            headlines.extend(batch)
        except Exception as exc:
            log.warning("[radar.scraper] %s falló (%s). Continuando.", label, exc)

    # Marketaux API (si key configurada)
    if _MARKETAUX_KEY:
        try:
            batch = list(_fetch_marketaux())
            log.info("[radar.scraper] marketaux: %d titulares", len(batch))
            headlines.extend(batch)
        except Exception as exc:
            log.warning("[radar.scraper] Marketaux falló (%s).", exc)
    else:
        log.debug("[radar.scraper] RADAR_MARKETAUX_KEY no configurado. Omitiendo Marketaux.")

    # Deduplicar por texto (titulares idénticos en múltiples feeds)
    seen: set[str] = set()
    unique: list[Headline] = []
    for h in headlines:
        key = h.text.strip().lower()[:100]
        if key not in seen:
            seen.add(key)
            unique.append(h)

    log.info(
        "[radar.scraper] Total titulares únicos: %d (cap=%d)",
        len(unique), MAX_HEADLINES_PER_CYCLE,
    )
    return unique[:MAX_HEADLINES_PER_CYCLE]


# ── Parsers ───────────────────────────────────────────────────────────────────

def _fetch_rss(url: str, source_label: str) -> Iterator[Headline]:
    """
    Parsea un feed RSS/Atom con feedparser.
    feedparser es tolerante a HTML mal formado y a encoding issues — adecuado
    para feeds chilenos que a veces mezclan UTF-8 y latin-1.
    """
    import feedparser  # Importación lazy: solo se ejecuta cuando hay feeds RSS

    feed = feedparser.parse(url)

    if feed.bozo and not feed.entries:
        raise ValueError(f"Feed inválido o inaccesible: {url} — {feed.bozo_exception}")

    for entry in feed.entries:
        title: str = entry.get("title", "").strip()
        summary: str = entry.get("summary", "").strip()
        # Combinar title + primeras palabras del summary para clasificación más precisa
        headline = f"{title}. {summary[:150]}" if summary else title
        if len(headline) < 10:
            continue
        yield Headline(
            text=headline,
            source=source_label,
            url=entry.get("link", ""),
        )


def _fetch_marketaux() -> Iterator[Headline]:
    """
    Consulta Marketaux News API v1.
    Free tier: 100 requests/día → a 30 min de intervalo = 48 req/día.
    Filtra por países (CL) y entidades relevantes para el portafolio.

    Docs: https://www.marketaux.com/documentation
    """
    import requests

    params = {
        "api_token": _MARKETAUX_KEY,
        "countries": "cl",
        "language": "es",
        "filter_entities": "true",
        "limit": 10,
    }

    resp = requests.get(_MARKETAUX_URL, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    for article in data.get("data", []):
        title: str = article.get("title", "").strip()
        description: str = article.get("description", "").strip()
        headline = f"{title}. {description[:150]}" if description else title
        if len(headline) < 10:
            continue
        yield Headline(
            text=headline,
            source="marketaux",
            url=article.get("url", ""),
        )

    # Segunda llamada: búsqueda en inglés (Reuters/Bloomberg sobre Chile)
    params_en = {
        **params,
        "language": "en",
        "search": _MARKETAUX_SEARCH,
        "countries": "",  # global
        "limit": 10,
    }
    resp_en = requests.get(_MARKETAUX_URL, params=params_en, timeout=10)
    if resp_en.ok:
        for article in resp_en.json().get("data", []):
            title = article.get("title", "").strip()
            description = article.get("description", "").strip()
            headline = f"{title}. {description[:150]}" if description else title
            if len(headline) < 10:
                continue
            yield Headline(
                text=headline,
                source="marketaux-en",
                url=article.get("url", ""),
            )
