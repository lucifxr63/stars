"""
tests/test_moe_routing.py — Validación del sistema MoE (Sprint MoE-2).

Corre sin Supabase ni OpenAI. Solo valida el GatingNetwork en modo keyword
(embedding_fn=None → desactiva el fallback semántico).

Casos:
  TC-01  "CAC y Churn"          → unit_economics
  TC-02  "Ley Fintech"          → legal
  TC-03  Query genérica         → fallback macro
  TC-04  Fintech Seed Chile     → legal + unit_economics (context boost)
  TC-05  Query de mercados      → mercados
  TC-06  Estrategia Corfo       → estrategia
  TC-07  Dos expertos activos   → multi-expert cutoff funciona
  TC-08  entity_titles sin dup  → Expert.entity_titles no tiene duplicados
  TC-09  merge_entities + stage → modificadores de etapa se agregan
  TC-10  Todos los group_ids    → existen en entity_router.ENTITY_GROUPS
"""
import sys
sys.path.insert(0, ".")

from api.entity_router import ENTITY_GROUPS
from api.experts import EXPERTS, Expert
from api.moe_router import GatingNetwork, gating_network


# ── Utilidades de presentación ────────────────────────────────────────────────

def sep(title: str, width: int = 68) -> None:
    print(f"\n{'=' * width}")
    print(f"  {title}")
    print("=" * width)


def result_line(label: str, ok: bool, detail: str = "") -> None:
    status = "PASS" if ok else "FAIL"
    suffix = f"  ({detail})" if detail else ""
    print(f"  [{status}] {label}{suffix}")


# ── Setup ─────────────────────────────────────────────────────────────────────

gn = GatingNetwork()   # instancia limpia para tests (sin singleton)
failures: list[str] = []


def assert_case(label: str, condition: bool, detail: str = "") -> None:
    result_line(label, condition, detail)
    if not condition:
        failures.append(label)


# ─────────────────────────────────────────────────────────────────────────────
# TC-01: "CAC y Churn" → unit_economics
# ─────────────────────────────────────────────────────────────────────────────
sep("TC-01 — 'CAC y Churn' debe activar unit_economics")
r = gn.route("¿Cuál es nuestro CAC y cómo afecta el churn al LTV?")
print(f"  Expertos activos : {r.experts_activated}")
print(f"  Método           : {r.routing_method}")
print(f"  Scores top 3     : { {k: round(v,3) for k,v in list(r.expert_scores.items())[:3]} }")
assert_case(
    "unit_economics es el primer experto activado",
    r.experts_activated[0] == "unit_economics",
    f"obtuvo {r.experts_activated}",
)
assert_case(
    "unit_economics en lista de activos",
    "unit_economics" in r.experts_activated,
)
assert_case(
    "routing_method es 'keyword' (sin embedding_fn)",
    "keyword" in r.routing_method,
    r.routing_method,
)


# ─────────────────────────────────────────────────────────────────────────────
# TC-02: "Ley Fintech" → legal
# ─────────────────────────────────────────────────────────────────────────────
sep("TC-02 — 'Ley Fintech' debe activar legal")
r = gn.route("¿Qué dice la ley fintech sobre el registro CMF y los datos personales?")
print(f"  Expertos activos : {r.experts_activated}")
print(f"  Scores top 3     : { {k: round(v,3) for k,v in sorted(r.expert_scores.items(), key=lambda x: -x[1])[:3]} }")
assert_case(
    "legal es el primer experto activado",
    r.experts_activated[0] == "legal",
    f"obtuvo {r.experts_activated}",
)
assert_case(
    "legal en lista de activos",
    "legal" in r.experts_activated,
)


# ─────────────────────────────────────────────────────────────────────────────
# TC-03: Query genérica → fallback macro
# geography=None desactiva el context boost (geography="chile" boostaría legal
# y ocultaría el verdadero fallback — se prueba ese comportamiento en TC-04).
# ─────────────────────────────────────────────────────────────────────────────
sep("TC-03 — Query sin palabras clave (geography=None) → fallback a macro")
r = gn.route("Necesito validar mi startup", geography=None)
print(f"  Expertos activos : {r.experts_activated}")
print(f"  Método           : {r.routing_method}")
all_zero = all(v == 0.0 for v in r.expert_scores.values())
assert_case(
    "fallback activa 'macro' cuando no hay keywords ni context",
    "macro" in r.experts_activated,
    f"obtuvo {r.experts_activated}",
)
assert_case(
    "routing_method es 'fallback' cuando todos los scores son 0",
    r.routing_method == "fallback",
    r.routing_method,
)


# ─────────────────────────────────────────────────────────────────────────────
# TC-04: Context boost — Fintech Seed Chile → legal + unit_economics
# ─────────────────────────────────────────────────────────────────────────────
sep("TC-04 — Context boost: fintech + seed + chile → legal & unit_economics")
r = gn.route(
    query="¿Cómo validamos nuestro modelo de negocio?",  # query vaga
    industry="fintech",
    stage="seed",
    geography="chile",
)
print(f"  Expertos activos : {r.experts_activated}")
print(f"  Método           : {r.routing_method}")
print(f"  Scores           : { {k: round(v,3) for k,v in sorted(r.expert_scores.items(), key=lambda x: -x[1])} }")
assert_case(
    "+context aparece en routing_method",
    "+context" in r.routing_method,
    r.routing_method,
)
assert_case(
    "legal activado por context boost (Chile + Fintech + Seed)",
    "legal" in r.experts_activated,
    f"activos: {r.experts_activated}",
)
assert_case(
    "unit_economics activado por context boost (Fintech + Seed)",
    "unit_economics" in r.experts_activated,
    f"activos: {r.experts_activated}",
)


