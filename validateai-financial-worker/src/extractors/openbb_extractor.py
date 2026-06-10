"""
openbb_extractor.py — BralidusPY Phase 3
Motor de datos macroeconómicos extendido via OpenBB Platform.

FASES DE INTEGRACIÓN:
─────────────────────────────────────────────────────────────────────────────
Phase 3A (este archivo, activable):
  FRED series adicionales que no cubrimos con el extractor directo:
  - UNRATE     Desempleo USA           → "Empleo USA"
  - M2SL       M2 Money Supply         → "Liquidez Global"
  - T10Y2Y     Spread 10Y-2Y          → "Riesgo Macro"
  - BAMLH0A0HYM2 High Yield Spread    → "Riesgo Credito"
  - INDPRO     Producción Industrial  → "Ciclo Industrial"
  - DEXCHUS    USD/CNY                → "Forex Global"

Phase 3B (stub, requiere openbb[economy] + World Bank provider):
  - Chile PIB per cápita, desempleo local, FDI entrante

Phase 3C (stub, requiere API keys de providers pagos):
  - Polygon.io / FMP para fundamentales de empresas LATAM
─────────────────────────────────────────────────────────────────────────────

INSTALACIÓN:
  pip install openbb>=4.3.3
  openbb-build          # genera assets estáticos (~30s, solo primera vez)

CONFIGURACIÓN (automática vía .env):
  FRED_API_KEY ya existe — OpenBB lo consume con obb.user.credentials

COMPATIBILIDAD:
  - Python 3.10–3.14 (3.12 recomendado para +15% performance)
  - yfinance y FRED directo siguen activos en paralelo
  - OpenBB NO reemplaza yfinance — es un orquestador independiente
"""
from __future__ import annotations
import logging
import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import pandas as pd

log = logging.getLogger(__name__)

# ── Configuración de series Phase 3A ─────────────────────────────────────────

