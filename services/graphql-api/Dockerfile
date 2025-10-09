FROM public.ecr.aws/docker/library/python:3.11-slim

WORKDIR /app

# Install system dependencies for health check
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY graphql-api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY graphql-api/. .
COPY common /app/common
ENV PYTHONPATH="/app"

# Expose port
EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://127.0.0.1:8081/health || exit 1

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8081"]