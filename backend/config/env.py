import os
import re

from fastapi import HTTPException


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
