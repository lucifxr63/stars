"""
yfinance_extractor.py — BralidusPY Phase 2
Extrae precios historicos mensuales via Yahoo Finance >= 1.4.1.

Estrategia anti-rate-limit (v1.4.1):
  1. curl_cffi: si esta instalado, yfinance usa TLS fingerprinting diferente
     al de requests puro, lo que Yahoo Finance no rate-limita igual.
     Se activa automaticamente si `curl_cffi` esta en el entorno.
  2. Batch download: un solo yf.download(tickers=[...]) para todos los simbolos,
     evitando N requests individuales.
  3. multi_level_index=False: simplifica el DataFrame resultante —
     columnas planas {Symbol: Close, ...} en vez de MultiIndex.

API changes vs 0.2.x:
  - group_by="column"  →  multi_level_index=True (default) o False
  - Con multi_level_index=False: raw[symbol] directamente
"""
from __future__ import annotations
import logging
from tenacity import retry, stop_after_attempt, wait_exponential
import yfinance as yf

log = logging.getLogger(__name__)

# ── Config de tickers ─────────────────────────────────────────────────────────

TICKER_CONFIG: dict[str, dict] = {
    # ── Indices de mercado ────────────────────────────────────────────────
    "^GSPC": {
        "title":      "S&P 500 (Indice Mercado USA)",
        "category":   "Mercados",
        "unit":       "puntos",
        "shortLabel": "S&P 500",
        "fuente":     "Yahoo Finance / S&P Dow Jones Indices",
        "tags":       ["indices", "usa", "renta_variable", "mercados"],
        "semantic": (
            "El S&P 500 es el principal indicador del mercado bursatil estadounidense, "
            "compuesto por las 500 mayores empresas cotizadas. Es el benchmark global "
            "de sentimiento inversor y proxy del apetito por riesgo: cuando sube, el "
            "capital fluye hacia activos de riesgo incluidas startups y VC."
        ),
    },
    "^IXIC": {
        "title":      "NASDAQ Composite (Tecnologia USA)",
        "category":   "Mercados",
        "unit":       "puntos",
        "shortLabel": "NASDAQ",
        "fuente":     "Yahoo Finance / NASDAQ",
        "tags":       ["indices", "usa", "tecnologia", "startups", "vc"],
        "semantic": (
            "El NASDAQ Composite concentra empresas tecnologicas y de alto crecimiento. "
            "Es el benchmark de referencia para startups y fondos VC: cuando cae, "
            "las valoraciones de empresas early-stage se comprimen y el capital de "
            "riesgo se retrae. Impacto directo en rondas de financiamiento LATAM."
        ),
    },
    "^IPSA": {
        "title":      "IPSA (Indice Bursatil Chile)",
        "category":   "Mercados Chile",
        "unit":       "puntos",
        "shortLabel": "IPSA",
        "fuente":     "Yahoo Finance / Bolsa de Santiago",
        "tags":       ["indices", "chile", "renta_variable", "mercado_local"],
        "semantic": (
            "El IPSA mide el desempeno de las 30 empresas mas transadas en la "
            "Bolsa de Santiago. Refleja la confianza inversora local y el ciclo "
            "economico chileno. Cuando cae, aumenta la aversion al riesgo local "
            "y se dificultan rondas de inversion nacionales."
        ),
    },
    # ── Commodities ──────────────────────────────────────────────────────
    "HG=F": {
        "title":      "Cobre Futuros (Commodity Chile)",
        "category":   "Commodities",
        "unit":       "USD/lb",
        "shortLabel": "Cobre",
        "fuente":     "Yahoo Finance / COMEX",
        "tags":       ["commodities", "cobre", "chile", "minerales", "exportaciones"],
        "semantic": (
            "El cobre es el principal commodity de exportacion chileno (~50% de "
            "exportaciones). Su precio determina el ciclo economico de Chile: "
            "ingresos fiscales via royalty minero, nivel del USD/CLP y el nivel "
            "de inversion publica y privada en el pais."
        ),
    },
    "CL=F": {
        "title":      "WTI Petroleo Crudo (Futuros)",
        "category":   "Commodities",
        "unit":       "USD/barril",
        "shortLabel": "WTI",
        "fuente":     "Yahoo Finance / NYMEX",
        "tags":       ["commodities", "petroleo", "energia", "costos_logistica"],
        "semantic": (
            "El precio del petroleo WTI impacta los costos de logistica, transporte "
            "y energia. Para startups con modelo fisico o logistico, los shocks de "
            "precio del petroleo comprimen margenes y encarecen la cadena de "
            "distribucion en Chile y LATAM."
        ),
    },
    "GC=F": {
        "title":      "Oro (Gold Futures)",
        "category":   "Commodities",
        "unit":       "USD/oz",
        "shortLabel": "Oro",
        "fuente":     "Yahoo Finance / COMEX",
        "tags":       ["commodities", "oro", "safe_haven", "riesgo"],
        "semantic": (
            "El oro es el activo refugio por excelencia. Su precio sube en "
            "periodos de incertidumbre geopolitica, recesion o alta inflacion. "
            "Funciona como indicador inverso del apetito por riesgo: cuando sube "
            "con fuerza, los inversores huyen de activos especulativos como startups."
        ),
    },
    "ALB": {
        "title":      "Albemarle Corp (Proxy Litio Chile)",
        "category":   "Commodities",
        "unit":       "USD",
        "shortLabel": "Litio (ALB)",
        "fuente":     "Yahoo Finance / NYSE",
        "tags":       ["commodities", "litio", "chile", "mineria", "energia_limpia"],
        "semantic": (
            "Albemarle es el mayor productor de litio del mundo y opera el Salar "
            "de Atacama en Chile. Su accion es el proxy de mercado mas liquido del "
            "precio del litio. Relevante para startups en cleantech, movilidad "
            "electrica y la economia de la transicion energetica en Chile."
        ),
    },
    # ── Forex Chile ──────────────────────────────────────────────────────
    "USDCLP=X": {
        "title":      "USD/CLP (Tipo de Cambio Chile)",
        "category":   "Forex Chile",
        "unit":       "CLP/USD",
        "shortLabel": "USD/CLP",
        "fuente":     "Yahoo Finance / Mercado Forex",
        "tags":       ["forex", "chile", "tipo_de_cambio", "dolar", "importaciones"],
        "semantic": (
            "El tipo de cambio USD/CLP es critico para startups chilenas: determina "
            "el costo de herramientas SaaS internacionales, cloud (AWS, GCP, Azure), "
            "hardware importado y cualquier gasto en dolares. Una devaluacion del peso "
            "encarece directamente el opex/capex de empresas con gastos en USD."
        ),
    },
    # ── Riesgo y tasas ────────────────────────────────────────────────────
    "^VIX": {
        "title":      "VIX (Indice de Volatilidad de Mercados)",
        "category":   "Riesgo",
        "unit":       "indice",
        "shortLabel": "VIX",
        "fuente":     "Yahoo Finance / CBOE",
        "tags":       ["riesgo", "volatilidad", "mercados", "apetito_riesgo"],
        "semantic": (
            "El VIX mide la volatilidad implicita del S&P 500 a 30 dias. Conocido "
            "como el indice del miedo: valores sobre 30 indican estres severo y "
            "correlacionan con cierre de rondas VC y caida de valoraciones. "
            "Por debajo de 15 indica mercados tranquilos favorables a financiamiento."
        ),
    },
    "^TNX": {
        "title":      "Tasa del Tesoro USA 10 Anos",
        "category":   "Tasas USA",
        "unit":       "%",
        "shortLabel": "Treasury 10Y",
        "fuente":     "Yahoo Finance / US Treasury",
        "tags":       ["tasas", "usa", "bonos", "costo_capital", "vc"],
        "semantic": (
            "La tasa del Tesoro USA a 10 anos es la tasa libre de riesgo global. "
            "Cuando sube, aumenta la tasa de descuento de flujos futuros y las "
            "valoraciones de startups caen por DCF. Es el principal driver macro "
            "del mercado VC: altas tasas = menores multiplos = valuaciones bajas."
        ),
    },
    # ── ETF Chile / LATAM ─────────────────────────────────────────────────
    "ECH": {
        "title":      "iShares MSCI Chile ETF",
        "category":   "Mercados Chile",
        "unit":       "USD",
        "shortLabel": "ECH Chile ETF",
        "fuente":     "Yahoo Finance / BlackRock iShares",
        "tags":       ["etf", "chile", "inversores_extranjeros", "renta_variable"],
        "semantic": (
            "El ETF ECH (iShares MSCI Chile) representa la exposicion de inversores "
            "institucionales internacionales al mercado chileno. Cuando cae, senala "
            "salida de capital extranjero de Chile, lo que presiona el USD/CLP al "
            "alza y reduce el apetito por inversiones en empresas locales."
        ),
    },
    "ILF": {
        "title":      "iShares Latin America 40 ETF",
        "category":   "Mercados LATAM",
        "unit":       "USD",
        "shortLabel": "LATAM 40 ETF",
        "fuente":     "Yahoo Finance / BlackRock iShares",
        "tags":       ["etf", "latam", "chile", "brasil", "mercados_emergentes"],
        "semantic": (
            "El ETF ILF agrupa las 40 mayores empresas de America Latina. Es el "
            "indicador de sentimiento inversor regional. Relevante para startups "
            "que buscan expansion LATAM: un ILF en baja senala menor apetito "
            "por riesgo emergente y posibles dificultades para captar capital regional."
        ),
    },
}


