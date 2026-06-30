from sqlalchemy import text

from backend.config.env import get_safe_identifier, get_safe_table_identifier


def build_sales_query():
  sales_table = get_safe_table_identifier("CITEL_SALES_TABLE", "CPPGER")
  client_table = get_safe_table_identifier("CITEL_CLIENT_TABLE", "CADCLI")
  movement_table = get_safe_table_identifier("CITEL_MOVEMENT_TABLE", "MOVGER")
  movement_increment_column = get_safe_identifier("CITEL_MOVEMENT_INCREMENT_COLUMN", "AUTOINCREM")
  movement_document_column = get_safe_identifier("CITEL_MOVEMENT_DOCUMENT_COLUMN", "GER_NUMDOC")
  movement_document_type_column = get_safe_identifier("CITEL_MOVEMENT_DOCUMENT_TYPE_COLUMN", "GER_ESPDOC")
  movement_company_column = get_safe_identifier("CITEL_MOVEMENT_COMPANY_COLUMN", "GER_CODEMP")
  movement_client_column = get_safe_identifier("CITEL_MOVEMENT_CLIENT_COLUMN", "GER_CODCLI")
  sales_client_column = get_safe_identifier("CITEL_SALES_CLIENT_COLUMN", "CPG_CODCLI")
  sales_document_column = get_safe_identifier("CITEL_SALES_DOCUMENT_COLUMN", "CPG_NUMDOC")
  sales_document_type_column = get_safe_identifier("CITEL_SALES_DOCUMENT_TYPE_COLUMN", "CPG_ESPDOC")
  sales_company_column = get_safe_identifier("CITEL_SALES_COMPANY_COLUMN", "CPG_CODEMP")
  client_code_column = get_safe_identifier("CITEL_CLIENT_CODE_COLUMN", "CLI_CODCLI")
  cpf_column = get_safe_identifier("CITEL_CPF_COLUMN", "CLI_C_G_C_")
  amount_column = get_safe_identifier("CITEL_AMOUNT_COLUMN", "CPG_VALDOC")
  customer_name_column = get_safe_identifier("CITEL_CUSTOMER_NAME_COLUMN", "CLI_NOMCLI")

  return text(
    f"""
    SELECT
      clients.{cpf_column} AS cpf,
      clients.{client_code_column} AS customer_code,
      clients.{customer_name_column} AS customer_name,
      COALESCE(
        SUM(
          CASE
            WHEN TRIM(CAST(movements.{movement_increment_column} AS CHAR)) <> ''
            THEN sales.{amount_column}
            ELSE 0
          END
        ),
        0
      ) AS total_faturamento,
      COALESCE(
        COUNT(
          CASE
            WHEN TRIM(CAST(movements.{movement_increment_column} AS CHAR)) <> ''
            THEN 1
            ELSE NULL
          END
        ),
        0
      ) AS cupons_disponiveis
    FROM {client_table} AS clients
    LEFT JOIN {sales_table} AS sales
      ON sales.{sales_client_column} = clients.{client_code_column}
    LEFT JOIN {movement_table} AS movements
      ON movements.{movement_document_column} = sales.{sales_document_column}
      AND movements.{movement_document_type_column} = sales.{sales_document_type_column}
      AND movements.{movement_company_column} = sales.{sales_company_column}
      AND movements.{movement_client_column} = sales.{sales_client_column}
    WHERE clients.{cpf_column} IS NOT NULL
    GROUP BY
      clients.{cpf_column},
      clients.{client_code_column},
      clients.{customer_name_column}
    """
  )
