"""
scripts/vectorize_pending.py
Vectoriza en batch todos los nodos de knowledge_nodes con embedding IS NULL.
Diseñado para Familia A (Sprint 1-3) y nodos financieros existentes.

Uso:
  py scripts/vectorize_pending.py                       # todos los nodos NULL
  py scripts/vectorize_pending.py --familia-a           # solo Sprints 1-3
  py scripts/vectorize_pending.py --cat "Unit Economics" "Gobernanza"
  py scripts/vectorize_pending.py --batch 50 --sleep 1  # conservador ante rate limits
  py scripts/vectorize_pending.py --dry-run             # solo listar, sin llamar API

Rate limits OpenAI text-embedding-3-small (Tier 1):
  3.000 RPM / 1.000.000 TPM
  ~33 nodos Familia A × 400 tokens = ~13.200 tokens → 1 sola llamada API
  ~600 nodos totales × 400 tokens = ~240.000 tokens → bien dentro del límite diario
"""
from __future__ import annotations

import argparse
import logging
import sys
import time

sys.path.insert(0, ".")

from dotenv import load_dotenv

load_dotenv()

from src.db.supabase_client import (
    bulk_update_embeddings,
    fetch_nodes_pending_embedding,
    get_client,
)
from src.embeddings.openai_embedder import embed_nodes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# Categorías incorporadas en Sprint 1 (Unit Economics), Sprint 2 (Legal) y
# Sprint 3 (Growth). Usadas con --familia-a para filtrar solo estos nodos.
FAMILIA_A_CATEGORIES: list[str] = [
    # Sprints 1-3
    "Unit Economics",
    "Definicion del Problema",
    "TAM/SAM/SOM",
    "Gobernanza",
    "Cumplimiento Normativo",
    "Estrategia Fundraising",
    "Traccion y Evidencia",
    "Moat Competitivo",
    "MVP Roadmap",
    # Sprint 5 — VC-Grade Nodes
    "Retención y Cohortes",
    "Eficiencia de Capital",
    "Estrategia de Salida",
]


def _sep(title: str) -> None:
    print(f"\n{'─'*65}")
    print(f"  {title}")
    print("─" * 65)


def run(
    categories: list[str] | None,
    batch_size: int,
    dry_run: bool,
    sleep_s: float,
) -> int:
    """
    Vectoriza nodos pendientes. Retorna el número de nodos vectorizados.
    """
    client = get_client()

    _sep("Consultando nodos con embedding IS NULL")
    if categories:
        log.info("  Filtro categorias: %s", categories)
        pending = fetch_nodes_pending_embedding(client, categories=categories)
    else:
        log.info("  Sin filtro — procesando TODOS los nodos pendientes")
        pending = fetch_nodes_pending_embedding(client)

    total = len(pending)
    if total == 0:
        print("\n  El grafo esta completamente vectorizado. Sin trabajo pendiente.")
        return 0

    print(f"\n  {total} nodos pendientes de vectorizacion")

    if dry_run:
        _sep(f"DRY RUN — {total} nodos (sin llamar API)")
        for n in pending:
            entity_type = (n.get("metadata") or {}).get("entity_type", "FINANCIAL")
            print(f"  [{entity_type:20}] {n['document_title'][:55]}")
        return 0

    # ── Procesar en batches ───────────────────────────────────────────────
    batches = [pending[i : i + batch_size] for i in range(0, total, batch_size)]
    vectorized = 0
    failed = 0
    t_start = time.time()

    for i, batch in enumerate(batches, 1):
        _sep(f"Batch {i}/{len(batches)} — {len(batch)} nodos")
        try:
            embeddings = embed_nodes(batch)
            updates = [
                {"id": node["id"], "embedding": emb}
                for node, emb in zip(batch, embeddings)
            ]
            bulk_update_embeddings(client, updates)
            vectorized += len(batch)
            for node in batch:
                entity_type = (node.get("metadata") or {}).get("entity_type", "FINANCIAL")
                print(f"  OK  [{entity_type:20}] {node['document_title'][:48]}")
        except Exception as exc:
            log.error("  ERROR en batch %d: %s — %s", i, type(exc).__name__, exc)
            failed += len(batch)

        if i < len(batches):
            time.sleep(sleep_s)

    elapsed = time.time() - t_start
    _sep("Resultado final")
    print(f"  Vectorizados: {vectorized}/{total}")
    print(f"  Errores:      {failed}")
    print(f"  Tiempo total: {elapsed:.1f}s")
    print(f"  Costo aprox:  USD ${(vectorized * 400 / 1_000_000) * 0.02:.5f}")
    print(f"  (text-embedding-3-small: USD $0.02 / 1M tokens)")
    return vectorized


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Vectoriza knowledge_nodes con embedding IS NULL"
    )
    parser.add_argument(
        "--batch",
        type=int,
        default=100,
        metavar="N",
        help="Nodos por request de embedding (default: 100, max recomendado: 200)",
    )
    parser.add_argument(
        "--cat",
        nargs="+",
        metavar="CAT",
        help='Categorias a vectorizar. Ej: --cat "Unit Economics" "Gobernanza"',
    )
    parser.add_argument(
        "--familia-a",
        action="store_true",
        help="Atajo para vectorizar solo categorias Familia A (Sprints 1-3)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Lista nodos pendientes sin llamar a la API de embeddings",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=0.5,
        metavar="SEG",
        help="Segundos de pausa entre batches (default: 0.5 — conserva rate limit)",
    )
    args = parser.parse_args()

    categories: list[str] | None = None
    if args.familia_a:
        categories = FAMILIA_A_CATEGORIES
        log.info("Modo --familia-a: %d categorias seleccionadas", len(categories))
    elif args.cat:
        categories = args.cat

    result = run(
        categories=categories,
        batch_size=args.batch,
        dry_run=args.dry_run,
        sleep_s=args.sleep,
    )
    sys.exit(0 if result >= 0 else 1)
