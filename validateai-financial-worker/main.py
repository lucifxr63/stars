import logging
import sys

from src.db.supabase_client import (
    get_client,
    bulk_insert_nodes,
    fetch_nodes_pending_embedding,
    bulk_update_embeddings,
)
from src.extractors.fred import fetch_all as fred_fetch_all
from src.extractors.yfinance_extractor import fetch_all as yf_fetch_all
from src.embeddings.openai_embedder import embed_nodes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

# Categorias que maneja este worker (para filtrar embeddings pendientes)
WORKER_CATEGORIES = [
    "Macroeconomia",   # FRED: GDP, CPI, FEDFUNDS
    "Mercados",        # yfinance: S&P 500, NASDAQ
    "Mercados Chile",  # yfinance: IPSA, ECH
    "Mercados LATAM",  # yfinance: ILF
    "Commodities",     # yfinance: Cobre, WTI, Oro, Litio
    "Forex Chile",     # yfinance: USD/CLP
    "Riesgo",          # yfinance: VIX
    "Tasas USA",       # yfinance: Treasury 10Y
]


def run() -> None:
    print("=== ValidateAI Financial Worker ===\n")

    client = get_client()

    # ── Paso 1: Ingesta FRED (Macroeconomia) ─────────────────────────────
    print("[1/3] Extrayendo series FRED (GDP / CPI / FEDFUNDS)...")
    fred_nodes = fred_fetch_all()
    inserted_fred = bulk_insert_nodes(client, fred_nodes)
    print(f"      OK {inserted_fred}/{len(fred_nodes)} nodos FRED upserted\n")

    # ── Paso 2: Ingesta yfinance (Mercados / Commodities / Forex) ────────
    print("[2/3] Extrayendo tickers via yfinance...")
    print("      S&P 500 | NASDAQ | IPSA | Cobre | WTI | Oro | Litio")
    print("      USD/CLP | VIX | Treasury 10Y | ECH | ILF\n")
    yf_nodes: list = []
    inserted_yf = 0
    try:
        yf_nodes = yf_fetch_all()
        inserted_yf = bulk_insert_nodes(client, yf_nodes)
        print(f"\n      OK {inserted_yf}/{len(yf_nodes)} nodos yfinance upserted\n")
    except Exception as exc:
        print(f"\n      WARN: yfinance rate-limited ({exc.__class__.__name__}).")
        print("      Los nodos FRED siguen disponibles. Reintenta en 30-60 min.\n")

    total_nodes = len(fred_nodes) + len(yf_nodes)
    total_inserted = inserted_fred + inserted_yf
    print(f"      Total pipeline: {total_inserted}/{total_nodes} nodos en knowledge_nodes\n")

    # ── Paso 3: Embeddings — todos los nodos pendientes del worker ───────
    print("[3/3] Generando embeddings (text-embedding-3-small, 1536 dims)...")
    pending = fetch_nodes_pending_embedding(client, categories=WORKER_CATEGORIES)

    if not pending:
        print("      -- todos los nodos ya tienen embedding\n")
    else:
        print(f"      {len(pending)} nodo(s) sin embedding encontrados...")
        vectors = embed_nodes(pending)
        updates = [
            {"id": node["id"], "embedding": vector}
            for node, vector in zip(pending, vectors)
        ]
        updated = bulk_update_embeddings(client, updates)
        print(f"      OK {updated}/{len(pending)} embeddings actualizados\n")

    # ── Paso 4: OpenBB Phase 3 — FRED extendido + World Bank Chile ───────
    import os as _os
    openbb_nodes: list = []
    if _os.getenv("OPENBB_ENABLED", "").lower() == "true":
        print("\n[4/4] Phase 3 — OpenBB (FRED extendido + World Bank Chile)...")
        print("      UNRATE | M2SL | T10Y2Y | BAMLH0A0HYM2 | INDPRO | DEXCHUS\n")
        inserted_ob = 0
        try:
            from src.extractors.openbb_extractor import fetch_all as openbb_fetch_all
            openbb_nodes = openbb_fetch_all()
            inserted_ob = bulk_insert_nodes(client, openbb_nodes)
            print(f"\n      OK {inserted_ob}/{len(openbb_nodes)} nodos OpenBB upserted\n")
            p3_categories = [
                "Empleo USA", "Liquidez Global", "Riesgo Macro",
                "Riesgo Credito", "Ciclo Industrial", "Forex Global", "Chile Macro",
            ]
            WORKER_CATEGORIES.extend(p3_categories)
            # Generar embeddings para nodos Phase 3 recién insertados
            print("      Generando embeddings Phase 3...")
            pending_p3 = fetch_nodes_pending_embedding(client, categories=p3_categories)
            if pending_p3:
                vectors_p3 = embed_nodes(pending_p3)
                updates_p3 = [
                    {"id": n["id"], "embedding": v}
                    for n, v in zip(pending_p3, vectors_p3)
                ]
                updated_p3 = bulk_update_embeddings(client, updates_p3)
                print(f"      OK {updated_p3}/{len(pending_p3)} embeddings Phase 3 actualizados\n")
            else:
                print("      -- embeddings Phase 3 ya actualizados\n")
        except ImportError:
            print("      SKIP: openbb no instalado (pip install openbb>=4.3.3)")
        except Exception as exc:
            print(f"      WARN: OpenBB error ({exc.__class__.__name__}: {exc})")

        total_nodes += len(openbb_nodes)
        total_inserted += inserted_ob

    print("\nPipeline completado.")
    print(f"  - FRED:     {len(fred_nodes)} series macro (GraphRAG Macroeconomia)")
    print(f"  - yfinance: {len(yf_nodes)} tickers (indices, commodities, forex)")
    if openbb_nodes:
        print(f"  - OpenBB:   {len(openbb_nodes)} series extendidas (Phase 3A + 3B)")
    print(f"  - Total:    {total_nodes} nodos con embedding vectorial en Supabase")


if __name__ == "__main__":
    try:
        run()
    except EnvironmentError as exc:
        print(f"\n[CONFIG ERROR] {exc}", file=sys.stderr)
        print("Revisa las variables de entorno en .env", file=sys.stderr)
        sys.exit(1)
    except Exception:
        logging.exception("Error no manejado en el pipeline")
        sys.exit(1)
