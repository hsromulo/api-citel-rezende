from threading import Lock
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Query

from backend.database.engine import get_citel_engine
from backend.queries.coupon_queries import build_detailed_coupon_query
from backend.queries.sales_queries import build_sales_query
from backend.services.coupon_mapper import (
  merge_client_coupon_records,
  row_to_coupon_record,
  row_to_detailed_coupon_record,
)
from backend.services.supabase_service import (
  clear_synced_supabase_data,
  upsert_client_coupons,
  upsert_coupons,
)
from backend.utils.security import validate_sync_token


router = APIRouter()
MAX_SUMMARY_RECORDS_WITHOUT_CONFIRMATION = 5000
SYNC_LOCK = Lock()
SYNC_STATE: dict[str, Any] = {
  "running": False,
  "last_result": None,
  "last_error": None,
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


@router.get("/sync")
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


@router.get("/sync/trigger")
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
