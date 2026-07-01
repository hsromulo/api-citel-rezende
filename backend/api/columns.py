import re

from fastapi import APIRouter, Header, HTTPException, Query

from backend.database.engine import get_citel_engine
from backend.queries.column_queries import build_columns_query
from backend.utils.security import validate_sync_token


router = APIRouter()


@router.get("/columns")
def list_table_columns(
  table: str = Query(default="FATGOR"),
  token: str | None = Query(default=None),
  x_sync_token: str | None = Header(default=None),
):
  validate_sync_token(token=token, x_sync_token=x_sync_token)

  if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", table):
    raise HTTPException(status_code=400, detail="Nome de tabela invalido.")

  engine = get_citel_engine()

  try:
    with engine.connect() as connection:
      rows = connection.execute(
        build_columns_query(table),
        {"table_name": table},
      ).mappings().all()
  except Exception as exc:
    raise HTTPException(
      status_code=502,
      detail=f"Erro ao consultar colunas da tabela {table}: {exc}",
    ) from exc

  return {
    "table": table,
    "columns": [row["column_name"] for row in rows],
  }
