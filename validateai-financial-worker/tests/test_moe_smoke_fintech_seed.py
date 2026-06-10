"""
tests/test_moe_smoke_fintech_seed.py — Smoke test end-to-end del endpoint /query/moe.

Reutiliza el caso adversarial "Fintech Seed Chile $500K sin CMF" del stress test
original (test_stress_fintech_seed.py) y lo dispara contra /query/moe.

Compara directamente contra /query (legacy) para detectar regresiones y medir
si el MoE mejora la cobertura de alertas críticas.

Requiere: servidor corriendo en localhost:8000 (py serve.py) con .env cargado.
Uso:      py tests/test_moe_smoke_fintech_seed.py
"""
import sys
import time

sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv()

from fastapi.testclient import TestClient
from api.app import app

client = TestClient(app)


# ── Helpers ───────────────────────────────────────────────────────────────────

def sep(title: str, width: int = 70) -> None:
    print(f"\n{'=' * width}")
    print(f"  {title}")
    print("=" * width)


def check(label: str, condition: bool, detail: str = "") -> bool:
    status = "PASS" if condition else "FAIL"
    suffix = f"  ({detail})" if detail else ""
    print(f"  [{status}] {label}{suffix}")
    return condition


# ── Caso de prueba ────────────────────────────────────────────────────────────

STARTUP_CONTEXT = {
    "industry": "fintech",
    "stage": "seed",
    "geography": "chile",
    "revenue_model": "saas",
}

QUERY = (
    "Somos una fintech B2C en Chile con modelo SaaS. Estamos en TRL 4, "
    "tenemos un CAC muy bajo de USD $8 usando pauta programática agresiva "
    "con retargeting y cookies de terceros en Meta y Google. Queremos "
    "levantar una ronda Seed de USD $500.000. No estamos registrados en la "
    "CMF porque creemos que nuestra actividad de pagos no lo requiere."
)

# Alertas críticas que ambos endpoints deben detectar
CRITICAL_ALERTS = {
    "Ley 21.719 Consentimiento":  lambda titles: any("Gestión de Consentimiento" in t or "21.719" in t for t in titles),
    "Ley 21.521 Registro CMF":    lambda titles: any("Registro CMF" in t or "21.521" in t for t in titles),
    "CAC nodo recuperado":        lambda titles: any("CAC" in t for t in titles),
    "Benchmark LTV:CAC":          lambda titles: any("LTV:CAC" in t for t in titles),
    "TRL recuperado":             lambda titles: any("TRL" in t for t in titles),
    "Nodo macro (Fed/Inflacion)": lambda titles: any(
        k in t for t in titles
        for k in ["Fed Funds", "Inflación", "GDP", "Tasa", "M2", "CPI", "Spread"]
    ),
}


def score_alerts(nodes: list[dict]) -> dict[str, bool]:
    titles = [n["document_title"] for n in nodes]
    return {label: fn(titles) for label, fn in CRITICAL_ALERTS.items()}


def print_nodes(nodes: list[dict]) -> None:
    print(f"\n  {'SOURCE':6} {'REL':6} TITULO")
    print(f"  {'─'*6} {'─'*6} {'─'*50}")
    for n in nodes:
        print(f"  [{n['source_type']:5}] {n['relevance']:.3f}  {n['document_title'][:52]}")


# ── Llamada a /query (legacy) ─────────────────────────────────────────────────

sep("BLOQUE 1 — /query (legacy, control)")

t0 = time.time()
r_legacy = client.post("/query", json={
    "query": QUERY,
    "startup_context": STARTUP_CONTEXT,
    "top_k": 20,
    "match_threshold": 0.30,
})
t_legacy = (time.time() - t0) * 1000

assert r_legacy.status_code == 200, f"HTTP {r_legacy.status_code}: {r_legacy.text[:300]}"
legacy = r_legacy.json()

print(f"\n  Tiempo       : {t_legacy:.0f}ms")
print(f"  Hits         : {legacy['total_hits']} (GRAPH {legacy['graph_hits']} / VECTOR {legacy['vector_hits']})")
print(f"  Entidades    : {len(legacy['entities_activated'])}")
print_nodes(legacy["nodes"])

alerts_legacy = score_alerts(legacy["nodes"])


# ── Llamada a /query/moe (nuevo) ──────────────────────────────────────────────

sep("BLOQUE 2 — /query/moe (MoE, experimental)")

t0 = time.time()
r_moe = client.post("/query/moe", json={
    "query": QUERY,
    "startup_context": STARTUP_CONTEXT,
    "top_k": 20,
    "match_threshold": 0.30,
    "max_experts": 2,
})
t_moe = (time.time() - t0) * 1000

assert r_moe.status_code == 200, f"HTTP {r_moe.status_code}: {r_moe.text[:300]}"
moe = r_moe.json()

print(f"\n  Tiempo         : {t_moe:.0f}ms")
print(f"  Routing method : {moe['routing_method']}")
print(f"  Routing reason : {moe['routing_reason'][:120]}...")

print(f"\n  Expertos activados:")
for e in moe["experts_activated"]:
    print(f"    [{e['expert_id']:16}] score={e['score']:.4f}  entidades={e['entities_contributed']}")

