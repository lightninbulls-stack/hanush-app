#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # → .../backend
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"                      # → repo root

# Run Alembic migrations from repo root
cd "$PROJECT_ROOT"
alembic stamp head || true
alembic upgrade head

# Start Uvicorn from backend/
cd "$SCRIPT_DIR"
uvicorn api_service.main:app --host 0.0.0.0 --port 8000