OPENBB_FRED_SERIES: dict[str, dict] = {
    # ── Mercado laboral USA ───────────────────────────────────────────────
    "UNRATE": {
        "title":    "Desempleo USA (Unemployment Rate)",
        "category": "Empleo USA",
        "unit":     "%",
        "fuente":   "OpenBB / FRED — Bureau of Labor Statistics",
        "tags":     ["empleo", "desempleo", "usa", "fed", "ciclo_economico"],
        "semantic": (
            "La tasa de desempleo de EE.UU. es el indicador laboral clave de la Fed. "
            "Un desempleo bajo (<4%) presiona salarios al alza e inflación, llevando "
            "a la Fed a mantener tasas altas. Un desempleo alto (>6%) acelera "
            "recortes de tasas y más liquidez para activos de riesgo incluidas startups. "
            "La dualidad mandato Fed: inflación + empleo pleno — ambos determinan "
            "el costo de capital para rondas de financiamiento."
        ),
    },
    # ── Liquidez global ───────────────────────────────────────────────────
    "M2SL": {
        "title":    "M2 Money Supply USA",
        "category": "Liquidez Global",
        "unit":     "miles M USD",
        "fuente":   "OpenBB / FRED — Federal Reserve",
        "tags":     ["liquidez", "m2", "fed", "qe", "qt", "capital_riesgo"],
        "semantic": (
            "El M2 es el agregado monetario más seguido por inversores. Cuando crece "
            "rápidamente (QE/expansión fiscal), el exceso de liquidez fluye a activos "
            "de riesgo: bolsa, VC, crypto y real estate. Cuando el M2 cae (QT), "
            "el capital se contrae y las valuaciones de startups caen por compresión "
            "de múltiplos. Es el proxy de apetito VC más directo disponible."
        ),
    },
    # ── Curva de rendimiento (predictor recesión) ─────────────────────────
    "T10Y2Y": {
        "title":    "Spread Curva 10Y-2Y USA (Indicador Recesion)",
        "category": "Riesgo Macro",
        "unit":     "%",
        "fuente":   "OpenBB / FRED — US Treasury",
        "tags":     ["curva_rendimiento", "recesion", "tasas", "spread", "indicador_adelantado"],
        "semantic": (
            "El spread entre tasas del Tesoro a 10 años y 2 años es el predictor "
            "de recesión más validado históricamente: ha precedido las 8 últimas "
            "recesiones USA. Una curva invertida (valor negativo) indica que el "
            "mercado anticipa recortes de tasas futuros — señal de desaceleración "
            "económica en 12-18 meses. Para startups: curva invertida = venture "
            "capital se vuelve más selectivo y las valuaciones se comprimen."
        ),
    },
    # ── Riesgo crédito corporativo ────────────────────────────────────────
    "BAMLH0A0HYM2": {
        "title":    "High Yield Credit Spread (Apetito Riesgo Credito)",
        "category": "Riesgo Credito",
        "unit":     "%",
        "fuente":   "OpenBB / FRED — ICE Bank of America",
        "tags":     ["high_yield", "credito", "spread", "riesgo", "bonos_corporativos"],
        "semantic": (
            "El spread de bonos high yield (OAS) mide el sobrecosto que pagan emisores "
            "de alto riesgo sobre los Treasuries. Cuando el spread sube (+400 bps), "
            "el mercado está en modo risk-off: inversores exigen más retorno por "
            "riesgo crediticio. Directamente correlacionado con rondas VC: spreads altos "
            "= inversores exigen más garantías, valuaciones down-round, rondas más lentas."
        ),
    },
    # ── Ciclo industrial ──────────────────────────────────────────────────
    "INDPRO": {
        "title":    "Produccion Industrial USA (Industrial Production Index)",
        "category": "Ciclo Industrial",
        "unit":     "índice (2017=100)",
        "fuente":   "OpenBB / FRED — Federal Reserve",
        "tags":     ["produccion_industrial", "ciclo_economico", "manufactura", "usa"],
        "semantic": (
            "El índice de producción industrial mide actividad fabril, minera y "
            "de utilities en EE.UU. Es un indicador coincidente del ciclo económico "
            "y proxy de demanda B2B industrial. Para startups de hardware, "
            "manufactura, logística o B2B industrial, la IP indica si sus clientes "
            "están en modo expansión o contracción. Cae antes de las recesiones "
            "y sube en recuperaciones."
        ),
    },
    # ── Forex global ──────────────────────────────────────────────────────
    "DEXCHUS": {
        "title":    "USD/CNY (Tipo de Cambio Yuan)",
        "category": "Forex Global",
        "unit":     "CNY por USD",
        "fuente":   "OpenBB / FRED — Federal Reserve / BIS",
        "tags":     ["forex", "china", "yuan", "comercio_global", "commodities"],
        "semantic": (
            "El USD/CNY es clave para el comercio global y los precios de commodities: "
            "China consume ~50% del cobre mundial, ~15% del crudo y ~30% de la soja. "
            "Una depreciación del yuan (CNY sube vs USD) reduce el poder adquisitivo "
            "chino en commodities, presionando a la baja el precio del cobre "
            "y afectando directamente los ingresos fiscales de Chile."
        ),
    },
}


# ── Phase 3B: World Bank Chile (stub activable) ───────────────────────────────

