"""
rag_baseline.py — Mide lo que el RAG le entrega REALMENTE al modelo.

CAL-6 del plan de calidad del grafo. Existe para poder DEMOSTRAR que la
limpieza mejoró el contexto, y no sólo afirmarlo.

QUÉ MIDE Y POR QUÉ AHÍ
----------------------
No mide la respuesta del LLM: mide el artefacto que `assemble_context` le pone
en el prompt. Esa es la frontera donde está el defecto y es determinista.

`assemble_context` emite, por nodo:

    ### Ley 21.521 Fintech Chile — Regulacion Completa [VECTOR] — normativa
    {content}

Si `content` viene vacío, el modelo recibe un encabezado que promete normativa
fintech chilena y **nada debajo** — y lo completa con conocimiento paramétrico.
El usuario recibe regulación inventada con formato de cita. Por eso la métrica
principal es *encabezados sin cuerpo*, contados sobre el Markdown final.

CÓMO SE MANTIENE COMPARABLE ANTES/DESPUÉS
-----------------------------------------
Los embeddings de las consultas se cachean en `rag_baseline_embeddings.json` y
se reutilizan. Si se re-embebiera en cada corrida, una diferencia entre el antes
y el después podría venir del vector de la pregunta y no del grafo. Se fija la
única variable que no queremos medir.

USO
---
    python scripts/rag_baseline.py antes
    python scripts/rag_baseline.py despues
    python scripts/rag_baseline.py comparar
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api import rag  # noqa: E402
from src.db.supabase_client import get_client  # noqa: E402

SALIDA = Path(__file__).resolve().parents[1] / "scripts" / "rag_baseline_out"
CACHE_EMB = SALIDA / "rag_baseline_embeddings.json"

TOP_K = 6
MATCH_THRESHOLD = 0.40

# Consultas de referencia sobre los temas de los documentos afectados. Se
# escriben como las escribiría un fundador, no como una búsqueda por título:
# el objetivo es reproducir la recuperación real, no forzar un match.
CONSULTAS = [
    ("fintech-21521",   "¿Qué exige la Ley 21.521 Fintech a una startup en Chile?"),
    ("datos-21719",     "¿Cómo me afecta la Ley 21.719 de protección de datos personales?"),
    ("cmf-uaf",         "¿Qué registros de la CMF y la UAF necesita una fintech chilena?"),
    ("spa",             "¿Cómo constituyo una SpA en Chile y cuánto cuesta?"),
    ("laboral",         "¿Qué obligaciones laborales tiene una startup al contratar en Chile?"),
    ("vesting",         "¿Cómo funciona el vesting de acciones entre socios fundadores?"),
    ("pmf",             "¿Cómo sé si mi startup alcanzó product-market fit?"),
    ("unit-economics",  "¿Cómo calculo el CAC y el LTV de mi SaaS B2B?"),
    ("mom-test",        "¿Cómo hago entrevistas de validación sin sesgar al entrevistado?"),
    ("corfo",           "¿A qué programas de CORFO puede postular mi startup?"),
    ("pagos",           "¿Qué pasarela de pagos conviene integrar en Chile, Transbank o Fintoc?"),
    ("fundraising",     "¿Cómo levanto una ronda pre-seed y qué miran los VC?"),
]


# ── Métrica ──────────────────────────────────────────────────────────────────

BLOQUE = re.compile(r"^### (.+)$", re.MULTILINE)


def contenido_util(texto: str) -> str:
    """
    Contenido menos todo lo que no es conocimiento.

    Las tres familias salieron de MIRAR un contexto ensamblado real, no de
    suponerlas:

      * `Relacionado con: …`  — plantilla de relaciones, a veces con los valores
        interpolados vacíos (`"Relacionado con: , , ,"`).
      * `Asked on … against NotebookLM notebook` — marca de la herramienta de
        ingesta.
      * Frontmatter YAML (`--- titulo: … ---`) — la cabecera del archivo fuente
        quedó troceada como si fuera una sección. **Esta no estaba en el
        diagnóstico**; apareció al leer la salida de la consulta `mom-test`.
    """
    t = re.sub(r"^\s*---.*?---\s*", "", texto or "", flags=re.DOTALL)
    t = re.sub(r"Relacionado con:[^\n]*", "", t)
    t = re.sub(r"Asked on [^\n]*notebook", "", t)
    return t.strip()


def _cuerpos(contexto: str):
    """Itera (encabezado, cuerpo) sobre el Markdown que se le pasa al modelo."""
    marcas = list(BLOQUE.finditer(contexto))
    for i, m in enumerate(marcas):
        fin = marcas[i + 1].start() if i + 1 < len(marcas) else len(contexto)
        cuerpo = re.sub(
            r"^_Último valor:.*$", "", contexto[m.end():fin], flags=re.MULTILINE
        )
        yield m.group(1).strip(), cuerpo


def encabezados_sin_cuerpo(contexto: str) -> list[str]:
    """Encabezados con literalmente nada debajo."""
    return [h for h, c in _cuerpos(contexto) if not c.strip()]


def encabezados_sin_contenido_util(contexto: str) -> list[str]:
    """
    Encabezados cuyo cuerpo es SÓLO restos del proceso de ingesta.

    Ésta es la métrica que importa, y la primera versión de este script no la
    tenía. Se midió "encabezado sin cuerpo" y dio 0 en las 12 consultas — pero
    el defecto no deja el cuerpo vacío, lo deja lleno de basura:

        ### Mom Test — Framework Entrevistas de Validacion [VECTOR] — metodologia
        Relacionado con: , , , Asked on 2026-05-24T… against NotebookLM notebook

    Para el modelo eso es peor que el vacío: un encabezado que promete un
    framework de entrevistas, y debajo la afirmación de una lista de relaciones
    que está vacía. Nada le indica que ahí no hay conocimiento.
    """
    return [h for h, c in _cuerpos(contexto) if c.strip() and not contenido_util(c)]


# ── Corrida ──────────────────────────────────────────────────────────────────

def cargar_cache() -> dict[str, list[float]]:
    if CACHE_EMB.exists():
        return json.loads(CACHE_EMB.read_text(encoding="utf-8"))
    return {}


def correr(etiqueta: str) -> dict:
    SALIDA.mkdir(parents=True, exist_ok=True)
    client = get_client()
    cache = cargar_cache()
    nuevos = 0

    resultados = []
    for slug, pregunta in CONSULTAS:
        if slug in cache:
            emb = cache[slug]
        else:
            emb = rag.embed_text(pregunta)
            cache[slug] = emb
            nuevos += 1

        crudos = rag.search(client, emb, [], MATCH_THRESHOLD, TOP_K)
        enriquecidos = rag.enrich_nodes_with_metadata(client, crudos)
        contexto = rag.assemble_context(enriquecidos)

        vacios_md = encabezados_sin_cuerpo(contexto)
        basura_md = encabezados_sin_contenido_util(contexto)
        nodos = [
            {
                "titulo": n["document_title"],
                "origen": n.get("source_type", "VECTOR"),
                "relevancia": round(float(n.get("relevance", 0)), 4),
                "len_content": len(n.get("content") or ""),
                "len_util": len(contenido_util(n.get("content") or "")),
            }
            for n in enriquecidos
        ]

        resultados.append({
            "slug": slug,
            "pregunta": pregunta,
            "n_nodos": len(nodos),
            "nodos": nodos,
            "nodos_sin_contenido_util": sum(1 for n in nodos if n["len_util"] == 0),
            "encabezados_sin_cuerpo": vacios_md,
            "encabezados_sin_contenido_util": basura_md,
            "contexto": contexto,
        })
        print(
            f"  {slug:<16} {len(nodos)} nodos · "
            f"{len(basura_md)} encabezados sin contenido útil · "
            f"{len(vacios_md)} sin cuerpo"
        )

    if nuevos:
        CACHE_EMB.write_text(json.dumps(cache), encoding="utf-8")

    resumen = {
        "etiqueta": etiqueta,
        "fecha": datetime.now(timezone.utc).isoformat(),
        "top_k": TOP_K,
        "match_threshold": MATCH_THRESHOLD,
        "embeddings_reusados": len(CONSULTAS) - nuevos,
        "consultas": len(resultados),
        "consultas_con_basura": sum(1 for r in resultados if r["encabezados_sin_contenido_util"]),
        "encabezados_sin_contenido_util": sum(
            len(r["encabezados_sin_contenido_util"]) for r in resultados
        ),
        "consultas_con_encabezado_vacio": sum(1 for r in resultados if r["encabezados_sin_cuerpo"]),
        "encabezados_vacios_totales": sum(len(r["encabezados_sin_cuerpo"]) for r in resultados),
        "nodos_recuperados": sum(r["n_nodos"] for r in resultados),
        "nodos_sin_contenido_util": sum(r["nodos_sin_contenido_util"] for r in resultados),
        "resultados": resultados,
    }

    destino = SALIDA / f"{etiqueta}.json"
    destino.write_text(json.dumps(resumen, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nGuardado en {destino}")
    return resumen


def comparar() -> None:
    a = json.loads((SALIDA / "antes.json").read_text(encoding="utf-8"))
    d = json.loads((SALIDA / "despues.json").read_text(encoding="utf-8"))

    filas = [
        ("Consultas con al menos un nodo basura",       "consultas_con_basura"),
        ("Encabezados sin contenido útil (total)",      "encabezados_sin_contenido_util"),
        ("Nodos recuperados",                           "nodos_recuperados"),
        ("Nodos sin contenido útil",                    "nodos_sin_contenido_util"),
        ("Encabezados literalmente sin cuerpo",         "encabezados_vacios_totales"),
    ]
    print(f"\n{'Métrica':<46}{'antes':>8}{'después':>10}")
    print("-" * 64)
    for nombre, clave in filas:
        print(f"{nombre:<46}{a[clave]:>8}{d[clave]:>10}")


if __name__ == "__main__":
    modo = sys.argv[1] if len(sys.argv) > 1 else "antes"
    if modo == "comparar":
        comparar()
    else:
        print(f"Corrida '{modo}' — {len(CONSULTAS)} consultas, top_k={TOP_K}, umbral={MATCH_THRESHOLD}\n")
        r = correr(modo)
        print(
            f"\n{r['consultas_con_basura']}/{r['consultas']} consultas devuelven al menos un "
            f"nodo sin contenido útil "
            f"({r['encabezados_sin_contenido_util']} encabezados, "
            f"{r['nodos_sin_contenido_util']}/{r['nodos_recuperados']} nodos)"
        )
