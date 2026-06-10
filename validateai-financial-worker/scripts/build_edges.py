"""
build_edges.py — Popula knowledge_edges con relaciones entre indicadores.

Fuentes de aristas:
  1. DOMAIN_EDGES: relaciones conocidas por teoría económica (hardcoded)
  2. SIMILARITY_EDGES: pares con similitud coseno > umbral (inferidas automáticamente)

Las aristas activan el path GRAPH del RPC search_hybrid_graphrag,
que actualmente siempre devuelve 0 por falta de edges.

Uso:
  py scripts/build_edges.py              # corre ambas fuentes
  py scripts/build_edges.py --domain     # solo aristas de dominio
  py scripts/build_edges.py --similarity # solo aristas por similitud
  py scripts/build_edges.py --dry-run    # muestra sin insertar
"""
from __future__ import annotations
import argparse
import logging
import sys
import numpy as np

sys.path.insert(0, ".")
from src.db.supabase_client import get_client
from api.rag import _parse_embedding

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# ── Aristas de dominio (teoría económica) ─────────────────────────────────────
# Formato: (source_title, target_title, relation_type)
# Todas las relaciones son bidireccionales — se insertan en ambas direcciones.

DOMAIN_EDGES: list[tuple[str, str, str]] = [
    # ── Macro: ciclo económico USA ───────────────────────────────────────────
    ("PIB USA (GDP)", "Inflación USA (CPI All Urban Consumers)", "CORRELATES"),
    ("PIB USA (GDP)", "Tasa de Fondos Federales (Fed Funds Rate)", "INFLUENCES"),
    ("Inflación USA (CPI All Urban Consumers)", "Tasa de Fondos Federales (Fed Funds Rate)", "TRIGGERS"),
    ("Tasa de Fondos Federales (Fed Funds Rate)", "Tasa del Tesoro USA 10 Anos", "ANCHORS"),
    ("Tasa del Tesoro USA 10 Anos", "PIB USA (GDP)", "DISCOUNTS"),

    # ── Mercados USA ─────────────────────────────────────────────────────────
    ("S&P 500 (Indice Mercado USA)", "NASDAQ Composite (Tecnologia USA)", "FOLLOWS"),
    ("S&P 500 (Indice Mercado USA)", "VIX (Indice de Volatilidad de Mercados)", "INVERSE"),
    ("S&P 500 (Indice Mercado USA)", "Tasa del Tesoro USA 10 Anos", "INVERSE"),
    ("S&P 500 (Indice Mercado USA)", "PIB USA (GDP)", "REFLECTS"),
    ("NASDAQ Composite (Tecnologia USA)", "VIX (Indice de Volatilidad de Mercados)", "INVERSE"),
    ("NASDAQ Composite (Tecnologia USA)", "Tasa de Fondos Federales (Fed Funds Rate)", "SENSITIVE_TO"),
    ("VIX (Indice de Volatilidad de Mercados)", "Oro (Gold Futures)", "CORRELATES"),  # safe haven flow
    ("Tasa del Tesoro USA 10 Anos", "Tasa de Fondos Federales (Fed Funds Rate)", "FOLLOWS"),

    # ── Chile: mercado local ──────────────────────────────────────────────────
    ("IPSA (Indice Bursatil Chile)", "Cobre Futuros (Commodity Chile)", "DRIVEN_BY"),
    ("IPSA (Indice Bursatil Chile)", "iShares MSCI Chile ETF", "MIRRORS"),
    ("iShares MSCI Chile ETF", "S&P 500 (Indice Mercado USA)", "INFLUENCED_BY"),
    ("IPSA (Indice Bursatil Chile)", "S&P 500 (Indice Mercado USA)", "FOLLOWS"),

    # ── Forex Chile ───────────────────────────────────────────────────────────
    ("USD/CLP (Tipo de Cambio Chile)", "Cobre Futuros (Commodity Chile)", "INVERSE"),
    ("USD/CLP (Tipo de Cambio Chile)", "PIB USA (GDP)", "INFLUENCED_BY"),
    ("USD/CLP (Tipo de Cambio Chile)", "Tasa de Fondos Federales (Fed Funds Rate)", "SENSITIVE_TO"),
    ("USD/CLP (Tipo de Cambio Chile)", "VIX (Indice de Volatilidad de Mercados)", "CORRELATES"),  # risk-off = CLP weak

    # ── Commodities ───────────────────────────────────────────────────────────
    ("Cobre Futuros (Commodity Chile)", "PIB USA (GDP)", "PROXY"),  # cobre = barometro global
    ("Cobre Futuros (Commodity Chile)", "iShares Latin America 40 ETF", "INFLUENCES"),
    ("WTI Petroleo Crudo (Futuros)", "Inflación USA (CPI All Urban Consumers)", "INPUTS"),
    ("WTI Petroleo Crudo (Futuros)", "PIB USA (GDP)", "INFLUENCES"),
    ("Oro (Gold Futures)", "Inflación USA (CPI All Urban Consumers)", "HEDGE"),
    ("Oro (Gold Futures)", "Tasa de Fondos Federales (Fed Funds Rate)", "INVERSE"),
    ("Albemarle Corp (Proxy Litio Chile)", "Cobre Futuros (Commodity Chile)", "SECTOR_PEER"),

    # ── LATAM regional ────────────────────────────────────────────────────────
    ("iShares Latin America 40 ETF", "IPSA (Indice Bursatil Chile)", "INCLUDES"),
    ("iShares Latin America 40 ETF", "S&P 500 (Indice Mercado USA)", "FOLLOWS"),
    ("iShares Latin America 40 ETF", "VIX (Indice de Volatilidad de Mercados)", "INVERSE"),

    # ── Phase 3A: OpenBB — mercado laboral USA ────────────────────────────────
    # Mandato dual Fed: UNRATE → decisiones de FEDFUNDS → tasas globales
    ("Desempleo USA (Unemployment Rate)", "Tasa de Fondos Federales (Fed Funds Rate)", "TRIGGERS"),
    ("Desempleo USA (Unemployment Rate)", "PIB USA (GDP)", "INVERSE"),
    ("Desempleo USA (Unemployment Rate)", "S&P 500 (Indice Mercado USA)", "INVERSE"),

    # Phase 3A: M2 Money Supply → liquidez → apetito VC
    ("M2 Money Supply USA", "S&P 500 (Indice Mercado USA)", "CORRELATES"),
    ("M2 Money Supply USA", "NASDAQ Composite (Tecnologia USA)", "CORRELATES"),
    ("M2 Money Supply USA", "Inflación USA (CPI All Urban Consumers)", "INPUTS"),
    ("M2 Money Supply USA", "Tasa de Fondos Federales (Fed Funds Rate)", "INVERSE"),

    # Phase 3A: Yield curve spread → predictor recesión
    ("Spread Curva 10Y-2Y USA (Indicador Recesion)", "PIB USA (GDP)", "PREDICTS"),
    ("Spread Curva 10Y-2Y USA (Indicador Recesion)", "Tasa de Fondos Federales (Fed Funds Rate)", "REFLECTS"),
    ("Spread Curva 10Y-2Y USA (Indicador Recesion)", "Tasa del Tesoro USA 10 Anos", "DERIVED_FROM"),

    # Phase 3A: High Yield spread → riesgo crédito → startups
    ("High Yield Credit Spread (Apetito Riesgo Credito)", "VIX (Indice de Volatilidad de Mercados)", "CORRELATES"),
    ("High Yield Credit Spread (Apetito Riesgo Credito)", "Tasa de Fondos Federales (Fed Funds Rate)", "SENSITIVE_TO"),
    ("High Yield Credit Spread (Apetito Riesgo Credito)", "S&P 500 (Indice Mercado USA)", "INVERSE"),

    # Phase 3A: Producción industrial → ciclo B2B
    ("Produccion Industrial USA (Industrial Production Index)", "PIB USA (GDP)", "COMPONENT_OF"),
    ("Produccion Industrial USA (Industrial Production Index)", "WTI Petroleo Crudo (Futuros)", "CONSUMES"),
    ("Produccion Industrial USA (Industrial Production Index)", "Cobre Futuros (Commodity Chile)", "CONSUMES"),

    # Phase 3A: USD/CNY → China demand → Cobre
    ("USD/CNY (Tipo de Cambio Yuan)", "Cobre Futuros (Commodity Chile)", "INFLUENCES"),
    ("USD/CNY (Tipo de Cambio Yuan)", "iShares Latin America 40 ETF", "INFLUENCES"),
    ("USD/CNY (Tipo de Cambio Yuan)", "PIB USA (GDP)", "SENSITIVE_TO"),

    # Phase 3B: Chile Macro → mercado local
    ("PIB per Capita Chile (USD corrientes)", "IPSA (Indice Bursatil Chile)", "REFLECTS"),
    ("PIB per Capita Chile (USD corrientes)", "iShares MSCI Chile ETF", "REFLECTS"),
    ("Desempleo Chile (% fuerza laboral)", "USD/CLP (Tipo de Cambio Chile)", "CORRELATES"),
    ("Inversion Extranjera Directa Chile (% PIB)", "IPSA (Indice Bursatil Chile)", "DRIVES"),
    ("Inversion Extranjera Directa Chile (% PIB)", "USD/CLP (Tipo de Cambio Chile)", "INFLUENCES"),
]


