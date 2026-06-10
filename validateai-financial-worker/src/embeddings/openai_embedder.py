import openai as openai_module
from openai import OpenAI
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)
import logging

from src.config import OPENAI_API_KEY

logger = logging.getLogger(__name__)

_client = OpenAI(api_key=OPENAI_API_KEY)

# text-embedding-3-small: 1536 dims, coincide con vector(1536) en knowledge_nodes
MODEL = "text-embedding-3-small"


def _build_embed_text(document_title: str, content: str, metadata: dict) -> str:
    """
    Texto enriquecido que se vectoriza.
    Combina título + descripción semántica + última observación concreta.
    El LLM recuperará el nodo por concepto ("inflacion", "tasa de interes")
    y tendrá el último valor en contexto sin necesidad de JOIN adicional.
    """
    ultima_fecha = metadata.get("ultima_fecha") or "N/A"
    ultimo_valor = metadata.get("ultimo_valor") or "N/A"
    unidad = metadata.get("unidad", "")
    return (
        f"Indicador: {document_title}. "
        f"{content} "
        f"Ultima observacion: {ultima_fecha} con valor {ultimo_valor} {unidad}."
    )


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception_type(openai_module.RateLimitError),
    before_sleep=before_sleep_log(logger, logging.WARNING),
)
def _embed_batch(texts: list[str]) -> list[list[float]]:
    """Llama a la API en un solo request. Devuelve embeddings en el mismo orden."""
    response = _client.embeddings.create(input=texts, model=MODEL)
    # La API puede reordenar — ordenamos por index para garantizar correspondencia
    return [item.embedding for item in sorted(response.data, key=lambda x: x.index)]


def embed_nodes(nodes: list[dict]) -> list[list[float]]:
    """
    Recibe nodos con al menos {document_title, content, metadata}.
    Devuelve lista de vectores en el mismo orden.
    """
    texts = [
        _build_embed_text(
            n["document_title"],
            n.get("content", ""),
            n.get("metadata") or {},
        )
        for n in nodes
    ]
    return _embed_batch(texts)
