"""
api/ops_alert.py — Alerting de operaciones hacia la sala de control en Discord.

Port del helper que usan mp-sync (TypeScript) y las Edge Functions (Deno).
Mismos canales, mismos colores y mismo formato de embed, para que la sala se lea
igual venga de donde venga el aviso.

POR QUÉ EXISTE
--------------
BralidusPY era el último servicio mudo del ecosistema. Corre 9 jobs de ingesta
(FRED, CMF, BCCh, SEIA, concursal, empleo, radar…) disparados por cron externo:
si uno se caía, no había señal fuera de los logs de Railway. Es exactamente la
situación que dejó la ingesta de Mercado Público tres días detenida sin que
nadie lo notara.

Los canales se separan por QUÉ HACER al ver el mensaje:
    incidentes   → algo está roto AHORA. Sólo rojo.
    latido       → corridas programadas que terminaron. El valor está en el
                   hueco: si dejan de llegar, algo se detuvo.
    degradacion  → lo que "funciona" mientras miente.

Nunca lanza: un fallo de alerting jamás debe romper el flujo que lo emitió.
Todas las funciones de acá capturan sus propias excepciones.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from typing import Literal

import requests

log = logging.getLogger(__name__)

Nivel = Literal["info", "warn", "error"]
Canal = Literal["incidentes", "latido", "degradacion"]

_EMOJI: dict[str, str] = {"error": "🔴", "warn": "🟡", "info": "🟢"}

# Color de la barra lateral del embed: la señal que se lee sin leer.
_COLOR: dict[str, int] = {"error": 0xE04F5F, "warn": 0xE0A44F, "info": 0x4FE08A}

_NOMBRE_CANAL: dict[str, str] = {
    "incidentes": "Incidentes",
    "latido": "Latido",
    "degradacion": "Degradación",
}

# Ventana de dedupe: como máximo un aviso por clave en este lapso.
_DEDUPE_S = 30 * 60
_ultimo_envio: dict[str, float] = {}
_lock = threading.Lock()

_TIMEOUT_S = 8


def _url_de_canal(canal: str) -> str | None:
    """URL del canal, con caída a incidentes si ese canal no está configurado.

    Preferible un canal mezclado a un aviso mudo.
    """
    incidentes = os.getenv("OPS_WEBHOOK_URL")
    por_canal = {
        "incidentes": incidentes,
        "latido": os.getenv("OPS_WEBHOOK_LATIDO"),
        "degradacion": os.getenv("OPS_WEBHOOK_DEGRADACION"),
    }
    return por_canal.get(canal) or incidentes


def _debe_enviar(clave: str) -> bool:
    ahora = time.time()
    with _lock:
        previo = _ultimo_envio.get(clave)
        if previo is not None and ahora - previo < _DEDUPE_S:
            return False
        _ultimo_envio[clave] = ahora
        if len(_ultimo_envio) > 200:
            for k, t in list(_ultimo_envio.items()):
                if ahora - t >= _DEDUPE_S:
                    del _ultimo_envio[k]
    return True


def _texto_plano(nivel: str, titulo: str, detalle: str | None, campos: list[tuple[str, str]]) -> str:
    partes = [f"{_EMOJI[nivel]} **{titulo}**"]
    if detalle:
        partes.append(detalle)
    if campos:
        partes.append(" · ".join(f"{n}: {v}" for n, v in campos))
    return "\n".join(partes)


def send_ops_alert(
    *,
    nivel: Nivel,
    titulo: str,
    detalle: str | None = None,
    campos: list[tuple[str, str]] | None = None,
    footer: str | None = None,
    canal: Canal | None = None,
    dedupe_key: str | None = None,
) -> None:
    """Publica un aviso. Fire-and-forget: nunca lanza y nunca bloquea el flujo.

    `campos` son pares (nombre, valor) que se renderizan como columnas del embed.
    """
    campos = campos or []
    canal_final: str = canal or ("incidentes" if nivel == "error" else "latido")

    # Siempre al log, haya webhook o no.
    linea = f"[ops-alert:{canal_final}] {titulo}" + (f" — {detalle}" if detalle else "")
    if nivel == "error":
        log.error(linea)
    else:
        log.warning(linea)

    url = _url_de_canal(canal_final)
    if not url:
        return
    if not _debe_enviar(f"{canal_final}:{dedupe_key or titulo}"):
        return

    plano = _texto_plano(nivel, titulo, detalle, campos)
    embed: dict = {
        "title": f"{_EMOJI[nivel]}  {titulo}"[:256],
        "color": _COLOR[nivel],
        "footer": {"text": f"{footer or 'bralidus'} · {_NOMBRE_CANAL[canal_final]}"[:2048]},
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    if detalle:
        embed["description"] = detalle[:4096]
    if campos:
        # Discord admite hasta 25 campos por embed.
        embed["fields"] = [
            {"name": n[:256], "value": (v or "—")[:1024], "inline": True} for n, v in campos[:25]
        ]

    try:
        res = requests.post(
            url,
            json={"embeds": [embed], "text": plano},
            timeout=_TIMEOUT_S,
        )
        if res.status_code >= 400:
            # Un embed mal formado da 400 y el aviso se perdería del todo.
            # Mejor feo que mudo.
            requests.post(url, json={"content": plano, "text": plano}, timeout=_TIMEOUT_S)
    except Exception as err:  # noqa: BLE001 — el alerting nunca debe propagar
        log.warning("[ops-alert] fallo al enviar webhook: %s", err)
