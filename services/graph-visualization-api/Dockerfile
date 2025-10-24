# Graph Visualization API Dockerfile
# Optimized for high-performance graph data processing

FROM public.ecr.aws/docker/library/python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better Docker layer caching
COPY graph-visualization-api/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy common directory (contains secrets_manager.py)
COPY common /app/common

# Copy application code
COPY graph-visualization-api/ .

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser \
    && chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8084/health || exit 1

# Expose port
EXPOSE 8084

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8084", "--workers", "1", "--loop", "uvloop"]