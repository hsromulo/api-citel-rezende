import os

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from backend.database.engine import get_database_backend_name
from backend.utils.security import get_code_commit_hash


router = APIRouter()
APP_VERSION = "2026-04-30.5"


@router.get("/health")
def health():
  return {
    "status": "ok",
    "version": APP_VERSION,
    "commit_hash": get_code_commit_hash(),
    "database_backend": get_database_backend_name(),
    "has_mysql_host": bool(os.environ.get("MYSQL_HOST")),
    "has_db_host": bool(os.environ.get("DB_HOST")),
  }


@router.get("/ping", response_class=PlainTextResponse)
def ping():
  return "ok"


@router.get("/")
def root():
  return {
    "status": "online",
    "service": "api-citel-rezende",
    "version": APP_VERSION,
    "commit_hash": get_code_commit_hash(),
    "database_backend": get_database_backend_name(),
    "health": "/health",
    "sync": "/sync?token=VALOR_REAL_DO_SYNK_TOKEN",
    "message": "Troque VALOR_REAL_DO_SYNK_TOKEN pelo valor cadastrado no Render.",
  }
