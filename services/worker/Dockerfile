# Data-layer worker: Celery tasks that drain the durable ingestion_jobs queue.
FROM python:3.11-slim

WORKDIR /app

COPY services/worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Shared domain code (datalayer, metadata, providers) lives in services/common.
COPY services/common /app/common
COPY services/worker/ .

RUN useradd --create-home --uid 10001 appuser && chown -R appuser /app
USER appuser

# Heartbeat file is touched by every drain task; unhealthy if the beat/worker pair stops.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import os,sys,time; sys.exit(0 if time.time()-os.path.getmtime('/tmp/worker-heartbeat') < 90 else 1)"

CMD ["celery", "-A", "celery_app", "worker", "--beat", "--loglevel=INFO", "--concurrency=2", "--schedule=/tmp/celerybeat-schedule"]
