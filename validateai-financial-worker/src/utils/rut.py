"""
src/utils/rut.py — Validación y normalización de RUT chileno (Módulo 11).

S-Pulse valida el RUT con Módulo 11 y rechaza formatos inválidos con 400.
Validar en Bralidus antes de llamar evita round-trips desperdiciados y da un
mensaje de error local claro.

Formato canónico usado por S-Pulse: sin puntos, con guion y DV en mayúscula.
  "76.086.428-5" → "76086428-5"
  "9.803.582-K"  → "9803582-K"
"""
from __future__ import annotations
import re

_CLEAN_RE = re.compile(r"[^0-9kK]")


def normalize_rut(rut: str) -> str:
    """
    Normaliza a formato canónico `<cuerpo>-<DV>` sin puntos, DV en mayúscula.
    No valida el dígito verificador — solo reformatea. Lanza ValueError si no
    hay al menos cuerpo + DV.
    """
    cleaned = _CLEAN_RE.sub("", rut or "").upper()
    if len(cleaned) < 2:
        raise ValueError(f"RUT demasiado corto: {rut!r}")
    body, dv = cleaned[:-1], cleaned[-1]
    if not body.isdigit():
        raise ValueError(f"Cuerpo de RUT no numérico: {rut!r}")
    return f"{int(body)}-{dv}"


def _compute_dv(body: int) -> str:
    """Calcula el dígito verificador (Módulo 11) para el cuerpo numérico."""
    total = 0
    factor = 2
    for digit in reversed(str(body)):
        total += int(digit) * factor
        factor = 2 if factor == 7 else factor + 1
    remainder = 11 - (total % 11)
    if remainder == 11:
        return "0"
    if remainder == 10:
        return "K"
    return str(remainder)


def is_valid_rut(rut: str) -> bool:
    """True si el RUT tiene formato válido y su DV cierra con Módulo 11."""
    try:
        canonical = normalize_rut(rut)
    except ValueError:
        return False
    body_str, dv = canonical.split("-", 1)
    return _compute_dv(int(body_str)) == dv.upper()