def _expand_bidirectional(edges: list[tuple]) -> list[tuple]:
    """Agrega la dirección inversa para cada arista."""
    expanded = list(edges)
    for src, tgt, rel in edges:
        expanded.append((tgt, src, rel))
    return expanded


def build_domain_edges() -> list[dict]:
    rows = []
    for src, tgt, rel in _expand_bidirectional(DOMAIN_EDGES):
        rows.append({"source_title": src, "target_title": tgt, "relation_type": rel})
    return rows


def build_similarity_edges(
    client,
    threshold: float = 0.80,
    max_per_node: int = 5,
) -> list[dict]:
    """
    Genera aristas SIMILAR_TO entre pares de nodos con similitud coseno > threshold.
    Útil para conectar nodos que no tienen relación de dominio explícita.
    threshold=0.80 es alto adrede — solo pares muy similares como GRAPH neighbors.
    """
    log.info("Cargando embeddings para calcular similitud...")
    result = (
        client.table("knowledge_nodes")
        .select("document_title, embedding")
        .execute()
    )
    rows = result.data or []
    nodes_with_emb = [(r["document_title"], _parse_embedding(r["embedding"])) for r in rows]
    nodes_with_emb = [(t, v) for t, v in nodes_with_emb if v is not None]
    log.info("  %d nodos con embedding disponibles.", len(nodes_with_emb))

    vecs = np.array([v for _, v in nodes_with_emb], dtype=np.float32)
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    vecs_normalized = vecs / (norms + 1e-10)
    sim_matrix = vecs_normalized @ vecs_normalized.T  # (N, N) cosine similarity

    edges: list[dict] = []
    n = len(nodes_with_emb)
    for i in range(n):
        # Ordenar por similitud descendente, excluir el nodo mismo (j=i)
        sims = [(sim_matrix[i, j], j) for j in range(n) if j != i]
        sims.sort(reverse=True)
        added = 0
        for sim, j in sims:
            if sim < threshold:
                break
            if added >= max_per_node:
                break
            src = nodes_with_emb[i][0]
            tgt = nodes_with_emb[j][0]
            edges.append({"source_title": src, "target_title": tgt, "relation_type": "SIMILAR_TO"})
            added += 1

    log.info("  %d aristas SIMILAR_TO generadas (threshold=%.2f).", len(edges), threshold)
    return edges


