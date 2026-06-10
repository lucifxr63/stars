"""
serve.py — Entry point del servidor BralidusPY API.

Uso:
  py serve.py                  → desarrollo con hot-reload
  py serve.py --port 8001      → puerto personalizado
  py serve.py --no-reload      → producción (sin hot-reload)

La API queda en: http://localhost:8000/docs
"""
import argparse
import uvicorn


def main() -> None:
    parser = argparse.ArgumentParser(description="BralidusPY API Server")
    parser.add_argument("--host", default="0.0.0.0", help="Host (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Puerto (default: 8000)")
    parser.add_argument("--no-reload", action="store_true", help="Desactivar hot-reload")
    args = parser.parse_args()

    uvicorn.run(
        "api.app:app",
        host=args.host,
        port=args.port,
        reload=not args.no_reload,
        log_level="info",
    )


if __name__ == "__main__":
    main()
