import re
from typing import Any


def normalize_cpf(value: Any) -> str:
  return re.sub(r"\D", "", str(value or ""))