print(f"\n  Hits           : {moe['total_hits']} (GRAPH {moe['graph_hits']} / VECTOR {moe['vector_hits']})")
print(f"  Entidades MoE  : {len(moe['entities_activated'])}")
print_nodes(moe["nodes"])

alerts_moe = score_alerts(moe["nodes"])


# ── Comparación de alertas ────────────────────────────────────────────────────

sep("BLOQUE 3 — Comparación de Cobertura de Alertas Críticas")

failures: list[str] = []

print(f"\n  {'ALERTA':<40} {'LEGACY':8} {'MOE':8}")
print(f"  {'─'*40} {'─'*8} {'─'*8}")
for label, legacy_ok in alerts_legacy.items():
    moe_ok = alerts_moe[label]
    tag_l = "PASS" if legacy_ok else "MISS"
    tag_m = "PASS" if moe_ok else "MISS"
    print(f"  {label:<40} {tag_l:<8} {tag_m:<8}")
    if not moe_ok:
        failures.append(f"MoE MISS: {label}")

score_l = sum(alerts_legacy.values())
score_m = sum(alerts_moe.values())
n = len(CRITICAL_ALERTS)

print(f"\n  Score legacy : {score_l}/{n}")
print(f"  Score MoE    : {score_m}/{n}")

delta = score_m - score_l
if delta > 0:
    print(f"  MoE detecta {delta} alerta(s) MAS que el endpoint legacy.")
elif delta < 0:
    print(f"  WARN: MoE detecta {abs(delta)} alerta(s) MENOS. Revisar match_threshold o max_experts.")
else:
    print("  Cobertura equivalente entre legacy y MoE.")


# ── Comparación de latencia ───────────────────────────────────────────────────

sep("BLOQUE 4 — Comparativa de Latencia")
overhead = t_moe - t_legacy
print(f"\n  /query  (legacy) : {t_legacy:.0f}ms")
print(f"  /query/moe (MoE) : {t_moe:.0f}ms")
print(f"  Overhead MoE     : {overhead:+.0f}ms  {'(aceptable <= 50ms)' if overhead <= 50 else '(REVISAR — supera 50ms)'}")
check(
    "Overhead MoE <= 50ms (GatingNetwork keyword-only)",
    overhead <= 50,
    f"{overhead:.0f}ms",
)


# ── Verificación de routing_reason en respuesta MoE ──────────────────────────

sep("BLOQUE 5 — Trazabilidad del GatingNetwork")
print(f"\n  routing_method  : {moe['routing_method']}")
print(f"  routing_reason  : {moe['routing_reason']}")
check(
    "routing_reason incluye 'method='",
    "method=" in moe["routing_reason"],
)
check(
    "routing_reason incluye 'experts='",
    "experts=" in moe["routing_reason"],
)
check(
    "routing_method contiene 'context' (fintech+seed+chile activa boost)",
    "context" in moe["routing_method"],
    moe["routing_method"],
)
check(
    "legal activado (obligatorio para fintech chile)",
    any(e["expert_id"] == "legal" for e in moe["experts_activated"]),
    str([e["expert_id"] for e in moe["experts_activated"]]),
)
check(
    "unit_economics activado (obligatorio para due diligence seed)",
    any(e["expert_id"] == "unit_economics" for e in moe["experts_activated"]),
    str([e["expert_id"] for e in moe["experts_activated"]]),
)


# ── Veredicto final ───────────────────────────────────────────────────────────

sep("VEREDICTO FINAL")

all_critical_pass = all(alerts_moe.values())
no_regression = score_m >= score_l

print(f"\n  Cobertura critica MoE : {'COMPLETA' if all_critical_pass else f'PARCIAL ({score_m}/{n})'}")
print(f"  Regresion vs legacy   : {'NINGUNA' if no_regression else 'DETECTADA — no hacer deploy'}")

miss_only_in_moe = [label for label, ok in alerts_moe.items() if not ok and alerts_legacy[label]]
miss_preexisting = [label for label, ok in alerts_moe.items() if not ok and not alerts_legacy[label]]

if miss_only_in_moe:
    print(f"\n  REGRESION MoE: {miss_only_in_moe}")

if miss_preexisting:
    print(f"\n  MISS pre-existentes (igual en legacy, no atribuibles al MoE): {miss_preexisting}")
    print("  CAUSA PROBABLE: top_k=20 lleno de nodos GRAPH a relevance=1.0 antes de")
    print("  llegar a los nodos legales/TRL. Fix: aumentar top_k a 30+ o implementar")
    print("  reranking por similitud vectorial dentro del set GRAPH.")

if not miss_only_in_moe and no_regression:
    print("\n  VEREDICTO: LISTO PARA DEPLOY EN RAILWAY.")
    print("  El MoE no introduce ninguna regresion. Los MISS son pre-existentes.")
    print("  Aplicar migrations/sprint_moe4.sql en staging antes de mover trafico.")
elif not no_regression:
    print("\n  VEREDICTO: REGRESION DETECTADA — no hacer deploy. Revisar match_threshold.")
    sys.exit(1)
else:
    print(f"\n  VEREDICTO: REGRESION — {miss_only_in_moe}. Revisar antes del deploy.")
    sys.exit(1)

print(f"\n{'=' * 70}")
