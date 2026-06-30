import os
from typing import Any

import httpx
from fastapi import HTTPException

from backend.config.env import get_required_env


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


def get_supabase_headers() -> dict[str, str]:
  supabase_url, supabase_key = get_supabase_config()

  return {
    "apikey": supabase_key,
    "Authorization": f"Bearer {supabase_key}",
    "Content-Type": "application/json",
  }


def require_supabase_user(authorization: str | None) -> dict[str, Any]:
  if not authorization or not authorization.startswith("Bearer "):
    raise HTTPException(status_code=401, detail="Login administrativo obrigatorio.")

  supabase_url, supabase_key = get_supabase_config()
  response = httpx.get(
    f"{supabase_url}/auth/v1/user",
    headers={
      "apikey": supabase_key,
      "Authorization": authorization,
    },
    timeout=20,
  )

  if response.status_code >= 400:
    raise HTTPException(status_code=401, detail="Sessao administrativa invalida.")

  return response.json()


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


def fetch_supabase_table(
  table_name: str,
  params: dict[str, str],
  range_limit: int = 99999,
) -> list[dict[str, Any]]:
  supabase_url, _ = get_supabase_config()
  response = httpx.get(
    f"{supabase_url}/rest/v1/{table_name}",
    params=params,
    headers={
      **get_supabase_headers(),
      "Range": f"0-{range_limit}",
    },
    timeout=60,
  )

  if response.status_code >= 400:
    raise HTTPException(
      status_code=502,
      detail=f"Erro ao consultar {table_name} no Supabase: {response.text}",
    )

  return response.json()


def insert_supabase_record(
  table_name: str,
  record: dict[str, Any],
) -> dict[str, Any]:
  supabase_url, _ = get_supabase_config()
  response = httpx.post(
    f"{supabase_url}/rest/v1/{table_name}",
    headers={
      **get_supabase_headers(),
      "Prefer": "return=representation",
    },
    json=[record],
    timeout=60,
  )

  if response.status_code >= 400:
    raise HTTPException(
      status_code=502,
      detail=f"Erro ao salvar {table_name} no Supabase: {response.text}",
    )

  saved = response.json()
  return saved[0] if saved else record
