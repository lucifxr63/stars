"""
api/radar/scraper.py — Scraper multi-fuente del Radar Forense.

Fuentes RSS (todas via env vars con defaults):
  Chile nacional:
    RADAR_RSS_DF       — Diario Financiero
    RADAR_RSS_EMOL     — Emol Economía
    RADAR_RSS_ELMERCURIO — El Mercurio Inversiones / E&N
    RADAR_RSS_PULSO    — Pulso (La Tercera)
    RADAR_RSS_MCH      — Minería Chilena
    RADAR_RSS_ELEI     — Revista Electricidad

  LatAm:
    RADAR_RSS_GESTION  — Gestión (Perú)
    RADAR_RSS_PORTAFOLIO — Portafolio (Colombia)
    RADAR_RSS_CRONISTA — El Cronista (Argentina)
    RADAR_RSS_VALOR    — Valor Econômico (Brasil, PT)

  API externa:
    RADAR_MARKETAUX_KEY — Marketaux (Reuters/Bloomberg sobre Chile, EN+ES)

Proxy rotation:
    SCRAPERAPI_KEY     — ScraperAPI (opcional). Si está configurado, todos los
                         feeds pasan por proxy rotation automáticamente.
                         Sin key: requests directos.

Fail-safe por fuente: si un feed falla, se loguea y continúa con los demás.
"""
from __future__ import annotations
import logging
import os
from dataclasses import dataclass
from typing import Iterator

log = logging.getLogger(__name__)

# ── Fuentes RSS ───────────────────────────────────────────────────────────────

_RSS_SOURCES: list[tuple[str, str]] = [
    # ── Chile nacional ────────────────────────────────────────────────────────
    (
        os.getenv("RADAR_RSS_DF", "https://www.df.cl/rss"),
        "df.cl",
    ),
    (
        os.getenv("RADAR_RSS_EMOL", "https://www.emol.com/rss/Noticias/rsss_economia.xml"),
        "emol.com",
    ),
    (
        os.getenv("RADAR_RSS_ELMERCURIO", "https://www.elmercurio.com/Inversiones/RSS/"),
        "elmercurio.com",
    ),
    (
        os.getenv("RADAR_RSS_PULSO", "https://www.latercera.com/rss/category/pulso/"),
        "pulso.latercera.com",
    ),
    (
        os.getenv("RADAR_RSS_MCH", "https://www.mch.cl/feed/"),
        "mch.cl",
    ),
    (
        os.getenv("RADAR_RSS_ELEI", "https://www.revistaei.cl/feed/"),
        "revistaei.cl",
    ),
    # ── LatAm ─────────────────────────────────────────────────────────────────
    (
        os.getenv("RADAR_RSS_GESTION", "https://gestion.pe/feed/"),
        "gestion.pe",
    ),
    (
        os.getenv("RADAR_RSS_PORTAFOLIO", "https://www.portafolio.co/feed/rss"),
        "portafolio.co",
    ),
    (
        os.getenv("RADAR_RSS_CRONISTA", "https://www.cronista.com/rss/"),
        "cronista.com",
    ),
    (
        os.getenv("RADAR_RSS_VALOR", "https://www.valor.com.br/rss"),
        "valor.com.br",
    ),
]

_MARKETAUX_KEY: str = os.getenv("RADAR_MARKETAUX_KEY", "")
_MARKETAUX_URL = "https://api.marketaux.com/v1/news/all"
_MARKETAUX_SYMBOLS = "IPSA.SN,CMPC.SN"
_MARKETAUX_SEARCH = "chile fintech regulation lithium copper"

# Con 10 fuentes RSS × ~10 titulares c/u → cap en 100 para evitar exceso de Haiku
MAX_HEADLINES_PER_CYCLE = 100


@dataclass
class Headline:
    text: str
    source: str
    url: str = ""
    lang: str = "es"  # "es" | "pt" | "en"


def fetch_all_headlines() -> list[Headline]:
    """
    Obtiene titulares de todas las fuentes. Fail-safe por fuente.
    """
    from api.radar.proxy import proxy_active

    if proxy_active():
        log.info("[radar.scraper] Proxy rotation activo (ScraperAPI).")

    headlines: list[Headline] = []

    for rss_url, label in _RSS_SOURCES:
        try:
            batch = list(_fetch_rss(rss_url, label))
            log.info("[radar.scraper] %s: %d titulares", label, len(batch))
            headlines.extend(batch)
        except Exception as exc:
            log.warning("[radar.scraper] %s falló (%s). Continuando.", label, exc)

    if _MARKETAUX_KEY:
        try:
            batch = list(_fetch_marketaux())
            log.info("[radar.scraper] marketaux: %d titulares", len(batch))
            headlines.extend(batch)
        except Exception as exc:
            log.warning("[radar.scraper] Marketaux falló (%s).", exc)
    else:
        log.debug("[radar.scraper] RADAR_MARKETAUX_KEY no configurado.")

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
    Descarga y parsea un feed RSS/Atom.
    Si SCRAPERAPI_KEY está configurado, el contenido pasa por proxy rotation.
    feedparser.parse() acepta tanto URL como string de XML — usamos string
    para poder inyectar el proxy de forma transparente.
    """
    import feedparser
    from api.radar.proxy import fetch_feed_content

    lang = "pt" if source_label == "valor.com.br" else "es"

    try:
        content = fetch_feed_content(url)
        feed = feedparser.parse(content)
    except Exception:
        # Fallback: feedparser directo si el proxy falla
        log.debug("[radar.scraper] %s: fallback a feedparser directo.", source_label)
        feed = feedparser.parse(url)

    if feed.bozo and not feed.entries:
        raise ValueError(f"Feed inválido: {url} — {feed.bozo_exception}")

    for entry in feed.entries:
        title: str = entry.get("title", "").strip()
        summary: str = entry.get("summary", "").strip()
        headline = f"{title}. {summary[:150]}" if summary else title
        if len(headline) < 10:
            continue
        yield Headline(
            text=headline,
            source=source_label,
            url=entry.get("link", ""),
            lang=lang,
        )


def _fetch_marketaux() -> Iterator[Headline]:
    """
    Marketaux News API v1 — noticias EN+ES sobre Chile.
    Free tier: 100 requests/día → a 30 min de intervalo = 48 req/día.
    """
    import requests

    params_es = {
        "api_token": _MARKETAUX_KEY,
        "countries": "cl",
        "language": "es",
        "filter_entities": "true",
        "limit": 10,
    }
    resp = requests.get(_MARKETAUX_URL, params=params_es, timeout=10)
    resp.raise_for_status()
    for article in resp.json().get("data", []):
        headline = _marketaux_headline(article)
        if headline:
            yield Headline(text=headline, source="marketaux", url=article.get("url", ""))

    # Segunda llamada: Reuters/Bloomberg en inglés sobre Chile
    params_en = {
        **params_es,
        "language": "en",
        "search": _MARKETAUX_SEARCH,
        "countries": "",
        "limit": 10,
    }
    resp_en = requests.get(_MARKETAUX_URL, params=params_en, timeout=10)
    if resp_en.ok:
        for article in resp_en.json().get("data", []):
            headline = _marketaux_headline(article)
            if headline:
                yield Headline(
                    text=headline, source="marketaux-en",
                    url=article.get("url", ""), lang="en",
                )


def _marketaux_headline(article: dict) -> str | None:
    title = article.get("title", "").strip()
    description = article.get("description", "").strip()
    headline = f"{title}. {description[:150]}" if description else title
    return headline if len(headline) >= 10 else None
