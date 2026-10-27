FROM public.ecr.aws/docker/library/python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY data-validator/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared common directory with secrets_manager
COPY common /app/common

# Copy application code
COPY data-validator/ .

# Create non-root user
RUN useradd -m -u 1000 validator && chown -R validator:validator /app
USER validator

EXPOSE 8003

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8003/health || exit 1

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8003"]