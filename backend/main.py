import os
import re
import uuid
from threading import Lock
from typing import Any

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from backend.database.engine import get_citel_engine, get_database_backend_name
from backend.queries.column_queries import build_columns_query
from backend.queries.coupon_queries import build_detailed_coupon_query
from backend.queries.sales_queries import build_sales_query
from backend.services.coupon_mapper import (
  merge_client_coupon_records,
  row_to_coupon_record,
  row_to_detailed_coupon_record,
)
from backend.services.supabase_service import (
  clear_synced_supabase_data,
  delete_supabase_records,
  fetch_supabase_table,
  insert_supabase_record,
  require_supabase_user,
  upsert_client_coupons,
  upsert_coupons,
)
from backend.utils.hash import build_canonical_participants, build_participants_hash
from backend.utils.security import (
  choose_unbiased_index,
  get_code_commit_hash,
  validate_sync_token,
)


app = FastAPI(title="Citel ERP to Supabase Sync API")
APP_VERSION = "2026-04-30.5"
MAX_SUMMARY_RECORDS_WITHOUT_CONFIRMATION = 5000
DRAW_ALGORITHM_VERSION = "server-rejection-sampling-256-v1"
DRAW_ALGORITHM_UPDATED_AT = "2026-04-30"
SYNC_LOCK = Lock()
SYNC_STATE: dict[str, Any] = {
  "running": False,
  "last_result": None,
  "last_error": None,
}

app.add_middleware(
  CORSMiddleware,
  allow_origins=[
    "https://projeto-qrcode-two.vercel.app",
    "http://localhost:5173",
    "http://localhost:4173",
  ],
  allow_origin_regex=r"https://.*\.vercel\.app",
  allow_credentials=True,
  allow_methods=["GET", "POST", "OPTIONS"],
  allow_headers=["Authorization", "Content-Type"],
)


class DrawRequest(BaseModel):
  prize_item: str


@app.get("/health")
def health():
  return {
    "status": "ok",
    "version": APP_VERSION,
    "commit_hash": get_code_commit_hash(),
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
    "commit_hash": get_code_commit_hash(),
    "database_backend": get_database_backend_name(),
    "health": "/health",
    "sync": "/sync?token=VALOR_REAL_DO_SYNK_TOKEN",
    "message": "Troque VALOR_REAL_DO_SYNK_TOKEN pelo valor cadastrado no Render.",
  }


def run_coupon_sync(
  full_refresh: bool = False,
  include_summary: bool = False,
  allow_large_summary: bool = False,
) -> dict[str, Any]:
  engine = get_citel_engine()

  try:
    with engine.connect() as connection:
      coupon_rows = connection.execute(build_detailed_coupon_query()).mappings().all()
      summary_rows = (
        connection.execute(build_sales_query()).mappings().all()
        if include_summary or full_refresh
        else []
      )
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

  if (
    summary_records
    and len(summary_records) > MAX_SUMMARY_RECORDS_WITHOUT_CONFIRMATION
    and not allow_large_summary
  ):
    return {
      "success": False,
      "message": (
        "Resumo de clientes muito grande para sincronizacao automatica. "
        "Use allow_large_summary=true somente em uma execucao manual planejada."
      ),
      "processed_coupons": len(coupon_rows),
      "processed_clients": len(summary_rows),
      "upserted_coupons": 0,
      "upserted_clients": 0,
      "full_refresh": full_refresh,
      "include_summary": include_summary or full_refresh,
      "summary_records": len(summary_records),
      "summary_limit": MAX_SUMMARY_RECORDS_WITHOUT_CONFIRMATION,
    }

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
    if summary_records:
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
    "include_summary": include_summary or full_refresh,
    "summary_records": len(summary_records),
  }


def run_coupon_sync_in_background(
  full_refresh: bool = False,
  include_summary: bool = False,
  allow_large_summary: bool = False,
) -> None:
  if not SYNC_LOCK.acquire(blocking=False):
    return

  SYNC_STATE["running"] = True
  SYNC_STATE["last_error"] = None

  try:
    SYNC_STATE["last_result"] = run_coupon_sync(
      full_refresh=full_refresh,
      include_summary=include_summary,
      allow_large_summary=allow_large_summary,
    )
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
  include_summary: bool = Query(default=False),
  allow_large_summary: bool = Query(default=False),
):
  validate_sync_token(token=token, x_sync_token=x_sync_token)

  return run_coupon_sync(
    full_refresh=full_refresh,
    include_summary=include_summary,
    allow_large_summary=allow_large_summary,
  )


