import os
from urllib.parse import quote_plus

from sqlalchemy import create_engine

from backend.config.env import get_required_env, get_required_env_any


def get_citel_engine():
  db_backend = os.environ.get("DB_BACKEND", "mysql").lower()

  if db_backend != "sqlserver":
    mysql_user = quote_plus(get_required_env_any("MYSQL_USER", "DB_USER"))
    mysql_pass = quote_plus(get_required_env_any("MYSQL_PASS", "DB_PASS"))
    mysql_host = get_required_env_any("MYSQL_HOST", "DB_HOST")
    mysql_port = os.environ.get("MYSQL_PORT") or os.environ.get("DB_PORT") or "3306"
    mysql_db = quote_plus(get_required_env_any("MYSQL_DB", "DB_NAME"))

    return create_engine(
      (
        f"mysql+pymysql://{mysql_user}:{mysql_pass}"
        f"@{mysql_host}:{mysql_port}/{mysql_db}?charset=utf8mb4"
      ),
      pool_pre_ping=True,
    )

  db_user = quote_plus(get_required_env("DB_USER"))
  db_pass = quote_plus(get_required_env("DB_PASS"))
  db_host = get_required_env("DB_HOST")
  db_port = os.environ.get("DB_PORT", "1433")
  db_name = quote_plus(get_required_env("DB_NAME"))

  return create_engine(
    f"mssql+pymssql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}",
    pool_pre_ping=True,
  )


def get_database_backend_name() -> str:
  if os.environ.get("DB_BACKEND", "mysql").lower() != "sqlserver":
    return "mysql"
  if os.environ.get("DB_HOST"):
    return "sqlserver"
  return "unconfigured"
