import os
import re
from decimal import Decimal
from typing import Any
from urllib.parse import quote_plus

from fastapi import FastAPI, HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.engine import RowMapping
from supabase import Client, create_client


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
  mysql_user = quote_plus(get_required_env("MYSQL_USER"))
  mysql_pass = quote_plus(get_required_env("MYSQL_PASS"))
  mysql_host = get_required_env("MYSQL_HOST")
  mysql_port = os.environ.get("MYSQL_PORT", "3306")
  mysql_db = get_required_env("MYSQL_DB")

  mysql_url = (
    f"mysql+pymysql://{mysql_user}:{mysql_pass}"
    f"@{mysql_host}:{mysql_port}/{mysql_db}?charset=utf8mb4"
  )

  return create_engine(mysql_url, pool_pre_ping=True)


def get_supabase_client() -> Client:
  supabase_url = get_required_env("SUPABASE_URL")
  supabase_key = get_required_env("SUPABASE_KEY")
  return create_client(supabase_url, supabase_key)


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


@app.get("/sync")
def sync_client_coupons():
  engine = get_citel_engine()
  supabase = get_supabase_client()

  try:
    with engine.connect() as connection:
      rows = connection.execute(build_sales_query()).mappings().all()
  except Exception as exc:
    raise HTTPException(
      status_code=502,
      detail=f"Erro ao consultar MySQL da Citel: {exc}",
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
    supabase.table("client_coupons").upsert(
      records,
      on_conflict="cpf",
    ).execute()
  except Exception as exc:
    raise HTTPException(
      status_code=502,
      detail=f"Erro ao gravar dados no Supabase: {exc}",
    ) from exc

  return {
    "success": True,
    "processed": len(rows),
    "upserted": len(records),
  }