def insert_edges(client, edges: list[dict], dry_run: bool = False) -> int:
    """Upsert masivo en knowledge_edges. Idempotente."""
    if not edges:
        log.info("Sin aristas para insertar.")
        return 0
    if dry_run:
        log.info("[dry-run] Se insertarían %d aristas.", len(edges))
        for e in edges[:10]:
            log.info("  %s → %s [%s]", e["source_title"], e["target_title"], e["relation_type"])
        if len(edges) > 10:
            log.info("  ... y %d más.", len(edges) - 10)
        return 0

    result = (
        client.table("knowledge_edges")
        .upsert(edges, on_conflict="source_title,target_title,relation_type")
        .execute()
    )
    count = len(result.data)
    log.info("  %d aristas upserted en knowledge_edges.", count)
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description="Build knowledge_edges graph")
    parser.add_argument("--domain", action="store_true", help="Solo aristas de dominio")
    parser.add_argument("--similarity", action="store_true", help="Solo aristas por similitud")
    parser.add_argument("--sim-threshold", type=float, default=0.80)
    parser.add_argument("--dry-run", action="store_true", help="Muestra sin insertar")
    args = parser.parse_args()

    both = not args.domain and not args.similarity

    client = get_client()
    all_edges: list[dict] = []

    if args.domain or both:
        domain_edges = build_domain_edges()
        log.info("Aristas de dominio: %d (incluyendo inversas)", len(domain_edges))
        all_edges.extend(domain_edges)

    if args.similarity or both:
        sim_edges = build_similarity_edges(client, threshold=args.sim_threshold)
        all_edges.extend(sim_edges)

    # Deduplicar
    seen: set[tuple] = set()
    unique_edges: list[dict] = []
    for e in all_edges:
        key = (e["source_title"], e["target_title"], e["relation_type"])
        if key not in seen:
            seen.add(key)
            unique_edges.append(e)

    log.info("Total aristas únicas: %d", len(unique_edges))
    insert_edges(client, unique_edges, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
