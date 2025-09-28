FROM public.ecr.aws/docker/library/python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8082

# Run the application
CMD ["uvicorn", "main_simple_working:app", "--host", "0.0.0.0", "--port", "8082"]