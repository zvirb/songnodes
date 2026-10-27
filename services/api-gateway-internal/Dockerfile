FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY services/api-gateway-internal/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared common libraries
# - common/api_gateway: API client library with resilience patterns
# - services/common: Shared utilities (secrets_manager, etc.)
COPY common /app/common
COPY services/common /app/common

# Copy application code
COPY services/api-gateway-internal /app

# Create directory for Prometheus multiprocess metrics
RUN mkdir -p /tmp/prometheus

ENV PYTHONUNBUFFERED=1
ENV PROMETHEUS_MULTIPROC_DIR=/tmp/prometheus
ENV PYTHONPATH=/app

EXPOSE 8100

CMD ["python", "main.py"]
