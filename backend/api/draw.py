import uuid
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from backend.services.supabase_service import (
  delete_supabase_records,
  fetch_supabase_table,
  insert_supabase_record,
  require_supabase_user,
)
from backend.utils.hash import build_canonical_participants, build_participants_hash
from backend.utils.security import choose_unbiased_index, get_code_commit_hash


router = APIRouter()
DRAW_ALGORITHM_VERSION = "server-rejection-sampling-256-v1"
DRAW_ALGORITHM_UPDATED_AT = "2026-04-30"


class DrawRequest(BaseModel):
  prize_item: str


@router.post("/draw")
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
  coupon: dict[str, Any] = coupon_rows[0] if coupon_rows else {}

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