WORLD_BANK_CHILE_INDICATORS: dict[str, dict] = {
    # Símbolos EconDB que tienen cobertura para Chile (CL)
    # Verificado: obb.economy.indicators(symbol=X, country="CHL", provider="econdb")
    "URATE": {
        "title":    "Desempleo Chile (% fuerza laboral)",
        "category": "Chile Macro",
        "unit":     "%",
        "tags":     ["chile", "desempleo", "mercado_laboral", "ciclo_local"],
        "semantic": (
            "La tasa de desempleo local determina el costo y disponibilidad de talento "
            "en Chile. Desempleo bajo (<7%) = mercado laboral tenso, salarios "
            "al alza, costos operacionales más altos para startups. Sirve como "
            "indicador de ciclo económico doméstico, independiente de EE.UU."
        ),
    },
    "NIIP": {
        "title":    "Posicion de Inversion Internacional Chile (NIIP)",
        "category": "Chile Macro",
        "unit":     "mill. USD",
        "tags":     ["chile", "inversion_internacional", "capital_extranjero", "balanza_pagos"],
        "semantic": (
            "La Posicion de Inversion Internacional Neta mide la diferencia entre "
            "activos externos y pasivos externos de Chile. Una NIIP negativa grande "
            "puede indicar mayor dependencia de capital extranjero. Proxy de confianza "
            "inversora en la economia chilena y su entorno para startups."
        ),
    },
    "CPI": {
        "title":    "Inflacion Chile (CPI Indice Precios Consumidor)",
        "category": "Chile Macro",
        "unit":     "indice",
        "tags":     ["chile", "inflacion", "ipp", "costo_vida", "poder_adquisitivo"],
        "semantic": (
            "El indice de precios al consumidor de Chile mide la inflacion local. "
            "Inflacion alta en Chile eleva los costos operacionales de startups "
            "con operaciones locales: salarios, arriendo, servicios. Tambien "
            "determina las decisiones de tasa del Banco Central de Chile, "
            "que afecta el financiamiento de empresas locales."
        ),
    },
}


# ── Activación y setup ────────────────────────────────────────────────────────

def _setup_openbb() -> "object":
    """
    Importa OpenBB y configura credenciales desde variables de entorno.
    Levanta ImportError con instrucciones si openbb no está instalado.
    """
    try:
        from openbb import obb
    except ImportError:
        raise ImportError(
            "OpenBB no está instalado. Para activar Phase 3:\n"
            "  pip install openbb>=4.3.3\n"
            "  openbb-build\n"
            "Ver: https://github.com/OpenBB-finance/OpenBB"
        )

    # Configurar FRED API key (ya existe en .env)
    fred_key = os.getenv("FRED_API_KEY")
    if fred_key:
        obb.user.credentials.fred_api_key = fred_key
    else:
        raise EnvironmentError("FRED_API_KEY no configurada — requerida para Phase 3A")

    return obb


def _fetch_fred_series_via_openbb(
    obb: "object",
    symbol: str,
    start_date: str = "2019-01-01",
    limit: int = 80,
) -> list[dict]:
    """
    Descarga una serie FRED via OpenBB y la convierte a lista de observaciones.
    Retorna lista ordenada desc de {date: str, value: float}.
    """
    import pandas as pd

    result = obb.economy.fred_series(
        symbol=symbol,
        start_date=start_date,
        provider="fred",
    )
    df: pd.DataFrame = result.to_dataframe()

    # Normalizar columnas según versión de OpenBB
    if "date" not in df.columns and df.index.name == "date":
        df = df.reset_index()

    value_col = symbol.lower() if symbol.lower() in df.columns else df.columns[-1]

    obs = []
    for _, row in df.iterrows():
        try:
            date_str = str(row["date"])[:10]
            value = float(row[value_col])
            obs.append({"date": date_str, "value": round(value, 6)})
        except (ValueError, KeyError):
            continue

    obs_sorted = sorted(obs, key=lambda x: x["date"], reverse=True)
    return obs_sorted[:limit]