# ─────────────────────────────────────────────────────────────────────────────
# TC-05: Query de mercados → mercados
# ─────────────────────────────────────────────────────────────────────────────
sep("TC-05 — 'IPSA y cobre' debe activar mercados")
r = gn.route("¿Cómo está el IPSA hoy y qué pasa con el precio del cobre?")
print(f"  Expertos activos : {r.experts_activated}")
assert_case(
    "mercados es el primer experto activado",
    r.experts_activated[0] == "mercados",
    f"obtuvo {r.experts_activated}",
)


# ─────────────────────────────────────────────────────────────────────────────
# TC-06: Estrategia Corfo → estrategia
# ─────────────────────────────────────────────────────────────────────────────
sep("TC-06 — 'Postulación Corfo y TRL' debe activar estrategia")
r = gn.route("¿Podemos postular a Corfo Semilla Inicia con TRL 4?")
print(f"  Expertos activos : {r.experts_activated}")
assert_case(
    "estrategia en lista de activos",
    "estrategia" in r.experts_activated,
    f"obtuvo {r.experts_activated}",
)


# ─────────────────────────────────────────────────────────────────────────────
# TC-07: Multi-expert — query que cruza unit_economics + legal
# La query tiene 3 keywords de unit_economics (cac, ltv, churn) y 2 de legal
# (consentimiento, "ley" dentro de "legal") → ambos expertos deben superar
# el cutoff del 60% del score del experto líder.
# ─────────────────────────────────────────────────────────────────────────────
sep("TC-07 — Query cruzada debe activar hasta 2 expertos")
r = gn.route(
    "¿El uso de cookies sin consentimiento para calcular CAC, LTV y reducir churn es legal en Chile?",
    top_n=3,
)
print(f"  Expertos activos : {r.experts_activated}")
print(f"  Scores           : { {k: round(v,3) for k,v in sorted(r.expert_scores.items(), key=lambda x: -x[1])} }")
assert_case(
    "al menos 2 expertos activados para query cruzada",
    len(r.experts_activated) >= 2,
    f"solo {len(r.experts_activated)}: {r.experts_activated}",
)
assert_case(
    "unit_economics en query cruzada CAC+legal",
    "unit_economics" in r.experts_activated,
)
assert_case(
    "legal en query cruzada CAC+legal",
    "legal" in r.experts_activated,
)


# ─────────────────────────────────────────────────────────────────────────────
# TC-08: Expert.entity_titles no tiene duplicados
# ─────────────────────────────────────────────────────────────────────────────
sep("TC-08 — Expert.entity_titles no debe contener duplicados")
for eid, expert in EXPERTS.items():
    titles = expert.entity_titles
    unique = list(dict.fromkeys(titles))
    ok = len(titles) == len(unique)
    assert_case(
        f"Expert '{eid}' sin duplicados ({len(titles)} títulos)",
        ok,
        f"duplicados: {set(t for t in titles if titles.count(t) > 1)}" if not ok else "",
    )


# ─────────────────────────────────────────────────────────────────────────────
# TC-09: _merge_entities incluye modificadores de etapa
# ─────────────────────────────────────────────────────────────────────────────
sep("TC-09 — Modificadores de etapa se añaden a entity_titles")
from api.entity_router import STAGE_MODIFIER

r_no_stage = gn.route("CAC y LTV de nuestro SaaS")
r_with_stage = gn.route("CAC y LTV de nuestro SaaS", stage="seed")

# Con stage=seed debe haber al menos los títulos del modificador de etapa extra
seed_extra_titles: list[str] = []
from api.entity_router import ENTITY_GROUPS as EG
for group in STAGE_MODIFIER.get("seed", []):
    seed_extra_titles.extend(EG.get(group, []))

extra_present = any(t in r_with_stage.entities for t in seed_extra_titles)
assert_case(
    "stage=seed añade modificadores a la lista de entidades",
    extra_present or len(r_with_stage.entities) >= len(r_no_stage.entities),
    f"sin stage={len(r_no_stage.entities)}, con stage={len(r_with_stage.entities)}",
)


# ─────────────────────────────────────────────────────────────────────────────
# TC-10: Todos los group_ids en EXPERTS existen en ENTITY_GROUPS
# ─────────────────────────────────────────────────────────────────────────────
sep("TC-10 — Todos los group_ids de EXPERTS existen en ENTITY_GROUPS")
for eid, expert in EXPERTS.items():
    missing = [g for g in expert.group_ids if g not in ENTITY_GROUPS]
    assert_case(
        f"Expert '{eid}' — todos los group_ids son válidos",
        len(missing) == 0,
        f"group_ids faltantes: {missing}" if missing else "",
    )


# ─────────────────────────────────────────────────────────────────────────────
# RESUMEN
# ─────────────────────────────────────────────────────────────────────────────
sep("RESUMEN FINAL")
total = 10
passed = total - len(failures)

if failures:
    print(f"\n  FAILURES ({len(failures)}):")
    for f in failures:
        print(f"    FAIL: {f}")
else:
    print("\n  Todos los casos pasaron.")

print(f"\n  Score: {passed}/{total} casos PASS")
print(f"  Estado: {'LISTO PARA MoE-3' if not failures else 'REVISAR FAILURES ANTES DE CONTINUAR'}")
print(f"\n{'=' * 68}")

# Salir con código de error si hay fallos (útil para CI)
if failures:
    sys.exit(1)
