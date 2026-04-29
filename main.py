import os
import re
from threading import Lock
from decimal import Decimal
from typing import Any
from urllib.parse import quote_plus

import httpx
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy import create_engine, text
from sqlalchemy.engine import RowMapping


app = FastAPI(title="Citel ERP to Supabase Sync API")
APP_VERSION = "2026-04-29.2"
SYNC_LOCK = Lock()
SYNC_STATE: dict[str, Any] = {
  "running": False,
  "last_result": None,
  "last_error": None,
}


def get_required_env(name: str) -> str:
  value = os.environ.get(name)
  if not value:
    raise HTTPException(
      status_code=500,
      detail=f"Variavel de ambiente obrigatoria ausente: {name}",
    )
  return value


def get_required_env_any(*names: str) -> str:
  for name in names:
    value = os.environ.get(name)
    if value:
      return value

  raise HTTPException(
    status_code=500,
    detail=f"Variavel de ambiente obrigatoria ausente: {' ou '.join(names)}",
  )


def get_safe_identifier(env_name: str, default: str) -> str:
  value = os.environ.get(env_name, default)
  if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value):
    raise HTTPException(
      status_code=500,
      detail=f"Identificador SQL invalido em {env_name}: {value}",
    )
  return value


def get_safe_table_identifier(env_name: str, default: str) -> str:
  value = os.environ.get(env_name, default)
  if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?", value):
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
  db_backend = os.environ.get("DB_BACKEND", "mysql").lower()

  if db_backend != "sqlserver":
    mysql_user = quote_plus(get_required_env_any("MYSQL_USER", "DB_USER"))
    mysql_pass = quote_plus(get_required_env_any("MYSQL_PASS", "DB_PASS"))
    mysql_host = get_required_env_any("MYSQL_HOST", "DB_HOST")
    mysql_port = os.environ.get("MYSQL_PORT") or os.environ.get("DB_PORT") or "3306"
    mysql_db = quote_plus(get_required_env_any("MYSQL_DB", "DB_NAME"))

    return create_engine(
      (
        f"mysql+pymysql://{mysql_user}:{mysql_pass}"
        f"@{mysql_host}:{mysql_port}/{mysql_db}?charset=utf8mb4"
      ),
      pool_pre_ping=True,
    )

  db_user = quote_plus(get_required_env("DB_USER"))
  db_pass = quote_plus(get_required_env("DB_PASS"))
  db_host = get_required_env("DB_HOST")
  db_port = os.environ.get("DB_PORT", "1433")
  db_name = quote_plus(get_required_env("DB_NAME"))

  return create_engine(
    f"mssql+pymssql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}",
    pool_pre_ping=True,
  )


def get_database_backend_name() -> str:
  if os.environ.get("DB_BACKEND", "mysql").lower() != "sqlserver":
    return "mysql"
  if os.environ.get("DB_HOST"):
    return "sqlserver"
  return "unconfigured"


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


def get_supabase_config() -> tuple[str, str]:
  supabase_url = get_required_env("SUPABASE_URL").strip().rstrip("/")
  supabase_url = supabase_url.replace(
    "tgxhpskqcpflkbrrwubr",
    "tgxhpskqcphlkbrrwubr",
  )
  supabase_key = (
    os.environ.get("SUPABASE_SERVICE_KEY")
    or os.environ.get("UPABASE_SERVICE_KEY")
    or os.environ.get("$UPABASE_SERVICE_KEY")
    or get_required_env("SUPABASE_KEY")
  )

  return supabase_url, supabase_key


def post_supabase_records(
  table_name: str,
  records: list[dict[str, Any]],
  conflict_column: str,
) -> None:
  if not records:
    return

  supabase_url, supabase_key = get_supabase_config()
  endpoint = f"{supabase_url}/rest/v1/{table_name}"

  headers = {
    "apikey": supabase_key,
    "Authorization": f"Bearer {supabase_key}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=minimal",
  }

  response = httpx.post(
    endpoint,
    params={"on_conflict": conflict_column},
    headers=headers,
    json=records,
    timeout=60,
  )

  if response.status_code >= 400:
    raise HTTPException(
      status_code=502,
      detail=f"Erro ao gravar dados no Supabase ({table_name}): {response.text}",
    )


