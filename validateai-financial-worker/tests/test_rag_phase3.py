"""
tests/test_rag_phase3.py
Test completo del RAG con entidades Phase 3 via FastAPI TestClient.
Corre: py tests/test_rag_phase3.py
"""
import sys
sys.path.insert(0, ".")

from dotenv import load_dotenv
load_dotenv()

# Usar TestClient para evitar necesidad de servidor externo
from fastapi.testclient import TestClient
from api.app import app

client = TestClient(app)


def sep(title):
    print(f"\n{'='*65}")
    print(f"  {title}")
    print("="*65)


# ── TEST 1: Health ────────────────────────────────────────────────────────────
sep("TEST 1 - Health (nodos + edges)")
r = client.get("/health")
assert r.status_code == 200, f"FAIL: {r.status_code}"
h = r.json()
supa = next(s for s in h["services"] if s["name"] == "supabase")
print(f"  status:  {h['status']}")
print(f"  supabase: {supa['detail']}")
print(f"  nodes_with_embedding: {h['nodes_with_embedding']}")
# "degraded" es aceptable en TestClient (scheduler no inicia sin event loop)
supa_ok = supa["ok"]
assert supa_ok, "FAIL: supabase no responde"
print(f"  PASS: health OK (status={h['status']}, supabase={supa_ok})")


# ── TEST 2: Entities endpoint — Phase 3 categorias ───────────────────────────
sep("TEST 2 - GET /entities — Phase 3 categories")
r = client.get("/entities")
assert r.status_code == 200
ent = r.json()
p3_categories = [
    "Empleo USA", "Liquidez Global", "Riesgo Macro",
    "Riesgo Credito", "Ciclo Industrial", "Forex Global", "Chile Macro",
]
cats_found = set(ent.get("by_category", {}).keys())
print(f"  Total categorias: {len(cats_found)}")
for cat in p3_categories:
    status = "OK" if cat in cats_found else "MISSING"
    count = len(ent.get("by_category", {}).get(cat, []))
    print(f"  [{status}] {cat}: {count} nodo(s)")

p3_present = sum(1 for c in p3_categories if c in cats_found)
print(f"\n  Phase 3 categories: {p3_present}/{len(p3_categories)} presentes")
if p3_present >= 5:
    print("  PASS: Phase 3 en knowledge vault")
else:
    print("  WARN: algunas categorias Phase 3 faltan")


# ── TEST 3: Query fintech/seed/chile — Phase 3 routing ───────────────────────
sep("TEST 3 - POST /query — fintech/seed/chile (Phase 3 routing)")
r = client.post("/query", json={
    "query": "como afecta el desempleo de EE.UU. y la liquidez global M2 a las rondas de financiamiento para mi fintech chilena?",
    "startup_context": {
        "industry": "fintech",
        "stage": "seed",
        "geography": "chile",
        "revenue_model": "saas"
    },
    "top_k": 8,
    "match_threshold": 0.35
})
assert r.status_code == 200, f"FAIL: {r.text[:200]}"
resp = r.json()

print(f"  entities_activated: {len(resp['entities_activated'])}")
print(f"  routing_reason: {resp['routing_reason'][:90]}...")
print(f"  total_hits:  {resp['total_hits']}")
print(f"  graph_hits:  {resp['graph_hits']}")
print(f"  vector_hits: {resp['vector_hits']}")
print(f"\n  Nodos retornados:")
for node in resp["nodes"]:
    print(f"    [{node['source_type']:6}] {node['document_title'][:52]:<52} (rel={node['relevance']:.2f})")

# Verificar entidades Phase 3 en routing
p3_groups_activated = [
    g for g in ["empleo_usa", "liquidez_global", "riesgo_macro"]
    if g in resp["routing_reason"]
]
print(f"\n  Phase 3 grupos en routing: {p3_groups_activated}")

# Buscar nodos Phase 3 entre los retornados
p3_titles_expected = [
    "Desempleo USA (Unemployment Rate)",
    "M2 Money Supply USA",
    "Spread Curva 10Y-2Y USA (Indicador Recesion)",
    "High Yield Credit Spread (Apetito Riesgo Credito)",
    "Produccion Industrial USA (Industrial Production Index)",
    "USD/CNY (Tipo de Cambio Yuan)",
]
titles_returned = [n["document_title"] for n in resp["nodes"]]
p3_in_result = [t for t in p3_titles_expected if t in titles_returned]
print(f"  Phase 3 nodes en resultado: {len(p3_in_result)}")
for t in p3_in_result:
    print(f"    + {t}")


# ── TEST 4: Query exportacion/growth/latam ────────────────────────────────────
sep("TEST 4 - POST /query — exportacion/growth/latam")
r2 = client.post("/query", json={
    "query": "como impacta el yuan chino y el desempleo local chileno a mi startup de exportacion de productos agricolas?",
    "startup_context": {
        "industry": "exportacion",
        "stage": "growth",
        "geography": "latam",
        "revenue_model": "b2b"
    },
    "top_k": 8,
    "match_threshold": 0.35
})
assert r2.status_code == 200
resp2 = r2.json()
print(f"  total_hits: {resp2['total_hits']} | graph: {resp2['graph_hits']} | vector: {resp2['vector_hits']}")
print(f"  Nodos:")
for n in resp2["nodes"]:
    print(f"    [{n['source_type']:6}] {n['document_title'][:55]}")

# forex_global debe aparecer para exportacion/latam
forex_hit = any("Yuan" in n["document_title"] or "CNY" in n["document_title"] for n in resp2["nodes"])
chile_hit = any("Chile" in n["document_title"] for n in resp2["nodes"])
print(f"\n  USD/CNY en resultado: {'PASS' if forex_hit else 'MISS'}")
print(f"  Chile Macro en resultado: {'PASS' if chile_hit else 'MISS'}")


# ── TEST 5: Context para LLM ──────────────────────────────────────────────────
sep("TEST 5 - context_for_llm quality")
ctx = resp["context_for_llm"]
print(f"  Longitud context: {len(ctx)} chars")
has_p3 = any(kw in ctx for kw in ["Desempleo", "M2", "Spread", "High Yield", "INDPRO", "Yuan"])
print(f"  Contiene datos Phase 3: {'SI' if has_p3 else 'NO'}")
print(f"\n  Primeras 350 chars:")
print("  " + ctx[:350].replace("\n", "\n  "))


# ── TEST 6: Cache (segunda llamada identica) ──────────────────────────────────
sep("TEST 6 - Cache embedding")
import time
t0 = time.time()
r3 = client.post("/query", json={
    "query": "como afecta el desempleo de EE.UU. y la liquidez global M2 a las rondas de financiamiento para mi fintech chilena?",
    "startup_context": {"industry": "fintech", "stage": "seed", "geography": "chile"},
    "top_k": 8,
    "match_threshold": 0.35
})
t1 = time.time()
t_cache = (t1 - t0) * 1000

cache_r = client.get("/cache")
cache_stats = cache_r.json()
print(f"  Tiempo 2da llamada: {t_cache:.0f}ms")
print(f"  Cache entries: {cache_stats.get('entries', 0)}")
print(f"  Cache hit_rate: {cache_stats.get('hit_rate', 0):.2%}")
if cache_stats.get("entries", 0) > 0:
    print("  PASS: cache activo")


print("\n" + "="*65)
print("  TODOS LOS TESTS COMPLETADOS")
print("="*65)
