#!/bin/bash
set -e
echo "=== Running Alembic migrations ==="
cd /app
alembic upgrade head
echo "=== Starting API server ==="
cd /app/backend
exec uvicorn api_service.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