def delete_supabase_records(
  table_name: str,
  filter_query: str,
) -> None:
  supabase_url, supabase_key = get_supabase_config()
  endpoint = f"{supabase_url}/rest/v1/{table_name}?{filter_query}"

  headers = {
    "apikey": supabase_key,
    "Authorization": f"Bearer {supabase_key}",
    "Prefer": "return=minimal",
  }

  response = httpx.delete(
    endpoint,
    headers=headers,
    timeout=60,
  )

  if response.status_code >= 400:
    raise HTTPException(
      status_code=502,
      detail=f"Erro ao limpar dados no Supabase ({table_name}): {response.text}",
    )


def upsert_client_coupons(records: list[dict[str, Any]]) -> None:
  post_supabase_records("client_coupons", records, "cpf")


def upsert_coupons(records: list[dict[str, Any]]) -> None:
  post_supabase_records("coupons", records, "code")


def clear_synced_supabase_data() -> None:
  delete_supabase_records("coupons", "id=not.is.null")
  delete_supabase_records("client_coupons", "cpf=not.is.null")


def build_detailed_coupon_query():
  sales_table = get_safe_table_identifier("CITEL_SALES_TABLE", "CPPGER")
  client_table = get_safe_table_identifier("CITEL_CLIENT_TABLE", "CADCLI")
  movement_table = get_safe_table_identifier("CITEL_MOVEMENT_TABLE", "MOVGER")
  seller_table = get_safe_table_identifier("CITEL_SELLER_TABLE", "CADOPE")
  movement_increment_column = get_safe_identifier("CITEL_MOVEMENT_INCREMENT_COLUMN", "AUTOINCREM")
  movement_document_column = get_safe_identifier("CITEL_MOVEMENT_DOCUMENT_COLUMN", "GER_NUMDOC")
  movement_document_type_column = get_safe_identifier("CITEL_MOVEMENT_DOCUMENT_TYPE_COLUMN", "GER_ESPDOC")
  movement_company_column = get_safe_identifier("CITEL_MOVEMENT_COMPANY_COLUMN", "GER_CODEMP")
  movement_client_column = get_safe_identifier("CITEL_MOVEMENT_CLIENT_COLUMN", "GER_CODCLI")
  sales_sequence_column = get_safe_identifier("CITEL_SALES_SEQUENCE_COLUMN", "CPG_SEQUEN")
  sales_date_column = get_safe_identifier("CITEL_SALES_DATE_COLUMN", "CPG_DTAENT")
  sales_time_column = get_safe_identifier("CITEL_SALES_TIME_COLUMN", "CPG_HORENT")
  sales_document_column = get_safe_identifier("CITEL_SALES_DOCUMENT_COLUMN", "CPG_NUMDOC")
  sales_document_type_column = get_safe_identifier("CITEL_SALES_DOCUMENT_TYPE_COLUMN", "CPG_ESPDOC")
  sales_client_column = get_safe_identifier("CITEL_SALES_CLIENT_COLUMN", "CPG_CODCLI")
  sales_company_column = get_safe_identifier("CITEL_SALES_COMPANY_COLUMN", "CPG_CODEMP")
  client_code_column = get_safe_identifier("CITEL_CLIENT_CODE_COLUMN", "CLI_CODCLI")
  cpf_column = get_safe_identifier("CITEL_CPF_COLUMN", "CLI_C_G_C_")
  amount_column = get_safe_identifier("CITEL_AMOUNT_COLUMN", "CPG_VALDOC")
  customer_name_column = get_safe_identifier("CITEL_CUSTOMER_NAME_COLUMN", "CLI_NOMCLI")
  movement_seller_column = get_safe_identifier("CITEL_MOVEMENT_SELLER_COLUMN", "GER_CODVEN")
  phone_column = get_safe_identifier("CITEL_PHONE_COLUMN", "CLI_FONE01")
  mobile_column = get_safe_identifier("CITEL_MOBILE_COLUMN", "CLI_CELULA")
  address_column = get_safe_identifier("CITEL_ADDRESS_COLUMN", "CLI_ENDERE")
  neighborhood_column = get_safe_identifier("CITEL_NEIGHBORHOOD_COLUMN", "CLI_BAIRRO")
  zipcode_column = get_safe_identifier("CITEL_ZIPCODE_COLUMN", "CLI_C_E_P_")
  seller_code_column = get_safe_identifier("CITEL_SELLER_CODE_COLUMN", "OPE_CODOPE")
  seller_name_column = get_safe_identifier("CITEL_SELLER_NAME_COLUMN", "OPE_NOMOPE")
  return text(
    f"""
    SELECT
      sales.{sales_sequence_column} AS coupon_code,
      sales.{sales_date_column} AS sale_date,
      sales.{sales_time_column} AS sale_time,
      sales.{sales_document_column} AS document_number,
      sales.{sales_document_type_column} AS document_type,
      clients.{cpf_column} AS cpf,
      sales.{sales_client_column} AS customer_code,
      sales.{amount_column} AS document_amount,
      movements.{movement_seller_column} AS seller_code,
      sellers.{seller_name_column} AS seller_name,
      clients.{customer_name_column} AS customer_name,
      clients.{phone_column} AS customer_phone,
      clients.{mobile_column} AS customer_mobile,
      clients.{address_column} AS customer_address,
      clients.{neighborhood_column} AS customer_neighborhood,
      clients.{zipcode_column} AS customer_zipcode
    FROM {sales_table} AS sales
    INNER JOIN {client_table} AS clients
      ON sales.{sales_client_column} = clients.{client_code_column}
    INNER JOIN {movement_table} AS movements
      ON movements.{movement_document_column} = sales.{sales_document_column}
      AND movements.{movement_document_type_column} = sales.{sales_document_type_column}
      AND movements.{movement_company_column} = sales.{sales_company_column}
      AND movements.{movement_client_column} = sales.{sales_client_column}
    LEFT JOIN {seller_table} AS sellers
      ON movements.{movement_seller_column} = sellers.{seller_code_column}
    WHERE clients.{cpf_column} IS NOT NULL
      AND TRIM(CAST(movements.{movement_increment_column} AS CHAR)) <> ''
    """
  )


