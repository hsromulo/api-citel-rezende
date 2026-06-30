import os
import secrets

from fastapi import Header, HTTPException, Query


def get_code_commit_hash() -> str:
  return (
    os.environ.get("COMMIT_HASH")
    or os.environ.get("RENDER_GIT_COMMIT")
    or os.environ.get("GIT_COMMIT")
    or "unknown"
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


def choose_unbiased_index(total: int) -> tuple[int, int]:
  random_space = 1 << 256
  limit = random_space - (random_space % total)

  while True:
    random_value = secrets.randbits(256)
    if random_value < limit:
      return random_value % total, random_value
