# SongNodes scraper stack Docker image
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p /app/output

ENV PYTHONUNBUFFERED=1 \
    REDIS_HOST=redis \
    REDIS_PORT=6379 \
    POSTGRES_HOST=postgres \
    POSTGRES_PORT=5432 \
    POSTGRES_DB=musicdb \
    POSTGRES_USER=musicuser \
    POSTGRES_PASSWORD=musicpass

RUN cat <<'ENTRY' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh
#!/bin/bash
set -e

echo "SongNodes Scraper container ready"
echo "Available spiders:" && scrapy list && echo

echo "Usage examples:"
echo "  docker run songnodes-scrapers scrapy crawl 1001tracklists"
echo "  docker run songnodes-scrapers scrapy crawl mixesdb"
echo "  docker run songnodes-scrapers scrapy crawl reddit"
echo "  docker run songnodes-scrapers scrapy crawl setlistfm"
echo

if [ $# -eq 0 ]; then
  exec /bin/bash
else
  exec "$@"
fi
ENTRY

ENTRYPOINT ["/app/entrypoint.sh"]
