FROM python:3.12-slim

# Install system dependencies for Playwright and Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    gpg \
    ca-certificates \
    cron \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxshmfence1 \
    xdg-utils \
    libvulkan1 \
    libxss1 \
    && rm -rf /var/lib/apt/lists/*

# Install Google Chrome Stable (updated method for newer Debian)
RUN wget -q -O /tmp/google-chrome-key.pub https://dl-ssl.google.com/linux/linux_signing_key.pub \
    && gpg --dearmor -o /etc/apt/trusted.gpg.d/google-chrome.gpg /tmp/google-chrome-key.pub \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/* /tmp/google-chrome-key.pub

WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Set Playwright environment before installing browsers
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install Playwright browsers
# Note: install-deps skipped because we already installed all deps manually above
RUN playwright install chromium firefox webkit

# Copy application code
COPY . .

# Create screenshots directory
RUN mkdir -p /app/screenshots && chmod 777 /app/screenshots

# Setup cron for screenshot cleanup (runs daily at 2 AM)
RUN echo "0 2 * * * /app/cleanup_screenshots.sh >> /var/log/screenshot_cleanup.log 2>&1" > /etc/cron.d/screenshot-cleanup && \
    chmod 0644 /etc/cron.d/screenshot-cleanup && \
    crontab /etc/cron.d/screenshot-cleanup && \
    touch /var/log/screenshot_cleanup.log

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 8030

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8030/health')" || exit 1

# Run the service with entrypoint script (starts cron + FastAPI)
CMD ["/app/entrypoint.sh"]