def _build_openbb_node(
    symbol: str,
    cfg: dict,
    observations: list[dict],
    url_override: str | None = None,
) -> dict:
    latest = observations[0] if observations else None
    freq = cfg.get("frecuencia", "mensual")
    content = (
        f"{cfg['semantic']} "
        f"Ultimo valor registrado: {latest['value'] if latest else 'N/A'} {cfg['unit']} "
        f"en {latest['date'][:7] if latest else 'N/A'}. "
        f"Serie historica {freq} con {len(observations)} observaciones."
    )
    url = url_override or cfg.get("url_fuente") or f"https://fred.stlouisfed.org/series/{symbol}"
    return {
        "document_title": cfg["title"],
        "header_path":    "Introduccion",
        "content":        content,
        "category":       cfg["category"],
        "tags":           cfg["tags"],
        "metadata": {
            "series_id":    symbol,
            "fuente":       cfg.get("fuente", "OpenBB"),
            "url_fuente":   url,
            "unidad":       cfg["unit"],
            "frecuencia":   freq,
            "ultima_fecha": latest["date"] if latest else None,
            "ultimo_valor": latest["value"] if latest else None,
            "observaciones": observations,
        },
        "embedding": None,
    }


# ── Entrypoints públicos ──────────────────────────────────────────────────────

def fetch_all_3a() -> list[dict]:
    """
    Phase 3A: descarga las 6 series FRED extendidas via OpenBB.
    Retorna lista de nodos lista para bulk_insert en knowledge_nodes.
    """
    obb = _setup_openbb()
    nodes: list[dict] = []

    for symbol, cfg in OPENBB_FRED_SERIES.items():
        log.info("  [3A] OpenBB/FRED/%s (%s)...", symbol, cfg["title"])
        try:
            obs = _fetch_fred_series_via_openbb(obb, symbol)
            if not obs:
                log.warning("  SKIP %s: sin observaciones", symbol)
                continue
            nodes.append(_build_openbb_node(symbol, cfg, obs))
            log.info("  -> %s: %d obs, ultimo=%.4f", symbol, len(obs), obs[0]["value"])
        except Exception as exc:
            log.error("  ERROR %s: %s", symbol, exc)

    log.info("  Phase 3A OK: %d/%d nodos construidos", len(nodes), len(OPENBB_FRED_SERIES))
    return nodes


def fetch_all_3b() -> list[dict]:
    """
    Phase 3B: datos del Banco Mundial para Chile.
    Requiere: openbb[economy] con World Bank provider habilitado.
    """
    obb = _setup_openbb()
    nodes: list[dict] = []
    log.info("  [3B] OpenBB / World Bank — Chile...")

    for indicator, cfg in WORLD_BANK_CHILE_INDICATORS.items():
        try:
            result = obb.economy.indicators(
                symbol=indicator,
                country="CHL",
                provider="econdb",
                frequency="month",
            )
            df = result.to_dataframe()
            # econdb: index=date, columns include 'value' always
            if df.index.name == "date":
                df = df.reset_index()
            date_col = "date" if "date" in df.columns else df.columns[0]
            # Always use 'value' column for econdb
            obs = sorted(
                [
                    {"date": str(row[date_col])[:10], "value": round(float(row["value"]), 6)}
                    for _, row in df.iterrows()
                    if row.get("value") is not None
                ],
                key=lambda x: x["date"],
                reverse=True,
            )
            # Limit to last 80 obs
            obs = obs[:80]
            if obs:
                url = f"https://econdb.com/series/{indicator}/?geo=CHL"
                cfg_aug = {**cfg, "fuente": "OpenBB / EconDB", "frecuencia": "mensual"}
                nodes.append(_build_openbb_node(indicator, cfg_aug, obs, url_override=url))
                log.info("  -> %s: %d obs, ultimo=%.4f", indicator, len(obs), obs[0]["value"])
        except Exception as exc:
            log.error("  ERROR EconDB %s: %s", indicator, exc)

    return nodes


def fetch_all() -> list[dict]:
    """
    Entrypoint principal Phase 3.
    Ejecuta 3A (FRED extendido) + 3B (World Bank Chile).
    """
    nodes: list[dict] = []
    nodes.extend(fetch_all_3a())

    try:
        nodes.extend(fetch_all_3b())
    except Exception as exc:
        log.warning("Phase 3B (World Bank) no disponible: %s", exc)

    return nodes
