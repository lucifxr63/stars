from supabase import create_client, Client
from src.config import SUPABASE_URL, SUPABASE_SERVICE_KEY


def get_client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def bulk_insert_nodes(client: Client, nodes: list[dict]) -> int:
    """
    Upsert masivo en knowledge_nodes usando el constraint existente
    unique_node_identity(document_title, header_path).
    Idempotente: re-ejecuciones actualizan en vez de duplicar.
    """
    if not nodes:
        return 0
    result = (
        client.table("knowledge_nodes")
        .upsert(nodes, on_conflict="document_title,header_path")
        .execute()
    )
    return len(result.data)


def fetch_nodes_pending_embedding(
    client: Client,
    category: str | None = None,
    categories: list[str] | None = None,
) -> list[dict]:
    """
    Retorna nodos sin embedding.
    - category:   filtra por una categoria exacta
    - categories: filtra por lista de categorias (OR)
    - sin args:   retorna todos los nodos sin embedding
    """
    q = (
        client.table("knowledge_nodes")
        .select("id, document_title, content, metadata")
        .is_("embedding", "null")
    )
    if category:
        q = q.eq("category", category)
    elif categories:
        q = q.in_("category", categories)
    result = q.execute()
    return result.data


def bulk_update_embeddings(client: Client, updates: list[dict]) -> int:
    """
    updates: lista de {"id": str, "embedding": list[float]}
    Aplica un UPDATE individual por nodo — Supabase REST no soporta
    bulk UPDATE con valores distintos por fila en un solo request.
    """
    for upd in updates:
        client.table("knowledge_nodes").update(
            {"embedding": upd["embedding"]}
        ).eq("id", upd["id"]).execute()
    return len(updates)
