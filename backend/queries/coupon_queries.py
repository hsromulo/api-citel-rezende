from sqlalchemy import text

from backend.config.env import get_safe_identifier, get_safe_table_identifier


def build_detailed_coupon_query():
  sales_table = get_safe_table_identifier("CITEL_SALES_TABLE", "CPPGER")
  client_table = get_safe_table_identifier("CITEL_CLIENT_TABLE", "CADCLI")
  movement_table = get_safe_table_identifier("CITEL_MOVEMENT_TABLE", "MOVGER")
  seller_table = get_safe_table_identifier("CITEL_SELLER_TABLE", "CADOPE")
  movement_increment_column = get_safe_identifier("CITEL_MOVEMENT_INCREMENT_COLUMN", "AUTOINCREM")
  movement_document_column = get_safe_identifier("CITEL_MOVEMENT_DOCUMENT_COLUMN", "GER_NUMDOC")
  movement_document_type_column = get_safe_identifier("CITEL_MOVEMENT_DOCUMENT_TYPE_COLUMN", "GER_ESPDOC")
  movement_company_column = get_safe_identifier("CITEL_MOVEMENT_COMPANY_COLUMN", "GER_CODEMP")
  movement_client_column = get_safe_identifier("CITEL_MOVEMENT_CLIENT_COLUMN", "GER_CODCLI")
  sales_sequence_column = get_safe_identifier("CITEL_SALES_SEQUENCE_COLUMN", "CPG_SEQUEN")
  sales_date_column = get_safe_identifier("CITEL_SALES_DATE_COLUMN", "CPG_DTAENT")
  sales_time_column = get_safe_identifier("CITEL_SALES_TIME_COLUMN", "CPG_HORENT")
  sales_document_column = get_safe_identifier("CITEL_SALES_DOCUMENT_COLUMN", "CPG_NUMDOC")
  sales_document_type_column = get_safe_identifier("CITEL_SALES_DOCUMENT_TYPE_COLUMN", "CPG_ESPDOC")
  sales_client_column = get_safe_identifier("CITEL_SALES_CLIENT_COLUMN", "CPG_CODCLI")
  sales_company_column = get_safe_identifier("CITEL_SALES_COMPANY_COLUMN", "CPG_CODEMP")
  client_code_column = get_safe_identifier("CITEL_CLIENT_CODE_COLUMN", "CLI_CODCLI")
  cpf_column = get_safe_identifier("CITEL_CPF_COLUMN", "CLI_C_G_C_")
  amount_column = get_safe_identifier("CITEL_AMOUNT_COLUMN", "CPG_VALDOC")
  customer_name_column = get_safe_identifier("CITEL_CUSTOMER_NAME_COLUMN", "CLI_NOMCLI")
  movement_seller_column = get_safe_identifier("CITEL_MOVEMENT_SELLER_COLUMN", "GER_CODVEN")
  phone_column = get_safe_identifier("CITEL_PHONE_COLUMN", "CLI_FONE01")
  mobile_column = get_safe_identifier("CITEL_MOBILE_COLUMN", "CLI_CELULA")
  address_column = get_safe_identifier("CITEL_ADDRESS_COLUMN", "CLI_ENDERE")
  neighborhood_column = get_safe_identifier("CITEL_NEIGHBORHOOD_COLUMN", "CLI_BAIRRO")
  zipcode_column = get_safe_identifier("CITEL_ZIPCODE_COLUMN", "CLI_C_E_P_")
  seller_code_column = get_safe_identifier("CITEL_SELLER_CODE_COLUMN", "OPE_CODOPE")
  seller_name_column = get_safe_identifier("CITEL_SELLER_NAME_COLUMN", "OPE_NOMOPE")
  return text(
    f"""
    SELECT
      sales.{sales_sequence_column} AS coupon_code,
      sales.{sales_date_column} AS sale_date,
      sales.{sales_time_column} AS sale_time,
      sales.{sales_document_column} AS document_number,
      sales.{sales_document_type_column} AS document_type,
      clients.{cpf_column} AS cpf,
      sales.{sales_client_column} AS customer_code,
      sales.{amount_column} AS document_amount,
      movements.{movement_seller_column} AS seller_code,
      sellers.{seller_name_column} AS seller_name,
      clients.{customer_name_column} AS customer_name,
      clients.{phone_column} AS customer_phone,
      clients.{mobile_column} AS customer_mobile,
      clients.{address_column} AS customer_address,
      clients.{neighborhood_column} AS customer_neighborhood,
      clients.{zipcode_column} AS customer_zipcode
    FROM {sales_table} AS sales
    INNER JOIN {client_table} AS clients
      ON sales.{sales_client_column} = clients.{client_code_column}
    INNER JOIN {movement_table} AS movements
      ON movements.{movement_document_column} = sales.{sales_document_column}
      AND movements.{movement_document_type_column} = sales.{sales_document_type_column}
      AND movements.{movement_company_column} = sales.{sales_company_column}
      AND movements.{movement_client_column} = sales.{sales_client_column}
    LEFT JOIN {seller_table} AS sellers
      ON movements.{movement_seller_column} = sellers.{seller_code_column}
    WHERE clients.{cpf_column} IS NOT NULL
      AND TRIM(CAST(movements.{movement_increment_column} AS CHAR)) <> ''
    """
  )
