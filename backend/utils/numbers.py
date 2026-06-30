from decimal import Decimal
from typing import Any


def to_float(value: Any) -> float:
  if isinstance(value, Decimal):
    return float(value)
  return float(value or 0)
