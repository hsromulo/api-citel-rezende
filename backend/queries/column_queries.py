from sqlalchemy import text

from backend.database.engine import get_database_backend_name


def build_columns_query(table_name: str):
  if get_database_backend_name() == "mysql":
    return text(
      """
      SELECT COLUMN_NAME AS column_name
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table_name
      ORDER BY ORDINAL_POSITION
      """
    )

  return text(
    """
    SELECT COLUMN_NAME AS column_name
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = :table_name
    ORDER BY ORDINAL_POSITION
    """
  )