def row_to_detailed_coupon_record(row: RowMapping) -> dict[str, Any] | None:
  cpf = normalize_cpf(row["cpf"])
  coupon_code = str(row["coupon_code"] or "").strip()
  sale_date = str(row["sale_date"] or "").strip()
  sale_time = str(row["sale_time"] or "").strip()
  document_number = str(row["document_number"] or "").strip()
  document_type = str(row["document_type"] or "").strip()
  customer_code = str(row["customer_code"] or "").strip()
  customer_name = str(row["customer_name"] or "").strip()
  seller_code = str(row["seller_code"] or "").strip()
  seller_name = str(row["seller_name"] or "").strip()
  customer_phone = str(row["customer_phone"] or "").strip()
  customer_mobile = str(row["customer_mobile"] or "").strip()
  customer_address = str(row["customer_address"] or "").strip()
  customer_neighborhood = str(row["customer_neighborhood"] or "").strip()
  customer_zipcode = str(row["customer_zipcode"] or "").strip()
  document_amount = to_float(row["document_amount"])

  if len(cpf) != 11 or not coupon_code or not document_number:
    return None

  return {
    "code": coupon_code,
    "sale_date": sale_date,
    "sale_time": sale_time,
    "cpf": cpf,
    "document_number": document_number,
    "document_type": document_type,
    "customer_code": customer_code,
    "customer_name": customer_name,
    "seller_code": seller_code,
    "seller_name": seller_name,
    "customer_phone": customer_phone,
    "customer_mobile": customer_mobile,
    "customer_address": customer_address,
    "customer_neighborhood": customer_neighborhood,
    "customer_zipcode": customer_zipcode,
    "document_amount": round(document_amount, 2),
    "discount_percentage": 0,
    "category": document_type or "AUTCOM",
    "expiry_date": "2026-12-31",
  }


