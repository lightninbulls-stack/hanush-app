SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # → .../backend
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"                        # → ... (repo root)
cd "$PROJECT_ROOT"   # alembic.ini lives here
alembic upgrade head
cd "$SCRIPT_DIR"     # backend/ for uvicorn
uvicorn api_service.main:app ...