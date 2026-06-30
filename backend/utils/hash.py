import hashlib
import json
from typing import Any


def build_participants_hash(participants: list[dict[str, Any]]) -> str:
  canonical_participants = build_canonical_participants(participants)
  payload = json.dumps(
    canonical_participants,
    ensure_ascii=False,
    separators=(",", ":"),
    sort_keys=True,
  )

  return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def build_canonical_participants(participants: list[dict[str, Any]]) -> list[dict[str, str]]:
  return [
    {
      "id": str(item.get("id") or ""),
      "code": str(item.get("code") or ""),
      "cpf": str(item.get("cpf") or ""),
      "document": str(item.get("document") or ""),
      "validated_at": str(item.get("validated_at") or ""),
    }
    for item in participants
  ]
