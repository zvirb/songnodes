FROM public.ecr.aws/docker/library/python:3.11-slim

WORKDIR /app

# Copy requirements first for better caching
COPY rest-api/requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared common directory with secrets_manager and artist_name_cleaner
COPY common /app/common

# Copy application code (includes pydantic_models.py copied from scrapers directory)
# Note: pydantic_models.py is a copy of scrapers/pydantic_models.py for shared validation
COPY rest-api/ .

# Expose port
EXPOSE 8082

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8082"]