def build_sales_query():
  sales_table = get_safe_table_identifier("CITEL_SALES_TABLE", "CPPGER")
  client_table = get_safe_table_identifier("CITEL_CLIENT_TABLE", "CADCLI")
  movement_table = get_safe_table_identifier("CITEL_MOVEMENT_TABLE", "MOVGER")
  movement_increment_column = get_safe_identifier("CITEL_MOVEMENT_INCREMENT_COLUMN", "AUTOINCREM")
  movement_document_column = get_safe_identifier("CITEL_MOVEMENT_DOCUMENT_COLUMN", "GER_NUMDOC")
  movement_document_type_column = get_safe_identifier("CITEL_MOVEMENT_DOCUMENT_TYPE_COLUMN", "GER_ESPDOC")
  movement_company_column = get_safe_identifier("CITEL_MOVEMENT_COMPANY_COLUMN", "GER_CODEMP")
  movement_client_column = get_safe_identifier("CITEL_MOVEMENT_CLIENT_COLUMN", "GER_CODCLI")
  sales_client_column = get_safe_identifier("CITEL_SALES_CLIENT_COLUMN", "CPG_CODCLI")
  sales_document_column = get_safe_identifier("CITEL_SALES_DOCUMENT_COLUMN", "CPG_NUMDOC")
  sales_document_type_column = get_safe_identifier("CITEL_SALES_DOCUMENT_TYPE_COLUMN", "CPG_ESPDOC")
  sales_company_column = get_safe_identifier("CITEL_SALES_COMPANY_COLUMN", "CPG_CODEMP")
  client_code_column = get_safe_identifier("CITEL_CLIENT_CODE_COLUMN", "CLI_CODCLI")
  cpf_column = get_safe_identifier("CITEL_CPF_COLUMN", "CLI_C_G_C_")
  amount_column = get_safe_identifier("CITEL_AMOUNT_COLUMN", "CPG_VALDOC")
  customer_name_column = get_safe_identifier("CITEL_CUSTOMER_NAME_COLUMN", "CLI_NOMCLI")

  return text(
    f"""
    SELECT
      clients.{cpf_column} AS cpf,
      clients.{client_code_column} AS customer_code,
      clients.{customer_name_column} AS customer_name,
      COALESCE(
        SUM(
          CASE
            WHEN TRIM(CAST(movements.{movement_increment_column} AS CHAR)) <> ''
            THEN sales.{amount_column}
            ELSE 0
          END
        ),
        0
      ) AS total_faturamento,
      COALESCE(
        COUNT(
          CASE
            WHEN TRIM(CAST(movements.{movement_increment_column} AS CHAR)) <> ''
            THEN 1
            ELSE NULL
          END
        ),
        0
      ) AS cupons_disponiveis
    FROM {client_table} AS clients
    LEFT JOIN {sales_table} AS sales
      ON sales.{sales_client_column} = clients.{client_code_column}
    LEFT JOIN {movement_table} AS movements
      ON movements.{movement_document_column} = sales.{sales_document_column}
      AND movements.{movement_document_type_column} = sales.{sales_document_type_column}
      AND movements.{movement_company_column} = sales.{sales_company_column}
      AND movements.{movement_client_column} = sales.{sales_client_column}
    WHERE clients.{cpf_column} IS NOT NULL
    GROUP BY
      clients.{cpf_column},
      clients.{client_code_column},
      clients.{customer_name_column}
    """
  )


def build_columns_query(table_name: str):
  if get_database_backend_name() == "mysql":
    return text(
      """
      SELECT COLUMN_NAME AS column_name
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table_name
      ORDER BY ORDINAL_POSITION
      """
    )

  return text(
    """
    SELECT COLUMN_NAME AS column_name
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = :table_name
    ORDER BY ORDINAL_POSITION
    """
  )


def row_to_coupon_record(row: RowMapping) -> dict[str, Any] | None:
  cpf = normalize_cpf(row["cpf"])
  total_faturamento = to_float(row["total_faturamento"])
  customer_code = str(row["customer_code"] or "").strip()
  customer_name = str(row["customer_name"] or "").strip()

  if len(cpf) != 11:
    return None

  return {
    "cpf": cpf,
    "customer_code": customer_code,
    "customer_name": customer_name,
    "total_faturamento": round(total_faturamento, 2),
    "cupons_disponiveis": int(row["cupons_disponiveis"] or 0),
  }


