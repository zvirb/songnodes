FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    pgbouncer \
    curl \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Create pgbouncer user and directories
RUN useradd -r -s /bin/false pgbouncer && \
    mkdir -p /etc/pgbouncer /var/log/pgbouncer /var/run/pgbouncer && \
    chown -R pgbouncer:pgbouncer /etc/pgbouncer /var/log/pgbouncer /var/run/pgbouncer

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Copy PgBouncer configuration
COPY pgbouncer.ini /etc/pgbouncer/
COPY userlist.txt /etc/pgbouncer/
RUN chown pgbouncer:pgbouncer /etc/pgbouncer/*

# Create startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://127.0.0.1:8025/health || exit 1

# Expose ports
EXPOSE 6432 8025

# Use startup script
CMD ["/start.sh"]