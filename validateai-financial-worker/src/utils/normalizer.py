"""
Utilidades de normalización de series temporales para el pipeline de correlación.

Problema central: FRED devuelve GDP trimestral y CPI/FEDFUNDS mensual.
Los datos PYME son mensuales. Hay que alinear todo a una grilla mensual común
antes de calcular correlaciones o renderizar el gráfico de doble eje.
"""

from __future__ import annotations
from datetime import date


# ── Tipos ─────────────────────────────────────────────────────────────────────

ObsPoint = dict  # {"date": "YYYY-MM-DD", "value": float | None}


# ── Interpolación trimestral → mensual ────────────────────────────────────────

def interpolate_quarterly_to_monthly(observations: list[ObsPoint]) -> list[ObsPoint]:
    """
    Convierte una serie trimestral (4 puntos/año) a mensual via interpolación lineal.
    Entrada esperada: cualquier orden (la función ordena internamente).
    Salida: lista ascendente de puntos mensuales con date normalizado a YYYY-MM-01.
    """
    clean = sorted(
        [o for o in observations if o.get("value") is not None],
        key=lambda x: x["date"],
    )
    if len(clean) < 2:
        return clean

    result: list[ObsPoint] = []

    for i in range(len(clean) - 1):
        d_start = date.fromisoformat(clean[i]["date"][:10])
        d_end = date.fromisoformat(clean[i + 1]["date"][:10])
        v_start: float = clean[i]["value"]
        v_end: float = clean[i + 1]["value"]

        months_between = (d_end.year - d_start.year) * 12 + (d_end.month - d_start.month)
        if months_between <= 0:
            continue

        for m in range(months_between):
            frac = m / months_between
            interpolated = v_start + (v_end - v_start) * frac
            total_months = (d_start.year * 12 + d_start.month - 1) + m
            year, month = divmod(total_months, 12)
            month += 1
            result.append({"date": f"{year:04d}-{month:02d}-01", "value": round(interpolated, 6)})

    # Último punto
    last = clean[-1]
    result.append({"date": last["date"][:7] + "-01", "value": last["value"]})

    return result


# ── Alineación de dos series a fechas comunes ─────────────────────────────────

def align_series(
    series_a: list[ObsPoint],
    series_b: list[ObsPoint],
) -> tuple[list[ObsPoint], list[ObsPoint]]:
    """
    Retiene solo las fechas presentes en AMBAS series (intersección).
    Normaliza fechas a prefijo YYYY-MM para tolerancia de días distintos.
    Devuelve (a_alineada, b_alineada) ordenadas ascendentemente.
    """
    index_a = {o["date"][:7]: o["value"] for o in series_a}
    index_b = {o["date"][:7]: o["value"] for o in series_b}
    common_months = sorted(set(index_a) & set(index_b))

    aligned_a = [{"date": m + "-01", "value": index_a[m]} for m in common_months]
    aligned_b = [{"date": m + "-01", "value": index_b[m]} for m in common_months]

    return aligned_a, aligned_b


# ── Normalización min-max [0, 100] ────────────────────────────────────────────

def normalize_minmax(observations: list[ObsPoint]) -> list[ObsPoint]:
    """
    Escala los valores al rango [0, 100].
    Útil para superponer series con unidades incompatibles en un mismo eje.
    No destructivo: devuelve nueva lista.
    """
    values = [o["value"] for o in observations if o.get("value") is not None]
    if not values:
        return observations

    v_min, v_max = min(values), max(values)
    span = v_max - v_min or 1  # evitar división por cero en series constantes

    return [
        {**o, "value": round((o["value"] - v_min) / span * 100, 4)}
        if o.get("value") is not None
        else o
        for o in observations
    ]


# ── Recorte a ventana temporal ────────────────────────────────────────────────

def last_n_months(observations: list[ObsPoint], n: int = 24) -> list[ObsPoint]:
    """Retorna los últimos N meses de una serie ya ordenada ascendentemente."""
    return observations[-n:] if len(observations) > n else observations


# ── Pipeline completo para una serie GDP ──────────────────────────────────────

def prepare_gdp_series(raw_quarterly: list[ObsPoint], months: int = 24) -> list[ObsPoint]:
    """Shortcut: interpolación + recorte. Listo para alinear con series mensuales."""
    monthly = interpolate_quarterly_to_monthly(raw_quarterly)
    return last_n_months(monthly, months)
