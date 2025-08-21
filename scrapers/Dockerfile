FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy scrapy project
COPY . .

# Create scrapy configuration
RUN mkdir -p /app/output

# Expose port for health checks
EXPOSE 8090

# Default command (can be overridden)
CMD ["scrapy", "crawl", "1001tracklists", "-L", "INFO"]