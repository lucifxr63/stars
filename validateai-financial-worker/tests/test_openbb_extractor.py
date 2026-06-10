"""
tests/test_openbb_extractor.py
Testeo completo del extractor OpenBB Phase 3A + entity_router Phase 3.
Corre: py tests/test_openbb_extractor.py
"""
import os
import sys
sys.path.insert(0, ".")

from dotenv import load_dotenv
load_dotenv()


def sep(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)


# ── TEST 1: OpenBB import + setup ─────────────────────────────────────────────
sep("TEST 1 — OpenBB setup + FRED credentials")
from src.extractors.openbb_extractor import _setup_openbb, _fetch_fred_series_via_openbb, OPENBB_FRED_SERIES

fred_key = os.getenv("FRED_API_KEY", "")
print(f"  FRED_API_KEY: {fred_key[:6]}... ({len(fred_key)} chars)")

obb = _setup_openbb()
print(f"  obb type: {type(obb).__name__}")
print("  PASS: OpenBB setup OK")


# ── TEST 2: UNRATE fetch ──────────────────────────────────────────────────────
sep("TEST 2 — UNRATE (Unemployment Rate)")
try:
    obs = _fetch_fred_series_via_openbb(obb, "UNRATE")
    print(f"  observaciones: {len(obs)}")
    print(f"  latest:  {obs[0]}")
    print(f"  oldest:  {obs[-1]}")
    print(f"  PASS: UNRATE OK")
except Exception as e:
    print(f"  FAIL: {e}")


# ── TEST 3: M2SL fetch ────────────────────────────────────────────────────────
sep("TEST 3 — M2SL (Money Supply)")
try:
    obs = _fetch_fred_series_via_openbb(obb, "M2SL")
    print(f"  observaciones: {len(obs)}")
    print(f"  latest:  {obs[0]}")
    print("  PASS: M2SL OK")
except Exception as e:
    print(f"  FAIL: {e}")


# ── TEST 4: T10Y2Y fetch ──────────────────────────────────────────────────────
sep("TEST 4 — T10Y2Y (Yield Curve Spread)")
try:
    obs = _fetch_fred_series_via_openbb(obb, "T10Y2Y")
    print(f"  observaciones: {len(obs)}")
    print(f"  latest:  {obs[0]}")
    print("  PASS: T10Y2Y OK")
except Exception as e:
    print(f"  FAIL: {e}")


# ── TEST 5: fetch_all_3a (todos los simbolos) ──────────────────────────────────
sep("TEST 5 — fetch_all_3a (6 series FRED via OpenBB)")
from src.extractors.openbb_extractor import fetch_all_3a

nodes = fetch_all_3a()
print(f"\n  Nodos construidos: {len(nodes)}/{len(OPENBB_FRED_SERIES)}")
for node in nodes:
    meta = node.get("metadata", {})
    print(f"  [{node['category']}] {node['document_title']}")
    print(f"    ultimo={meta.get('ultimo_valor')} {meta.get('unidad')}"
          f" ({meta.get('ultima_fecha', '')[:7]})"
          f" | {meta.get('observaciones') and len(meta['observaciones'])} obs")

if len(nodes) == len(OPENBB_FRED_SERIES):
    print("\n  PASS: todos los nodos construidos")
else:
    print(f"\n  WARN: {len(OPENBB_FRED_SERIES) - len(nodes)} nodos fallaron")


# ── TEST 6: entity_router Phase 3 groups ─────────────────────────────────────
sep("TEST 6 — entity_router con grupos Phase 3")
from api.entity_router import route, ENTITY_GROUPS

# Verificar que los nuevos grupos existen
p3_groups = ["empleo_usa", "liquidez_global", "riesgo_macro",
             "ciclo_industrial", "forex_global", "chile_macro"]
print("  Grupos Phase 3 en ENTITY_GROUPS:")
for g in p3_groups:
    titles = ENTITY_GROUPS.get(g, [])
    status = "OK" if titles else "MISSING"
    print(f"    [{status}] {g}: {titles}")

print()
# Test routing fintech (debe activar empleo_usa + liquidez_global + riesgo_macro)
result = route(industry="fintech", stage="seed", geography="chile")
print(f"  fintech/seed/chile -> {len(result.entities)} entidades")
print(f"  grupos: {result.groups_activated}")
print(f"  muestra entidades:")
for e in result.entities[:8]:
    print(f"    - {e}")

p3_active = any(g in result.groups_activated for g in ["empleo_usa", "liquidez_global", "riesgo_macro"])
print(f"\n  Phase 3 grupos activos: {'PASS' if p3_active else 'FAIL'}")

# Test routing exportacion (debe activar forex_global + chile_macro)
result2 = route(industry="exportacion", stage="growth", geography="latam")
print()
print(f"  exportacion/growth/latam -> {len(result2.entities)} entidades")
p3_export = "forex_global" in result2.groups_activated and "chile_macro" in result2.groups_activated
print(f"  forex_global + chile_macro activos: {'PASS' if p3_export else 'FAIL'}")


# ── TEST 7: nodos generados tienen campos válidos ─────────────────────────────
sep("TEST 7 — Validación de estructura de nodos OpenBB")
required_fields = ["document_title", "header_path", "content", "category", "tags", "metadata"]
all_ok = True
for node in nodes:
    missing = [f for f in required_fields if f not in node]
    if missing:
        print(f"  FAIL: {node['document_title']} missing: {missing}")
        all_ok = False
    meta = node.get("metadata", {})
    if not meta.get("observaciones"):
        print(f"  FAIL: {node['document_title']} sin observaciones")
        all_ok = False
    if not node.get("content"):
        print(f"  FAIL: {node['document_title']} content vacio")
        all_ok = False

if all_ok:
    print(f"  PASS: todos los {len(nodes)} nodos tienen estructura correcta")
    content_sample = nodes[0]["content"][:200]
    print(f"  content sample:\n    '{content_sample}...'")


print("\n" + "="*60)
print("  TESTS COMPLETADOS")
print("="*60)
