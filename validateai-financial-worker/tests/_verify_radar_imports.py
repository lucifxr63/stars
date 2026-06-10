"""Script de verificación de imports del Radar Forense — Sprint MoE-8."""
import sys
sys.path.insert(0, ".")

from api.radar.models import RadarSignal, SEVERITY_THRESHOLD
from api.radar.classifier import classify_headline, _keyword_classify
from api.radar.signal_cache import signal_cache
from api.moe_router import MoERoutingResult, GatingNetwork

print("Imports OK\n")

# ── Keyword classifier (sin deps externas) ────────────────────────────────────
cases = [
    ("CMF multa a fintech por operar sin registro", "df.cl", True),
    ("IPSA cae 3pct por tensiones geopoliticas", "emol.com", True),
    ("Cobre cae a minimos de 6 meses por debilidad china", "reuters.com", True),
    ("Nueva ley regulacion aprobada por el Congreso", "df.cl", True),
    ("CEO de startup celebra aumento de clientes", "emol.com", False),
]

print("Keyword classifier:")
failures = []
for headline, source, expect_signal in cases:
    r = _keyword_classify(headline, source, 24)
    got_signal = r is not None
    ok = got_signal == expect_signal
    status = "PASS" if ok else "FAIL"
    detail = f"{r.signal_type} sev={r.severity:.2f}" if r else "None (descartado)"
    print(f"  [{status}] {headline[:50]} => {detail}")
    if not ok:
        failures.append(headline)

# ── MoERoutingResult con active_radar_signals ──────────────────────────────────
moe_r = MoERoutingResult(
    experts_activated=["legal"],
    expert_scores={},
    entities=[],
    routing_method="keyword+radar",
    routing_reason="test",
    active_radar_signals=["CMF multa a fintech"],
)
assert moe_r.active_radar_signals == ["CMF multa a fintech"]
print(f"\n  [PASS] MoERoutingResult.active_radar_signals funciona")

# ── GatingNetwork Etapa 4 (sin Supabase) ──────────────────────────────────────
from api.radar.models import RadarSignal
from datetime import datetime, timedelta, timezone

signal = RadarSignal(
    sector="fintech",
    affected_industries=["fintech", "credito"],
    signal_type="REGULATORY_ACTION",
    severity=0.88,
    headline_preview="CMF multa a fintech",
    source="df.cl",
    expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    classified_by="keyword",
)

gn = GatingNetwork()
result = gn.route(
    query="necesito validar mi startup fintech",
    industry="fintech",
    geography="chile",
    radar_signals=[signal],
)
print(f"\n  [PASS] GatingNetwork con radar_signal:")
print(f"    experts: {result.experts_activated}")
print(f"    method:  {result.routing_method}")
print(f"    radar signals en result: {result.active_radar_signals}")
assert "+radar" in result.routing_method, f"Expected '+radar' in method, got: {result.routing_method}"
assert "legal" in result.experts_activated, f"Expected 'legal' activated, got: {result.experts_activated}"

print(f"\nSPRINT MoE-8: {'OK — listo para deploy' if not failures else f'FALLOS: {failures}'}")
if failures:
    sys.exit(1)