def merge_client_coupon_records(
  records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
  records_by_cpf: dict[str, dict[str, Any]] = {}

  for record in records:
    cpf = record["cpf"]

    if cpf not in records_by_cpf:
      records_by_cpf[cpf] = dict(record)
      continue

    current = records_by_cpf[cpf]
    current["total_faturamento"] = round(
      to_float(current.get("total_faturamento")) +
      to_float(record.get("total_faturamento")),
      2,
    )
    current["cupons_disponiveis"] = int(
      current.get("cupons_disponiveis") or 0
    ) + int(record.get("cupons_disponiveis") or 0)

    if not current.get("customer_code") and record.get("customer_code"):
      current["customer_code"] = record["customer_code"]
    if not current.get("customer_name") and record.get("customer_name"):
      current["customer_name"] = record["customer_name"]

  return list(records_by_cpf.values())


@app.get("/health")
def health():
  return {
    "status": "ok",
    "version": APP_VERSION,
    "database_backend": get_database_backend_name(),
    "has_mysql_host": bool(os.environ.get("MYSQL_HOST")),
    "has_db_host": bool(os.environ.get("DB_HOST")),
  }


@app.get("/ping", response_class=PlainTextResponse)
def ping():
  return "ok"


@app.get("/")
def root():
  return {
    "status": "online",
    "service": "api-citel-rezende",
    "version": APP_VERSION,
    "database_backend": get_database_backend_name(),
    "health": "/health",
    "sync": "/sync?token=VALOR_REAL_DO_SYNK_TOKEN",
    "message": "Troque VALOR_REAL_DO_SYNK_TOKEN pelo valor cadastrado no Render.",
  }


def run_coupon_sync(full_refresh: bool = False) -> dict[str, Any]:
  engine = get_citel_engine()

  try:
    with engine.connect() as connection:
      coupon_rows = connection.execute(build_detailed_coupon_query()).mappings().all()
      summary_rows = connection.execute(build_sales_query()).mappings().all()
  except Exception as exc:
    raise HTTPException(
      status_code=502,
      detail=f"Erro ao consultar banco do Autcom/Citel: {exc}",
    ) from exc

  coupon_records = [
    record
    for row in coupon_rows
    if (record := row_to_detailed_coupon_record(row)) is not None
  ]
  summary_records = [
    record
    for row in summary_rows
    if (record := row_to_coupon_record(row)) is not None
  ]
  summary_records = merge_client_coupon_records(summary_records)

  if not coupon_records and not summary_records:
    return {
      "success": True,
      "message": "Nenhum CPF valido encontrado para sincronizar.",
      "processed": 0,
      "upserted_coupons": 0,
      "upserted_clients": 0,
    }

  try:
    if full_refresh:
      clear_synced_supabase_data()
    upsert_coupons(coupon_records)
    upsert_client_coupons(summary_records)
  except Exception as exc:
    if isinstance(exc, HTTPException):
      raise

    raise HTTPException(
      status_code=502,
      detail=f"Erro ao gravar dados no Supabase: {exc}",
    ) from exc

  return {
    "success": True,
    "processed_coupons": len(coupon_rows),
    "processed_clients": len(summary_rows),
    "upserted_coupons": len(coupon_records),
    "upserted_clients": len(summary_records),
    "full_refresh": full_refresh,
  }


def run_coupon_sync_in_background(full_refresh: bool = False) -> None:
  if not SYNC_LOCK.acquire(blocking=False):
    return

  SYNC_STATE["running"] = True
  SYNC_STATE["last_error"] = None

  try:
    SYNC_STATE["last_result"] = run_coupon_sync(full_refresh=full_refresh)
  except Exception as exc:
    SYNC_STATE["last_error"] = str(exc)
  finally:
    SYNC_STATE["running"] = False
    SYNC_LOCK.release()


@app.get("/sync")
def sync_client_coupons(
  token: str | None = Query(default=None),
  x_sync_token: str | None = Header(default=None),
  full_refresh: bool = Query(default=False),
):
  validate_sync_token(token=token, x_sync_token=x_sync_token)

  return run_coupon_sync(full_refresh=full_refresh)


@app.get("/sync/trigger")
def trigger_coupon_sync(
  background_tasks: BackgroundTasks,
  token: str | None = Query(default=None),
  x_sync_token: str | None = Header(default=None),
  full_refresh: bool = Query(default=False),
):
  validate_sync_token(token=token, x_sync_token=x_sync_token)

  if SYNC_STATE["running"] or SYNC_LOCK.locked():
    return {
      "success": True,
      "status": "already_running",
      "message": "Sincronizacao ja esta em andamento.",
      "last_result": SYNC_STATE["last_result"],
      "last_error": SYNC_STATE["last_error"],
    }

  background_tasks.add_task(
    run_coupon_sync_in_background,
    full_refresh=full_refresh,
  )

  return {
    "success": True,
    "status": "started",
    "message": "Sincronizacao iniciada em segundo plano.",
    "full_refresh": full_refresh,
    "last_result": SYNC_STATE["last_result"],
    "last_error": SYNC_STATE["last_error"],
  }


@app.get("/columns")
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