# ── Batch download (yfinance >= 1.4.1) ───────────────────────────────────────

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=30, max=180))
def _batch_download(symbols: list[str]) -> dict[str, list[dict]]:
    """
    Descarga todos los simbolos en UN solo request usando yfinance >= 1.4.1.

    multi_level_index=False → DataFrame con columnas planas por simbolo:
      raw["Close"] si un solo ticker,
      raw[symbol]["Close"] o raw[(symbol, "Close")] para multiples.

    curl_cffi se activa automaticamente si esta instalado — mejora
    significativamente el bypass de rate limits de Yahoo Finance.
    """
    log.info("  Descargando %d tickers en batch (yfinance %s)...", len(symbols), yf.__version__)
    raw = yf.download(
        tickers=symbols,
        period="5y",
        interval="1mo",
        progress=False,
        auto_adjust=True,
        multi_level_index=True,  # MultiIndex: (Price, Symbol) — mas robusto para parsing
    )

    if raw.empty:
        raise ValueError("Batch download retorno DataFrame vacio — posible rate limit")

    result: dict[str, list[dict]] = {}

    for symbol in symbols:
        try:
            # v1.4.x con multi_level_index=True: raw["Close"][symbol]
            series = raw["Close"][symbol].dropna()
        except (KeyError, TypeError):
            # Fallback: intenta acceso directo para un solo ticker
            try:
                series = raw["Close"].dropna()
            except KeyError:
                log.warning("  SKIP %s: estructura inesperada del DataFrame", symbol)
                continue

        if series.empty:
            log.warning("  SKIP %s: serie vacia", symbol)
            continue

        obs = sorted(
            [
                {"date": ts.strftime("%Y-%m-%d"), "value": round(float(v), 6)}
                for ts, v in series.items()
            ],
            key=lambda x: x["date"],
            reverse=True,
        )
        result[symbol] = obs
        log.info("  -> %s: %d obs, ultimo=%.4f (%s)", symbol, len(obs), obs[0]["value"], obs[0]["date"][:7])

    return result