@app.get("/sync/trigger")
def trigger_coupon_sync(
  background_tasks: BackgroundTasks,
  token: str | None = Query(default=None),
  x_sync_token: str | None = Header(default=None),
  full_refresh: bool = Query(default=False),
  include_summary: bool = Query(default=False),
  allow_large_summary: bool = Query(default=False),
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
    include_summary=include_summary,
    allow_large_summary=allow_large_summary,
  )

  return {
    "success": True,
    "status": "started",
    "message": "Sincronizacao iniciada em segundo plano.",
    "full_refresh": full_refresh,
    "include_summary": include_summary or full_refresh,
    "allow_large_summary": allow_large_summary,
    "last_result": SYNC_STATE["last_result"],
    "last_error": SYNC_STATE["last_error"],
  }


@app.post("/draw")
def draw_coupon(
  draw_request: DrawRequest,
  authorization: str | None = Header(default=None),
):
  user = require_supabase_user(authorization)
  prize_item = draw_request.prize_item.strip()

  if not prize_item:
    raise HTTPException(
      status_code=400,
      detail="Informe o item/premio do sorteio.",
    )

  validations = fetch_supabase_table(
    "validations",
    {
      "select": "*",
      "order": "validated_at.asc,id.asc",
    },
  )

  if not validations:
    raise HTTPException(
      status_code=400,
      detail="Ainda nao existem cupons validados para sortear.",
    )

  fetch_supabase_table(
    "draw_audits",
    {
      "select": "id",
      "limit": "1",
    },
    range_limit=0,
  )

  pool_size = len(validations)
  selected_index, random_value = choose_unbiased_index(pool_size)
  winner = validations[selected_index]
  canonical_participants = build_canonical_participants(validations)
  participants_hash = build_participants_hash(validations)

  coupon_rows = fetch_supabase_table(
    "coupons",
    {
      "select": "code,document_number,document_type,customer_code,customer_name,seller_code,seller_name",
      "code": f"eq.{winner.get('code') or ''}",
      "document_number": f"eq.{winner.get('document') or ''}",
      "limit": "1",
    },
    range_limit=0,
  )
  coupon = coupon_rows[0] if coupon_rows else {}

  draw_id = str(uuid.uuid4())
  commit_hash = get_code_commit_hash()
  draw_payload = {
    "id": draw_id,
    "validation_id": winner.get("id"),
    "prize_item": prize_item,
    "code": winner.get("code"),
    "cpf": winner.get("cpf"),
    "document": winner.get("document"),
    "document_type": coupon.get("document_type"),
    "customer_code": coupon.get("customer_code"),
    "customer_name": coupon.get("customer_name"),
    "seller_code": coupon.get("seller_code"),
    "seller_name": coupon.get("seller_name"),
    "validated_at": winner.get("validated_at"),
    "algorithm_version": DRAW_ALGORITHM_VERSION,
    "pool_size": pool_size,
    "random_value": str(random_value),
    "selected_index": selected_index,
    "participants_hash": participants_hash,
  }

  saved_draw = insert_supabase_record("draws", draw_payload)
  try:
    saved_audit = insert_supabase_record(
      "draw_audits",
      {
        "draw_id": draw_id,
        "algorithm_version": DRAW_ALGORITHM_VERSION,
        "algorithm_updated_at": DRAW_ALGORITHM_UPDATED_AT,
        "commit_hash": commit_hash,
        "pool_size": pool_size,
        "selected_index": selected_index,
        "random_value": str(random_value),
        "participants_hash": participants_hash,
        "participants": canonical_participants,
        "admin_user_id": user.get("id"),
        "admin_user_email": user.get("email"),
      },
    )
  except Exception:
    delete_supabase_records("draws", f"id=eq.{draw_id}")
    raise

  return {
    "success": True,
    "algorithm_version": DRAW_ALGORITHM_VERSION,
    "algorithm_updated_at": DRAW_ALGORITHM_UPDATED_AT,
    "commit_hash": commit_hash,
    "participants_hash": participants_hash,
    "admin_user_id": user.get("id"),
    "admin_user_email": user.get("email"),
    "winner": {
      **winner,
      "document_type": coupon.get("document_type"),
      "customer_code": coupon.get("customer_code"),
      "customer_name": coupon.get("customer_name"),
      "seller_code": coupon.get("seller_code"),
      "seller_name": coupon.get("seller_name"),
    },
    "draw": saved_draw,
    "audit": saved_audit,
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
