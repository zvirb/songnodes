FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Copy shared secrets manager
COPY ../common /app/common

# Create directory for Prometheus multiprocess metrics
RUN mkdir -p /tmp/prometheus

ENV PYTHONUNBUFFERED=1
ENV PROMETHEUS_MULTIPROC_DIR=/tmp/prometheus

EXPOSE 8100

CMD ["python", "main.py"]
