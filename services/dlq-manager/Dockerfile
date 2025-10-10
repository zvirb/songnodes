FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY dlq-manager/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy common libraries
COPY common/*.py /app/common/

# Copy DLQ manager code
COPY dlq-manager/rabbitmq_setup.py .
COPY dlq-manager/main.py .

# Run setup on startup, then start API
CMD python rabbitmq_setup.py && python -m uvicorn main:app --host 0.0.0.0 --port 8024