def _build_node(symbol: str, observations: list[dict]) -> dict:
    cfg = TICKER_CONFIG[symbol]
    latest = observations[0] if observations else None

    content = (
        f"{cfg['semantic']} "
        f"Ultimo valor registrado: {latest['value'] if latest else 'N/A'} {cfg['unit']} "
        f"en {latest['date'][:7] if latest else 'N/A'}. "
        f"Serie historica mensual con {len(observations)} observaciones disponible "
        f"para analisis de correlacion y contexto de mercado."
    )

    return {
        "document_title": cfg["title"],
        "header_path":    "Introduccion",
        "content":        content,
        "category":       cfg["category"],
        "tags":           cfg["tags"],
        "metadata": {
            "symbol":        symbol,
            "fuente":        cfg["fuente"],
            "url_fuente":    f"https://finance.yahoo.com/quote/{symbol.replace('=', '%3D')}",
            "unidad":        cfg["unit"],
            "frecuencia":    "mensual",
            "ultima_fecha":  latest["date"] if latest else None,
            "ultimo_valor":  latest["value"] if latest else None,
            "observaciones": observations,
        },
        "embedding": None,
    }


def fetch_all() -> list[dict]:
    """
    Descarga todos los tickers en un batch y construye los nodos GraphRAG.
    Un solo request HTTP para todos los simbolos — evita YFRateLimitError.
    """
    symbols = list(TICKER_CONFIG.keys())
    series_map = _batch_download(symbols)

    nodes: list[dict] = []
    for symbol in symbols:
        if symbol not in series_map:
            log.error("  SKIP %s: sin datos en batch download", symbol)
            continue
        node = _build_node(symbol, series_map[symbol])
        nodes.append(node)

    log.info("  yfinance batch OK -> %d/%d nodos construidos", len(nodes), len(symbols))
    return nodes
