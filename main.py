import os
import re
from decimal import Decimal
from typing import Any
from urllib.parse import quote_plus

import httpx
from fastapi import FastAPI, Header, HTTPException, Query
from sqlalchemy import create_engine, text
from sqlalchemy.engine import RowMapping


app = FastAPI(title="Citel ERP to Supabase Sync API")


def get_required_env(name: str) -> str:
  value = os.environ.get(name)
  if not value:
    raise HTTPException(
      status_code=500,
      detail=f"Variavel de ambiente obrigatoria ausente: {name}",
    )
  return value


def get_safe_identifier(env_name: str, default: str) -> str:
  value = os.environ.get(env_name, default)
  if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value):
    raise HTTPException(
      status_code=500,
      detail=f"Identificador SQL invalido em {env_name}: {value}",
    )
  return value


def normalize_cpf(value: Any) -> str:
  return re.sub(r"\D", "", str(value or ""))


def to_float(value: Any) -> float:
  if isinstance(value, Decimal):
    return float(value)
  return float(value or 0)


def get_citel_engine():
  db_user = quote_plus(get_required_env("DB_USER"))
  db_pass = quote_plus(get_required_env("DB_PASS"))
  db_host = get_required_env("DB_HOST")
  db_port = os.environ.get("DB_PORT", "1433")
  db_name = quote_plus(get_required_env("DB_NAME"))

  return create_engine(
    f"mssql+pymssql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}",
    pool_pre_ping=True,
  )


def validate_sync_token(
  token: str | None = Query(default=None),
  x_sync_token: str | None = Header(default=None),
) -> None:
  expected_token = os.environ.get("SYNK_TOKEN") or os.environ.get("SYNC_TOKEN")

  if not expected_token:
    raise HTTPException(
      status_code=500,
      detail="Variavel de ambiente obrigatoria ausente: SYNK_TOKEN",
    )

  provided_token = x_sync_token or token

  if provided_token in {None, "", "SEU_SYNК_TOKEN", "SEU_SYNK_TOKEN"}:
    raise HTTPException(
      status_code=401,
      detail=(
        "Informe o valor real da variavel SYNK_TOKEN. "
        "Nao use o texto SEU_SYNK_TOKEN na URL."
      ),
    )

  if provided_token != expected_token:
    raise HTTPException(
      status_code=401,
      detail="Token de sincronizacao invalido. Confira o valor em SYNK_TOKEN no Render.",
    )


def upsert_client_coupons(records: list[dict[str, Any]]) -> None:
  supabase_url = get_required_env("SUPABASE_URL").rstrip("/")
  supabase_key = get_required_env("SUPABASE_KEY")
  endpoint = f"{supabase_url}/rest/v1/client_coupons"

  headers = {
    "apikey": supabase_key,
    "Authorization": f"Bearer {supabase_key}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=minimal",
  }

  response = httpx.post(
    endpoint,
    params={"on_conflict": "cpf"},
    headers=headers,
    json=records,
    timeout=60,
  )

  if response.status_code >= 400:
    raise HTTPException(
      status_code=502,
      detail=f"Erro ao gravar dados no Supabase: {response.text}",
    )


def build_sales_query():
  sales_table = get_safe_identifier("CITEL_SALES_TABLE", "FATGOR")
  cpf_column = get_safe_identifier("CITEL_CPF_COLUMN", "CPF")
  amount_column = get_safe_identifier("CITEL_AMOUNT_COLUMN", "TOTAL_FATURAMENTO")

  return text(
    f"""
    SELECT
      {cpf_column} AS cpf,
      SUM({amount_column}) AS total_faturamento
    FROM {sales_table}
    WHERE {cpf_column} IS NOT NULL
    GROUP BY {cpf_column}
    """
  )


def row_to_coupon_record(row: RowMapping) -> dict[str, Any] | None:
  cpf = normalize_cpf(row["cpf"])
  total_faturamento = to_float(row["total_faturamento"])

  if len(cpf) != 11:
    return None

  return {
    "cpf": cpf,
    "total_faturamento": round(total_faturamento, 2),
    "cupons_disponiveis": int(total_faturamento // 100),
  }


@app.get("/health")
def health():
  return {"status": "ok"}


@app.get("/")
def root():
  return {
    "status": "online",
    "service": "api-citel-rezende",
    "health": "/health",
    "sync": "/sync?token=VALOR_REAL_DO_SYNK_TOKEN",
    "message": "Troque VALOR_REAL_DO_SYNK_TOKEN pelo valor cadastrado no Render.",
  }


@app.get("/sync")
def sync_client_coupons(
  token: str | None = Query(default=None),
  x_sync_token: str | None = Header(default=None),
):
  validate_sync_token(token=token, x_sync_token=x_sync_token)

  engine = get_citel_engine()

  try:
    with engine.connect() as connection:
      rows = connection.execute(build_sales_query()).mappings().all()
  except Exception as exc:
    raise HTTPException(
      status_code=502,
      detail=f"Erro ao consultar SQL Server da Citel: {exc}",
    ) from exc

  records = [
    record
    for row in rows
    if (record := row_to_coupon_record(row)) is not None
  ]

  if not records:
    return {
      "success": True,
      "message": "Nenhum CPF valido encontrado para sincronizar.",
      "processed": 0,
      "upserted": 0,
    }

  try:
    upsert_client_coupons(records)
  except Exception as exc:
    if isinstance(exc, HTTPException):
      raise

    raise HTTPException(
      status_code=502,
      detail=f"Erro ao gravar dados no Supabase: {exc}",
    ) from exc

  return {
    "success": True,
    "processed": len(rows),
    "upserted": len(records),
  }
