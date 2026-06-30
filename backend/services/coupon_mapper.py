from typing import Any

from sqlalchemy.engine import RowMapping

from backend.utils.cpf import normalize_cpf
from backend.utils.numbers import to_float


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
