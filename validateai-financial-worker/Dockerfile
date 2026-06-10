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

# Puerto expuesto (Railway inyecta $PORT en runtime; 8080 es el default de Railway)
EXPOSE 8080

# Health check usa $PORT para ser compatible con Railway y Docker local
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request, os; urllib.request.urlopen('http://localhost:' + os.getenv('PORT','8080') + '/health')" || exit 1

# Producción: sin hot-reload. El puerto lo inyecta Railway via $PORT (serve.py lo lee).
CMD ["python", "serve.py", "--no-reload", "--host", "0.0.0.0"]
