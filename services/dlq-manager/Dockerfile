FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy common secrets manager
COPY ../common/secrets_manager.py /app/common/secrets_manager.py

# Copy DLQ manager code
COPY rabbitmq_setup.py .
COPY main.py .

# Run setup on startup, then start API
CMD python rabbitmq_setup.py && python -m uvicorn main:app --host 0.0.0.0 --port 8024
