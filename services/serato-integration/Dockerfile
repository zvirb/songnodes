FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for audio file processing
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    libsndfile1-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create directory for mounted music library
RUN mkdir -p /music

# Default command runs batch import script
CMD ["python", "batch_import.py", "--help"]
