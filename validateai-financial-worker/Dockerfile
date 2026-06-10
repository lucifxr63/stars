FROM python:3.12-slim

WORKDIR /app

# Dependencias del sistema (numpy requiere compilación en algunos casos)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Dependencias Python primero (cache de capas Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Código fuente
COPY . .

# Puerto expuesto
EXPOSE 8000

# Health check integrado
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Producción: sin hot-reload
CMD ["python", "serve.py", "--no-reload", "--host", "0.0.0.0", "--port", "8000"]
