FROM public.ecr.aws/docker/library/python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code (includes pydantic_models.py copied from scrapers directory)
# Note: pydantic_models.py is a copy of scrapers/pydantic_models.py for shared validation
COPY . .

# Expose port
EXPOSE 8082

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8082"]