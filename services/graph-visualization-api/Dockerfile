# Graph Visualization API Dockerfile
# Optimized for high-performance graph data processing

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Optional build secret supports cloud proxies without disabling TLS verification.
RUN --mount=type=secret,id=proxy_ca,target=/usr/local/share/ca-certificates/cloud-proxy.crt \
    update-ca-certificates

# Copy requirements first for better Docker layer caching
COPY services/graph-visualization-api/requirements.txt .

# Install Python dependencies
RUN PIP_CERT=/etc/ssl/certs/ca-certificates.crt pip install --no-cache-dir -r requirements.txt

# Copy common directory (contains secrets_manager.py)
COPY services/common /app/common

# Copy application code
COPY services/graph-visualization-api/ .

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser \
    && chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8084/health', timeout=5)"

# Expose port
EXPOSE 8084

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8084", "--workers", "1", "--loop", "uvloop"]
